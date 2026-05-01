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
  for (const table of tables) {
    for (const guestName of table.guests) {
      if (!guestName?.trim()) continue;
      await db
        .update(guestRecords)
        .set({ tableAssignment: `Table ${table.tableNumber}` })
        .where(and(
          eq(guestRecords.profileId, profileId),
          eq(guestRecords.name, guestName),
        ));
    }
  }
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
1. Never seat people with AVOID relationships at the same table
2. Try to seat PREFER NEAR pairs at the same table
3. Group family members and friend groups together
4. Keep plus-ones with their partners
5. Consider placing potential conflict groups at opposite sides of the room (note table order matters)

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
      // Was 2000. JSON output is ~tableCount × 80 tok + insights/warnings.
      // Even a 20-table chart fits in 1500 tok; bigger weddings will too.
      max_tokens: 1500,
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

    if (resolvedProfileId && Array.isArray(tables) && tables.length > 0) {
      await syncTableAssignments(resolvedProfileId, tables).catch(() => {});
    }

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
    const userId = await resolveScopeUserId(req);
    const rows = await db
      .select()
      .from(seatingCharts)
      .where(eq(seatingCharts.userId, userId))
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
    const userId = await resolveScopeUserId(req);
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
      .where(and(eq(seatingCharts.id, parseInt(String(req.params["id"] ?? "0"), 10)), eq(seatingCharts.userId, userId)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Seating chart not found" });
      return;
    }

    const putProfileId = updated.profileId ?? (await resolveProfile(req))?.id ?? null;
    if (putProfileId && Array.isArray(tables) && tables.length > 0) {
      await syncTableAssignments(putProfileId, tables).catch(() => {});
    }

    res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
  } catch {
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
    const userId = await resolveScopeUserId(req);
    await db
      .delete(seatingCharts)
      .where(and(
        eq(seatingCharts.id, parseInt(String(req.params["id"] ?? "0"), 10)),
        eq(seatingCharts.userId, userId),
      ));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
