import { Router } from "express";
import { db, weddingParty } from "@workspace/db";
import { eq, and, asc, or, isNull } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth";
import { getProfileByUserId, resolveProfile, resolveScopeUserId, resolveCallerRole, hasMinRole } from "../../lib/workspaceAccess";

const router = Router();

function fmt(m: typeof weddingParty.$inferSelect) {
  return { ...m, createdAt: m.createdAt.toISOString() };
}

async function partyScope(req: Parameters<typeof resolveProfile>[0]) {
  const profile = await resolveProfile(req);
  const userId = profile?.userId ?? await resolveScopeUserId(req);
  const defaultProfile = await getProfileByUserId(userId);
  const condition = profile
    ? profile.id === defaultProfile?.id
      ? or(eq(weddingParty.profileId, profile.id), and(eq(weddingParty.userId, userId), isNull(weddingParty.profileId)))
      : eq(weddingParty.profileId, profile.id)
    : eq(weddingParty.userId, userId);
  return { profile, userId, condition };
}

router.get("/wedding-party", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const { condition } = await partyScope(req);
    const rows = await db
      .select()
      .from(weddingParty)
      .where(condition)
      .orderBy(asc(weddingParty.sortOrder), asc(weddingParty.createdAt));
    res.json(rows.map(fmt));
  } catch (err) {
    req.log.error(err, "Failed to list wedding party");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/wedding-party", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const { profile, userId } = await partyScope(req);
    const {
      name, role, side, phone, email,
      outfitDetails, shoeSize, outfitStore, fittingDate, notes, sortOrder,
    } = req.body;
    if (!name || !role) return res.status(400).json({ error: "name and role are required" });
    const [created] = await db.insert(weddingParty).values({
      userId,
      profileId: profile?.id ?? null,
      name,
      role,
      side: side ?? "bride",
      phone: phone ?? null,
      email: email ?? null,
      outfitDetails: outfitDetails ?? null,
      shoeSize: shoeSize ?? null,
      outfitStore: outfitStore ?? null,
      fittingDate: fittingDate ?? null,
      notes: notes ?? null,
      sortOrder: sortOrder ?? 0,
    }).returning();
    res.status(201).json(fmt(created));
  } catch (err) {
    req.log.error(err, "Failed to create wedding party member");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/wedding-party/:id", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const { condition } = await partyScope(req);
    const id = Number(req.params.id);
    const {
      name, role, side, phone, email,
      outfitDetails, shoeSize, outfitStore, fittingDate, notes, photoUrl, sortOrder,
    } = req.body;
    const patch: Partial<typeof weddingParty.$inferInsert> = {};
    if (name !== undefined) patch.name = name;
    if (role !== undefined) patch.role = role;
    if (side !== undefined) patch.side = side;
    if (phone !== undefined) patch.phone = phone;
    if (email !== undefined) patch.email = email;
    if (outfitDetails !== undefined) patch.outfitDetails = outfitDetails;
    if (shoeSize !== undefined) patch.shoeSize = shoeSize;
    if (outfitStore !== undefined) patch.outfitStore = outfitStore;
    if (fittingDate !== undefined) patch.fittingDate = fittingDate;
    if (notes !== undefined) patch.notes = notes;
    if (photoUrl !== undefined) patch.photoUrl = photoUrl;
    if (sortOrder !== undefined) patch.sortOrder = sortOrder;
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: "No updates provided" });
    }
    const [updated] = await db
      .update(weddingParty)
      .set(patch)
      .where(and(eq(weddingParty.id, id), condition))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(fmt(updated));
  } catch (err) {
    req.log.error(err, "Failed to update wedding party member");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/wedding-party/:id", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const { condition } = await partyScope(req);
    const id = Number(req.params.id);
    await db.delete(weddingParty).where(and(eq(weddingParty.id, id), condition));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "Failed to delete wedding party member");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
