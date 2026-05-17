import { Router } from "express";
import multer from "multer";
import { createRequire } from "node:module";
import JSZip from "jszip";
import he from "he";
import { db, vendorContracts, vendors } from "@workspace/db";
import { eq, desc, and, sql, ne } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { resolveProfile, resolveScopeUserId, resolveCallerRole, hasMinRole } from "../lib/workspaceAccess";
import { openai, getModel } from "@workspace/integrations-openai-ai-server";
import { ObjectStorageService } from "../lib/objectStorage";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require("pdf-parse");

const router = Router();
const storage = new ObjectStorageService();
let vendorContractVendorColumnReady = false;
type VendorFile = {
  name: string;
  url: string;
  type: string;
  uploadedAt?: string;
  contractId?: number;
  contractFileName?: string;
};

async function ensureVendorContractVendorColumn() {
  if (vendorContractVendorColumnReady) return;
  await db.execute(sql`ALTER TABLE vendor_contracts ADD COLUMN IF NOT EXISTS vendor_id integer`);
  vendorContractVendorColumnReady = true;
}

function normalizeContractFileName(name: string) {
  return name.trim().toLowerCase().replace(/\.[^.]+$/, "").replace(/\s+/g, " ");
}

const ALLOWED_CONTRACT_MIMES = new Set([
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  // 5MB cap — protects Render memory from DoS via large uploads.
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok =
      ALLOWED_CONTRACT_MIMES.has(file.mimetype) ||
      file.originalname.toLowerCase().endsWith(".txt") ||
      file.originalname.toLowerCase().endsWith(".docx");
    if (!ok) {
      cb(new Error("Unsupported file type. Please upload a PDF, DOCX, or .txt file."));
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

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asText(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asTextArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => asText(item)).filter(Boolean) : [];
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const candidates = [cleaned];
  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0] && objectMatch[0] !== cleaned) candidates.push(objectMatch[0]);

  for (const candidate of candidates) {
    try {
      return asObject(JSON.parse(candidate));
    } catch {}
  }
  return null;
}

function normalizeRisk(value: unknown): "low" | "medium" | "high" {
  return value === "low" || value === "medium" || value === "high" ? value : "medium";
}

function normalizeAnalysis(raw: Record<string, unknown>): Record<string, unknown> {
  const redFlags = Array.isArray(raw.redFlags)
    ? raw.redFlags.map((item) => {
        const flag = asObject(item);
        return {
          severity: normalizeRisk(flag.severity),
          title: asText(flag.title, "Contract concern"),
          detail: asText(flag.detail),
          recommendation: asText(flag.recommendation),
        };
      }).filter((flag) => flag.detail || flag.recommendation || flag.title !== "Contract concern")
    : [];
  const keyTerms = Array.isArray(raw.keyTerms)
    ? raw.keyTerms.map((item) => {
        const term = asObject(item);
        return { label: asText(term.label), value: asText(term.value) };
      }).filter((term) => term.label || term.value)
    : [];

  return {
    overallRiskLevel: normalizeRisk(raw.overallRiskLevel),
    vendorType: asText(raw.vendorType, "Vendor"),
    summary: asText(raw.summary, "AI reviewed this contract, but returned a brief response. Review the extracted key terms and consider having an attorney review the original document."),
    redFlags,
    keyTerms,
    cancellationPolicy: asText(raw.cancellationPolicy, "Not specified"),
    paymentTerms: asText(raw.paymentTerms, "Not specified"),
    liabilityNotes: asText(raw.liabilityNotes, "Not specified"),
    positives: asTextArray(raw.positives),
    missingClauses: asTextArray(raw.missingClauses),
    negotiationTips: asTextArray(raw.negotiationTips),
  };
}

