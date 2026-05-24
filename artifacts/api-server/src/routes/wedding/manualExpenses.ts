import { Router } from "express";
import { db, manualExpenses } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth";
import { resolveProfile, resolveCallerRole, hasMinRole } from "../../lib/workspaceAccess";

const router = Router();

function sanitizeReceiptUrl(input: unknown): string | null {
  if (input == null || input === "") return null;
  if (typeof input !== "string") return null;
  try {
    const u = new URL(input);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function format(row: typeof manualExpenses.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    cost: Number(row.cost),
    amountPaid: Number(row.amountPaid),
    nextPaymentDue: row.nextPaymentDue ?? null,
    nextPaymentAmount: row.nextPaymentAmount != null ? Number(row.nextPaymentAmount) : null,
    notes: row.notes ?? null,
    receiptUrl: row.receiptUrl ?? null,
    receiptName: row.receiptName ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function sanitizeNextPaymentAmount(input: unknown): string | null {
  if (input == null || input === "") return null;
  const n = Math.max(0, Number(input));
  if (!Number.isFinite(n) || n === 0) return null;
  return String(n);
}

// Accept either an ISO YYYY-MM-DD date string or null/empty. Anything
// else gets dropped. Mirrors how the vendors route handles its own
// next_payment_due field.
function sanitizeNextPaymentDue(input: unknown): string | null {
  if (input == null || input === "") return null;
  if (typeof input !== "string") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(input) ? input : null;
}

router.get("/manual-expenses", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);
    if (!profile) {
      res.json([]);
      return;
    }
    const rows = await db
      .select()
      .from(manualExpenses)
      .where(eq(manualExpenses.profileId, profile.id))
      .orderBy(desc(manualExpenses.createdAt));
    res.json(rows.map(format));
  } catch (err) {
    req.log.error(err, "Failed to list manual expenses");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/manual-expenses", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(400).json({ error: "No wedding profile found" });
      return;
    }
    const { name, category, cost, amountPaid, nextPaymentDue, nextPaymentAmount, notes, receiptUrl, receiptName } = req.body ?? {};
    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const costNum = Math.max(0, Number(cost ?? 0));
    const paidNum = Math.max(0, Number(amountPaid ?? 0));
    if (!Number.isFinite(costNum) || !Number.isFinite(paidNum)) {
      res.status(400).json({ error: "cost and amountPaid must be valid numbers" });
      return;
    }
    const sanitizedNextPaymentDue = sanitizeNextPaymentDue(nextPaymentDue);
    const sanitizedNextPaymentAmount = sanitizeNextPaymentAmount(nextPaymentAmount);
    if (sanitizedNextPaymentAmount !== null && sanitizedNextPaymentDue === null) {
      res.status(400).json({ error: "nextPaymentDue is required when nextPaymentAmount is provided" });
      return;
    }
    const cappedPaidNum = Math.min(paidNum, costNum);
    const [created] = await db
      .insert(manualExpenses)
      .values({
        profileId: profile.id,
        userId: profile.userId,
        name: name.trim().slice(0, 200),
        category: String(category ?? "Other").slice(0, 80),
        cost: String(costNum),
        amountPaid: String(cappedPaidNum),
        nextPaymentDue: sanitizedNextPaymentDue,
        nextPaymentAmount: sanitizedNextPaymentAmount,
        notes: typeof notes === "string" ? notes.slice(0, 2000) : null,
        receiptUrl: sanitizeReceiptUrl(receiptUrl),
        receiptName: typeof receiptName === "string" ? receiptName.slice(0, 200) : null,
      })
      .returning();
    res.status(201).json(format(created));
  } catch (err) {
    req.log.error(err, "Failed to create manual expense");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/manual-expenses/:id", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    const { name, category, cost, amountPaid, nextPaymentDue, nextPaymentAmount, notes, receiptUrl, receiptName } = req.body ?? {};
    const [existing] = await db
      .select()
      .from(manualExpenses)
      .where(and(eq(manualExpenses.id, id), eq(manualExpenses.profileId, profile.id)))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const updates: Partial<typeof manualExpenses.$inferInsert> = {};
    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) {
        res.status(400).json({ error: "name cannot be empty" });
        return;
      }
      updates.name = trimmed.slice(0, 200);
    }
    if (category !== undefined) updates.category = String(category).slice(0, 80);
    if (cost !== undefined) {
      const n = Math.max(0, Number(cost));
      if (!Number.isFinite(n)) {
        res.status(400).json({ error: "cost must be a valid number" });
        return;
      }
      updates.cost = String(n);
    }
    if (amountPaid !== undefined || cost !== undefined) {
      const n = Math.max(0, Number(amountPaid !== undefined ? amountPaid : existing.amountPaid));
      if (!Number.isFinite(n)) {
        res.status(400).json({ error: "amountPaid must be a valid number" });
        return;
      }
      const costForCap = cost !== undefined ? Math.max(0, Number(cost)) : Number(existing?.cost ?? 0);
      updates.amountPaid = String(Math.min(n, costForCap));
    }
    const sanitizedNextPaymentDue = nextPaymentDue !== undefined ? sanitizeNextPaymentDue(nextPaymentDue) : existing.nextPaymentDue ?? null;
    const sanitizedNextPaymentAmount = nextPaymentAmount !== undefined
      ? sanitizeNextPaymentAmount(nextPaymentAmount)
      : existing.nextPaymentAmount != null
        ? String(existing.nextPaymentAmount)
        : null;
    if (sanitizedNextPaymentAmount !== null && sanitizedNextPaymentDue === null) {
      res.status(400).json({ error: "nextPaymentDue is required when nextPaymentAmount is provided" });
      return;
    }
    if (nextPaymentDue !== undefined) updates.nextPaymentDue = sanitizedNextPaymentDue;
    if (nextPaymentAmount !== undefined) updates.nextPaymentAmount = sanitizedNextPaymentAmount;
    if (notes !== undefined) updates.notes = typeof notes === "string" ? notes.slice(0, 2000) : null;
    if (receiptUrl !== undefined) updates.receiptUrl = sanitizeReceiptUrl(receiptUrl);
    if (receiptName !== undefined) updates.receiptName = typeof receiptName === "string" ? receiptName.slice(0, 200) : null;
    updates.updatedAt = new Date();
    const [updated] = await db
      .update(manualExpenses)
      .set(updates)
      .where(and(eq(manualExpenses.id, id), eq(manualExpenses.profileId, profile.id)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(format(updated));
  } catch (err) {
    req.log.error(err, "Failed to update manual expense");
    res.status(500).json({ error: "Internal server error" });
  }
});

