import { db } from "@workspace/db";
import {
  weddingProfiles, timelines, budgets, budgetItems, budgetPaymentLogs,
  checklistItems, vendors, vendorPayments, analyticsEvents,
  workspaceCollaborators, workspaceActivity, vendorContracts,
  seatingCharts, guests, hotelBlocks, weddingParty,
  manualExpenses, vendorConversations, vendorMessages,
  contactMessages, feedbackSubmissions, adminUsers,
  deletedAccountEmails, deletedUserArchive,
} from "@workspace/db";
import { eq, inArray, or, sql } from "drizzle-orm";
import { logger } from "./logger";

export async function blockEmailsForUser(emails: string[], userId: string): Promise<void> {
  const normalized = Array.from(
    new Set(
      emails
        .map((e) => (typeof e === "string" ? e.trim().toLowerCase() : ""))
        .filter((e) => e.length > 0),
    ),
  );
  for (const email of normalized) {
    await db
      .insert(deletedAccountEmails)
      .values({ email, deletedUserId: userId })
      .onConflictDoUpdate({
        target: deletedAccountEmails.email,
        set: { deletedAt: sql`NOW()`, deletedUserId: userId },
      });
  }
}

export async function snapshotUserData(
  userId: string,
  opts?: { email?: string | null; firstName?: string | null; lastName?: string | null },
): Promise<void> {
  try {
    const [profile] = await db
      .select()
      .from(weddingProfiles)
      .where(eq(weddingProfiles.userId, userId))
      .limit(1);

    const snapshot: Record<string, unknown> = { userId };

    if (profile) {
      snapshot.profile = profile;
      const profileId = profile.id;

      snapshot.timelines = await db.select().from(timelines).where(eq(timelines.profileId, profileId));
      snapshot.checklistItems = await db.select().from(checklistItems).where(eq(checklistItems.profileId, profileId));
      snapshot.guests = await db.select().from(guests).where(eq(guests.profileId, profileId));

      const userBudgets = await db.select().from(budgets).where(eq(budgets.profileId, profileId));
      snapshot.budgets = userBudgets;

      if (userBudgets.length > 0) {
        const budgetIds = userBudgets.map(b => b.id);
        const items = await db.select().from(budgetItems).where(inArray(budgetItems.budgetId, budgetIds));
        snapshot.budgetItems = items;
        if (items.length > 0) {
          const itemIds = items.map(i => i.id);
          snapshot.budgetPaymentLogs = await db.select().from(budgetPaymentLogs).where(inArray(budgetPaymentLogs.budgetItemId, itemIds));
        } else {
          snapshot.budgetPaymentLogs = [];
        }
      } else {
        snapshot.budgetItems = [];
        snapshot.budgetPaymentLogs = [];
      }
    } else {
      snapshot.profile = null;
      snapshot.timelines = [];
      snapshot.checklistItems = [];
      snapshot.guests = [];
      snapshot.budgets = [];
      snapshot.budgetItems = [];
      snapshot.budgetPaymentLogs = [];
    }

    const userVendors = await db.select().from(vendors).where(eq(vendors.userId, userId));
    snapshot.vendors = userVendors;
    if (userVendors.length > 0) {
      const vendorIds = userVendors.map(v => v.id);
      snapshot.vendorPayments = await db.select().from(vendorPayments).where(inArray(vendorPayments.vendorId, vendorIds));
    } else {
      snapshot.vendorPayments = [];
    }

    const convRows = await db.select().from(vendorConversations).where(eq(vendorConversations.userId, userId));
    snapshot.vendorConversations = convRows;
    if (convRows.length > 0) {
      const convIds = convRows.map(c => c.id);
      snapshot.vendorMessages = await db.select().from(vendorMessages).where(inArray(vendorMessages.conversationId, convIds));
    } else {
      snapshot.vendorMessages = [];
    }

    snapshot.vendorContracts = await db.select().from(vendorContracts).where(eq(vendorContracts.userId, userId));
    snapshot.seatingCharts = await db.select().from(seatingCharts).where(eq(seatingCharts.userId, userId));
    snapshot.hotelBlocks = await db.select().from(hotelBlocks).where(eq(hotelBlocks.userId, userId));
    snapshot.weddingParty = await db.select().from(weddingParty).where(eq(weddingParty.userId, userId));
    snapshot.manualExpenses = await db.select().from(manualExpenses).where(eq(manualExpenses.userId, userId));
    snapshot.analyticsEvents = await db.select().from(analyticsEvents).where(eq(analyticsEvents.userId, userId));

    await db.insert(deletedUserArchive).values({
      userId,
      email: opts?.email ?? null,
      firstName: opts?.firstName ?? null,
      lastName: opts?.lastName ?? null,
      archivedData: snapshot,
    });

    logger.info({ userId }, "User data archived before deletion");
  } catch (err) {
    logger.error({ err, userId }, "Failed to snapshot user data — deletion will still proceed");
  }
}

