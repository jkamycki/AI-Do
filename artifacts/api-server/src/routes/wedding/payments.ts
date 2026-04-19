import { Router } from "express";
import { db } from "@workspace/db";
import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth";

const router = Router();

const vendorPayments = pgTable("vendor_payments", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  vendorName: text("vendor_name").notNull(),
  vendorCategory: text("vendor_category"),
  description: text("description"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }).notNull().default("0"),
  dueDate: text("due_date"),
  paidDate: text("paid_date"),
  paymentMethod: text("payment_method"),
  notes: text("notes"),
  status: text("status").notNull().default("upcoming"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

function computeStatus(row: { dueDate: string | null; amountPaid: string; totalAmount: string; status: string }): string {
  const paid = parseFloat(row.amountPaid ?? "0");
  const total = parseFloat(row.totalAmount ?? "0");
  if (paid >= total && total > 0) return "paid";
  if (row.dueDate) {
    const due = new Date(row.dueDate + "T12:00:00");
    if (due < new Date()) return "overdue";
  }
  return "upcoming";
}

router.get("/payments", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(vendorPayments)
      .where(eq(vendorPayments.userId, req.userId!))
      .orderBy(desc(vendorPayments.createdAt));
    res.json(rows.map(r => ({
      ...r,
      totalAmount: parseFloat(r.totalAmount as unknown as string),
      amountPaid: parseFloat(r.amountPaid as unknown as string),
      status: computeStatus(r as never),
      createdAt: r.createdAt.toISOString(),
    })));
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/payments", requireAuth, async (req, res) => {
  try {
    const { vendorName, vendorCategory, description, totalAmount, amountPaid, dueDate, paidDate, paymentMethod, notes } = req.body;
    if (!vendorName) return res.status(400).json({ error: "vendorName is required" });
    const [created] = await db.insert(vendorPayments).values({
      userId: req.userId!,
      vendorName,
      vendorCategory: vendorCategory ?? null,
      description: description ?? null,
      totalAmount: totalAmount?.toString() ?? "0",
      amountPaid: amountPaid?.toString() ?? "0",
      dueDate: dueDate ?? null,
      paidDate: paidDate ?? null,
      paymentMethod: paymentMethod ?? null,
      notes: notes ?? null,
      status: "upcoming",
    }).returning();
    res.json({
      ...created,
      totalAmount: parseFloat(created.totalAmount as unknown as string),
      amountPaid: parseFloat(created.amountPaid as unknown as string),
      status: computeStatus(created as never),
    });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/payments/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "0");
    const { vendorName, vendorCategory, description, totalAmount, amountPaid, dueDate, paidDate, paymentMethod, notes } = req.body;
    const updates: Record<string, unknown> = {};
    if (vendorName !== undefined) updates.vendorName = vendorName;
    if (vendorCategory !== undefined) updates.vendorCategory = vendorCategory;
    if (description !== undefined) updates.description = description;
    if (totalAmount !== undefined) updates.totalAmount = totalAmount.toString();
    if (amountPaid !== undefined) updates.amountPaid = amountPaid.toString();
    if (dueDate !== undefined) updates.dueDate = dueDate;
    if (paidDate !== undefined) updates.paidDate = paidDate;
    if (paymentMethod !== undefined) updates.paymentMethod = paymentMethod;
    if (notes !== undefined) updates.notes = notes;

    const [updated] = await db
      .update(vendorPayments)
      .set(updates as never)
      .where(eq(vendorPayments.id, id))
      .returning();

    res.json({
      ...updated,
      totalAmount: parseFloat(updated.totalAmount as unknown as string),
      amountPaid: parseFloat(updated.amountPaid as unknown as string),
      status: computeStatus(updated as never),
    });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/payments/:id", requireAuth, async (req, res) => {
  try {
    await db.delete(vendorPayments).where(eq(vendorPayments.id, parseInt(req.params["id"] ?? "0")));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
