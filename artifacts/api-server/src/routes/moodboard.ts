import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, moodBoards } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { openai, getModel } from "@workspace/integrations-openai-ai-server";
import { ObjectStorageService } from "../lib/objectStorage";

const router = Router();
const storage = new ObjectStorageService();

type MoodBoardImage = {
  objectPath: string;
  order: number;
  name?: string;
  analysis?: {
    styleKeywords: string[];
    dominantColors: string[];
    decorThemes: string[];
    floralStyle?: string;
    venueVibe?: string;
  };
};

type ColorSwatch = { hex: string; name: string };

// ─── GET /mood-board ─────────────────────────────────────────────────────────
router.get("/mood-board", requireAuth, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const [board] = await db.select().from(moodBoards).where(eq(moodBoards.userId, userId));
    if (!board) {
      return res.json({
        images: [],
        colorPalette: [],
        styleTags: [],
        aiSummary: null,
        notes: null,
      });
    }
    res.json(board);
  } catch (err) {
    req.log.error(err, "mood-board GET");
    res.status(500).json({ error: "Failed to load mood board" });
  }
});

// ─── PUT /mood-board ──────────────────────────────────────────────────────────
router.put("/mood-board", requireAuth, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { images, colorPalette, styleTags, aiSummary, notes } = req.body as {
      images?: MoodBoardImage[];
      colorPalette?: ColorSwatch[];
      styleTags?: string[];
      aiSummary?: string;
      notes?: string;
    };

    const [existing] = await db.select({ id: moodBoards.id }).from(moodBoards).where(eq(moodBoards.userId, userId));

    if (existing) {
      const [updated] = await db.update(moodBoards)
        .set({
          ...(images !== undefined && { images }),
          ...(colorPalette !== undefined && { colorPalette }),
          ...(styleTags !== undefined && { styleTags }),
          ...(aiSummary !== undefined && { aiSummary }),
          ...(notes !== undefined && { notes }),
          updatedAt: new Date(),
        })
        .where(eq(moodBoards.userId, userId))
        .returning();
      return res.json(updated);
    }

    const [created] = await db.insert(moodBoards).values({
      userId,
      images: images ?? [],
      colorPalette: colorPalette ?? [],
      styleTags: styleTags ?? [],
      aiSummary: aiSummary ?? null,
      notes: notes ?? null,
    }).returning();
    res.json(created);
  } catch (err) {
    req.log.error(err, "mood-board PUT");
    res.status(500).json({ error: "Failed to save mood board" });
  }
});

// ─── POST /mood-board/analyze-image ─────────────────────────────────────────
// Analyzes a single image with GPT-4.1-mini vision and returns structured data
router.post("/mood-board/analyze-image", requireAuth, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { objectPath } = req.body as { objectPath: string };
    if (!objectPath) return res.status(400).json({ error: "objectPath is required" });

    // Download image from storage
    const file = await storage.getObjectEntityFile(objectPath);
    const [content] = await file.download();
    const base64 = content.toString("base64");
    const [metadata] = await file.getMetadata();
    const contentType = (metadata.contentType as string) || "image/jpeg";

    const response = await openai.chat.completions.create({
      model: getModel(),
      messages: [{
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${contentType};base64,${base64}`, detail: "low" },
          },
          {
            type: "text",
            text: `Analyze this wedding inspiration image and return a JSON object with exactly these fields:
- styleKeywords: array of 3-6 style words (e.g. "romantic", "rustic", "modern", "glam", "boho", "minimalist", "vintage", "garden", "coastal", "industrial", "ethereal", "whimsical")
- dominantColors: array of 4-6 hex color codes (e.g. "#f5e6d3") extracted from the image
- decorThemes: array of 2-4 decor theme strings (e.g. "candlelit", "floral arches", "greenery walls", "geometric shapes")
- floralStyle: single string describing florals, or null if no florals visible
- venueVibe: single string describing the venue/space vibe, or null if unclear

Return ONLY valid JSON, no markdown or explanation.`,
          },
        ],
      }],
      max_completion_tokens: 400,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    let analysis: MoodBoardImage["analysis"];
    try {
      analysis = JSON.parse(raw) as MoodBoardImage["analysis"];
    } catch {
      analysis = { styleKeywords: [], dominantColors: [], decorThemes: [] };
    }

    res.json({ analysis });
  } catch (err) {
    req.log.error(err, "mood-board analyze-image");
    res.status(500).json({ error: "Failed to analyze image" });
  }
});

// ─── POST /mood-board/generate-summary ───────────────────────────────────────
router.post("/mood-board/generate-summary", requireAuth, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { styleTags, images, colorPalette } = req.body as {
      styleTags: string[];
      images: MoodBoardImage[];
      colorPalette: ColorSwatch[];
    };

    const allKeywords = [
      ...styleTags,
      ...images.flatMap(img => img.analysis?.styleKeywords ?? []),
    ];
    const allThemes = images.flatMap(img => img.analysis?.decorThemes ?? []);
    const allFloralStyles = images.map(img => img.analysis?.floralStyle).filter(Boolean);
    const allVenueVibes = images.map(img => img.analysis?.venueVibe).filter(Boolean);
    const colors = colorPalette.map(c => c.hex);

    if (allKeywords.length === 0 && images.length === 0) {
      return res.json({ summary: "Add some images to your mood board to generate your style summary." });
    }

    const prompt = `Based on a couple's wedding mood board, write a 1-2 sentence style summary that captures their aesthetic in a warm, personal way.

Style keywords: ${[...new Set(allKeywords)].slice(0, 10).join(", ") || "none yet"}
Decor themes: ${[...new Set(allThemes)].slice(0, 6).join(", ") || "none yet"}
Floral styles: ${[...new Set(allFloralStyles)].slice(0, 3).join(", ") || "not specified"}
Venue vibes: ${[...new Set(allVenueVibes)].slice(0, 3).join(", ") || "not specified"}
Color palette: ${colors.slice(0, 6).join(", ") || "not specified"}

Write in second person ("Your wedding style is..."). Be specific, evocative, and positive. Under 50 words.`;

    const response = await openai.chat.completions.create({
      model: getModel(),
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 150,
    });

    const summary = response.choices[0]?.message?.content?.trim() ?? "";
    res.json({ summary });
  } catch (err) {
    req.log.error(err, "mood-board generate-summary");
    res.status(500).json({ error: "Failed to generate summary" });
  }
});

export default router;
