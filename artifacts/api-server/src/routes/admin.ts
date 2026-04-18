import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { db, analyticsEvents, adminUsers } from "@workspace/db";
import { eq, gte, desc, sql, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.userId, req.userId!))
      .limit(1);
    if (!rows.length) return res.status(403).json({ error: "Forbidden: admin only" });
    next();
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

router.get("/admin/check", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.userId, req.userId!))
      .limit(1);
    res.json({ isAdmin: rows.length > 0 });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/metrics", requireAuth, requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 86400000);
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const monthAgo = new Date(now.getTime() - 30 * 86400000);

    const [countsByType, totalUsersRow, dauRow, wauRow, mauRow, newTodayRow, newWeekRow, newMonthRow, userGrowthRows, deviceRows] = await Promise.all([
      db.select({
        eventType: analyticsEvents.eventType,
        count: sql<number>`count(*)::int`,
      })
        .from(analyticsEvents)
        .groupBy(analyticsEvents.eventType),

      db.select({ count: sql<number>`count(distinct user_id)::int` }).from(analyticsEvents),

      db.select({ count: sql<number>`count(distinct user_id)::int` })
        .from(analyticsEvents)
        .where(gte(analyticsEvents.timestamp, dayAgo)),

      db.select({ count: sql<number>`count(distinct user_id)::int` })
        .from(analyticsEvents)
        .where(gte(analyticsEvents.timestamp, weekAgo)),

      db.select({ count: sql<number>`count(distinct user_id)::int` })
        .from(analyticsEvents)
        .where(gte(analyticsEvents.timestamp, monthAgo)),

      db.select({ count: sql<number>`count(distinct user_id)::int` })
        .from(analyticsEvents)
        .where(and(
          eq(analyticsEvents.eventType, "user_signup"),
          gte(analyticsEvents.timestamp, dayAgo),
        )),

      db.select({ count: sql<number>`count(distinct user_id)::int` })
        .from(analyticsEvents)
        .where(and(
          eq(analyticsEvents.eventType, "user_signup"),
          gte(analyticsEvents.timestamp, weekAgo),
        )),

      db.select({ count: sql<number>`count(distinct user_id)::int` })
        .from(analyticsEvents)
        .where(and(
          eq(analyticsEvents.eventType, "user_signup"),
          gte(analyticsEvents.timestamp, monthAgo),
        )),

      db.execute(sql`
        SELECT
          to_char(date_trunc('day', timestamp), 'YYYY-MM-DD') as date,
          count(distinct user_id)::int as count
        FROM analytics_events
        WHERE event_type = 'user_signup'
          AND timestamp >= NOW() - INTERVAL '30 days'
        GROUP BY 1
        ORDER BY 1
      `),

      db.execute(sql`
        SELECT
          CASE
            WHEN metadata->>'device' = 'mobile' THEN 'Mobile'
            ELSE 'Desktop'
          END as device,
          count(*)::int as count
        FROM analytics_events
        WHERE metadata->>'device' IS NOT NULL
        GROUP BY 1
      `),
    ]);

    const countMap = Object.fromEntries(countsByType.map(r => [r.eventType, r.count]));
    const totalUsers = totalUsersRow[0]?.count ?? 0;
    const signupCount = countMap["user_signup"] ?? 0;
    const onboardingCount = countMap["onboarding_completed"] ?? 0;
    const onboardingRate = signupCount > 0 ? Math.round((onboardingCount / signupCount) * 100) : 0;

    const features = [
      { name: "Timeline", eventType: "timeline_generated", count: countMap["timeline_generated"] ?? 0 },
      { name: "Vendor Email", eventType: "vendor_email_generated", count: countMap["vendor_email_generated"] ?? 0 },
      { name: "Checklist", eventType: "checklist_item_completed", count: countMap["checklist_item_completed"] ?? 0 },
      { name: "Budget", eventType: "budget_updated", count: countMap["budget_updated"] ?? 0 },
      { name: "Day-Of Mode", eventType: "day_of_mode_activated", count: countMap["day_of_mode_activated"] ?? 0 },
      { name: "PDF Export", eventType: "pdf_exported", count: countMap["pdf_exported"] ?? 0 },
    ];

    const mostUsed = [...features].sort((a, b) => b.count - a.count)[0]?.name ?? "—";
    const leastUsed = [...features].filter(f => f.count > 0).sort((a, b) => a.count - b.count)[0]?.name ?? "—";

    res.json({
      userMetrics: {
        totalUsers,
        dau: dauRow[0]?.count ?? 0,
        wau: wauRow[0]?.count ?? 0,
        mau: mauRow[0]?.count ?? 0,
        newToday: newTodayRow[0]?.count ?? 0,
        newThisWeek: newWeekRow[0]?.count ?? 0,
        newThisMonth: newMonthRow[0]?.count ?? 0,
        onboardingCompletionRate: onboardingRate,
        totalSignups: signupCount,
      },
      usageMetrics: {
        timelinesGenerated: countMap["timeline_generated"] ?? 0,
        vendorEmailsGenerated: countMap["vendor_email_generated"] ?? 0,
        checklistItemsCompleted: countMap["checklist_item_completed"] ?? 0,
        budgetUpdates: countMap["budget_updated"] ?? 0,
        dayOfActivations: countMap["day_of_mode_activated"] ?? 0,
        pdfExports: countMap["pdf_exported"] ?? 0,
        totalEvents: Object.values(countMap).reduce((a, b) => a + b, 0),
        features,
        mostUsed,
        leastUsed,
      },
      moneyMetrics: {
        totalRevenue: 0,
        mrr: 0,
        arr: 0,
        arpu: 0,
        ltv: 0,
        churnRate: 0,
        failedPayments: 0,
        note: "No payment system configured yet.",
      },
      systemMetrics: {
        totalEvents: Object.values(countMap).reduce((a, b) => a + b, 0),
        apiErrors: countMap["api_error"] ?? 0,
        deviceBreakdown: (deviceRows.rows as Array<{ device: string; count: number }>).map(r => ({
          device: r.device,
          count: r.count,
        })),
      },
      userGrowth: (userGrowthRows.rows as Array<{ date: string; count: number }>).map(r => ({
        date: r.date,
        count: r.count,
      })),
    });
  } catch (err) {
    console.error("Admin metrics error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/events", requireAuth, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(String(req.query.page ?? "1"), 10);
    const limit = 50;
    const offset = (page - 1) * limit;

    const [events, [{ total }]] = await Promise.all([
      db.select()
        .from(analyticsEvents)
        .orderBy(desc(analyticsEvents.timestamp))
        .limit(limit)
        .offset(offset),
      db.select({ total: sql<number>`count(*)::int` }).from(analyticsEvents),
    ]);

    res.json({
      events: events.map(e => ({
        ...e,
        timestamp: e.timestamp.toISOString(),
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Admin events error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/promote/:userId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    await db.insert(adminUsers).values({ userId }).onConflictDoNothing();
    res.json({ success: true, message: `User ${userId} promoted to admin.` });
  } catch (err) {
    console.error("Admin promote error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/admin/demote/:userId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId === req.userId) {
      return res.status(400).json({ error: "Cannot demote yourself." });
    }
    await db.delete(adminUsers).where(eq(adminUsers.userId, userId));
    res.json({ success: true });
  } catch (err) {
    console.error("Admin demote error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
