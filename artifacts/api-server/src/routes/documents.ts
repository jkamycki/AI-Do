import { Router } from "express";
import type { Response } from "express";
import multer from "multer";
import { createRequire } from "node:module";
import JSZip from "jszip";
import he from "he";
import PDFDocument from "pdfkit";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, checklistItems, documents, vendors } from "@workspace/db";
import { openai, getModel } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../middlewares/requireAuth";
import { ObjectStorageService } from "../lib/objectStorage";
import { trackEvent } from "../lib/trackEvent";
import { hasMinRole, resolveCallerRole, resolveProfile } from "../lib/workspaceAccess";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require("pdf-parse");

const router = Router();
const storage = new ObjectStorageService();
type PdfDoc = InstanceType<typeof PDFDocument>;

const ALLOWED_DOCUMENT_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    const ok =
      ALLOWED_DOCUMENT_MIMES.has(file.mimetype) ||
      name.endsWith(".pdf") ||
      name.endsWith(".docx") ||
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg") ||
      name.endsWith(".png");
    if (!ok) {
      cb(new Error("Unsupported file type. Please upload a PDF, DOCX, JPG, or PNG file."));
      return;
    }
    cb(null, true);
  },
});

type ExtractedFields = {
  vendorName?: string | null;
  paymentSchedule?: Array<{ label?: string; amount?: number | null; dueDate?: string | null; notes?: string | null }>;
  dueDates?: Array<{ label?: string; date?: string | null; notes?: string | null }>;
  cancellationPolicy?: string | null;
  deliverables?: string[];
  contactInfo?: { name?: string | null; phone?: string | null; email?: string | null; address?: string | null };
  suggestedTasks?: Array<{ title?: string; task?: string; description?: string; dueDate?: string | null }>;
  suggestedVendorId?: number | null;
  suggestedVendorName?: string | null;
};

function sanitizeText(text: string): string {
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

function asNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
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
        .replace(/[\u201c\u201d]/g, "\"")
        .replace(/[\u2018\u2019]/g, "'");
      return asObject(JSON.parse(repaired));
    } catch {}
  }
  return null;
}

function fileTypeFromName(fileName: string, mimeType: string): string {
  const name = fileName.toLowerCase();
  if (mimeType.includes("pdf") || name.endsWith(".pdf")) return "PDF";
  if (mimeType.includes("word") || name.endsWith(".docx")) return "DOCX";
  if (mimeType.includes("png") || name.endsWith(".png")) return "PNG";
  if (mimeType.includes("jpeg") || name.endsWith(".jpg") || name.endsWith(".jpeg")) return "JPG";
  return "FILE";
}

function cleanFileName(fileName: string): string {
  return fileName.replace(/[^\w.\- ]+/g, " ").replace(/\s+/g, " ").trim() || "Wedding document";
}

function cleanPdfFileName(fileName: string): string {
  const base = cleanFileName(fileName).replace(/\.[^.]+$/, "").replace(/\s+/g, "-").toLowerCase();
  return `${base || "wedding-document"}.pdf`;
}

