import { Router } from "express";
import { clerkClient } from "@clerk/express";
import { requireAuth } from "../middlewares/requireAuth";
import { blockEmailsForUser, purgeUserData, snapshotUserData } from "../lib/userCleanup";
import { db } from "@workspace/db";
import {
  analyticsEvents,
  budgetItems,
  budgetPaymentLogs,
  budgets,
  checklistItems,
  contactMessageReplies,
  contactMessages,
  documents,
  feedbackSubmissions,
  guests,
  hotelBlocks,
  invitationCustomizations,
  manualExpenses,
  moodBoards,
  seatingCharts,
  supportTickets,
  timelines,
  vendorContacts,
  vendorContracts,
  vendorConversations,
  vendorMessages,
  vendorPayments,
  vendors,
  weddingParty,
  weddingWebsites,
  websiteRsvps,
  workspaceActivity,
  workspaceCollaborators,
} from "@workspace/db";
import { eq, inArray, or } from "drizzle-orm";
import { hasMinRole, resolveCallerRole, resolveProfile } from "../lib/workspaceAccess";

const router = Router();

async function getUserDeletionContext(userId: string): Promise<{
  emails: string[];
  firstName: string | null;
  lastName: string | null;
}> {
  try {
    const u = await clerkClient.users.getUser(userId);
    return {
      emails: (u.emailAddresses ?? [])
        .map((e) => e.emailAddress?.toLowerCase().trim())
        .filter((e): e is string => !!e),
      firstName: u.firstName ?? null,
      lastName: u.lastName ?? null,
    };
  } catch {
    return { emails: [], firstName: null, lastName: null };
  }
}

function safeFilenamePart(value: string | null | undefined): string {
  return (value ?? "wedding")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .toLowerCase() || "wedding";
}

function uniqueById<T extends { id: number }>(rows: T[]): T[] {
  return Array.from(new Map(rows.map((row) => [row.id, row])).values());
}

async function rowsByUserOrProfile<T>(
  table: T,
  userColumn: unknown,
  userId: string,
  profileColumn: unknown,
  profileId: number | null | undefined,
) {
  if (profileId) {
    return db
      .select()
      .from(table as never)
      .where(or(eq(userColumn as never, userId), eq(profileColumn as never, profileId))!);
  }
  return db.select().from(table as never).where(eq(userColumn as never, userId));
}

