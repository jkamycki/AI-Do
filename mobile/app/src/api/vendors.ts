import type { Payment, Vendor, VendorStatus } from '../types';
import { mobileAuthFetch } from './mobileAuth';

type BackendVendorPayment = {
  amount?: number | string | null;
  dueDate?: string | null;
  id?: number | string;
  isPaid?: boolean | null;
  label?: string | null;
};

type BackendVendor = {
  category?: string | null;
  contractSigned?: boolean | null;
  depositAmount?: number | string | null;
  email?: string | null;
  id: number | string;
  name?: string | null;
  nextPaymentDue?: string | null;
  payments?: BackendVendorPayment[];
  phone?: string | null;
  primaryContact?: string | null;
  totalCost?: number | string | null;
};

type VendorSyncResult = {
  synced: boolean;
  vendor?: Vendor;
};

type VendorPaymentInput = {
  amount: number;
  date: string;
  isPaid?: boolean;
  note: string;
};

function money(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function isBackendId(id: string) {
  return /^\d+$/.test(id);
}

function statusForVendor(total: number, paid: number, signed: boolean): VendorStatus {
  if (total > 0 && paid >= total) return 'Completed';
  if (signed) return 'Signed';
  return 'Pending';
}

function vendorPayload(vendor: Vendor) {
  return {
    category: vendor.category.trim(),
    contractSigned: vendor.status === 'Signed' || vendor.status === 'Completed',
    depositAmount: vendor.paid,
    email: vendor.email?.trim() || null,
    name: vendor.name.trim(),
    nextPaymentDue: vendor.nextPaymentDate || null,
    phone: vendor.phone?.trim() || null,
    primaryContact: vendor.contactName?.trim() || null,
    totalCost: vendor.committed,
  };
}

function toMobileVendor(vendor: BackendVendor, fallback?: Vendor): Vendor {
  const payments = vendor.payments ?? [];
  const paidMilestones = payments.filter((payment) => payment.isPaid);
  const total = money(vendor.totalCost ?? fallback?.committed);
  const paid = Math.min(
    total,
    money(vendor.depositAmount ?? fallback?.paid) + paidMilestones.reduce((sum, payment) => sum + money(payment.amount), 0),
  );
  const nextPayment = payments
    .filter((payment) => !payment.isPaid)
    .sort((a, b) => String(a.dueDate ?? '').localeCompare(String(b.dueDate ?? '')))[0];

  return {
    arrivalTime: fallback?.arrivalTime,
    category: vendor.category?.trim() || fallback?.category || 'Other',
    committed: total,
    contactName: vendor.primaryContact?.trim() || fallback?.contactName || '',
    email: vendor.email?.trim() || fallback?.email || '',
    id: String(vendor.id ?? fallback?.id ?? `vendor-${Date.now()}`),
    name: vendor.name?.trim() || fallback?.name || 'Vendor',
    nextPaymentDate: nextPayment?.dueDate || vendor.nextPaymentDue || fallback?.nextPaymentDate,
    paid,
    payments: payments.map((payment) => ({
      amount: money(payment.amount),
      date: payment.dueDate || '',
      id: String(payment.id ?? `payment-${Date.now()}`),
      isPaid: Boolean(payment.isPaid),
      note: payment.label || 'Scheduled payment',
    })),
    phone: vendor.phone?.trim() || fallback?.phone || '',
    remaining: Math.max(0, total - paid),
    status: statusForVendor(total, paid, Boolean(vendor.contractSigned)),
  };
}

function toMobilePayment(payment: BackendVendorPayment): Payment {
  return {
    amount: money(payment.amount),
    date: payment.dueDate || '',
    id: String(payment.id ?? `payment-${Date.now()}`),
    isPaid: Boolean(payment.isPaid),
    note: payment.label || 'Scheduled payment',
  };
}

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string; message?: string };
    return body.error || body.message || 'Vendor sync failed.';
  } catch {
    return 'Vendor sync failed.';
  }
}

