import { Router } from "express";
import multer from "multer";
import { createRequire } from "node:module";
import { db, vendorContracts } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { resolveScopeUserId, resolveCallerRole, hasMinRole } from "../lib/workspaceAccess";
import { openai, getModel } from "@workspace/integrations-openai-ai-server";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require("pdf-parse");

const router = Router();
const ALLOWED_CONTRACT_MIMES = new Set([
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  // 5MB cap — protects Render memory from DoS via large uploads.
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok =
      ALLOWED_CONTRACT_MIMES.has(file.mimetype) ||
      file.originalname.toLowerCase().endsWith(".txt");
    if (!ok) {
      cb(new Error("Unsupported file type. Please upload a PDF, Word doc, or .txt file."));
      return;
    }
    cb(null, true);
  },
});

function sanitizeText(text: string): string {
  // Remove null bytes and other control characters PostgreSQL can't handle
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u0000/g, "").replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ").trim();
}

async function extractText(buffer: Buffer, mimetype: string): Promise<string> {
  if (mimetype === "text/plain" || mimetype === "text/html") {
    return sanitizeText(buffer.toString("utf8")).slice(0, 40000);
  }
  if (mimetype === "application/pdf") {
    try {
      const result = await pdfParse(buffer);
      const text = sanitizeText(result.text);
      if (!text.trim()) {
        throw new Error("No text extracted from PDF");
      }
      return text.slice(0, 40000);
    } catch (err) {
      // Note: no req context here (utility fn) — log to stderr is acceptable
      process.stderr.write(`[contracts] PDF extraction failed: ${err instanceof Error ? err.message : String(err)}\n`);
      return "";
    }
  }
  // For Word docs and other types attempt raw text but sanitize heavily
  try {
    const raw = sanitizeText(buffer.toString("utf8"));
    // If it looks mostly binary (low ratio of printable chars), reject it
    const printable = (raw.match(/[\x20-\x7E\n\r\t]/g) ?? []).length;
    if (raw.length > 0 && printable / raw.length < 0.6) {
      return "";
    }
    return raw.slice(0, 40000);
  } catch {
    return "";
  }
}

router.post(
  "/contracts/upload",
  requireAuth,
  // Wrap multer so file-size / file-type errors return clean 400s instead of
  // bubbling up as 500s and leaking stack traces.
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (!err) return next();
      const msg = err instanceof Error ? err.message : String(err);
      const code = (err as { code?: string }).code;
      if (code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "File is too large. Maximum size is 5 MB." });
      }
      return res.status(400).json({ error: msg });
    });
  },
  async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }
    const { buffer, originalname, mimetype, size } = req.file;

    const extractedText = await extractText(buffer, mimetype);

    if (!extractedText.trim()) {
      return res.status(422).json({
        error: mimetype === "application/pdf"
          ? "Could not extract readable text from this PDF. Please ensure it is a text-based PDF (not a scanned image). Try opening it in a PDF editor and re-saving, or paste the contract text into a .txt file."
          : "Could not extract readable text from this file. Please upload a PDF or plain text (.txt) file.",
      });
    }

    // Truncate to ~7K chars (~1.7K tokens) using a HEAD + TAIL strategy.
    // Critical clauses (cancellation, payment terms, liability, force majeure,
    // signatures) almost always appear in the FIRST or LAST sections of a
    // contract; the middle is usually scope-of-work boilerplate. Keeping
    // 4K head + 3K tail preserves both. This was the single biggest TPD
    // waste before — 12-page PDFs were sending 8-10K input tokens per call.
    const HEAD_CHARS = 4000;
    const TAIL_CHARS = 3000;
    const trimmedContractText = extractedText.length > HEAD_CHARS + TAIL_CHARS + 200
      ? `${extractedText.slice(0, HEAD_CHARS)}\n\n[…middle of contract omitted for length; full text kept on file…]\n\n${extractedText.slice(-TAIL_CHARS)}`
      : extractedText;

    const prompt = `You are a wedding contract attorney. Analyze this vendor contract and return a JSON risk assessment.

CONTRACT:
${trimmedContractText}

Return ONLY this JSON shape:
{"overallRiskLevel":"low|medium|high","vendorType":"string","summary":"2-3 sentences","redFlags":[{"severity":"high|medium|low","title":"string","detail":"string","recommendation":"string"}],"keyTerms":[{"label":"string","value":"string"}],"cancellationPolicy":"string or 'Not specified'","paymentTerms":"string or 'Not specified'","liabilityNotes":"string or 'Not specified'","positives":["string"],"missingClauses":["string"],"negotiationTips":["string"]}

Focus on clauses that could financially harm the couple or cause day-of issues.`;

    const completion = await openai.chat.completions.create({
      model: getModel(),
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      // 2048 tokens for comprehensive risk analyses with full clause coverage.
      max_tokens: 2048,
    }, { signal: AbortSignal.timeout(90_000) });

    const analysisRaw = completion.choices[0]?.message?.content ?? "{}";
    let analysis: Record<string, unknown> = {};
    try {
      analysis = JSON.parse(analysisRaw);
    } catch {
      analysis = { error: "Failed to parse AI response", raw: analysisRaw };
    }

    const displayName = (req.body?.displayName as string | undefined)?.trim() || originalname;

    const scopeUserId = await resolveScopeUserId(req);
    const [saved] = await db
      .insert(vendorContracts)
      .values({
        userId: scopeUserId,
        fileName: displayName,
        fileSize: size,
        mimeType: mimetype,
        extractedText: extractedText.slice(0, 10000),
        analysis,
      })
      .returning();

    res.json({ id: saved.id, analysis, fileName: originalname });
  } catch (err) {
    req.log.error(err, "Contract analysis failed");
    res.status(500).json({ error: "Analysis failed. Please try again." });
  }
  },
);

