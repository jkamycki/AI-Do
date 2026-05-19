import { Router } from "express";
import multer from "multer";
import { createRequire } from "node:module";
import JSZip from "jszip";
import he from "he";
import { db, documents, vendorContracts, vendors } from "@workspace/db";
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

type SelectedVendor = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  primaryContact: string | null;
  files: VendorFile[];
};

async function ensureVendorContractVendorColumn() {
  if (vendorContractVendorColumnReady) return;
  await db.execute(sql`ALTER TABLE vendor_contracts ADD COLUMN IF NOT EXISTS vendor_id integer`);
  vendorContractVendorColumnReady = true;
}

function normalizeContractFileName(name: string) {
  return name.trim().toLowerCase().replace(/\.[^.]+$/, "").replace(/\s+/g, " ");
}

function contractDocumentFileType(fileName: string, mimeType: string): string {
  const name = fileName.toLowerCase();
  if (mimeType.includes("pdf") || name.endsWith(".pdf")) return "PDF";
  if (mimeType.includes("word") || name.endsWith(".docx")) return "DOCX";
  if (mimeType.includes("text") || name.endsWith(".txt")) return "TXT";
  return "FILE";
}

function cleanDocumentFileName(fileName: string): string {
  return fileName.replace(/[^\w.\- ]+/g, " ").replace(/\s+/g, " ").trim() || "Wedding contract";
}

function isSpecified(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !isNotSpecified(value);
}

function contractAnalysisToDocumentFields(
  analysis: Record<string, unknown>,
  vendor: SelectedVendor | null,
): NonNullable<typeof documents.$inferInsert.extractedFields> {
  const keyTerms = Array.isArray(analysis.keyTerms)
    ? analysis.keyTerms.map((item) => asObject(item))
    : [];
  const deliverables = keyTerms
    .filter((term) => /services|deliverables|included/i.test(asText(term.label)))
    .map((term) => asText(term.value))
    .filter((value) => value && !isNotSpecified(value));
  const paymentTerms = asText(analysis.paymentTerms);
  const paymentSchedule = isSpecified(paymentTerms)
    ? [{ label: "Payment schedule", amount: null, dueDate: null, notes: paymentTerms }]
    : [];
  const suggestedTasks = [
    ...paymentSchedule.map((payment) => ({
      title: `Review payment terms for ${vendor?.name ?? "contract"}`,
      task: `Review payment terms for ${vendor?.name ?? "contract"}`,
      description: payment.notes ?? "",
      dueDate: null,
    })),
    ...asTextArray(analysis.missingClauses).slice(0, 2).map((clause) => ({
      title: `Review missing contract clause: ${clause}`,
      task: `Review missing contract clause: ${clause}`,
      description: "Contract Analyzer flagged this as a possible missing protection.",
      dueDate: null,
    })),
  ];

  return {
    vendorName: vendor?.name ?? null,
    paymentSchedule,
    dueDates: [],
    cancellationPolicy: isSpecified(analysis.cancellationPolicy) ? asText(analysis.cancellationPolicy) : null,
    deliverables,
    contactInfo: {
      name: vendor?.primaryContact ?? null,
      phone: vendor?.phone ?? null,
      email: vendor?.email ?? null,
      address: vendor?.address ?? null,
    },
    suggestedTasks,
    suggestedVendorId: vendor?.id ?? null,
    suggestedVendorName: vendor?.name ?? null,
  };
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

function normalizeContractRedFlags(value: unknown): Array<{ severity: string; title: string; detail: string; recommendation: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const flag = asObject(item);
      return {
        severity: asText(flag.severity, "medium").toLowerCase(),
        title: asText(flag.title, "Contract concern"),
        detail: asText(flag.detail),
        recommendation: asText(flag.recommendation),
      };
    })
    .filter((flag) => flag.title || flag.detail || flag.recommendation);
}

