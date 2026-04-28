import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { clerkClient } from "@clerk/express";
import { db, analyticsEvents, adminUsers, weddingProfiles } from "@workspace/db";
import { eq, gte, desc, sql, and, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { purgeUserData } from "../lib/userCleanup";

const router = Router();

const OWNER_EMAILS = [
  "kamyckijoseph@gmail.com",
  "kamyckijoseph@outlook.com",
];

async function isAdmin(userId: string): Promise<boolean> {
  const [emailCheck, dbCheck] = await Promise.allSettled([
    (async () => {
      const user = await clerkClient.users.getUser(userId);
      const userEmails = user.emailAddresses.map(e => e.emailAddress.toLowerCase());
      return OWNER_EMAILS.some(e => userEmails.includes(e));
    })(),
    (async () => {
      const rows = await db.select().from(adminUsers).where(eq(adminUsers.userId, userId)).limit(1);
      return rows.length > 0;
    })(),
  ]);

  const emailPass = emailCheck.status === "fulfilled" && emailCheck.value;
  const dbPass = dbCheck.status === "fulfilled" && dbCheck.value;
  return emailPass || dbPass;
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const allowed = await isAdmin(req.userId!);
    if (!allowed) return res.status(403).json({ error: "Forbidden: admin only" });
    next();
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

router.get("/admin/check", requireAuth, async (req, res) => {
  try {
    const adminStatus = await isAdmin(req.userId!);
    res.json({ isAdmin: adminStatus });
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

    const [
      countsByType, dauRow, wauRow, mauRow, userGrowthRows, deviceRows,
      clerkTotal, clerkToday, clerkThisWeek, clerkThisMonth, onboardedRow,
    ] = await Promise.all([
      db.select({
        eventType: analyticsEvents.eventType,
        count: sql<number>`count(*)::int`,
      })
        .from(analyticsEvents)
        .groupBy(analyticsEvents.eventType),

      db.select({ count: sql<number>`count(distinct user_id)::int` })
        .from(analyticsEvents)
        .where(gte(analyticsEvents.timestamp, dayAgo)),

      db.select({ count: sql<number>`count(distinct user_id)::int` })
        .from(analyticsEvents)
        .where(gte(analyticsEvents.timestamp, weekAgo)),

      db.select({ count: sql<number>`count(distinct user_id)::int` })
        .from(analyticsEvents)
        .where(gte(analyticsEvents.timestamp, monthAgo)),

      // Growth chart: use wedding_profiles created_at (accurate first-time signups)
      db.execute(sql`
        SELECT
          to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as date,
          count(*)::int as count
        FROM wedding_profiles
        WHERE created_at >= NOW() - INTERVAL '30 days'
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

      // Clerk as source of truth for signup counts
      clerkClient.users.getUserList({ limit: 1, orderBy: "-created_at" }),
      clerkClient.users.getUserList({ limit: 1, createdAfter: dayAgo.getTime() }),
      clerkClient.users.getUserList({ limit: 1, createdAfter: weekAgo.getTime() }),
      clerkClient.users.getUserList({ limit: 1, createdAfter: monthAgo.getTime() }),

      // Onboarded = users with a wedding profile
      db.select({ count: sql<number>`count(*)::int` }).from(weddingProfiles),
    ]);

    const countMap = Object.fromEntries(countsByType.map(r => [r.eventType, r.count]));

    const totalUsers = clerkTotal.totalCount;
    const newToday = clerkToday.totalCount;
    const newThisWeek = clerkThisWeek.totalCount;
    const newThisMonth = clerkThisMonth.totalCount;
    const onboardedCount = onboardedRow[0]?.count ?? 0;
    const onboardingRate = totalUsers > 0 ? Math.round((onboardedCount / totalUsers) * 100) : 0;
    const signupCount = totalUsers;

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
        newToday,
        newThisWeek,
        newThisMonth,
        onboardingCompletionRate: onboardingRate,
        totalSignups: signupCount,
        onboardedUsers: onboardedCount,
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

router.get("/admin/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const search = String(req.query.search ?? "").trim().toLowerCase();

    const [profileRows, eventRows] = await Promise.all([
      db.select({
        userId: weddingProfiles.userId,
        partner1Name: weddingProfiles.partner1Name,
        partner2Name: weddingProfiles.partner2Name,
        weddingDate: weddingProfiles.weddingDate,
        venue: weddingProfiles.venue,
        updatedAt: weddingProfiles.updatedAt,
      }).from(weddingProfiles),

      db.execute(sql`
        SELECT
          user_id,
          count(*)::int as event_count,
          max(timestamp) as last_active,
          bool_or(event_type = 'user_signup') as signed_up,
          bool_or(event_type = 'onboarding_completed') as onboarded,
          min(timestamp) as first_seen
        FROM analytics_events
        GROUP BY user_id
      `),
    ]);

    type EventRow = {
      user_id: string;
      event_count: number;
      last_active: string;
      signed_up: boolean;
      onboarded: boolean;
      first_seen: string;
    };

    const eventMap = new Map<string, EventRow>();
    for (const row of eventRows.rows as EventRow[]) {
      eventMap.set(row.user_id, row);
    }
    const profileMap = new Map<string, typeof profileRows[number]>();
    for (const p of profileRows) {
      if (p.userId) profileMap.set(p.userId, p);
    }

    const allUserIds = Array.from(new Set([
      ...Array.from(eventMap.keys()),
      ...Array.from(profileMap.keys()),
    ])).filter(Boolean).slice(0, 200);

    if (allUserIds.length === 0) {
      return res.json({ users: [], total: 0 });
    }

    const clerkUsers = await clerkClient.users.getUserList({
      userId: allUserIds,
      limit: 200,
    });

    const users = clerkUsers.data.map(cu => {
      const primaryEmail = cu.emailAddresses.find(e => e.id === cu.primaryEmailAddressId)?.emailAddress
        ?? cu.emailAddresses[0]?.emailAddress ?? null;
      const profile = profileMap.get(cu.id);
      const events = eventMap.get(cu.id);

      return {
        id: cu.id,
        firstName: cu.firstName ?? "",
        lastName: cu.lastName ?? "",
        email: primaryEmail,
        imageUrl: cu.imageUrl ?? null,
        joinedAt: new Date(cu.createdAt).toISOString(),
        lastActive: events?.last_active ?? null,
        eventCount: events?.event_count ?? 0,
        onboarded: events?.onboarded ?? false,
        hasProfile: !!profile,
        partner1Name: profile?.partner1Name ?? null,
        partner2Name: profile?.partner2Name ?? null,
        weddingDate: profile?.weddingDate ?? null,
        venue: profile?.venue ?? null,
      };
    });

    const filtered = search
      ? users.filter(u =>
          `${u.firstName} ${u.lastName} ${u.email} ${u.partner1Name} ${u.partner2Name}`
            .toLowerCase().includes(search)
        )
      : users;

    filtered.sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());

    res.json({ users: filtered, total: filtered.length });
  } catch (err) {
    console.error("Admin users error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/dropoffs", requireAuth, requireAdmin, async (req, res) => {
  try {
    const days = parseInt(String(req.query.days ?? "0"), 10);
    const since = days > 0 ? new Date(Date.now() - days * 86400000) : null;

    const [profileRows, clerkResponse] = await Promise.all([
      db.select({ userId: weddingProfiles.userId }).from(weddingProfiles),
      clerkClient.users.getUserList({
        limit: 500,
        orderBy: "-created_at" as Parameters<typeof clerkClient.users.getUserList>[0]["orderBy"],
        ...(since ? { createdAfter: since.getTime() } : {}),
      }),
    ]);

    const onboardedIds = new Set(profileRows.map(r => r.userId).filter(Boolean));
    const dropoffUsers = clerkResponse.data.filter(u => !onboardedIds.has(u.id));

    const dropoffIds = dropoffUsers.map(u => u.id);
    let eventRows: Array<{ user_id: string; login_count: number; last_seen: string | null }> = [];
    if (dropoffIds.length > 0) {
      const evResult = await db.execute(sql`
        SELECT
          user_id,
          count(case when event_type = 'user_login' then 1 end)::int as login_count,
          max(timestamp)::text as last_seen
        FROM analytics_events
        WHERE user_id = ANY(${dropoffIds}::text[])
        GROUP BY user_id
      `);
      eventRows = evResult.rows as typeof eventRows;
    }
    const eventMap = new Map(eventRows.map(r => [r.user_id, r]));

    const dropoffs = dropoffUsers.map(cu => {
      const email = cu.emailAddresses.find(e => e.id === cu.primaryEmailAddressId)?.emailAddress
        ?? cu.emailAddresses[0]?.emailAddress ?? null;
      const ev = eventMap.get(cu.id);
      const joinedAt = new Date(cu.createdAt);
      const daysSince = Math.floor((Date.now() - joinedAt.getTime()) / 86400000);
      return {
        id: cu.id,
        firstName: cu.firstName ?? "",
        lastName: cu.lastName ?? "",
        email,
        imageUrl: cu.imageUrl ?? null,
        joinedAt: joinedAt.toISOString(),
        daysSince,
        loginCount: ev?.login_count ?? 0,
        lastSeen: ev?.last_seen ?? null,
        neverReturned: !ev || (ev.login_count === 0),
      };
    });

    dropoffs.sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());

    const cohortMap = new Map<string, { week: string; dropoffs: number; neverReturned: number }>();
    for (const u of dropoffs) {
      const d = new Date(u.joinedAt);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - d.getDay());
      const key = d.toISOString().split("T")[0];
      const existing = cohortMap.get(key) ?? { week: key, dropoffs: 0, neverReturned: 0 };
      existing.dropoffs++;
      if (u.neverReturned) existing.neverReturned++;
      cohortMap.set(key, existing);
    }
    const cohorts = Array.from(cohortMap.values()).sort((a, b) => a.week.localeCompare(b.week));

    res.json({
      dropoffs,
      total: dropoffs.length,
      neverReturned: dropoffs.filter(u => u.neverReturned).length,
      cameBack: dropoffs.filter(u => !u.neverReturned).length,
      cohorts,
    });
  } catch (err) {
    req.log.error({ err }, "Admin dropoffs error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/admin/users/:userId", requireAuth, requireAdmin, async (req, res) => {
  const targetUserId = req.params.userId;
  if (!targetUserId) {
    res.status(400).json({ error: "Missing userId" });
    return;
  }
  if (targetUserId === req.userId) {
    res.status(400).json({ error: "You cannot delete your own admin account from here." });
    return;
  }
  try {
    let userEmails: string[] = [];
    try {
      const u = await clerkClient.users.getUser(targetUserId);
      userEmails = (u.emailAddresses ?? [])
        .map((e) => e.emailAddress?.toLowerCase().trim())
        .filter((e): e is string => !!e);
    } catch {
      userEmails = [];
    }

    await purgeUserData(targetUserId, userEmails);

    try {
      await clerkClient.users.deleteUser(targetUserId);
    } catch (err) {
      req.log.warn({ err, targetUserId }, "Clerk user delete failed (may already be gone)");
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err, targetUserId }, "Admin user delete failed");
    res.status(500).json({ error: "Failed to delete user" });
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
