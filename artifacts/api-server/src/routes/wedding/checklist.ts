import { Router } from "express";
import { db } from "@workspace/db";
import { checklistItems, weddingProfiles } from "@workspace/db";
import { eq, asc, and } from "drizzle-orm";
import { openai, getModel } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../../middlewares/requireAuth";
import { trackEvent } from "../../lib/trackEvent";
import { logActivity, resolveProfile, resolveCallerRole, hasMinRole } from "../../lib/workspaceAccess";
import { getRequestLanguage } from "../../lib/language";
import { applyChecklistDeadlines, normalizeChecklistDueDate } from "../../lib/checklistDeadlines";

const router = Router();

type ChecklistTask = { month: string; task: string; description: string; dueDate?: string | null };
type ChecklistTranslationItem = ChecklistTask & { id?: number };

function serializeChecklistItem(item: typeof checklistItems.$inferSelect) {
  return {
    id: item.id,
    month: item.month,
    task: item.task,
    description: item.description,
    dueDate: item.dueDate ?? null,
    isCompleted: item.isCompleted,
    completedAt: item.completedAt?.toISOString() ?? undefined,
    resolveNote: item.resolveNote ?? undefined,
  };
}

function normalizeChecklistTranslationItems(value: unknown): ChecklistTranslationItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return {
      id: typeof row.id === "number" ? row.id : Number.isFinite(Number(row.id)) ? Number(row.id) : undefined,
      month: String(row.month ?? ""),
      task: String(row.task ?? ""),
      description: String(row.description ?? ""),
      dueDate: normalizeChecklistDueDate(row.dueDate),
    };
  }).filter(item => item.month.trim() || item.task.trim() || item.description.trim());
}

function normalizeTaskText(value: string): string {
  return value.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function extractChecklistAdditions(focus?: string): ChecklistTask[] {
  const text = (focus ?? "").trim();
  if (!text) return [];
  const additions: ChecklistTask[] = [];
  const re = /\b(?:add|include|make sure to|make sure we|create)\s+(.{4,90}?)(?:[.!?]|$)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const task = match[1]?.trim().replace(/\s+/g, " ");
    if (!task) continue;
    additions.push({
      month: "Planning Focus",
      task: task.replace(/\b\w/g, (letter) => letter.toUpperCase()).slice(0, 90),
      description: "Added directly from your checklist prompt.",
    });
  }
  return additions;
}

function extractChecklistRemovals(focus?: string): string[] {
  const text = (focus ?? "").trim();
  if (!text) return [];
  const removals: string[] = [];
  const re = /\b(?:remove|delete|skip|do\s*not include|don't include|dont include|no)\s+(.{4,70}?)(?:[.!?]|$)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const label = match[1]?.trim();
    if (label) removals.push(normalizeTaskText(label));
  }
  return removals;
}

