import { Router } from "express";
import { db } from "@workspace/db";
import { checklistItems, weddingProfiles } from "@workspace/db";
import { eq, asc, and } from "drizzle-orm";
import { openai, getModel } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../../middlewares/requireAuth";
import { trackEvent } from "../../lib/trackEvent";
import { logActivity, resolveProfile, resolveCallerRole, hasMinRole } from "../../lib/workspaceAccess";

const router = Router();

function buildFallbackChecklist(input: {
  weddingDate: string;
  weddingVibe: string;
  guestCount: number;
  monthsUntil: number;
  planningFocus?: string;
}): Array<{ month: string; task: string; description: string }> {
  const focus = (input.planningFocus ?? "").trim();
  const lower = focus.toLowerCase();
  const items = [
    { minMonth: 12, month: "12+ Months Before", task: "Set planning priorities", description: `Confirm budget, guest count, and ${input.weddingVibe || "wedding"} style.` },
    { minMonth: 9, month: "9-12 Months Before", task: "Book priority vendors", description: "Secure venue, photo, music, catering, and planning support." },
    { minMonth: 6, month: "6-9 Months Before", task: "Design guest experience", description: "Plan travel, website, save-the-dates, and accommodations." },
    { minMonth: 3, month: "3-6 Months Before", task: "Finalize design details", description: "Confirm florals, rentals, attire, stationery, and decor." },
    { minMonth: 1, month: "1-3 Months Before", task: "Lock final vendor details", description: "Confirm contracts, balances, timelines, and contact lists." },
    { minMonth: 0, month: "1 Month Before", task: "Finalize RSVP count", description: "Follow up with guests and send final count to vendors." },
    { minMonth: 0, month: "1 Week Before", task: "Confirm wedding week logistics", description: "Pack essentials, confirm arrival times, and delegate tasks." },
    { minMonth: 0, month: "Wedding Day", task: "Enjoy the celebration", description: "Use your timeline and let delegated helpers handle details." },
  ].filter(item => item.minMonth === 0 || input.monthsUntil >= item.minMonth);

  const add = (task: string, description: string) => items.push({ minMonth: 0, month: "Planning Focus", task, description });
  if (focus) add("Review your custom planning prompt", focus.slice(0, 120));
  if (/\b(budget|cost|cheap|save|afford)\b/i.test(lower)) add("Audit budget priorities", "Flag negotiable costs and payment deadlines.");
  if (/\b(guest|rsvp|invite|seating)\b/i.test(lower)) add("Clean up guest workflow", "Review invites, RSVPs, meals, plus-ones, and seating needs.");
  if (/\b(vendor|contract|payment)\b/i.test(lower)) add("Confirm vendor obligations", "Review contracts, balances, arrival windows, and deliverables.");
  if (/\b(destination|hotel|travel|shuttle)\b/i.test(lower)) add("Coordinate travel details", "Confirm hotel blocks, transportation, maps, and guest instructions.");
  if (/\b(diy|decor|floral|flowers|design)\b/i.test(lower)) add("Build decor production list", "Assign decor owners, supplies, setup timing, and cleanup.");

  return items.map(({ month, task, description }) => ({ month, task, description }));
}

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
        resolveNote: item.resolveNote ?? undefined,
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
    const { weddingDate, weddingVibe, guestCount, planningFocus } = req.body as {
      weddingDate?: string;
      weddingVibe?: string;
      guestCount?: number;
      planningFocus?: string;
    };

    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(404).json({ error: "Profile not found. Please complete your wedding profile first." });
      return;
    }

    const today = new Date();
    const effectiveWeddingDate = weddingDate ?? profile.weddingDate ?? "";
    const effectiveWeddingVibe = weddingVibe ?? profile.weddingVibe ?? "";
    const effectiveGuestCount = guestCount ?? profile.guestCount ?? 0;
    const wedding = new Date(effectiveWeddingDate);
    const monthsUntil = Math.max(1, Math.ceil((wedding.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30)));

    const lang = profile.preferredLanguage && profile.preferredLanguage !== "English" ? profile.preferredLanguage : null;
    const langInstruction = lang ? `\n\nIMPORTANT: Write all task names, descriptions, and time period labels in ${lang}.` : "";

    const prompt = `Build a wedding checklist for a ${effectiveWeddingVibe} wedding with ${effectiveGuestCount} guests, ${monthsUntil} months out (date: ${effectiveWeddingDate}).${planningFocus ? `\n\nCouple's checklist focus / prompt: ${planningFocus}` : ""}