router.get("/account/export", requireAuth, async (req, res) => {
  const userId = req.userId!;

  try {
    const [userContext, profile, callerRole] = await Promise.all([
      getUserDeletionContext(userId),
      resolveProfile(req),
      resolveCallerRole(req),
    ]);

    if (profile && !hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Only workspace owners, partners, and planners can download a full planning backup." });
      return;
    }

    const profileId = profile?.id ?? null;
    const ownerUserId = profile?.userId ?? userId;

    const [
      timelineRows,
      checklistRows,
      guestRows,
      websiteRows,
      budgetRows,
      vendorRows,
      vendorContactRows,
      manualExpenseRows,
      documentRows,
      seatingRows,
      hotelRows,
      weddingPartyRows,
      moodBoardRows,
      invitationRows,
      contractRows,
      collaboratorRows,
      activityRows,
      analyticsRows,
      contactRows,
      feedbackRows,
      supportRows,
    ] = await Promise.all([
      profileId ? db.select().from(timelines).where(eq(timelines.profileId, profileId)) : Promise.resolve([]),
      profileId ? db.select().from(checklistItems).where(eq(checklistItems.profileId, profileId)) : Promise.resolve([]),
      profileId ? db.select().from(guests).where(eq(guests.profileId, profileId)) : Promise.resolve([]),
      profileId ? db.select().from(weddingWebsites).where(eq(weddingWebsites.profileId, profileId)) : Promise.resolve([]),
      profileId ? db.select().from(budgets).where(eq(budgets.profileId, profileId)) : Promise.resolve([]),
      profileId ? db.select().from(vendors).where(eq(vendors.profileId, profileId)) : Promise.resolve([]),
      profileId ? db.select().from(vendorContacts).where(eq(vendorContacts.profileId, profileId)) : Promise.resolve([]),
      rowsByUserOrProfile(manualExpenses, manualExpenses.userId, ownerUserId, manualExpenses.profileId, profileId),
      rowsByUserOrProfile(documents, documents.userId, ownerUserId, documents.profileId, profileId),
      rowsByUserOrProfile(seatingCharts, seatingCharts.userId, ownerUserId, seatingCharts.profileId, profileId),
      rowsByUserOrProfile(hotelBlocks, hotelBlocks.userId, ownerUserId, hotelBlocks.profileId, profileId),
      rowsByUserOrProfile(weddingParty, weddingParty.userId, ownerUserId, weddingParty.profileId, profileId),
      rowsByUserOrProfile(moodBoards, moodBoards.userId, ownerUserId, moodBoards.profileId, profileId),
      profileId ? db.select().from(invitationCustomizations).where(eq(invitationCustomizations.profileId, profileId)) : Promise.resolve([]),
      profileId
        ? db.select().from(vendorContracts).where(or(eq(vendorContracts.profileId, profileId), eq(vendorContracts.userId, ownerUserId))!)
        : db.select().from(vendorContracts).where(eq(vendorContracts.userId, userId)),
      profileId ? db.select().from(workspaceCollaborators).where(eq(workspaceCollaborators.profileId, profileId)) : Promise.resolve([]),
      profileId ? db.select().from(workspaceActivity).where(eq(workspaceActivity.profileId, profileId)) : db.select().from(workspaceActivity).where(eq(workspaceActivity.userId, userId)),
      db.select().from(analyticsEvents).where(eq(analyticsEvents.userId, userId)),
      db.select().from(contactMessages).where(eq(contactMessages.userId, userId)),
      db.select().from(feedbackSubmissions).where(eq(feedbackSubmissions.userId, userId)),
      profileId
        ? db.select().from(supportTickets).where(or(eq(supportTickets.userId, userId), eq(supportTickets.profileId, profileId))!)
        : db.select().from(supportTickets).where(eq(supportTickets.userId, userId)),
    ]);

    const budgetIds = budgetRows.map((budget) => budget.id);
    const budgetItemRows = budgetIds.length
      ? await db.select().from(budgetItems).where(inArray(budgetItems.budgetId, budgetIds))
      : [];
    const budgetItemIds = budgetItemRows.map((item) => item.id);
    const budgetPaymentRows = budgetItemIds.length
      ? await db.select().from(budgetPaymentLogs).where(inArray(budgetPaymentLogs.budgetItemId, budgetItemIds))
      : [];

    const vendorIds = vendorRows.map((vendor) => vendor.id);
    const vendorPaymentRows = vendorIds.length
      ? await db.select().from(vendorPayments).where(inArray(vendorPayments.vendorId, vendorIds))
      : [];

    const conversationRows = uniqueById([
      ...(vendorIds.length ? await db.select().from(vendorConversations).where(inArray(vendorConversations.vendorId, vendorIds)) : []),
      ...await db.select().from(vendorConversations).where(eq(vendorConversations.userId, userId)),
      ...(ownerUserId !== userId ? await db.select().from(vendorConversations).where(eq(vendorConversations.userId, ownerUserId)) : []),
    ]);
    const conversationIds = conversationRows.map((conversation) => conversation.id);
    const vendorMessageRows = conversationIds.length
      ? await db.select().from(vendorMessages).where(inArray(vendorMessages.conversationId, conversationIds))
      : [];

    const websiteIds = websiteRows.map((site) => site.id);
    const websiteRsvpRows = websiteIds.length
      ? await db.select().from(websiteRsvps).where(inArray(websiteRsvps.websiteId, websiteIds))
      : [];

    const contactIds = contactRows.map((message) => message.id);
    const contactReplyRows = contactIds.length
      ? await db.select().from(contactMessageReplies).where(inArray(contactMessageReplies.contactMessageId, contactIds))
      : [];

    const exportedAt = new Date().toISOString();
    const payload = {
      metadata: {
        app: "A.I Do",
        format: "aido-user-data-export-v1",
        exportedAt,
        exportedByUserId: userId,
        workspaceProfileId: profileId,
        workspaceRole: callerRole,
      },
      account: {
        userId,
        emails: userContext.emails,
        firstName: userContext.firstName,
        lastName: userContext.lastName,
      },
      workspace: {
        profile,
        collaborators: collaboratorRows,
        activity: activityRows,
      },
      planning: {
        timelines: timelineRows,
        checklistItems: checklistRows,
        budgets: budgetRows,
        budgetItems: budgetItemRows,
        budgetPaymentLogs: budgetPaymentRows,
        vendors: vendorRows,
        vendorContacts: vendorContactRows,
        vendorPayments: vendorPaymentRows,
        vendorContracts: contractRows,
        vendorConversations: conversationRows,
        vendorMessages: vendorMessageRows,
        manualExpenses: manualExpenseRows,
        guests: guestRows,
        hotelBlocks: hotelRows,
        weddingParty: weddingPartyRows,
        seatingCharts: seatingRows,
        documents: documentRows,
        moodBoards: moodBoardRows,
        invitationCustomizations: invitationRows,
        weddingWebsites: websiteRows,
        websiteRsvps: websiteRsvpRows,
      },
      accountRecords: {
        analyticsEvents: analyticsRows,
        contactMessages: contactRows,
        contactMessageReplies: contactReplyRows,
        feedbackSubmissions: feedbackRows,
        supportTickets: supportRows,
      },
      note: "Uploaded files are represented by their stored file metadata and URLs in this JSON backup.",
    };

    const couple = profile ? `${profile.partner1Name}-${profile.partner2Name}` : "account";
    const filename = `aido-data-backup-${safeFilenamePart(couple)}-${exportedAt.slice(0, 10)}.json`;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    req.log.error(err, "Failed to export account data");
    res.status(500).json({ error: "Could not export your data. Please try again." });
  }
});

router.delete("/account", requireAuth, async (req, res) => {
  const userId = req.userId!;

  try {
    const userContext = await getUserDeletionContext(userId);
    await snapshotUserData(userId, {
      email: userContext.emails[0] ?? null,
      firstName: userContext.firstName,
      lastName: userContext.lastName,
    });
    await blockEmailsForUser(userContext.emails, userId);
    await purgeUserData(userId, userContext.emails);
    await clerkClient.users.deleteUser(userId);
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "Failed to delete account");
    res.status(500).json({ error: "Failed to delete account. Please try again." });
  }
});

export default router;