export async function purgeUserData(
  userId: string,
  userEmail?: string | string[] | null,
  clerkUser?: { firstName?: string | null; lastName?: string | null },
) {
  const primaryEmail = Array.isArray(userEmail) ? (userEmail[0] ?? null) : (userEmail ?? null);

  await snapshotUserData(userId, {
    email: primaryEmail,
    firstName: clerkUser?.firstName ?? null,
    lastName: clerkUser?.lastName ?? null,
  });

  const [profile] = await db
    .select()
    .from(weddingProfiles)
    .where(eq(weddingProfiles.userId, userId))
    .limit(1);

  if (profile) {
    const profileId = profile.id;

    const userVendorRows = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(eq(vendors.userId, userId));

    if (userVendorRows.length > 0) {
      const vendorIds = userVendorRows.map(v => v.id);
      await db.delete(vendorPayments).where(inArray(vendorPayments.vendorId, vendorIds));
    }

    const userBudgetRows = await db
      .select({ id: budgets.id })
      .from(budgets)
      .where(eq(budgets.profileId, profileId));

    if (userBudgetRows.length > 0) {
      const budgetIds = userBudgetRows.map(b => b.id);
      const userBudgetItemRows = await db
        .select({ id: budgetItems.id })
        .from(budgetItems)
        .where(inArray(budgetItems.budgetId, budgetIds));

      if (userBudgetItemRows.length > 0) {
        const budgetItemIds = userBudgetItemRows.map(i => i.id);
        await db.delete(budgetPaymentLogs).where(inArray(budgetPaymentLogs.budgetItemId, budgetItemIds));
      }
      await db.delete(budgetItems).where(inArray(budgetItems.budgetId, budgetIds));
    }
    await db.delete(budgets).where(eq(budgets.profileId, profileId));

    await db.delete(workspaceActivity).where(eq(workspaceActivity.profileId, profileId));
    await db.delete(workspaceCollaborators).where(
      or(
        eq(workspaceCollaborators.profileId, profileId),
        eq(workspaceCollaborators.inviterUserId, userId),
      )!
    );
    await db.delete(timelines).where(eq(timelines.profileId, profileId));
    await db.delete(checklistItems).where(eq(checklistItems.profileId, profileId));
    await db.delete(guests).where(eq(guests.profileId, profileId));
  }

  const userConvRows = await db
    .select({ id: vendorConversations.id })
    .from(vendorConversations)
    .where(eq(vendorConversations.userId, userId));
  if (userConvRows.length > 0) {
    const convIds = userConvRows.map(c => c.id);
    await db.delete(vendorMessages).where(inArray(vendorMessages.conversationId, convIds));
  }
  await db.delete(vendorConversations).where(eq(vendorConversations.userId, userId));

  await db.delete(manualExpenses).where(eq(manualExpenses.userId, userId));
  await db.delete(contactMessages).where(eq(contactMessages.userId, userId));
  await db.delete(feedbackSubmissions).where(eq(feedbackSubmissions.userId, userId));
  await db.delete(adminUsers).where(eq(adminUsers.userId, userId));

  await db.delete(workspaceCollaborators).where(eq(workspaceCollaborators.inviteeUserId, userId));
  const inviteEmails = (Array.isArray(userEmail) ? userEmail : userEmail ? [userEmail] : [])
    .map((e) => (typeof e === "string" ? e.trim().toLowerCase() : ""))
    .filter((e) => e.length > 0);
  if (inviteEmails.length > 0) {
    await db
      .delete(workspaceCollaborators)
      .where(inArray(workspaceCollaborators.inviteeEmail, inviteEmails));
  }
  await db.delete(workspaceActivity).where(eq(workspaceActivity.userId, userId));
  await db.delete(vendors).where(eq(vendors.userId, userId));
  await db.delete(weddingParty).where(eq(weddingParty.userId, userId));
  await db.delete(vendorContracts).where(eq(vendorContracts.userId, userId));
  await db.delete(seatingCharts).where(eq(seatingCharts.userId, userId));
  await db.delete(hotelBlocks).where(eq(hotelBlocks.userId, userId));
  await db.delete(analyticsEvents).where(eq(analyticsEvents.userId, userId));

  if (profile) {
    await db.delete(weddingProfiles).where(eq(weddingProfiles.userId, userId));
  }
}
