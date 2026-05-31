import type { BudgetExpense, Payment } from '../types';
import { mobileAuthFetch } from './mobileAuth';

type BackendBudgetItem = {
  actualCost?: number | string | null;
  amountPaid?: number | string | null;
  category?: string | null;
  estimatedCost?: number | string | null;
  id: number | string;
  isPaid?: boolean | null;
  nextPaymentDue?: string | null;
  notes?: string | null;
  vendor?: string | null;
};

type BackendBudgetPayment = {
  amount?: number | string | null;
  id?: number | string;
  newAmountPaid?: number | string | null;
  note?: string | null;
  paidAt?: string | null;
};

type BudgetSyncResult = {
  expense?: BudgetExpense;
  synced: boolean;
};

function money(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function isBackendId(id: string) {
  return /^\d+$/.test(id);
}

function budgetPayload(expense: BudgetExpense) {
  return {
    actualCost: expense.total,
    amountPaid: expense.paid,
    category: expense.category.trim(),
    estimatedCost: expense.total,
    isPaid: expense.total > 0 && expense.paid >= expense.total,
    nextPaymentDue: expense.nextPayment?.date ?? null,
    notes: expense.nextPayment ? `Next payment: $${expense.nextPayment.amount}` : null,
    vendor: expense.title.trim(),
  };
}

function toMobileExpense(item: BackendBudgetItem, fallback?: BudgetExpense): BudgetExpense {
  const total = money(item.actualCost ?? item.estimatedCost ?? fallback?.total);
  const paid = money(item.amountPaid ?? fallback?.paid);
  const fallbackNextAmount = fallback?.nextPayment?.amount;
  const remaining = Math.max(0, total - paid);
  return {
    category: item.category?.trim() || fallback?.category || 'Other',
    id: String(item.id ?? fallback?.id ?? `budget-${Date.now()}`),
    nextPayment: item.nextPaymentDue
      ? {
          amount: fallbackNextAmount ?? remaining,
          date: item.nextPaymentDue,
        }
      : fallback?.nextPayment,
    paid,
    payments: fallback?.payments ?? [],
    title: item.vendor?.trim() || fallback?.title || 'Budget item',
    total,
  };
}

function toMobilePayment(payment: BackendBudgetPayment): Payment {
  return {
    amount: money(payment.amount),
    date: payment.paidAt ? payment.paidAt.slice(0, 10) : '',
    id: String(payment.id ?? `budget-payment-${Date.now()}`),
    isPaid: true,
    note: payment.note || 'Mobile budget payment',
  };
}

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string; message?: string };
    return body.error || body.message || 'Budget sync failed.';
  } catch {
    return 'Budget sync failed.';
  }
}

export async function createMobileBudgetExpense(expense: BudgetExpense): Promise<BudgetSyncResult> {
  const response = await mobileAuthFetch('/api/budget/items', {
    body: JSON.stringify(budgetPayload(expense)),
    method: 'POST',
  });
  if (!response) return { synced: false };
  if (!response.ok) throw new Error(await readError(response));
  return { expense: toMobileExpense((await response.json()) as BackendBudgetItem, expense), synced: true };
}

export async function updateMobileBudgetExpense(expense: BudgetExpense): Promise<BudgetSyncResult> {
  if (!isBackendId(expense.id)) return { synced: false };
  const response = await mobileAuthFetch(`/api/budget/items/${expense.id}`, {
    body: JSON.stringify(budgetPayload(expense)),
    method: 'PUT',
  });
  if (!response) return { synced: false };
  if (!response.ok) throw new Error(await readError(response));
  return { expense: toMobileExpense((await response.json()) as BackendBudgetItem, expense), synced: true };
}

export async function deleteMobileBudgetExpense(expenseId: string): Promise<{ synced: boolean }> {
  if (!isBackendId(expenseId)) return { synced: false };
  const response = await mobileAuthFetch(`/api/budget/items/${expenseId}`, { method: 'DELETE' });
  if (!response) return { synced: false };
  if (!response.ok) throw new Error(await readError(response));
  return { synced: true };
}

export async function createMobileBudgetPayment(
  expenseId: string,
  payment: { amount: number; date: string; note: string },
): Promise<{ newAmountPaid?: number; payment?: Payment; synced: boolean }> {
  if (!isBackendId(expenseId)) return { synced: false };
  const response = await mobileAuthFetch(`/api/budget/items/${expenseId}/payments`, {
    body: JSON.stringify({
      amount: payment.amount,
      note: payment.note.trim() || 'Mobile budget payment',
      paidAt: payment.date,
    }),
    method: 'POST',
  });
  if (!response) return { synced: false };
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as BackendBudgetPayment;
  return {
    newAmountPaid: body.newAmountPaid != null ? money(body.newAmountPaid) : undefined,
    payment: toMobilePayment(body),
    synced: true,
  };
}
