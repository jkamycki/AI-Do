import { Router } from "express";
import { db, weddingProfiles, timelines, budgets, budgetItems, checklistItems, workspaceActivity } from "@workspace/db";
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

  return rows.length ? { profile: rows[0], role } : null;
}

router.get("/workspace/:profileId", requireAuth, async (req, res) => {
  try {
    const profileId = parseInt(req.params.profileId);
    const result = await getWorkspaceProfile(req.userId!, profileId);
    if (!result) return res.status(403).json({ error: "Access denied." });

    res.json({
      profile: {
        ...result.profile,
        totalBudget: parseFloat(result.profile.totalBudget as string),
        updatedAt: result.profile.updatedAt.toISOString(),
      },
      role: result.role,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/workspace/:profileId/timeline", requireAuth, async (req, res) => {
  try {
    const profileId = parseInt(req.params.profileId);
    const result = await getWorkspaceProfile(req.userId!, profileId);
    if (!result) return res.status(403).json({ error: "Access denied." });

    const rows = await db
      .select()
      .from(timelines)
      .where(eq(timelines.profileId, profileId))
      .orderBy(desc(timelines.generatedAt))
      .limit(1);

    if (!rows.length) return res.json({ events: [], role: result.role });

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
    const profileId = parseInt(req.params.profileId);
    const result = await getWorkspaceProfile(req.userId!, profileId);
    if (!result) return res.status(403).json({ error: "Access denied." });

    if (!hasMinRole(result.role, "planner")) {
      return res.status(403).json({ error: "Insufficient permissions." });
    }

    const budgetRows = await db
      .select()
      .from(budgets)
      .where(eq(budgets.profileId, profileId))
      .limit(1);

    if (!budgetRows.length) return res.json({ budget: null, items: [], role: result.role });

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
    const profileId = parseInt(req.params.profileId);
    const result = await getWorkspaceProfile(req.userId!, profileId);
    if (!result) return res.status(403).json({ error: "Access denied." });

    if (!hasMinRole(result.role, "planner")) {
      return res.status(403).json({ error: "Insufficient permissions." });
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

router.get("/workspace/:profileId/activity", requireAuth, async (req, res) => {
  try {
    const profileId = parseInt(req.params.profileId);
    const result = await getWorkspaceProfile(req.userId!, profileId);
    if (!result) return res.status(403).json({ error: "Access denied." });

    const limit = parseInt(String(req.query.limit ?? "50"));
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
