import { Router } from "express";
import { db, manualExpenses } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth";
import { resolveScopeUserId, resolveCallerRole, hasMinRole } from "../../lib/workspaceAccess";

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
    notes: row.notes ?? null,
    receiptUrl: row.receiptUrl ?? null,
    receiptName: row.receiptName ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

router.get("/manual-expenses", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const userId = await resolveScopeUserId(req);
    const rows = await db
      .select()
      .from(manualExpenses)
      .where(eq(manualExpenses.userId, userId))
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
    const userId = await resolveScopeUserId(req);
    const { name, category, cost, amountPaid, notes, receiptUrl, receiptName } = req.body ?? {};
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
    const [created] = await db
      .insert(manualExpenses)
      .values({
        userId,
        name: name.trim().slice(0, 200),
        category: String(category ?? "Other").slice(0, 80),
        cost: String(costNum),
        amountPaid: String(paidNum),
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
    const userId = await resolveScopeUserId(req);
    const id = parseInt(String(req.params.id), 10);
    const { name, category, cost, amountPaid, notes, receiptUrl, receiptName } = req.body ?? {};
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
    if (amountPaid !== undefined) {
      const n = Math.max(0, Number(amountPaid));
      if (!Number.isFinite(n)) {
        res.status(400).json({ error: "amountPaid must be a valid number" });
        return;
      }
      updates.amountPaid = String(n);
    }
    if (notes !== undefined) updates.notes = typeof notes === "string" ? notes.slice(0, 2000) : null;
    if (receiptUrl !== undefined) updates.receiptUrl = sanitizeReceiptUrl(receiptUrl);
    if (receiptName !== undefined) updates.receiptName = typeof receiptName === "string" ? receiptName.slice(0, 200) : null;
    updates.updatedAt = new Date();
    const [updated] = await db
      .update(manualExpenses)
      .set(updates)
      .where(and(eq(manualExpenses.id, id), eq(manualExpenses.userId, userId)))
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

router.delete("/manual-expenses/:id", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const userId = await resolveScopeUserId(req);
    const id = parseInt(String(req.params.id), 10);
    const result = await db
      .delete(manualExpenses)
      .where(and(eq(manualExpenses.id, id), eq(manualExpenses.userId, userId)))
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
