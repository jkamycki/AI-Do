import { Router } from "express";
import { db, vendors, vendorPayments } from "@workspace/db";
import { eq, and, asc, inArray } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

function formatVendor(v: typeof vendors.$inferSelect) {
  return {
    ...v,
    totalCost: Number(v.totalCost),
    depositAmount: Number(v.depositAmount),
  };
}

function formatPayment(p: typeof vendorPayments.$inferSelect) {
  return {
    ...p,
    amount: Number(p.amount),
    paidAt: p.paidAt ? p.paidAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
  };
}

async function syncNextPaymentDue(vendorId: number) {
  const unpaid = await db
    .select({ dueDate: vendorPayments.dueDate })
    .from(vendorPayments)
    .where(and(eq(vendorPayments.vendorId, vendorId), eq(vendorPayments.isPaid, false)))
    .orderBy(asc(vendorPayments.dueDate));
  const nextDate = unpaid.length > 0 ? unpaid[0].dueDate : null;
  await db.update(vendors).set({ nextPaymentDue: nextDate }).where(eq(vendors.id, vendorId));
}

router.get("/vendors", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, req.userId!))
      .orderBy(vendors.createdAt);
    res.json(rows.map(formatVendor));
  } catch (err) {
    req.log.error(err, "Failed to list vendors");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/vendors/financials", requireAuth, async (req, res) => {
  try {
    const userVendors = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, req.userId!));

    const totalCommitted = userVendors.reduce((s, v) => s + Number(v.totalCost), 0);
    const totalDeposits = userVendors.reduce((s, v) => s + Number(v.depositAmount), 0);

    const vendorIds = userVendors.map((v) => v.id);

    // Fetch all paid milestone payments grouped by vendorId
    const paidByVendor: Record<number, number> = {};
    if (vendorIds.length > 0) {
      const paidPayments = await db
        .select()
        .from(vendorPayments)
        .where(and(inArray(vendorPayments.vendorId, vendorIds), eq(vendorPayments.isPaid, true)));
      for (const p of paidPayments) {
        paidByVendor[p.vendorId] = (paidByVendor[p.vendorId] ?? 0) + Number(p.amount);
      }
    }

    const vendorDetails = userVendors.map((v) => {
      const deposit = Number(v.depositAmount);
      const milestones = paidByVendor[v.id] ?? 0;
      const totalPaid = deposit + milestones;
      const totalCost = Number(v.totalCost);
      return {
        id: v.id,
        name: v.name,
        category: v.category ?? "Vendor",
        totalCost,
        depositAmount: deposit,
        totalPaid,
        isPaidOff: totalCost > 0 && totalPaid >= totalCost,
        nextPaymentDue: v.nextPaymentDue ? v.nextPaymentDue.toISOString().slice(0, 10) : null,
      };
    });

    const totalPaidMilestones = Object.values(paidByVendor).reduce((s, v) => s + v, 0);

    res.json({
      vendorCount: userVendors.length,
      totalCommitted,
      totalDeposits,
      totalPaidMilestones,
      totalPaid: totalDeposits + totalPaidMilestones,
      vendors: vendorDetails,
    });
  } catch (err) {
    req.log.error(err, "Failed to fetch vendor financials");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/vendors", requireAuth, async (req, res) => {
  try {
    const {
      name, category, email, phone, website, portalLink,
      notes, totalCost, depositAmount, contractSigned, nextPaymentDue,
    } = req.body;
    const [created] = await db.insert(vendors).values({
      userId: req.userId!,
      name,
      category,
      email: email ?? null,
      phone: phone ?? null,
      website: website ?? null,
      portalLink: portalLink ?? null,
      notes: notes ?? null,
      totalCost: String(totalCost ?? 0),
      depositAmount: String(depositAmount ?? 0),
      contractSigned: contractSigned ?? false,
      nextPaymentDue: nextPaymentDue || null,
      files: [],
    }).returning();
    res.status(201).json(formatVendor(created));
  } catch (err) {
    req.log.error(err, "Failed to create vendor");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/vendors/:id", requireAuth, async (req, res) => {
  try {
    const vendorId = parseInt(req.params.id, 10);
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(and(eq(vendors.id, vendorId), eq(vendors.userId, req.userId!)))
      .limit(1);
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    const payments = await db
      .select()
      .from(vendorPayments)
      .where(eq(vendorPayments.vendorId, vendorId))
      .orderBy(vendorPayments.dueDate);
    res.json({ ...formatVendor(vendor), payments: payments.map(formatPayment) });
  } catch (err) {
    req.log.error(err, "Failed to get vendor");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/vendors/:id", requireAuth, async (req, res) => {
  try {
    const vendorId = parseInt(req.params.id, 10);
    const {
      name, category, email, phone, website, portalLink,
      notes, totalCost, depositAmount, contractSigned, files, nextPaymentDue,
    } = req.body;
    const updates: Partial<typeof vendors.$inferInsert> = {};
    if (name !== undefined) updates.name = name;
    if (category !== undefined) updates.category = category;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (website !== undefined) updates.website = website;
    if (portalLink !== undefined) updates.portalLink = portalLink;
    if (notes !== undefined) updates.notes = notes;
    if (totalCost !== undefined) updates.totalCost = String(totalCost);
    if (depositAmount !== undefined) updates.depositAmount = String(depositAmount);
    if (contractSigned !== undefined) updates.contractSigned = contractSigned;
    if (nextPaymentDue !== undefined) updates.nextPaymentDue = nextPaymentDue || null;
    if (files !== undefined) updates.files = files;
    updates.updatedAt = new Date();
    const [updated] = await db
      .update(vendors)
      .set(updates)
      .where(and(eq(vendors.id, vendorId), eq(vendors.userId, req.userId!)))
      .returning();
    if (!updated) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    res.json(formatVendor(updated));
  } catch (err) {
    req.log.error(err, "Failed to update vendor");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/vendors/:id", requireAuth, async (req, res) => {
  try {
    const vendorId = parseInt(req.params.id, 10);
    await db.delete(vendorPayments).where(eq(vendorPayments.vendorId, vendorId));
    const [deleted] = await db
      .delete(vendors)
      .where(and(eq(vendors.id, vendorId), eq(vendors.userId, req.userId!)))
      .returning();
    if (!deleted) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "Failed to delete vendor");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/vendors/:id/payments", requireAuth, async (req, res) => {
  try {
    const vendorId = parseInt(req.params.id, 10);
    const [vendor] = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(and(eq(vendors.id, vendorId), eq(vendors.userId, req.userId!)))
      .limit(1);
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    const { label, amount, dueDate, isPaid } = req.body;
    const [payment] = await db.insert(vendorPayments).values({
      vendorId,
      label,
      amount: String(amount),
      dueDate,
      isPaid: isPaid ?? false,
    }).returning();
    await syncNextPaymentDue(vendorId);
    res.status(201).json(formatPayment(payment));
  } catch (err) {
    req.log.error(err, "Failed to create vendor payment");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/vendors/:id/payments/:paymentId", requireAuth, async (req, res) => {
  try {
    const vendorId = parseInt(req.params.id, 10);
    const paymentId = parseInt(req.params.paymentId, 10);
    const { label, amount, dueDate, isPaid } = req.body;
    const updates: Partial<typeof vendorPayments.$inferInsert> = {};
    if (label !== undefined) updates.label = label;
    if (amount !== undefined) updates.amount = String(amount);
    if (dueDate !== undefined) updates.dueDate = dueDate;
    if (isPaid !== undefined) {
      updates.isPaid = isPaid;
      updates.paidAt = isPaid ? new Date() : null;
    }
    const [updated] = await db
      .update(vendorPayments)
      .set(updates)
      .where(eq(vendorPayments.id, paymentId))
      .returning();
    if (!updated) {
      return res.status(404).json({ error: "Payment not found" });
    }
    await syncNextPaymentDue(vendorId);
    res.json(formatPayment(updated));
  } catch (err) {
    req.log.error(err, "Failed to update vendor payment");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/vendors/:id/payments/:paymentId", requireAuth, async (req, res) => {
  try {
    const vendorId = parseInt(req.params.id, 10);
    const paymentId = parseInt(req.params.paymentId, 10);
    const [deleted] = await db
      .delete(vendorPayments)
      .where(eq(vendorPayments.id, paymentId))
      .returning();
    if (!deleted) {
      return res.status(404).json({ error: "Payment not found" });
    }
    await syncNextPaymentDue(vendorId);
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "Failed to delete vendor payment");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/vendor/email/summarize", requireAuth, async (req, res) => {
  try {
    const { emailText } = req.body;
    if (!emailText) {
      return res.status(400).json({ error: "emailText is required" });
    }
    const prompt = `You are a wedding planning assistant. A couple has received an email from a vendor and needs help understanding it.

Summarize the following vendor email clearly and concisely. Extract key information like pricing, availability, terms, and next steps.

Email:
${emailText}

Return ONLY valid JSON (no markdown) with this structure:
{
  "summary": "A 2-3 sentence plain English summary of what this email says",
  "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
  "actionItems": ["Action item 1", "Action item 2"]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      result = { summary: content, keyPoints: [], actionItems: [] };
    }
    res.json(result);
  } catch (err) {
    req.log.error(err, "Failed to summarize vendor email");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
