import { Router } from "express";
import {
  db, weddingProfiles, timelines, budgets, budgetItems, budgetPaymentLogs,
  checklistItems, guests, vendors, vendorPayments, hotelBlocks, weddingParty,
  seatingCharts, manualExpenses, vendorContracts, vendorConversations,
  vendorMessages, workspaceCollaborators, workspaceActivity, invitationCustomizations,
  weddingWebsites, websiteRsvps, moodBoards, deletedUserArchive,
} from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { getProfileByUserId, resolveWorkspaceRole, hasMinRole } from "../lib/workspaceAccess";

const router = Router();

router.post("/workspaces", requireAuth, async (req, res) => {
  try {
    const primaryProfile = await getProfileByUserId(req.userId!);
    if (!primaryProfile) {
      res.status(400).json({ error: "Create your default workspace first." });
      return;
    }
    if (primaryProfile.accountType !== "wedding_planner") {
      res.status(403).json({ error: "Multiple workstations are available for Wedding Planner accounts." });
      return;
    }

    const body = req.body as {
      partner1Name?: string;
      partner2Name?: string;
      weddingDate?: string;
      venue?: string;
      location?: string;
      workstationName?: string;
    };
    const partner1Name = body.partner1Name?.trim();
    const partner2Name = body.partner2Name?.trim();
    const weddingDate = body.weddingDate?.trim();

    if (!partner1Name || !partner2Name || !weddingDate) {
      res.status(400).json({ error: "Client names and wedding date are required." });
      return;
    }

    const [created] = await db
      .insert(weddingProfiles)
      .values({
        userId: req.userId!,
        workstationName: body.workstationName?.trim() || `${partner1Name} & ${partner2Name}`,
        partner1Name,
        partner2Name,
        weddingDate,
        ceremonyTime: "16:00",
        receptionTime: "18:00",
        venue: body.venue?.trim() || "TBD",
        location: body.location?.trim() || "TBD",
        guestCount: 1,
        totalBudget: "0",
        weddingVibe: "Not set",
        preferredLanguage: "English",
        accountType: "wedding_planner",
      })
      .returning();

    res.json({
      profileId: created.id,
      workstationName: created.workstationName,
      partner1Name: created.partner1Name,
      partner2Name: created.partner2Name,
      weddingDate: created.weddingDate,
      role: "owner",
      accountType: created.accountType,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/workspaces/:profileId", requireAuth, async (req, res) => {
  try {
    const profileId = parseInt(String(req.params["profileId"] ?? "0"), 10);
    const role = await resolveWorkspaceRole(req.userId!, profileId);
    if (role !== "owner") {
      res.status(403).json({ error: "Only the workstation owner can rename it." });
      return;
    }

    const workstationName = String((req.body as { workstationName?: string }).workstationName ?? "").trim();
    if (!workstationName) {
      res.status(400).json({ error: "Workstation name is required." });
      return;
    }

    const [updated] = await db
      .update(weddingProfiles)
      .set({ workstationName, updatedAt: new Date() })
      .where(eq(weddingProfiles.id, profileId))
      .returning();

    res.json({
      profileId: updated.id,
      workstationName: updated.workstationName,
      partner1Name: updated.partner1Name,
      partner2Name: updated.partner2Name,
      weddingDate: updated.weddingDate,
      role: "owner",
      accountType: updated.accountType,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/workspaces/:profileId", requireAuth, async (req, res) => {
  try {
    const profileId = parseInt(String(req.params["profileId"] ?? "0"), 10);
    if (!profileId || Number.isNaN(profileId)) {
      res.status(400).json({ error: "Invalid workstation." });
      return;
    }

    const primaryProfile = await getProfileByUserId(req.userId!);
    if (!primaryProfile) {
      res.status(400).json({ error: "Create your default workspace first." });
      return;
    }
    if (primaryProfile.id === profileId) {
      res.status(400).json({ error: "Your default workspace can only be removed by deleting your account." });
      return;
    }

    const role = await resolveWorkspaceRole(req.userId!, profileId);
    if (role !== "owner") {
      res.status(403).json({ error: "Only the workstation owner can delete it." });
      return;
    }

    const [profile] = await db
      .select({ id: weddingProfiles.id, workstationName: weddingProfiles.workstationName })
      .from(weddingProfiles)
      .where(eq(weddingProfiles.id, profileId))
      .limit(1);
    if (!profile) {
      res.status(404).json({ error: "Workstation not found." });
      return;
    }

    const fullProfile = await db.select().from(weddingProfiles).where(eq(weddingProfiles.id, profileId)).limit(1);
    const vendorRows = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.profileId, profileId));
    const budgetRows = await db.select({ id: budgets.id }).from(budgets).where(eq(budgets.profileId, profileId));
    const websiteRows = await db.select({ id: weddingWebsites.id }).from(weddingWebsites).where(eq(weddingWebsites.profileId, profileId));
    const vendorIds = vendorRows.map(v => v.id);
    const budgetIds = budgetRows.map(b => b.id);
    const websiteIds = websiteRows.map(w => w.id);
    const budgetItemRows = budgetIds.length > 0
      ? await db.select({ id: budgetItems.id }).from(budgetItems).where(inArray(budgetItems.budgetId, budgetIds))
      : [];
    const budgetItemIds = budgetItemRows.map(i => i.id);
    const conversationRows = vendorIds.length > 0
      ? await db.select({ id: vendorConversations.id }).from(vendorConversations).where(inArray(vendorConversations.vendorId, vendorIds))
      : [];
    const conversationIds = conversationRows.map(c => c.id);

    const archiveName = profile.workstationName?.trim() || "Deleted Workstation";
    const archivedData: Record<string, unknown> = {
      archiveType: "workspace",
      originalProfileId: profileId,
      profile: fullProfile[0] ?? null,
      timelines: await db.select().from(timelines).where(eq(timelines.profileId, profileId)),
      checklistItems: await db.select().from(checklistItems).where(eq(checklistItems.profileId, profileId)),
      guests: await db.select().from(guests).where(eq(guests.profileId, profileId)),
      budgets: await db.select().from(budgets).where(eq(budgets.profileId, profileId)),
      budgetItems: budgetIds.length > 0 ? await db.select().from(budgetItems).where(inArray(budgetItems.budgetId, budgetIds)) : [],
      budgetPaymentLogs: budgetItemIds.length > 0 ? await db.select().from(budgetPaymentLogs).where(inArray(budgetPaymentLogs.budgetItemId, budgetItemIds)) : [],
      vendors: await db.select().from(vendors).where(eq(vendors.profileId, profileId)),
      vendorPayments: vendorIds.length > 0 ? await db.select().from(vendorPayments).where(inArray(vendorPayments.vendorId, vendorIds)) : [],
      vendorConversations: vendorIds.length > 0 ? await db.select().from(vendorConversations).where(inArray(vendorConversations.vendorId, vendorIds)) : [],
      vendorMessages: conversationIds.length > 0 ? await db.select().from(vendorMessages).where(inArray(vendorMessages.conversationId, conversationIds)) : [],
      manualExpenses: await db.select().from(manualExpenses).where(eq(manualExpenses.profileId, profileId)),
      vendorContracts: await db.select().from(vendorContracts).where(eq(vendorContracts.profileId, profileId)),
      seatingCharts: await db.select().from(seatingCharts).where(eq(seatingCharts.profileId, profileId)),
      hotelBlocks: await db.select().from(hotelBlocks).where(eq(hotelBlocks.profileId, profileId)),
      weddingParty: await db.select().from(weddingParty).where(eq(weddingParty.profileId, profileId)),
      invitationCustomizations: await db.select().from(invitationCustomizations).where(eq(invitationCustomizations.profileId, profileId)),
      weddingWebsites: await db.select().from(weddingWebsites).where(eq(weddingWebsites.profileId, profileId)),
      websiteRsvps: websiteIds.length > 0 ? await db.select().from(websiteRsvps).where(inArray(websiteRsvps.websiteId, websiteIds)) : [],
      moodBoards: await db.select().from(moodBoards).where(eq(moodBoards.profileId, profileId)),
      workspaceCollaborators: await db.select().from(workspaceCollaborators).where(eq(workspaceCollaborators.profileId, profileId)),
      workspaceActivity: await db.select().from(workspaceActivity).where(eq(workspaceActivity.profileId, profileId)),
    };

    await db.insert(deletedUserArchive).values({
      userId: req.userId!,
      email: null,
      firstName: "Workstation",
      lastName: archiveName,
      archivedData,
    });

    if (vendorRows.length > 0) {
      const vendorIds = vendorRows.map(v => v.id);
      const conversations = await db.select({ id: vendorConversations.id }).from(vendorConversations).where(inArray(vendorConversations.vendorId, vendorIds));
      if (conversations.length > 0) {
        await db.delete(vendorMessages).where(inArray(vendorMessages.conversationId, conversations.map(c => c.id)));
      }
      await db.delete(vendorConversations).where(inArray(vendorConversations.vendorId, vendorIds));
      await db.delete(vendorPayments).where(inArray(vendorPayments.vendorId, vendorIds));
    }

    if (budgetRows.length > 0) {
      const budgetIds = budgetRows.map(b => b.id);
      const itemRows = await db.select({ id: budgetItems.id }).from(budgetItems).where(inArray(budgetItems.budgetId, budgetIds));
      if (itemRows.length > 0) {
        await db.delete(budgetPaymentLogs).where(inArray(budgetPaymentLogs.budgetItemId, itemRows.map(i => i.id)));
      }
      await db.delete(budgetItems).where(inArray(budgetItems.budgetId, budgetIds));
    }

    if (websiteRows.length > 0) {
      await db.delete(websiteRsvps).where(inArray(websiteRsvps.websiteId, websiteRows.map(w => w.id)));
    }

    await db.delete(vendors).where(eq(vendors.profileId, profileId));
    await db.delete(budgets).where(eq(budgets.profileId, profileId));
    await db.delete(timelines).where(eq(timelines.profileId, profileId));
    await db.delete(checklistItems).where(eq(checklistItems.profileId, profileId));
    await db.delete(guests).where(eq(guests.profileId, profileId));
    await db.delete(hotelBlocks).where(eq(hotelBlocks.profileId, profileId));
    await db.delete(weddingParty).where(eq(weddingParty.profileId, profileId));
    await db.delete(seatingCharts).where(eq(seatingCharts.profileId, profileId));
    await db.delete(manualExpenses).where(eq(manualExpenses.profileId, profileId));
    await db.delete(vendorContracts).where(eq(vendorContracts.profileId, profileId));
    await db.delete(invitationCustomizations).where(eq(invitationCustomizations.profileId, profileId));
    await db.delete(weddingWebsites).where(eq(weddingWebsites.profileId, profileId));
    await db.delete(moodBoards).where(eq(moodBoards.profileId, profileId));
    await db.delete(workspaceActivity).where(eq(workspaceActivity.profileId, profileId));
    await db.delete(workspaceCollaborators).where(eq(workspaceCollaborators.profileId, profileId));
    await db.delete(weddingProfiles).where(eq(weddingProfiles.id, profileId));

    res.json({ ok: true, deletedProfileId: profile.id, archived: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

async function getWorkspaceProfile(userId: string, profileId: number) {
  const role = await resolveWorkspaceRole(userId, profileId);
  if (!role) return null;

  const rows = await db
    .select()
    .from(weddingProfiles)
    .where(eq(weddingProfiles.id, profileId))
    .limit(1);

  if (!rows.length) return null;
  return { profile: rows[0], role };
}

router.get("/workspace/:profileId", requireAuth, async (req, res) => {
  try {
    const profileId = parseInt(String(req.params["profileId"] ?? "0"), 10);
    const result = await getWorkspaceProfile(req.userId!, profileId);
    if (!result) {
      res.status(403).json({ error: "Access denied." });
      return;
    }

    const isVendor = result.role === "vendor";
    const profileData: Record<string, unknown> = isVendor
      ? {
          id: result.profile.id,
          partner1Name: result.profile.partner1Name,
          partner2Name: result.profile.partner2Name,
          weddingDate: result.profile.weddingDate,
          ceremonyTime: result.profile.ceremonyTime,
          receptionTime: result.profile.receptionTime,
          venue: result.profile.venue,
          location: result.profile.location,
          venueCity: result.profile.venueCity,
          venueState: result.profile.venueState,
          venueZip: result.profile.venueZip,
          venueCountry: result.profile.venueCountry,
          updatedAt: result.profile.updatedAt.toISOString(),
        }
      : {
          ...result.profile,
          totalBudget: parseFloat(result.profile.totalBudget as string),
          updatedAt: result.profile.updatedAt.toISOString(),
        };
    res.json({ profile: profileData, role: result.role });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/workspace/:profileId/timeline", requireAuth, async (req, res) => {
  try {
    const profileId = parseInt(String(req.params["profileId"] ?? "0"), 10);
    const result = await getWorkspaceProfile(req.userId!, profileId);
    if (!result) {
      res.status(403).json({ error: "Access denied." });
      return;
    }

    const rows = await db
      .select()
      .from(timelines)
      .where(eq(timelines.profileId, profileId))
      .orderBy(desc(timelines.generatedAt))
      .limit(1);

    if (!rows.length) {
      res.json({ events: [], role: result.role });
      return;
    }

    res.json({
      id: rows[0].id,
      events: rows[0].events,
      generatedAt: rows[0].generatedAt.toISOString(),
      role: result.role,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/workspace/:profileId/budget", requireAuth, async (req, res) => {
  try {
    const profileId = parseInt(String(req.params["profileId"] ?? "0"), 10);
    const result = await getWorkspaceProfile(req.userId!, profileId);
    if (!result) {
      res.status(403).json({ error: "Access denied." });
      return;
    }

    if (!hasMinRole(result.role, "planner")) {
      res.status(403).json({ error: "Insufficient permissions." });
      return;
    }

    const budgetRows = await db
      .select()
      .from(budgets)
      .where(eq(budgets.profileId, profileId))
      .limit(1);

    if (!budgetRows.length) {
      res.json({ budget: null, items: [], role: result.role });
      return;
    }

    const items = await db
      .select()
      .from(budgetItems)
      .where(eq(budgetItems.budgetId, budgetRows[0].id));

    res.json({
      budget: {
        ...budgetRows[0],
        totalBudget: parseFloat(budgetRows[0].totalBudget as string),
        updatedAt: budgetRows[0].updatedAt.toISOString(),
      },
      items: items.map(i => ({
        ...i,
        estimatedCost: parseFloat(i.estimatedCost as string),
        actualCost: parseFloat(i.actualCost as string),
      })),
      role: result.role,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/workspace/:profileId/checklist", requireAuth, async (req, res) => {
  try {
    const profileId = parseInt(String(req.params["profileId"] ?? "0"), 10);
    const result = await getWorkspaceProfile(req.userId!, profileId);
    if (!result) {
      res.status(403).json({ error: "Access denied." });
      return;
    }

    if (!hasMinRole(result.role, "planner")) {
      res.status(403).json({ error: "Insufficient permissions." });
      return;
    }

    const items = await db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.profileId, profileId));

    res.json({
      items: items.map(i => ({
        ...i,
        completedAt: i.completedAt?.toISOString() ?? null,
      })),
      role: result.role,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/workspace/:profileId/guests", requireAuth, async (req, res) => {
  try {
    const profileId = parseInt(String(req.params["profileId"] ?? "0"), 10);
    const result = await getWorkspaceProfile(req.userId!, profileId);
    if (!result) { res.status(403).json({ error: "Access denied." }); return; }
    if (!hasMinRole(result.role, "planner")) { res.status(403).json({ error: "Insufficient permissions." }); return; }

    const rows = await db.select().from(guests).where(eq(guests.profileId, profileId));
    const plusOneCount = rows.filter(g => g.plusOne).length;
    const total = rows.length + plusOneCount;
    res.json({
      total,
      attending: rows.filter(g => g.rsvpStatus === "attending").length + rows.filter(g => g.rsvpStatus === "attending" && g.plusOne).length,
      declined: rows.filter(g => g.rsvpStatus === "declined").length + rows.filter(g => g.rsvpStatus === "declined" && g.plusOne).length,
      maybe: rows.filter(g => g.rsvpStatus === "maybe").length + rows.filter(g => g.rsvpStatus === "maybe" && g.plusOne).length,
      pending: rows.filter(g => g.rsvpStatus === "pending").length + rows.filter(g => g.rsvpStatus === "pending" && g.plusOne).length,
      plusOnes: plusOneCount,
      role: result.role,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/workspace/:profileId/vendors", requireAuth, async (req, res) => {
  try {
    const profileId = parseInt(String(req.params["profileId"] ?? "0"), 10);
    const result = await getWorkspaceProfile(req.userId!, profileId);
    if (!result) { res.status(403).json({ error: "Access denied." }); return; }
    if (!hasMinRole(result.role, "planner")) { res.status(403).json({ error: "Insufficient permissions." }); return; }

    const rows = await db.select().from(vendors).where(eq(vendors.profileId, profileId));
    res.json({ vendors: rows.map(v => ({ id: v.id, name: v.name, category: v.category, contractSigned: v.contractSigned })), role: result.role });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/workspace/:profileId/hotels", requireAuth, async (req, res) => {
  try {
    const profileId = parseInt(String(req.params["profileId"] ?? "0"), 10);
    const result = await getWorkspaceProfile(req.userId!, profileId);
    if (!result) { res.status(403).json({ error: "Access denied." }); return; }
    if (!hasMinRole(result.role, "planner")) { res.status(403).json({ error: "Insufficient permissions." }); return; }

    const rows = await db.select().from(hotelBlocks).where(eq(hotelBlocks.profileId, profileId));
    res.json({ hotels: rows.map(h => ({ id: h.id, hotelName: h.hotelName, address: h.address, phone: h.phone, bookingLink: h.bookingLink, discountCode: h.discountCode, cutoffDate: h.cutoffDate, roomsReserved: h.roomsReserved, roomsBooked: h.roomsBooked, pricePerNight: h.pricePerNight != null ? Number(h.pricePerNight) : null, distanceFromVenue: h.distanceFromVenue })), role: result.role });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/workspace/:profileId/wedding-party", requireAuth, async (req, res) => {
  try {
    const profileId = parseInt(String(req.params["profileId"] ?? "0"), 10);
    const result = await getWorkspaceProfile(req.userId!, profileId);
    if (!result) { res.status(403).json({ error: "Access denied." }); return; }
    if (!hasMinRole(result.role, "planner")) { res.status(403).json({ error: "Insufficient permissions." }); return; }

    const rows = await db.select().from(weddingParty).where(eq(weddingParty.profileId, profileId));
    res.json({ members: rows.map(m => ({ id: m.id, name: m.name, role: m.role, side: m.side, phone: m.phone, email: m.email })), role: result.role });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/workspace/:profileId/seating", requireAuth, async (req, res) => {
  try {
    const profileId = parseInt(String(req.params["profileId"] ?? "0"), 10);
    const result = await getWorkspaceProfile(req.userId!, profileId);
    if (!result) { res.status(403).json({ error: "Access denied." }); return; }
    if (!hasMinRole(result.role, "planner")) { res.status(403).json({ error: "Insufficient permissions." }); return; }

    const rows = await db.select().from(seatingCharts).where(eq(seatingCharts.profileId, profileId)).orderBy(desc(seatingCharts.createdAt));
    res.json({ charts: rows.map(c => ({ id: c.id, name: c.name, tableCount: c.tableCount, seatsPerTable: c.seatsPerTable, tables: c.tables, createdAt: c.createdAt.toISOString() })), role: result.role });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/workspace/:profileId/activity", requireAuth, async (req, res) => {
  try {
    const profileId = parseInt(String(req.params["profileId"] ?? "0"), 10);
    const result = await getWorkspaceProfile(req.userId!, profileId);
    if (!result) { res.status(403).json({ error: "Access denied." }); return; }
    if (!hasMinRole(result.role, "planner")) { res.status(403).json({ error: "Insufficient permissions." }); return; }

    const limitParam = req.query["limit"];
    const limit = parseInt(typeof limitParam === "string" ? limitParam : "50");
    const activities = await db
      .select()
      .from(workspaceActivity)
      .where(eq(workspaceActivity.profileId, profileId))
      .orderBy(desc(workspaceActivity.createdAt))
      .limit(limit);

    res.json({
      activities: activities.map(a => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      })),
      role: result.role,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
