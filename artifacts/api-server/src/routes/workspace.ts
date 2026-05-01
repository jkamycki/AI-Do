import { Router } from "express";
import { db, weddingProfiles, timelines, budgets, budgetItems, checklistItems, guests, vendors, hotelBlocks, weddingParty, seatingCharts } from "@workspace/db";
import { workspaceActivity } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { resolveWorkspaceRole, hasMinRole } from "../lib/workspaceAccess";

const router = Router();

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
    const profileData: Record<string, unknown> = {
      ...result.profile,
      totalBudget: parseFloat(result.profile.totalBudget as string),
      updatedAt: result.profile.updatedAt.toISOString(),
    };
    if (isVendor) {
      delete profileData["guestCollectionToken"];
      delete profileData["vendorBccEmail"];
      delete profileData["totalBudget"];
      delete profileData["guestCount"];
    }
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

    const ownerUserId = result.profile.userId;
    const rows = await db.select().from(vendors).where(eq(vendors.userId, ownerUserId));
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

    const ownerUserId = result.profile.userId;
    const rows = await db.select().from(hotelBlocks).where(eq(hotelBlocks.userId, ownerUserId));
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

    const ownerUserId = result.profile.userId;
    const rows = await db.select().from(weddingParty).where(eq(weddingParty.userId, ownerUserId));
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

    const ownerUserId = result.profile.userId;
    const rows = await db.select().from(seatingCharts).where(eq(seatingCharts.userId, ownerUserId)).orderBy(desc(seatingCharts.createdAt));
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