function buildFallbackNegotiationEmail({
  vendorType,
  redFlags,
}: {
  vendorType: string;
  redFlags: Array<{ severity: string; title: string; detail: string; recommendation: string }>;
}) {
  const requests = redFlags.map((flag, index) => {
    const recommendation = flag.recommendation || "Could you please clarify this section in writing and update the contract language so both sides understand the expectation?";
    const detail = flag.detail ? ` I noticed that ${flag.detail.charAt(0).toLowerCase()}${flag.detail.slice(1)}` : "";
    return `${index + 1}. ${flag.title}:${detail} ${recommendation}`;
  }).join("\n\n");

  return `Hi [Vendor Name],

Thank you again for sending over the ${vendorType} agreement. We are excited about working together and want to make sure we fully understand the contract before signing.

After reviewing it, we had a few items we would like to clarify or adjust:

${requests}

Could you please let us know whether these updates can be made in the agreement, or send written clarification for each point?

Thank you,
[Your Names]`;
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
    try {
      const repaired = candidate
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/[“”]/g, "\"")
        .replace(/[‘’]/g, "'");
      return asObject(JSON.parse(repaired));
    } catch {}
  }
  return null;
}

function normalizeRisk(value: unknown): "low" | "medium" | "high" {
  return value === "low" || value === "medium" || value === "high" ? value : "medium";
}

function isUsefulKeyTerm(term: { label: string; value: string }): boolean {
  const label = term.label.toLowerCase();
  const value = term.value.toLowerCase();
  if (!term.label || !term.value) return false;
  if (label === "label" || value === "value") return false;
  if (label.includes("document text") || label.includes("review status")) return false;
  return true;
}

function isNotSpecified(value: string): boolean {
  const text = value.trim().toLowerCase();
  return !text || text === "not specified" || text === "n/a" || text === "none";
}

function sentenceSnippets(text: string): string[] {
  return sanitizeText(text)
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?;:])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 25 && sentence.length <= 700);
}

function contractSnippet(text: string, keywords: RegExp[], fallbackKeywords: string[] = []): string {
  const sentences = sentenceSnippets(text);
  const matches = sentences.filter((sentence) => keywords.some((keyword) => keyword.test(sentence)));
  const selected = matches.slice(0, 3);
  if (selected.length > 0) return selected.join(" ");

  const lower = text.toLowerCase();
  for (const keyword of fallbackKeywords) {
    const index = lower.indexOf(keyword.toLowerCase());
    if (index < 0) continue;
    const start = Math.max(0, index - 140);
    const end = Math.min(text.length, index + 520);
    return sanitizeText(text.slice(start, end)).replace(/\s+/g, " ").trim();
  }
  return "Not specified";
}

function guessVendorType(contractText: string): string {
  const lower = contractText.toLowerCase();
  const matches: Array<[RegExp, string]> = [
    [/\b(photo|photography|photographer)\b/, "Photographer"],
    [/\b(video|videography|videographer)\b/, "Videographer"],
    [/\b(cater|menu|meal|bar service|beverage)\b/, "Caterer"],
    [/\b(venue|facility|premises|event space)\b/, "Venue"],
    [/\b(dj|disc jockey|music|sound system)\b/, "DJ / Band"],
    [/\b(floral|florist|flowers|bouquet)\b/, "Florist"],
    [/\b(hair|makeup|beauty|stylist)\b/, "Hair & Makeup"],
    [/\b(planner|coordination|coordinator)\b/, "Wedding Planner"],
    [/\b(cake|bakery|dessert)\b/, "Cake & Desserts"],
    [/\b(transport|shuttle|limousine|limo)\b/, "Transportation"],
  ];
  return matches.find(([pattern]) => pattern.test(lower))?.[1] ?? "Vendor";
}

function keyTermFromText(contractText: string, label: string): { label: string; value: string } {
  const termConfig: Record<string, { patterns: RegExp[]; fallbacks: string[] }> = {
    "Payment schedule": {
      patterns: [/\b(payment|deposit|retainer|balance|installment|fee|total|amount due|due date|late fee|invoice)\b/i, /\$\s?\d|(?:\d+)%/i],
      fallbacks: ["payment", "deposit", "retainer", "balance", "fee", "$"],
    },
    "Cancellation/refund": {
      patterns: [/\b(cancel|cancellation|refund|non[-\s]?refundable|termination|forfeit|notice)\b/i],
      fallbacks: ["cancel", "refund", "non-refundable", "termination"],
    },
    "Services included": {
      patterns: [/\b(services?|package|deliverables?|included|provide|coverage|hours?|staff|setup|breakdown|menu|gallery|photos?|video|flowers?)\b/i],
      fallbacks: ["services", "package", "included", "deliverables", "provide"],
    },
    "Rescheduling/force majeure": {
      patterns: [/\b(reschedul|postpon|force majeure|weather|emergency|act of god|availability|substitute)\b/i],
      fallbacks: ["reschedule", "postpone", "force majeure", "weather", "emergency"],
    },
    "Liability/insurance": {
      patterns: [/\b(liabil|indemn|insurance|damage|loss|hold harmless|responsib|waiver)\b/i],
      fallbacks: ["liability", "indemn", "insurance", "damage", "hold harmless"],
    },
  };
  const config = termConfig[label];
  return {
    label,
    value: config ? contractSnippet(contractText, config.patterns, config.fallbacks) : "Not specified",
  };
}