Group tasks by time period: "12+ Months Before", "9-12 Months Before", "6-9 Months Before", "3-6 Months Before", "1-3 Months Before", "1 Month Before", "1 Week Before", "Day Before", "Wedding Day". Skip periods that don't apply given the ${monthsUntil}-month timeline.

Return ONLY a JSON array (no markdown):
[{"month":"12+ Months Before","task":"Book the venue","description":"Short reason why this matters"}]

3-5 tasks per relevant period. Be specific and actionable. Match the ${effectiveWeddingVibe} style. Keep each description <=12 words.
If a checklist focus / prompt is provided, make the generated tasks visibly reflect it with concrete tasks instead of a generic checklist.${langInstruction}`;

    const completion = await openai.chat.completions.create({
      model: getModel(),
      // Smaller output target improves latency without losing usefulness.
      max_completion_tokens: 1400,
      messages: [{ role: "user", content: prompt }],
    }, { signal: AbortSignal.timeout(45_000) });

    const content = completion.choices[0]?.message?.content ?? "[]";
    let tasks: Array<{ month: string; task: string; description: string }>;

    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      tasks = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      tasks = [];
    }
    if (!Array.isArray(tasks) || tasks.length === 0) {
      tasks = buildFallbackChecklist({
        weddingDate: effectiveWeddingDate,
        weddingVibe: effectiveWeddingVibe,
        guestCount: effectiveGuestCount,
        monthsUntil,
        planningFocus,
      });
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
        resolveNote: item.resolveNote ?? undefined,
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error(err, "Failed to generate checklist");
    try {
      const profile = await resolveProfile(req);
      if (profile) {
        const { weddingDate, weddingVibe, guestCount, planningFocus } = req.body as {
          weddingDate?: string;
          weddingVibe?: string;
          guestCount?: number;
          planningFocus?: string;
        };
        const effectiveWeddingDate = weddingDate ?? profile.weddingDate ?? "";
        const wedding = new Date(effectiveWeddingDate);
        const monthsUntil = Number.isFinite(wedding.getTime())
          ? Math.max(1, Math.ceil((wedding.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30)))
          : 6;
        const tasks = buildFallbackChecklist({
          weddingDate: effectiveWeddingDate,
          weddingVibe: weddingVibe ?? profile.weddingVibe ?? "",
          guestCount: guestCount ?? profile.guestCount ?? 0,
          monthsUntil,
          planningFocus,
        });

        await db.delete(checklistItems).where(eq(checklistItems.profileId, profile.id));
        if (tasks.length > 0) await db.insert(checklistItems).values(tasks.map(t => ({ profileId: profile.id, ...t })));
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
            resolveNote: item.resolveNote ?? undefined,
          })),
          generatedAt: new Date().toISOString(),
        });
        return;
      }
    } catch (fallbackErr) {
      req.log.error(fallbackErr, "Checklist fallback generation failed");
    }
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
    const { isCompleted, task, description, month, resolveNote } = req.body;

    const updates: Record<string, unknown> = {};
    if (isCompleted !== undefined) {
      updates.isCompleted = isCompleted;
      updates.completedAt = isCompleted ? new Date() : null;
      if (!isCompleted && resolveNote === undefined) {
        updates.resolveNote = null;
      }
    }
    if (task !== undefined) updates.task = task;
    if (description !== undefined) updates.description = description;
    if (month !== undefined) updates.month = month;
    if (resolveNote !== undefined) {
      const trimmed = typeof resolveNote === "string" ? resolveNote.trim() : "";
      updates.resolveNote = trimmed.length > 0 ? trimmed : null;
    }

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
      resolveNote: item.resolveNote ?? undefined,
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
      resolveNote: item.resolveNote ?? undefined,
    });
  } catch (err) {
    req.log.error(err, "Failed to add checklist item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/checklist/reset", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);
    if (!profile) return res.status(404).json({ error: "Profile not found" });

    await db.delete(checklistItems).where(eq(checklistItems.profileId, profile.id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "Failed to reset checklist");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
