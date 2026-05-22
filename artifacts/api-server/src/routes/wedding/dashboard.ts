import { Router } from "express";
import { db } from "@workspace/db";
import { weddingProfiles, timelines, budgets, checklistItems, guests, vendors, weddingParty, seatingCharts, weddingWebsites } from "@workspace/db";
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

    const summaryRows = hasProfile
      ? await Promise.all([
          db
            .select({ events: timelines.events })
            .from(timelines)
            .where(eq(timelines.profileId, profileId))
            .orderBy(desc(timelines.id))
            .limit(1),
          db
            .select({ totalBudget: budgets.totalBudget })
            .from(budgets)
            .where(eq(budgets.profileId, profileId))
            .orderBy(desc(budgets.id))
            .limit(1),
          db
            .select({ totalCost: vendors.totalCost })
            .from(vendors)
            .where(eq(vendors.profileId, profileId)),
          db
            .select({
              id: checklistItems.id,
              task: checklistItems.task,
              month: checklistItems.month,
              isCompleted: checklistItems.isCompleted,
            })
            .from(checklistItems)
            .where(eq(checklistItems.profileId, profileId)),
          db
            .select({
              rsvpStatus: guests.rsvpStatus,
              plusOne: guests.plusOne,
              tableAssignment: guests.tableAssignment,
            })
            .from(guests)
            .where(eq(guests.profileId, profileId)),
          db
            .select({ id: weddingParty.id })
            .from(weddingParty)
            .where(eq(weddingParty.profileId, profileId)),
          db
            .select({
              id: seatingCharts.id,
              tableCount: seatingCharts.tableCount,
              seatsPerTable: seatingCharts.seatsPerTable,
              updatedAt: seatingCharts.updatedAt,
              createdAt: seatingCharts.createdAt,
            })
            .from(seatingCharts)
            .where(eq(seatingCharts.profileId, profileId))
            .orderBy(desc(seatingCharts.createdAt))
            .limit(1),
          db
            .select({ id: weddingWebsites.id, published: weddingWebsites.published })
            .from(weddingWebsites)
            .where(eq(weddingWebsites.profileId, profileId))
            .limit(1),
        ])
      : [[], [], [], [], [], [], [], []];
    const timelineRows = summaryRows[0] as Array<{ events: Array<unknown> }>;
    const budgetRows = summaryRows[1] as Array<{ totalBudget: string }>;
    const userVendors = summaryRows[2] as Array<{ totalCost: string }>;
    const allChecklistItems = summaryRows[3] as Array<{
      id: number;
      task: string;
      month: string;
      isCompleted: boolean;
    }>;
    const guestRows = summaryRows[4] as Array<{
      rsvpStatus: string;
      plusOne: boolean;
      tableAssignment: string | null;
    }>;
    const weddingPartyRows = summaryRows[5] as Array<{ id: number }>;
    const latestChartRows = summaryRows[6] as Array<{
      id: number;
      tableCount: number;
      seatsPerTable: number;
      updatedAt: Date;
      createdAt: Date;
    }>;
    const websiteRows = summaryRows[7] as Array<{ id: number; published: boolean }>;

    const hasTimeline = timelineRows.length > 0;
    const timelineEventCount = hasTimeline ? (timelineRows[0].events as Array<unknown>).length : 0;

    let budgetTotal = 0;
    if (budgetRows.length) {
      budgetTotal = parseFloat(budgetRows[0].totalBudget as string);
    }

    // budgetSpent = vendor contracts (totalCost) only.
    // Manual expenses and budget line items are ad-hoc costs tracked on the
    // full Budget page and are intentionally excluded here so the dashboard
    // tile only reflects formally committed vendor spend. With no vendors
    // added, "spent" should be $0.
    const budgetSpent = (userVendors as { totalCost: string }[]).reduce(
      (sum, v) => sum + Number(v.totalCost),
      0,
    );

    const hasChecklist = allChecklistItems.length > 0;
    const checklistTotal = allChecklistItems.length;
    const checklistCompleted = allChecklistItems.filter(item => item.isCompleted).length;
    const checklistProgress = checklistTotal > 0 ? (checklistCompleted / checklistTotal) * 100 : 0;

    const plusOneCount = guestRows.filter(g => g.plusOne).length;
    const guestCount = guestRows.length + plusOneCount;
    const guestRsvpSummary = {
      total: guestCount,
      attending: guestRows.filter(g => g.rsvpStatus === "attending").length + guestRows.filter(g => g.rsvpStatus === "attending" && g.plusOne).length,
      declined: guestRows.filter(g => g.rsvpStatus === "declined").length + guestRows.filter(g => g.rsvpStatus === "declined" && g.plusOne).length,
      maybe: guestRows.filter(g => g.rsvpStatus === "maybe").length + guestRows.filter(g => g.rsvpStatus === "maybe" && g.plusOne).length,
      pending: guestRows.filter(g => g.rsvpStatus === "pending").length + guestRows.filter(g => g.rsvpStatus === "pending" && g.plusOne).length,
    };

    // Wedding party count is keyed by userId (not profileId) — same scope the
    // /api/wedding-party route uses, so the dashboard tile and the page agree.
    const weddingPartyCount = weddingPartyRows.length;

    // Seating summary — most recent chart for the workspace (if any) plus how
    // many attending guests already have a tableAssignment. The dashboard tile
    // shows "X / Y seated" + table count, so couples can see at a glance how
    // many people they still have to place.
    const attendingRows = guestRows.filter((g) => g.rsvpStatus === "attending");
    const attendingGuestCount = attendingRows.length;
    const seatedAttendingCount = attendingRows.filter((g) => !!g.tableAssignment && g.tableAssignment.trim() !== "").length;
    // Order by createdAt so the dashboard reflects the most recently
    // *generated* chart, regardless of edits to older charts. The seating
    // page's saved-charts list uses the same order — the dashboard and the
    // page agree on which chart is "the latest".
    const [latestChart] = latestChartRows;
    const seatingSummary = {
      hasChart: !!latestChart,
      tableCount: latestChart?.tableCount ?? 0,
      seatsPerTable: latestChart?.seatsPerTable ?? 0,
      seatedAttendingCount,
      attendingGuestCount,
      lastUpdatedAt: latestChart?.updatedAt?.toISOString() ?? null,
    };

    // Has the couple created their guest-facing wedding website yet? Used to
    // append a "Create your wedding website" nudge as the final item in the
    // dashboard's "Needs attention" box.
    const hasWebsite = websiteRows.length > 0;
    const websitePublished = !!websiteRows[0]?.published;

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
      accountType: profiles[0].accountType,
    } : null;

    if (req.headers["x-aido-load-test"] !== "true") {
      void trackEvent(req.userId!, "user_login");
    }
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
      weddingPartyCount,
      seatingSummary,
      hasWebsite,
      websitePublished,
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
