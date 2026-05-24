import { Router } from "express";
import { db } from "@workspace/db";
import { weddingProfiles, budgets } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth";
import { trackEvent } from "../../lib/trackEvent";
import { resolveProfile, resolveWorkspaceRole, resolveCallerRole, hasMinRole } from "../../lib/workspaceAccess";

const router = Router();

type PlanningPriorities = {
  mustHaves: string[];
  niceToHaves: string[];
  mustAvoids: string[];
};

const emptyPlanningPriorities: PlanningPriorities = {
  mustHaves: [],
  niceToHaves: [],
  mustAvoids: [],
};

const allowedReminderDays = new Set([1, 3, 7, 14, 30]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeReminderDays(value: unknown): number {
  const days = Number(value);
  return Number.isInteger(days) && allowedReminderDays.has(days) ? days : 7;
}

function normalizeNotificationEmails(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim().toLowerCase())
      .filter((item) => emailPattern.test(item))
  )).slice(0, 10);
}

function normalizePlanningPriorities(value: unknown): PlanningPriorities {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return emptyPlanningPriorities;
  }

  const source = value as Partial<Record<keyof PlanningPriorities, unknown>>;
  const normalizeList = (items: unknown) =>
    Array.isArray(items)
      ? Array.from(new Set(items.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())))
      : [];

  const mustHaves = normalizeList(source.mustHaves);
  const niceToHaves = normalizeList(source.niceToHaves).filter((item) => !mustHaves.includes(item));
  const mustAvoids = normalizeList(source.mustAvoids).filter((item) => !mustHaves.includes(item) && !niceToHaves.includes(item));

  return { mustHaves, niceToHaves, mustAvoids };
}

