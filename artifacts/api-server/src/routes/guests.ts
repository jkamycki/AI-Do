import { Router } from "express";
import { db, guests, weddingProfiles } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

async function getProfileId(userId: string): Promise<number | null> {
  const profiles = await db
    .select()
    .from(weddingProfiles)
    .where(eq(weddingProfiles.userId, userId))
    .limit(1);
  return profiles.length > 0 ? profiles[0].id : null;
}

router.get("/guests", requireAuth, async (req, res) => {
  try {
    const profileId = await getProfileId(req.userId!);
    if (!profileId) {
      return res.json({ guests: [], summary: { total: 0, attending: 0, declined: 0, pending: 0, plusOnes: 0 } });
    }

    const rows = await db
      .select()
      .from(guests)
      .where(eq(guests.profileId, profileId))
      .orderBy(guests.createdAt);

    const summary = {
      total: rows.length,
      attending: rows.filter(g => g.rsvpStatus === "attending").length,
      declined: rows.filter(g => g.rsvpStatus === "declined").length,
      pending: rows.filter(g => g.rsvpStatus === "pending").length,
      plusOnes: rows.filter(g => g.plusOne).length,
    };

    res.json({ guests: rows, summary });
  } catch (err) {
    req.log.error(err, "Failed to get guests");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/guests", requireAuth, async (req, res) => {
  try {
    const profileId = await getProfileId(req.userId!);
    if (!profileId) {
      return res.status(400).json({ error: "No wedding profile found. Create a profile first." });
    }

    const { name, email, rsvpStatus, mealChoice, plusOne, plusOneName, tableAssignment, notes } = req.body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "Guest name is required" });
    }

    const [created] = await db
      .insert(guests)
      .values({
        profileId,
        name: name.trim(),
        email: email || null,
        rsvpStatus: rsvpStatus || "pending",
        mealChoice: mealChoice || null,
        plusOne: !!plusOne,
        plusOneName: plusOneName || null,
        tableAssignment: tableAssignment || null,
        notes: notes || null,
      })
      .returning();

    res.status(201).json(created);
  } catch (err) {
    req.log.error(err, "Failed to add guest");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/guests/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid guest ID" });

    const profileId = await getProfileId(req.userId!);
    if (!profileId) return res.status(400).json({ error: "No wedding profile found." });

    const { name, email, rsvpStatus, mealChoice, plusOne, plusOneName, tableAssignment, notes } = req.body;

    const updateData: Partial<typeof guests.$inferInsert> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email || null;
    if (rsvpStatus !== undefined) updateData.rsvpStatus = rsvpStatus;
    if (mealChoice !== undefined) updateData.mealChoice = mealChoice || null;
    if (plusOne !== undefined) updateData.plusOne = !!plusOne;
    if (plusOneName !== undefined) updateData.plusOneName = plusOneName || null;
    if (tableAssignment !== undefined) updateData.tableAssignment = tableAssignment || null;
    if (notes !== undefined) updateData.notes = notes || null;

    const [updated] = await db
      .update(guests)
      .set(updateData)
      .where(and(eq(guests.id, id), eq(guests.profileId, profileId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Guest not found" });
    res.json(updated);
  } catch (err) {
    req.log.error(err, "Failed to update guest");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/guests/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid guest ID" });

    const profileId = await getProfileId(req.userId!);
    if (!profileId) return res.status(400).json({ error: "No wedding profile found." });

    await db
      .delete(guests)
      .where(and(eq(guests.id, id), eq(guests.profileId, profileId)));

    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "Failed to delete guest");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