function refineChecklistTasks(tasks: ChecklistTask[], focus?: string): ChecklistTask[] {
  const removals = extractChecklistRemovals(focus);
  const additions = extractChecklistAdditions(focus);
  const allTasks = [...tasks, ...additions].filter((task) => {
    if (!task.task?.trim()) return false;
    const haystack = normalizeTaskText(`${task.task} ${task.description}`);
    return !removals.some(removal => removal && haystack.includes(removal));
  });
  const seen = new Set<string>();
  return allTasks.filter((task) => {
    const key = normalizeTaskText(task.task);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildFallbackChecklist(input: {
  weddingDate: string;
  weddingVibe: string;
  guestCount: number;
  monthsUntil: number;
  planningFocus?: string;
}): ChecklistTask[] {
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

  return refineChecklistTasks(items.map(({ month, task, description }) => ({ month, task, description })), input.planningFocus);
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
      items: items.map(serializeChecklistItem),
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

    const requestLanguage = getRequestLanguage(req, profile.preferredLanguage);
    const lang = requestLanguage !== "English" ? requestLanguage : null;
    const langInstruction = lang ? `\n\nIMPORTANT: Write all task names, descriptions, and time period labels in ${lang}.` : "";

    const prompt = `Build a wedding checklist for a ${effectiveWeddingVibe} wedding with ${effectiveGuestCount} guests, ${monthsUntil} months out (date: ${effectiveWeddingDate}).${planningFocus ? `\n\nCouple's checklist focus / prompt: ${planningFocus}` : ""}

Group tasks by time period: "12+ Months Before", "9-12 Months Before", "6-9 Months Before", "3-6 Months Before", "1-3 Months Before", "1 Month Before", "1 Week Before", "Day Before", "Wedding Day". Skip periods that don't apply given the ${monthsUntil}-month timeline.

Return ONLY a JSON array (no markdown):
[{"month":"12+ Months Before","task":"Book the venue","description":"Short reason why this matters","dueDate":"YYYY-MM-DD"}]

3-5 tasks per relevant period. Be specific and actionable. Match the ${effectiveWeddingVibe} style. Keep each description <=12 words.
Every task must include a dueDate in YYYY-MM-DD format. Every dueDate must be before the wedding date (${effectiveWeddingDate}), never on or after it.
If a checklist focus / prompt is provided, make the generated tasks visibly reflect it with concrete tasks instead of a generic checklist.${langInstruction}`;

    const completion = await openai.chat.completions.create({
      model: getModel(),
      // Smaller output target improves latency without losing usefulness.
      max_completion_tokens: 1400,
      messages: [{ role: "user", content: prompt }],
    }, { signal: AbortSignal.timeout(45_000) });

    const content = completion.choices[0]?.message?.content ?? "[]";
    let tasks: ChecklistTask[];

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
    tasks = applyChecklistDeadlines(refineChecklistTasks(tasks, planningFocus), effectiveWeddingDate);

    const existingItems = await db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.profileId, profile.id))
      .orderBy(asc(checklistItems.id));

    const hasFocus = typeof planningFocus === "string" && planningFocus.trim().length > 0;
    const removals = extractChecklistRemovals(planningFocus);
    if (hasFocus && removals.length > 0) {
      for (const item of existingItems) {
        if (item.isCompleted) continue;
        const haystack = normalizeTaskText(`${item.task} ${item.description}`);
        if (removals.some(removal => removal && haystack.includes(removal))) {
          await db.delete(checklistItems).where(and(eq(checklistItems.id, item.id), eq(checklistItems.profileId, profile.id)));
        }
      }
    } else if (!hasFocus) {
      await db.delete(checklistItems).where(and(eq(checklistItems.profileId, profile.id), eq(checklistItems.isCompleted, false)));
    }

    const latestExistingItems = await db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.profileId, profile.id))
      .orderBy(asc(checklistItems.id));
    const existingTaskKeys = new Set(latestExistingItems.map(item => normalizeTaskText(item.task)));

    const insertData = tasks.map(t => ({
      profileId: profile.id,
      month: t.month,
      task: t.task,
      description: t.description,
      dueDate: t.dueDate ?? null,
    })).filter(item => !existingTaskKeys.has(normalizeTaskText(item.task)));

    if (insertData.length > 0) {
      await db.insert(checklistItems).values(insertData);
    }

    const items = await db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.profileId, profile.id))
      .orderBy(asc(checklistItems.id));

    res.json({
      items: items.map(serializeChecklistItem),
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

        const existingItems = await db.select().from(checklistItems).where(eq(checklistItems.profileId, profile.id));
        const existingTaskKeys = new Set(existingItems.map(item => normalizeTaskText(item.task)));
        const insertData = applyChecklistDeadlines(refineChecklistTasks(tasks, planningFocus), effectiveWeddingDate)
          .map(t => ({ profileId: profile.id, ...t }))
          .filter(item => !existingTaskKeys.has(normalizeTaskText(item.task)));
        if (insertData.length > 0) await db.insert(checklistItems).values(insertData);
        const items = await db
          .select()
          .from(checklistItems)
          .where(eq(checklistItems.profileId, profile.id))
          .orderBy(asc(checklistItems.id));
        res.json({
          items: items.map(serializeChecklistItem),
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

router.post("/checklist/translate", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    const language = getRequestLanguage(req, profile.preferredLanguage);
    const items = normalizeChecklistTranslationItems(req.body?.items);
    if (language === "English" || items.length === 0) {
      res.json({ language, items });
      return;
    }

    const prompt = `Translate these wedding checklist items into ${language}.

CRITICAL RULES:
- Return ONLY valid JSON in this shape: {"items":[...]}.
- Preserve the array length and order.
- Preserve every id exactly.
- Translate ONLY the human-readable month, task, and description values.
- Do not add, remove, merge, or regenerate tasks.
- If a field is empty, keep it empty.

Checklist JSON:
${JSON.stringify(items)}`;

    const completion = await openai.chat.completions.create({
      model: getModel(),
      response_format: { type: "json_object" },
      max_completion_tokens: 2400,
      messages: [{ role: "user", content: prompt }],
    }, { signal: AbortSignal.timeout(30_000) });

    const content = completion.choices[0]?.message?.content ?? "{}";
    let translated: ChecklistTranslationItem[] | null = null;
    try {
      const parsed = JSON.parse(content);
      const parsedItems = normalizeChecklistTranslationItems(Array.isArray(parsed) ? parsed : parsed?.items);
      if (parsedItems.length === items.length) {
        translated = parsedItems.map((item, index) => ({
          ...items[index],
          month: item.month,
          task: item.task,
          description: item.description,
        }));
      }
    } catch (parseErr) {
      req.log.warn({ err: String(parseErr), preview: content.slice(0, 500) }, "Checklist translation JSON parse failed");
    }
    if (!translated) {
      res.status(502).json({ error: "Checklist translation failed. Please try again." });
      return;
    }

    res.json({ language, items: translated });
  } catch (err) {
    req.log.error(err, "Failed to translate checklist");
    const e = err as { status?: number; message?: string };
    if (e?.status === 429) {
      res.status(429).json({ error: "Aria is at her daily AI limit. Please try again after midnight UTC." });
      return;
    }
    res.status(500).json({ error: e?.message ? `Checklist translation failed: ${e.message}` : "Internal server error" });
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
    const { isCompleted, task, description, month, resolveNote, dueDate } = req.body;

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
    if (dueDate !== undefined) {
      const nextDueDate = normalizeChecklistDueDate(dueDate);
      if (dueDate && !nextDueDate) {
        res.status(400).json({ error: "dueDate must be YYYY-MM-DD" });
        return;
      }
      updates.dueDate = nextDueDate;
      updates.reminderSentAt = null;
    }
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
    res.json(serializeChecklistItem(item));
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

    const { task, description, month, dueDate } = req.body;
    if (!task?.trim() || !month?.trim()) return res.status(400).json({ error: "task and month are required" });
    const nextDueDate = normalizeChecklistDueDate(dueDate);
    if (dueDate && !nextDueDate) return res.status(400).json({ error: "dueDate must be YYYY-MM-DD" });

    const [item] = await db
      .insert(checklistItems)
      .values({
        profileId: profile.id,
        task: task.trim(),
        description: description?.trim() ?? "",
        month: month.trim(),
        dueDate: nextDueDate,
      })
      .returning();

    res.json(serializeChecklistItem(item));
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