// One-click payoff for the upcoming payment milestone. Adds
// next_payment_amount to amount_paid and clears both next-payment fields.
// Idempotent — clicking when there's no scheduled payment is a no-op.
router.post("/manual-expenses/:id/mark-paid", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    const [existing] = await db
      .select()
      .from(manualExpenses)
      .where(and(eq(manualExpenses.id, id), eq(manualExpenses.profileId, profile.id)))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const addAmount = existing.nextPaymentAmount != null ? Number(existing.nextPaymentAmount) : 0;
    const currentPaid = Number(existing.amountPaid);
    const totalCost = Number(existing.cost);
    const newPaid = Math.min(
      Number.isFinite(totalCost) ? Math.max(0, totalCost) : Number.POSITIVE_INFINITY,
      currentPaid + (Number.isFinite(addAmount) ? Math.max(0, addAmount) : 0),
    );
    const [updated] = await db
      .update(manualExpenses)
      .set({
        amountPaid: String(newPaid),
        nextPaymentDue: null,
        nextPaymentAmount: null,
        updatedAt: new Date(),
      })
      .where(and(eq(manualExpenses.id, id), eq(manualExpenses.profileId, profile.id)))
      .returning();
    res.json(format(updated));
  } catch (err) {
    req.log.error(err, "Failed to mark manual expense paid");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/manual-expenses/:id", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    const result = await db
      .delete(manualExpenses)
      .where(and(eq(manualExpenses.id, id), eq(manualExpenses.profileId, profile.id)))
      .returning();
    if (!result.length) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "Failed to delete manual expense");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
