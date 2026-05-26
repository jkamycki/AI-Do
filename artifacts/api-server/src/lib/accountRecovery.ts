import { db } from "@workspace/db";
import {
  budgetItems,
  budgetPaymentLogs,
  budgets,
  checklistItems,
  documents,
  guestPhotoUploads,
  guests,
  hotelBlocks,
  invitationCustomizations,
  manualExpensePayments,
  manualExpenses,
  moodBoards,
  seatingCharts,
  timelines,
  vendorContacts,
  vendorContracts,
  vendorConversations,
  vendorMessages,
  vendorPayments,
  vendors,
  weddingParty,
  weddingProfiles,
  weddingWebsites,
  websiteRsvps,
  workspaceRecoverySnapshots,
} from "@workspace/db";
import { desc, eq, inArray, or } from "drizzle-orm";
import { logger } from "./logger";

const RECOVERY_FORMAT = "aido-workspace-recovery-v1";
const MAX_RECOVERY_POINTS = 30;

type RecoverySnapshot = {
  format: typeof RECOVERY_FORMAT;
  createdAt: string;
  profileId: number;
  ownerUserId: string;
  reason: string;
  resourceType: string | null;
  workspace: {
    profile: Record<string, unknown> | null;
  };
  planning: Record<string, unknown[]>;
  note: string;
};

function countRows(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function buildSummary(snapshot: RecoverySnapshot) {
  const planning = snapshot.planning;
  return {
    guests: countRows(planning.guests),
    checklistItems: countRows(planning.checklistItems),
    vendors: countRows(planning.vendors),
    budgetItems: countRows(planning.budgetItems),
    weddingWebsites: countRows(planning.weddingWebsites),
    documents: countRows(planning.documents),
    photoUploads: countRows(planning.guestPhotoUploads),
  };
}

function asRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object") : [];
}

async function rowsByUserOrProfile<T>(
  table: T,
  userColumn: unknown,
  userId: string,
  profileColumn: unknown,
  profileId: number,
) {
  return db
    .select()
    .from(table as never)
    .where(or(eq(userColumn as never, userId), eq(profileColumn as never, profileId))!);
}

async function pruneOldRecoveryPoints(profileId: number) {
  const rows = await db
    .select({ id: workspaceRecoverySnapshots.id })
    .from(workspaceRecoverySnapshots)
    .where(eq(workspaceRecoverySnapshots.profileId, profileId))
    .orderBy(desc(workspaceRecoverySnapshots.createdAt))
    .limit(MAX_RECOVERY_POINTS + 20);

  const staleIds = rows.slice(MAX_RECOVERY_POINTS).map((row) => row.id);
  if (staleIds.length) {
    await db.delete(workspaceRecoverySnapshots).where(inArray(workspaceRecoverySnapshots.id, staleIds));
  }
}

