import { Router } from "express";
import { db } from "@workspace/db";
import { timelines, weddingProfiles } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.get("/timeline", async (req, res) => {
  try {
    const rows = await db.select().from(timelines).orderBy(desc(timelines.id)).limit(1);
    if (!rows.length) {
      res.status(404).json({ error: "No timeline found" });
      return;
    }
    const t = rows[0];
    res.json({
      id: t.id,
      events: t.events,
      generatedAt: t.generatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err, "Failed to get timeline");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/timeline", async (req, res) => {
  try {
    const { profileId } = req.body;

    const profiles = await db.select().from(weddingProfiles).where(eq(weddingProfiles.id, profileId)).limit(1);
    if (!profiles.length) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    const profile = profiles[0];

    const prompt = `Create a detailed wedding day timeline for the following wedding:
- Couple: ${profile.partner1Name} & ${profile.partner2Name}
- Date: ${profile.weddingDate}
- Ceremony Time: ${profile.ceremonyTime}
- Reception Time: ${profile.receptionTime}
- Venue: ${profile.venue}
- Location: ${profile.location}
- Guest Count: ${profile.guestCount}
- Wedding Style: ${profile.weddingVibe}

Generate a complete hour-by-hour schedule from morning preparation through the end of the reception. Include getting ready, first look (if applicable), ceremony, cocktail hour, dinner, dancing, and departure.

Return ONLY a valid JSON array (no markdown, no explanation) with this exact structure:
[
  {
    "time": "8:00 AM",
    "title": "Event Title",
    "description": "Detailed description of what happens",
    "category": "preparation|ceremony|cocktail|reception|dancing|other"
  }
]`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content ?? "[]";
    let events: Array<{ time: string; title: string; description: string; category: string }>;
    
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      events = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      events = [];
    }

    const [created] = await db
      .insert(timelines)
      .values({ profileId, events })
      .returning();

    res.json({
      id: created.id,
      events: created.events,
      generatedAt: created.generatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err, "Failed to generate timeline");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
