import { Router } from "express";
import { db } from "@workspace/db";
import { budgets, budgetItems, weddingProfiles, budgetPaymentLogs } from "@workspace/db";
import { eq, desc, asc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../../middlewares/requireAuth";
import { trackEvent } from "../../lib/trackEvent";
import { logActivity } from "../../lib/workspaceAccess";

const router = Router();

async function getProfileByUserId(userId: string) {
  const profiles = await db
    .select()
    .from(weddingProfiles)
    .where(eq(weddingProfiles.userId, userId))
    .limit(1);
  return profiles[0] ?? null;
}

async function getBudgetWithItems(budgetId: number) {
  const budget = await db.select().from(budgets).where(eq(budgets.id, budgetId)).limit(1);
  if (!budget.length) return null;

  const items = await db.select().from(budgetItems).where(eq(budgetItems.budgetId, budgetId));

  const totalBudget = parseFloat(budget[0].totalBudget as string);
  const committed = items.reduce((sum, item) => sum + parseFloat(item.actualCost as string), 0);
  const totalPaid = items.reduce((sum, item) => sum + parseFloat((item.amountPaid ?? "0") as string), 0);
  const remaining = totalBudget - committed;
  const stillOwed = committed - totalPaid;

  return {
    id: budget[0].id,
    totalBudget,
    spent: committed,
    totalPaid,
    stillOwed,
    remaining,
    updatedAt: budget[0].updatedAt.toISOString(),
    items: items.map(item => ({
      id: item.id,
      category: item.category,
      vendor: item.vendor,
      estimatedCost: parseFloat(item.estimatedCost as string),
      actualCost: parseFloat(item.actualCost as string),
      amountPaid: parseFloat((item.amountPaid ?? "0") as string),
      isPaid: item.isPaid,
      notes: item.notes ?? undefined,
      nextPaymentDue: (item as Record<string, unknown>).nextPaymentDue as string ?? null,
    })),
  };
}

router.get("/budget", requireAuth, async (req, res) => {
  try {
    const profile = await getProfileByUserId(req.userId);
    if (!profile) {
      res.status(404).json({ error: "No budget found" });
      return;
    }

    const rows = await db
      .select()
      .from(budgets)
      .where(eq(budgets.profileId, profile.id))
      .orderBy(desc(budgets.id))
      .limit(1);

    if (!rows.length) {
      res.status(404).json({ error: "No budget found" });
      return;
    }
    const result = await getBudgetWithItems(rows[0].id);
    res.json(result);
  } catch (err) {
    req.log.error(err, "Failed to get budget");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/budget", requireAuth, async (req, res) => {
  try {
    const { totalBudget } = req.body;

    const profile = await getProfileByUserId(req.userId);
    const profileId = profile?.id ?? 0;

    const existing = await db
      .select()
      .from(budgets)
      .where(eq(budgets.profileId, profileId))
      .limit(1);

    if (existing.length) {
      await db
        .update(budgets)
        .set({ totalBudget: String(totalBudget), updatedAt: new Date() })
        .where(eq(budgets.id, existing[0].id));
      const result = await getBudgetWithItems(existing[0].id);
      trackEvent(req.userId!, "budget_updated", { action: "update_total" });
      res.json(result);
    } else {
      const [created] = await db
        .insert(budgets)
        .values({ profileId, totalBudget: String(totalBudget) })
        .returning();
      const result = await getBudgetWithItems(created.id);
      trackEvent(req.userId!, "budget_updated", { action: "create" });
      res.json(result);
    }
  } catch (err) {
    req.log.error(err, "Failed to save budget");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/budget/predict", requireAuth, async (req, res) => {
  try {
    const { location, guestCount, weddingVibe } = req.body;

    const prompt = `Estimate the wedding budget breakdown for a ${weddingVibe} wedding in ${location} with ${guestCount} guests.

Provide realistic, current cost estimates for major wedding categories.

Return ONLY valid JSON (no markdown) with this structure:
{
  "totalEstimate": 45000,
  "breakdown": [
    {
      "category": "Venue",
      "estimatedCost": 8000,
      "notes": "Includes ceremony and reception space"
    }
  ],
  "aiSuggestions": "3-4 sentences of practical advice for this specific wedding budget and location"
}

Include these categories: Venue, Catering & Bar, Photography, Videography, Florals & Decor, Music/DJ/Band, Wedding Cake, Attire & Beauty, Invitations & Stationery, Transportation, Officiant, Favors & Gifts, Honeymoon Fund, Miscellaneous/Emergency Fund.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      result = { totalEstimate: 0, breakdown: [], aiSuggestions: content };
    }

    res.json(result);
  } catch (err) {
    req.log.error(err, "Failed to predict budget");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/budget/items", requireAuth, async (req, res) => {
  try {
    const { category, vendor, estimatedCost, actualCost, isPaid, notes, nextPaymentDue, amountPaid } = req.body;

    const profile = await getProfileByUserId(req.userId);
    const profileId = profile?.id ?? 0;

    let budgetRows = await db
      .select()
      .from(budgets)
      .where(eq(budgets.profileId, profileId))
      .limit(1);

    if (!budgetRows.length) {
      const [newBudget] = await db.insert(budgets).values({ profileId, totalBudget: "0" }).returning();
      budgetRows = [newBudget];
    }

    const [item] = await db
      .insert(budgetItems)
      .values({
        budgetId: budgetRows[0].id,
        category,
        vendor,
        estimatedCost: String(estimatedCost),
        actualCost: String(actualCost),
        amountPaid: String(amountPaid ?? 0),
        isPaid: isPaid ?? false,
        notes: notes ?? null,
        nextPaymentDue: nextPaymentDue ?? null,
      } as never)
      .returning();

    logActivity(profileId, req.userId!, `Added budget item: ${vendor} (${category})`, "budget", { itemId: item.id, vendor, category });
    res.json({
      id: item.id,
      category: item.category,
      vendor: item.vendor,
      estimatedCost: parseFloat(item.estimatedCost as string),
      actualCost: parseFloat(item.actualCost as string),
      amountPaid: parseFloat((item.amountPaid ?? "0") as string),
      isPaid: item.isPaid,
      notes: item.notes ?? undefined,
      nextPaymentDue: (item as Record<string, unknown>).nextPaymentDue as string ?? null,
    });
  } catch (err) {
    req.log.error(err, "Failed to add budget item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/budget/items/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { category, vendor, estimatedCost, actualCost, amountPaid, isPaid, notes, nextPaymentDue } = req.body;

    const updates: Record<string, unknown> = {};
    if (category !== undefined) updates.category = category;
    if (vendor !== undefined) updates.vendor = vendor;
    if (estimatedCost !== undefined) updates.estimatedCost = String(estimatedCost);
    if (actualCost !== undefined) updates.actualCost = String(actualCost);
    if (amountPaid !== undefined) updates.amountPaid = String(amountPaid);
    if (isPaid !== undefined) updates.isPaid = isPaid;
    if (notes !== undefined) updates.notes = notes;
    if (nextPaymentDue !== undefined) updates.next_payment_due = nextPaymentDue ?? null;

    const [item] = await db.update(budgetItems).set(updates as never).where(eq(budgetItems.id, id)).returning();

    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    res.json({
      id: item.id,
      category: item.category,
      vendor: item.vendor,
      estimatedCost: parseFloat(item.estimatedCost as string),
      actualCost: parseFloat(item.actualCost as string),
      amountPaid: parseFloat((item.amountPaid ?? "0") as string),
      isPaid: item.isPaid,
      notes: item.notes ?? undefined,
      nextPaymentDue: (item as Record<string, unknown>).nextPaymentDue as string ?? null,
    });
  } catch (err) {
    req.log.error(err, "Failed to update budget item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/budget/items/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(budgetItems).where(eq(budgetItems.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "Failed to delete budget item");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Payment Logs ──────────────────────────────────────────────────────────────

router.get("/budget/items/:id/payments", requireAuth, async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const logs = await db
      .select()
      .from(budgetPaymentLogs)
      .where(eq(budgetPaymentLogs.budgetItemId, itemId))
      .orderBy(asc(budgetPaymentLogs.paidAt));
    res.json(
      logs.map(l => ({
        id: l.id,
        amount: parseFloat(l.amount as string),
        note: l.note ?? null,
        paidAt: l.paidAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error(err, "Failed to get payment logs");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/budget/items/:id/payments", requireAuth, async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const { amount, note, paidAt } = req.body;
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      res.status(400).json({ error: "amount must be a positive number" });
      return;
    }

    // Get current item to calculate new amountPaid
    const [item] = await db.select().from(budgetItems).where(eq(budgetItems.id, itemId)).limit(1);
    if (!item) {
      res.status(404).json({ error: "Budget item not found" });
      return;
    }

    // Insert the log entry
    const [log] = await db
      .insert(budgetPaymentLogs)
      .values({
        budgetItemId: itemId,
        amount: String(amount),
        note: note ?? null,
        ...(paidAt ? { paidAt: new Date(paidAt) } : {}),
      })
      .returning();

    // Update the running total on the item
    const currentPaid = parseFloat((item.amountPaid ?? "0") as string);
    const newPaid = currentPaid + parseFloat(String(amount));
    const actualCost = parseFloat(item.actualCost as string);
    const fullyPaid = newPaid >= actualCost;
    await db
      .update(budgetItems)
      .set({ amountPaid: String(newPaid), ...(fullyPaid ? { isPaid: true } : {}) })
      .where(eq(budgetItems.id, itemId));

    res.json({
      id: log.id,
      amount: parseFloat(log.amount as string),
      note: log.note ?? null,
      paidAt: log.paidAt.toISOString(),
      newAmountPaid: newPaid,
      isPaid: fullyPaid,
    });
  } catch (err) {
    req.log.error(err, "Failed to add payment log");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