export async function buildWorkspaceRecoverySnapshot(
  profileId: number,
  userId: string,
  reason: string,
  resourceType?: string | null,
): Promise<RecoverySnapshot> {
  const profileRows = await db
    .select()
    .from(weddingProfiles)
    .where(eq(weddingProfiles.id, profileId))
    .limit(1);
  const profile = profileRows[0] ?? null;
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
    photoRows,
  ] = await Promise.all([
    db.select().from(timelines).where(eq(timelines.profileId, profileId)),
    db.select().from(checklistItems).where(eq(checklistItems.profileId, profileId)),
    db.select().from(guests).where(eq(guests.profileId, profileId)),
    db.select().from(weddingWebsites).where(eq(weddingWebsites.profileId, profileId)),
    db.select().from(budgets).where(eq(budgets.profileId, profileId)),
    db.select().from(vendors).where(eq(vendors.profileId, profileId)),
    db.select().from(vendorContacts).where(eq(vendorContacts.profileId, profileId)),
    rowsByUserOrProfile(manualExpenses, manualExpenses.userId, ownerUserId, manualExpenses.profileId, profileId),
    rowsByUserOrProfile(documents, documents.userId, ownerUserId, documents.profileId, profileId),
    rowsByUserOrProfile(seatingCharts, seatingCharts.userId, ownerUserId, seatingCharts.profileId, profileId),
    rowsByUserOrProfile(hotelBlocks, hotelBlocks.userId, ownerUserId, hotelBlocks.profileId, profileId),
    rowsByUserOrProfile(weddingParty, weddingParty.userId, ownerUserId, weddingParty.profileId, profileId),
    rowsByUserOrProfile(moodBoards, moodBoards.userId, ownerUserId, moodBoards.profileId, profileId),
    db.select().from(invitationCustomizations).where(eq(invitationCustomizations.profileId, profileId)),
    db
      .select()
      .from(vendorContracts)
      .where(or(eq(vendorContracts.profileId, profileId), eq(vendorContracts.userId, ownerUserId))!),
    db.select().from(guestPhotoUploads).where(eq(guestPhotoUploads.profileId, profileId)),
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
  const manualExpenseIds = manualExpenseRows.map((expense) => expense.id);
  const manualExpensePaymentRows = manualExpenseIds.length
    ? await db.select().from(manualExpensePayments).where(inArray(manualExpensePayments.manualExpenseId, manualExpenseIds))
    : [];
  const conversationRows = vendorIds.length
    ? await db.select().from(vendorConversations).where(inArray(vendorConversations.vendorId, vendorIds))
    : [];
  const conversationIds = conversationRows.map((conversation) => conversation.id);
  const vendorMessageRows = conversationIds.length
    ? await db.select().from(vendorMessages).where(inArray(vendorMessages.conversationId, conversationIds))
    : [];

  const websiteIds = websiteRows.map((site) => site.id);
  const websiteRsvpRows = websiteIds.length
    ? await db.select().from(websiteRsvps).where(inArray(websiteRsvps.websiteId, websiteIds))
    : [];

  return {
    format: RECOVERY_FORMAT,
    createdAt: new Date().toISOString(),
    profileId,
    ownerUserId,
    reason,
    resourceType: resourceType ?? null,
    workspace: {
      profile: profile ? { ...profile } : null,
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
      manualExpensePayments: manualExpensePaymentRows,
      guests: guestRows,
      hotelBlocks: hotelRows,
      weddingParty: weddingPartyRows,
      seatingCharts: seatingRows,
      documents: documentRows,
      moodBoards: moodBoardRows,
      invitationCustomizations: invitationRows,
      weddingWebsites: websiteRows,
      websiteRsvps: websiteRsvpRows,
      guestPhotoUploads: photoRows,
    },
    note: "Recovery snapshots contain planning records and stored file URLs, not the uploaded file bytes themselves.",
  };
}

export async function createWorkspaceRecoverySnapshot(
  profileId: number,
  userId: string,
  reason: string,
  resourceType?: string | null,
) {
  const snapshot = await buildWorkspaceRecoverySnapshot(profileId, userId, reason, resourceType);
  const summary = buildSummary(snapshot);
  const [created] = await db
    .insert(workspaceRecoverySnapshots)
    .values({
      profileId,
      userId,
      reason,
      resourceType: resourceType ?? null,
      summary,
      snapshot,
    })
    .returning({
      id: workspaceRecoverySnapshots.id,
      createdAt: workspaceRecoverySnapshots.createdAt,
      summary: workspaceRecoverySnapshots.summary,
    });

  await pruneOldRecoveryPoints(profileId);
  return created;
}

async function deleteIn(database: any, table: unknown, column: unknown, ids: number[]) {
  if (ids.length) {
    await database.delete(table).where(inArray(column as never, ids));
  }
}

async function insertMany(database: any, table: unknown, rows: unknown[]) {
  if (rows.length) {
    await database.insert(table).values(rows as never);
  }
}

function restoredRows(rows: Record<string, unknown>[], profileId: number, ownerUserId?: string) {
  return rows.map((row) => ({
    ...row,
    profileId: "profileId" in row ? profileId : row.profileId,
    userId: ownerUserId && "userId" in row ? ownerUserId : row.userId,
  }));
}

export async function restoreWorkspaceRecoverySnapshot(options: {
  profileId: number;
  snapshotId: number;
  restoredBy: string;
}) {
  const snapshotRows = await db
    .select()
    .from(workspaceRecoverySnapshots)
    .where(eq(workspaceRecoverySnapshots.id, options.snapshotId))
    .limit(1);

  const row = snapshotRows[0];
  if (!row || row.profileId !== options.profileId) {
    throw new Error("Recovery point not found for this workspace.");
  }

  const snapshot = row.snapshot as unknown as RecoverySnapshot;
  if (!snapshot || snapshot.format !== RECOVERY_FORMAT || snapshot.profileId !== options.profileId) {
    throw new Error("This recovery point is not compatible with the current workspace.");
  }
  if (!snapshot.workspace.profile) {
    throw new Error("This recovery point is missing the wedding profile.");
  }

  await createWorkspaceRecoverySnapshot(options.profileId, options.restoredBy, "Safety copy before restore", "account_recovery");

  const planning = snapshot.planning ?? {};
  const ownerUserId = snapshot.ownerUserId || options.restoredBy;

  const result = await db.transaction(async (tx) => {
    const database: any = tx;

    const currentBudgets = await database.select().from(budgets).where(eq(budgets.profileId, options.profileId));
    const currentBudgetIds = currentBudgets.map((budget: { id: number }) => budget.id);
    const currentBudgetItems = currentBudgetIds.length
      ? await database.select().from(budgetItems).where(inArray(budgetItems.budgetId, currentBudgetIds))
      : [];
    const currentBudgetItemIds = currentBudgetItems.map((item: { id: number }) => item.id);

    const currentVendors = await database.select().from(vendors).where(eq(vendors.profileId, options.profileId));
    const currentVendorIds = currentVendors.map((vendor: { id: number }) => vendor.id);
    const currentConversations = currentVendorIds.length
      ? await database.select().from(vendorConversations).where(inArray(vendorConversations.vendorId, currentVendorIds))
      : [];
    const currentConversationIds = currentConversations.map((conversation: { id: number }) => conversation.id);

    const currentWebsites = await database.select().from(weddingWebsites).where(eq(weddingWebsites.profileId, options.profileId));
    const currentWebsiteIds = currentWebsites.map((site: { id: number }) => site.id);

    await deleteIn(database, budgetPaymentLogs, budgetPaymentLogs.budgetItemId, currentBudgetItemIds);
    await deleteIn(database, budgetItems, budgetItems.budgetId, currentBudgetIds);
    await database.delete(budgets).where(eq(budgets.profileId, options.profileId));

    await deleteIn(database, vendorMessages, vendorMessages.conversationId, currentConversationIds);
    await deleteIn(database, vendorConversations, vendorConversations.vendorId, currentVendorIds);
    await deleteIn(database, vendorPayments, vendorPayments.vendorId, currentVendorIds);
    await database.delete(vendorContacts).where(eq(vendorContacts.profileId, options.profileId));
    await database.delete(vendorContracts).where(or(eq(vendorContracts.profileId, options.profileId), eq(vendorContracts.userId, ownerUserId))!);
    await database.delete(vendors).where(eq(vendors.profileId, options.profileId));

    await database.delete(timelines).where(eq(timelines.profileId, options.profileId));
    await database.delete(checklistItems).where(eq(checklistItems.profileId, options.profileId));
    await database.delete(guests).where(eq(guests.profileId, options.profileId));
    const currentManualExpenses = await database
      .select({ id: manualExpenses.id })
      .from(manualExpenses)
      .where(or(eq(manualExpenses.profileId, options.profileId), eq(manualExpenses.userId, ownerUserId))!);
    await deleteIn(database, manualExpensePayments, manualExpensePayments.manualExpenseId, currentManualExpenses.map((expense: { id: number }) => expense.id));
    await database.delete(manualExpenses).where(or(eq(manualExpenses.profileId, options.profileId), eq(manualExpenses.userId, ownerUserId))!);
    await database.delete(documents).where(or(eq(documents.profileId, options.profileId), eq(documents.userId, ownerUserId))!);
    await database.delete(seatingCharts).where(or(eq(seatingCharts.profileId, options.profileId), eq(seatingCharts.userId, ownerUserId))!);
    await database.delete(hotelBlocks).where(or(eq(hotelBlocks.profileId, options.profileId), eq(hotelBlocks.userId, ownerUserId))!);
    await database.delete(weddingParty).where(or(eq(weddingParty.profileId, options.profileId), eq(weddingParty.userId, ownerUserId))!);
    await database.delete(moodBoards).where(or(eq(moodBoards.profileId, options.profileId), eq(moodBoards.userId, ownerUserId))!);
    await database.delete(invitationCustomizations).where(eq(invitationCustomizations.profileId, options.profileId));
    await database.delete(guestPhotoUploads).where(eq(guestPhotoUploads.profileId, options.profileId));
    await deleteIn(database, websiteRsvps, websiteRsvps.websiteId, currentWebsiteIds);
    await database.delete(weddingWebsites).where(eq(weddingWebsites.profileId, options.profileId));

    const profileUpdate = {
      ...(snapshot.workspace.profile ?? {}),
      id: undefined,
      userId: ownerUserId,
      updatedAt: new Date(),
    };
    delete profileUpdate.id;

    await database
      .update(weddingProfiles)
      .set(profileUpdate)
      .where(eq(weddingProfiles.id, options.profileId));

    await insertMany(database, timelines, restoredRows(asRows(planning.timelines), options.profileId));
    await insertMany(database, checklistItems, restoredRows(asRows(planning.checklistItems), options.profileId));
    await insertMany(database, budgets, restoredRows(asRows(planning.budgets), options.profileId));
    await insertMany(database, budgetItems, asRows(planning.budgetItems));
    await insertMany(database, budgetPaymentLogs, asRows(planning.budgetPaymentLogs));
    await insertMany(database, vendors, restoredRows(asRows(planning.vendors), options.profileId, ownerUserId));
    await insertMany(database, vendorContacts, restoredRows(asRows(planning.vendorContacts), options.profileId));
    await insertMany(database, vendorPayments, asRows(planning.vendorPayments));
    await insertMany(database, vendorContracts, restoredRows(asRows(planning.vendorContracts), options.profileId, ownerUserId));
    await insertMany(database, vendorConversations, restoredRows(asRows(planning.vendorConversations), options.profileId, ownerUserId));
    await insertMany(database, vendorMessages, asRows(planning.vendorMessages));
    await insertMany(database, manualExpenses, restoredRows(asRows(planning.manualExpenses), options.profileId, ownerUserId));
    await insertMany(database, manualExpensePayments, asRows(planning.manualExpensePayments));
    await insertMany(database, guests, restoredRows(asRows(planning.guests), options.profileId));
    await insertMany(database, hotelBlocks, restoredRows(asRows(planning.hotelBlocks), options.profileId, ownerUserId));
    await insertMany(database, weddingParty, restoredRows(asRows(planning.weddingParty), options.profileId, ownerUserId));
    await insertMany(database, seatingCharts, restoredRows(asRows(planning.seatingCharts), options.profileId, ownerUserId));
    await insertMany(database, documents, restoredRows(asRows(planning.documents), options.profileId, ownerUserId));
    await insertMany(database, moodBoards, restoredRows(asRows(planning.moodBoards), options.profileId, ownerUserId));
    await insertMany(database, invitationCustomizations, restoredRows(asRows(planning.invitationCustomizations), options.profileId));
    await insertMany(database, weddingWebsites, restoredRows(asRows(planning.weddingWebsites), options.profileId));
    await insertMany(database, websiteRsvps, asRows(planning.websiteRsvps));
    await insertMany(database, guestPhotoUploads, restoredRows(asRows(planning.guestPhotoUploads), options.profileId));

    await database
      .update(workspaceRecoverySnapshots)
      .set({ restoredAt: new Date(), restoredBy: options.restoredBy })
      .where(eq(workspaceRecoverySnapshots.id, options.snapshotId));

    return buildSummary(snapshot);
  });

  logger.warn(
    { profileId: options.profileId, snapshotId: options.snapshotId, restoredBy: options.restoredBy },
    "Workspace restored from user recovery snapshot",
  );

  return result;
}
