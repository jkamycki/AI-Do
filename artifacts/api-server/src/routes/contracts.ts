import { Router } from "express";
import multer from "multer";
import { db, vendorContracts } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { openai } from "@workspace/integrations-openai-ai-server";

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

async function extractText(buffer: Buffer, mimetype: string): Promise<string> {
  if (mimetype === "text/plain" || mimetype === "text/html") {
    return buffer.toString("utf8").slice(0, 40000);
  }
  if (mimetype === "application/pdf") {
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const data = await pdfParse(buffer);
      return data.text.slice(0, 40000);
    } catch {
      return buffer.toString("utf8").slice(0, 40000);
    }
  }
  return buffer.toString("utf8").slice(0, 40000);
}

router.post("/contracts/upload", requireAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }
    const { buffer, originalname, mimetype, size } = req.file;

    const extractedText = await extractText(buffer, mimetype);

    if (!extractedText.trim()) {
      return res.status(422).json({ error: "Could not extract readable text from this file." });
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

    const [saved] = await db
      .insert(vendorContracts)
      .values({
        userId: req.userId!,
        fileName: originalname,
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

router.get("/contracts", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select({
        id: vendorContracts.id,
        fileName: vendorContracts.fileName,
        fileSize: vendorContracts.fileSize,
        analysis: vendorContracts.analysis,
        createdAt: vendorContracts.createdAt,
      })
      .from(vendorContracts)
      .where(eq(vendorContracts.userId, req.userId!))
      .orderBy(desc(vendorContracts.createdAt))
      .limit(50);

    res.json(rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/contracts/:id", requireAuth, async (req, res) => {
  try {
    await db
      .delete(vendorContracts)
      .where(eq(vendorContracts.id, parseInt(req.params["id"] ?? "0")));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
