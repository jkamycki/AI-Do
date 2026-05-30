import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { clerkClient } from "@clerk/express";
import crypto from "crypto";
import {
  db, analyticsEvents, adminUsers, weddingProfiles, deletedUserArchive,
  timelines, budgets, budgetItems, budgetPaymentLogs,
  checklistItems, vendors, guests, vendorContracts, seatingCharts,
  hotelBlocks, weddingParty, manualExpenses, vendorPayments,
  workspaceCollaborators, adminLaunchPlanItems,
  weddingWebsites, websiteRsvps, vendorPartnerApplications, vendorPartnerApplicationReplies,
} from "@workspace/db";
import { eq, gte, desc, sql, and, inArray, asc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { purgeUserData, snapshotUserData } from "../lib/userCleanup";
import {
  backupDatabase,
  downloadDatabaseBackup,
  listDatabaseBackups,
  restoreDatabaseBackup,
} from "../lib/backup";
import { sendEmail, FROM_EMAIL } from "../lib/resend";
import { trackEvent } from "../lib/trackEvent";
import { OWNER_EMAILS, isOwnerEmail } from "../lib/adminOwners";
import { openai, getModel, supportsCustomTemperature } from "@workspace/integrations-openai-ai-server";
import {
  DEFAULT_MAINTENANCE_MESSAGE,
  isMaintenanceSection,
  listMaintenanceFlags,
  upsertMaintenanceFlag,
} from "../lib/maintenance";
import { buildVendorPartnerThreadAddress, ensureVendorPartnerThreadToken, getSupportInboxAddresses } from "../lib/supportInbox";
import {
  buildVendorDirectoryListing,
  cleanVendorDirectoryListing,
  ensureVendorPartnerDirectoryColumns,
} from "../lib/vendorPartnerDirectory";

const router = Router();

const LAUNCH_PLAN_ASSIGNEES = ["kamyckijoseph@gmail.com", "michaelgang31@gmail.com"] as const;
const LAUNCH_PLAN_BOTH_ASSIGNEES = "michaelgang31@gmail.com,kamyckijoseph@gmail.com";
const LAUNCH_PLAN_ASSIGNEE_NAMES: Record<typeof LAUNCH_PLAN_ASSIGNEES[number], string> = {
  "kamyckijoseph@gmail.com": "Joseph",
  "michaelgang31@gmail.com": "Michael",
};

function getLaunchPlanAssigneeName(email: string) {
  if (email === LAUNCH_PLAN_BOTH_ASSIGNEES) return "Michael & Joseph";
  return LAUNCH_PLAN_ASSIGNEE_NAMES[email as typeof LAUNCH_PLAN_ASSIGNEES[number]] ?? email;
}

function getLaunchPlanRecipientEmails(email: string) {
  return email.split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function publicSessionRef(sessionId: string): string {
  if (/^[a-f0-9]{16}$/i.test(sessionId)) return sessionId;
  return crypto.createHash("sha256").update(sessionId).digest("hex").slice(0, 16);
}

function isAllowedLaunchPlanRecipient(email: string) {
  const recipients = getLaunchPlanRecipientEmails(email);
  return recipients.length > 0 && recipients.every(recipient =>
    LAUNCH_PLAN_ASSIGNEES.includes(recipient as typeof LAUNCH_PLAN_ASSIGNEES[number]),
  );
}

async function isAdmin(userId: string): Promise<boolean> {
  try {
    const user = await clerkClient.users.getUser(userId);
    return user.emailAddresses.some(e => isOwnerEmail(e.emailAddress));
  } catch {
    return false;
  }
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

router.get("/admin/maintenance", requireAuth, requireAdmin, async (_req, res) => {
  try {
    res.json({ flags: await listMaintenanceFlags(), defaultMessage: DEFAULT_MAINTENANCE_MESSAGE });
  } catch (err) {
    res.status(500).json({ error: "Failed to load maintenance settings" });
  }
});

router.put("/admin/maintenance/:section", requireAuth, requireAdmin, async (req, res) => {
  try {
    const section = String(req.params.section ?? "");
    if (!isMaintenanceSection(section)) {
      return res.status(400).json({ error: "Unknown maintenance section" });
    }

    const enabled = Boolean(req.body?.enabled);
    const rawMessage = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const message = rawMessage.slice(0, 240) || DEFAULT_MAINTENANCE_MESSAGE;
    const rawExpiresAt = typeof req.body?.expiresAt === "string" ? req.body.expiresAt : null;
    const expiresAt = rawExpiresAt ? new Date(rawExpiresAt) : null;
    const safeExpiresAt = expiresAt && Number.isFinite(expiresAt.getTime()) ? expiresAt : null;

    const flag = await upsertMaintenanceFlag({
      section,
      enabled,
      message,
      expiresAt: enabled ? safeExpiresAt : null,
      updatedBy: req.userId ?? null,
    });

    res.json({ flag, flags: await listMaintenanceFlags() });
  } catch (err) {
    req.log.error({ err }, "Maintenance setting save error");
    res.status(500).json({ error: "Failed to save maintenance settings" });
  }
});

router.get("/admin/backups", requireAuth, requireAdmin, async (_req, res) => {
  try {
    res.json({ backups: await listDatabaseBackups() });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to list database backups" });
  }
});

router.post("/admin/backups/run", requireAuth, requireAdmin, async (req, res) => {
  try {
    const reason = typeof req.body?.reason === "string" && req.body.reason.trim()
      ? req.body.reason.trim().slice(0, 80)
      : "manual";
    const result = await backupDatabase({ reason });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Manual database backup failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to run database backup" });
  }
});

router.get("/admin/backups/download", requireAuth, requireAdmin, async (req, res) => {
  try {
    const key = typeof req.query.key === "string" ? req.query.key : "";
    const backup = await downloadDatabaseBackup(key);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${key.split("/").pop()?.replace(/\.gz$/, "") || "aido-backup.json"}"`);
    res.json(backup);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to download database backup" });
  }
});

router.post("/admin/backups/restore", requireAuth, requireAdmin, async (req, res) => {
  try {
    const key = typeof req.body?.key === "string" ? req.body.key : "";
    const confirm = typeof req.body?.confirm === "string" ? req.body.confirm.trim() : "";
    if (confirm !== "RESTORE DATABASE") {
      return res.status(400).json({ error: "Type RESTORE DATABASE to confirm this destructive restore." });
    }

    await backupDatabase({ reason: "pre-restore-safety" });
    const result = await restoreDatabaseBackup(key);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Database restore failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to restore database backup" });
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
        .where(and(eq(analyticsEvents.eventType, "user_login"), gte(analyticsEvents.timestamp, dayAgo))),

      db.select({ count: sql<number>`count(distinct user_id)::int` })
        .from(analyticsEvents)
        .where(and(eq(analyticsEvents.eventType, "user_login"), gte(analyticsEvents.timestamp, weekAgo))),

      db.select({ count: sql<number>`count(distinct user_id)::int` })
        .from(analyticsEvents)
        .where(and(eq(analyticsEvents.eventType, "user_login"), gte(analyticsEvents.timestamp, monthAgo))),

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
      clerkClient.users.getUserList({ limit: 1, createdAtAfter: dayAgo.getTime() }),
      clerkClient.users.getUserList({ limit: 1, createdAtAfter: weekAgo.getTime() }),
      clerkClient.users.getUserList({ limit: 1, createdAtAfter: monthAgo.getTime() }),

      // Onboarded = users who either created a profile or accepted access to
      // a shared workspace. Collaborator-only users may not own a profile.
      db.execute(sql`
        SELECT count(DISTINCT user_id)::int AS count
        FROM (
          SELECT user_id
          FROM wedding_profiles
          WHERE user_id IS NOT NULL
          UNION
          SELECT invitee_user_id AS user_id
          FROM workspace_collaborators
          WHERE status = 'active' AND invitee_user_id IS NOT NULL
        ) onboarded_users
      `),

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
          to_char(date_trunc('day', completed_at), 'YYYY-MM-DD') as date,
          count(*)::int as count
        FROM (
          SELECT created_at AS completed_at
          FROM wedding_profiles
          WHERE created_at >= NOW() - INTERVAL '30 days'
          UNION ALL
          SELECT accepted_at AS completed_at
          FROM workspace_collaborators
          WHERE status = 'active'
            AND invitee_user_id IS NOT NULL
            AND accepted_at >= NOW() - INTERVAL '30 days'
        ) onboarding_events
        GROUP BY 1 ORDER BY 1
      `),
    ]);

    const countMap = Object.fromEntries(countsByType.map(r => [r.eventType, r.count]));

    const totalUsers = clerkTotal.totalCount;
    const newToday = clerkToday.totalCount;
    const newThisWeek = clerkThisWeek.totalCount;
    const newThisMonth = clerkThisMonth.totalCount;
    const onboardedCount = Number((onboardedRow.rows?.[0] as { count?: number } | undefined)?.count ?? 0);
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
    req.log.error(err, "Admin metrics error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/events", requireAuth, requireAdmin, async (req, res) => {
  try {
    const perUserLimit = 20;
    const eventsResult = await db.execute(sql`
      WITH ranked_events AS (
        SELECT
          id,
          user_id,
          event_type,
          timestamp,
          metadata,
          row_number() OVER (
            PARTITION BY user_id
            ORDER BY timestamp DESC, id DESC
          ) AS event_rank
        FROM analytics_events
      )
      SELECT
        id,
        user_id AS "userId",
        event_type AS "eventType",
        timestamp,
        metadata
      FROM ranked_events
      WHERE event_rank <= ${perUserLimit}
      ORDER BY timestamp DESC, id DESC
    `);

    const events = (eventsResult.rows as Array<{
      id: number;
      userId: string;
      eventType: string;
      timestamp: Date | string;
      metadata: Record<string, unknown> | null;
    }>);
    const total = events.length;

    const clerkUserIds = Array.from(new Set(
      events
        .map(event => event.userId)
        .filter(userId => userId && !userId.startsWith("anonymous:") && !userId.startsWith("visitor_")),
    )).slice(0, 100);

    const clerkUserMap = new Map<string, { email: string | null; displayName: string | null }>();
    if (clerkUserIds.length > 0) {
      try {
        const clerkUsers = await clerkClient.users.getUserList({
          userId: clerkUserIds,
          limit: clerkUserIds.length,
        });
        for (const user of clerkUsers.data) {
          const primaryEmail =
            user.emailAddresses.find(email => email.id === user.primaryEmailAddressId)?.emailAddress ??
            user.emailAddresses[0]?.emailAddress ??
            null;
          const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || null;
          clerkUserMap.set(user.id, {
            email: primaryEmail,
            displayName,
          });
        }
      } catch (clerkErr) {
        req.log.warn({ err: clerkErr }, "Could not resolve Clerk users for event log");
      }
    }

    res.json({
      events: events.map(e => {
        const user = clerkUserMap.get(e.userId);
        const metadataEmail = typeof e.metadata?.email === "string" ? e.metadata.email : null;
        const userEmail =
          user?.email ??
          metadataEmail ??
          (e.userId.startsWith("anonymous:") ? "Anonymous / guest session" : null);
        const userDisplayName =
          user?.displayName ??
          (e.userId.startsWith("anonymous:") ? "Anonymous / guest session" : null);
        return {
          ...e,
          userEmail,
          userDisplayName,
          userLogin: userEmail ?? e.userId,
          timestamp: e.timestamp instanceof Date ? e.timestamp.toISOString() : new Date(e.timestamp).toISOString(),
        };
      }),
      total,
      page: 1,
      pages: 1,
      perUserLimit,
    });
  } catch (err) {
    req.log.error(err, "Admin events error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/test-sessions", requireAuth, requireAdmin, async (req, res) => {
  try {
    const mode = String(req.query.mode ?? "test");
    const where =
      mode === "real"
        ? sql`WHERE test_mode = false`
        : mode === "all"
          ? sql``
          : sql`WHERE test_mode = true`;

    const rows = await db.execute(sql`
      WITH grouped AS (
        SELECT
          session_id,
          bool_or(test_mode) as test_mode,
          min(created_at) as created_at,
          max(last_active_at) as last_active_at,
          count(*)::int as total_events,
          array_remove(array_agg(DISTINCT metadata->>'path') FILTER (WHERE event = 'page_view'), NULL) as pages_visited,
          array_remove(array_agg(DISTINCT event) FILTER (
            WHERE event ILIKE '%wizard%'
               OR metadata->>'path' ILIKE '%profile%'
               OR metadata->>'path' ILIKE '%invitation%'
               OR metadata->>'path' ILIKE '%website-editor%'
          ), NULL) as wizards_used,
          count(*) FILTER (WHERE event = 'client_error' OR event ILIKE '%error%')::int as errors_encountered,
          count(*) FILTER (WHERE event = 'page_view')::int as page_view_count,
          count(*) FILTER (WHERE metadata->>'path' ILIKE '%profile%')::int as profile_visits,
          count(*) FILTER (WHERE metadata->>'path' ILIKE '%guests%')::int as guest_visits,
          count(*) FILTER (WHERE metadata->>'path' ILIKE '%invitation%')::int as invitation_visits,
          count(*) FILTER (WHERE metadata->>'path' ILIKE '%website-editor%')::int as website_visits
        FROM anonymous_sessions
        ${where}
        GROUP BY session_id
      )
      SELECT *
      FROM grouped
      ORDER BY last_active_at DESC
      LIMIT 200
    `);

    const sessions = (rows.rows as Array<{
      session_id: string;
      test_mode: boolean;
      created_at: string | Date;
      last_active_at: string | Date;
      total_events: number;
      pages_visited: string[] | null;
      wizards_used: string[] | null;
      errors_encountered: number;
      page_view_count: number;
      profile_visits: number;
      guest_visits: number;
      invitation_visits: number;
      website_visits: number;
    }>).map((row) => ({
      sessionId: publicSessionRef(row.session_id),
      testMode: row.test_mode,
      createdAt: new Date(row.created_at).toISOString(),
      lastActiveAt: new Date(row.last_active_at).toISOString(),
      totalEvents: row.total_events,
      workflowProgress: {
        pageViews: row.page_view_count,
        profileVisits: row.profile_visits,
        guestListVisits: row.guest_visits,
        invitationStudioVisits: row.invitation_visits,
        websiteEditorVisits: row.website_visits,
      },
      pagesVisited: row.pages_visited ?? [],
      wizardsUsed: row.wizards_used ?? [],
      errorsEncountered: row.errors_encountered,
    }));

    res.json({ sessions, mode });
  } catch (err) {
    req.log.error(err, "Admin test sessions error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/vendor-partner-applications", requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureVendorPartnerDirectoryColumns();
    const applications = await db
      .select()
      .from(vendorPartnerApplications)
      .orderBy(desc(vendorPartnerApplications.createdAt));
    const applicationIds = applications.map((application) => application.id);
    const replies = applicationIds.length
      ? await db
        .select()
        .from(vendorPartnerApplicationReplies)
        .where(inArray(vendorPartnerApplicationReplies.applicationId, applicationIds))
        .orderBy(asc(vendorPartnerApplicationReplies.createdAt))
      : [];
    const repliesByApplication = new Map<number, typeof replies>();
    for (const reply of replies) {
      const list = repliesByApplication.get(reply.applicationId) ?? [];
      list.push(reply);
      repliesByApplication.set(reply.applicationId, list);
    }
    res.json({
      applications: applications.map((application) => ({
        ...application,
        replies: repliesByApplication.get(application.id) ?? [],
      })),
    });
  } catch (err) {
    req.log.error(err, "Failed to list vendor partner applications");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/admin/vendor-partner-applications/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureVendorPartnerDirectoryColumns();
    const id = Number(req.params.id);
    const status = typeof req.body?.status === "string" ? req.body.status.trim() : "";
    const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : undefined;
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid application id" });
      return;
    }
    if (!["new", "reviewing", "approved", "declined"].includes(status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }
    const [updated] = await db
      .update(vendorPartnerApplications)
      .set({
        status,
        ...(notes !== undefined ? { notes: notes || null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(vendorPartnerApplications.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Application not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error(err, "Failed to update vendor partner application");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/admin/vendor-partner-applications/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureVendorPartnerDirectoryColumns();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid application id" });
      return;
    }

    const [application] = await db
      .select({ id: vendorPartnerApplications.id, directoryStatus: vendorPartnerApplications.directoryStatus })
      .from(vendorPartnerApplications)
      .where(eq(vendorPartnerApplications.id, id))
      .limit(1);
    if (!application) {
      res.status(404).json({ error: "Application not found" });
      return;
    }
    if (application.directoryStatus === "published") {
      res.status(409).json({ error: "Unpublish this partner listing before deleting the intake." });
      return;
    }

    await db
      .delete(vendorPartnerApplicationReplies)
      .where(eq(vendorPartnerApplicationReplies.applicationId, id));
    await db
      .delete(vendorPartnerApplications)
      .where(eq(vendorPartnerApplications.id, id));

    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "Failed to delete vendor partner application");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/admin/vendor-partner-applications/:id/directory-listing", requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureVendorPartnerDirectoryColumns();
    const id = Number(req.params.id);
    const directoryStatus = typeof req.body?.directoryStatus === "string" ? req.body.directoryStatus.trim() : "draft";
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid application id" });
      return;
    }
    if (!["draft", "published", "unpublished"].includes(directoryStatus)) {
      res.status(400).json({ error: "Invalid directory status" });
      return;
    }

    const [application] = await db
      .select()
      .from(vendorPartnerApplications)
      .where(eq(vendorPartnerApplications.id, id))
      .limit(1);
    if (!application) {
      res.status(404).json({ error: "Application not found" });
      return;
    }

    const currentListing = application.directoryListing && Object.keys(application.directoryListing).length
      ? application.directoryListing
      : buildVendorDirectoryListing(application);
    const directoryListing = cleanVendorDirectoryListing(req.body?.directoryListing ?? currentListing, application);
    const [updated] = await db
      .update(vendorPartnerApplications)
      .set({
        directoryListing,
        directoryStatus,
        directoryPublishedAt: directoryStatus === "published" ? new Date() : application.directoryPublishedAt,
        status: directoryStatus === "published" && application.status !== "approved" ? "approved" : application.status,
        updatedAt: new Date(),
      })
      .where(eq(vendorPartnerApplications.id, id))
      .returning();

    res.json({
      ...updated,
      directoryListing,
    });
  } catch (err) {
    req.log.error(err, "Failed to update vendor partner directory listing");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/vendor-partner-applications/:id/reply", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const replyText = typeof req.body?.replyText === "string" ? req.body.replyText.trim() : "";
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid application id" });
      return;
    }
    if (!replyText) {
      res.status(400).json({ error: "Reply text is required" });
      return;
    }
    const [application] = await db
      .select()
      .from(vendorPartnerApplications)
      .where(eq(vendorPartnerApplications.id, id))
      .limit(1);
    if (!application) {
      res.status(404).json({ error: "Application not found" });
      return;
    }

    const supportAddress = getSupportInboxAddresses()[0] ?? FROM_EMAIL;
    const threadToken = await ensureVendorPartnerThreadToken(id);
    const replyToAddress = threadToken ? buildVendorPartnerThreadAddress(id, threadToken) : supportAddress;
    const result = await sendEmail({
      to: application.email,
      replyTo: replyToAddress,
      subject: `Re: A.I DO Vendor Partner Application`,
      text: [
        replyText,
        "",
        "- A.I DO Vendor Partnerships",
      ].join("\n"),
    });

    if (!result.ok) {
      req.log.error({ error: result.error, applicationId: id }, "Failed to send vendor partner reply");
      res.status(502).json({ error: "Email delivery failed." });
      return;
    }

    const [reply] = await db
      .insert(vendorPartnerApplicationReplies)
      .values({
        applicationId: id,
        direction: "outbound",
        body: replyText,
        senderUserId: req.userId ?? null,
        senderEmail: supportAddress,
        senderName: "A.I DO Vendor Partnerships",
      })
      .returning();

    await db
      .update(vendorPartnerApplications)
      .set({ status: application.status === "new" ? "reviewing" : application.status, updatedAt: new Date() })
      .where(eq(vendorPartnerApplications.id, id));

    res.json({ success: true, reply });
  } catch (err) {
    req.log.error(err, "Failed to reply to vendor partner application");
    res.status(500).json({ error: "Internal server error" });
  }
});

const defaultLaunchPlanItems = [
  {
    title: "Confirm A.IDO launch promise and audience",
    category: "Brand",
    notes: "Lock the short positioning statement, who launch is for, and the main conversion CTA.",
    assigneeEmail: "kamyckijoseph@gmail.com",
    priority: "high",
    dueDate: null,
    completed: false,
  },
  {
    title: "Run full signup and onboarding QA",
    category: "Product",
    notes: "Test a fresh account on mobile and desktop from signup through wedding profile, budget, vendors, contracts, guests, website, and Aria.",
    assigneeEmail: "michaelgang31@gmail.com",
    priority: "high",
    dueDate: null,
    completed: false,
  },
  {
    title: "Verify published website and share previews",
    category: "Product",
    notes: "Check social preview images, QR codes, published website links, and invitation link behavior before public launch.",
    assigneeEmail: "kamyckijoseph@gmail.com",
    priority: "medium",
    dueDate: null,
    completed: false,
  },
  {
    title: "Prepare first-user support workflow",
    category: "Operations",
    notes: "Make sure feedback prompts, support tickets, and Operations Center messages are monitored daily.",
    assigneeEmail: "michaelgang31@gmail.com",
    priority: "medium",
    dueDate: null,
    completed: false,
  },
  {
    title: "Review privacy, security, and AI disclaimer copy",
    category: "Trust",
    notes: "Confirm contract analyzer and Aria disclaimers clearly say AI-generated guidance is not legal advice.",
    assigneeEmail: "kamyckijoseph@gmail.com",
    priority: "high",
    dueDate: null,
    completed: false,
  },
  {
    title: "Create launch outreach list",
    category: "Marketing",
    notes: "Prepare warm contacts, wedding vendors, planners, social posts, and launch announcement copy.",
    assigneeEmail: "michaelgang31@gmail.com",
    priority: "medium",
    dueDate: null,
    completed: false,
  },
  {
    title: "Set launch metrics to watch",
    category: "Analytics",
    notes: "Track signups, onboarding completion, feature usage, support issues, and conversion from landing page to account.",
    assigneeEmail: "kamyckijoseph@gmail.com",
    priority: "medium",
    dueDate: null,
    completed: false,
  },
];

function normalizeLaunchPlanItems(items: unknown) {
  if (!Array.isArray(items)) return defaultLaunchPlanItems;

  const normalized = items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const title = String(row.title ?? "").trim();
      if (!title) return null;
      const assigneeEmail = String(row.assigneeEmail ?? row.assignee_email ?? "").trim().toLowerCase();
      const priority = String(row.priority ?? "medium").trim().toLowerCase();
      const dueDate = String(row.dueDate ?? row.due_date ?? "").trim();
      return {
        title: title.slice(0, 140),
        category: String(row.category ?? "Launch").trim().slice(0, 40) || "Launch",
        notes: String(row.notes ?? "").trim().slice(0, 500),
        assigneeEmail: isAllowedLaunchPlanRecipient(assigneeEmail) ? assigneeEmail : "",
        priority: ["low", "medium", "high"].includes(priority) ? priority : "medium",
        dueDate: /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : null,
        completed: Boolean(row.completed ?? row.isCompleted),
      };
    })
    .filter((item): item is {
      title: string;
      category: string;
      notes: string;
      assigneeEmail: string;
      priority: string;
      dueDate: string | null;
      completed: boolean;
    } => item !== null);

  return normalized.length > 0 ? normalized.slice(0, 20) : defaultLaunchPlanItems;
}

function serializeLaunchPlanItem(item: typeof adminLaunchPlanItems.$inferSelect) {
  return {
    id: String(item.id),
    title: item.title,
    category: item.category,
    notes: item.notes,
    assigneeEmail: item.assigneeEmail,
    priority: item.priority,
    dueDate: item.dueDate,
    completed: item.isCompleted,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

router.get("/admin/launch-plan", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const rows = await db.select()
      .from(adminLaunchPlanItems)
      .orderBy(adminLaunchPlanItems.sortOrder, adminLaunchPlanItems.id);

    res.json({
      items: rows.length > 0
        ? rows.map(serializeLaunchPlanItem)
        : defaultLaunchPlanItems.map((item, index) => ({
          id: `starter-${index + 1}`,
          title: item.title,
          category: item.category,
          notes: item.notes,
          assigneeEmail: item.assigneeEmail,
          priority: item.priority,
          dueDate: item.dueDate,
          completed: false,
        })),
      assignees: LAUNCH_PLAN_ASSIGNEES,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load launch plan." });
  }
});

router.put("/admin/launch-plan", requireAuth, requireAdmin, async (req, res) => {
  try {
    const rawItems = (req.body as { items?: unknown })?.items;
    const normalized = Array.isArray(rawItems) && rawItems.length === 0 ? [] : normalizeLaunchPlanItems(rawItems ?? []);

    await db.delete(adminLaunchPlanItems);
    if (normalized.length > 0) {
      await db.insert(adminLaunchPlanItems).values(normalized.map((item, index) => ({
        title: item.title,
        category: item.category,
        notes: item.notes,
        assigneeEmail: item.assigneeEmail,
        priority: item.priority,
        dueDate: item.dueDate,
        isCompleted: item.completed,
        completedAt: item.completed ? new Date() : null,
        sortOrder: index,
        updatedAt: new Date(),
      })));
    }

    const rows = await db.select()
      .from(adminLaunchPlanItems)
      .orderBy(adminLaunchPlanItems.sortOrder, adminLaunchPlanItems.id);

    res.json({ items: rows.map(serializeLaunchPlanItem), assignees: LAUNCH_PLAN_ASSIGNEES });
  } catch (err) {
    req.log.error({ err }, "Launch plan save error");
    res.status(500).json({ error: "Failed to save launch plan." });
  }
});

router.post("/admin/launch-plan/generate", requireAuth, requireAdmin, async (req, res) => {
  try {
    const focus = String((req.body as { focus?: unknown })?.focus ?? "").trim().slice(0, 800);
    const currentItems = Array.isArray((req.body as { currentItems?: unknown })?.currentItems)
      ? ((req.body as { currentItems: unknown[] }).currentItems)
        .slice(0, 25)
        .map(item => {
          if (!item || typeof item !== "object") return null;
          const row = item as Record<string, unknown>;
          return {
            title: String(row.title ?? "").slice(0, 140),
            category: String(row.category ?? "").slice(0, 40),
            completed: Boolean(row.completed),
          };
        })
        .filter(Boolean)
      : [];

    const model = getModel();
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: `You are the A.IDO Operations Center launch-planning assistant. Generate practical launch checklist items for A.IDO, an AI wedding planner assistant. Keep tasks specific, founder/operator friendly, and focused on product QA, conversion, trust, support, marketing, analytics, and launch operations. Return valid JSON only.`,
        },
        {
          role: "user",
          content: `Create a launch checklist for A.IDO.

Focus from the admin:
${focus || "A complete public launch plan for the AI wedding planning assistant."}

Existing checklist summary:
${JSON.stringify(currentItems)}

Return ONLY this JSON shape:
{"items":[{"title":"short checklist task","category":"Brand|Product|Operations|Marketing|Trust|Analytics|Support","notes":"editable note with next action","assigneeEmail":"kamyckijoseph@gmail.com|michaelgang31@gmail.com","priority":"low|medium|high","dueDate":null}]}

Generate 10 to 16 items. Split ownership between the two allowed assignee emails. Do not include markdown.`,
        },
      ],
      ...(supportsCustomTemperature(model) ? { temperature: 0.7 } : {}),
      max_completion_tokens: 1400,
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in launch plan response");
    const parsed = JSON.parse(jsonMatch[0]) as { items?: unknown };
    res.json({ items: normalizeLaunchPlanItems(parsed.items), source: "ai" });
  } catch (err) {
    req.log.error({ err }, "Launch plan generate error");
    res.json({ items: defaultLaunchPlanItems, source: "fallback" });
  }
});

router.post("/admin/launch-plan/send-task", requireAuth, requireAdmin, async (req, res) => {
  try {
    const body = req.body as { recipientEmail?: unknown; task?: Record<string, unknown> };
    const recipientEmail = String(body.recipientEmail ?? "").trim().toLowerCase();
    if (!isAllowedLaunchPlanRecipient(recipientEmail)) {
      return res.status(400).json({ error: "Choose Joseph, Michael, or Michael & Joseph as the task email recipient." });
    }
    const recipientEmails = getLaunchPlanRecipientEmails(recipientEmail);

    const task = body.task && typeof body.task === "object" ? body.task : {};
    const title = String(task.title ?? "").trim().slice(0, 140);
    if (!title) return res.status(400).json({ error: "Task title is required before emailing." });

    const category = String(task.category ?? "Launch").trim().slice(0, 40) || "Launch";
    const notes = String(task.notes ?? "").trim().slice(0, 500);
    const dueDate = String(task.dueDate ?? "").trim();
    const priority = String(task.priority ?? "medium").trim().toLowerCase();
    const assigneeEmail = String(task.assigneeEmail ?? "").trim().toLowerCase();
    const assigneeName = isAllowedLaunchPlanRecipient(assigneeEmail)
      ? getLaunchPlanAssigneeName(assigneeEmail)
      : "Unassigned";
    const completed = Boolean(task.completed);

    const lines = [
      "A.IDO Launch Plan Task",
      "",
      `Task: ${title}`,
      `Category: ${category}`,
      `Assigned to: ${assigneeName}`,
      `Priority: ${["low", "medium", "high"].includes(priority) ? priority : "medium"}`,
      `Due date: ${/^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : "Not set"}`,
      `Status: ${completed ? "Completed" : "Open"}`,
      "",
      "Notes:",
      notes || "No notes added.",
      "",
      "Open the A.IDO Operations Center to update this task.",
    ];

    const result = await sendEmail({
      to: recipientEmails,
      from: FROM_EMAIL,
      fromName: "A.IDO Operations Center",
      subject: `A.IDO Launch Task: ${title}`,
      text: lines.join("\n"),
    });

    if (!result.ok) {
      req.log.error({ error: result.error }, "Launch plan task email failed");
      return res.status(502).json({ error: result.error ?? "Could not send launch task email." });
    }

    res.json({ success: true, id: result.id });
  } catch (err) {
    req.log.error({ err }, "Launch plan send task error");
    res.status(500).json({ error: "Could not send launch task email." });
  }
});

router.get("/admin/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const search = String(req.query.search ?? "").trim().toLowerCase();

    const [profileRows, collaboratorRows, eventRows, archiveRows] = await Promise.all([
      db.select({
        userId: weddingProfiles.userId,
        profileId: weddingProfiles.id,
        partner1Name: weddingProfiles.partner1Name,
        partner2Name: weddingProfiles.partner2Name,
        weddingDate: weddingProfiles.weddingDate,
        venue: weddingProfiles.venue,
        updatedAt: weddingProfiles.updatedAt,
      }).from(weddingProfiles),

      db.select({
        userId: workspaceCollaborators.inviteeUserId,
        inviteeEmail: workspaceCollaborators.inviteeEmail,
        role: workspaceCollaborators.role,
        acceptedAt: workspaceCollaborators.acceptedAt,
        profileId: workspaceCollaborators.profileId,
        ownerUserId: weddingProfiles.userId,
        workstationName: weddingProfiles.workstationName,
        partner1Name: weddingProfiles.partner1Name,
        partner2Name: weddingProfiles.partner2Name,
      })
        .from(workspaceCollaborators)
        .innerJoin(weddingProfiles, eq(workspaceCollaborators.profileId, weddingProfiles.id))
        .where(and(
          eq(workspaceCollaborators.status, "active"),
          sql`${workspaceCollaborators.inviteeUserId} IS NOT NULL`
        )),

      db.execute(sql`
        SELECT
          user_id,
          count(*)::int as event_count,
          max(timestamp) as last_active,
          bool_or(event_type = 'user_signup') as signed_up,
          bool_or(event_type = 'onboarding_completed') as onboarded,
          min(timestamp) as first_seen,
          lower(coalesce(
            max(nullif(metadata->>'email', '')),
            max(nullif(metadata->>'userEmail', '')),
            max(nullif(metadata->>'userLogin', '')),
            max(nullif(metadata->>'login', ''))
          )) as email
        FROM analytics_events
        GROUP BY user_id
      `),

      db.select({
        id: deletedUserArchive.id,
        userId: deletedUserArchive.userId,
        email: deletedUserArchive.email,
        firstName: deletedUserArchive.firstName,
        lastName: deletedUserArchive.lastName,
        deletedAt: deletedUserArchive.deletedAt,
        archivedData: deletedUserArchive.archivedData,
      })
        .from(deletedUserArchive)
        .where(and(
          sql`${deletedUserArchive.restoredAt} IS NULL`,
          gte(deletedUserArchive.deletedAt, sql`NOW() - INTERVAL '7 days'`),
        )),
    ]);

    type EventRow = {
      user_id: string;
      event_count: number;
      last_active: string;
      signed_up: boolean;
      onboarded: boolean;
      first_seen: string;
      email: string | null;
    };

    const eventMap = new Map<string, EventRow>();
    const eventEmailMap = new Map<string, EventRow>();
    for (const row of eventRows.rows as EventRow[]) {
      eventMap.set(row.user_id, row);
      if (row.email && !eventEmailMap.has(row.email)) eventEmailMap.set(row.email, row);
    }
    const profileMap = new Map<string, typeof profileRows[number]>();
    for (const p of profileRows) {
      if (p.userId) profileMap.set(p.userId, p);
    }
    const collaboratorMap = new Map<string, typeof collaboratorRows[number]>();
    for (const c of collaboratorRows) {
      if (c.userId && !collaboratorMap.has(c.userId)) collaboratorMap.set(c.userId, c);
    }

    const allUserIds = Array.from(new Set([
      ...Array.from(eventMap.keys()),
      ...Array.from(profileMap.keys()),
      ...Array.from(collaboratorMap.keys()),
      ...collaboratorRows.map(c => c.ownerUserId).filter(Boolean),
    ].filter((id): id is string => typeof id === "string" && id.length > 0 && id.startsWith("user_")))).slice(0, 500);

    const clerkUsersById = new Map<string, Awaited<ReturnType<typeof clerkClient.users.getUserList>>["data"][number]>();
    const clerkPageSize = 500;
    const maxClerkUsers = 5000;
    for (let offset = 0; offset < maxClerkUsers; offset += clerkPageSize) {
      const page = await clerkClient.users.getUserList({
        limit: clerkPageSize,
        offset,
        orderBy: "-created_at",
      });
      for (const cu of page.data) {
        clerkUsersById.set(cu.id, cu);
      }
      if (page.data.length < clerkPageSize) break;
    }

    const missingUserIds = allUserIds.filter(userId => !clerkUsersById.has(userId));
    for (let index = 0; index < missingUserIds.length; index += 100) {
      const batch = missingUserIds.slice(index, index + 100);
      const resolvedClerkUsers = await clerkClient.users.getUserList({
        userId: batch,
        limit: batch.length,
      });
      for (const cu of resolvedClerkUsers.data) {
        clerkUsersById.set(cu.id, cu);
      }
    }

    const clerkUsers = Array.from(clerkUsersById.values());
    const clerkUserMap = new Map(clerkUsers.map(cu => {
      const primaryEmail = cu.emailAddresses.find(e => e.id === cu.primaryEmailAddressId)?.emailAddress
        ?? cu.emailAddresses[0]?.emailAddress ?? null;
      return [cu.id, {
        id: cu.id,
        firstName: cu.firstName ?? "",
        lastName: cu.lastName ?? "",
        email: primaryEmail,
      }];
    }));

    const displayFromClerk = (userId: string | null | undefined, fallbackEmail?: string | null) => {
      const related = userId ? clerkUserMap.get(userId) : null;
      const name = `${related?.firstName ?? ""} ${related?.lastName ?? ""}`.trim();
      return name || related?.email || fallbackEmail || "Unknown";
    };
    const workspaceName = (row: typeof collaboratorRows[number]) =>
      row.workstationName || [row.partner2Name, row.partner1Name].filter(Boolean).join(" & ") || "Shared workspace";

    const users = clerkUsers.map(cu => {
      const primaryEmail = cu.emailAddresses.find(e => e.id === cu.primaryEmailAddressId)?.emailAddress
        ?? cu.emailAddresses[0]?.emailAddress ?? null;
      const profile = profileMap.get(cu.id);
      const collaborator = collaboratorMap.get(cu.id);
      const events = eventMap.get(cu.id) ?? (primaryEmail ? eventEmailMap.get(primaryEmail.toLowerCase()) : undefined);
      const onboarded = Boolean(events?.onboarded || profile || collaborator);
      const sharedWith = collaboratorRows
        .filter(c => c.userId === cu.id || c.ownerUserId === cu.id)
        .map(c => {
          const isCollaborator = c.userId === cu.id;
          const relatedUserId = isCollaborator ? c.ownerUserId : c.userId;
          return {
            profileId: c.profileId,
            userId: relatedUserId ?? null,
            email: isCollaborator ? clerkUserMap.get(c.ownerUserId ?? "")?.email ?? null : c.inviteeEmail,
            displayName: displayFromClerk(relatedUserId, isCollaborator ? null : c.inviteeEmail),
            role: c.role,
            direction: isCollaborator ? "joined" : "shared_to",
            workspaceName: workspaceName(c),
            acceptedAt: c.acceptedAt?.toISOString() ?? null,
          };
        });

      return {
        id: cu.id,
        firstName: cu.firstName ?? "",
        lastName: cu.lastName ?? "",
        email: primaryEmail,
        imageUrl: cu.imageUrl ?? null,
        joinedAt: new Date(cu.createdAt).toISOString(),
        lastActive: events?.last_active ?? collaborator?.acceptedAt?.toISOString() ?? null,
        eventCount: events?.event_count ?? 0,
        onboarded,
        hasProfile: !!profile,
        hasSharedWorkspace: Boolean(collaborator || sharedWith.length > 0),
        collaboratorRole: collaborator?.role ?? null,
        partner1Name: profile?.partner1Name ?? null,
        partner2Name: profile?.partner2Name ?? null,
        weddingDate: profile?.weddingDate ?? null,
        venue: profile?.venue ?? null,
        sharedWith,
        isDeleted: false,
        deletedAt: null,
      };
    });

    const activeEmails = new Set(
      clerkUsers
        .map(cu => {
          const primaryEmail = cu.emailAddresses.find(e => e.id === cu.primaryEmailAddressId)?.emailAddress
            ?? cu.emailAddresses[0]?.emailAddress ?? null;
          return primaryEmail?.trim().toLowerCase() || null;
        })
        .filter((email): email is string => Boolean(email))
    );

    const latestArchiveRows = Array.from(
      [...archiveRows]
        .sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime())
        .reduce((map, row) => {
          const key = row.email?.trim().toLowerCase() || row.userId;
          if (!map.has(key)) map.set(key, row);
          return map;
        }, new Map<string, typeof archiveRows[number]>())
        .values()
    );

    const deletedUsers = latestArchiveRows
      .filter(row => !clerkUsersById.has(row.userId) && !activeEmails.has(row.email?.trim().toLowerCase() || ""))
      .map(row => {
        const archived = asRecord(row.archivedData);
        const profile = asRecord(archived.profile);
        return {
          id: row.userId,
          firstName: row.firstName ?? "",
          lastName: row.lastName ?? "",
          email: row.email,
          imageUrl: null,
          joinedAt: new Date(row.deletedAt).toISOString(),
          lastActive: new Date(row.deletedAt).toISOString(),
          eventCount: Array.isArray(archived.analyticsEvents) ? archived.analyticsEvents.length : 0,
          onboarded: Boolean(profile.id),
          hasProfile: Boolean(profile.id),
          hasSharedWorkspace: false,
          collaboratorRole: null,
          partner1Name: typeof profile.partner1Name === "string" ? profile.partner1Name : null,
          partner2Name: typeof profile.partner2Name === "string" ? profile.partner2Name : null,
          weddingDate: typeof profile.weddingDate === "string" ? profile.weddingDate : null,
          venue: typeof profile.venue === "string" ? profile.venue : null,
          sharedWith: [],
          isDeleted: true,
          deletedAt: new Date(row.deletedAt).toISOString(),
        };
      });

    const filtered = search
      ? users.filter(u =>
          `${u.firstName} ${u.lastName} ${u.email} ${u.partner1Name} ${u.partner2Name} ${u.isDeleted ? "deleted account" : ""} ${u.sharedWith.map(s => `${s.displayName} ${s.email} ${s.workspaceName}`).join(" ")}`
            .toLowerCase().includes(search)
        )
      : users;

    const filteredDeletedUsers = search
      ? deletedUsers.filter(u =>
          `${u.firstName} ${u.lastName} ${u.email} ${u.partner1Name} ${u.partner2Name} deleted account`
            .toLowerCase().includes(search)
        )
      : deletedUsers;

    filtered.sort((a, b) =>
      new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()
    );

    filteredDeletedUsers.sort((a, b) =>
      new Date(b.deletedAt ?? b.joinedAt).getTime() - new Date(a.deletedAt ?? a.joinedAt).getTime()
    );

    const uniqueUserCountByEmail = (items: Array<{ id: string; email: string | null }>) => {
      const identities = new Set<string>();
      for (const item of items) {
        const email = item.email?.trim().toLowerCase();
        identities.add(email || `id:${item.id}`);
      }
      return identities.size;
    };
    const uniqueSignedUpCount = uniqueUserCountByEmail([...filtered, ...filteredDeletedUsers]);

    res.json({
      users: filtered,
      activeUsers: filtered,
      deletedUsers: filteredDeletedUsers,
      total: filtered.length + filteredDeletedUsers.length,
      summary: {
        signedUp: uniqueSignedUpCount,
        active: filtered.length,
        onboarded: filtered.filter(u => u.onboarded).length,
        createdProfile: filtered.filter(u => u.hasProfile).length,
        sharedWorkspace: filtered.filter(u => u.hasSharedWorkspace).length,
        deleted: filteredDeletedUsers.length,
      },
    });
  } catch (err) {
    req.log.error(err, "Admin users error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/workflow-progress", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT
        p.id as profile_id,
        p.user_id,
        p.workstation_name,
        p.partner1_name,
        p.partner2_name,
        p.wedding_date,
        p.venue,
        p.location,
        p.guest_count,
        p.total_budget,
        p.created_at,
        p.updated_at,
        COALESCE(g.guest_count, 0)::int as actual_guest_count,
        COALESCE(v.vendor_count, 0)::int as vendor_count,
        COALESCE(d.document_count, 0)::int as document_count,
        COALESCE(c.completed_checklist_count, 0)::int as completed_checklist_count,
        COALESCE(c.checklist_count, 0)::int as checklist_count,
        COALESCE(b.budget_item_count, 0)::int as budget_item_count,
        COALESCE(me.manual_expense_count, 0)::int as manual_expense_count,
        COALESCE(vp.vendor_payment_count, 0)::int as vendor_payment_count,
        COALESCE(t.timeline_count, 0)::int as timeline_count,
        ae.last_active,
        ae.event_count
      FROM wedding_profiles p
      LEFT JOIN (
        SELECT profile_id, count(*)::int as guest_count
        FROM guests
        GROUP BY profile_id
      ) g ON g.profile_id = p.id
      LEFT JOIN (
        SELECT profile_id, count(*)::int as vendor_count
        FROM vendors
        GROUP BY profile_id
      ) v ON v.profile_id = p.id
      LEFT JOIN (
        SELECT profile_id, count(*)::int as document_count
        FROM documents
        GROUP BY profile_id
      ) d ON d.profile_id = p.id
      LEFT JOIN (
        SELECT
          profile_id,
          count(*)::int as checklist_count,
          count(*) FILTER (WHERE is_completed = true)::int as completed_checklist_count
        FROM checklist_items
        GROUP BY profile_id
      ) c ON c.profile_id = p.id
      LEFT JOIN (
        SELECT b.profile_id, count(bi.id)::int as budget_item_count
        FROM budgets b
        LEFT JOIN budget_items bi ON bi.budget_id = b.id
        GROUP BY b.profile_id
      ) b ON b.profile_id = p.id
      LEFT JOIN (
        SELECT profile_id, count(*)::int as manual_expense_count
        FROM manual_expenses
        GROUP BY profile_id
      ) me ON me.profile_id = p.id
      LEFT JOIN (
        SELECT v.profile_id, count(vp.id)::int as vendor_payment_count
        FROM vendors v
        LEFT JOIN vendor_payments vp ON vp.vendor_id = v.id
        GROUP BY v.profile_id
      ) vp ON vp.profile_id = p.id
      LEFT JOIN (
        SELECT profile_id, count(*)::int as timeline_count
        FROM timelines
        GROUP BY profile_id
      ) t ON t.profile_id = p.id
      LEFT JOIN (
        SELECT user_id, max(timestamp) as last_active, count(*)::int as event_count
        FROM analytics_events
        GROUP BY user_id
      ) ae ON ae.user_id = p.user_id
      ORDER BY COALESCE(ae.last_active, p.updated_at, p.created_at) DESC
      LIMIT 500
    `);

    type WorkflowRow = {
      profile_id: number;
      user_id: string;
      workstation_name: string | null;
      partner1_name: string;
      partner2_name: string;
      wedding_date: string;
      venue: string;
      location: string;
      guest_count: number;
      total_budget: string;
      created_at: Date | string;
      updated_at: Date | string;
      actual_guest_count: number;
      vendor_count: number;
      document_count: number;
      completed_checklist_count: number;
      checklist_count: number;
      budget_item_count: number;
      manual_expense_count: number;
      vendor_payment_count: number;
      timeline_count: number;
      last_active: Date | string | null;
      event_count: number | null;
    };

    const rows = result.rows as WorkflowRow[];
    const userIds = Array.from(new Set(rows.map(row => row.user_id).filter(Boolean))).filter(id => id.startsWith("user_"));
    const clerkUsers: Awaited<ReturnType<typeof clerkClient.users.getUserList>>["data"] = [];
    for (let index = 0; index < userIds.length; index += 100) {
      const batch = userIds.slice(index, index + 100);
      const response = await clerkClient.users.getUserList({ userId: batch, limit: batch.length });
      clerkUsers.push(...response.data);
    }
    const clerkMap = new Map(clerkUsers.map(user => {
      const email = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress
        ?? user.emailAddresses[0]?.emailAddress
        ?? null;
      return [user.id, {
        firstName: user.firstName ?? "",
        lastName: user.lastName ?? "",
        email,
        imageUrl: user.imageUrl ?? null,
      }];
    }));

    const isFilled = (value: string | null | undefined) => {
      const normalized = String(value ?? "").trim().toLowerCase();
      return normalized.length > 0 && !["tbd", "unknown", "n/a", "none"].includes(normalized);
    };
    const dateText = (value: Date | string | null | undefined) => value ? new Date(value).toISOString() : null;

    const users = rows.map(row => {
      const clerk = clerkMap.get(row.user_id);
      const displayName = `${clerk?.firstName ?? ""} ${clerk?.lastName ?? ""}`.trim()
        || [row.partner1_name, row.partner2_name].filter(isFilled).join(" & ")
        || clerk?.email
        || row.user_id;
      const budgetAmount = Number(row.total_budget ?? 0);
      const milestones = [
        { key: "accountCreated", label: "Account created", completed: true },
        { key: "profileCompleted", label: "Profile completed", completed: isFilled(row.partner1_name) && isFilled(row.partner2_name) && isFilled(row.wedding_date) },
        { key: "weddingDetailsAdded", label: "Wedding details added", completed: isFilled(row.venue) && isFilled(row.location) && isFilled(row.wedding_date) },
        { key: "guestListStarted", label: "Guest list started", completed: row.actual_guest_count > 0 },
        {
          key: "guestListCompleted",
          label: "Guest list completed",
          completed: row.actual_guest_count > 0 && row.guest_count > 0 && row.actual_guest_count >= row.guest_count,
        },
        { key: "vendorAdded", label: "Vendor added", completed: row.vendor_count > 0 },
        { key: "documentUploaded", label: "Document uploaded", completed: row.document_count > 0 },
        { key: "checklistTaskCompleted", label: "Checklist task completed", completed: row.completed_checklist_count > 0 },
        {
          key: "budgetPaymentAdded",
          label: "Budget/payment added",
          completed: budgetAmount > 0 || row.budget_item_count > 0 || row.manual_expense_count > 0 || row.vendor_payment_count > 0,
        },
        { key: "timelineStarted", label: "Timeline started", completed: row.timeline_count > 0 },
      ];
      const completedCount = milestones.filter(milestone => milestone.completed).length;
      const progress = Math.round((completedCount / milestones.length) * 100);
      const completed = completedCount === milestones.length;
      const lastCompleted = [...milestones].reverse().find(milestone => milestone.completed)?.label ?? "Not started";
      const nextStep = milestones.find(milestone => !milestone.completed)?.label ?? "Completed";

      return {
        userId: row.user_id,
        profileId: row.profile_id,
        displayName,
        email: clerk?.email ?? null,
        imageUrl: clerk?.imageUrl ?? null,
        workspaceName: row.workstation_name || [row.partner1_name, row.partner2_name].filter(isFilled).join(" & ") || "Wedding workspace",
        weddingDate: row.wedding_date || null,
        venue: row.venue || null,
        createdAt: dateText(row.created_at),
        lastActive: dateText(row.last_active ?? row.updated_at ?? row.created_at),
        status: completed ? "completed" : completedCount <= 1 ? "not_started" : "in_progress",
        progress,
        completedCount,
        totalMilestones: milestones.length,
        lastCompleted,
        nextStep,
        counts: {
          guests: row.actual_guest_count,
          targetGuests: row.guest_count,
          vendors: row.vendor_count,
          documents: row.document_count,
          checklistCompleted: row.completed_checklist_count,
          checklistTotal: row.checklist_count,
          budgetItems: row.budget_item_count,
          manualExpenses: row.manual_expense_count,
          vendorPayments: row.vendor_payment_count,
          timelines: row.timeline_count,
          events: row.event_count ?? 0,
        },
        milestones,
      };
    });

    res.json({
      users,
      summary: {
        total: users.length,
        completed: users.filter(user => user.status === "completed").length,
        inProgress: users.filter(user => user.status === "in_progress").length,
        notStarted: users.filter(user => user.status === "not_started").length,
      },
    });
  } catch (err) {
    req.log.error(err, "Admin workflow progress error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/dropoffs", requireAuth, requireAdmin, async (req, res) => {
  try {
    const days = parseInt(String(req.query.days ?? "0"), 10);
    const since = days > 0 ? new Date(Date.now() - days * 86400000) : null;

    const [profileRows, collaboratorRows, clerkResponse] = await Promise.all([
      db.select({ userId: weddingProfiles.userId }).from(weddingProfiles),
      db.select({ userId: workspaceCollaborators.inviteeUserId })
        .from(workspaceCollaborators)
        .where(and(
          eq(workspaceCollaborators.status, "active"),
          sql`${workspaceCollaborators.inviteeUserId} IS NOT NULL`
        )),
      clerkClient.users.getUserList({
        limit: 500,
        ...(since ? { createdAtAfter: since.getTime() } : {}),
      }),
    ]);

    const onboardedIds = new Set([
      ...profileRows.map(r => r.userId).filter(Boolean),
      ...collaboratorRows.map(r => r.userId).filter(Boolean),
    ]);
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
  const targetUserId = String(req.params.userId ?? "");
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

    await snapshotUserData(targetUserId, {
      email: userEmails[0] ?? null,
      firstName: clerkFirstName,
      lastName: clerkLastName,
    });
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
    const userId = String(req.params.userId ?? "");
    await db.insert(adminUsers).values({ userId }).onConflictDoNothing();
    res.json({ success: true, message: `User ${userId} promoted to admin.` });
  } catch (err) {
    req.log.error(err, "Admin promote error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/admin/demote/:userId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = String(req.params.userId ?? "");
    if (userId === req.userId) {
      return res.status(400).json({ error: "Cannot demote yourself." });
    }
    await db.delete(adminUsers).where(eq(adminUsers.userId, userId));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "Admin demote error");
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

    if (data.archiveType === "workspace") {
      const targetProfiles = await db.select().from(weddingProfiles).where(eq(weddingProfiles.userId, newUserId.trim())).limit(1);
      if (!targetProfiles.length) return res.status(400).json({ error: "Target planner account must have a default workspace first." });
      if (targetProfiles[0].accountType !== "wedding_planner") return res.status(400).json({ error: "Workstation archives can only be restored to a Wedding Planner account." });

      const profileData = data.profile as Record<string, unknown> | null;
      if (!profileData) return res.status(400).json({ error: "Archive has no workstation profile to restore." });

      const [profile] = await db.insert(weddingProfiles).values({
        userId: newUserId.trim(),
        workstationName: String(profileData.workstationName ?? "Restored Workstation"),
        partner1Name: String(profileData.partner1Name ?? ""),
        partner2Name: String(profileData.partner2Name ?? ""),
        weddingDate: String(profileData.weddingDate ?? ""),
        ceremonyTime: String(profileData.ceremonyTime ?? "16:00"),
        receptionTime: String(profileData.receptionTime ?? "18:00"),
        venue: String(profileData.venue ?? "TBD"),
        location: String(profileData.location ?? "TBD"),
        venueCity: profileData.venueCity as string | null ?? null,
        venueState: profileData.venueState as string | null ?? null,
        venueZip: profileData.venueZip as string | null ?? null,
        venueCountry: profileData.venueCountry as string | null ?? null,
        ceremonyAtVenue: Boolean(profileData.ceremonyAtVenue ?? true),
        ceremonyVenueName: profileData.ceremonyVenueName as string | null ?? null,
        ceremonyAddress: profileData.ceremonyAddress as string | null ?? null,
        ceremonyCity: profileData.ceremonyCity as string | null ?? null,
        ceremonyState: profileData.ceremonyState as string | null ?? null,
        ceremonyZip: profileData.ceremonyZip as string | null ?? null,
        guestCount: Number(profileData.guestCount ?? 1),
        totalBudget: String(profileData.totalBudget ?? "0"),
        weddingVibe: String(profileData.weddingVibe ?? "Not set"),
        accountType: "wedding_planner",
        preferredLanguage: profileData.preferredLanguage as string | null ?? "English",
        guestCollectionToken: profileData.guestCollectionToken as string | null ?? null,
        vendorBccEmail: profileData.vendorBccEmail as string | null ?? null,
        invitationPhotoUrl: profileData.invitationPhotoUrl as string | null ?? null,
        invitationMessage: profileData.invitationMessage as string | null ?? null,
        saveTheDatePhotoUrl: profileData.saveTheDatePhotoUrl as string | null ?? null,
        saveTheDateMessage: profileData.saveTheDateMessage as string | null ?? null,
        digitalInvitationPhotoUrl: profileData.digitalInvitationPhotoUrl as string | null ?? null,
      }).returning({ id: weddingProfiles.id });
      const newProfileId = profile.id;
      restored.profile = 1;

      for (const tl of ((data.timelines as Array<Record<string, unknown>>) ?? [])) {
        await db.insert(timelines).values({ profileId: newProfileId, events: (tl.events ?? []) as never });
      }
      restored.timelines = ((data.timelines as unknown[]) ?? []).length;

      for (const g of ((data.guests as Array<Record<string, unknown>>) ?? [])) {
        await db.insert(guests).values({
          profileId: newProfileId,
          name: String(g.name ?? "Guest"),
          email: g.email as string | null ?? null,
          invitationStatus: String(g.invitationStatus ?? "pending"),
          rsvpStatus: String(g.rsvpStatus ?? "pending"),
          mealChoice: g.mealChoice as string | null ?? null,
          dietaryNotes: g.dietaryNotes as string | null ?? null,
          guestGroup: g.guestGroup as string | null ?? null,
          plusOne: Boolean(g.plusOne ?? false),
          plusOneName: g.plusOneName as string | null ?? null,
          plusOneMealChoice: g.plusOneMealChoice as string | null ?? null,
          tableAssignment: g.tableAssignment as string | null ?? null,
          needsHotel: Boolean(g.needsHotel ?? false),
          bookedHotelBlockId: g.bookedHotelBlockId == null ? null : Number(g.bookedHotelBlockId),
          bookedHotelRoomCount: g.bookedHotelRoomCount == null ? null : Number(g.bookedHotelRoomCount),
          notes: g.notes as string | null ?? null,
          rsvpMessage: g.rsvpMessage as string | null ?? null,
          phone: g.phone as string | null ?? null,
          address: g.address as string | null ?? null,
          aptUnit: g.aptUnit as string | null ?? null,
          guestCity: g.guestCity as string | null ?? null,
          guestState: g.guestState as string | null ?? null,
          guestZip: g.guestZip as string | null ?? null,
          guestCountry: g.guestCountry as string | null ?? null,
          rsvpToken: g.rsvpToken as string | null ?? null,
          rsvpSentAt: g.rsvpSentAt ? new Date(String(g.rsvpSentAt)) : null,
          rsvpRespondedAt: g.rsvpRespondedAt ? new Date(String(g.rsvpRespondedAt)) : null,
          saveTheDateStatus: String(g.saveTheDateStatus ?? "not_sent"),
          rsvpReminderStatus: String(g.rsvpReminderStatus ?? "not_sent"),
          source: String(g.source ?? "manual"),
          acknowledgedAt: g.acknowledgedAt ? new Date(String(g.acknowledgedAt)) : null,
        });
      }
      restored.guests = ((data.guests as unknown[]) ?? []).length;

      const websiteIdMap = new Map<number, number>();
      for (const site of ((data.weddingWebsites as Array<Record<string, unknown>>) ?? [])) {
        const originalSlug = String(site.slug ?? "restored-site").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "restored-site";
        const [createdSite] = await db.insert(weddingWebsites).values({
          profileId: newProfileId,
          slug: `${originalSlug}-restored-${id}`,
          theme: String(site.theme ?? "classic"),
          layoutStyle: String(site.layoutStyle ?? "standard"),
          font: String(site.font ?? "Playfair Display"),
          accentColor: String(site.accentColor ?? "#8D294D"),
          colorPalette: (site.colorPalette ?? undefined) as never,
          sectionsEnabled: (site.sectionsEnabled ?? undefined) as never,
          customText: (site.customText ?? {}) as never,
          textStyles: (site.textStyles ?? {}) as never,
          textPositions: (site.textPositions ?? {}) as never,
          galleryImages: (site.galleryImages ?? []) as never,
          heroImages: (site.heroImages ?? []) as never,
          heroImage: site.heroImage as string | null ?? null,
          password: site.password as string | null ?? null,
          published: Boolean(site.published ?? false),
          publishedAt: site.publishedAt ? new Date(String(site.publishedAt)) : null,
        }).returning({ id: weddingWebsites.id });
        if (site.id != null) websiteIdMap.set(Number(site.id), createdSite.id);
      }
      for (const rsvp of ((data.websiteRsvps as Array<Record<string, unknown>>) ?? [])) {
        const newWebsiteId = websiteIdMap.get(Number(rsvp.websiteId));
        if (!newWebsiteId) continue;
        await db.insert(websiteRsvps).values({
          websiteId: newWebsiteId,
          name: String(rsvp.name ?? "Guest"),
          email: rsvp.email as string | null ?? null,
          attending: String(rsvp.attending ?? "yes"),
          plusOneCount: Number(rsvp.plusOneCount ?? 0),
          dietaryRestrictions: rsvp.dietaryRestrictions as string | null ?? null,
          message: rsvp.message as string | null ?? null,
          submittedAt: rsvp.submittedAt ? new Date(String(rsvp.submittedAt)) : new Date(),
        });
      }
      restored.weddingWebsites = websiteIdMap.size;
      restored.websiteRsvps = ((data.websiteRsvps as unknown[]) ?? []).length;

      for (const ci of ((data.checklistItems as Array<Record<string, unknown>>) ?? [])) {
        await db.insert(checklistItems).values({
          profileId: newProfileId,
          month: String(ci.month ?? ""),
          task: String(ci.task ?? ""),
          description: String(ci.description ?? ""),
          isCompleted: Boolean(ci.isCompleted ?? false),
          completedAt: ci.completedAt ? new Date(String(ci.completedAt)) : null,
          resolveNote: ci.resolveNote as string | null ?? null,
        });
      }
      restored.checklistItems = ((data.checklistItems as unknown[]) ?? []).length;

      const budgetIdMap = new Map<number, number>();
      const budgetItemIdMap = new Map<number, number>();
      for (const b of ((data.budgets as Array<Record<string, unknown>>) ?? [])) {
        const [created] = await db.insert(budgets).values({ profileId: newProfileId, totalBudget: String(b.totalBudget ?? "0") }).returning({ id: budgets.id });
        if (b.id != null) budgetIdMap.set(Number(b.id), created.id);
      }
      for (const bi of ((data.budgetItems as Array<Record<string, unknown>>) ?? [])) {
        const newBudgetId = budgetIdMap.get(Number(bi.budgetId));
        if (!newBudgetId) continue;
        const [created] = await db.insert(budgetItems).values({
          budgetId: newBudgetId,
          category: String(bi.category ?? ""),
          vendor: String(bi.vendor ?? ""),
          estimatedCost: String(bi.estimatedCost ?? "0"),
          actualCost: String(bi.actualCost ?? "0"),
          amountPaid: String(bi.amountPaid ?? "0"),
          isPaid: Boolean(bi.isPaid ?? false),
          notes: bi.notes as string | null ?? null,
          nextPaymentDue: bi.nextPaymentDue as string | null ?? null,
        }).returning({ id: budgetItems.id });
        if (bi.id != null) budgetItemIdMap.set(Number(bi.id), created.id);
      }
      for (const log of ((data.budgetPaymentLogs as Array<Record<string, unknown>>) ?? [])) {
        const newBudgetItemId = budgetItemIdMap.get(Number(log.budgetItemId));
        if (!newBudgetItemId) continue;
        await db.insert(budgetPaymentLogs).values({
          budgetItemId: newBudgetItemId,
          amount: String(log.amount ?? "0"),
          note: log.note as string | null ?? null,
          paidAt: log.paidAt ? new Date(String(log.paidAt)) : new Date(),
        });
      }
      restored.budgets = budgetIdMap.size;
      restored.budgetItems = budgetItemIdMap.size;

      const vendorIdMap = new Map<number, number>();
      for (const v of ((data.vendors as Array<Record<string, unknown>>) ?? [])) {
        const [created] = await db.insert(vendors).values({
          profileId: newProfileId,
          userId: newUserId.trim(),
          name: String(v.name ?? ""),
          category: String(v.category ?? "Other"),
          email: v.email as string | null ?? null,
          phone: v.phone as string | null ?? null,
          website: v.website as string | null ?? null,
          portalLink: v.portalLink as string | null ?? null,
          address: v.address as string | null ?? null,
          notes: v.notes as string | null ?? null,
          totalCost: String(v.totalCost ?? "0"),
          depositAmount: String(v.depositAmount ?? "0"),
          contractSigned: Boolean(v.contractSigned ?? false),
          nextPaymentDue: v.nextPaymentDue as string | null ?? null,
          files: (v.files ?? []) as never,
          primaryContact: v.primaryContact as string | null ?? null,
        }).returning({ id: vendors.id });
        if (v.id != null) vendorIdMap.set(Number(v.id), created.id);
      }
      for (const p of ((data.vendorPayments as Array<Record<string, unknown>>) ?? [])) {
        const newVendorId = vendorIdMap.get(Number(p.vendorId));
        if (!newVendorId) continue;
        await db.insert(vendorPayments).values({
          vendorId: newVendorId,
          label: String(p.label ?? "Payment"),
          amount: String(p.amount ?? "0"),
          dueDate: String(p.dueDate ?? ""),
          isPaid: Boolean(p.isPaid ?? false),
          paidAt: p.paidAt ? new Date(String(p.paidAt)) : null,
        });
      }
      restored.vendors = vendorIdMap.size;

      for (const e of ((data.manualExpenses as Array<Record<string, unknown>>) ?? [])) {
        await db.insert(manualExpenses).values({
          profileId: newProfileId,
          userId: newUserId.trim(),
          name: String(e.name ?? ""),
          category: String(e.category ?? "Other"),
          cost: String(e.cost ?? "0"),
          amountPaid: String(e.amountPaid ?? "0"),
          nextPaymentDue: e.nextPaymentDue as string | null ?? null,
          nextPaymentAmount: e.nextPaymentAmount != null ? String(e.nextPaymentAmount) : null,
          notes: e.notes as string | null ?? null,
          receiptUrl: e.receiptUrl as string | null ?? null,
          receiptName: e.receiptName as string | null ?? null,
        });
      }
      restored.manualExpenses = ((data.manualExpenses as unknown[]) ?? []).length;

      for (const vc of ((data.vendorContracts as Array<Record<string, unknown>>) ?? [])) {
        await db.insert(vendorContracts).values({
          userId: newUserId.trim(),
          profileId: newProfileId,
          vendorId: vc.vendorId != null ? (vendorIdMap.get(Number(vc.vendorId)) ?? null) : null,
          fileName: String(vc.fileName ?? "contract"),
          fileSize: vc.fileSize == null ? null : Number(vc.fileSize),
          mimeType: vc.mimeType as string | null ?? null,
          extractedText: vc.extractedText as string | null ?? null,
          analysis: vc.analysis as never,
        });
      }
      restored.vendorContracts = ((data.vendorContracts as unknown[]) ?? []).length;

      for (const h of ((data.hotelBlocks as Array<Record<string, unknown>>) ?? [])) {
        await db.insert(hotelBlocks).values({
          profileId: newProfileId,
          userId: newUserId.trim(),
          hotelName: String(h.hotelName ?? ""),
          address: h.address as string | null ?? null,
          city: h.city as string | null ?? null,
          state: h.state as string | null ?? null,
          zip: h.zip as string | null ?? null,
          phone: h.phone as string | null ?? null,
          email: h.email as string | null ?? null,
          bookingLink: h.bookingLink as string | null ?? null,
          discountCode: h.discountCode as string | null ?? null,
          groupName: h.groupName as string | null ?? null,
          cutoffDate: h.cutoffDate as string | null ?? null,
          roomsReserved: h.roomsReserved == null ? null : Number(h.roomsReserved),
          roomsBooked: Number(h.roomsBooked ?? 0),
          pricePerNight: h.pricePerNight != null ? String(h.pricePerNight) : null,
          distanceFromVenue: h.distanceFromVenue as string | null ?? null,
          notes: h.notes as string | null ?? null,
        });
      }
      restored.hotelBlocks = ((data.hotelBlocks as unknown[]) ?? []).length;

      for (const m of ((data.weddingParty as Array<Record<string, unknown>>) ?? [])) {
        await db.insert(weddingParty).values({
          profileId: newProfileId,
          userId: newUserId.trim(),
          name: String(m.name ?? ""),
          role: String(m.role ?? ""),
          side: String(m.side ?? "bride"),
          phone: m.phone as string | null ?? null,
          email: m.email as string | null ?? null,
          outfitDetails: m.outfitDetails as string | null ?? null,
          shoeSize: m.shoeSize as string | null ?? null,
          outfitStore: m.outfitStore as string | null ?? null,
          fittingDate: m.fittingDate as string | null ?? null,
          notes: m.notes as string | null ?? null,
          photoUrl: m.photoUrl as string | null ?? null,
          sortOrder: Number(m.sortOrder ?? 0),
        });
      }
      restored.weddingParty = ((data.weddingParty as unknown[]) ?? []).length;

      for (const s of ((data.seatingCharts as Array<Record<string, unknown>>) ?? [])) {
        await db.insert(seatingCharts).values({
          profileId: newProfileId,
          userId: newUserId.trim(),
          name: String(s.name ?? "Restored Seating Chart"),
          guests: (s.guests ?? []) as never,
          tables: s.tables as never,
          tableCount: Number(s.tableCount ?? 8),
          seatsPerTable: Number(s.seatsPerTable ?? 8),
        });
      }
      restored.seatingCharts = ((data.seatingCharts as unknown[]) ?? []).length;

      for (const event of ((data.analyticsEvents as Array<Record<string, unknown>>) ?? [])) {
        await db.insert(analyticsEvents).values({
          userId: newUserId.trim(),
          eventType: String(event.eventType ?? "restored_event"),
          timestamp: event.timestamp ? new Date(String(event.timestamp)) : new Date(),
          metadata: (event.metadata ?? {}) as never,
        });
      }
      restored.analyticsEvents = ((data.analyticsEvents as unknown[]) ?? []).length;

      await db.update(deletedUserArchive)
        .set({ restoredAt: new Date(), restoredBy: req.userId ?? "admin", restoredToUserId: newUserId.trim() })
        .where(eq(deletedUserArchive.id, id));

      return res.json({ ok: true, restored });
    }

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
            name: String(g.name ?? (`${g.firstName ?? ""} ${g.lastName ?? ""}`.trim() || "Guest")),
            email: g.email as string | null ?? null,
            phone: g.phone as string | null ?? null,
            rsvpStatus: (g.rsvpStatus as string) ?? "pending",
            mealChoice: g.mealChoice as string | null ?? null,
            dietaryNotes: (g.dietaryRestrictions ?? g.dietaryNotes) as string | null ?? null,
            plusOne: Boolean(g.plusOne ?? false),
            plusOneName: g.plusOneName as string | null ?? null,
            plusOneMealChoice: g.plusOneMealChoice as string | null ?? null,
            tableAssignment: g.tableNumber != null ? String(g.tableNumber) : (g.tableAssignment as string | null ?? null),
            needsHotel: Boolean(g.needsHotel ?? false),
            bookedHotelBlockId: g.bookedHotelBlockId == null ? null : Number(g.bookedHotelBlockId),
            bookedHotelRoomCount: g.bookedHotelRoomCount == null ? null : Number(g.bookedHotelRoomCount),
            notes: g.notes as string | null ?? null,
            rsvpMessage: g.rsvpMessage as string | null ?? null,
            guestGroup: (g.group ?? g.guestGroup) as string | null ?? null,
            source: String(g.source ?? "manual"),
            rsvpToken: g.rsvpToken as string | null ?? null,
            rsvpSentAt: g.rsvpSentAt ? new Date(String(g.rsvpSentAt)) : null,
            rsvpRespondedAt: g.rsvpRespondedAt ? new Date(String(g.rsvpRespondedAt)) : null,
            saveTheDateStatus: String(g.saveTheDateStatus ?? "not_sent"),
            rsvpReminderStatus: String(g.rsvpReminderStatus ?? "not_sent"),
            acknowledgedAt: g.acknowledgedAt ? new Date(String(g.acknowledgedAt)) : null,
          });
        }
        restored.guests = guestRows.length;
      }

      const websiteRows = (data.weddingWebsites as Array<Record<string, unknown>>) ?? [];
      const websiteIdMap = new Map<number, number>();
      for (const site of websiteRows) {
        const originalSlug = String(site.slug ?? "restored-site").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "restored-site";
        const [createdSite] = await db.insert(weddingWebsites).values({
          profileId: newProfileId,
          slug: `${originalSlug}-restored-${id}`,
          theme: String(site.theme ?? "classic"),
          layoutStyle: String(site.layoutStyle ?? "standard"),
          font: String(site.font ?? "Playfair Display"),
          accentColor: String(site.accentColor ?? "#8D294D"),
          colorPalette: (site.colorPalette ?? undefined) as never,
          sectionsEnabled: (site.sectionsEnabled ?? undefined) as never,
          customText: (site.customText ?? {}) as never,
          textStyles: (site.textStyles ?? {}) as never,
          textPositions: (site.textPositions ?? {}) as never,
          galleryImages: (site.galleryImages ?? []) as never,
          heroImages: (site.heroImages ?? []) as never,
          heroImage: site.heroImage as string | null ?? null,
          password: site.password as string | null ?? null,
          published: Boolean(site.published ?? false),
          publishedAt: site.publishedAt ? new Date(String(site.publishedAt)) : null,
        }).returning({ id: weddingWebsites.id });
        if (site.id != null) websiteIdMap.set(Number(site.id), createdSite.id);
      }
      const websiteRsvpRows = (data.websiteRsvps as Array<Record<string, unknown>>) ?? [];
      for (const rsvp of websiteRsvpRows) {
        const newWebsiteId = websiteIdMap.get(Number(rsvp.websiteId));
        if (!newWebsiteId) continue;
        await db.insert(websiteRsvps).values({
          websiteId: newWebsiteId,
          name: String(rsvp.name ?? "Guest"),
          email: rsvp.email as string | null ?? null,
          attending: String(rsvp.attending ?? "yes"),
          plusOneCount: Number(rsvp.plusOneCount ?? 0),
          dietaryRestrictions: rsvp.dietaryRestrictions as string | null ?? null,
          message: rsvp.message as string | null ?? null,
          submittedAt: rsvp.submittedAt ? new Date(String(rsvp.submittedAt)) : new Date(),
        });
      }
      restored.weddingWebsites = websiteIdMap.size;
      restored.websiteRsvps = websiteRsvpRows.length;

      const ciRows = (data.checklistItems as Array<Record<string, unknown>>) ?? [];
      if (ciRows.length > 0) {
        for (const ci of ciRows) {
          await db.insert(checklistItems).values({
            profileId: newProfileId,
            month: String(ci.month ?? ci.monthLabel ?? ci.category ?? ""),
            task: String(ci.task ?? ""),
            description: String(ci.notes ?? ""),
            isCompleted: Boolean(ci.completed ?? ci.isCompleted ?? false),
            completedAt: (ci.completed ?? ci.isCompleted) ? new Date() : null,
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
              vendor: String(bi.vendor ?? bi.item ?? ""),
              estimatedCost: String(bi.estimatedCost ?? "0"),
              actualCost: String(bi.actualCost ?? "0"),
              isPaid: Boolean(bi.paid ?? bi.isPaid ?? false),
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
          notes: v.notes as string | null ?? null,
          totalCost: String(v.price ?? v.totalCost ?? "0"),
          contractSigned: Boolean(v.contractSigned ?? false),
        });
      }
      restored.vendors = vendorRows.length;
    }

    const vcRows = (data.vendorContracts as Array<Record<string, unknown>>) ?? [];
    if (vcRows.length > 0) {
      for (const vc of vcRows) {
        await db.insert(vendorContracts).values({
          userId: newUserId.trim(),
          fileName: String(vc.fileName ?? vc.vendorName ?? "contract"),
          extractedText: vc.notes as string | null ?? null,
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

    const analyticsRows = (data.analyticsEvents as Array<Record<string, unknown>>) ?? [];
    if (analyticsRows.length > 0) {
      for (const event of analyticsRows) {
        await db.insert(analyticsEvents).values({
          userId: newUserId.trim(),
          eventType: String(event.eventType ?? "restored_event"),
          timestamp: event.timestamp ? new Date(String(event.timestamp)) : new Date(),
          metadata: (event.metadata ?? {}) as never,
        });
      }
      restored.analyticsEvents = analyticsRows.length;
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
    const model = getModel();
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: `You're the Marketing Outreach Tool inside A.IDO Operations Center. Write warm, human, founder-led marketing emails inviting people to A.IDO (AI wedding planning). SHORT (under 150 words), friendly, non-salesy. Sign off as Joseph, Founder of A.IDO.`,
        },
        {
          role: "user",
          content: `Generate a fresh outreach email. Include a compelling subject and body under 150 words that highlights 2-3 A.IDO benefits (timelines, vendors, budget, AI), has a clear CTA to https://www.aidowedding.net, sounds human, and is signed by Joseph.

Return ONLY JSON: {"subject":"...","body":"..."}`,
        },
      ],
      ...(supportsCustomTemperature(model) ? { temperature: 0.9 } : {}),
      // PREVIOUSLY UNCAPPED — defaulted to model max, which on llama-3.1-8b
      // is huge. 150-word email ≈ 220 tok; 400 is safe ceiling.
      max_completion_tokens: 400,
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
    const normalizedSubject = subject.trim();
    const normalizedBody = body.trim();
    if (/\b(free money|guaranteed|act now|urgent|winner|risk\s*free)\b/i.test(normalizedSubject)) {
      return res.status(400).json({ error: "Subject appears overly promotional and is likely to be filtered as spam. Please rewrite it." });
    }
    const linkCount = (normalizedBody.match(/https?:\/\//gi) ?? []).length;
    if (linkCount > 5) {
      return res.status(400).json({ error: "Body has too many links for a cold outreach email. Please keep it to 5 or fewer." });
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
        subject: normalizedSubject,
        text: normalizedBody,
        headers: {
          "List-Unsubscribe": `<mailto:${FROM_EMAIL}?subject=unsubscribe>, <https://www.aidowedding.net/unsubscribe>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });

      trackEvent(req.userId ?? "admin", "marketing_email_sent", {
        to: trimmed,
        subject: normalizedSubject,
        ok: r.ok,
        error: r.error ?? null,
      });

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
