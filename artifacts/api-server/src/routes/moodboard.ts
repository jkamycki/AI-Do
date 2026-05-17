import { Router } from "express";
import { db, moodBoards } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { openai, getModel, getVisionModel } from "@workspace/integrations-openai-ai-server";
import { ObjectStorageService } from "../lib/objectStorage";
import { ObjectPermission } from "../lib/objectAcl";
import { hasMinRole, resolveCallerRole, resolveProfile, resolveScopeUserId } from "../lib/workspaceAccess";

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
    floralStyle?: string | null;
    venueVibe?: string | null;
  };
};

type ColorSwatch = { hex: string; name: string };

function fallbackImageAnalysis(fileNameOrPath: string): NonNullable<MoodBoardImage["analysis"]> {
  const lower = fileNameOrPath.toLowerCase();
  const keywords = new Set<string>(["romantic", "modern", "soft"]);
  const decorThemes = new Set<string>(["personal inspiration", "wedding details"]);

  if (/\b(garden|floral|flower|botanic|rose|bouquet)\b/.test(lower)) {
    keywords.add("garden");
    decorThemes.add("floral accents");
  }
  if (/\b(beach|coastal|ocean|shore)\b/.test(lower)) {
    keywords.add("coastal");
    decorThemes.add("airy textures");
  }
  if (/\b(rustic|barn|wood|farm)\b/.test(lower)) {
    keywords.add("rustic");
    decorThemes.add("natural textures");
  }
  if (/\b(glam|gold|luxury|blacktie)\b/.test(lower)) {
    keywords.add("glam");
    decorThemes.add("polished accents");
  }

  return {
    styleKeywords: [...keywords].slice(0, 6),
    dominantColors: ["#FFF7F2", "#F2E2C6", "#E6A6B7", "#B16C8E", "#8D294D"],
    decorThemes: [...decorThemes].slice(0, 4),
    floralStyle: keywords.has("garden") ? "soft romantic florals" : null,
    venueVibe: keywords.has("coastal") ? "light and airy" : "warm romantic celebration",
  };
}

