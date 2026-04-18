import { Router } from "express";
import { db } from "@workspace/db";
import { weddingProfiles, timelines, budgets, budgetItems, checklistItems } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/dashboard/summary", async (req, res) => {
  try {
    const profiles = await db.select().from(weddingProfiles).limit(1);
    const hasProfile = profiles.length > 0;

    let daysUntilWedding = 0;
    if (hasProfile) {
      const weddingDate = new Date(profiles[0].weddingDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      daysUntilWedding = Math.max(0, Math.ceil((weddingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    }

    const timelineRows = await db.select().from(timelines).orderBy(desc(timelines.id)).limit(1);
    const hasTimeline = timelineRows.length > 0;
    const timelineEventCount = hasTimeline ? (timelineRows[0].events as Array<unknown>).length : 0;

    const budgetRows = await db.select().from(budgets).limit(1);
    let budgetTotal = 0;
    let budgetSpent = 0;
    if (budgetRows.length) {
      budgetTotal = parseFloat(budgetRows[0].totalBudget as string);
      const items = await db.select().from(budgetItems).where(eq(budgetItems.budgetId, budgetRows[0].id));
      budgetSpent = items.reduce((sum, item) => sum + parseFloat(item.actualCost as string), 0);
    }

    const allChecklistItems = await db.select().from(checklistItems);
    const hasChecklist = allChecklistItems.length > 0;
    const checklistTotal = allChecklistItems.length;
    const checklistCompleted = allChecklistItems.filter(item => item.isCompleted).length;
    const checklistProgress = checklistTotal > 0 ? (checklistCompleted / checklistTotal) * 100 : 0;

    res.json({
      daysUntilWedding,
      checklistProgress,
      budgetSpent,
      budgetTotal,
      budgetRemaining: budgetTotal - budgetSpent,
      timelineEventCount,
      checklistCompleted,
      checklistTotal,
      hasProfile,
      hasTimeline,
      hasChecklist,
    });
  } catch (err) {
    req.log.error(err, "Failed to get dashboard summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
