import { Router } from "express";
import multer from "multer";
import { createRequire } from "node:module";
import { db, vendorContracts } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { resolveScopeUserId, resolveCallerRole, hasMinRole } from "../lib/workspaceAccess";
import { openai } from "@workspace/integrations-openai-ai-server";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require("pdf-parse");

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "text/plain", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    cb(null, allowed.includes(file.mimetype) || file.originalname.endsWith(".txt"));
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
      console.error("[contracts] PDF extraction failed:", err instanceof Error ? err.message : String(err));
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

router.post("/contracts/upload", requireAuth, upload.single("file"), async (req, res) => {
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

    const prompt = `You are an expert wedding contract attorney reviewing a vendor contract for a couple. Analyze the following contract text and provide a structured risk assessment in JSON format.

CONTRACT TEXT:
${extractedText}

Return ONLY valid JSON in this exact format:
{
  "overallRiskLevel": "low" | "medium" | "high",
  "vendorType": "string (e.g., Photographer, Caterer, Venue, Florist, DJ, etc.)",
  "summary": "2-3 sentence plain-language summary of what this contract covers",
  "redFlags": [
    { "severity": "high" | "medium" | "low", "title": "string", "detail": "string", "recommendation": "string" }
  ],
  "keyTerms": [
    { "label": "string", "value": "string" }
  ],
  "cancellationPolicy": "string describing cancellation terms or 'Not specified'",
  "paymentTerms": "string describing payment schedule or 'Not specified'",
  "liabilityNotes": "string describing liability clauses or 'Not specified'",
  "positives": ["string"],
  "missingClauses": ["string"],
  "negotiationTips": ["string"]
}

Be thorough, specific, and couple-friendly. Focus on clauses that could financially harm the couple or cause day-of issues.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 2000,
    });

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
});

router.post("/contracts/:id/negotiate", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const id = parseInt(req.params["id"] ?? "0");
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

    const vendorType = (analysis?.vendorType as string) ?? "vendor";
    const flagsSummary = redFlags
      .map((f, i) => `${i + 1}. [${f.severity.toUpperCase()}] ${f.title}: ${f.detail}. Recommendation: ${f.recommendation}`)
      .join("\n");

    const prompt = `You are a professional wedding planner helping a couple negotiate contract terms with their ${vendorType}.

The couple's contract has the following red flags identified by an attorney review:

${flagsSummary}

Write a professional, polite, and firm negotiation email from the couple to the vendor. The email should:
- Open with appreciation for their services
- Address each red flag clearly but diplomatically, requesting specific changes
- Be assertive but not aggressive — assume good faith from the vendor
- Close with a request for a revised contract and a positive tone
- Sound like a real person wrote it, not a legal document
- Be ready to copy and paste — use [Your Names] and [Vendor Name] as placeholders

Return ONLY the email body text, no subject line, no extra explanation.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1200,
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
    const id = parseInt(req.params["id"] ?? "0");
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
        eq(vendorContracts.id, parseInt(req.params["id"] ?? "0")),
        eq(vendorContracts.userId, userId),
      ));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