async function analyzeMoodBoardImage(contentType: string, base64: string) {
  const messages = [{
    role: "user" as const,
    content: [
      {
        type: "image_url" as const,
        image_url: { url: `data:${contentType};base64,${base64}` },
      },
      {
        type: "text" as const,
        text: `Analyze this wedding inspiration image and return a JSON object with exactly these fields:
- styleKeywords: array of 3-6 style words (e.g. "romantic", "rustic", "modern", "glam", "boho", "minimalist", "vintage", "garden", "coastal", "industrial", "ethereal", "whimsical")
- dominantColors: array of 4-6 hex color codes (e.g. "#f5e6d3") extracted from the image
- decorThemes: array of 2-4 decor theme strings (e.g. "candlelit", "floral arches", "greenery walls", "geometric shapes")
- floralStyle: single string describing florals, or null if no florals visible
- venueVibe: single string describing the venue/space vibe, or null if unclear

Return ONLY valid JSON, no markdown or explanation.`,
      },
    ],
  }];

  const request = {
    model: getVisionModel(),
    messages,
  };

  const variants = [
    { ...request, max_completion_tokens: 400, response_format: { type: "json_object" as const } },
    { ...request, max_completion_tokens: 400 },
    { ...request, max_tokens: 400 },
  ];

  let lastError: unknown = null;
  for (const variant of variants) {
    try {
      return await openai.chat.completions.create(variant);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Vision analysis failed");
}

async function resolveMoodBoardScope(req: Parameters<typeof resolveProfile>[0]) {
  const callerRole = await resolveCallerRole(req);
  if (!hasMinRole(callerRole, "planner")) return null;
  const profile = await resolveProfile(req);
  if (!profile) return null;
  return {
    userId: await resolveScopeUserId(req),
    profileId: profile.id,
  };
}

// ─── GET /mood-board ─────────────────────────────────────────────────────────
router.get("/mood-board", requireAuth, async (req, res) => {
  try {
    const scope = await resolveMoodBoardScope(req);
    if (!scope) return res.status(404).json({ error: "No wedding profile found" });

    const [board] = await db
      .select()
      .from(moodBoards)
      .where(and(eq(moodBoards.userId, scope.userId), eq(moodBoards.profileId, scope.profileId)));
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
    const scope = await resolveMoodBoardScope(req);
    if (!scope) return res.status(404).json({ error: "No wedding profile found" });

    const { images, colorPalette, styleTags, aiSummary, notes } = req.body as {
      images?: MoodBoardImage[];
      colorPalette?: ColorSwatch[];
      styleTags?: string[];
      aiSummary?: string;
      notes?: string;
    };

    const [existing] = await db
      .select({ id: moodBoards.id })
      .from(moodBoards)
      .where(and(eq(moodBoards.userId, scope.userId), eq(moodBoards.profileId, scope.profileId)));

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
        .where(and(eq(moodBoards.userId, scope.userId), eq(moodBoards.profileId, scope.profileId)))
        .returning();
      return res.json(updated);
    }

    const [created] = await db.insert(moodBoards).values({
      userId: scope.userId,
      profileId: scope.profileId,
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
    if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) return res.status(403).json({ error: "Insufficient permissions." });

    const { objectPath } = req.body as { objectPath: string };
    if (!objectPath) return res.status(400).json({ error: "objectPath is required" });

    // Download image from storage
    const file = await storage.getObjectEntityFile(objectPath);
    const canAccess = await storage.canAccessObjectEntity({
      userId: req.userId,
      objectFile: file,
      requestedPermission: ObjectPermission.READ,
    });
    if (!canAccess) return res.status(403).json({ error: "Access denied" });
    const [content] = await file.download();
    const base64 = content.toString("base64");
    const [metadata] = await file.getMetadata();
    const contentType = (metadata.contentType as string) || "image/jpeg";

    let raw = "{}";
    try {
      const response = await analyzeMoodBoardImage(contentType, base64);
      raw = response.choices[0]?.message?.content ?? "{}";
    } catch (err) {
      req.log.warn({ err, contentType, objectPath }, "mood-board vision provider failed; using fallback image analysis");
      return res.json({ analysis: fallbackImageAnalysis(objectPath) });
    }

    let analysis: MoodBoardImage["analysis"];
    try {
      // Some models still wrap JSON in markdown fences or add prose; extract the
      // first {...} block defensively before parsing.
      const match = raw.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(match ? match[0] : raw) as MoodBoardImage["analysis"];
    } catch {
      analysis = fallbackImageAnalysis(objectPath);
    }

    analysis = {
      ...fallbackImageAnalysis(objectPath),
      ...analysis,
      styleKeywords: analysis?.styleKeywords?.length ? analysis.styleKeywords : fallbackImageAnalysis(objectPath).styleKeywords,
      dominantColors: analysis?.dominantColors?.length ? analysis.dominantColors : fallbackImageAnalysis(objectPath).dominantColors,
      decorThemes: analysis?.decorThemes?.length ? analysis.decorThemes : fallbackImageAnalysis(objectPath).decorThemes,
    };

    res.json({ analysis });
  } catch (err) {
    req.log.error(err, "mood-board analyze-image");
    res.status(500).json({ error: "Failed to analyze image" });
  }
});

// ─── POST /mood-board/generate-summary ───────────────────────────────────────
router.post("/mood-board/generate-summary", requireAuth, async (req, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) return res.status(403).json({ error: "Insufficient permissions." });

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

    const profile = await resolveProfile(req);
    const lang = profile?.preferredLanguage && profile.preferredLanguage !== "English" ? profile.preferredLanguage : null;
    const langInstruction = lang ? `\n\nIMPORTANT: Write the summary entirely in ${lang}.` : "";

    const prompt = `Based on a couple's wedding mood board, write a 1-2 sentence style summary that captures their aesthetic in a warm, personal way.

Style keywords: ${[...new Set(allKeywords)].slice(0, 10).join(", ") || "none yet"}
Decor themes: ${[...new Set(allThemes)].slice(0, 6).join(", ") || "none yet"}
Floral styles: ${[...new Set(allFloralStyles)].slice(0, 3).join(", ") || "not specified"}
Venue vibes: ${[...new Set(allVenueVibes)].slice(0, 3).join(", ") || "not specified"}
Color palette: ${colors.slice(0, 6).join(", ") || "not specified"}

Write in second person ("Your wedding style is..."). Be specific, evocative, and positive. Under 50 words.${langInstruction}`;

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