router.post("/contracts/:id/negotiate", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const id = parseInt(String(req.params["id"] ?? "0"), 10);
    const [contract] = await db
      .select({
        extractedText: vendorContracts.extractedText,
        analysis: vendorContracts.analysis,
        fileName: vendorContracts.fileName,
        userId: vendorContracts.userId,
      })
      .from(vendorContracts)
      .where(eq(vendorContracts.id, id))
      .limit(1);

    const scopeUserId = await resolveScopeUserId(req);
    if (!contract || contract.userId !== scopeUserId) {
      return res.status(404).json({ error: "Contract not found." });
    }

    const analysis = contract.analysis as Record<string, unknown> | null;
    const redFlags = (analysis?.redFlags ?? []) as Array<{ severity: string; title: string; detail: string; recommendation: string }>;

    if (!redFlags.length) {
      return res.status(400).json({ error: "No red flags found — no negotiation needed." });
    }

    const { preferredLanguage } = req.body as { preferredLanguage?: string };
    const langInstruction = preferredLanguage && preferredLanguage !== "English"
      ? `\n\nIMPORTANT: Write the entire email in ${preferredLanguage}.`
      : "";

    const vendorType = (analysis?.vendorType as string) ?? "vendor";
    const flagsSummary = redFlags
      .map((f, i) => `${i + 1}. [${f.severity.toUpperCase()}] ${f.title}: ${f.detail}. Recommendation: ${f.recommendation}`)
      .join("\n");

    const prompt = `You're a wedding planner helping a couple negotiate with their ${vendorType}. Their contract review found these red flags:

${flagsSummary}

Write a polite, firm negotiation email from the couple. Open with appreciation, address each flag diplomatically requesting specific changes, sound like a real person not a lawyer, close warmly. Use [Your Names] and [Vendor Name] as placeholders. Return ONLY the email body — no subject line, no extras.${langInstruction}`;

    const completion = await openai.chat.completions.create({
      model: getModel(),
      messages: [{ role: "user", content: prompt }],
      // Was 1200. Negotiation emails are 200-400 words ≈ 600 tokens; 800 leaves room for longer flag lists.
      max_tokens: 800,
    });

    const emailText = completion.choices[0]?.message?.content?.trim() ?? "";
    res.json({ negotiationEmail: emailText });
  } catch (err) {
    req.log.error(err, "Failed to generate negotiation response");
    res.status(500).json({ error: "Failed to generate negotiation response. Please try again." });
  }
});

router.get("/contracts", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const userId = await resolveScopeUserId(req);
    const rows = await db
      .select({
        id: vendorContracts.id,
        fileName: vendorContracts.fileName,
        fileSize: vendorContracts.fileSize,
        analysis: vendorContracts.analysis,
        createdAt: vendorContracts.createdAt,
      })
      .from(vendorContracts)
      .where(eq(vendorContracts.userId, userId))
      .orderBy(desc(vendorContracts.createdAt))
      .limit(50);

    res.json(rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/contracts/:id", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const id = parseInt(String(req.params["id"] ?? "0"), 10);
    const { fileName } = req.body;
    if (!fileName || typeof fileName !== "string" || !fileName.trim()) {
      return res.status(400).json({ error: "fileName is required" });
    }
    const userId = await resolveScopeUserId(req);
    const [updated] = await db
      .update(vendorContracts)
      .set({ fileName: fileName.trim() })
      .where(and(eq(vendorContracts.id, id), eq(vendorContracts.userId, userId)))
      .returning({ id: vendorContracts.id, fileName: vendorContracts.fileName });
    if (!updated) return res.status(404).json({ error: "Contract not found" });
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/contracts/:id", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const userId = await resolveScopeUserId(req);
    await db
      .delete(vendorContracts)
      .where(and(
        eq(vendorContracts.id, parseInt(String(req.params["id"] ?? "0"), 10)),
        eq(vendorContracts.userId, userId),
      ));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
