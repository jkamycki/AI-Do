import { Router } from "express";
import { db } from "@workspace/db";
import { timelines, weddingProfiles } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { openai, getModel } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../../middlewares/requireAuth";
import { trackEvent } from "../../lib/trackEvent";
import { logActivity, resolveProfile, resolveCallerRole, hasMinRole } from "../../lib/workspaceAccess";

const router = Router();
router.get("/timeline", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(404).json({ error: "No timeline found" });
      return;
    }

    const rows = await db
      .select()
      .from(timelines)
      .where(eq(timelines.profileId, profile.id))
      .orderBy(desc(timelines.id))
      .limit(1);

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

router.post("/timeline", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(404).json({ error: "Profile not found. Please complete your wedding profile first." });
      return;
    }

    const { dayVision } = req.body as { dayVision?: string };

    const lang = profile.preferredLanguage && profile.preferredLanguage !== "English" ? profile.preferredLanguage : null;
    const langInstruction = lang ? `\n\nIMPORTANT: Write all event titles and descriptions in ${lang}.` : "";

    const prompt = `Create a detailed wedding day timeline for the following wedding:
- Couple: ${profile.partner1Name} & ${profile.partner2Name}
- Date: ${profile.weddingDate}
- Ceremony Time: ${profile.ceremonyTime}
- Reception Time: ${profile.receptionTime}
- Venue: ${profile.venue}
- Location: ${profile.location}
- Guest Count: ${profile.guestCount}
- Wedding Style: ${profile.weddingVibe}${dayVision ? `\n- Couple's Vision for the Day: ${dayVision}` : ""}

Generate a complete wedding day schedule from early morning preparation through the end of the reception. Include:
- Bridal party / couple getting ready (preparation)
- Vendor arrival blocks (photographer, florist, DJ, caterer, etc.) — category: vendors
- First look or couple portraits — category: photos
- Travel between locations — category: travel
- Ceremony — category: ceremony
- Cocktail hour — category: cocktail
- Reception dinner — category: reception
- First dance, toasts, cake cutting, dancing — category: dancing
- Departure

Include realistic buffer time between events. Use specific locations where applicable.

Return ONLY a valid JSON array (no markdown, no explanation) with this exact structure:
[
  {
    "id": "block-1",
    "startTime": "08:00",
    "endTime": "09:30",
    "title": "Event Title",
    "description": "Detailed description of what happens during this block",
    "category": "preparation|ceremony|cocktail|reception|photos|vendors|travel|dancing|other",
    "location": "Room or venue area name",
    "notes": ""
  }
]

Use 24-hour HH:MM format for startTime and endTime. Use sequential IDs like block-1, block-2, etc.${langInstruction}`;

    const completion = await openai.chat.completions.create({
      model: getModel(),
      // Was 4000. Most weddings need 15-22 events × ~90 tok = ~1800 tok.
      // 2500 covers extra-long days while halving the per-call TPD spend.
      max_completion_tokens: 2500,
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

    // Replace any existing timelines for this profile so regenerate doesn't pile up duplicate rows.
    // Wrap delete+insert in a transaction so concurrent regenerate clicks can't interleave
    // (last-deleter-wins) and produce missing/inconsistent timeline state.
    const created = await db.transaction(async (tx) => {
      await tx.delete(timelines).where(eq(timelines.profileId, profile.id));
      const [row] = await tx
        .insert(timelines)
        .values({ profileId: profile.id, events })
        .returning();
      return row;
    });

    trackEvent(req.userId!, "timeline_generated", { eventCount: events.length });
    logActivity(profile.id, req.userId!, `Generated day-of timeline (${events.length} events)`, "timeline", { eventCount: events.length });
    res.json({
      id: created.id,
      events: created.events,
      generatedAt: created.generatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err, "Failed to generate timeline");
    // Surface AI provider rate limits / capacity errors so the client can show
    // a meaningful message instead of a generic "generation failed" toast.
    const e = err as { status?: number; code?: string; message?: string };
    const status = typeof e?.status === "number" ? e.status : 500;
    if (status === 429) {
      res.status(429).json({
        error: "Aria is at her daily AI limit. Please try again after midnight UTC.",
      });
      return;
    }
    if (status === 503 || status === 502) {
      res.status(503).json({
        error: "Aria is temporarily unavailable. Please try again in a moment.",
      });
      return;
    }
    res.status(500).json({
      error: e?.message ? `Timeline generation failed: ${e.message}` : "Internal server error",
    });
  }
});

router.patch("/timeline/:id", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    const { events } = req.body;
    if (!Array.isArray(events)) return res.status(400).json({ error: "events must be an array" });

    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    const [updated] = await db
      .update(timelines)
      .set({ events })
      .where(and(eq(timelines.id, id), eq(timelines.profileId, profile.id)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Timeline not found" });

    logActivity(profile.id, req.userId!, `Edited day-of timeline`, "timeline", { eventCount: events.length });

    res.json({
      id: updated.id,
      events: updated.events,
      generatedAt: updated.generatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err, "Failed to update timeline");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
