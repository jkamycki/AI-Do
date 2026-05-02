import { Router } from "express";
import { db } from "@workspace/db";
import { checklistItems, weddingProfiles } from "@workspace/db";
import { eq, asc, and } from "drizzle-orm";
import { openai, getModel } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../../middlewares/requireAuth";
import { trackEvent } from "../../lib/trackEvent";
import { logActivity, resolveProfile, resolveCallerRole, hasMinRole } from "../../lib/workspaceAccess";

const router = Router();
router.get("/checklist", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);

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
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const { weddingDate, weddingVibe, guestCount } = req.body;

    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(404).json({ error: "Profile not found. Please complete your wedding profile first." });
      return;
    }

    const today = new Date();
    const wedding = new Date(weddingDate);
    const monthsUntil = Math.max(1, Math.ceil((wedding.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30)));

    const lang = profile.preferredLanguage && profile.preferredLanguage !== "English" ? profile.preferredLanguage : null;
    const langInstruction = lang ? `\n\nIMPORTANT: Write all task names, descriptions, and time period labels in ${lang}.` : "";

    const prompt = `Build a wedding checklist for a ${weddingVibe} wedding with ${guestCount} guests, ${monthsUntil} months out (date: ${weddingDate}).

Group tasks by time period: "12+ Months Before", "9-12 Months Before", "6-9 Months Before", "3-6 Months Before", "1-3 Months Before", "1 Month Before", "1 Week Before", "Day Before", "Wedding Day". Skip periods that don't apply given the ${monthsUntil}-month timeline.

Return ONLY a JSON array (no markdown):
[{"month":"12+ Months Before","task":"Book the venue","description":"Short reason why this matters"}]

4-6 tasks per relevant period. Be specific and actionable. Match the ${weddingVibe} style. Keep each description ≤15 words.${langInstruction}`;

    const completion = await openai.chat.completions.create({
      model: getModel(),
      // 4096 tokens handles extensive 18-month checklists with all time periods.
      max_completion_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }, { signal: AbortSignal.timeout(90_000) });

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
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const { isCompleted, task, description, month } = req.body;

    const updates: Record<string, unknown> = {};
    if (isCompleted !== undefined) {
      updates.isCompleted = isCompleted;
      updates.completedAt = isCompleted ? new Date() : null;
    }
    if (task !== undefined) updates.task = task;
    if (description !== undefined) updates.description = description;
    if (month !== undefined) updates.month = month;

    const [item] = await db
      .update(checklistItems)
      .set(updates)
      .where(and(eq(checklistItems.id, id), eq(checklistItems.profileId, profile.id)))
      .returning();

    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    if (isCompleted) {
      trackEvent(req.userId!, "checklist_item_completed", { taskId: item.id, task: item.task });
    }
    logActivity(item.profileId, req.userId!, `${isCompleted !== undefined ? (isCompleted ? "Completed" : "Unchecked") : "Edited"}: ${item.task}`, "checklist", { taskId: item.id });
    res.json({
      id: item.id,
      month: item.month,
      task: item.task,
      description: item.description,
      isCompleted: item.isCompleted,
      completedAt: item.completedAt?.toISOString() ?? undefined,
    });
  } catch (err) {
    req.log.error(err, "Failed to update checklist item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/checklist/items/:id", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const [deleted] = await db
      .delete(checklistItems)
      .where(and(eq(checklistItems.id, id), eq(checklistItems.profileId, profile.id)))
      .returning();
    if (!deleted) return res.status(404).json({ error: "Item not found" });
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "Failed to delete checklist item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/checklist/items", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);
    if (!profile) return res.status(404).json({ error: "Profile not found" });

    const { task, description, month } = req.body;
    if (!task?.trim() || !month?.trim()) return res.status(400).json({ error: "task and month are required" });

    const [item] = await db
      .insert(checklistItems)
      .values({ profileId: profile.id, task: task.trim(), description: description?.trim() ?? "", month: month.trim() })
      .returning();

    res.json({
      id: item.id,
      month: item.month,
      task: item.task,
      description: item.description,
      isCompleted: item.isCompleted,
      completedAt: item.completedAt?.toISOString() ?? undefined,
    });
  } catch (err) {
    req.log.error(err, "Failed to add checklist item");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
