import { Router } from "express";
import { db, weddingParty } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth";
import { resolveScopeUserId, resolveCallerRole, hasMinRole } from "../../lib/workspaceAccess";

const router = Router();

function fmt(m: typeof weddingParty.$inferSelect) {
  return { ...m, createdAt: m.createdAt.toISOString() };
}

router.get("/wedding-party", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const userId = await resolveScopeUserId(req);
    const rows = await db
      .select()
      .from(weddingParty)
      .where(eq(weddingParty.userId, userId))
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
    const userId = await resolveScopeUserId(req);
    const {
      name, role, side, phone, email,
      outfitDetails, shoeSize, outfitStore, fittingDate, notes, sortOrder,
    } = req.body;
    if (!name || !role) return res.status(400).json({ error: "name and role are required" });
    const [created] = await db.insert(weddingParty).values({
      userId,
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
    const userId = await resolveScopeUserId(req);
    const id = Number(req.params.id);
    const {
      name, role, side, phone, email,
      outfitDetails, shoeSize, outfitStore, fittingDate, notes, sortOrder,
    } = req.body;
    const [updated] = await db
      .update(weddingParty)
      .set({ name, role, side, phone, email, outfitDetails, shoeSize, outfitStore, fittingDate, notes, sortOrder })
      .where(and(eq(weddingParty.id, id), eq(weddingParty.userId, userId)))
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
    const userId = await resolveScopeUserId(req);
    const id = Number(req.params.id);
    await db.delete(weddingParty).where(and(eq(weddingParty.id, id), eq(weddingParty.userId, userId)));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "Failed to delete wedding party member");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