function extractedContractTerms(contractText: string): {
  keyTerms: Array<{ label: string; value: string }>;
  paymentTerms: string;
  cancellationPolicy: string;
  liabilityNotes: string;
} {
  const labels = ["Payment schedule", "Cancellation/refund", "Services included", "Rescheduling/force majeure", "Liability/insurance"];
  const keyTerms = labels.map((label) => keyTermFromText(contractText, label));
  const find = (label: string) => keyTerms.find((term) => term.label === label)?.value ?? "Not specified";
  return {
    keyTerms,
    paymentTerms: find("Payment schedule"),
    cancellationPolicy: find("Cancellation/refund"),
    liabilityNotes: find("Liability/insurance"),
  };
}

function aiClaimsMissingContractText(analysis: Record<string, unknown>): boolean {
  const combined = [
    analysis.summary,
    analysis.paymentTerms,
    analysis.cancellationPolicy,
    analysis.liabilityNotes,
    ...(Array.isArray(analysis.redFlags) ? analysis.redFlags.flatMap((flag) => {
      const obj = asObject(flag);
      return [obj.title, obj.detail, obj.recommendation];
    }) : []),
    ...(Array.isArray(analysis.keyTerms) ? analysis.keyTerms.flatMap((term) => {
      const obj = asObject(term);
      return [obj.label, obj.value];
    }) : []),
  ].map((value) => asText(value).toLowerCase()).join(" ");
  return /\b(no|missing|not provided|did not receive|without)\b.{0,80}\b(contract text|document text|contract|key terms)\b/i.test(combined);
}

function enrichAnalysisWithContractText(raw: Record<string, unknown>, contractText: string): Record<string, unknown> {
  const normalized = normalizeAnalysis(raw);
  const normalizedKeyTerms = Array.isArray(normalized.keyTerms)
    ? normalized.keyTerms as Array<{ label: string; value: string }>
    : [];
  const normalizedRedFlags = Array.isArray(normalized.redFlags)
    ? normalized.redFlags as Array<{ severity: "low" | "medium" | "high"; title: string; detail: string; recommendation: string }>
    : [];
  const normalizedPositives = asTextArray(normalized.positives);
  const extracted = extractedContractTerms(contractText);
  const existingByLabel = new Map(
    normalizedKeyTerms.map((term) => [term.label.toLowerCase(), term])
  );
  const keyTerms = extracted.keyTerms.map((fallbackTerm) => {
    const existing = existingByLabel.get(fallbackTerm.label.toLowerCase());
    return existing && !isNotSpecified(existing.value) ? existing : fallbackTerm;
  });
  for (const term of normalizedKeyTerms) {
    if (!keyTerms.some((existing) => existing.label.toLowerCase() === term.label.toLowerCase())) {
      keyTerms.push(term);
    }
  }

  const redFlags = normalizedRedFlags.filter((flag) =>
    !/missing contract text|no contract text|contract text/i.test(`${flag.title} ${flag.detail}`)
  );

  return {
    ...normalized,
    vendorType: normalized.vendorType === "Vendor" ? guessVendorType(contractText) : normalized.vendorType,
    keyTerms,
    paymentTerms: isNotSpecified(String(normalized.paymentTerms ?? "")) ? extracted.paymentTerms : normalized.paymentTerms,
    cancellationPolicy: isNotSpecified(String(normalized.cancellationPolicy ?? "")) ? extracted.cancellationPolicy : normalized.cancellationPolicy,
    liabilityNotes: isNotSpecified(String(normalized.liabilityNotes ?? "")) ? extracted.liabilityNotes : normalized.liabilityNotes,
    redFlags,
    positives: normalizedPositives.length ? normalizedPositives : ["Contract text was successfully extracted and reviewed."],
  };
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
      }).filter(isUsefulKeyTerm)
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

