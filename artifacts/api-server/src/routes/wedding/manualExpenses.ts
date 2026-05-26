import { Router } from "express";
import { db, manualExpensePayments, manualExpenses } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth";
import { resolveProfile, resolveCallerRole, hasMinRole, logActivity } from "../../lib/workspaceAccess";

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

function formatPayment(row: typeof manualExpensePayments.$inferSelect) {
  return {
    id: row.id,
    manualExpenseId: row.manualExpenseId,
    description: row.description ?? "",
    amount: Number(row.amount),
    dueDate: row.dueDate,
    isPaid: row.isPaid,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    notes: row.notes ?? null,
    receiptUrl: row.receiptUrl ?? null,
    receiptName: row.receiptName ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function nextUnpaidPayment(payments: ReturnType<typeof formatPayment>[]) {
  return payments
    .filter((payment) => !payment.isPaid)
    .sort((a, b) => (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31"))[0] ?? null;
}

function format(row: typeof manualExpenses.$inferSelect, payments: ReturnType<typeof formatPayment>[] = []) {
  const nextPayment = nextUnpaidPayment(payments);
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    cost: Number(row.cost),
    amountPaid: Number(row.amountPaid),
    nextPaymentId: nextPayment?.id ?? null,
    nextPaymentDescription: nextPayment?.description ?? null,
    nextPaymentDue: nextPayment?.dueDate ?? row.nextPaymentDue ?? null,
    nextPaymentAmount: nextPayment ? nextPayment.amount : row.nextPaymentAmount != null ? Number(row.nextPaymentAmount) : null,
    payments,
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

function sanitizePaymentDescription(input: unknown): string {
  return typeof input === "string" && input.trim()
    ? input.trim().slice(0, 500)
    : "Payment";
}

function sanitizePaymentNotes(input: unknown): string | null {
  return typeof input === "string" && input.trim() ? input.trim().slice(0, 1000) : null;
}

// Accept either an ISO YYYY-MM-DD date string or null/empty. Anything
// else gets dropped. Mirrors how the vendors route handles its own
// next_payment_due field.
function sanitizeNextPaymentDue(input: unknown): string | null {
  if (input == null || input === "") return null;
  if (typeof input !== "string") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(input) ? input : null;
}

async function syncManualNextPayment(manualExpenseId: number) {
  const payments = await db
    .select()
    .from(manualExpensePayments)
    .where(eq(manualExpensePayments.manualExpenseId, manualExpenseId));
  const nextPayment = nextUnpaidPayment(payments.map(formatPayment));
  await db
    .update(manualExpenses)
    .set({
      nextPaymentDue: nextPayment?.dueDate ?? null,
      nextPaymentAmount: nextPayment ? String(nextPayment.amount) : null,
      updatedAt: new Date(),
    })
    .where(eq(manualExpenses.id, manualExpenseId));
}

async function applyPaidDelta(manualExpenseId: number, delta: number) {
  if (!Number.isFinite(delta) || delta === 0) return;
  const [expense] = await db.select().from(manualExpenses).where(eq(manualExpenses.id, manualExpenseId)).limit(1);
  if (!expense) return;
  const currentPaid = Number(expense.amountPaid);
  const totalCost = Number(expense.cost);
  const nextPaid = Math.min(Math.max(0, totalCost), Math.max(0, currentPaid + delta));
  await db
    .update(manualExpenses)
    .set({ amountPaid: String(nextPaid), updatedAt: new Date() })
    .where(eq(manualExpenses.id, manualExpenseId));
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
    const expenseIds = rows.map((row) => row.id);
    const paymentRows = expenseIds.length
      ? await db.select().from(manualExpensePayments).where(inArray(manualExpensePayments.manualExpenseId, expenseIds))
      : [];
    const paymentsByExpense = new Map<number, ReturnType<typeof formatPayment>[]>();
    for (const payment of paymentRows.map(formatPayment)) {
      const current = paymentsByExpense.get(payment.manualExpenseId) ?? [];
      current.push(payment);
      paymentsByExpense.set(payment.manualExpenseId, current);
    }
    res.json(rows.map((row) => format(row, paymentsByExpense.get(row.id) ?? [])));
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
    if (sanitizedNextPaymentDue && sanitizedNextPaymentAmount) {
      await db.insert(manualExpensePayments).values({
        manualExpenseId: created.id,
        description: "Payment",
        amount: sanitizedNextPaymentAmount,
        dueDate: sanitizedNextPaymentDue,
        isPaid: false,
      });
      await syncManualNextPayment(created.id);
    }
    void logActivity(profile.id, req.userId!, `Created expenses ${created.name}`, "expenses", {
      expenseId: created.id,
      name: created.name,
      category: created.category,
      amount: Number(created.cost),
    });
    const paymentRows = await db
      .select()
      .from(manualExpensePayments)
      .where(eq(manualExpensePayments.manualExpenseId, created.id));
    res.status(201).json(format({ ...created, nextPaymentDue: sanitizedNextPaymentDue, nextPaymentAmount: sanitizedNextPaymentAmount }, paymentRows.map(formatPayment)));
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
    if (nextPaymentDue !== undefined || nextPaymentAmount !== undefined) {
      const existingPayments = await db
        .select()
        .from(manualExpensePayments)
        .where(eq(manualExpensePayments.manualExpenseId, id));
      const unpaidPayments = existingPayments
        .filter((payment) => !payment.isPaid)
        .sort((a, b) => (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31"));
      if (sanitizedNextPaymentDue && sanitizedNextPaymentAmount) {
        const firstUnpaid = unpaidPayments[0];
        if (firstUnpaid) {
          await db
            .update(manualExpensePayments)
            .set({
              description: firstUnpaid.description || "Payment",
              amount: sanitizedNextPaymentAmount,
              dueDate: sanitizedNextPaymentDue,
              updatedAt: new Date(),
            })
            .where(and(eq(manualExpensePayments.id, firstUnpaid.id), eq(manualExpensePayments.manualExpenseId, id)));
        } else {
          await db.insert(manualExpensePayments).values({
            manualExpenseId: id,
            description: "Payment",
            amount: sanitizedNextPaymentAmount,
            dueDate: sanitizedNextPaymentDue,
            isPaid: false,
          });
        }
      } else if (nextPaymentDue !== undefined && nextPaymentAmount !== undefined && unpaidPayments.length > 0) {
        await db
          .delete(manualExpensePayments)
          .where(and(eq(manualExpensePayments.manualExpenseId, id), inArray(manualExpensePayments.id, unpaidPayments.map((payment) => payment.id))));
      }
      await syncManualNextPayment(id);
    }
    void logActivity(profile.id, req.userId!, `Updated expenses ${updated.name}`, "expenses", {
      expenseId: updated.id,
      name: updated.name,
      category: updated.category,
      amount: Number(updated.cost),
    });
    const paymentRows = await db
      .select()
      .from(manualExpensePayments)
      .where(eq(manualExpensePayments.manualExpenseId, id));
    res.json(format(updated, paymentRows.map(formatPayment)));
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
    const payments = await db
      .select()
      .from(manualExpensePayments)
      .where(eq(manualExpensePayments.manualExpenseId, id));
    const nextPayment = payments
      .filter((payment) => !payment.isPaid)
      .sort((a, b) => (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31"))[0] ?? null;
    const addAmount = nextPayment ? Number(nextPayment.amount) : existing.nextPaymentAmount != null ? Number(existing.nextPaymentAmount) : 0;
    const currentPaid = Number(existing.amountPaid);
    const totalCost = Number(existing.cost);
    const newPaid = Math.min(
      Number.isFinite(totalCost) ? Math.max(0, totalCost) : Number.POSITIVE_INFINITY,
      currentPaid + (Number.isFinite(addAmount) ? Math.max(0, addAmount) : 0),
    );
    if (nextPayment) {
      await db
        .update(manualExpensePayments)
        .set({ isPaid: true, paidAt: new Date(), updatedAt: new Date() })
        .where(and(eq(manualExpensePayments.id, nextPayment.id), eq(manualExpensePayments.manualExpenseId, id)));
    }
    const [updated] = await db
      .update(manualExpenses)
      .set({
        amountPaid: String(newPaid),
        nextPaymentDue: nextPayment ? existing.nextPaymentDue : null,
        nextPaymentAmount: nextPayment ? existing.nextPaymentAmount : null,
        updatedAt: new Date(),
      })
      .where(and(eq(manualExpenses.id, id), eq(manualExpenses.profileId, profile.id)))
      .returning();
    await syncManualNextPayment(id);
    void logActivity(profile.id, req.userId!, `Updated expenses ${updated.name}`, "expenses", {
      expenseId: updated.id,
      name: updated.name,
      amountPaid: Number(updated.amountPaid),
    });
    const paymentRows = await db
      .select()
      .from(manualExpensePayments)
      .where(eq(manualExpensePayments.manualExpenseId, id));
    res.json(format(updated, paymentRows.map(formatPayment)));
  } catch (err) {
    req.log.error(err, "Failed to mark manual expense paid");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/manual-expenses/:id/payments", requireAuth, async (req, res) => {
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
    const [expense] = await db
      .select({ id: manualExpenses.id })
      .from(manualExpenses)
      .where(and(eq(manualExpenses.id, id), eq(manualExpenses.profileId, profile.id)))
      .limit(1);
    if (!expense) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const rows = await db
      .select()
      .from(manualExpensePayments)
      .where(eq(manualExpensePayments.manualExpenseId, id));
    res.json(rows.map(formatPayment).sort((a, b) => a.dueDate.localeCompare(b.dueDate)));
  } catch (err) {
    req.log.error(err, "Failed to list manual expense payments");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/manual-expenses/:id/payments", requireAuth, async (req, res) => {
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
    const [expense] = await db
      .select()
      .from(manualExpenses)
      .where(and(eq(manualExpenses.id, id), eq(manualExpenses.profileId, profile.id)))
      .limit(1);
    if (!expense) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const { description, amount, dueDate, isPaid, notes, receiptUrl, receiptName } = req.body ?? {};
    const amountNum = Number(amount);
    const sanitizedDueDate = sanitizeNextPaymentDue(dueDate);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      res.status(400).json({ error: "amount must be a positive number" });
      return;
    }
    if (!sanitizedDueDate) {
      res.status(400).json({ error: "dueDate is required when amount is provided" });
      return;
    }
    const paid = Boolean(isPaid);
    const [payment] = await db
      .insert(manualExpensePayments)
      .values({
        manualExpenseId: id,
        description: sanitizePaymentDescription(description),
        amount: String(amountNum),
        dueDate: sanitizedDueDate,
        isPaid: paid,
        paidAt: paid ? new Date() : null,
        notes: sanitizePaymentNotes(notes),
        receiptUrl: sanitizeReceiptUrl(receiptUrl),
        receiptName: typeof receiptName === "string" ? receiptName.slice(0, 200) : null,
      })
      .returning();
    if (paid) {
      await applyPaidDelta(id, amountNum);
    }
    await syncManualNextPayment(id);
    res.status(201).json(formatPayment(payment));
  } catch (err) {
    req.log.error(err, "Failed to create manual expense payment");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/manual-expenses/:id/payments/:paymentId", requireAuth, async (req, res) => {
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
    const paymentId = parseInt(String(req.params.paymentId), 10);
    const [expense] = await db
      .select()
      .from(manualExpenses)
      .where(and(eq(manualExpenses.id, id), eq(manualExpenses.profileId, profile.id)))
      .limit(1);
    if (!expense) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [existingPayment] = await db
      .select()
      .from(manualExpensePayments)
      .where(and(eq(manualExpensePayments.id, paymentId), eq(manualExpensePayments.manualExpenseId, id)))
      .limit(1);
    if (!existingPayment) {
      res.status(404).json({ error: "Payment not found" });
      return;
    }
    const { description, amount, dueDate, isPaid, notes, receiptUrl, receiptName } = req.body ?? {};
    const nextAmount = amount !== undefined ? Number(amount) : Number(existingPayment.amount);
    const nextDueDate = dueDate !== undefined ? sanitizeNextPaymentDue(dueDate) : existingPayment.dueDate;
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      res.status(400).json({ error: "amount must be a positive number" });
      return;
    }
    if (!nextDueDate) {
      res.status(400).json({ error: "dueDate is required when amount is provided" });
      return;
    }
    const nextIsPaid = isPaid !== undefined ? Boolean(isPaid) : existingPayment.isPaid;
    const previousPaidContribution = existingPayment.isPaid ? Number(existingPayment.amount) : 0;
    const nextPaidContribution = nextIsPaid ? nextAmount : 0;
    const updates: Partial<typeof manualExpensePayments.$inferInsert> = {
      amount: String(nextAmount),
      dueDate: nextDueDate,
      isPaid: nextIsPaid,
      paidAt: nextIsPaid ? existingPayment.paidAt ?? new Date() : null,
      updatedAt: new Date(),
    };
    if (description !== undefined) updates.description = sanitizePaymentDescription(description);
    if (notes !== undefined) updates.notes = sanitizePaymentNotes(notes);
    if (receiptUrl !== undefined) updates.receiptUrl = sanitizeReceiptUrl(receiptUrl);
    if (receiptName !== undefined) updates.receiptName = typeof receiptName === "string" ? receiptName.slice(0, 200) : null;
    const [updated] = await db
      .update(manualExpensePayments)
      .set(updates)
      .where(and(eq(manualExpensePayments.id, paymentId), eq(manualExpensePayments.manualExpenseId, id)))
      .returning();
    await applyPaidDelta(id, nextPaidContribution - previousPaidContribution);
    await syncManualNextPayment(id);
    res.json(formatPayment(updated));
  } catch (err) {
    req.log.error(err, "Failed to update manual expense payment");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/manual-expenses/:id/payments/:paymentId", requireAuth, async (req, res) => {
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
    const paymentId = parseInt(String(req.params.paymentId), 10);
    const [expense] = await db
      .select({ id: manualExpenses.id })
      .from(manualExpenses)
      .where(and(eq(manualExpenses.id, id), eq(manualExpenses.profileId, profile.id)))
      .limit(1);
    if (!expense) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [deleted] = await db
      .delete(manualExpensePayments)
      .where(and(eq(manualExpensePayments.id, paymentId), eq(manualExpensePayments.manualExpenseId, id)))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Payment not found" });
      return;
    }
    if (deleted.isPaid) {
      await applyPaidDelta(id, -Number(deleted.amount));
    }
    await syncManualNextPayment(id);
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "Failed to delete manual expense payment");
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
    void logActivity(profile.id, req.userId!, `Deleted expenses ${result[0].name}`, "expenses", {
      expenseId: result[0].id,
      name: result[0].name,
    });
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "Failed to delete manual expense");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
