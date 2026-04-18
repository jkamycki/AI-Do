import { Router } from "express";
import { db } from "@workspace/db";
import { weddingProfiles } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth";

const router = Router();

router.get("/profile", requireAuth, async (req, res) => {
  try {
    const profiles = await db
      .select()
      .from(weddingProfiles)
      .where(eq(weddingProfiles.userId, req.userId))
      .limit(1);

    if (!profiles.length) {
      res.status(404).json({ error: "No profile found" });
      return;
    }
    const p = profiles[0];
    res.json({
      ...p,
      totalBudget: parseFloat(p.totalBudget as string),
      updatedAt: p.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err, "Failed to get profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/profile", requireAuth, async (req, res) => {
  try {
    const {
      partner1Name, partner2Name, weddingDate, ceremonyTime, receptionTime,
      venue, location, guestCount, totalBudget, weddingVibe
    } = req.body;

    const existing = await db
      .select()
      .from(weddingProfiles)
      .where(eq(weddingProfiles.userId, req.userId))
      .limit(1);

    if (existing.length) {
      const [updated] = await db
        .update(weddingProfiles)
        .set({
          partner1Name, partner2Name, weddingDate, ceremonyTime, receptionTime,
          venue, location, guestCount, totalBudget: String(totalBudget), weddingVibe,
          updatedAt: new Date(),
        })
        .where(eq(weddingProfiles.id, existing[0].id))
        .returning();
      res.json({
        ...updated,
        totalBudget: parseFloat(updated.totalBudget as string),
        updatedAt: updated.updatedAt.toISOString(),
      });
    } else {
      const [created] = await db
        .insert(weddingProfiles)
        .values({
          userId: req.userId,
          partner1Name, partner2Name, weddingDate, ceremonyTime, receptionTime,
          venue, location, guestCount, totalBudget: String(totalBudget), weddingVibe,
        })
        .returning();
      res.json({
        ...created,
        totalBudget: parseFloat(created.totalBudget as string),
        updatedAt: created.updatedAt.toISOString(),
      });
    }
  } catch (err) {
    req.log.error(err, "Failed to save profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