export async function createMobileVendor(vendor: Vendor): Promise<VendorSyncResult> {
  const response = await mobileAuthFetch('/api/vendors', {
    body: JSON.stringify(vendorPayload(vendor)),
    method: 'POST',
  });
  if (!response) return { synced: false };
  if (!response.ok) throw new Error(await readError(response));
  return { synced: true, vendor: toMobileVendor((await response.json()) as BackendVendor, vendor) };
}

export async function updateMobileVendor(vendor: Vendor): Promise<VendorSyncResult> {
  if (!isBackendId(vendor.id)) return { synced: false };
  const response = await mobileAuthFetch(`/api/vendors/${vendor.id}`, {
    body: JSON.stringify(vendorPayload(vendor)),
    method: 'PUT',
  });
  if (!response) return { synced: false };
  if (!response.ok) throw new Error(await readError(response));
  return { synced: true, vendor: toMobileVendor((await response.json()) as BackendVendor, vendor) };
}

export async function deleteMobileVendor(vendorId: string): Promise<{ synced: boolean }> {
  if (!isBackendId(vendorId)) return { synced: false };
  const response = await mobileAuthFetch(`/api/vendors/${vendorId}`, { method: 'DELETE' });
  if (!response) return { synced: false };
  if (!response.ok) throw new Error(await readError(response));
  return { synced: true };
}

export async function createMobileVendorPayment(vendorId: string, payment: VendorPaymentInput): Promise<{ payment?: Payment; synced: boolean }> {
  if (!isBackendId(vendorId)) return { synced: false };
  const response = await mobileAuthFetch(`/api/vendors/${vendorId}/payments`, {
    body: JSON.stringify({
      amount: payment.amount,
      dueDate: payment.date,
      isPaid: Boolean(payment.isPaid),
      label: payment.note.trim() || 'Payment',
      reopenBalance: !payment.isPaid,
    }),
    method: 'POST',
  });
  if (!response) return { synced: false };
  if (!response.ok) throw new Error(await readError(response));
  return { payment: toMobilePayment((await response.json()) as BackendVendorPayment), synced: true };
}

export async function updateMobileVendorPayment(
  vendorId: string,
  paymentId: string,
  patch: Partial<VendorPaymentInput>,
): Promise<{ payment?: Payment; synced: boolean }> {
  if (!isBackendId(vendorId) || !isBackendId(paymentId)) return { synced: false };
  const response = await mobileAuthFetch(`/api/vendors/${vendorId}/payments/${paymentId}`, {
    body: JSON.stringify({
      ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
      ...(patch.date !== undefined ? { dueDate: patch.date } : {}),
      ...(patch.isPaid !== undefined ? { isPaid: patch.isPaid } : {}),
      ...(patch.note !== undefined ? { label: patch.note.trim() || 'Payment' } : {}),
      ...(patch.isPaid === false ? { reopenBalance: true } : {}),
    }),
    method: 'PUT',
  });
  if (!response) return { synced: false };
  if (!response.ok) throw new Error(await readError(response));
  return { payment: toMobilePayment((await response.json()) as BackendVendorPayment), synced: true };
}

export async function deleteMobileVendorPayment(vendorId: string, paymentId: string): Promise<{ synced: boolean }> {
  if (!isBackendId(vendorId) || !isBackendId(paymentId)) return { synced: false };
  const response = await mobileAuthFetch(`/api/vendors/${vendorId}/payments/${paymentId}`, { method: 'DELETE' });
  if (!response) return { synced: false };
  if (!response.ok) throw new Error(await readError(response));
  return { synced: true };
}

export async function markMobileVendorPaidInFull(vendorId: string): Promise<{ payment?: Payment; synced: boolean }> {
  if (!isBackendId(vendorId)) return { synced: false };
  const response = await mobileAuthFetch(`/api/vendors/${vendorId}/payments/mark-paid-in-full`, { method: 'POST' });
  if (!response) return { synced: false };
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as { payment?: BackendVendorPayment | null };
  return { payment: body.payment ? toMobilePayment(body.payment) : undefined, synced: true };
}
