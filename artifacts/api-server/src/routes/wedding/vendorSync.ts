import { Router } from "express";
import { db, vendors, vendorPayments, checklistItems, vendorContacts } from "@workspace/db";
import { eq, and, asc, inArray } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth";
import { resolveProfile, resolveCallerRole, hasMinRole } from "../../lib/workspaceAccess";
import { openai, getModel } from "@workspace/integrations-openai-ai-server";
import { getRequestLanguage } from "../../lib/language";

const router = Router();

// Mark any "first vendor" / "add a vendor" style checklist items as
// completed once the user has added at least one real vendor row. We
// only flip items whose text mentions the literal word "vendor" so we
// don't accidentally complete unrelated tasks like "Pay the photographer"
// or "Book honeymoon flights". Skipped if the user already has more than
// one vendor (likely already past this step), so we don't keep retrying
// on every subsequent vendor add.
async function markFirstVendorChecklistItemsComplete(profileId: number): Promise<void> {
  const incompleteItems = await db
    .select()
    .from(checklistItems)
    .where(and(
      eq(checklistItems.profileId, profileId),
      eq(checklistItems.isCompleted, false),
    ));
  const matching = incompleteItems.filter((item) =>
    (item.task ?? "").toLowerCase().includes("vendor"),
  );
  if (matching.length === 0) return;
  await db
    .update(checklistItems)
    .set({ isCompleted: true, completedAt: new Date() })
    .where(and(
      eq(checklistItems.profileId, profileId),
      inArray(checklistItems.id, matching.map((m) => m.id)),
    ));
}

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