function cleanFolderName(folder: string): string {
  const cleaned = folder.replace(/[^\w.\- &()]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "General";
  return cleaned.toLowerCase() === "contract analyzer" ? "Contracts" : cleaned;
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const doc = await zip.file("word/document.xml")?.async("string");
  if (!doc) return "";
  return sanitizeText(
    he.decode(
      doc
        .replace(/<\/w:p>/g, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " "),
    ),
  );
}

async function extractDocumentText(file: Express.Multer.File): Promise<string> {
  const name = file.originalname.toLowerCase();
  if (file.mimetype === "application/pdf" || name.endsWith(".pdf")) {
    const parsed = await pdfParse(file.buffer);
    return sanitizeText(parsed.text || "");
  }
  if (file.mimetype.includes("wordprocessingml") || name.endsWith(".docx")) {
    return extractDocxText(file.buffer);
  }
  return "";
}

function normalizeExtractedFields(raw: unknown): ExtractedFields {
  const obj = asObject(raw);
  const contact = asObject(obj.contactInfo);
  return {
    vendorName: asText(obj.vendorName) || null,
    paymentSchedule: Array.isArray(obj.paymentSchedule)
      ? obj.paymentSchedule.map((item) => {
          const row = asObject(item);
          return {
            label: asText(row.label, "Payment"),
            amount: asNullableNumber(row.amount),
            dueDate: asText(row.dueDate) || null,
            notes: asText(row.notes) || null,
          };
        })
      : [],
    dueDates: Array.isArray(obj.dueDates)
      ? obj.dueDates.map((item) => {
          const row = asObject(item);
          return {
            label: asText(row.label, "Deadline"),
            date: asText(row.date) || null,
            notes: asText(row.notes) || null,
          };
        })
      : [],
    cancellationPolicy: asText(obj.cancellationPolicy) || null,
    deliverables: asTextArray(obj.deliverables),
    contactInfo: {
      name: asText(contact.name) || null,
      phone: asText(contact.phone) || null,
      email: asText(contact.email) || null,
      address: asText(contact.address) || null,
    },
    suggestedTasks: Array.isArray(obj.suggestedTasks)
      ? obj.suggestedTasks.map((item) => {
          const row = asObject(item);
          return {
            title: asText(row.title) || asText(row.task) || "Review document task",
            task: asText(row.task) || asText(row.title) || "Review document task",
            description: asText(row.description),
            dueDate: asText(row.dueDate) || null,
          };
        })
      : [],
    suggestedVendorName: asText(obj.suggestedVendorName) || asText(obj.vendorName) || null,
    suggestedVendorId: asNullableNumber(obj.suggestedVendorId),
  };
}

function fallbackSummary(fileName: string, extractedText: string, fileType: string): string {
  if (!extractedText) {
    return `${fileName} is saved as a ${fileType} document. Open Summary or Preview to review the original file.`;
  }
  const text = extractedText.replace(/\s+/g, " ").trim();
  const vendor = text.match(/(?:www\.)?([A-Z0-9][A-Z0-9&'. -]{2,80}?)(?:\s+(?:Contract|Agreement|Invoice|Proposal|Date)\b| \/\/)/i)?.[1]?.trim();
  const contractDate = text.match(/Contract Date:\s*([^/]{4,50})/i)?.[1]?.trim();
  const amount = text.match(/\$[\d,]+(?:\.\d{2})?/)?.[0];
  const pieces = [
    vendor ? `${vendor} document` : `${fileName} was read and saved`,
    contractDate ? `dated ${contractDate}` : null,
    amount ? `with a possible payment amount of ${amount}` : null,
  ].filter(Boolean);
  return `${pieces.join(", ")}. Open Extract Info for payment details, policies, deliverables, and contact fields.`;
}

function fallbackFields(fileName: string, extractedText: string): ExtractedFields {
  const text = extractedText.replace(/\s+/g, " ");
  const amountMatches = Array.from(text.matchAll(/\$[\d,]+(?:\.\d{2})?/g)).slice(0, 4).map((m, index) => ({
    label: index === 0 ? "Possible payment" : `Possible payment ${index + 1}`,
    amount: asNullableNumber(m[0]),
    dueDate: null,
    notes: m[0],
  }));
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
  const phone = text.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/)?.[0] ?? null;
  return {
    vendorName: null,
    paymentSchedule: amountMatches,
    dueDates: [],
    cancellationPolicy: text.toLowerCase().includes("cancel") ? "Cancellation language appears in the document. Review the preview for exact terms." : null,
    deliverables: [],
    contactInfo: { name: null, phone, email, address: null },
    suggestedTasks: amountMatches.map((payment) => ({
      title: `Review payment in ${fileName}`,
      task: `Review payment in ${fileName}`,
      description: payment.notes ?? "",
      dueDate: null,
    })),
    suggestedVendorName: null,
    suggestedVendorId: null,
  };
}

async function analyzeDocument(fileName: string, fileType: string, extractedText: string, imageDataUrl?: string): Promise<{ summary: string; fields: ExtractedFields }> {
  if ((!extractedText || extractedText.length < 40) && !imageDataUrl) {
    return {
      summary: fallbackSummary(fileName, extractedText, fileType),
      fields: fallbackFields(fileName, extractedText),
    };
  }

  try {
    const textPrompt = `Analyze this wedding document and return JSON with:
{
  "summary": "short useful summary",
  "vendorName": "vendor or null",
  "paymentSchedule": [{"label":"Deposit","amount":1000,"dueDate":"YYYY-MM-DD or null","notes":"short note"}],
  "dueDates": [{"label":"Final count due","date":"YYYY-MM-DD or null","notes":"short note"}],
  "cancellationPolicy": "short policy or null",
  "deliverables": ["deliverable"],
  "contactInfo": {"name": null, "phone": null, "email": null, "address": null},
  "suggestedTasks": [{"title":"Task title","task":"Task title","description":"why this task matters","dueDate":"YYYY-MM-DD or null"}],
  "suggestedVendorName": "vendor or null"
}

File name: ${fileName}
File type: ${fileType}
${extractedText ? `Document text:\n${extractedText.slice(0, 18000)}` : "This is an image document. Read visible text and layout from the image."}`;
    const response = await openai.chat.completions.create({
      model: getModel(),
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "Extract wedding planning document information. Return only valid JSON.",
        },
        {
          role: "user",
          content: imageDataUrl
            ? [
                { type: "text", text: textPrompt },
                { type: "image_url", image_url: { url: imageDataUrl } },
              ]
            : textPrompt,
        },
      ],
    });
    const raw = response.choices[0]?.message?.content ?? "";
    const parsed = parseJsonObject(raw);
    if (!parsed) throw new Error("No JSON returned");
    return {
      summary: asText(parsed.summary, fallbackSummary(fileName, extractedText, fileType)),
      fields: normalizeExtractedFields(parsed),
    };
  } catch {
    return {
      summary: fallbackSummary(fileName, extractedText, fileType),
      fields: fallbackFields(fileName, extractedText),
    };
  }
}

async function findMatchingVendor(profileId: number, fields: ExtractedFields, fileName: string) {
  const candidate = fields.vendorName || fields.suggestedVendorName || fileName.replace(/\.[^.]+$/, "");
  if (!candidate.trim()) return null;
  const rows = await db
    .select({ id: vendors.id, name: vendors.name })
    .from(vendors)
    .where(and(eq(vendors.profileId, profileId), or(ilike(vendors.name, `%${candidate}%`), ilike(vendors.category, `%${candidate}%`))))
    .limit(1);
  if (rows[0]) return rows[0];

  const all = await db
    .select({ id: vendors.id, name: vendors.name })
    .from(vendors)
    .where(eq(vendors.profileId, profileId));
  const lowerName = fileName.toLowerCase();
  return all.find((vendor) => lowerName.includes(vendor.name.toLowerCase())) ?? null;
}

function normalizeTags(value: unknown): string[] {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((item) => asText(item)).filter((item) => item && item.toLowerCase() !== "contract analyzer"))).slice(0, 20)
    : [];
}

function normalizeChecklistTaskKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeVisibility(value: unknown): string[] {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((item) => asText(item)).filter(Boolean))).slice(0, 20)
    : [];
}

function writePdfSection(doc: PdfDoc, title: string, body: string | string[]) {
  const lines = Array.isArray(body) ? body.filter(Boolean) : [body].filter(Boolean);
  if (!lines.length) return;
  if (doc.y > doc.page.height - 140) doc.addPage();
  doc.moveDown(0.8);
  doc.fillColor("#8D294D").font("Helvetica-Bold").fontSize(13).text(title);
  doc.moveDown(0.25);
  doc.fillColor("#3F2B35").font("Helvetica").fontSize(10.5);
  for (const line of lines) {
    doc.text(line, { width: 500, lineGap: 3 });
    doc.moveDown(0.2);
  }
}

function finishDocumentPdf(doc: PdfDoc, res: Response, filename: string) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  doc.pipe(res);
  doc.end();
}

function buildDocumentPdf(record: typeof documents.$inferSelect, res: Response) {
  const pdf = new PDFDocument({ size: "A4", margin: 46, autoFirstPage: true });
  const fields = normalizeExtractedFields(record.extractedFields);
  const created = record.createdAt ? new Date(record.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";

  pdf.rect(0, 0, pdf.page.width, 76).fill("#FFF7F2");
  pdf.rect(0, 74, pdf.page.width, 2).fill("#8D294D");
  pdf.fillColor("#8D294D").font("Helvetica-Bold").fontSize(22).text("A.IDO Document", 46, 24);
  pdf.fillColor("#6F3E54").font("Helvetica").fontSize(10).text("PDF copy from Document Library", 46, 52);
  pdf.y = 104;

  pdf.fillColor("#24171D").font("Helvetica-Bold").fontSize(18).text(record.fileName || "Wedding document", { width: 500 });
  pdf.moveDown(0.3);
  pdf.fillColor("#6F3E54").font("Helvetica").fontSize(10).text(
    [`Type: ${record.fileType || "Document"}`, created ? `Uploaded: ${created}` : null].filter(Boolean).join("  |  "),
  );

  writePdfSection(pdf, "Summary", record.summary || "No summary is available yet.");

  const payments = (fields.paymentSchedule ?? []).map((payment) => {
    const amount = payment.amount ? `$${payment.amount.toLocaleString("en-US")}` : "Amount not listed";
    return `${payment.label || "Payment"}: ${amount}${payment.dueDate ? ` due ${payment.dueDate}` : ""}${payment.notes ? ` - ${payment.notes}` : ""}`;
  });
  writePdfSection(pdf, "Payment Schedule", payments);

  const dueDates = (fields.dueDates ?? []).map((item) => `${item.label || "Deadline"}${item.date ? `: ${item.date}` : ""}${item.notes ? ` - ${item.notes}` : ""}`);
  writePdfSection(pdf, "Due Dates", dueDates);
  writePdfSection(pdf, "Deliverables", fields.deliverables ?? []);
  writePdfSection(pdf, "Cancellation Policy", fields.cancellationPolicy || "");

  const contact = fields.contactInfo;
  writePdfSection(pdf, "Contact Info", [
    contact?.name ? `Name: ${contact.name}` : "",
    contact?.phone ? `Phone: ${contact.phone}` : "",
    contact?.email ? `Email: ${contact.email}` : "",
    contact?.address ? `Address: ${contact.address}` : "",
  ]);

  const textPreview = sanitizeText(record.extractedText || "").slice(0, 3000);
  writePdfSection(pdf, "Extracted Text Preview", textPreview);

  pdf.fillColor("#8D7480").font("Helvetica").fontSize(8).text("Generated by A.IDO", 46, pdf.page.height - 38, {
    align: "center",
    width: pdf.page.width - 92,
  });

  finishDocumentPdf(pdf, res, cleanPdfFileName(record.fileName || record.originalFileName || "wedding-document"));
}

router.get("/documents", requireAuth, async (req, res) => {
  const profile = await resolveProfile(req);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const rows = await db
    .select({
      id: documents.id,
      fileUrl: documents.fileUrl,
      fileName: documents.fileName,
      originalFileName: documents.originalFileName,
      fileType: documents.fileType,
      mimeType: documents.mimeType,
      fileSize: documents.fileSize,
      uploadedBy: documents.uploadedBy,
      linkedVendorId: documents.linkedVendorId,
      linkedVendorName: vendors.name,
      summary: documents.summary,
      extractedFields: documents.extractedFields,
      tags: documents.tags,
      folder: documents.folder,
      visibility: documents.visibility,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .leftJoin(vendors, eq(documents.linkedVendorId, vendors.id))
    .where(eq(documents.profileId, profile.id))
    .orderBy(desc(documents.createdAt));

  res.json({
    documents: rows.map((row) => ({
      ...row,
      folder: cleanFolderName(row.folder || "General"),
      tags: normalizeTags(row.tags),
    })),
  });
});

router.get("/documents/:id", requireAuth, async (req, res) => {
  const profile = await resolveProfile(req);
  if (!profile) return res.status(404).json({ error: "Profile not found" });
  const id = Number(req.params.id);
  const rows = await db
    .select({
      id: documents.id,
      fileUrl: documents.fileUrl,
      fileName: documents.fileName,
      originalFileName: documents.originalFileName,
      fileType: documents.fileType,
      mimeType: documents.mimeType,
      fileSize: documents.fileSize,
      uploadedBy: documents.uploadedBy,
      linkedVendorId: documents.linkedVendorId,
      linkedVendorName: vendors.name,
      summary: documents.summary,
      extractedFields: documents.extractedFields,
      tags: documents.tags,
      folder: documents.folder,
      visibility: documents.visibility,
      extractedText: documents.extractedText,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .leftJoin(vendors, eq(documents.linkedVendorId, vendors.id))
    .where(and(eq(documents.id, id), eq(documents.profileId, profile.id)))
    .limit(1);
  if (!rows[0]) return res.status(404).json({ error: "Document not found" });
  res.json({
    document: {
      ...rows[0],
      folder: cleanFolderName(rows[0].folder || "General"),
      tags: normalizeTags(rows[0].tags),
    },
  });
});

router.get("/documents/:id/download-pdf", requireAuth, async (req, res) => {
  const profile = await resolveProfile(req);
  if (!profile) return res.status(404).json({ error: "Profile not found" });
  const id = Number(req.params.id);
  const rows = await db.select().from(documents).where(and(eq(documents.id, id), eq(documents.profileId, profile.id))).limit(1);
  const doc = rows[0];
  if (!doc) return res.status(404).json({ error: "Document not found" });

  trackEvent(req.userId!, "pdf_exported", { type: "document_library", documentId: id, fileType: doc.fileType });
  buildDocumentPdf(doc, res);
});

router.post("/documents/upload", requireAuth, upload.single("file"), async (req, res) => {
  const role = await resolveCallerRole(req);
  if (!hasMinRole(role, "planner")) return res.status(403).json({ error: "Only owners, partners, and planners can upload documents." });
  const profile = await resolveProfile(req);
  if (!profile) return res.status(404).json({ error: "Profile not found" });
  if (!req.file) return res.status(400).json({ error: "No document was uploaded." });

  const originalName = cleanFileName(req.file.originalname);
  const fileType = fileTypeFromName(originalName, req.file.mimetype);
  const extractedText = await extractDocumentText(req.file).catch(() => "");
  const imageDataUrl = req.file.mimetype.startsWith("image/")
    ? `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`
    : undefined;
  const analysis = await analyzeDocument(originalName, fileType, extractedText, imageDataUrl);
  const matchingVendor = await findMatchingVendor(profile.id, analysis.fields, originalName);
  const fields: ExtractedFields = {
    ...analysis.fields,
    suggestedVendorId: matchingVendor?.id ?? analysis.fields.suggestedVendorId ?? null,
    suggestedVendorName: matchingVendor?.name ?? analysis.fields.suggestedVendorName ?? analysis.fields.vendorName ?? null,
  };
  const fileUrl = await storage.uploadObjectEntityFile(req.file.buffer, originalName, req.file.mimetype, {
    owner: profile.userId,
    visibility: "private",
  });

  const inserted = await db
    .insert(documents)
    .values({
      profileId: profile.id,
      userId: profile.userId,
      fileUrl,
      fileName: originalName,
      originalFileName: originalName,
      fileType,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedBy: req.userId!,
      linkedVendorId: matchingVendor?.id ?? null,
      summary: analysis.summary,
      extractedFields: fields,
      tags: [],
      folder: cleanFolderName(asText(req.body.folder, "General")),
      visibility: normalizeVisibility(req.body.visibility),
      extractedText,
    })
    .returning();

  res.status(201).json({ document: inserted[0] });
});

router.patch("/documents/:id", requireAuth, async (req, res) => {
  const role = await resolveCallerRole(req);
  if (!hasMinRole(role, "planner")) return res.status(403).json({ error: "Only owners, partners, and planners can edit documents." });
  const profile = await resolveProfile(req);
  if (!profile) return res.status(404).json({ error: "Profile not found" });
  const id = Number(req.params.id);
  const patch: Partial<typeof documents.$inferInsert> = { updatedAt: new Date() };
  if (typeof req.body.fileName === "string") patch.fileName = cleanFileName(req.body.fileName);
  if (typeof req.body.folder === "string") patch.folder = cleanFolderName(req.body.folder);
  if (Array.isArray(req.body.tags)) patch.tags = normalizeTags(req.body.tags);
  if (Array.isArray(req.body.visibility)) patch.visibility = normalizeVisibility(req.body.visibility);
  if (req.body.linkedVendorId === null) patch.linkedVendorId = null;
  if (typeof req.body.linkedVendorId === "number") {
    const vendorRows = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(and(eq(vendors.id, req.body.linkedVendorId), eq(vendors.profileId, profile.id)))
      .limit(1);
    if (!vendorRows[0]) return res.status(404).json({ error: "Vendor not found" });
    patch.linkedVendorId = req.body.linkedVendorId;
  }

  const updated = await db
    .update(documents)
    .set(patch)
    .where(and(eq(documents.id, id), eq(documents.profileId, profile.id)))
    .returning();
  if (!updated[0]) return res.status(404).json({ error: "Document not found" });
  res.json({ document: updated[0] });
});

router.post("/documents/:id/copy", requireAuth, async (req, res) => {
  const role = await resolveCallerRole(req);
  if (!hasMinRole(role, "planner")) return res.status(403).json({ error: "Only owners, partners, and planners can copy documents." });
  const profile = await resolveProfile(req);
  if (!profile) return res.status(404).json({ error: "Profile not found" });
  const id = Number(req.params.id);
  const rows = await db.select().from(documents).where(and(eq(documents.id, id), eq(documents.profileId, profile.id))).limit(1);
  const doc = rows[0];
  if (!doc) return res.status(404).json({ error: "Document not found" });

  const copied = await db
    .insert(documents)
    .values({
      profileId: profile.id,
      userId: profile.userId,
      fileUrl: doc.fileUrl,
      fileName: doc.fileName,
      originalFileName: doc.originalFileName,
      fileType: doc.fileType,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      uploadedBy: req.userId!,
      linkedVendorId: doc.linkedVendorId,
      summary: doc.summary,
      extractedFields: doc.extractedFields,
      tags: normalizeTags(req.body.tags ?? doc.tags),
      folder: cleanFolderName(asText(req.body.folder, doc.folder || "General")),
      visibility: normalizeVisibility(req.body.visibility ?? doc.visibility),
      extractedText: doc.extractedText,
    })
    .returning();

  res.status(201).json({ document: copied[0] });
});

router.delete("/documents/:id", requireAuth, async (req, res) => {
  const role = await resolveCallerRole(req);
  if (!hasMinRole(role, "planner")) return res.status(403).json({ error: "Only owners, partners, and planners can delete documents." });
  const profile = await resolveProfile(req);
  if (!profile) return res.status(404).json({ error: "Profile not found" });
  const id = Number(req.params.id);
  const deleted = await db
    .delete(documents)
    .where(and(eq(documents.id, id), eq(documents.profileId, profile.id)))
    .returning({ id: documents.id });
  if (!deleted[0]) return res.status(404).json({ error: "Document not found" });
  res.json({ ok: true });
});

router.post("/documents/:id/summary", requireAuth, async (req, res) => {
  const profile = await resolveProfile(req);
  if (!profile) return res.status(404).json({ error: "Profile not found" });
  const id = Number(req.params.id);
  const rows = await db.select().from(documents).where(and(eq(documents.id, id), eq(documents.profileId, profile.id))).limit(1);
  const doc = rows[0];
  if (!doc) return res.status(404).json({ error: "Document not found" });
  const analysis = await analyzeDocument(doc.fileName, doc.fileType, doc.extractedText ?? "");
  const updated = await db
    .update(documents)
    .set({ summary: analysis.summary, updatedAt: new Date() })
    .where(and(eq(documents.id, id), eq(documents.profileId, profile.id)))
    .returning();
  res.json({ document: updated[0] });
});

router.post("/documents/:id/extract", requireAuth, async (req, res) => {
  const profile = await resolveProfile(req);
  if (!profile) return res.status(404).json({ error: "Profile not found" });
  const id = Number(req.params.id);
  const rows = await db.select().from(documents).where(and(eq(documents.id, id), eq(documents.profileId, profile.id))).limit(1);
  const doc = rows[0];
  if (!doc) return res.status(404).json({ error: "Document not found" });
  const analysis = await analyzeDocument(doc.fileName, doc.fileType, doc.extractedText ?? "");
  const matchingVendor = await findMatchingVendor(profile.id, analysis.fields, doc.fileName);
  const fields: ExtractedFields = {
    ...analysis.fields,
    suggestedVendorId: matchingVendor?.id ?? analysis.fields.suggestedVendorId ?? null,
    suggestedVendorName: matchingVendor?.name ?? analysis.fields.suggestedVendorName ?? analysis.fields.vendorName ?? null,
  };
  const updated = await db
    .update(documents)
    .set({
      summary: analysis.summary,
      extractedFields: fields,
      linkedVendorId: doc.linkedVendorId ?? matchingVendor?.id ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(documents.id, id), eq(documents.profileId, profile.id)))
    .returning();
  res.json({ document: updated[0] });
});

router.post("/documents/:id/link-vendor", requireAuth, async (req, res) => {
  const role = await resolveCallerRole(req);
  if (!hasMinRole(role, "planner")) return res.status(403).json({ error: "Only owners, partners, and planners can link vendors." });
  const profile = await resolveProfile(req);
  if (!profile) return res.status(404).json({ error: "Profile not found" });
  const id = Number(req.params.id);
  const vendorId = Number(req.body.vendorId);
  const vendorRows = await db.select().from(vendors).where(and(eq(vendors.id, vendorId), eq(vendors.profileId, profile.id))).limit(1);
  if (!vendorRows[0]) return res.status(404).json({ error: "Vendor not found" });
  const updated = await db
    .update(documents)
    .set({ linkedVendorId: vendorId, updatedAt: new Date() })
    .where(and(eq(documents.id, id), eq(documents.profileId, profile.id)))
    .returning();
  if (!updated[0]) return res.status(404).json({ error: "Document not found" });
  res.json({ document: updated[0] });
});

router.post("/documents/:id/tasks", requireAuth, async (req, res) => {
  const role = await resolveCallerRole(req);
  if (!hasMinRole(role, "planner")) return res.status(403).json({ error: "Only owners, partners, and planners can create tasks." });
  const profile = await resolveProfile(req);
  if (!profile) return res.status(404).json({ error: "Profile not found" });
  const id = Number(req.params.id);
  const rows = await db.select().from(documents).where(and(eq(documents.id, id), eq(documents.profileId, profile.id))).limit(1);
  const doc = rows[0];
  if (!doc) return res.status(404).json({ error: "Document not found" });
  const fields = normalizeExtractedFields(doc.extractedFields);
  const tasks = fields.suggestedTasks?.filter((task) => asText(task.task || task.title)).slice(0, 12) ?? [];
  if (!tasks.length) return res.json({ tasks: [] });

  const taskValues = tasks.map((task) => ({
    profileId: profile.id,
    month: task.dueDate ? "Document deadlines" : "Document follow-up",
    task: asText(task.task || task.title, "Review document task"),
    description: asText(task.description, `Generated from ${doc.fileName}`),
    isCompleted: false,
  }));

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${profile.id}, ${id})`);
    const existingRows = await tx
      .select({ task: checklistItems.task })
      .from(checklistItems)
      .where(eq(checklistItems.profileId, profile.id));
    const existingKeys = new Set(existingRows.map((item) => normalizeChecklistTaskKey(item.task)));
    const insertValues = taskValues.filter((item) => {
      const key = normalizeChecklistTaskKey(item.task);
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    });

    if (!insertValues.length) {
      await tx.execute(sql`UPDATE documents SET updated_at = now() WHERE id = ${id}`);
      return { inserted: [], skipped: taskValues.length };
    }

    const inserted = await tx
      .insert(checklistItems)
      .values(insertValues)
      .returning();
    await tx.execute(sql`UPDATE documents SET updated_at = now() WHERE id = ${id}`);
    return { inserted, skipped: taskValues.length - inserted.length };
  });

  res.status(result.inserted.length ? 201 : 200).json({
    tasks: result.inserted,
    skipped: result.skipped,
    duplicate: result.inserted.length === 0,
  });
});

export default router;
