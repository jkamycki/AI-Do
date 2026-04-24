import { db } from "@workspace/db";
import {
  weddingProfiles, timelines, budgets, budgetItems, budgetPaymentLogs,
  checklistItems, vendors, vendorPayments, analyticsEvents,
  workspaceCollaborators, workspaceActivity, vendorContracts,
  seatingCharts, guests, hotelBlocks, weddingParty,
  manualExpenses, vendorConversations, vendorMessages,
  contactMessages, feedbackSubmissions, adminUsers,
  deletedAccountEmails,
} from "@workspace/db";
import { eq, inArray, or, sql } from "drizzle-orm";

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

export async function purgeUserData(
  userId: string,
  userEmail?: string | string[] | null,
) {
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

  // Vendor messaging (vendorMessages -> vendorConversations by user_id)
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

  // Note: deletion intentionally does NOT add the email to a permanent
  // blocklist. After deletion the email is fully released — the user must
  // explicitly sign up again to come back. The "no account" experience on
  // sign-in is handled by Clerk for password and by the post-OAuth check
  // in the frontend for Google.
}
