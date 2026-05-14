import { Router } from "express";
import { db, seatingCharts, guests as guestRecords } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { resolveScopeUserId, resolveCallerRole, hasMinRole, resolveProfile } from "../lib/workspaceAccess";
import { openai, getModel } from "@workspace/integrations-openai-ai-server";

const router = Router();

async function syncTableAssignments(
  profileId: number,
  tables: { tableNumber: number; tableName: string; guests: string[] }[],
) {
  // Build a lookup so AI-generated names with case/whitespace drift still
  // match the actual guest record. Same name occurring on multiple guests
  // (rare, but possible) gets every matching id so all are updated.
  const allGuests = await db
    .select({ id: guestRecords.id, name: guestRecords.name })
    .from(guestRecords)
    .where(eq(guestRecords.profileId, profileId));
  const idsByName = new Map<string, number[]>();
  for (const g of allGuests) {
    const key = (g.name ?? "").trim().toLowerCase();
    if (!key) continue;
    const arr = idsByName.get(key) ?? [];
    arr.push(g.id);
    idsByName.set(key, arr);
  }

  // Clear stale assignments first so guests no longer at any table reset.
  await db
    .update(guestRecords)
    .set({ tableAssignment: null })
    .where(eq(guestRecords.profileId, profileId));

  for (const table of tables) {
    const label = `Table ${table.tableNumber}`;
    for (const guestName of table.guests ?? []) {
      const key = (guestName ?? "").trim().toLowerCase();
      if (!key) continue;
      const ids = idsByName.get(key);
      if (!ids?.length) continue;
      for (const id of ids) {
        await db
          .update(guestRecords)
          .set({ tableAssignment: label })
          .where(eq(guestRecords.id, id));
      }
    }
  }
}

// Strip AI hallucinations (e.g. group labels showing up as guest names) and
// drop duplicates across tables. Names not matching any input guest are
// removed; matched names get replaced with the canonical input spelling.
function cleanGeneratedTables(
  tables: Table[] | undefined,
  inputGuests: Guest[],
): Table[] {
  const canonicalByKey = new Map<string, string>();
  for (const g of inputGuests ?? []) {
    const key = (g.name ?? "").trim().toLowerCase();
    if (key) canonicalByKey.set(key, g.name.trim());
  }
  const seen = new Set<string>();
  return (tables ?? []).map(t => ({
    ...t,
    guests: (t.guests ?? []).reduce<string[]>((acc, name) => {
      const key = (name ?? "").trim().toLowerCase();
      const canonical = canonicalByKey.get(key);
      if (canonical && !seen.has(key)) {
        seen.add(key);
        acc.push(canonical);
      }
      return acc;
    }, []),
  }));
}

interface Guest {
  id: string;
  name: string;
  group: string;
  plusOne?: boolean;
  notes?: string;
  avoidIds?: string[];
  preferIds?: string[];
}

interface Table {
  tableNumber: number;
  tableName: string;
  guests: string[];
  theme?: string;
}

// AI sometimes ignores the seatsPerTable cap and stuffs >cap guests at a
// single table. Trim each table down to the cap, collect the overflow, and
// redistribute to tables with room (creating new tables if every existing
// one is full). Runs before backfill so the cap is honored before missing
// guests are placed.
function enforceTableCapacity(
  tables: Table[],
  tableCount: number,
  seatsPerTable: number,
): Table[] {
  const result = tables.map(t => ({ ...t, guests: [...(t.guests ?? [])] }));
  const overflow: string[] = [];
  for (const t of result) {
    while (t.guests.length > seatsPerTable) {
      overflow.push(t.guests.pop() as string);
    }
  }
  if (overflow.length === 0) return result;

  while (result.length < tableCount) {
    const num = result.length + 1;
    result.push({ tableNumber: num, tableName: `Table ${num}`, guests: [] });
  }
  for (const name of overflow) {
    let placed = false;
    for (const t of result) {
      if (t.guests.length < seatsPerTable) {
        t.guests.push(name);
        placed = true;
        break;
      }
    }
    if (!placed) {
      const num = result.length + 1;
      result.push({ tableNumber: num, tableName: `Table ${num}`, guests: [name] });
    }
  }
  return result;
}