router.get("/profile", requireAuth, async (req, res) => {
  try {
    const p = await resolveProfile(req);

    if (!p) {
      res.status(404).json({ error: "No profile found" });
      return;
    }

    const callerRole = await resolveCallerRole(req);
    if (callerRole === "vendor") {
      return res.json({
        id: p.id,
        partner1Name: p.partner1Name,
        partner2Name: p.partner2Name,
        weddingDate: p.weddingDate,
        ceremonyTime: p.ceremonyTime,
        receptionTime: p.receptionTime,
        venue: p.venue,
        location: p.location,
        venueCity: p.venueCity,
        venueState: p.venueState,
        venueZip: p.venueZip,
        venueCountry: p.venueCountry,
        updatedAt: p.updatedAt.toISOString(),
      });
    }
    const profileData: Record<string, unknown> = {
      ...p,
      totalBudget: parseFloat(p.totalBudget as string),
      updatedAt: p.updatedAt.toISOString(),
    };
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
      workstationName,
      venue, location, venueCity, venueState, venueZip, venueCountry,
      venueStatus, venueDiscovery, venueBrainstorm,
      planningPriorities,
      ariaMemory,
      guestCount, totalBudget, weddingVibe,
      preferredLanguage, vendorBccEmail,
      taskEmailRemindersEnabled, taskReminderDaysBefore,
      rsvpEmailNotificationsEnabled, rsvpNotificationEmails,
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
    const hasAriaMemory = Object.prototype.hasOwnProperty.call(req.body, "ariaMemory");
    const normalizedAriaMemory =
      typeof ariaMemory === "string" ? (ariaMemory.trim().slice(0, 8000) || null) : null;
    const hasTaskEmailRemindersEnabled = Object.prototype.hasOwnProperty.call(req.body, "taskEmailRemindersEnabled");
    const normalizedTaskEmailRemindersEnabled =
      taskEmailRemindersEnabled === false || taskEmailRemindersEnabled === "false" ? false : true;
    const hasTaskReminderDaysBefore = Object.prototype.hasOwnProperty.call(req.body, "taskReminderDaysBefore");
    const normalizedTaskReminderDaysBefore = normalizeReminderDays(taskReminderDaysBefore);
    const hasRsvpEmailNotificationsEnabled = Object.prototype.hasOwnProperty.call(req.body, "rsvpEmailNotificationsEnabled");
    const normalizedRsvpEmailNotificationsEnabled =
      rsvpEmailNotificationsEnabled === false || rsvpEmailNotificationsEnabled === "false" ? false : true;
    const hasRsvpNotificationEmails = Object.prototype.hasOwnProperty.call(req.body, "rsvpNotificationEmails");
    const normalizedRsvpNotificationEmails = normalizeNotificationEmails(rsvpNotificationEmails);
    const normalizedAccountType = "couple_individual";
    const normalizedVenueStatus =
      venueStatus === "not_yet" || venueStatus === "deciding" ? venueStatus : "booked";
    const normalizedVenueDiscovery =
      venueDiscovery && typeof venueDiscovery === "object" && !Array.isArray(venueDiscovery)
        ? venueDiscovery
        : null;
    const normalizedVenueBrainstorm =
      venueBrainstorm && typeof venueBrainstorm === "object" && !Array.isArray(venueBrainstorm)
        ? venueBrainstorm
        : null;
    const normalizedPlanningPriorities = normalizePlanningPriorities(planningPriorities);

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
          venue: venue ?? "", location: location ?? "", venueCity: venueCity ?? null, venueState: venueState ?? null,
          venueZip: venueZip ?? null, venueCountry: venueCountry ?? null,
          venueStatus: normalizedVenueStatus,
          venueDiscovery: normalizedVenueDiscovery,
          venueBrainstorm: normalizedVenueBrainstorm,
          planningPriorities: normalizedPlanningPriorities,
          ...(hasAriaMemory ? { ariaMemory: normalizedAriaMemory } : {}),
          ...ceremonyFields,
          guestCount, totalBudget: String(totalBudget), weddingVibe,
          accountType: normalizedAccountType,
          preferredLanguage: preferredLanguage ?? "English",
          ...(hasVendorBccEmail ? { vendorBccEmail: normalizedVendorBcc } : {}),
          ...(hasTaskEmailRemindersEnabled ? { taskEmailRemindersEnabled: normalizedTaskEmailRemindersEnabled } : {}),
          ...(hasTaskReminderDaysBefore ? { taskReminderDaysBefore: normalizedTaskReminderDaysBefore } : {}),
          ...(hasRsvpEmailNotificationsEnabled ? { rsvpEmailNotificationsEnabled: normalizedRsvpEmailNotificationsEnabled } : {}),
          ...(hasRsvpNotificationEmails ? { rsvpNotificationEmails: normalizedRsvpNotificationEmails } : {}),
          updatedAt: new Date(),
        })
        .where(eq(weddingProfiles.id, existingProfile.id))
        .returning();
      await db
        .insert(budgets)
        .values({ profileId: existingProfile.id, totalBudget: String(totalBudget) })
        .onConflictDoUpdate({
          target: budgets.profileId,
          set: { totalBudget: String(totalBudget), updatedAt: new Date() },
        });
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
          workstationName: typeof workstationName === "string" ? workstationName.trim() || null : null,
          partner1Name, partner2Name, weddingDate, ceremonyTime, receptionTime,
          venue: venue ?? "", location: location ?? "", venueCity: venueCity ?? null, venueState: venueState ?? null,
          venueZip: venueZip ?? null, venueCountry: venueCountry ?? null,
          venueStatus: normalizedVenueStatus,
          venueDiscovery: normalizedVenueDiscovery,
          venueBrainstorm: normalizedVenueBrainstorm,
          planningPriorities: normalizedPlanningPriorities,
          ariaMemory: normalizedAriaMemory,
          ...ceremonyFields,
          guestCount, totalBudget: String(totalBudget), weddingVibe,
          accountType: normalizedAccountType,
          preferredLanguage: preferredLanguage ?? "English",
          taskEmailRemindersEnabled: hasTaskEmailRemindersEnabled ? normalizedTaskEmailRemindersEnabled : true,
          taskReminderDaysBefore: hasTaskReminderDaysBefore ? normalizedTaskReminderDaysBefore : 7,
          rsvpEmailNotificationsEnabled: hasRsvpEmailNotificationsEnabled ? normalizedRsvpEmailNotificationsEnabled : true,
          rsvpNotificationEmails: hasRsvpNotificationEmails ? normalizedRsvpNotificationEmails : null,
        })
        .returning();
      await db
        .insert(budgets)
        .values({ profileId: created.id, totalBudget: String(totalBudget) })
        .onConflictDoUpdate({
          target: budgets.profileId,
          set: { totalBudget: String(totalBudget), updatedAt: new Date() },
        });
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
