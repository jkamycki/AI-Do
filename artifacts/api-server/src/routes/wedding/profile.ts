import { Router } from "express";
import { db } from "@workspace/db";
import { weddingProfiles } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth";
import { trackEvent } from "../../lib/trackEvent";
import { resolveProfile } from "../../lib/workspaceAccess";

const router = Router();

router.get("/profile", requireAuth, async (req, res) => {
  try {
    const p = await resolveProfile(req);

    if (!p) {
      res.status(404).json({ error: "No profile found" });
      return;
    }
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
      venue, location, venueCity, venueState, guestCount, totalBudget, weddingVibe,
      preferredLanguage,
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
          venue, location, venueCity: venueCity ?? null, venueState: venueState ?? null,
          guestCount, totalBudget: String(totalBudget), weddingVibe,
          preferredLanguage: preferredLanguage ?? "English",
          updatedAt: new Date(),
        })
        .where(eq(weddingProfiles.id, existing[0].id))
        .returning();
      trackEvent(req.userId!, "onboarding_completed", { updated: true });
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
          venue, location, venueCity: venueCity ?? null, venueState: venueState ?? null,
          guestCount, totalBudget: String(totalBudget), weddingVibe,
          preferredLanguage: preferredLanguage ?? "English",
        })
        .returning();
      trackEvent(req.userId!, "user_signup");
      trackEvent(req.userId!, "onboarding_completed", { firstTime: true });
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
