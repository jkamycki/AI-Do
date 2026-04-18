import { Router } from "express";
import { db } from "@workspace/db";
import { checklistItems, weddingProfiles } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../../middlewares/requireAuth";
import { trackEvent } from "../../lib/trackEvent";
import { logActivity } from "../../lib/workspaceAccess";

const router = Router();

async function getProfileByUserId(userId: string) {
  const profiles = await db
    .select()
    .from(weddingProfiles)
    .where(eq(weddingProfiles.userId, userId))
    .limit(1);
  return profiles[0] ?? null;
}

router.get("/checklist", requireAuth, async (req, res) => {
  try {
    const profile = await getProfileByUserId(req.userId);

    const items = profile
      ? await db
          .select()
          .from(checklistItems)
          .where(eq(checklistItems.profileId, profile.id))
          .orderBy(asc(checklistItems.id))
      : [];

    res.json({
      items: items.map(item => ({
        id: item.id,
        month: item.month,
        task: item.task,
        description: item.description,
        isCompleted: item.isCompleted,
        completedAt: item.completedAt?.toISOString() ?? undefined,
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error(err, "Failed to get checklist");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/checklist", requireAuth, async (req, res) => {
  try {
    const { weddingDate, weddingVibe, guestCount } = req.body;

    const profile = await getProfileByUserId(req.userId);
    if (!profile) {
      res.status(404).json({ error: "Profile not found. Please complete your wedding profile first." });
      return;
    }

    const today = new Date();
    const wedding = new Date(weddingDate);
    const monthsUntil = Math.max(1, Math.ceil((wedding.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30)));

    const prompt = `Create a comprehensive month-by-month wedding planning checklist for a ${weddingVibe} wedding with ${guestCount} guests, happening in approximately ${monthsUntil} months from today (date: ${weddingDate}).

Generate tasks organized by time period (e.g., "12+ Months Before", "9-12 Months Before", "6-9 Months Before", "3-6 Months Before", "1-3 Months Before", "1 Month Before", "1 Week Before", "Day Before", "Wedding Day"). Only include time periods that are relevant given the ${monthsUntil} months available.

Return ONLY a valid JSON array (no markdown, no explanation) with this structure:
[
  {
    "month": "12+ Months Before",
    "task": "Book the venue",
    "description": "Research and secure your ceremony and reception venue early as popular venues book up fast"
  }
]

Include 5-8 tasks per relevant time period. Be specific and actionable. Make tasks appropriate for the style: ${weddingVibe}.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content ?? "[]";
    let tasks: Array<{ month: string; task: string; description: string }>;

    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      tasks = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      tasks = [];
    }

    await db.delete(checklistItems).where(eq(checklistItems.profileId, profile.id));

    const insertData = tasks.map(t => ({
      profileId: profile.id,
      month: t.month,
      task: t.task,
      description: t.description,
    }));

    if (insertData.length > 0) {
      await db.insert(checklistItems).values(insertData);
    }

    const items = await db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.profileId, profile.id))
      .orderBy(asc(checklistItems.id));

    res.json({
      items: items.map(item => ({
        id: item.id,
        month: item.month,
        task: item.task,
        description: item.description,
        isCompleted: item.isCompleted,
        completedAt: item.completedAt?.toISOString() ?? undefined,
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error(err, "Failed to generate checklist");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/checklist/items/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { isCompleted } = req.body;

    const [item] = await db
      .update(checklistItems)
      .set({
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
      })
      .where(eq(checklistItems.id, id))
      .returning();

    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    if (isCompleted) {
      trackEvent(req.userId!, "checklist_item_completed", { taskId: item.id, task: item.task });
    }
    logActivity(item.profileId, req.userId!, `${isCompleted ? "Completed" : "Unchecked"}: ${item.task}`, "checklist", { taskId: item.id });
    res.json({
      id: item.id,
      month: item.month,
      task: item.task,
      description: item.description,
      isCompleted: item.isCompleted,
      completedAt: item.completedAt?.toISOString() ?? undefined,
    });
  } catch (err) {
    req.log.error(err, "Failed to toggle checklist item");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