function xmlTextToPlainText(xml: string): string {
  return sanitizeText(
    he.decode(
      xml
        .replace(/<w:tab\b[^>]*\/>/g, "\t")
        .replace(/<w:br\b[^>]*\/>/g, "\n")
        .replace(/<\/w:p>/g, "\n")
        .replace(/<\/w:tr>/g, "\n")
        .replace(/<[^>]+>/g, " "),
    ),
  ).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const parts = [
      "word/document.xml",
      ...Object.keys(zip.files).filter((name) =>
        /^word\/(?:header|footer|footnotes|endnotes)\d*\.xml$/i.test(name)
      ),
    ];
    const textParts: string[] = [];
    for (const part of parts) {
      const file = zip.file(part);
      if (!file) continue;
      const xml = await file.async("string");
      const text = xmlTextToPlainText(xml);
      if (text) textParts.push(text);
    }
    return sanitizeText(textParts.join("\n\n")).slice(0, 40000);
  } catch (err) {
    process.stderr.write(`[contracts] DOCX extraction failed: ${err instanceof Error ? err.message : String(err)}\n`);
    return "";
  }
}

async function resolveContractScope(req: Parameters<typeof resolveProfile>[0]) {
  const profile = await resolveProfile(req);
  if (!profile) return null;
  return {
    userId: await resolveScopeUserId(req),
    profileId: profile.id,
  };
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
  if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return extractDocxText(buffer);
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
      req.log?.warn({ error: msg }, "Contract upload rejected");
      return res.status(400).json({ error: msg || "Invalid contract upload." });
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
    const scope = await resolveContractScope(req);
    if (!scope) return res.status(400).json({ error: "No wedding profile found." });
    await ensureVendorContractVendorColumn();

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
      max_completion_tokens: 2048,
    }, { signal: AbortSignal.timeout(90_000) });

    const analysisRaw = completion.choices[0]?.message?.content ?? "{}";
    const parsedAnalysis = parseJsonObject(analysisRaw);
    if (!parsedAnalysis) {
      req.log.warn({ preview: analysisRaw.slice(0, 500) }, "Contract AI returned invalid JSON");
      return res.status(502).json({
        error: "The AI returned an unreadable analysis. Please try again.",
      });
    }
    const analysis = normalizeAnalysis(parsedAnalysis);

    const displayName = (req.body?.displayName as string | undefined)?.trim() || originalname;
    const rawVendorId = (req.body?.vendorId as string | undefined)?.trim();
    let vendorId: number | null = null;
    if (rawVendorId) {
      const parsedVendorId = Number(rawVendorId);
      if (!Number.isInteger(parsedVendorId) || parsedVendorId <= 0) {
        return res.status(400).json({ error: "Invalid vendor selection." });
      }
      vendorId = parsedVendorId;
    }
    let selectedVendor: { id: number; files: VendorFile[] } | null = null;
    if (vendorId) {
      const [vendor] = await db
        .select({ id: vendors.id, files: vendors.files })
        .from(vendors)
        .where(and(eq(vendors.id, vendorId), eq(vendors.profileId, scope.profileId)))
        .limit(1);
      if (!vendor) return res.status(400).json({ error: "Selected vendor was not found." });
      selectedVendor = vendor;
    }

    const [saved] = await db
      .insert(vendorContracts)
      .values({
        userId: scope.userId,
        profileId: scope.profileId,
        vendorId,
        fileName: displayName,
        fileSize: size,
        mimeType: mimetype,
        extractedText: extractedText.slice(0, 10000),
        analysis,
      })
      .returning();

    if (selectedVendor) {
      try {
        const storedUrl = await storage.uploadObjectEntityFile(buffer, displayName, mimetype);
        const contractFile = {
          name: displayName,
          url: storedUrl,
          type: mimetype,
          uploadedAt: saved.createdAt.toISOString(),
          contractId: saved.id,
          contractFileName: displayName,
        };
        const existingFiles = Array.isArray(selectedVendor.files) ? selectedVendor.files : [];
        const normalizedDisplayName = normalizeContractFileName(displayName);
        const dedupedFiles = existingFiles.filter((file) => {
          const fileContractName = typeof file.contractFileName === "string" ? file.contractFileName : file.name;
          const sameContract = file.contractId === saved.id || normalizeContractFileName(fileContractName) === normalizedDisplayName;
          return !sameContract;
        });
        await db
          .update(vendors)
          .set({ files: [...dedupedFiles, contractFile], updatedAt: new Date() })
          .where(and(eq(vendors.id, selectedVendor.id), eq(vendors.profileId, scope.profileId)));
      } catch (err) {
        req.log.warn({ err, vendorId: selectedVendor.id, contractId: saved.id }, "Failed to attach contract to vendor files");
      }
    }

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
    const scope = await resolveContractScope(req);
    if (!scope) return res.status(404).json({ error: "Contract not found." });
    const [contract] = await db
      .select({
        extractedText: vendorContracts.extractedText,
        analysis: vendorContracts.analysis,
        fileName: vendorContracts.fileName,
      })
      .from(vendorContracts)
      .where(and(
        eq(vendorContracts.id, id),
        eq(vendorContracts.userId, scope.userId),
        eq(vendorContracts.profileId, scope.profileId),
      ))
      .limit(1);

    if (!contract) {
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
      max_completion_tokens: 800,
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
    const scope = await resolveContractScope(req);
    if (!scope) return res.json([]);
    await ensureVendorContractVendorColumn();
    const rows = await db
      .select({
        id: vendorContracts.id,
        vendorId: vendorContracts.vendorId,
        vendorName: vendors.name,
        fileName: vendorContracts.fileName,
        fileSize: vendorContracts.fileSize,
        analysis: vendorContracts.analysis,
        createdAt: vendorContracts.createdAt,
      })
      .from(vendorContracts)
      .leftJoin(vendors, and(
        eq(vendorContracts.vendorId, vendors.id),
        eq(vendors.profileId, scope.profileId),
      ))
      .where(and(
        eq(vendorContracts.userId, scope.userId),
        eq(vendorContracts.profileId, scope.profileId),
      ))
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
    const scope = await resolveContractScope(req);
    if (!scope) return res.status(404).json({ error: "Contract not found" });
    const [updated] = await db
      .update(vendorContracts)
      .set({ fileName: fileName.trim() })
      .where(and(
        eq(vendorContracts.id, id),
        eq(vendorContracts.userId, scope.userId),
        eq(vendorContracts.profileId, scope.profileId),
      ))
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
    const scope = await resolveContractScope(req);
    if (!scope) return res.json({ success: true });
    await ensureVendorContractVendorColumn();
    const contractId = parseInt(String(req.params["id"] ?? "0"), 10);
    const [contract] = await db
      .select({
        id: vendorContracts.id,
        vendorId: vendorContracts.vendorId,
        fileName: vendorContracts.fileName,
      })
      .from(vendorContracts)
      .where(and(
        eq(vendorContracts.id, contractId),
        eq(vendorContracts.userId, scope.userId),
        eq(vendorContracts.profileId, scope.profileId),
      ))
      .limit(1);

    if (contract?.vendorId) {
      const normalizedContractName = normalizeContractFileName(contract.fileName);
      const duplicateRows = await db
        .select({
          id: vendorContracts.id,
          fileName: vendorContracts.fileName,
        })
        .from(vendorContracts)
        .where(and(
          eq(vendorContracts.userId, scope.userId),
          eq(vendorContracts.profileId, scope.profileId),
          eq(vendorContracts.vendorId, contract.vendorId),
          ne(vendorContracts.id, contract.id),
        ))
        .orderBy(desc(vendorContracts.createdAt));
      const hasNewerSameDocument = duplicateRows.some((row) =>
        normalizeContractFileName(row.fileName) === normalizedContractName
      );

      const [vendor] = await db
        .select({ id: vendors.id, files: vendors.files })
        .from(vendors)
        .where(and(eq(vendors.id, contract.vendorId), eq(vendors.profileId, scope.profileId)))
        .limit(1);
      if (vendor) {
        const existingFiles = Array.isArray(vendor.files) ? (vendor.files as VendorFile[]) : [];
        const remainingFiles = existingFiles.filter((file) => {
          if (file.contractId != null) return file.contractId !== contract.id;
          const fileContractName = typeof file.contractFileName === "string" ? file.contractFileName : file.name;
          return hasNewerSameDocument || normalizeContractFileName(fileContractName) !== normalizedContractName;
        });
        if (remainingFiles.length !== existingFiles.length) {
          await db
            .update(vendors)
            .set({ files: remainingFiles, updatedAt: new Date() })
            .where(and(eq(vendors.id, vendor.id), eq(vendors.profileId, scope.profileId)));
        }
      }
    }

    await db
      .delete(vendorContracts)
      .where(and(
        eq(vendorContracts.id, contractId),
        eq(vendorContracts.userId, scope.userId),
        eq(vendorContracts.profileId, scope.profileId),
      ));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