function splitFields(line: string, count: number): string[] {
  const parts = line.split("|").map((part) => part.trim());
  while (parts.length < count) parts.push("");
  return parts.slice(0, count);
}

function parseTaggedAnalysis(raw: string): Record<string, unknown> | null {
  const analysis: Record<string, unknown> = {
    redFlags: [],
    keyTerms: [],
    positives: [],
    missingClauses: [],
    negotiationTips: [],
  };
  const lines = raw
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim().replace(/^[-*]\s*/, ""))
    .filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^([A-Z_ ]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1].trim().replace(/\s+/g, "_");
    const value = match[2].trim();
    if (!value) continue;

    if (key === "OVERALL_RISK") analysis.overallRiskLevel = value.toLowerCase();
    if (key === "VENDOR_TYPE") analysis.vendorType = value;
    if (key === "SUMMARY") analysis.summary = value;
    if (key === "CANCELLATION_POLICY") analysis.cancellationPolicy = value;
    if (key === "PAYMENT_TERMS") analysis.paymentTerms = value;
    if (key === "LIABILITY_NOTES") analysis.liabilityNotes = value;
    if (key === "RED_FLAG") {
      const [severity, title, detail, recommendation] = splitFields(value, 4);
      (analysis.redFlags as unknown[]).push({ severity, title, detail, recommendation });
    }
    if (key === "KEY_TERM") {
      const [label, termValue] = splitFields(value, 2);
      (analysis.keyTerms as unknown[]).push({ label, value: termValue });
    }
    if (key === "POSITIVE") (analysis.positives as string[]).push(value);
    if (key === "MISSING_CLAUSE") (analysis.missingClauses as string[]).push(value);
    if (key === "NEGOTIATION_TIP") (analysis.negotiationTips as string[]).push(value);
  }

  const hasRealAnalysis = Boolean(
    analysis.summary ||
    (analysis.redFlags as unknown[]).length ||
    (analysis.keyTerms as unknown[]).length
  );
  return hasRealAnalysis ? analysis : null;
}

function parseAnalysisResponse(raw: string): Record<string, unknown> | null {
  return parseJsonObject(raw) ?? parseTaggedAnalysis(raw);
}

