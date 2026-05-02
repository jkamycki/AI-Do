import { Router } from "express";
import { db } from "@workspace/db";
import { budgets, budgetItems, weddingProfiles, budgetPaymentLogs } from "@workspace/db";
import { eq, desc, asc } from "drizzle-orm";
import { openai, getModel } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../../middlewares/requireAuth";
import { trackEvent } from "../../lib/trackEvent";
import { logActivity, resolveProfile, resolveCallerRole, hasMinRole } from "../../lib/workspaceAccess";

const router = Router();

async function verifyBudgetItemOwnership(itemId: number, profileId: number): Promise<boolean> {
  const rows = await db
    .select({ budgetProfileId: budgets.profileId })
    .from(budgetItems)
    .innerJoin(budgets, eq(budgetItems.budgetId, budgets.id))
    .where(eq(budgetItems.id, itemId))
    .limit(1);
  return rows.length > 0 && rows[0].budgetProfileId === profileId;
}

async function getBudgetWithItems(budgetId: number, _profileUserId?: string) {
  const budget = await db.select().from(budgets).where(eq(budgets.id, budgetId)).limit(1);
  if (!budget.length) return null;

  const items = await db.select().from(budgetItems).where(eq(budgetItems.budgetId, budgetId));
  const totalBudget = parseFloat(budget[0].totalBudget as string);

  const itemsOut = items.map(item => {
    return {
      id: item.id,
      category: item.category,
      vendor: item.vendor,
      estimatedCost: parseFloat(item.estimatedCost as string),
      actualCost: parseFloat(item.actualCost as string),
      amountPaid: parseFloat((item.amountPaid ?? "0") as string),
      isPaid: item.isPaid,
      notes: item.notes ?? undefined,
      nextPaymentDue: (item as Record<string, unknown>).nextPaymentDue as string ?? null,
    };
  });

  const committed = itemsOut.reduce((sum, item) => sum + item.actualCost, 0);
  const totalPaid = itemsOut.reduce((sum, item) => sum + item.amountPaid, 0);
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
    items: itemsOut,
  };
}

