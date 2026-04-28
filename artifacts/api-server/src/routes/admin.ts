import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { clerkClient } from "@clerk/express";
import {
  db, analyticsEvents, adminUsers, weddingProfiles, deletedUserArchive,
  timelines, budgets, budgetItems, budgetPaymentLogs,
  checklistItems, vendors, guests, vendorContracts, seatingCharts,
  hotelBlocks, weddingParty, manualExpenses,
} from "@workspace/db";
import { eq, gte, desc, sql, and, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { purgeUserData } from "../lib/userCleanup";
import { sendEmail, FROM_EMAIL } from "../lib/resend";
import { openai } from "@workspace/integrations-openai-ai-server";

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
      pvTodayRow, pvWeekRow, pvTotalRow, onboardingGrowthRows,
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

      // Page views
      db.select({ count: sql<number>`count(*)::int` }).from(analyticsEvents)
        .where(and(eq(analyticsEvents.eventType, "page_view"), gte(analyticsEvents.timestamp, dayAgo))),
      db.select({ count: sql<number>`count(*)::int` }).from(analyticsEvents)
        .where(and(eq(analyticsEvents.eventType, "page_view"), gte(analyticsEvents.timestamp, weekAgo))),
      db.select({ count: sql<number>`count(*)::int` }).from(analyticsEvents)
        .where(eq(analyticsEvents.eventType, "page_view")),

      // Daily onboarding completions last 30 days
      db.execute(sql`
        SELECT
          to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as date,
          count(*)::int as count
        FROM wedding_profiles
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY 1 ORDER BY 1
      `),
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
      pageViews: {
        today: pvTodayRow[0]?.count ?? 0,
        week: pvWeekRow[0]?.count ?? 0,
        total: pvTotalRow[0]?.count ?? 0,
      },
      onboardingGrowth: (onboardingGrowthRows.rows as Array<{ date: string; count: number }>).map(r => ({
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
    let clerkFirstName: string | null = null;
    let clerkLastName: string | null = null;
    try {
      const u = await clerkClient.users.getUser(targetUserId);
      userEmails = (u.emailAddresses ?? [])
        .map((e) => e.emailAddress?.toLowerCase().trim())
        .filter((e): e is string => !!e);
      clerkFirstName = u.firstName ?? null;
      clerkLastName = u.lastName ?? null;
    } catch {
      userEmails = [];
    }

    await purgeUserData(targetUserId, userEmails, { firstName: clerkFirstName, lastName: clerkLastName });

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

router.get("/admin/archive", requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await db
      .select({
        id: deletedUserArchive.id,
        userId: deletedUserArchive.userId,
        email: deletedUserArchive.email,
        firstName: deletedUserArchive.firstName,
        lastName: deletedUserArchive.lastName,
        deletedAt: deletedUserArchive.deletedAt,
        restoredAt: deletedUserArchive.restoredAt,
        restoredToUserId: deletedUserArchive.restoredToUserId,
      })
      .from(deletedUserArchive)
      .orderBy(desc(deletedUserArchive.deletedAt))
      .limit(200);
    res.json({ archives: rows });
  } catch (err) {
    req.log.error({ err }, "Admin archive list error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/archive/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [row] = await db.select().from(deletedUserArchive).where(eq(deletedUserArchive.id, id)).limit(1);
    if (!row) return res.status(404).json({ error: "Archive not found" });
    res.json({ archive: row });
  } catch (err) {
    req.log.error({ err }, "Admin archive get error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/archive/:id/restore", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid archive id" });

    const newUserId: string = req.body?.newUserId;
    if (!newUserId?.trim()) return res.status(400).json({ error: "newUserId is required" });

    const [row] = await db.select().from(deletedUserArchive).where(eq(deletedUserArchive.id, id)).limit(1);
    if (!row) return res.status(404).json({ error: "Archive not found" });
    if (row.restoredAt) return res.status(409).json({ error: "This archive has already been restored." });

    const data = row.archivedData as Record<string, unknown>;
    const restored: Record<string, number> = {};

    type ProfileRow = {
      partner1Name?: string; partner2Name?: string; weddingDate?: string;
      ceremonyTime?: string; receptionTime?: string; venue?: string;
      location?: string; venueCity?: string | null; venueState?: string | null;
      venueZip?: string | null; guestCount?: number; totalBudget?: string;
      weddingVibe?: string; preferredLanguage?: string | null;
      guestCollectionToken?: string | null; vendorBccEmail?: string | null;
    };

    let newProfileId: number | null = null;

    const profileData = data.profile as ProfileRow | null;
    if (profileData) {
      const [inserted] = await db.insert(weddingProfiles).values({
        userId: newUserId.trim(),
        partner1Name: profileData.partner1Name ?? "",
        partner2Name: profileData.partner2Name ?? "",
        weddingDate: profileData.weddingDate ?? "",
        ceremonyTime: profileData.ceremonyTime ?? "",
        receptionTime: profileData.receptionTime ?? "",
        venue: profileData.venue ?? "",
        location: profileData.location ?? "",
        venueCity: profileData.venueCity ?? null,
        venueState: profileData.venueState ?? null,
        venueZip: profileData.venueZip ?? null,
        guestCount: profileData.guestCount ?? 0,
        totalBudget: profileData.totalBudget ?? "0",
        weddingVibe: profileData.weddingVibe ?? "",
        preferredLanguage: profileData.preferredLanguage ?? "English",
        guestCollectionToken: profileData.guestCollectionToken ?? null,
        vendorBccEmail: profileData.vendorBccEmail ?? null,
      }).returning({ id: weddingProfiles.id });
      newProfileId = inserted?.id ?? null;
      restored.profile = 1;
    }

    if (newProfileId) {
      const tlRows = (data.timelines as Array<Record<string, unknown>>) ?? [];
      if (tlRows.length > 0) {
        for (const tl of tlRows) {
          await db.insert(timelines).values({ profileId: newProfileId, events: (tl.events ?? []) as never });
        }
        restored.timelines = tlRows.length;
      }

      const guestRows = (data.guests as Array<Record<string, unknown>>) ?? [];
      if (guestRows.length > 0) {
        for (const g of guestRows) {
          await db.insert(guests).values({
            profileId: newProfileId,
            firstName: String(g.firstName ?? ""),
            lastName: String(g.lastName ?? ""),
            email: g.email as string | null ?? null,
            phone: g.phone as string | null ?? null,
            rsvpStatus: (g.rsvpStatus as string) ?? "pending",
            mealChoice: g.mealChoice as string | null ?? null,
            plusOne: Boolean(g.plusOne ?? false),
            plusOneName: g.plusOneName as string | null ?? null,
            dietaryRestrictions: g.dietaryRestrictions as string | null ?? null,
            tableNumber: g.tableNumber as number | null ?? null,
            notes: g.notes as string | null ?? null,
            group: g.group as string | null ?? null,
            side: g.side as string | null ?? null,
            tags: (g.tags as string[] | null) ?? null,
          });
        }
        restored.guests = guestRows.length;
      }

      const ciRows = (data.checklistItems as Array<Record<string, unknown>>) ?? [];
      if (ciRows.length > 0) {
        for (const ci of ciRows) {
          await db.insert(checklistItems).values({
            profileId: newProfileId,
            task: String(ci.task ?? ""),
            category: String(ci.category ?? ""),
            dueDate: ci.dueDate as string | null ?? null,
            completed: Boolean(ci.completed ?? false),
            notes: ci.notes as string | null ?? null,
            monthLabel: ci.monthLabel as string | null ?? null,
          });
        }
        restored.checklistItems = ciRows.length;
      }

      const budgetRows = (data.budgets as Array<Record<string, unknown>>) ?? [];
      if (budgetRows.length > 0) {
        const [newBudget] = await db.insert(budgets).values({
          profileId: newProfileId,
          totalBudget: String(budgetRows[0]?.totalBudget ?? "0"),
        }).returning({ id: budgets.id });

        const biRows = (data.budgetItems as Array<Record<string, unknown>>) ?? [];
        if (newBudget && biRows.length > 0) {
          for (const bi of biRows) {
            await db.insert(budgetItems).values({
              budgetId: newBudget.id,
              category: String(bi.category ?? ""),
              item: String(bi.item ?? ""),
              estimatedCost: String(bi.estimatedCost ?? "0"),
              actualCost: bi.actualCost as string | null ?? null,
              paid: Boolean(bi.paid ?? false),
              vendor: bi.vendor as string | null ?? null,
              notes: bi.notes as string | null ?? null,
            });
          }
          restored.budgetItems = biRows.length;
        }
        restored.budgets = 1;
      }
    }

    const vendorRows = (data.vendors as Array<Record<string, unknown>>) ?? [];
    if (vendorRows.length > 0) {
      for (const v of vendorRows) {
        await db.insert(vendors).values({
          userId: newUserId.trim(),
          name: String(v.name ?? ""),
          category: String(v.category ?? ""),
          email: v.email as string | null ?? null,
          phone: v.phone as string | null ?? null,
          website: v.website as string | null ?? null,
          contactName: v.contactName as string | null ?? null,
          price: v.price as string | null ?? null,
          notes: v.notes as string | null ?? null,
          status: String(v.status ?? "inquiry"),
          contractSigned: Boolean(v.contractSigned ?? false),
          depositPaid: Boolean(v.depositPaid ?? false),
        });
      }
      restored.vendors = vendorRows.length;
    }

    const vcRows = (data.vendorContracts as Array<Record<string, unknown>>) ?? [];
    if (vcRows.length > 0) {
      for (const vc of vcRows) {
        await db.insert(vendorContracts).values({
          userId: newUserId.trim(),
          vendorName: String(vc.vendorName ?? ""),
          contractType: String(vc.contractType ?? ""),
          fileUrl: String(vc.fileUrl ?? ""),
          fileName: String(vc.fileName ?? ""),
          notes: vc.notes as string | null ?? null,
        });
      }
      restored.vendorContracts = vcRows.length;
    }

    const wpRows = (data.weddingParty as Array<Record<string, unknown>>) ?? [];
    if (wpRows.length > 0) {
      for (const m of wpRows) {
        await db.insert(weddingParty).values({
          userId: newUserId.trim(),
          name: String(m.name ?? ""),
          role: String(m.role ?? ""),
          side: String(m.side ?? "bride"),
          phone: m.phone as string | null ?? null,
          email: m.email as string | null ?? null,
          notes: m.notes as string | null ?? null,
        });
      }
      restored.weddingPartyMembers = wpRows.length;
    }

    await db.update(deletedUserArchive)
      .set({
        restoredAt: new Date(),
        restoredBy: req.userId ?? "admin",
        restoredToUserId: newUserId.trim(),
      })
      .where(eq(deletedUserArchive.id, id));

    res.json({ ok: true, restored });
  } catch (err) {
    req.log.error({ err }, "Admin archive restore error");
    res.status(500).json({ error: "Restore failed. Please check server logs." });
  }
});

router.post("/admin/marketing/generate", requireAuth, requireAdmin, async (req, res) => {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are the Marketing Outreach Tool inside the A.IDO Operations Center. You write warm, human, founder-led marketing emails to invite people to join A.IDO, an AI wedding planning assistant. Keep emails SHORT (under 150 words total), friendly, non-salesy, and focused on genuine value. Always sign off as Joseph, Founder of A.IDO.`,
        },
        {
          role: "user",
          content: `Generate a fresh marketing outreach email. Include:
- A compelling subject line
- Email body under 150 words that:
  • Highlights 2-3 clear benefits of A.IDO (timelines, vendor management, budgeting, AI assistance)
  • Has a clear CTA to sign up/join the beta at https://www.aidowedding.net
  • Sounds like a real person wrote it, not a marketing department
  • Ends signed by Joseph, Founder of A.IDO

Return ONLY valid JSON (no markdown, no code block): { "subject": "...", "body": "..." }`,
        },
      ],
      temperature: 0.9,
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in AI response");
    const parsed = JSON.parse(jsonMatch[0]) as { subject?: string; body?: string };
    res.json({ subject: parsed.subject ?? "", body: parsed.body ?? "" });
  } catch (err) {
    req.log.error({ err }, "Marketing generate error");
    res.status(500).json({ error: "Failed to generate template. Please try again." });
  }
});

router.post("/admin/marketing/send", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { emails, subject, body } = req.body as {
      emails: string[];
      subject: string;
      body: string;
    };

    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: "No email addresses provided." });
    }
    if (!subject?.trim() || !body?.trim()) {
      return res.status(400).json({ error: "Subject and body are required." });
    }

    const results: Array<{ email: string; ok: boolean; error?: string }> = [];

    for (const email of emails) {
      const trimmed = email.trim();
      if (!trimmed) continue;

      const r = await sendEmail({
        to: trimmed,
        fromName: "Joseph @ A.IDO",
        from: FROM_EMAIL,
        replyTo: FROM_EMAIL,
        subject: subject.trim(),
        text: body.trim(),
      });

      await db.insert(analyticsEvents).values({
        userId: req.userId ?? "admin",
        eventType: "marketing_email_sent",
        metadata: { to: trimmed, subject: subject.trim(), ok: r.ok, error: r.error ?? null },
      }).catch(() => {});

      results.push({ email: trimmed, ok: r.ok, error: r.error });
    }

    const succeeded = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok).length;
    res.json({ results, succeeded, failed });
  } catch (err) {
    req.log.error({ err }, "Marketing send error");
    res.status(500).json({ error: "Failed to send emails. Please try again." });
  }
});

export default router;
