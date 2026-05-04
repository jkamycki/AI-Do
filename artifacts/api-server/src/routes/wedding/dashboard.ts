import { Router } from "express";
import { db } from "@workspace/db";
import { weddingProfiles, timelines, budgets, budgetItems, checklistItems, guests, vendors } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth";
import { trackEvent } from "../../lib/trackEvent";
import { resolveProfile, resolveCallerRole, hasMinRole } from "../../lib/workspaceAccess";

const router = Router();

router.get("/dashboard/summary", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) return res.status(403).json({ error: "Insufficient permissions." });

    const effectiveProfile = await resolveProfile(req);
    const profiles = effectiveProfile ? [effectiveProfile] : [];

    const hasProfile = profiles.length > 0;

    let daysUntilWedding = 0;
    if (hasProfile) {
      const weddingDate = new Date(profiles[0].weddingDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      daysUntilWedding = Math.max(0, Math.ceil((weddingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    }

    const profileId = hasProfile ? profiles[0].id : -1;

    const timelineRows = hasProfile
      ? await db.select().from(timelines).where(eq(timelines.profileId, profileId)).orderBy(desc(timelines.id)).limit(1)
      : [];
    const hasTimeline = timelineRows.length > 0;
    const timelineEventCount = hasTimeline ? (timelineRows[0].events as Array<unknown>).length : 0;

    const budgetRows = hasProfile
      ? await db.select().from(budgets).where(eq(budgets.profileId, profileId)).orderBy(desc(budgets.id)).limit(1)
      : [];
    let budgetTotal = 0;
    if (budgetRows.length) {
      budgetTotal = parseFloat(budgetRows[0].totalBudget as string);
    }

    // budgetSpent = vendor contracts (totalCost) + budget line items (actualCost).
    // Manual expenses are ad-hoc costs tracked on the full Budget page and are
    // intentionally excluded here so the dashboard tile only reflects formally
    // committed vendor spend.
    const budgetId = budgetRows.length ? budgetRows[0].id : -1;
    const [userVendors, userBudgetItems] = hasProfile
      ? await Promise.all([
          db.select({ totalCost: vendors.totalCost }).from(vendors).where(eq(vendors.profileId, profileId)),
          budgetId !== -1
            ? db.select({ actualCost: budgetItems.actualCost }).from(budgetItems).where(eq(budgetItems.budgetId, budgetId))
            : ([] as { actualCost: string }[]),
        ])
      : [[], [] as { actualCost: string }[]];
    const budgetSpent =
      (userVendors as { totalCost: string }[]).reduce((sum, v) => sum + Number(v.totalCost), 0) +
      (userBudgetItems as { actualCost: string }[]).reduce((sum, i) => sum + Number(i.actualCost), 0);

    const allChecklistItems = hasProfile
      ? await db.select().from(checklistItems).where(eq(checklistItems.profileId, profileId))
      : [];
    const hasChecklist = allChecklistItems.length > 0;
    const checklistTotal = allChecklistItems.length;
    const checklistCompleted = allChecklistItems.filter(item => item.isCompleted).length;
    const checklistProgress = checklistTotal > 0 ? (checklistCompleted / checklistTotal) * 100 : 0;

    const guestRows = hasProfile
      ? await db.select().from(guests).where(eq(guests.profileId, profileId))
      : [];
    const plusOneCount = guestRows.filter(g => g.plusOne).length;
    const guestCount = guestRows.length + plusOneCount;
    const guestRsvpSummary = {
      total: guestCount,
      attending: guestRows.filter(g => g.rsvpStatus === "attending").length + guestRows.filter(g => g.rsvpStatus === "attending" && g.plusOne).length,
      declined: guestRows.filter(g => g.rsvpStatus === "declined").length + guestRows.filter(g => g.rsvpStatus === "declined" && g.plusOne).length,
      maybe: guestRows.filter(g => g.rsvpStatus === "maybe").length + guestRows.filter(g => g.rsvpStatus === "maybe" && g.plusOne).length,
      pending: guestRows.filter(g => g.rsvpStatus === "pending").length + guestRows.filter(g => g.rsvpStatus === "pending" && g.plusOne).length,
    };

    function parseMonthsFromLabel(label: string): number | null {
      const m = label.match(/(\d+)\s+month/i);
      if (m) return parseInt(m[1]);
      if (/week/i.test(label)) return 0.25;
      if (/wedding day/i.test(label)) return 0;
      return null;
    }

    let upcomingTasks: { id: number; task: string; month: string; isCompleted: boolean }[] = [];
    if (hasProfile && hasChecklist) {
      const weddingDate = new Date(profiles[0].weddingDate + "T12:00:00");
      const today = new Date();
      upcomingTasks = allChecklistItems
        .filter(item => {
          if (item.isCompleted) return false;
          const months = parseMonthsFromLabel(item.month);
          if (months === null) return false;
          const due = new Date(weddingDate);
          due.setMonth(due.getMonth() - Math.floor(months));
          if (months === 0.25) due.setDate(weddingDate.getDate() - 7);
          const diffDays = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
          return diffDays <= 45;
        })
        .slice(0, 5)
        .map(item => ({ id: item.id, task: item.task, month: item.month, isCompleted: item.isCompleted }));
    }

    const profile = hasProfile ? {
      partner1Name: profiles[0].partner1Name,
      partner2Name: profiles[0].partner2Name,
      weddingDate: profiles[0].weddingDate,
      venue: profiles[0].venue,
      location: profiles[0].location,
      venueCity: profiles[0].venueCity ?? "",
      venueState: profiles[0].venueState ?? "",
      venueZip: profiles[0].venueZip ?? "",
      ceremonyTime: profiles[0].ceremonyTime,
      receptionTime: profiles[0].receptionTime,
      guestCount: profiles[0].guestCount,
      totalBudget: parseFloat(profiles[0].totalBudget as string),
      weddingVibe: profiles[0].weddingVibe,
    } : null;

    trackEvent(req.userId!, "user_login");
    res.json({
      daysUntilWedding,
      checklistProgress,
      budgetSpent,
      budgetTotal,
      budgetRemaining: budgetTotal - budgetSpent,
      timelineEventCount,
      checklistCompleted,
      checklistTotal,
      guestCount,
      guestRsvpSummary,
      hasProfile,
      hasTimeline,
      hasChecklist,
      upcomingTasks,
      profile,
    });
  } catch (err) {
    req.log.error(err, "Failed to get dashboard summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