router.get("/budget", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);
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
      const profileBudget = profile.totalBudget ? String(profile.totalBudget) : "0";
      const [created] = await db
        .insert(budgets)
        .values({ profileId: profile.id, totalBudget: profileBudget })
        .returning();
      const result = await getBudgetWithItems(created.id, profile?.userId);
      res.json(result);
      return;
    }
    // If existing budget has no total set, sync from profile
    if (parseFloat(rows[0].totalBudget as string) === 0 && profile.totalBudget && parseFloat(String(profile.totalBudget)) > 0) {
      await db
        .update(budgets)
        .set({ totalBudget: String(profile.totalBudget), updatedAt: new Date() })
        .where(eq(budgets.id, rows[0].id));
    }
    const result = await getBudgetWithItems(rows[0].id, profile?.userId);
    res.json(result);
  } catch (err) {
    req.log.error(err, "Failed to get budget");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/budget", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const { totalBudget } = req.body;

    const profile = await resolveProfile(req);
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
      const result = await getBudgetWithItems(existing[0].id, profile?.userId);
      trackEvent(req.userId!, "budget_updated", { action: "update_total" });
      res.json(result);
    } else {
      const [created] = await db
        .insert(budgets)
        .values({ profileId, totalBudget: String(totalBudget) })
        .returning();
      const result = await getBudgetWithItems(created.id, profile?.userId);
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
      model: getModel(),
      // 2048 tokens comfortably covers 14 categories + thorough AI suggestions.
      max_completion_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }, { signal: AbortSignal.timeout(90_000) });

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
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const { category, vendor, estimatedCost, actualCost, isPaid, notes, nextPaymentDue, amountPaid } = req.body;

    const profile = await resolveProfile(req);
    const profileId = profile?.id ?? 0;

    let budgetRows = await db
      .select()
      .from(budgets)
      .where(eq(budgets.profileId, profileId))
      .limit(1);

    if (!budgetRows.length) {
      const profileBudget = profile?.totalBudget ? String(profile.totalBudget) : "0";
      const [newBudget] = await db.insert(budgets).values({ profileId, totalBudget: profileBudget }).returning();
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
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const owned = await verifyBudgetItemOwnership(id, profile.id);
    if (!owned) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    const { category, vendor, estimatedCost, actualCost, amountPaid, isPaid, notes, nextPaymentDue } = req.body;

    const updates: Record<string, unknown> = {};
    if (category !== undefined) updates.category = category;
    if (vendor !== undefined) updates.vendor = vendor;
    if (estimatedCost !== undefined) updates.estimatedCost = String(estimatedCost);
    if (actualCost !== undefined) updates.actualCost = String(actualCost);
    if (amountPaid !== undefined) updates.amountPaid = String(amountPaid);
    if (isPaid !== undefined) updates.isPaid = isPaid;
    if (notes !== undefined) updates.notes = notes;
    if (nextPaymentDue !== undefined) updates.nextPaymentDue = nextPaymentDue ?? null;

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
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const owned = await verifyBudgetItemOwnership(id, profile.id);
    if (!owned) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
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
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const itemId = parseInt(String(req.params.id), 10);
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const owned = await verifyBudgetItemOwnership(itemId, profile.id);
    if (!owned) {
      res.status(404).json({ error: "Budget item not found" });
      return;
    }
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
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const itemId = parseInt(String(req.params.id), 10);
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const { amount, note, paidAt } = req.body;
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      res.status(400).json({ error: "amount must be a positive number" });
      return;
    }

    const owned = await verifyBudgetItemOwnership(itemId, profile.id);
    if (!owned) {
      res.status(404).json({ error: "Budget item not found" });
      return;
    }

    // Get current item to calculate new amountPaid
    const [itemRow] = await db.select().from(budgetItems).where(eq(budgetItems.id, itemId)).limit(1);
    if (!itemRow) {
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

    // Recalculate amountPaid from all logs (same as PATCH/DELETE) to stay consistent
    const allLogs = await db.select().from(budgetPaymentLogs).where(eq(budgetPaymentLogs.budgetItemId, itemId));
    const newPaid = allLogs.reduce((s, l) => s + parseFloat(l.amount as string), 0);
    const actualCost = parseFloat(itemRow.actualCost as string);
    const fullyPaid = newPaid >= actualCost;
    await db
      .update(budgetItems)
      .set({ amountPaid: String(newPaid), isPaid: fullyPaid })
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

router.patch("/budget/items/:id/payments/:paymentId", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const itemId = parseInt(String(req.params.id), 10);
    const paymentId = parseInt(String(req.params.paymentId), 10);
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const owned = await verifyBudgetItemOwnership(itemId, profile.id);
    if (!owned) {
      res.status(404).json({ error: "Payment not found" });
      return;
    }
    const { amount, note, paidAt } = req.body;

    const [existing] = await db
      .select()
      .from(budgetPaymentLogs)
      .where(eq(budgetPaymentLogs.id, paymentId))
      .limit(1);
    if (!existing || existing.budgetItemId !== itemId) {
      return res.status(404).json({ error: "Payment not found" });
    }

    const oldAmount = parseFloat(existing.amount as string);
    const newAmount = amount !== undefined ? parseFloat(String(amount)) : oldAmount;

    await db.update(budgetPaymentLogs).set({
      ...(amount !== undefined ? { amount: String(newAmount) } : {}),
      ...(note !== undefined ? { note: note || null } : {}),
      ...(paidAt !== undefined ? { paidAt: new Date(paidAt) } : {}),
    }).where(eq(budgetPaymentLogs.id, paymentId));

    // Recalculate amountPaid on the item
    const allLogs = await db.select().from(budgetPaymentLogs).where(eq(budgetPaymentLogs.budgetItemId, itemId));
    const newTotal = allLogs.reduce((s, l) => s + parseFloat(l.amount as string), 0);
    const [item] = await db.select().from(budgetItems).where(eq(budgetItems.id, itemId)).limit(1);
    const fullyPaid = item ? newTotal >= parseFloat(item.actualCost as string) : false;
    await db.update(budgetItems).set({ amountPaid: String(newTotal), isPaid: fullyPaid }).where(eq(budgetItems.id, itemId));

    res.json({ success: true, newAmountPaid: newTotal });
  } catch (err) {
    req.log.error(err, "Failed to update payment");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/budget/items/:id/payments/:paymentId", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const itemId = parseInt(String(req.params.id), 10);
    const paymentId = parseInt(String(req.params.paymentId), 10);
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const owned = await verifyBudgetItemOwnership(itemId, profile.id);
    if (!owned) {
      res.status(404).json({ error: "Payment not found" });
      return;
    }

    const [existing] = await db
      .select()
      .from(budgetPaymentLogs)
      .where(eq(budgetPaymentLogs.id, paymentId))
      .limit(1);
    if (!existing || existing.budgetItemId !== itemId) {
      return res.status(404).json({ error: "Payment not found" });
    }

    await db.delete(budgetPaymentLogs).where(eq(budgetPaymentLogs.id, paymentId));

    // Recalculate amountPaid on the item
    const allLogs = await db.select().from(budgetPaymentLogs).where(eq(budgetPaymentLogs.budgetItemId, itemId));
    const newTotal = allLogs.reduce((s, l) => s + parseFloat(l.amount as string), 0);
    const [item] = await db.select().from(budgetItems).where(eq(budgetItems.id, itemId)).limit(1);
    const fullyPaid = item ? newTotal >= parseFloat(item.actualCost as string) : false;
    await db.update(budgetItems).set({ amountPaid: String(newTotal), isPaid: fullyPaid }).where(eq(budgetItems.id, itemId));

    res.json({ success: true, newAmountPaid: newTotal });
  } catch (err) {
    req.log.error(err, "Failed to delete payment");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