// If the AI dropped or duplicated guests (cleanGeneratedTables removes
// hallucinations and duplicates, leaving a hole), seat the missing ones in
// existing tables with capacity. New tables are created if every existing
// one is at the seatsPerTable cap. This guarantees every input guest gets
// a seat — preferred over silently leaving guests off the chart.
function backfillUnseatedGuests(
  tables: Table[],
  inputGuests: Guest[],
  tableCount: number,
  seatsPerTable: number,
): Table[] {
  const seatedKeys = new Set<string>();
  for (const t of tables) {
    for (const name of t.guests ?? []) {
      const k = (name ?? "").trim().toLowerCase();
      if (k) seatedKeys.add(k);
    }
  }

  const missing: string[] = [];
  for (const g of inputGuests ?? []) {
    const k = (g.name ?? "").trim().toLowerCase();
    if (k && !seatedKeys.has(k)) missing.push(g.name.trim());
  }

  if (missing.length === 0) return tables;

  const result = tables.map(t => ({ ...t, guests: [...(t.guests ?? [])] }));

  // Ensure we have at least the requested number of tables before placing
  // overflow — empty tables are preferable to creating excess ones.
  while (result.length < tableCount) {
    const num = result.length + 1;
    result.push({ tableNumber: num, tableName: `Table ${num}`, guests: [] });
  }

  for (const name of missing) {
    let placed = false;
    for (const t of result) {
      if (t.guests.length < seatsPerTable) {
        t.guests.push(name);
        placed = true;
        break;
      }
    }
    if (!placed) {
      const num = result.length + 1;
      result.push({ tableNumber: num, tableName: `Table ${num}`, guests: [name] });
    }
  }

  return result;
}

router.post("/seating/generate", requireAuth, async (req, res) => {
  try {
    const { guests, tableCount, seatsPerTable, additionalNotes, language } = req.body as {
      guests: Guest[];
      tableCount: number;
      seatsPerTable: number;
      additionalNotes?: string;
      language?: string;
    };

    const langInstruction = language && language !== "en"
      ? `IMPORTANT: You must write ALL text in your response (table names, themes, insights, warnings) in the language with code "${language}". Do not use English for any of these fields.`
      : "";

    if (!guests?.length) {
      return res.status(400).json({ error: "Please add at least one guest." });
    }

    const guestList = guests.map(g => {
      const avoidNames = (g.avoidIds ?? []).map(id => guests.find(x => x.id === id)?.name ?? id);
      const preferNames = (g.preferIds ?? []).map(id => guests.find(x => x.id === id)?.name ?? id);
      return `- ${g.name} (Group: ${g.group}${g.plusOne ? ", +1" : ""}${avoidNames.length ? `, AVOID: ${avoidNames.join(", ")}` : ""}${preferNames.length ? `, PREFER NEAR: ${preferNames.join(", ")}` : ""}${g.notes ? `, Notes: ${g.notes}` : ""})`;
    }).join("\n");

    const prompt = `You are an expert wedding planner creating a harmonious seating chart. Your goal is to minimize conflict and maximize happiness.
${langInstruction}

GUESTS (${guests.length} total):
${guestList}

SETUP: ${tableCount} tables, ${seatsPerTable} seats per table max
${additionalNotes ? `ADDITIONAL NOTES: ${additionalNotes}` : ""}

Rules:
1. EVERY guest from the list above MUST appear in exactly one table — do not omit anyone, do not duplicate anyone. The sum of guests across all tables must equal ${guests.length}.
2. Never seat people with AVOID relationships at the same table
3. Try to seat PREFER NEAR pairs at the same table
4. Group family members and friend groups together
5. Keep plus-ones with their partners
6. Consider placing potential conflict groups at opposite sides of the room (note table order matters)

Return ONLY valid JSON:
{
  "tables": [
    {
      "tableNumber": 1,
      "tableName": "Table 1",
      "guests": ["Guest Name", ...],
      "theme": "brief note about why these guests are together"
    }
  ],
  "insights": ["string - observations about the seating arrangement"],
  "warnings": ["string - any unavoidable conflicts or issues"],
  "totalSeated": number
}

Use only the exact guest names from the list. Only create tables that have guests. Distribute guests evenly.`;

    const completion = await openai.chat.completions.create({
      model: getModel(),
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      // Roughly: each guest entry costs ~6 tokens, plus a few hundred for
      // table chrome / insights / warnings. 1500 was tight for >40 guests
      // and could truncate the JSON; allow more headroom for big weddings.
      max_tokens: Math.max(2000, guests.length * 25 + 800),
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let result: { tables: Table[]; insights: string[]; warnings: string[]; totalSeated: number } = {
      tables: [],
      insights: [],
      warnings: [],
      totalSeated: 0,
    };

    try {
      result = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: "AI returned invalid response. Please try again." });
    }

    result.tables = cleanGeneratedTables(result.tables, guests);
    const overflowed = result.tables.some(t => (t.guests?.length ?? 0) > seatsPerTable);
    result.tables = enforceTableCapacity(result.tables, tableCount, seatsPerTable);
    const seatedAfterCap = result.tables.reduce((n, t) => n + (t.guests?.length ?? 0), 0);
    result.tables = backfillUnseatedGuests(result.tables, guests, tableCount, seatsPerTable);
    const totalAfterBackfill = result.tables.reduce((n, t) => n + (t.guests?.length ?? 0), 0);
    const warnings = [...(result.warnings ?? [])];
    if (overflowed) {
      warnings.push(`Some tables exceeded the ${seatsPerTable}-seat cap; overflow guests were moved to other tables.`);
    }
    if (totalAfterBackfill > seatedAfterCap) {
      const added = totalAfterBackfill - seatedAfterCap;
      warnings.push(`Backfilled ${added} guest${added === 1 ? "" : "s"} the AI didn't place — review their tables before saving.`);
    }
    result.warnings = warnings;
    result.totalSeated = totalAfterBackfill;

    res.json(result);
  } catch (err) {
    req.log.error(err, "Seating generation failed");
    res.status(500).json({ error: "Failed to generate seating chart. Please try again." });
  }
});

