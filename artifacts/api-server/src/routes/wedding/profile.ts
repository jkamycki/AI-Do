import { Router } from "express";
import { db } from "@workspace/db";
import { weddingProfiles } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth";
import { trackEvent } from "../../lib/trackEvent";
import { resolveProfile, resolveWorkspaceRole, resolveCallerRole, hasMinRole } from "../../lib/workspaceAccess";

const router = Router();

router.get("/profile", requireAuth, async (req, res) => {
  try {
    const p = await resolveProfile(req);

    if (!p) {
      res.status(404).json({ error: "No profile found" });
      return;
    }

    const callerRole = await resolveCallerRole(req);
    const profileData: Record<string, unknown> = {
      ...p,
      totalBudget: parseFloat(p.totalBudget as string),
      updatedAt: p.updatedAt.toISOString(),
    };
    if (callerRole === "vendor") {
      delete profileData["guestCollectionToken"];
      delete profileData["vendorBccEmail"];
    }
    res.json(profileData);
  } catch (err) {
    req.log.error(err, "Failed to get profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/profile", requireAuth, async (req, res) => {
  try {
    const {
      partner1Name, partner2Name, weddingDate, ceremonyTime, receptionTime,
      venue, location, venueCity, venueState, venueZip, guestCount, totalBudget, weddingVibe,
      preferredLanguage, vendorBccEmail,
      ceremonyAtVenue, ceremonyVenueName, ceremonyAddress, ceremonyCity, ceremonyState, ceremonyZip,
    } = req.body;
    const ceremonyAtVenueBool = ceremonyAtVenue === undefined ? true : Boolean(ceremonyAtVenue);
    const ceremonyFields = ceremonyAtVenueBool
      ? {
          ceremonyAtVenue: true,
          ceremonyVenueName: null,
          ceremonyAddress: null,
          ceremonyCity: null,
          ceremonyState: null,
          ceremonyZip: null,
        }
      : {
          ceremonyAtVenue: false,
          ceremonyVenueName: ceremonyVenueName ?? null,
          ceremonyAddress: ceremonyAddress ?? null,
          ceremonyCity: ceremonyCity ?? null,
          ceremonyState: ceremonyState ?? null,
          ceremonyZip: ceremonyZip ?? null,
        };
    const hasVendorBccEmail = Object.prototype.hasOwnProperty.call(req.body, "vendorBccEmail");
    const normalizedVendorBcc =
      typeof vendorBccEmail === "string" ? (vendorBccEmail.trim() || null) : null;

    // Workspace-aware: if a workspaceId/header is set, edit that shared workspace
    // (requires partner+ role). Otherwise, edit the user's own profile.
    const existingProfile = await resolveProfile(req);

    if (existingProfile) {
      // Permission check: only owner/partner can edit core wedding details on a shared workspace
      const role = await resolveWorkspaceRole(req.userId!, existingProfile.id);
      if (!hasMinRole(role, "partner")) {
        return res.status(403).json({ error: "Only owners and partners can edit core wedding details." });
      }
      const [updated] = await db
        .update(weddingProfiles)
        .set({
          partner1Name, partner2Name, weddingDate, ceremonyTime, receptionTime,
          venue, location, venueCity: venueCity ?? null, venueState: venueState ?? null,
          venueZip: venueZip ?? null,
          ...ceremonyFields,
          guestCount, totalBudget: String(totalBudget), weddingVibe,
          preferredLanguage: preferredLanguage ?? "English",
          ...(hasVendorBccEmail ? { vendorBccEmail: normalizedVendorBcc } : {}),
          updatedAt: new Date(),
        })
        .where(eq(weddingProfiles.id, existingProfile.id))
        .returning();
      trackEvent(req.userId!, "onboarding_completed", { updated: true });
      return res.json({
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
          venueZip: venueZip ?? null,
          ...ceremonyFields,
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
