import { Router } from "express";
import { db, seatingCharts } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { resolveScopeUserId } from "../lib/workspaceAccess";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

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
    const { guests, tableCount, seatsPerTable, additionalNotes } = req.body as {
      guests: Guest[];
      tableCount: number;
      seatsPerTable: number;
      additionalNotes?: string;
    };

    if (!guests?.length) {
      return res.status(400).json({ error: "Please add at least one guest." });
    }

    const guestList = guests.map(g => {
      const avoidNames = (g.avoidIds ?? []).map(id => guests.find(x => x.id === id)?.name ?? id);
      const preferNames = (g.preferIds ?? []).map(id => guests.find(x => x.id === id)?.name ?? id);
      return `- ${g.name} (Group: ${g.group}${g.plusOne ? ", +1" : ""}${avoidNames.length ? `, AVOID: ${avoidNames.join(", ")}` : ""}${preferNames.length ? `, PREFER NEAR: ${preferNames.join(", ")}` : ""}${g.notes ? `, Notes: ${g.notes}` : ""})`;
    }).join("\n");

    const prompt = `You are an expert wedding planner creating a harmonious seating chart. Your goal is to minimize conflict and maximize happiness.

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
6. Give each table a creative name relevant to the couple's day (e.g., "Champagne Table", "Garden Table", "Vintage Table")

Return ONLY valid JSON:
{
  "tables": [
    {
      "tableNumber": 1,
      "tableName": "string",
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
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 2000,
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
    const userId = await resolveScopeUserId(req);
    const { name, guests, tables, tableCount, seatsPerTable, profileId } = req.body;
    const [saved] = await db
      .insert(seatingCharts)
      .values({
        userId,
        profileId: profileId ?? null,
        name: name ?? "My Seating Chart",
        guests: guests ?? [],
        tables: tables ?? null,
        tableCount: tableCount ?? 8,
        seatsPerTable: seatsPerTable ?? 8,
      })
      .returning();
    res.json({ ...saved, createdAt: saved.createdAt.toISOString(), updatedAt: saved.updatedAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/seating/charts", requireAuth, async (req, res) => {
  try {
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
      .where(eq(seatingCharts.id, parseInt(req.params["id"] ?? "0")))
      .returning();
    res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/seating/charts/:id", requireAuth, async (req, res) => {
  try {
    await db
      .delete(seatingCharts)
      .where(eq(seatingCharts.id, parseInt(req.params["id"] ?? "0")));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