router.post("/seating/charts", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const userId = await resolveScopeUserId(req);
    const { name, guests, tables, tableCount, seatsPerTable } = req.body;
    const profile = await resolveProfile(req);
    const resolvedProfileId = profile?.id ?? null;

    const [saved] = await db
      .insert(seatingCharts)
      .values({
        userId,
        profileId: resolvedProfileId,
        name: name ?? "My Seating Chart",
        guests: guests ?? [],
        tables: tables ?? null,
        tableCount: tableCount ?? 8,
        seatsPerTable: seatsPerTable ?? 8,
      })
      .returning();

    // Saving alone no longer applies to the guest list — only an explicit
    // load (POST /:id/apply) updates guest table assignments. This way the
    // user can keep multiple drafts saved without disturbing whichever one
    // is currently "live" on their guest list.
    res.json({ ...saved, createdAt: saved.createdAt.toISOString(), updatedAt: saved.updatedAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/seating/charts", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);
    const profileId = profile?.id ?? null;
    const rows = await db
      .select()
      .from(seatingCharts)
      .where(profileId ? eq(seatingCharts.profileId, profileId) : eq(seatingCharts.userId, await resolveScopeUserId(req)))
      .orderBy(desc(seatingCharts.createdAt));
    res.json(rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })));
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/seating/charts/:id", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);
    const profileId = profile?.id ?? null;
    const { name, guests, tables, tableCount, seatsPerTable } = req.body;
    const [updated] = await db
      .update(seatingCharts)
      .set({
        name,
        guests,
        tables,
        tableCount,
        seatsPerTable,
        updatedAt: new Date(),
      })
      .where(and(
        eq(seatingCharts.id, parseInt(String(req.params["id"] ?? "0"), 10)),
        profileId ? eq(seatingCharts.profileId, profileId) : eq(seatingCharts.userId, await resolveScopeUserId(req)),
      ))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Seating chart not found" });
      return;
    }

    res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Apply a saved chart's tables to the guest list — used when the user
// loads a saved chart in the UI. Only this endpoint mutates guest
// tableAssignment now (other than the delete endpoints, which clear it).
router.post("/seating/charts/:id/apply", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);
    const profileId = profile?.id ?? null;
    const chartId = parseInt(String(req.params["id"] ?? "0"), 10);
    const [chart] = await db
      .select()
      .from(seatingCharts)
      .where(and(
        eq(seatingCharts.id, chartId),
        profileId ? eq(seatingCharts.profileId, profileId) : eq(seatingCharts.userId, await resolveScopeUserId(req)),
      ))
      .limit(1);
    if (!chart) {
      res.status(404).json({ error: "Seating chart not found" });
      return;
    }
    const chartProfileId = chart.profileId ?? profileId;
    const tables = (chart.tables ?? []) as { tableNumber: number; tableName: string; guests: string[] }[];
    if (chartProfileId && Array.isArray(tables) && tables.length > 0) {
      await syncTableAssignments(chartProfileId, tables);
    }
    res.json({ success: true, applied: tables.length });
  } catch (err) {
    req.log.error(err, "Failed to apply seating chart");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/seating/charts/:id", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);
    const profileId = profile?.id ?? null;
    const chartId = parseInt(String(req.params["id"] ?? "0"), 10);
    const [deleted] = await db
      .delete(seatingCharts)
      .where(and(
        eq(seatingCharts.id, chartId),
        profileId ? eq(seatingCharts.profileId, profileId) : eq(seatingCharts.userId, await resolveScopeUserId(req)),
      ))
      .returning({ profileId: seatingCharts.profileId });
    const deletedProfileId = deleted?.profileId ?? profileId;
    if (deletedProfileId) {
      await db
        .update(guestRecords)
        .set({ tableAssignment: null })
        .where(eq(guestRecords.profileId, deletedProfileId));
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Wipe every saved seating chart for the workspace AND clear tableAssignment
// on every guest in the profile. Used by the page's "Reset" button so the
// dashboard tile flips back to "No seating chart yet" and the guest-list
// table-assignment column resets in lockstep.
router.delete("/seating/charts", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);
    if (profile) {
      await db.delete(seatingCharts).where(eq(seatingCharts.profileId, profile.id));
    } else {
      await db.delete(seatingCharts).where(eq(seatingCharts.userId, await resolveScopeUserId(req)));
    }
    if (profile) {
      await db
        .update(guestRecords)
        .set({ tableAssignment: null })
        .where(eq(guestRecords.profileId, profile.id));
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