function cleanOptionalText(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function sanitizePaymentDueDate(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function normalizeContactType(value: unknown) {
  return value === "Vendor" ? "Vendor" : "General";
}

function formatStoredContact(c: typeof vendorContacts.$inferSelect) {
  return {
    id: String(c.id),
    source: c.vendorId === null ? "manual" as const : "vendor" as const,
    vendorId: c.vendorId,
    name: c.name,
    businessName: c.businessName,
    email: c.email,
    phone: c.phone,
    contactType: c.contactType,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

function formatVendorContactSuggestion(v: typeof vendors.$inferSelect) {
  return {
    vendorId: v.id,
    name: v.primaryContact?.trim() || v.name,
    businessName: v.name,
    email: v.email,
    phone: v.phone,
    contactType: "Vendor",
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

async function reopenVendorBalanceForScheduledPayment(vendorId: number, scheduledAmount: number) {
  const amountToReopen = Math.max(0, Number(scheduledAmount || 0));
  if (!Number.isFinite(amountToReopen) || amountToReopen <= 0) return;

  const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  if (!vendor) return;

  const payments = await db.select().from(vendorPayments).where(eq(vendorPayments.vendorId, vendorId));
  const hasDepositMilestone = payments.some((p) => p.label.toLowerCase() === "deposit");
  const paidPayments = payments.filter((p) => p.isPaid);
  const paidFromPayments = paidPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const currentPaidTotal = (hasDepositMilestone ? 0 : Number(vendor.depositAmount)) + paidFromPayments;
  const targetPaidTotal = Math.max(0, Number(vendor.totalCost) - amountToReopen);
  let excessPaid = Math.max(0, currentPaidTotal - targetPaidTotal);
  if (excessPaid <= 0) return;

  const candidates = [...paidPayments].sort((a, b) => {
    const aAuto = a.label.toLowerCase() === "paid in full" ? 0 : 1;
    const bAuto = b.label.toLowerCase() === "paid in full" ? 0 : 1;
    if (aAuto !== bAuto) return aAuto - bAuto;
    const aPaidAt = a.paidAt ? a.paidAt.getTime() : 0;
    const bPaidAt = b.paidAt ? b.paidAt.getTime() : 0;
    if (aPaidAt !== bPaidAt) return bPaidAt - aPaidAt;
    return b.id - a.id;
  });

  for (const payment of candidates) {
    if (excessPaid <= 0) break;
    const paymentAmount = Number(payment.amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) continue;
    if (paymentAmount <= excessPaid + 0.005) {
      await db.delete(vendorPayments).where(eq(vendorPayments.id, payment.id));
      excessPaid -= paymentAmount;
    } else {
      await db
        .update(vendorPayments)
        .set({ amount: String(Math.max(0, paymentAmount - excessPaid)) })
        .where(eq(vendorPayments.id, payment.id));
      excessPaid = 0;
    }
  }
}

router.get("/vendor-contacts", requireAuth, async (req, res) => {
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

    const contactRows = await db
      .select()
      .from(vendorContacts)
      .where(and(eq(vendorContacts.profileId, profile.id), eq(vendorContacts.isHidden, false)))
      .orderBy(vendorContacts.createdAt);

    res.json(contactRows.map(formatStoredContact));
  } catch (err) {
    req.log.error(err, "Failed to list vendor contacts");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/vendor-contacts/suggestions", requireAuth, async (req, res) => {
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

    const [vendorRows, contactRows] = await Promise.all([
      db.select().from(vendors).where(eq(vendors.profileId, profile.id)).orderBy(vendors.createdAt),
      db.select().from(vendorContacts).where(eq(vendorContacts.profileId, profile.id)),
    ]);
    const importedVendorIds = new Set(
      contactRows
        .filter((contact) => !contact.isHidden && contact.vendorId !== null)
        .map((contact) => contact.vendorId),
    );

    res.json(
      vendorRows
        .filter((vendor) => !importedVendorIds.has(vendor.id))
        .filter((vendor) => vendor.name || vendor.primaryContact || vendor.phone || vendor.email)
        .map(formatVendorContactSuggestion),
    );
  } catch (err) {
    req.log.error(err, "Failed to list vendor contact suggestions");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/vendor-contacts/import-vendor/:vendorId", requireAuth, async (req, res) => {
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
    const vendorId = parseInt(String(req.params.vendorId), 10);
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(and(eq(vendors.id, vendorId), eq(vendors.profileId, profile.id)))
      .limit(1);
    if (!vendor) {
      res.status(404).json({ error: "Vendor not found" });
      return;
    }
    const [existing] = await db
      .select()
      .from(vendorContacts)
      .where(and(
        eq(vendorContacts.profileId, profile.id),
        eq(vendorContacts.vendorId, vendorId),
        eq(vendorContacts.isHidden, false),
      ))
      .limit(1);
    if (existing) {
      res.json(formatStoredContact(existing));
      return;
    }

    const [created] = await db.insert(vendorContacts).values({
      profileId: profile.id,
      vendorId,
      name: vendor.primaryContact?.trim() || vendor.name,
      businessName: vendor.name,
      email: vendor.email,
      phone: vendor.phone,
      contactType: "Vendor",
      isHidden: false,
    }).returning();
    res.status(201).json(formatStoredContact(created));
  } catch (err) {
    req.log.error(err, "Failed to import vendor contact");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/vendor-contacts", requireAuth, async (req, res) => {
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
    const name = cleanOptionalText(req.body?.name);
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const requestedVendorId = Number(req.body?.vendorId);
    let linkedVendor: typeof vendors.$inferSelect | null = null;
    if (normalizeContactType(req.body?.contactType) === "Vendor" && Number.isFinite(requestedVendorId)) {
      const [vendor] = await db
        .select()
        .from(vendors)
        .where(and(eq(vendors.id, requestedVendorId), eq(vendors.profileId, profile.id)))
        .limit(1);
      linkedVendor = vendor ?? null;
    }
    const [created] = await db
      .insert(vendorContacts)
      .values({
        profileId: profile.id,
        vendorId: linkedVendor?.id ?? null,
        name,
        businessName: linkedVendor?.name ?? cleanOptionalText(req.body?.businessName),
        email: cleanOptionalText(req.body?.email),
        phone: cleanOptionalText(req.body?.phone),
        contactType: normalizeContactType(req.body?.contactType),
        isHidden: false,
      })
      .returning();
    res.status(201).json(formatStoredContact(created));
  } catch (err) {
    req.log.error(err, "Failed to create vendor contact");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/vendor-contacts/:id", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }
    const contactId = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(contactId)) {
      res.status(400).json({ error: "Synced vendor contacts are edited from the vendor list" });
      return;
    }
    const name = cleanOptionalText(req.body?.name);
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const requestedVendorId = Number(req.body?.vendorId);
    let linkedVendor: typeof vendors.$inferSelect | null = null;
    if (normalizeContactType(req.body?.contactType) === "Vendor" && Number.isFinite(requestedVendorId)) {
      const [vendor] = await db
        .select()
        .from(vendors)
        .where(and(eq(vendors.id, requestedVendorId), eq(vendors.profileId, profile.id)))
        .limit(1);
      linkedVendor = vendor ?? null;
    }
    const [updated] = await db
      .update(vendorContacts)
      .set({
        name,
        vendorId: linkedVendor?.id ?? null,
        businessName: linkedVendor?.name ?? cleanOptionalText(req.body?.businessName),
        email: cleanOptionalText(req.body?.email),
        phone: cleanOptionalText(req.body?.phone),
        contactType: normalizeContactType(req.body?.contactType),
        updatedAt: new Date(),
      })
      .where(and(
        eq(vendorContacts.id, contactId),
        eq(vendorContacts.profileId, profile.id),
      ))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }
    res.json(formatStoredContact(updated));
  } catch (err) {
    req.log.error(err, "Failed to update vendor contact");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/vendor-contacts/:id", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }
    const contactId = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(contactId)) {
      res.status(400).json({ error: "Invalid contact id" });
      return;
    }
    const [deleted] = await db
      .delete(vendorContacts)
      .where(and(
        eq(vendorContacts.id, contactId),
        eq(vendorContacts.profileId, profile.id),
      ))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "Failed to delete vendor contact");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/vendors", requireAuth, async (req, res) => {
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
      .from(vendors)
      .where(eq(vendors.profileId, profile.id))
      .orderBy(vendors.createdAt);

    const vendorIds = rows.map((v) => v.id);
    const allPayments = vendorIds.length > 0
      ? await db.select().from(vendorPayments).where(inArray(vendorPayments.vendorId, vendorIds))
      : [];

    const paymentsByVendor: Record<number, ReturnType<typeof formatPayment>[]> = {};
    for (const p of allPayments) {
      if (!paymentsByVendor[p.vendorId]) paymentsByVendor[p.vendorId] = [];
      paymentsByVendor[p.vendorId].push(formatPayment(p));
    }

    res.json(rows.map((v) => {
      const fv = formatVendor(v);
      const payments = paymentsByVendor[v.id] ?? [];
      const hasDepositMilestone = payments.some(p => p.label.toLowerCase() === "deposit");
      const rawTotalPaid = (hasDepositMilestone ? 0 : fv.depositAmount) +
        payments.filter(p => p.isPaid).reduce((s, p) => s + p.amount, 0);
      const totalPaid = Math.min(Math.max(0, fv.totalCost), Math.max(0, rawTotalPaid));
      const isPaidOff = fv.totalCost > 0 && totalPaid >= fv.totalCost;
      return { ...fv, payments, totalPaid, isPaidOff };
    }));
  } catch (err) {
    req.log.error(err, "Failed to list vendors");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/vendors/financials", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);
    if (!profile) {
      res.json({ vendorCount: 0, totalCommitted: 0, totalDeposits: 0, totalPaidMilestones: 0, totalPaid: 0, vendors: [] });
      return;
    }
    const userVendors = await db
      .select()
      .from(vendors)
      .where(eq(vendors.profileId, profile.id))
      .orderBy(vendors.createdAt);

    const totalCommitted = userVendors.reduce((s, v) => s + Number(v.totalCost), 0);
    const totalDeposits = userVendors.reduce((s, v) => s + Number(v.depositAmount), 0);

    const vendorIds = userVendors.map((v) => v.id);

    const paidByVendor: Record<number, number> = {};
    const nextPaymentByVendor: Record<number, typeof vendorPayments.$inferSelect> = {};
    const vendorsWithDepositMilestone = new Set<number>();
    if (vendorIds.length > 0) {
      const allPayments = await db
        .select()
        .from(vendorPayments)
        .where(inArray(vendorPayments.vendorId, vendorIds));
      for (const p of allPayments) {
        if (p.label.toLowerCase() === "deposit") {
          vendorsWithDepositMilestone.add(p.vendorId);
        }
        if (p.isPaid) {
          paidByVendor[p.vendorId] = (paidByVendor[p.vendorId] ?? 0) + Number(p.amount);
        } else if (
          !nextPaymentByVendor[p.vendorId] ||
          (!nextPaymentByVendor[p.vendorId].dueDate && p.dueDate) ||
          (nextPaymentByVendor[p.vendorId].dueDate && p.dueDate && p.dueDate < nextPaymentByVendor[p.vendorId].dueDate)
        ) {
          nextPaymentByVendor[p.vendorId] = p;
        }
      }
    }

    const vendorDetails = userVendors.map((v) => {
      const deposit = Number(v.depositAmount);
      const milestones = paidByVendor[v.id] ?? 0;
      const totalCost = Number(v.totalCost);
      const rawTotalPaid = (vendorsWithDepositMilestone.has(v.id) ? 0 : deposit) + milestones;
      const totalPaid = Math.min(Math.max(0, totalCost), Math.max(0, rawTotalPaid));
      const nextPayment = nextPaymentByVendor[v.id];
      return {
        id: v.id,
        name: v.name,
        category: v.category ?? "Vendor",
        totalCost,
        depositAmount: deposit,
        totalPaid,
        isPaidOff: totalCost > 0 && totalPaid >= totalCost,
        nextPaymentId: nextPayment?.id ?? null,
        nextPaymentLabel: nextPayment?.label ?? null,
        nextPaymentAmount: nextPayment ? Number(nextPayment.amount) : null,
        nextPaymentDue: nextPayment?.dueDate
          ? String(nextPayment.dueDate).slice(0, 10)
          : v.nextPaymentDue
          ? String(v.nextPaymentDue).slice(0, 10)
          : null,
      };
    });

    const totalPaidMilestones = Object.values(paidByVendor).reduce((s, v) => s + v, 0);
    const totalPaid = vendorDetails.reduce((s, v) => s + v.totalPaid, 0);

    res.json({
      vendorCount: userVendors.length,
      totalCommitted,
      totalDeposits,
      totalPaidMilestones,
      totalPaid,
      vendors: vendorDetails,
    });
  } catch (err) {
    req.log.error(err, "Failed to fetch vendor financials");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/vendors", requireAuth, async (req, res) => {
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
    const {
      name, category, email, phone, website, portalLink,
      address, notes, totalCost, depositAmount, contractSigned, nextPaymentDue,
      primaryContact,
    } = req.body;
    if (!name || !String(name).trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    if (!category || !String(category).trim()) {
      res.status(400).json({ error: "category is required" });
      return;
    }
    const [created] = await db.insert(vendors).values({
      profileId: profile.id,
      userId: profile.userId,
      name: String(name).trim(),
      category: String(category),
      email: email ?? null,
      phone: phone ?? null,
      website: website ?? null,
      portalLink: portalLink ?? null,
      address: address ?? null,
      notes: notes ?? null,
      totalCost: String(Number(totalCost ?? 0) || 0),
      depositAmount: String(Number(depositAmount ?? 0) || 0),
      contractSigned: contractSigned ?? false,
      nextPaymentDue: nextPaymentDue || null,
      files: [],
      primaryContact: primaryContact ?? null,
    }).returning();
    // Best-effort: clear any "add a vendor" checklist nudges so the
    // dashboard's Needs Attention banner stops asking once the user
    // has added at least one vendor.
    await markFirstVendorChecklistItemsComplete(profile.id).catch(() => {});
    res.status(201).json(formatVendor(created));
  } catch (err) {
    req.log.error(err, "Failed to create vendor");
    if ((err as { code?: string })?.code === "42703") {
      res.status(500).json({ error: "Vendor database columns are missing. Please run the latest database migrations and try again." });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/vendors/:id", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);
    if (!profile) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    const vendorId = parseInt(String(req.params.id), 10);
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(and(eq(vendors.id, vendorId), eq(vendors.profileId, profile.id)))
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
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);
    if (!profile) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    const vendorId = parseInt(String(req.params.id), 10);
    const {
      name, category, email, phone, website, portalLink,
      address, notes, totalCost, depositAmount, contractSigned, files, nextPaymentDue,
      primaryContact,
    } = req.body;
    const updates: Partial<typeof vendors.$inferInsert> = {};
    if (name !== undefined) updates.name = name;
    if (category !== undefined) updates.category = category;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (website !== undefined) updates.website = website;
    if (portalLink !== undefined) updates.portalLink = portalLink;
    if (address !== undefined) updates.address = address;
    if (notes !== undefined) updates.notes = notes;
    if (totalCost !== undefined) updates.totalCost = String(totalCost);
    if (depositAmount !== undefined) updates.depositAmount = String(depositAmount);
    if (contractSigned !== undefined) updates.contractSigned = contractSigned;
    if (nextPaymentDue !== undefined) updates.nextPaymentDue = nextPaymentDue || null;
    if (files !== undefined) updates.files = files;
    if (primaryContact !== undefined) updates.primaryContact = primaryContact;
    updates.updatedAt = new Date();
    const [updated] = await db
      .update(vendors)
      .set(updates)
      .where(and(eq(vendors.id, vendorId), eq(vendors.profileId, profile.id)))
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
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);
    if (!profile) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    const vendorId = parseInt(String(req.params.id), 10);
    const [vendor] = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(and(eq(vendors.id, vendorId), eq(vendors.profileId, profile.id)))
      .limit(1);
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    await db.delete(vendorPayments).where(eq(vendorPayments.vendorId, vendorId));
    await db.delete(vendors).where(and(eq(vendors.id, vendorId), eq(vendors.profileId, profile.id)));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "Failed to delete vendor");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/vendors/:id/payments", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);
    if (!profile) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    const vendorId = parseInt(String(req.params.id), 10);
    const [vendor] = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(and(eq(vendors.id, vendorId), eq(vendors.profileId, profile.id)))
      .limit(1);
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    const { label, amount, dueDate, isPaid, reopenBalance } = req.body;
    const amountNum = Number(amount);
    const sanitizedDueDate = sanitizePaymentDueDate(dueDate);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }
    if (!sanitizedDueDate) {
      return res.status(400).json({ error: "dueDate is required when amount is provided" });
    }
    const [payment] = await db.insert(vendorPayments).values({
      vendorId,
      label,
      amount: String(amountNum),
      dueDate: sanitizedDueDate,
      isPaid: isPaid ?? false,
    }).returning();
    if (reopenBalance && !(isPaid ?? false)) {
      await reopenVendorBalanceForScheduledPayment(vendorId, Number(amount));
    }
    await syncNextPaymentDue(vendorId);
    res.status(201).json(formatPayment(payment));
  } catch (err) {
    req.log.error(err, "Failed to create vendor payment");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/vendors/:id/payments/mark-next-paid", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);
    if (!profile) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    const vendorId = parseInt(String(req.params.id), 10);
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(and(eq(vendors.id, vendorId), eq(vendors.profileId, profile.id)))
      .limit(1);
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    const payments = await db
      .select()
      .from(vendorPayments)
      .where(eq(vendorPayments.vendorId, vendorId));
    const nextPayment = payments
      .filter((p) => !p.isPaid)
      .sort((a, b) => (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31"))[0];
    if (nextPayment) {
      const [updated] = await db
        .update(vendorPayments)
        .set({ isPaid: true, paidAt: new Date() })
        .where(and(eq(vendorPayments.id, nextPayment.id), eq(vendorPayments.vendorId, vendorId)))
        .returning();
      await syncNextPaymentDue(vendorId);
      res.json(formatPayment(updated));
      return;
    }

    const hasDepositMilestone = payments.some((p) => p.label.toLowerCase() === "deposit");
    const paidFromPayments = payments.filter((p) => p.isPaid).reduce((sum, p) => sum + Number(p.amount), 0);
    const paidTotal = (hasDepositMilestone ? 0 : Number(vendor.depositAmount)) + paidFromPayments;
    const remaining = Math.max(0, Number(vendor.totalCost) - paidTotal);
    const requestedDueDate = typeof req.body?.dueDate === "string" ? req.body.dueDate : null;
    const requestedAmount = Number(req.body?.amount);
    const dueDate = vendor.nextPaymentDue || requestedDueDate;
    const amountToRecord = remaining > 0 ? remaining : Number.isFinite(requestedAmount) ? Math.max(0, requestedAmount) : 0;
    if (!dueDate || amountToRecord <= 0) {
      await syncNextPaymentDue(vendorId);
      res.status(400).json({ error: "No unpaid vendor payment to mark paid" });
      return;
    }

    const [created] = await db
      .insert(vendorPayments)
      .values({
        vendorId,
        label: "Payment",
        amount: String(amountToRecord),
        dueDate,
        isPaid: true,
        paidAt: new Date(),
      })
      .returning();
    await syncNextPaymentDue(vendorId);
    res.status(201).json({ ...formatPayment(created), createdForMarkPaid: true });
  } catch (err) {
    req.log.error(err, "Failed to mark next vendor payment paid");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/vendors/:id/payments/mark-paid-in-full", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);
    if (!profile) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    const vendorId = parseInt(String(req.params.id), 10);
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(and(eq(vendors.id, vendorId), eq(vendors.profileId, profile.id)))
      .limit(1);
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    const payments = await db
      .select()
      .from(vendorPayments)
      .where(eq(vendorPayments.vendorId, vendorId));
    const previousNextPaymentDue = vendor.nextPaymentDue ? String(vendor.nextPaymentDue).slice(0, 10) : null;
    const now = new Date();
    const unpaidPaymentIds = payments.filter((p) => !p.isPaid).map((p) => p.id);
    if (unpaidPaymentIds.length > 0) {
      await db
        .update(vendorPayments)
        .set({ isPaid: true, paidAt: now })
        .where(and(eq(vendorPayments.vendorId, vendorId), inArray(vendorPayments.id, unpaidPaymentIds)));
    }

    const hasDepositMilestone = payments.some((p) => p.label.toLowerCase() === "deposit");
    const paidFromPayments = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const paidTotal = (hasDepositMilestone ? 0 : Number(vendor.depositAmount)) + paidFromPayments;
    const remaining = Math.max(0, Number(vendor.totalCost) - paidTotal);
    let finalPayment: typeof vendorPayments.$inferSelect | null = null;
    if (remaining > 0) {
      const [created] = await db
        .insert(vendorPayments)
        .values({
          vendorId,
          label: "Paid in full",
          amount: String(remaining),
          dueDate: now.toISOString().slice(0, 10),
          isPaid: true,
          paidAt: now,
        })
        .returning();
      finalPayment = created;
    }

    await db
      .update(vendors)
      .set({ nextPaymentDue: null, updatedAt: now })
      .where(and(eq(vendors.id, vendorId), eq(vendors.profileId, profile.id)));
    await syncNextPaymentDue(vendorId);
    res.json({
      success: true,
      payment: finalPayment ? formatPayment(finalPayment) : null,
      undo: {
        markedPaymentIds: unpaidPaymentIds,
        createdPaymentId: finalPayment?.id ?? null,
        previousNextPaymentDue,
      },
    });
  } catch (err) {
    req.log.error(err, "Failed to mark vendor paid in full");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/vendors/:id/payments/:paymentId", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);
    if (!profile) {
      return res.status(404).json({ error: "Payment not found" });
    }
    const vendorId = parseInt(String(req.params.id), 10);
    const paymentId = parseInt(String(req.params.paymentId), 10);
    const [vendor] = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(and(eq(vendors.id, vendorId), eq(vendors.profileId, profile.id)))
      .limit(1);
    if (!vendor) {
      return res.status(404).json({ error: "Payment not found" });
    }
    const { label, amount, dueDate, isPaid, reopenBalance } = req.body;
    const [existingPayment] = await db
      .select()
      .from(vendorPayments)
      .where(and(eq(vendorPayments.id, paymentId), eq(vendorPayments.vendorId, vendorId)))
      .limit(1);
    if (!existingPayment) {
      return res.status(404).json({ error: "Payment not found" });
    }
    const isEditingPaymentSchedule = amount !== undefined || dueDate !== undefined;
    const nextAmount = amount !== undefined ? Number(amount) : Number(existingPayment.amount);
    const nextDueDate = dueDate !== undefined ? sanitizePaymentDueDate(dueDate) : existingPayment.dueDate;
    if (isEditingPaymentSchedule && (!Number.isFinite(nextAmount) || nextAmount <= 0)) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }
    if (isEditingPaymentSchedule && !nextDueDate) {
      return res.status(400).json({ error: "dueDate is required when amount is provided" });
    }
    const updates: Partial<typeof vendorPayments.$inferInsert> = {};
    if (label !== undefined) updates.label = label;
    if (amount !== undefined) updates.amount = String(nextAmount);
    if (dueDate !== undefined) updates.dueDate = nextDueDate;
    if (isPaid !== undefined) {
      updates.isPaid = isPaid;
      updates.paidAt = isPaid ? new Date() : null;
    }
    const [updated] = await db
      .update(vendorPayments)
      .set(updates)
      .where(and(eq(vendorPayments.id, paymentId), eq(vendorPayments.vendorId, vendorId)))
      .returning();
    if (!updated) {
      return res.status(404).json({ error: "Payment not found" });
    }
    if (reopenBalance && !updated.isPaid) {
      await reopenVendorBalanceForScheduledPayment(vendorId, Number(updated.amount));
    }
    await syncNextPaymentDue(vendorId);
    res.json(formatPayment(updated));
  } catch (err) {
    req.log.error(err, "Failed to update vendor payment");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/vendors/:id/payments/reset-completion", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);
    if (!profile) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    const vendorId = parseInt(String(req.params.id), 10);
    const [vendor] = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(and(eq(vendors.id, vendorId), eq(vendors.profileId, profile.id)))
      .limit(1);
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    const payments = await db.select().from(vendorPayments).where(eq(vendorPayments.vendorId, vendorId));
    const paidPayments = payments.filter((p) => p.isPaid);
    const autoPaidInFullIds = paidPayments
      .filter((p) => p.label.toLowerCase() === "paid in full")
      .map((p) => p.id);
    const paidMilestoneIds = paidPayments
      .filter((p) => p.label.toLowerCase() !== "deposit" && !autoPaidInFullIds.includes(p.id))
      .map((p) => p.id);

    if (autoPaidInFullIds.length > 0) {
      await db.delete(vendorPayments).where(inArray(vendorPayments.id, autoPaidInFullIds));
    }
    if (paidMilestoneIds.length > 0) {
      await db
        .update(vendorPayments)
        .set({ isPaid: false, paidAt: null })
        .where(inArray(vendorPayments.id, paidMilestoneIds));
    }

    await syncNextPaymentDue(vendorId);
    res.json({ success: true, resetPaymentIds: paidMilestoneIds, deletedPaymentIds: autoPaidInFullIds });
  } catch (err) {
    req.log.error(err, "Failed to reset vendor payment completion");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/vendors/:id/payments/:paymentId", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);
    if (!profile) {
      return res.status(404).json({ error: "Payment not found" });
    }
    const vendorId = parseInt(String(req.params.id), 10);
    const paymentId = parseInt(String(req.params.paymentId), 10);
    const [vendor] = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(and(eq(vendors.id, vendorId), eq(vendors.profileId, profile.id)))
      .limit(1);
    if (!vendor) {
      return res.status(404).json({ error: "Payment not found" });
    }
    const [deleted] = await db
      .delete(vendorPayments)
      .where(and(eq(vendorPayments.id, paymentId), eq(vendorPayments.vendorId, vendorId)))
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
    const requestLanguage = getRequestLanguage(req);
    const langInstruction = requestLanguage !== "English"
      ? `\n\nIMPORTANT: Write your entire response in ${requestLanguage}.`
      : "";

    const MAX_EMAIL_CHARS = 4000;
    const trimmedEmail = emailText.length > MAX_EMAIL_CHARS
      ? emailText.slice(0, MAX_EMAIL_CHARS) + "\n\n[…truncated…]"
      : emailText;

    const prompt = `Summarize this vendor email for a couple planning their wedding. Extract pricing, availability, terms, next steps.

Email:
${trimmedEmail}

Return ONLY this JSON (no markdown):
{"summary":"2-3 sentence plain summary","keyPoints":["..."],"actionItems":["..."]}${langInstruction}`;

    const completion = await openai.chat.completions.create({
      model: getModel(),
      max_completion_tokens: 800,
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