function buildFallbackAnalysis(contractText: string): Record<string, unknown> {
  const lower = contractText.toLowerCase();
  const extracted = extractedContractTerms(contractText);
  const missingClauses = [
    !lower.includes("cancel") && "Cancellation policy",
    !lower.includes("liabil") && !lower.includes("indemn") && "Liability or indemnification terms",
    !lower.includes("force majeure") && "Force majeure / emergency terms",
  ].filter(Boolean) as string[];

  return normalizeAnalysis({
    overallRiskLevel: "medium",
    vendorType: guessVendorType(contractText),
    summary: "A.IDO extracted the contract text and prepared a contract review from the clauses it could identify. Review the original document carefully, especially payment, cancellation, liability, rescheduling, and force majeure terms.",
    redFlags: [
      {
        severity: "medium",
        title: "Manual review recommended",
        detail: "This contract should be reviewed for financial risk, cancellation rules, liability allocation, and day-of service obligations before signing.",
        recommendation: "Ask the vendor for written clarification on any unclear terms and have a qualified attorney review the final contract.",
      },
    ],
    keyTerms: extracted.keyTerms,
    cancellationPolicy: extracted.cancellationPolicy,
    paymentTerms: extracted.paymentTerms,
    liabilityNotes: extracted.liabilityNotes,
    positives: ["Contract text was successfully extracted and saved."],
    missingClauses,
    negotiationTips: ["Ask the vendor to clarify cancellation, payment, liability, rescheduling, and force majeure terms in writing."],
  });
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

    const prompt = `You are a wedding contract attorney. Analyze this vendor contract for a couple planning their wedding.

CONTRACT_TEXT_START
${trimmedContractText}
CONTRACT_TEXT_END

Important: if there is text between CONTRACT_TEXT_START and CONTRACT_TEXT_END, you received contract text. Do not say no contract text was provided.

Return ONLY this tagged report format. Do not use markdown, bullets, numbering, or JSON.

OVERALL_RISK: low OR medium OR high
VENDOR_TYPE: short vendor type
SUMMARY: 2-3 sentences for the couple
CANCELLATION_POLICY: exact practical summary or Not specified
PAYMENT_TERMS: exact practical summary or Not specified
LIABILITY_NOTES: exact practical summary or Not specified
RED_FLAG: severity | title | detail | recommendation
RED_FLAG: severity | title | detail | recommendation
KEY_TERM: Payment schedule | exact deposits, due dates, balances, and late fees or Not specified
KEY_TERM: Cancellation/refund | refund deadlines, forfeited amounts, and cancellation notice rules or Not specified
KEY_TERM: Services included | concrete deliverables, hours, staffing, package inclusions, or Not specified
KEY_TERM: Rescheduling/force majeure | weather, emergency, postponement, and availability terms or Not specified
KEY_TERM: Liability/insurance | liability caps, indemnity, damage responsibility, insurance requirements, or Not specified
POSITIVE: one thing that looks favorable
MISSING_CLAUSE: clause or protection missing
NEGOTIATION_TIP: specific suggested ask

For KEY_TERM rows, do not use generic labels like "Important clause" or "Contract term". Use the exact labels above when applicable and put the practical contract detail in the value.
Focus on clauses that could financially harm the couple or cause day-of issues.`;

    const completion = await openai.chat.completions.create({
      model: getModel(),
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 2048,
    }, { signal: AbortSignal.timeout(90_000) });

    const analysisRaw = completion.choices[0]?.message?.content ?? "{}";
    let parsedAnalysis = parseAnalysisResponse(analysisRaw);
    if (!parsedAnalysis) {
      req.log.warn({ preview: analysisRaw.slice(0, 500) }, "Contract AI returned unstructured analysis");
      try {
        const repairPrompt = `Convert the following contract analysis response into ONLY the tagged report format below. Do not use markdown, bullets, numbering, or JSON.

OVERALL_RISK: low OR medium OR high
VENDOR_TYPE: short vendor type
SUMMARY: 2-3 sentences for the couple
CANCELLATION_POLICY: exact practical summary or Not specified
PAYMENT_TERMS: exact practical summary or Not specified
LIABILITY_NOTES: exact practical summary or Not specified
RED_FLAG: severity | title | detail | recommendation
KEY_TERM: Payment schedule | exact deposits, due dates, balances, and late fees or Not specified
KEY_TERM: Cancellation/refund | refund deadlines, forfeited amounts, and cancellation notice rules or Not specified
KEY_TERM: Services included | concrete deliverables, hours, staffing, package inclusions, or Not specified
KEY_TERM: Rescheduling/force majeure | weather, emergency, postponement, and availability terms or Not specified
KEY_TERM: Liability/insurance | liability caps, indemnity, damage responsibility, insurance requirements, or Not specified
POSITIVE: one thing that looks favorable
MISSING_CLAUSE: clause or protection missing
NEGOTIATION_TIP: specific suggested ask

SOURCE RESPONSE:
${analysisRaw.slice(0, 12000)}`;
        const repairCompletion = await openai.chat.completions.create({
          model: getModel(),
          messages: [{ role: "user", content: repairPrompt }],
          max_completion_tokens: 1600,
        }, { signal: AbortSignal.timeout(45_000) });
        parsedAnalysis = parseAnalysisResponse(repairCompletion.choices[0]?.message?.content ?? "{}");
      } catch (err) {
        req.log.warn({ err }, "Contract AI repair attempt failed");
      }
    }
    if (parsedAnalysis && aiClaimsMissingContractText(parsedAnalysis)) {
      req.log.warn({ fileName: originalname, extractedLength: extractedText.length }, "Contract AI incorrectly claimed missing contract text");
      parsedAnalysis = null;
    }
    const analysis = parsedAnalysis
      ? enrichAnalysisWithContractText(parsedAnalysis, extractedText)
      : buildFallbackAnalysis(extractedText);

    const displayName = (req.body?.displayName as string | undefined)?.trim() || originalname;
    const syncToDocumentLibrary = String(req.body?.syncToDocumentLibrary ?? "").toLowerCase() === "true";
    const rawVendorId = (req.body?.vendorId as string | undefined)?.trim();
    let vendorId: number | null = null;
    if (rawVendorId) {
      const parsedVendorId = Number(rawVendorId);
      if (!Number.isInteger(parsedVendorId) || parsedVendorId <= 0) {
        return res.status(400).json({ error: "Invalid vendor selection." });
      }
      vendorId = parsedVendorId;
    }
    let selectedVendor: SelectedVendor | null = null;
    if (vendorId) {
      const [vendor] = await db
        .select({
          id: vendors.id,
          name: vendors.name,
          email: vendors.email,
          phone: vendors.phone,
          address: vendors.address,
          primaryContact: vendors.primaryContact,
          files: vendors.files,
        })
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
        const storedUrl = await storage.uploadObjectEntityFile(buffer, displayName, mimetype, {
          owner: scope.userId,
          visibility: "private",
        });
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

    if (syncToDocumentLibrary) {
      try {
        const documentFileName = cleanDocumentFileName(displayName);
        const fileUrl = await storage.uploadObjectEntityFile(buffer, documentFileName, mimetype, {
          owner: scope.userId,
          visibility: "private",
        });
        await db.insert(documents).values({
          profileId: scope.profileId,
          userId: scope.userId,
          fileUrl,
          fileName: documentFileName,
          originalFileName: cleanDocumentFileName(originalname),
          fileType: contractDocumentFileType(originalname, mimetype),
          mimeType: mimetype,
          fileSize: size,
          uploadedBy: req.userId!,
          linkedVendorId: selectedVendor?.id ?? null,
          summary: asText(analysis.summary, "Contract Analyzer reviewed this contract. Open Extract Info for payment terms, cancellation policy, deliverables, and vendor contact details."),
          extractedFields: contractAnalysisToDocumentFields(analysis, selectedVendor),
          tags: ["Contract", "Contract Analyzer"],
          folder: "Contracts",
          visibility: [],
          extractedText: extractedText.slice(0, 40000),
        });
      } catch (err) {
        req.log.warn({ err, contractId: saved.id }, "Failed to sync contract to document library");
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

    const analysis = asObject(contract.analysis);
    const redFlags = normalizeContractRedFlags(analysis.redFlags);

    if (!redFlags.length) {
      return res.status(400).json({ error: "No red flags found — no negotiation needed." });
    }

    const { preferredLanguage } = req.body as { preferredLanguage?: string };
    const langInstruction = preferredLanguage && preferredLanguage !== "English"
      ? `\n\nIMPORTANT: Write the entire email in ${preferredLanguage}.`
      : "";

    const vendorType = asText(analysis.vendorType, "vendor");
    const flagsSummary = redFlags
      .map((f, i) => `${i + 1}. [${f.severity.toUpperCase()}] ${f.title}: ${f.detail}. Recommendation: ${f.recommendation}`)
      .join("\n");
    const fallbackEmail = buildFallbackNegotiationEmail({ vendorType, redFlags });

    const prompt = `You're a wedding planner helping a couple negotiate with their ${vendorType}. Their contract review found these red flags:

${flagsSummary}

Write a polite, firm negotiation email from the couple. Open with appreciation, address each flag diplomatically requesting specific changes, sound like a real person not a lawyer, close warmly. Use [Your Names] and [Vendor Name] as placeholders. Return ONLY the email body — no subject line, no extras.${langInstruction}`;

    try {
    const completion = await openai.chat.completions.create({
      model: getModel(),
      messages: [{ role: "user", content: prompt }],
      // Was 1200. Negotiation emails are 200-400 words ≈ 600 tokens; 800 leaves room for longer flag lists.
      max_completion_tokens: 800,
    });

    const emailText = completion.choices[0]?.message?.content?.trim() ?? "";
    res.json({ negotiationEmail: emailText || fallbackEmail });
    } catch (err) {
      req.log.warn({ err, contractId: id }, "Negotiation AI failed; using fallback draft");
      res.json({ negotiationEmail: fallbackEmail, source: "fallback" });
    }
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
