import { Router } from "express";
import { db, guests, weddingProfiles } from "@workspace/db";
import { eq, and, or, ilike, not } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { resolveProfile, resolveCallerRole, hasMinRole } from "../lib/workspaceAccess";

const router = Router();

// Kept for backwards-compat; new code paths use resolveProfile(req)
async function getProfileId(userId: string): Promise<number | null> {
  const profiles = await db
    .select()
    .from(weddingProfiles)
    .where(eq(weddingProfiles.userId, userId))
    .limit(1);
  return profiles.length > 0 ? profiles[0].id : null;
}
void getProfileId;

router.get("/guests", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);
    const profileId = profile?.id ?? null;
    if (!profileId) {
      return res.json({ guests: [], summary: { total: 0, attending: 0, declined: 0, pending: 0, plusOnes: 0 } });
    }

    const rows = await db
      .select()
      .from(guests)
      .where(eq(guests.profileId, profileId))
      .orderBy(guests.createdAt);

    const plusOneCount = rows.filter(g => g.plusOne).length;
    const summary = {
      total: rows.length + plusOneCount,
      attending: rows.filter(g => g.rsvpStatus === "attending").length + rows.filter(g => g.rsvpStatus === "attending" && g.plusOne).length,
      declined: rows.filter(g => g.rsvpStatus === "declined").length + rows.filter(g => g.rsvpStatus === "declined" && g.plusOne).length,
      pending: rows.filter(g => g.rsvpStatus === "pending").length + rows.filter(g => g.rsvpStatus === "pending" && g.plusOne).length,
      plusOnes: plusOneCount,
    };

    res.json({ guests: rows, summary });
    return;
  } catch (err) {
    req.log.error(err, "Failed to get guests");
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

router.post("/guests", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);
    const profileId = profile?.id ?? null;
    if (!profileId) {
      return res.status(400).json({ error: "No wedding profile found. Create a profile first." });
    }

    const { name, email, invitationStatus, rsvpStatus, mealChoice, dietaryNotes, guestGroup, plusOne, plusOneName, tableAssignment, notes, phone, address, aptUnit, guestCity, guestState, guestZip, guestCountry } = req.body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "Guest name is required" });
    }

    const trimmedName = name.trim();
    const cleanEmail = email?.trim() || null;

    if (req.query.force !== "true") {
      const dupConditions = [ilike(guests.name, trimmedName)];
      if (cleanEmail) dupConditions.push(ilike(guests.email, cleanEmail));

      const existing = await db
        .select({ id: guests.id })
        .from(guests)
        .where(and(eq(guests.profileId, profileId), or(...dupConditions)));

      if (existing.length > 0) {
        return res.status(409).json({
          error: "A guest with this name or email already exists.",
          duplicateIds: existing.map(g => g.id),
        });
      }
    }

    const [created] = await db
      .insert(guests)
      .values({
        profileId,
        name: trimmedName,
        email: cleanEmail,
        invitationStatus: invitationStatus || "pending",
        rsvpStatus: rsvpStatus || "pending",
        mealChoice: mealChoice || null,
        dietaryNotes: dietaryNotes || null,
        guestGroup: guestGroup || null,
        plusOne: !!plusOne,
        plusOneName: plusOneName || null,
        tableAssignment: tableAssignment || null,
        notes: notes || null,
        phone: phone || null,
        address: address || null,
        aptUnit: aptUnit || null,
        guestCity: guestCity || null,
        guestState: guestState || null,
        guestZip: guestZip || null,
        guestCountry: guestCountry || null,
      })
      .returning();

    res.status(201).json(created);
    return;
  } catch (err) {
    req.log.error(err, "Failed to add guest");
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

router.put("/guests/:id", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid guest ID" });

    const profile = await resolveProfile(req);
    const profileId = profile?.id ?? null;
    if (!profileId) return res.status(400).json({ error: "No wedding profile found." });

    const { name, email, invitationStatus, rsvpStatus, mealChoice, dietaryNotes, guestGroup, plusOne, plusOneName, tableAssignment, notes, phone, address, aptUnit, guestCity, guestState, guestZip, guestCountry, saveTheDateStatus } = req.body;

    if (name !== undefined || email !== undefined) {
      const checkName = (name ?? "").trim();
      const checkEmail = (email ?? "").trim() || null;
      const dupConditions = [];
      if (checkName) dupConditions.push(ilike(guests.name, checkName));
      if (checkEmail) dupConditions.push(ilike(guests.email, checkEmail));
      if (dupConditions.length > 0) {
        const existing = await db
          .select({ id: guests.id })
          .from(guests)
          .where(and(eq(guests.profileId, profileId), not(eq(guests.id, id)), or(...dupConditions)));
        if (existing.length > 0) {
          return res.status(409).json({
            error: "A guest with this name or email already exists.",
            duplicateIds: existing.map(g => g.id),
          });
        }
      }
    }

    const updateData: Partial<typeof guests.$inferInsert> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email || null;
    if (invitationStatus !== undefined) updateData.invitationStatus = invitationStatus;
    if (rsvpStatus !== undefined) updateData.rsvpStatus = rsvpStatus;
    if (mealChoice !== undefined) updateData.mealChoice = mealChoice || null;
    if (dietaryNotes !== undefined) updateData.dietaryNotes = dietaryNotes || null;
    if (guestGroup !== undefined) updateData.guestGroup = guestGroup || null;
    if (plusOne !== undefined) updateData.plusOne = !!plusOne;
    if (plusOneName !== undefined) updateData.plusOneName = plusOneName || null;
    if (tableAssignment !== undefined) updateData.tableAssignment = tableAssignment || null;
    if (notes !== undefined) updateData.notes = notes || null;
    if (phone !== undefined) updateData.phone = phone || null;
    if (address !== undefined) updateData.address = address || null;
    if (aptUnit !== undefined) updateData.aptUnit = aptUnit || null;
    if (guestCity !== undefined) updateData.guestCity = guestCity || null;
    if (guestState !== undefined) updateData.guestState = guestState || null;
    if (guestZip !== undefined) updateData.guestZip = guestZip || null;
    if (guestCountry !== undefined) updateData.guestCountry = guestCountry || null;
    if (saveTheDateStatus !== undefined) updateData.saveTheDateStatus = saveTheDateStatus;

    const [updated] = await db
      .update(guests)
      .set(updateData)
      .where(and(eq(guests.id, id), eq(guests.profileId, profileId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Guest not found" });
    res.json(updated);
    return;
  } catch (err) {
    req.log.error(err, "Failed to update guest");
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

router.post("/guests/:id/acknowledge", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid guest ID" });

    const profile = await resolveProfile(req);
    const profileId = profile?.id ?? null;
    if (!profileId) return res.status(400).json({ error: "No wedding profile found." });

    const [updated] = await db
      .update(guests)
      .set({ acknowledgedAt: new Date() })
      .where(and(eq(guests.id, id), eq(guests.profileId, profileId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Guest not found" });
    res.json(updated);
    return;
  } catch (err) {
    req.log.error(err, "Failed to acknowledge guest");
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

router.delete("/guests/:id", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid guest ID" });

    const profileId = await getProfileId(req.userId!);
    if (!profileId) return res.status(400).json({ error: "No wedding profile found." });

    await db
      .delete(guests)
      .where(and(eq(guests.id, id), eq(guests.profileId, profileId)));

    res.json({ success: true });
    return;
  } catch (err) {
    req.log.error(err, "Failed to delete guest");
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

export default router;
