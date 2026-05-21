import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { useLocation } from "wouter";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  useGetBudget,
  useSaveBudget,
  getGetBudgetQueryKey,
  useListManualExpenses,
  useCreateManualExpense,
  useUpdateManualExpense,
  useDeleteManualExpense,
  getListManualExpensesQueryKey,
  getGetDashboardSummaryQueryKey,
  getListVendorsQueryKey,
  getGetVendorQueryKey,
} from "@workspace/api-client-react";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@workspace/object-storage-web";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ToastAction } from "@/components/ui/toast";
import { DollarSign, Plus, Trash2, Pencil, ArrowUpRight, Sparkles, Paperclip, X, AlertTriangle, Bell, CheckCircle2, Square, FileDown, FileSpreadsheet } from "lucide-react";
import { useTranslation } from "react-i18next";

const MANUAL_CATEGORIES = [
  "Attire",
  "Rings",
  "Décor",
  "Gifts",
  "Tips",
  "Hotel",
  "Travel",
  "DIY",
  "Beauty",
  "Stationery",
  "Honeymoon",
  "Other",
];

interface VendorRow {
  id: number;
  name: string;
  category: string;
  totalCost: number;
  depositAmount: number;
  totalPaid: number;
  isPaidOff: boolean;
  nextPaymentDue: string | null;
  nextPaymentId: number | null;
  nextPaymentAmount: number | null;
  nextPaymentLabel: string | null;
}
interface VendorFinancials {
  vendorCount: number;
  totalCommitted: number;
  totalPaid: number;
  vendors: VendorRow[];
}

type RecentPaymentUndoMap = Record<string, { run: () => void }>;

interface ManualExpenseFormState {
  name: string;
  category: string;
  cost: string;
  amountPaid: string;
  nextPaymentDue: string;
  nextPaymentAmount: string;
  paidInFull: boolean;
  notes: string;
  receiptUrl: string | null;
  receiptName: string | null;
}

interface VendorBudgetFormState {
  name: string;
  category: string;
  totalCost: string;
  depositAmount: string;
  nextPaymentDue: string;
  nextPaymentAmount: string;
  paidInFull: boolean;
}

const emptyManualForm = (): ManualExpenseFormState => ({
  name: "",
  category: "Other",
  cost: "",
  amountPaid: "",
  nextPaymentDue: "",
  nextPaymentAmount: "",
  paidInFull: false,
  notes: "",
  receiptUrl: null,
  receiptName: null,
});

const emptyVendorBudgetForm = (): VendorBudgetFormState => ({
  name: "",
  category: "Other",
  totalCost: "",
  depositAmount: "",
  nextPaymentDue: "",
  nextPaymentAmount: "",
  paidInFull: false,
});

function formatMoney(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

function cappedPaid(total: number, paid: number) {
  return Math.min(Math.max(0, paid || 0), Math.max(0, total || 0));
}

function moneyMatches(a: number, b: number) {
  return Math.round((a || 0) * 100) === Math.round((b || 0) * 100);
}

function safeReceiptHref(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return (u.protocol === "https:" || u.protocol === "http:") ? u.toString() : null;
  } catch {
    return null;
  }
}

function formatDate(d: string | null) {
  if (!d) return "-";
  try {
    const dt = new Date(d.length <= 10 ? `${d}T00:00:00` : d);
    return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return d;
  }
}

function formatReportDate(d: string | null | undefined) {
  return d ? formatDate(d) : "-";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const VENDOR_CATEGORY_BADGE_STYLES: Record<string, string> = {
  "Venue": "border-transparent bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  "Caterer": "border-transparent bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  "Photographer": "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "Videographer": "border-transparent bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  "Florist": "border-transparent bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  "DJ / Band": "border-transparent bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  "Officiant": "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  "Hair & Makeup": "border-transparent bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  "Transportation": "border-transparent bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  "Cake & Desserts": "border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  "Invitations": "border-transparent bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300",
  "Lighting & AV": "border-transparent bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  "Photo Booth": "border-transparent bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300",
  "Wedding Planner": "border-transparent bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  "Other": "border-transparent bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};
const VENDOR_CATEGORIES = Object.keys(VENDOR_CATEGORY_BADGE_STYLES);
const MANUAL_CATEGORY_BADGE_STYLES: Record<string, string> = {
  "Attire": "border-transparent bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  "Rings": "border-transparent bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  "Decor": "border-transparent bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300",
  "Gifts": "border-transparent bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300",
  "Tips": "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  "Hotel": "border-transparent bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  "Travel": "border-transparent bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  "DIY": "border-transparent bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  "Beauty": "border-transparent bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  "Stationery": "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "Honeymoon": "border-transparent bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
};
const ALL_CATEGORY_BADGE_STYLES: Record<string, string> = {
  ...VENDOR_CATEGORY_BADGE_STYLES,
  ...MANUAL_CATEGORY_BADGE_STYLES,
};

function normalizeCategoryLabel(category: string | null | undefined) {
  const raw = String(category ?? "").trim();
  if (/^dj\s*\/?\s*(band)?$/i.test(raw) || /^dj\s*\/\s*band$/i.test(raw)) return "DJ / Band";
  if (/^d[Ã©e]cor$/i.test(raw)) return "Decor";
  const found = Object.keys(ALL_CATEGORY_BADGE_STYLES).find((cat) => cat.toLowerCase() === raw.toLowerCase());
  return found ?? (raw || "Other");
}

function displayCategoryLabel(category: string | null | undefined) {
  const normalized = normalizeCategoryLabel(category);
  return normalized === "DJ / Band" ? "DJ/Band" : normalized;
}

function categoryBadgeClass(category: string) {
  return ALL_CATEGORY_BADGE_STYLES[normalizeCategoryLabel(category)] ?? VENDOR_CATEGORY_BADGE_STYLES.Other;
}

function CategoryBadge({ category }: { category: string }) {
  const label = displayCategoryLabel(category);
  return (
    <Badge variant="outline" className={`rounded-full border px-2.5 py-0.5 font-medium ${categoryBadgeClass(label)}`}>
      {label}
    </Badge>
  );
}

function PaidInFullMergedCell({
  onUndo,
  t,
}: {
  onUndo?: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <TableCell colSpan={2} className="text-sm">
      <div className="flex min-w-[376px] flex-col items-center gap-2">
        <div className="flex h-9 w-full items-center justify-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-100 px-3 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {t("budget.paid_in_full", { defaultValue: "Paid in full" })}
        </div>
        {onUndo && <UndoPaymentButton onClick={onUndo} t={t} />}
      </div>
    </TableCell>
  );
}

function MarkPaidInFullButton({
  onClick,
  t,
}: {
  onClick: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-9 w-full justify-start gap-2 rounded-md border-border bg-background px-3 text-sm font-semibold text-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
      onClick={onClick}
    >
      <Square className="h-4 w-4 shrink-0" />
      {t("budget.mark_paid_in_full", { defaultValue: "Paid Remaining Balance" })}
    </Button>
  );
}

function PaymentCompleteButton({
  onClick,
  paysRemaining = false,
  t,
}: {
  onClick: () => void;
  paysRemaining?: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-9 w-full justify-start gap-2 rounded-md border-border bg-background px-3 text-sm font-semibold text-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
      onClick={onClick}
      title={t("budget.mark_paid_title", { defaultValue: "Mark this payment complete (adds it to Paid total)" })}
    >
      <Square className="h-4 w-4 shrink-0" />
      {paysRemaining
        ? t("budget.mark_remaining_paid", { defaultValue: "Paid Remaining Balance" })
        : t("budget.mark_paid", { defaultValue: "Payment Complete" })}
    </Button>
  );
}

function UndoPaymentButton({
  onClick,
  t,
}: {
  onClick: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="h-8 w-full justify-start px-3 text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary"
      onClick={onClick}
    >
      {t("budget.undo_payment", { defaultValue: "Undo payment" })}
    </Button>
  );
}

function BalanceRemainingActions({
  onSchedule,
  t,
}: {
  onSchedule: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-7 border-primary/35 px-2.5 text-xs font-semibold text-primary hover:bg-primary/10"
      onClick={onSchedule}
    >
      <Bell className="mr-1 h-3.5 w-3.5" />
      {t("budget.schedule_payment", { defaultValue: "Schedule payment" })}
    </Button>
  );
}

function RemainingAmount({ amount }: { amount: number }) {
  const isPaid = amount <= 0;
  return (
    <span
      className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold tabular-nums ${
        isPaid
          ? "border-emerald-500/30 bg-emerald-50 text-emerald-800"
          : "border-amber-500/25 bg-amber-50 text-amber-800"
      }`}
    >
      {formatMoney(amount)}
    </span>
  );
}

function PaymentStatusDecision({
  paidInFull,
  remaining,
  onPaidInFull,
  onSchedulePayment,
  paidHint,
  partialHint,
  t,
}: {
  paidInFull: boolean;
  remaining: number;
  onPaidInFull: () => void;
  onSchedulePayment: () => void;
  paidHint: string;
  partialHint: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <div className="min-w-0 space-y-3 overflow-hidden rounded-lg border border-primary/20 bg-primary/5 p-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          {t("budget.payment_status_question", { defaultValue: "Is the remaining balance paid?" })}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("budget.payment_status_hint", {
            amount: formatMoney(remaining),
            defaultValue: `Balance remaining: ${formatMoney(remaining)}. Choose yes to close it out, or no to schedule the next payment.`,
          })}
        </p>
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <button
          type="button"
          onClick={onPaidInFull}
          className={`flex w-full min-w-0 items-start gap-3 rounded-lg border p-3 text-left transition ${
            paidInFull
              ? "border-emerald-500/45 bg-emerald-50 text-emerald-900 shadow-sm"
              : "border-border bg-background hover:border-emerald-500/35 hover:bg-emerald-50/60"
          }`}
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0">
            <span className="block break-words text-sm font-semibold leading-snug">
              {t("budget.yes_paid_in_full", { defaultValue: "Yes - paid remaining" })}
            </span>
            <span className="mt-1 block text-xs opacity-80">{paidHint}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={onSchedulePayment}
          className={`flex w-full min-w-0 items-start gap-3 rounded-lg border p-3 text-left transition ${
            !paidInFull
              ? "border-primary/45 bg-background text-primary shadow-sm"
              : "border-border bg-background hover:border-primary/35 hover:bg-primary/5"
          }`}
        >
          <Bell className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0">
            <span className="block break-words text-sm font-semibold leading-snug">
              {t("budget.no_schedule_payment", { defaultValue: "No - schedule next payment" })}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">{partialHint}</span>
          </span>
        </button>
      </div>
    </div>
  );
}

// Returns days from today until the given ISO date (negative = past).
// Used by the budget table to color-code the next-payment cell.
function daysUntilDate(d: string | null | undefined): number {
  if (!d) return Infinity;
  try {
    const dt = new Date(d.length <= 10 ? `${d}T00:00:00` : d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((dt.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return Infinity;
  }
}

function dateTimeValue(d: string | null | undefined): number {
  if (!d) return Number.POSITIVE_INFINITY;
  const dt = new Date(d.length <= 10 ? `${d}T00:00:00` : d);
  return Number.isNaN(dt.getTime()) ? Number.POSITIVE_INFINITY : dt.getTime();
}

function NextPaymentDisplay({
  date,
  amount = 0,
  onMarkPaid,
  toneClass,
  t,
}: {
  date: string | null | undefined;
  amount?: number;
  onMarkPaid?: () => void;
  toneClass?: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  if (!date) return <span className="text-muted-foreground text-xs">-</span>;
  const daysUntil = daysUntilDate(date);
  const isOverdue = daysUntil < 0;
  const isDueSoon = daysUntil >= 0 && daysUntil <= 7;
  const tone = toneClass ?? (
    isOverdue
      ? "text-red-700 dark:text-red-300"
      : isDueSoon
        ? "text-amber-700 dark:text-amber-300"
        : "text-muted-foreground"
  );
  const dueStatus = isOverdue
    ? t("vendors.payment_overdue_banner", { n: Math.abs(daysUntil), defaultValue: `Payment overdue by ${Math.abs(daysUntil)} day(s)` })
    : daysUntil === 0
      ? t("vendors.payment_due_today_banner", { defaultValue: "Payment due today" })
      : t("vendors.payment_due_in_banner", { n: daysUntil, defaultValue: `Payment in ${daysUntil} day(s)` });
  return (
    <div className={`inline-flex min-w-[150px] max-w-[220px] flex-col gap-2 rounded-md border border-border/70 bg-muted/25 px-2.5 py-2 text-xs ${tone}`}>
      <div className="flex items-start gap-2">
        {isOverdue
          ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          : <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
        <span className="min-w-0 leading-tight">
          <span className="block font-semibold">{dueStatus}</span>
          <span className="mt-0.5 block text-[11px] font-medium text-muted-foreground">{formatDate(date)}</span>
        </span>
      </div>
      {(amount > 0 || onMarkPaid) && (
        <div className="flex flex-wrap items-center gap-2 pl-5 text-foreground">
          {amount > 0 && <span className="tabular-nums text-sm font-semibold">{formatMoney(amount)}</span>}
          {onMarkPaid && (
            <PaymentCompleteButton onClick={onMarkPaid} t={t} />
          )}
        </div>
      )}
    </div>
  );
}

export default function Budget() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();

  const { data: budget, isLoading: isLoadingBudget } = useGetBudget();
  const saveBudget = useSaveBudget();
  const [budgetDraft, setBudgetDraft] = useState<string>("");
  const [editingBudget, setEditingBudget] = useState(false);

  const { data: vendorFinancials, isLoading: isLoadingVendors } = useQuery({
    queryKey: ["vendor-financials"],
    queryFn: async () => {
      const res = await authFetch("/api/vendors/financials");
      if (!res.ok) throw new Error("Failed to fetch vendor financials");
      return (await res.json()) as VendorFinancials;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const { data: manualExpenses = [], isLoading: isLoadingManual } = useListManualExpenses();
  const orderedVendorRows = useMemo(
    () => [...(vendorFinancials?.vendors ?? [])].sort((a, b) => a.id - b.id),
    [vendorFinancials?.vendors],
  );
  const createManual = useCreateManualExpense();
  const updateManual = useUpdateManualExpense();
  const deleteManual = useDeleteManualExpense();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ManualExpenseFormState>(emptyManualForm());
  const [editingVendor, setEditingVendor] = useState<VendorRow | null>(null);
  const [vendorForm, setVendorForm] = useState<VendorBudgetFormState>(emptyVendorBudgetForm());
  const [isSavingVendorBudget, setIsSavingVendorBudget] = useState(false);
  const [isResettingPaymentStatus, setIsResettingPaymentStatus] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [recentPaymentUndo, setRecentPaymentUndo] = useState<RecentPaymentUndoMap>({});
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const undoTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const manualFormCost = Math.max(0, Number(form.cost || 0));
  const manualFormPaid = form.paidInFull ? manualFormCost : Math.max(0, Number(form.amountPaid || 0));
  const manualFormRemaining = Math.max(0, manualFormCost - manualFormPaid);
  const vendorFormCost = Math.max(0, Number(vendorForm.totalCost || 0));
  const vendorExistingPaid = editingVendor?.totalPaid ?? 0;
  const vendorFormDeposit = Math.max(0, Number(vendorForm.depositAmount || 0));
  const vendorFormPaid = vendorForm.paidInFull ? vendorFormCost : Math.max(vendorExistingPaid, vendorFormDeposit);
  const vendorFormRemaining = Math.max(0, vendorFormCost - vendorFormPaid);

  const upload = useUpload({
    getToken,
    onError: (e) => toast({ title: t("budget.toast_upload_failed"), description: e.message, variant: "destructive" }),
  });

  useEffect(() => {
    return () => {
      Object.values(undoTimersRef.current).forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (location !== "/budget/summary") return;
    if (isLoadingBudget || isLoadingVendors || isLoadingManual) return;
    window.requestAnimationFrame(() => {
      summaryRef.current?.scrollIntoView({ block: "start" });
    });
  }, [isLoadingBudget, isLoadingManual, isLoadingVendors, location]);

  // ── Totals ────────────────────────────────────────────────────────
  const totalBudget = budget?.totalBudget ?? 0;
  const vendorCommitted = vendorFinancials?.totalCommitted ?? 0;
  const vendorPaid = vendorFinancials?.totalPaid ?? 0;
  const manualCommitted = useMemo(
    () => manualExpenses.reduce((s, m) => s + (m.cost ?? 0), 0),
    [manualExpenses],
  );
  const manualPaid = useMemo(
    () => manualExpenses.reduce((s, m) => s + cappedPaid(m.cost ?? 0, m.amountPaid ?? 0), 0),
    [manualExpenses],
  );
  const combinedSpend = vendorCommitted + manualCommitted;
  const combinedPaid = vendorPaid + manualPaid;
  const remaining = totalBudget - combinedSpend;
  const remainingToPay = Math.max(0, combinedSpend - combinedPaid);
  const overBudget = combinedSpend > totalBudget && totalBudget > 0;
  const usedPct = totalBudget > 0 ? Math.min((combinedSpend / totalBudget) * 100, 100) : 0;
  const categoryBreakdown = useMemo(() => {
    const byCategory = new Map<string, { category: string; total: number; paid: number; count: number }>();
    const add = (category: string | null | undefined, total: number, paid: number) => {
      const label = normalizeCategoryLabel(category);
      const current = byCategory.get(label) ?? { category: label, total: 0, paid: 0, count: 0 };
      current.total += total || 0;
      current.paid += paid || 0;
      current.count += 1;
      byCategory.set(label, current);
    };
    orderedVendorRows.forEach((v) => add(v.category, v.totalCost, v.totalPaid));
    manualExpenses.forEach((m) => add(m.category, m.cost ?? 0, cappedPaid(m.cost ?? 0, m.amountPaid ?? 0)));
    return [...byCategory.values()].sort((a, b) => b.total - a.total);
  }, [manualExpenses, orderedVendorRows]);
  // ── Handlers ──────────────────────────────────────────────────────
  const reportRows = useMemo(() => {
    const vendorRows = orderedVendorRows.map((v) => {
      const rowRemaining = Math.max(0, v.totalCost - v.totalPaid);
      return {
        source: "Vendor",
        name: v.name,
        category: displayCategoryLabel(v.category),
        total: v.totalCost,
        paid: v.totalPaid,
        remaining: rowRemaining,
        nextPaymentDate: v.nextPaymentDue,
        nextPaymentAmount: v.nextPaymentAmount ?? (v.nextPaymentDue ? rowRemaining : 0),
        status: rowRemaining <= 0 ? "Paid in full" : v.nextPaymentDue ? "Payment scheduled" : "Open balance",
      };
    });
    const manualRows = manualExpenses.map((m) => {
      const rowRemaining = Math.max(0, (m.cost ?? 0) - (m.amountPaid ?? 0));
      return {
        source: "Manual",
        name: m.name,
        category: displayCategoryLabel(m.category),
        total: m.cost ?? 0,
        paid: cappedPaid(m.cost ?? 0, m.amountPaid ?? 0),
        remaining: rowRemaining,
        nextPaymentDate: m.nextPaymentDue ?? null,
        nextPaymentAmount: m.nextPaymentAmount ?? 0,
        status: rowRemaining <= 0 ? "Paid in full" : m.nextPaymentDue ? "Payment scheduled" : "Open balance",
      };
    });
    return [...vendorRows, ...manualRows].sort((a, b) => {
      if (a.source !== b.source) return a.source.localeCompare(b.source);
      return a.name.localeCompare(b.name);
    });
  }, [manualExpenses, orderedVendorRows]);
  const reportDate = new Date().toISOString().slice(0, 10);
  const hasReportData = reportRows.length > 0 || totalBudget > 0 || combinedSpend > 0;

  const startEditBudget = () => {
    setBudgetDraft(String(totalBudget || ""));
    setEditingBudget(true);
  };
  const commitBudget = () => {
    const n = parseFloat(budgetDraft);
    if (isNaN(n) || n < 0) {
      setEditingBudget(false);
      return;
    }
    saveBudget.mutate(
      { data: { totalBudget: n } },
      {
        onSuccess: () => {
          toast({ title: t("budget.toast_budget_updated") });
          queryClient.invalidateQueries({ queryKey: getGetBudgetQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          setEditingBudget(false);
        },
        onError: () => toast({ variant: "destructive", title: t("budget.toast_could_not_update_budget") }),
      },
    );
  };

  const openAdd = () => {
    setForm(emptyManualForm());
    setEditingId(null);
    setIsAdding(true);
  };
  const openEdit = (m: typeof manualExpenses[number], options?: { scheduleNextPayment?: boolean }) => {
    const isPaidInFull = (m.cost ?? 0) > 0 && (m.amountPaid ?? 0) >= (m.cost ?? 0);
    const remaining = Math.max(0, (m.cost ?? 0) - (m.amountPaid ?? 0));
    setForm({
      name: m.name,
      category: m.category || "Other",
      cost: String(m.cost ?? 0),
      amountPaid: String(m.amountPaid ?? 0),
      nextPaymentDue: m.nextPaymentDue ?? "",
      nextPaymentAmount: m.nextPaymentAmount != null ? String(m.nextPaymentAmount) : options?.scheduleNextPayment && remaining > 0 ? String(remaining) : "",
      paidInFull: isPaidInFull,
      notes: m.notes ?? "",
      receiptUrl: m.receiptUrl ?? null,
      receiptName: m.receiptName ?? null,
    });
    setEditingId(m.id);
    setIsAdding(true);
  };
  const openVendorBudgetEdit = (vendor: VendorRow, options?: { scheduleNextPayment?: boolean }) => {
    const remaining = Math.max(0, vendor.totalCost - vendor.totalPaid);
    setEditingVendor(vendor);
    setVendorForm({
      name: vendor.name,
      category: normalizeCategoryLabel(vendor.category),
      totalCost: vendor.totalCost > 0 ? String(vendor.totalCost) : "",
      depositAmount: vendor.depositAmount > 0 ? String(vendor.depositAmount) : "",
      nextPaymentDue: vendor.nextPaymentDue ?? "",
      nextPaymentAmount: vendor.nextPaymentAmount != null ? String(vendor.nextPaymentAmount) : options?.scheduleNextPayment && remaining > 0 ? String(remaining) : "",
      paidInFull: vendor.totalCost > 0 && vendor.totalPaid >= vendor.totalCost,
    });
  };

  const markManualFormPaidInFull = () => {
    setForm((f) => ({
      ...f,
      paidInFull: true,
      amountPaid: f.cost,
      nextPaymentDue: "",
      nextPaymentAmount: "",
    }));
  };

  const scheduleManualFormPayment = () => {
    setForm((f) => {
      const cost = Math.max(0, Number(f.cost || 0));
      const paid = Math.max(0, Number(f.amountPaid || 0));
      const existingNext = Math.max(0, Number(f.nextPaymentAmount || 0));
      const balance = Math.max(0, cost - paid);
      const nextAmount = existingNext > 0 ? existingNext : balance > 0 ? balance : cost > 0 ? cost : 0;
      return {
        ...f,
        paidInFull: false,
        amountPaid: paid >= cost && nextAmount > 0 ? String(Math.max(0, cost - nextAmount)) : f.amountPaid,
        nextPaymentAmount: f.nextPaymentAmount || (nextAmount > 0 ? String(nextAmount) : ""),
      };
    });
  };

  const markVendorFormPaidInFull = () => {
    setVendorForm((f) => ({
      ...f,
      paidInFull: true,
      nextPaymentDue: "",
      nextPaymentAmount: "",
    }));
  };

  const scheduleVendorFormPayment = () => {
    setVendorForm((f) => {
      const cost = Math.max(0, Number(f.totalCost || 0));
      const paid = Math.max(editingVendor?.totalPaid ?? 0, Math.max(0, Number(f.depositAmount || 0)));
      const existingNext = Math.max(0, Number(f.nextPaymentAmount || 0));
      const balance = Math.max(0, cost - paid);
      const nextAmount = existingNext > 0 ? existingNext : balance > 0 ? balance : cost > 0 ? cost : 0;
      return {
        ...f,
        paidInFull: false,
        nextPaymentAmount: f.nextPaymentAmount || (nextAmount > 0 ? String(nextAmount) : ""),
      };
    });
  };

  const handleReceiptFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await upload.uploadFile(file);
    if (result?.objectPath) {
      setForm((f) => ({ ...f, receiptUrl: result.objectPath, receiptName: file.name }));
      toast({ title: t("budget.toast_receipt_uploaded") });
    }
    e.target.value = "";
  };

  const submitForm = () => {
    if (!form.name.trim()) {
      toast({ variant: "destructive", title: t("budget.toast_name_required") });
      return;
    }
    const costNum = parseFloat(form.cost) || 0;
    const paidInFull = form.paidInFull && costNum > 0;
    const scheduledAmount = Math.max(0, parseFloat(form.nextPaymentAmount) || 0);
    const rawPaidAmount = cappedPaid(costNum, parseFloat(form.amountPaid) || 0);
    const payload = {
      name: form.name.trim(),
      category: form.category || "Other",
      cost: costNum,
      amountPaid: paidInFull
        ? costNum
        : form.nextPaymentDue.trim() && scheduledAmount > 0
          ? Math.min(rawPaidAmount, Math.max(0, costNum - scheduledAmount))
          : rawPaidAmount,
      nextPaymentDue: paidInFull ? null : form.nextPaymentDue.trim() || null,
      nextPaymentAmount: paidInFull ? null : scheduledAmount || null,
      notes: form.notes.trim() || null,
      receiptUrl: form.receiptUrl,
      receiptName: form.receiptName,
    };
    const onDone = () => {
      queryClient.invalidateQueries({ queryKey: getListManualExpensesQueryKey() });
      setIsAdding(false);
      setEditingId(null);
      setForm(emptyManualForm());
    };
    if (editingId != null) {
      updateManual.mutate(
        { id: editingId, data: payload as never },
        {
          onSuccess: () => {
            toast({ title: t("budget.toast_expense_updated") });
            onDone();
          },
          onError: () => toast({ variant: "destructive", title: t("budget.toast_could_not_update_expense") }),
        },
      );
    } else {
      createManual.mutate(
        { data: payload as never },
        {
          onSuccess: () => {
            toast({ title: t("budget.toast_expense_added") });
            onDone();
          },
          onError: () => toast({ variant: "destructive", title: t("budget.toast_could_not_add_expense") }),
        },
      );
    }
  };

  const handleDelete = (id: number) => {
    if (!confirm(t("budget.confirm_delete_expense"))) return;
    deleteManual.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: t("budget.toast_expense_deleted") });
          queryClient.invalidateQueries({ queryKey: getListManualExpensesQueryKey() });
        },
        onError: () => toast({ variant: "destructive", title: t("budget.toast_could_not_delete_expense") }),
      },
    );
  };

  const refreshBudgetPaymentViews = async (vendorId?: number) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListManualExpensesQueryKey() }),
      queryClient.invalidateQueries({ queryKey: ["vendor-financials"] }),
      queryClient.invalidateQueries({ queryKey: getListVendorsQueryKey() }),
      vendorId ? queryClient.invalidateQueries({ queryKey: getGetVendorQueryKey(vendorId) }) : Promise.resolve(),
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }),
    ]);
  };

  const rememberPaymentUndo = (key: string, run: () => void) => {
    if (undoTimersRef.current[key]) {
      clearTimeout(undoTimersRef.current[key]);
    }
    setRecentPaymentUndo((current) => ({ ...current, [key]: { run } }));
    undoTimersRef.current[key] = setTimeout(() => {
      setRecentPaymentUndo((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      delete undoTimersRef.current[key];
    }, 15000);
  };

  const clearPaymentUndo = (key: string) => {
    if (undoTimersRef.current[key]) {
      clearTimeout(undoTimersRef.current[key]);
      delete undoTimersRef.current[key];
    }
    setRecentPaymentUndo((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const runRememberedUndo = (key: string) => {
    const undo = recentPaymentUndo[key];
    if (!undo) return;
    clearPaymentUndo(key);
    undo.run();
  };

  const undoManualExpenseUpdate = async (expense: typeof manualExpenses[number]) => {
    try {
      const r = await authFetch(`/api/manual-expenses/${expense.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountPaid: expense.amountPaid ?? 0,
          nextPaymentDue: expense.nextPaymentDue ?? null,
          nextPaymentAmount: expense.nextPaymentAmount ?? null,
        }),
      });
      if (!r.ok) throw new Error("Undo failed");
      clearPaymentUndo(`manual-${expense.id}`);
      toast({ title: t("budget.toast_payment_undone", { defaultValue: "Payment change undone" }) });
      await refreshBudgetPaymentViews();
    } catch {
      toast({ variant: "destructive", title: t("budget.toast_undo_failed", { defaultValue: "Couldn't undo that payment change. Please edit the item manually." }) });
    }
  };

  const showManualUndoToast = (expense: typeof manualExpenses[number], title: string) => {
    toast({
      title,
      description: t("budget.toast_undo_hint", { defaultValue: "Clicked by accident? Use Undo payment in this row or the button here." }),
      action: (
        <ToastAction altText={t("common.undo", { defaultValue: "Undo" })} onClick={() => undoManualExpenseUpdate(expense)}>
          {t("budget.undo_payment", { defaultValue: "Undo payment" })}
        </ToastAction>
      ),
    });
  };

  // One-click "Mark Paid" — hits the /mark-paid endpoint which atomically
  // adds nextPaymentAmount to amountPaid and clears both next-payment fields.
  // Generated client doesn't have a hook for this endpoint yet; calling
  // authFetch directly keeps the implementation self-contained.
  const handleMarkPaid = async (expenseOrId: typeof manualExpenses[number] | number) => {
    const expense = typeof expenseOrId === "number"
      ? manualExpenses.find((item) => item.id === expenseOrId)
      : expenseOrId;
    if (!expense) return;
    if (!confirm(t("budget.confirm_mark_paid", { defaultValue: "Mark this payment as paid? The amount will be added to the running paid total." }))) return;
    try {
      const r = await authFetch(`/api/manual-expenses/${expense.id}/mark-paid`, { method: "POST" });
      if (!r.ok) {
        toast({ variant: "destructive", title: t("budget.toast_mark_paid_failed", { defaultValue: "Couldn't mark payment paid. Please try again." }) });
        return;
      }
      rememberPaymentUndo(`manual-${expense.id}`, () => undoManualExpenseUpdate(expense));
      showManualUndoToast(expense, t("budget.toast_payment_recorded", { defaultValue: "Payment recorded" }));
      await refreshBudgetPaymentViews();
    } catch {
      toast({ variant: "destructive", title: t("budget.toast_mark_paid_failed", { defaultValue: "Couldn't mark payment paid. Please try again." }) });
    }
  };

  const handleManualPaidInFull = async (expense: typeof manualExpenses[number]) => {
    const cost = Number(expense.cost ?? 0);
    if (cost <= 0) return;
    if (!confirm(t("budget.confirm_mark_paid_in_full", { defaultValue: "Mark the remaining balance paid? This will set Paid to the total cost and clear the next payment date." }))) return;
    try {
      const r = await authFetch(`/api/manual-expenses/${expense.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountPaid: cost,
          nextPaymentDue: null,
          nextPaymentAmount: null,
        }),
      });
      if (!r.ok) {
        toast({ variant: "destructive", title: t("budget.toast_mark_paid_failed", { defaultValue: "Couldn't mark payment paid. Please try again." }) });
        return;
      }
      rememberPaymentUndo(`manual-${expense.id}`, () => undoManualExpenseUpdate(expense));
      showManualUndoToast(expense, t("budget.toast_paid_in_full", { defaultValue: "Marked paid remaining" }));
      await refreshBudgetPaymentViews();
    } catch {
      toast({ variant: "destructive", title: t("budget.toast_mark_paid_failed", { defaultValue: "Couldn't mark payment paid. Please try again." }) });
    }
  };

  const showVendorUndoToast = (title: string, undo: () => void) => {
    toast({
      title,
      description: t("budget.toast_undo_hint", { defaultValue: "Clicked by accident? Use Undo payment in this row or the button here." }),
      action: (
        <ToastAction altText={t("common.undo", { defaultValue: "Undo" })} onClick={undo}>
          {t("budget.undo_payment", { defaultValue: "Undo payment" })}
        </ToastAction>
      ),
    });
  };

  const undoVendorNextPayment = async (
    vendorId: number,
    payment: { id?: number | null; createdForMarkPaid?: boolean | null },
  ) => {
    if (!payment.id) return;
    try {
      const r = payment.createdForMarkPaid
        ? await authFetch(`/api/vendors/${vendorId}/payments/${payment.id}`, { method: "DELETE" })
        : await authFetch(`/api/vendors/${vendorId}/payments/${payment.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isPaid: false }),
          });
      if (!r.ok) throw new Error("Undo failed");
      clearPaymentUndo(`vendor-${vendorId}`);
      toast({ title: t("budget.toast_payment_undone", { defaultValue: "Payment change undone" }) });
      await refreshBudgetPaymentViews(vendorId);
    } catch {
      toast({ variant: "destructive", title: t("budget.toast_undo_failed", { defaultValue: "Couldn't undo that payment change. Please edit the item manually." }) });
    }
  };

  const handleVendorPaymentPaid = async (
    vendorId: number,
    payment?: { id?: number | null; dueDate?: string | null; amount?: number | null },
  ) => {
    if (!confirm(t("budget.confirm_mark_paid", { defaultValue: "Mark this payment as paid? The amount will be added to the running paid total." }))) return;
    try {
      const r = payment?.id
        ? await authFetch(`/api/vendors/${vendorId}/payments/${payment.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isPaid: true }),
          })
        : await authFetch(`/api/vendors/${vendorId}/payments/mark-next-paid`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dueDate: payment?.dueDate ?? null, amount: payment?.amount ?? null }),
          });
      if (!r.ok) {
        toast({ variant: "destructive", title: t("budget.toast_mark_paid_failed", { defaultValue: "Couldn't mark payment paid. Please try again." }) });
        return;
      }
      const result = await r.json().catch(() => null) as { id?: number; createdForMarkPaid?: boolean } | null;
      const undoPayment = {
        id: result?.id ?? payment?.id ?? null,
        createdForMarkPaid: result?.createdForMarkPaid ?? (!payment?.id && r.status === 201),
      };
      rememberPaymentUndo(`vendor-${vendorId}`, () => undoVendorNextPayment(vendorId, undoPayment));
      showVendorUndoToast(
        t("budget.toast_payment_recorded", { defaultValue: "Payment recorded" }),
        () => undoVendorNextPayment(vendorId, undoPayment),
      );
      await refreshBudgetPaymentViews(vendorId);
    } catch {
      toast({ variant: "destructive", title: t("budget.toast_mark_paid_failed", { defaultValue: "Couldn't mark payment paid. Please try again." }) });
    }
  };

  const undoVendorPaidInFull = async (
    vendorId: number,
    undo: { markedPaymentIds?: number[]; createdPaymentId?: number | null; previousNextPaymentDue?: string | null },
  ) => {
    try {
      const requests: Promise<Response>[] = [];
      if (undo.createdPaymentId) {
        requests.push(authFetch(`/api/vendors/${vendorId}/payments/${undo.createdPaymentId}`, { method: "DELETE" }));
      }
      for (const paymentId of undo.markedPaymentIds ?? []) {
        requests.push(authFetch(`/api/vendors/${vendorId}/payments/${paymentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPaid: false }),
        }));
      }
      requests.push(authFetch(`/api/vendors/${vendorId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nextPaymentDue: undo.previousNextPaymentDue ?? null }),
      }));
      const results = await Promise.all(requests);
      if (results.some((r) => !r.ok)) throw new Error("Undo failed");
      clearPaymentUndo(`vendor-${vendorId}`);
      toast({ title: t("budget.toast_payment_undone", { defaultValue: "Payment change undone" }) });
      await refreshBudgetPaymentViews(vendorId);
    } catch {
      toast({ variant: "destructive", title: t("budget.toast_undo_failed", { defaultValue: "Couldn't undo that payment change. Please edit the item manually." }) });
    }
  };

  const handleVendorPaidInFull = async (vendorId: number) => {
    if (!confirm(t("budget.confirm_mark_paid_in_full", { defaultValue: "Mark the remaining balance paid? This will set Paid to the total cost and clear the next payment date." }))) return;
    try {
      const r = await authFetch(`/api/vendors/${vendorId}/payments/mark-paid-in-full`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!r.ok) {
        toast({ variant: "destructive", title: t("budget.toast_mark_paid_failed", { defaultValue: "Couldn't mark payment paid. Please try again." }) });
        return;
      }
      const result = await r.json().catch(() => null) as {
        undo?: { markedPaymentIds?: number[]; createdPaymentId?: number | null; previousNextPaymentDue?: string | null };
      } | null;
      const undo = result?.undo ?? {};
      rememberPaymentUndo(`vendor-${vendorId}`, () => undoVendorPaidInFull(vendorId, undo));
      showVendorUndoToast(
        t("budget.toast_paid_in_full", { defaultValue: "Marked paid remaining" }),
        () => undoVendorPaidInFull(vendorId, undo),
      );
      await refreshBudgetPaymentViews(vendorId);
    } catch {
      toast({ variant: "destructive", title: t("budget.toast_mark_paid_failed", { defaultValue: "Couldn't mark payment paid. Please try again." }) });
    }
  };

  const handleDeleteSyncedVendor = async (vendor: VendorRow) => {
    if (!confirm(t("budget.confirm_delete_synced_vendor", {
      defaultValue: `Delete ${vendor.name} from Budget and Vendor List? This also removes synced vendor payment details.`,
    }))) return;
    try {
      const r = await authFetch(`/api/vendors/${vendor.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Delete vendor failed");
      clearPaymentUndo(`vendor-${vendor.id}`);
      toast({ title: t("budget.toast_vendor_deleted", { defaultValue: "Vendor deleted" }) });
      await refreshBudgetPaymentViews(vendor.id);
    } catch {
      toast({
        variant: "destructive",
        title: t("budget.toast_vendor_delete_failed", { defaultValue: "Couldn't delete vendor. Please try again." }),
      });
    }
  };

  const handleResetVendorPaymentStatus = async () => {
    if (!editingVendor) return;
    if (!confirm(t("budget.confirm_reset_payment_status", { defaultValue: "Reset this vendor's payment status? Paid milestones will be reopened and any auto-created paid-in-full balance will be removed." }))) return;
    setIsResettingPaymentStatus(true);
    try {
      const r = await authFetch(`/api/vendors/${editingVendor.id}/payments/reset-completion`, { method: "POST" });
      if (!r.ok) throw new Error("Reset vendor payment status failed");
      toast({ title: t("budget.toast_payment_status_reset", { defaultValue: "Payment status reset" }) });
      setEditingVendor(null);
      setVendorForm(emptyVendorBudgetForm());
      await refreshBudgetPaymentViews(editingVendor.id);
    } catch {
      toast({ variant: "destructive", title: t("budget.toast_payment_status_reset_failed", { defaultValue: "Couldn't reset payment status. Please try again." }) });
    } finally {
      setIsResettingPaymentStatus(false);
    }
  };

  const handleResetManualPaymentStatus = async () => {
    if (editingId == null) return;
    if (!confirm(t("budget.confirm_reset_payment_status", { defaultValue: "Reset this payment status? The paid amount will go back to $0 and the item will no longer be marked paid in full." }))) return;
    setIsResettingPaymentStatus(true);
    try {
      const r = await authFetch(`/api/manual-expenses/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountPaid: 0, nextPaymentDue: null, nextPaymentAmount: null }),
      });
      if (!r.ok) throw new Error("Reset manual payment status failed");
      toast({ title: t("budget.toast_payment_status_reset", { defaultValue: "Payment status reset" }) });
      queryClient.invalidateQueries({ queryKey: getListManualExpensesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      setIsAdding(false);
      setEditingId(null);
      setForm(emptyManualForm());
    } catch {
      toast({ variant: "destructive", title: t("budget.toast_payment_status_reset_failed", { defaultValue: "Couldn't reset payment status. Please try again." }) });
    } finally {
      setIsResettingPaymentStatus(false);
    }
  };

  const submitVendorBudgetForm = async () => {
    if (!editingVendor) return;
    const name = vendorForm.name.trim();
    const category = vendorForm.category.trim();
    const totalCost = Math.max(0, Number(vendorForm.totalCost || 0));
    const depositAmount = Math.max(0, Number(vendorForm.depositAmount || 0));
    const nextPaymentDue = vendorForm.paidInFull ? "" : vendorForm.nextPaymentDue.trim();
    const nextPaymentAmount = Math.max(0, Number(vendorForm.nextPaymentAmount || 0));

    if (!name || !category) {
      toast({
        variant: "destructive",
        title: t("budget.vendor_required_fields", { defaultValue: "Vendor name and category are required." }),
      });
      return;
    }
    if (!Number.isFinite(totalCost) || !Number.isFinite(depositAmount) || !Number.isFinite(nextPaymentAmount)) {
      toast({
        variant: "destructive",
        title: t("budget.vendor_invalid_money", { defaultValue: "Please enter valid dollar amounts." }),
      });
      return;
    }

    setIsSavingVendorBudget(true);
    try {
      const vendorResponse = await authFetch(`/api/vendors/${editingVendor.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category,
          totalCost,
          depositAmount,
          nextPaymentDue: nextPaymentDue || null,
        }),
      });
      if (!vendorResponse.ok) throw new Error("Vendor update failed");

      if (vendorForm.paidInFull) {
        const paidResponse = await authFetch(`/api/vendors/${editingVendor.id}/payments/mark-paid-in-full`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (!paidResponse.ok) throw new Error("Paid remaining failed");
        const result = await paidResponse.json().catch(() => null) as {
          undo?: { markedPaymentIds?: number[]; createdPaymentId?: number | null; previousNextPaymentDue?: string | null };
        } | null;
        showVendorUndoToast(
          t("budget.toast_vendor_updated_paid", { defaultValue: "Vendor updated and marked paid remaining" }),
          () => undoVendorPaidInFull(editingVendor.id, result?.undo ?? {}),
        );
      } else if (nextPaymentDue) {
        if (editingVendor.nextPaymentId) {
          const paymentResponse = await authFetch(`/api/vendors/${editingVendor.id}/payments/${editingVendor.nextPaymentId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dueDate: nextPaymentDue,
              amount: nextPaymentAmount || editingVendor.nextPaymentAmount || Math.max(0, totalCost - editingVendor.totalPaid),
              reopenBalance: true,
            }),
          });
          if (!paymentResponse.ok) throw new Error("Payment update failed");
        } else if (nextPaymentAmount > 0) {
          const paymentResponse = await authFetch(`/api/vendors/${editingVendor.id}/payments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              label: "Payment",
              dueDate: nextPaymentDue,
              amount: nextPaymentAmount,
              isPaid: false,
              reopenBalance: true,
            }),
          });
          if (!paymentResponse.ok) throw new Error("Payment create failed");
        }
        toast({ title: t("budget.toast_vendor_budget_updated", { defaultValue: "Vendor budget details updated" }) });
      } else {
        if (editingVendor.nextPaymentId) {
          const paymentResponse = await authFetch(`/api/vendors/${editingVendor.id}/payments/${editingVendor.nextPaymentId}`, {
            method: "DELETE",
          });
          if (!paymentResponse.ok) throw new Error("Payment delete failed");
        }
        toast({ title: t("budget.toast_vendor_budget_updated", { defaultValue: "Vendor budget details updated" }) });
      }

      setEditingVendor(null);
      setVendorForm(emptyVendorBudgetForm());
      await refreshBudgetPaymentViews(editingVendor.id);
    } catch {
      toast({
        variant: "destructive",
        title: t("budget.toast_vendor_budget_failed", { defaultValue: "Couldn't update vendor budget details. Please try again." }),
      });
    } finally {
      setIsSavingVendorBudget(false);
    }
  };

  const handleExportBudgetPdf = async () => {
    if (!hasReportData) return;
    setIsExportingPdf(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
      const margin = 36;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const burgundy = "#8D294D";
      const ink = "#33202A";
      const muted = "#7B5364";
      const ivory = "#FBF5EA";
      let y = margin;

      const ensurePage = (needed = 28) => {
        if (y + needed <= pageHeight - margin) return;
        doc.addPage();
        y = margin;
      };
      const money = (value: number) => `$${Math.round(value || 0).toLocaleString()}`;
      const fit = (text: string, width: number) => {
        const value = String(text ?? "");
        if (doc.getTextWidth(value) <= width) return value;
        let next = value;
        while (next.length > 3 && doc.getTextWidth(`${next}...`) > width) next = next.slice(0, -1);
        return `${next}...`;
      };

      doc.setFillColor(ivory);
      doc.rect(0, 0, pageWidth, pageHeight, "F");
      doc.setTextColor(burgundy);
      doc.setFont("times", "bold");
      doc.setFontSize(26);
      doc.text("A.IDO Budget Financial Report", margin, y);
      y += 24;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(muted);
      doc.text(`Generated ${formatDate(reportDate)} | Budget & Payments`, margin, y);
      y += 26;

      const cards = [
        ["Total Budget", money(totalBudget)],
        ["Committed", money(combinedSpend)],
        ["Paid", money(combinedPaid)],
        ["Remaining To Pay", money(remainingToPay)],
        [overBudget ? "Over Budget" : "Budget Remaining", money(Math.abs(remaining))],
        ["Budget Used", `${usedPct.toFixed(0)}%`],
      ];
      const cardW = (pageWidth - margin * 2 - 20) / 3;
      cards.forEach(([label, value], index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        const x = margin + col * (cardW + 10);
        const cardY = y + row * 58;
        doc.setFillColor("#FFF9F0");
        doc.setDrawColor("#E8C9D4");
        doc.roundedRect(x, cardY, cardW, 46, 6, 6, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(muted);
        doc.text(label.toUpperCase(), x + 10, cardY + 15);
        doc.setFont("times", "bold");
        doc.setFontSize(16);
        doc.setTextColor(ink);
        doc.text(value, x + 10, cardY + 34);
      });
      y += 122;

      doc.setFont("times", "bold");
      doc.setFontSize(17);
      doc.setTextColor(burgundy);
      doc.text("Payment Detail", margin, y);
      y += 16;

      const columns = [
        { label: "Source", width: 54, align: "left" as const },
        { label: "Item", width: 158, align: "left" as const },
        { label: "Category", width: 88, align: "left" as const },
        { label: "Total", width: 64, align: "right" as const },
        { label: "Paid", width: 64, align: "right" as const },
        { label: "Remaining", width: 72, align: "right" as const },
        { label: "Next Payment", width: 94, align: "left" as const },
        { label: "Status", width: 104, align: "left" as const },
      ];
      const tableX = margin;
      const drawHeader = () => {
        ensurePage(36);
        let x = tableX;
        doc.setFillColor(burgundy);
        doc.rect(tableX, y, columns.reduce((sum, col) => sum + col.width, 0), 22, "F");
        doc.setTextColor("#FFFFFF");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        columns.forEach((col) => {
          doc.text(col.label, x + 6, y + 14);
          x += col.width;
        });
        y += 22;
      };
      drawHeader();

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      reportRows.forEach((row, index) => {
        ensurePage(24);
        if (y === margin) drawHeader();
        const values = [
          row.source,
          row.name,
          row.category,
          money(row.total),
          money(row.paid),
          money(row.remaining),
          row.nextPaymentDate ? `${formatReportDate(row.nextPaymentDate)} (${money(row.nextPaymentAmount)})` : "-",
          row.status,
        ];
        const rowH = 22;
        doc.setFillColor(index % 2 === 0 ? "#FFF9F0" : "#F8EFE5");
        doc.rect(tableX, y, columns.reduce((sum, col) => sum + col.width, 0), rowH, "F");
        doc.setTextColor(ink);
        let x = tableX;
        values.forEach((value, colIndex) => {
          const col = columns[colIndex];
          const text = fit(value, col.width - 10);
          const textX = col.align === "right" ? x + col.width - 6 - doc.getTextWidth(text) : x + 6;
          doc.text(text, textX, y + 14);
          x += col.width;
        });
        y += rowH;
      });

      y += 22;
      ensurePage(80);
      doc.setFont("times", "bold");
      doc.setFontSize(15);
      doc.setTextColor(burgundy);
      doc.text("Category Breakdown", margin, y);
      y += 16;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(ink);
      categoryBreakdown.slice(0, 12).forEach((item) => {
        ensurePage(16);
        doc.text(`${displayCategoryLabel(item.category)}: ${money(item.total)} committed, ${money(item.paid)} paid (${item.count} item${item.count === 1 ? "" : "s"})`, margin, y);
        y += 14;
      });

      const pageCount = doc.getNumberOfPages();
      for (let page = 1; page <= pageCount; page += 1) {
        doc.setPage(page);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(muted);
        doc.text("Powered by A.IDO - aidowedding.net", margin, pageHeight - 18);
        doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin - 55, pageHeight - 18);
      }

      doc.save(`aido-budget-financial-report-${reportDate}.pdf`);
      toast({ title: t("budget.export_pdf_success", { defaultValue: "Budget PDF exported" }) });
    } catch {
      toast({ variant: "destructive", title: t("budget.export_pdf_failed", { defaultValue: "Couldn't export the budget PDF." }) });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportBudgetExcel = async () => {
    if (!hasReportData) return;
    setIsExportingExcel(true);
    try {
      const { default: ExcelJS } = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "A.IDO";
      workbook.created = new Date();
      const summary = workbook.addWorksheet("Summary");
      const details = workbook.addWorksheet("Payment Detail");
      const categories = workbook.addWorksheet("Categories");
      const moneyFormat = "$#,##0";
      const burgundy = "FF8D294D";
      const ivory = "FFFFF9F0";
      const pink = "FFF1D7DF";

      summary.columns = [{ width: 28 }, { width: 18 }, { width: 24 }, { width: 18 }];
      summary.mergeCells("A1:D1");
      summary.getCell("A1").value = "A.IDO Budget Financial Report";
      summary.getCell("A1").font = { bold: true, size: 18, color: { argb: burgundy } };
      summary.getCell("A2").value = `Generated ${formatDate(reportDate)}`;
      summary.getCell("A2").font = { italic: true, color: { argb: "FF7B5364" } };
      summary.addRow([]);
      summary.addRows([
        ["Metric", "Value", "Metric", "Value"],
        ["Total Budget", totalBudget, "Budget Used", usedPct / 100],
        ["Committed Spend", combinedSpend, "Paid Out", combinedPaid],
        ["Remaining To Pay", remainingToPay, overBudget ? "Over Budget" : "Budget Remaining", Math.abs(remaining)],
        ["Vendor Spend", vendorCommitted, "Manual Spend", manualCommitted],
        ["Vendor Paid", vendorPaid, "Manual Paid", manualPaid],
      ]);
      [4].forEach((rowNumber) => {
        summary.getRow(rowNumber).font = { bold: true, color: { argb: "FFFFFFFF" } };
        summary.getRow(rowNumber).fill = { type: "pattern", pattern: "solid", fgColor: { argb: burgundy } };
      });
      ["B", "D"].forEach((column) => {
        for (let row = 5; row <= 9; row += 1) {
          summary.getCell(`${column}${row}`).numFmt = row === 5 && column === "D" ? "0%" : moneyFormat;
        }
      });

      details.addRow(["Source", "Item", "Category", "Total", "Paid", "Remaining", "Next Payment Date", "Next Payment Amount", "Status"]);
      reportRows.forEach((row) => {
        details.addRow([
          row.source,
          row.name,
          row.category,
          row.total,
          row.paid,
          row.remaining,
          row.nextPaymentDate || "",
          row.nextPaymentAmount || 0,
          row.status,
        ]);
      });
      details.columns = [
        { width: 14 },
        { width: 32 },
        { width: 18 },
        { width: 14 },
        { width: 14 },
        { width: 14 },
        { width: 18 },
        { width: 20 },
        { width: 20 },
      ];
      details.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      details.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: burgundy } };
      details.views = [{ state: "frozen", ySplit: 1 }];
      details.autoFilter = "A1:I1";
      for (let row = 2; row <= reportRows.length + 1; row += 1) {
        details.getRow(row).fill = { type: "pattern", pattern: "solid", fgColor: { argb: row % 2 === 0 ? ivory : pink } };
        ["D", "E", "F", "H"].forEach((column) => {
          details.getCell(`${column}${row}`).numFmt = moneyFormat;
        });
      }

      categories.addRow(["Category", "Committed", "Paid", "Remaining", "Items"]);
      categoryBreakdown.forEach((item) => {
        categories.addRow([
          displayCategoryLabel(item.category),
          item.total,
          item.paid,
          Math.max(0, item.total - item.paid),
          item.count,
        ]);
      });
      categories.columns = [{ width: 22 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 10 }];
      categories.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      categories.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: burgundy } };
      for (let row = 2; row <= categoryBreakdown.length + 1; row += 1) {
        ["B", "C", "D"].forEach((column) => {
          categories.getCell(`${column}${row}`).numFmt = moneyFormat;
        });
      }

      for (const sheet of [summary, details, categories]) {
        sheet.eachRow((row) => {
          row.eachCell((cell) => {
            cell.border = {
              top: { style: "thin", color: { argb: "FFE8C9D4" } },
              left: { style: "thin", color: { argb: "FFE8C9D4" } },
              bottom: { style: "thin", color: { argb: "FFE8C9D4" } },
              right: { style: "thin", color: { argb: "FFE8C9D4" } },
            };
            cell.alignment = { vertical: "middle", wrapText: true };
          });
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      downloadBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `aido-budget-financial-report-${reportDate}.xlsx`);
      toast({ title: t("budget.export_excel_success", { defaultValue: "Budget Excel report exported" }) });
    } catch {
      toast({ variant: "destructive", title: t("budget.export_excel_failed", { defaultValue: "Couldn't export the budget Excel report." }) });
    } finally {
      setIsExportingExcel(false);
    }
  };

  if (isLoadingBudget) {
    return (
      <div className="space-y-8 max-w-6xl mx-auto">
        <Skeleton className="h-32" />
        <Skeleton className="h-96" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* ── Header & Total Budget ─────────────────────────────────── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="font-serif text-4xl text-primary">{t("budget.title")}</h1>
          <p className="text-muted-foreground">
            {t("budget.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleExportBudgetPdf}
            disabled={!hasReportData || isExportingPdf}
          >
            <FileDown className="h-4 w-4" />
            {isExportingPdf
              ? t("budget.exporting_pdf", { defaultValue: "Exporting PDF..." })
              : t("budget.export_pdf", { defaultValue: "Export PDF" })}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleExportBudgetExcel}
            disabled={!hasReportData || isExportingExcel}
          >
            <FileSpreadsheet className="h-4 w-4" />
            {isExportingExcel
              ? t("budget.exporting_excel", { defaultValue: "Exporting Excel..." })
              : t("budget.export_excel", { defaultValue: "Export Excel" })}
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          Budget figures and estimates in A.IDO are for personal planning purposes only and do not constitute financial, accounting, or tax advice.
          Always verify figures with your vendors directly. By using these tools you agree to our{" "}
          <a href="/terms" className="underline underline-offset-2 font-medium hover:opacity-80 transition-opacity">Terms of Service</a>.
        </p>
      </div>

      <Card className="border-primary/30 shadow-sm">
        <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">{t("budget.total_budget_label")}</p>
            {editingBudget ? (
              <div className="flex items-center gap-2">
                <div className="w-44">
                  <MoneyInput
                    value={budgetDraft}
                    onChange={setBudgetDraft}
                    onBlur={commitBudget}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitBudget();
                      if (e.key === "Escape") setEditingBudget(false);
                    }}
                    autoFocus
                    className="h-11 text-2xl font-serif"
                  />
                </div>
                <Button size="sm" onClick={commitBudget} disabled={saveBudget.isPending}>
                  {t("common.save")}
                </Button>
              </div>
            ) : (
              <button
                onClick={startEditBudget}
                className="font-serif text-4xl text-primary hover:opacity-80 transition flex items-center gap-2 group"
                title={t("budget.click_to_edit")}
              >
                {formatMoney(totalBudget)}
                <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </button>
            )}
          </div>
          <div className="flex-1 max-w-md w-full">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{t("budget.spent_so_far")}</span>
              <span className="font-medium text-foreground">{formatMoney(combinedSpend)}</span>
            </div>
            <Progress value={usedPct} className={overBudget ? "[&>div]:bg-destructive" : ""} />
            <p className={`text-xs mt-1 ${overBudget ? "text-destructive font-medium" : "text-muted-foreground"}`}>
              {overBudget
                ? t("budget.over_budget_by", { amount: formatMoney(combinedSpend - totalBudget) })
                : t("budget.amount_remaining", { amount: formatMoney(remaining) })}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Vendor-Synced Expenses ───────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 font-serif text-2xl text-primary">
                <Sparkles className="h-5 w-5" />
                {t("budget.vendor_synced_title")}
              </CardTitle>
              <CardDescription>
                {t("budget.vendor_synced_editable_desc", {
                  defaultValue: "Synced with your Vendor List. Edit payment details here, or open the vendor for contacts, files, and notes.",
                })}
              </CardDescription>
            </div>
            <Badge variant="secondary" className="gap-1 shrink-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
              <Sparkles className="h-3 w-3" /> {t("budget.synced_badge", { defaultValue: "Synced" })}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingVendors ? (
            <Skeleton className="h-40" />
          ) : !vendorFinancials || vendorFinancials.vendors.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-border rounded-lg">
              <p className="text-muted-foreground mb-3">{t("budget.no_vendors")}</p>
              <Button variant="outline" onClick={() => setLocation("/vendors")}>
                {t("budget.go_to_vendors")}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center font-bold">{t("budget.col_vendor")}</TableHead>
                    <TableHead className="text-center font-bold">{t("budget.col_category")}</TableHead>
                    <TableHead className="text-center font-bold">{t("budget.col_total_cost")}</TableHead>
                    <TableHead className="text-center font-bold">{t("budget.col_paid")}</TableHead>
                    <TableHead className="text-center font-bold">{t("budget.col_remaining")}</TableHead>
                    <TableHead className="text-center font-bold">{t("budget.col_next_payment")}</TableHead>
                    <TableHead className="min-w-[180px] text-center font-bold">{t("budget.col_payment_actions", { defaultValue: "Payment actions" })}</TableHead>
                    <TableHead className="min-w-[180px] text-center font-bold">{t("budget.col_progress")}</TableHead>
                    <TableHead className="text-right font-bold">{t("budget.col_actions", { defaultValue: "Actions" })}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderedVendorRows.map((v) => {
                    const remaining = Math.max(0, v.totalCost - v.totalPaid);
                    const pct = v.totalCost > 0 ? Math.min((v.totalPaid / v.totalCost) * 100, 100) : 0;
                    const nextPaymentPaysRemaining = !!v.nextPaymentDue && moneyMatches(v.nextPaymentAmount ?? remaining, remaining);
                    return (
                      <TableRow key={v.id}>
                        <TableCell className="text-center font-medium">{v.name}</TableCell>
                        <TableCell className="text-center">
                          <CategoryBadge category={v.category} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(v.totalCost)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(v.totalPaid)}</TableCell>
                        <TableCell className="text-right">
                          <RemainingAmount amount={remaining} />
                        </TableCell>
                        {remaining <= 0 ? (
                          <PaidInFullMergedCell
                            onUndo={recentPaymentUndo[`vendor-${v.id}`] ? () => runRememberedUndo(`vendor-${v.id}`) : undefined}
                            t={t}
                          />
                        ) : (
                          <>
                            <TableCell className="text-sm">
                              <div className="flex min-w-[180px] flex-col items-center gap-2">
                                {v.nextPaymentDue ? (
                                  <>
                                    <NextPaymentDisplay
                                      date={v.nextPaymentDue}
                                      amount={v.nextPaymentAmount ?? remaining}
                                      t={t}
                                    />
                                  </>
                                ) : (
                                  <BalanceRemainingActions
                                    onSchedule={() => openVendorBudgetEdit(v, { scheduleNextPayment: true })}
                                    t={t}
                                  />
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex min-w-[180px] flex-col items-center gap-2">
                              {recentPaymentUndo[`vendor-${v.id}`] && (
                                <UndoPaymentButton onClick={() => runRememberedUndo(`vendor-${v.id}`)} t={t} />
                              )}
                              {v.nextPaymentDue && (
                                <PaymentCompleteButton
                                  onClick={() => handleVendorPaymentPaid(v.id, {
                                    id: v.nextPaymentId,
                                    dueDate: v.nextPaymentDue,
                                    amount: v.nextPaymentAmount ?? remaining,
                                  })}
                                  paysRemaining={nextPaymentPaysRemaining}
                                  t={t}
                                />
                              )}
                              {!nextPaymentPaysRemaining && <MarkPaidInFullButton onClick={() => handleVendorPaidInFull(v.id)} t={t} />}
                              </div>
                            </TableCell>
                          </>
                        )}
                        <TableCell>
                          <div className="space-y-1">
                            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  pct >= 100 ? "bg-emerald-500" : pct > 50 ? "bg-primary" : "bg-amber-400"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-muted-foreground">{t("budget.pct_paid", { pct: pct.toFixed(0) })}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openVendorBudgetEdit(v)}
                              className="gap-1"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              {t("common.edit", { defaultValue: "Edit" })}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setLocation(`/vendors?vendorId=${v.id}`)}
                              className="gap-1"
                            >
                              {t("budget.col_view")} <ArrowUpRight className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteSyncedVendor(v)}
                              className="h-9 w-9 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              title={t("budget.delete_synced_vendor", { defaultValue: "Delete synced vendor" })}
                              aria-label={t("budget.delete_synced_vendor", { defaultValue: "Delete synced vendor" })}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingVendor} onOpenChange={(open) => { if (!open) { setEditingVendor(null); setVendorForm(emptyVendorBudgetForm()); } }}>
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto overflow-x-hidden"
          style={{ width: "min(calc(100vw - 2rem), 760px)", maxWidth: "calc(100vw - 2rem)" }}
        >
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-primary">
              {t("budget.edit_vendor_budget_title", { defaultValue: "Edit Vendor Budget Details" })}
            </DialogTitle>
            <DialogDescription>
              {t("budget.edit_vendor_budget_desc", {
                defaultValue: "These fields sync with the Vendor List so you only enter vendor payment details once.",
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="min-w-0 space-y-4 py-2">
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              {t("budget.vendor_sync_note", {
                defaultValue: "Use Budget for money updates. Use Vendor List for contact info, files, contracts, and notes.",
              })}
            </div>
            <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
              <div className="min-w-0 space-y-1.5">
                <label className="text-sm font-medium">{t("budget.vendor_name_label", { defaultValue: "Vendor name" })}</label>
                <Input
                  value={vendorForm.name}
                  onChange={(e) => setVendorForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={t("budget.vendor_name_placeholder", { defaultValue: "Vendor name" })}
                  autoFocus
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <label className="text-sm font-medium">{t("budget.col_category")}</label>
                <Select value={vendorForm.category} onValueChange={(v) => setVendorForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VENDOR_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${categoryBadgeClass(cat)}`}>
                          {displayCategoryLabel(cat)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <label className="text-sm font-medium">{t("budget.col_total_cost")}</label>
                <MoneyInput
                  value={vendorForm.totalCost}
                  onChange={(v) => setVendorForm((f) => ({ ...f, totalCost: v }))}
                  placeholder="0"
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <label className="text-sm font-medium">{t("budget.deposit_label", { defaultValue: "Deposit" })}</label>
                <MoneyInput
                  value={vendorForm.depositAmount}
                  onChange={(v) => setVendorForm((f) => ({ ...f, depositAmount: v }))}
                  placeholder="0"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("budget.vendor_partial_payment_hint", {
                defaultValue: "Use Deposit for money already paid. If a balance is still due, schedule the next payment below.",
              })}
            </p>
            {(vendorForm.paidInFull || !vendorForm.nextPaymentDue) && (
              <PaymentStatusDecision
                paidInFull={vendorForm.paidInFull}
                remaining={vendorFormRemaining}
                onPaidInFull={markVendorFormPaidInFull}
                onSchedulePayment={scheduleVendorFormPayment}
                paidHint={t("budget.vendor_paid_in_full_hint", { defaultValue: "Marks this vendor's remaining balance paid and skips the next payment date." })}
                partialHint={t("budget.vendor_partial_next_payment_hint", {
                  defaultValue: "Keeps the vendor open and lets you enter the next amount and due date.",
                })}
                t={t}
              />
            )}
            {!vendorForm.paidInFull && (
              <div className="space-y-2">
                {vendorForm.nextPaymentDue && (
                  <p className="text-xs font-medium text-primary">
                    {t("budget.next_payment_already_scheduled", {
                      defaultValue: "Next payment is already scheduled. Update the date or amount below if needed.",
                    })}
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">{t("budget.next_payment_date_label", { defaultValue: "Next payment date" })}</label>
                    <Input
                      type="date"
                      value={vendorForm.nextPaymentDue}
                      onChange={(e) => setVendorForm((f) => ({ ...f, nextPaymentDue: e.target.value }))}
                      className="[color-scheme:light]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">{t("budget.next_payment_amount_label", { defaultValue: "Next payment amount" })}</label>
                    <MoneyInput
                      value={vendorForm.nextPaymentAmount}
                      onChange={(v) => setVendorForm((f) => ({ ...f, nextPaymentAmount: v }))}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-wrap gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditingVendor(null);
                setVendorForm(emptyVendorBudgetForm());
              }}
            >
              {t("common.cancel")}
            </Button>
            {editingVendor && (
              <Button
                type="button"
                variant="outline"
                onClick={handleResetVendorPaymentStatus}
                disabled={isSavingVendorBudget || isResettingPaymentStatus || editingVendor.totalPaid <= 0}
              >
                {isResettingPaymentStatus
                  ? t("common.saving", { defaultValue: "Saving..." })
                  : t("budget.reset_payment_status", { defaultValue: "Reset payment status" })}
              </Button>
            )}
            {editingVendor && (
              <Button variant="ghost" onClick={() => setLocation(`/vendors?vendorId=${editingVendor.id}`)} className="gap-1">
                {t("budget.open_vendor_profile", { defaultValue: "Open vendor profile" })}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button onClick={submitVendorBudgetForm} disabled={isSavingVendorBudget || isResettingPaymentStatus}>
              {isSavingVendorBudget
                ? t("common.saving", { defaultValue: "Saving..." })
                : t("budget.save_vendor_budget", { defaultValue: "Save synced details" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Manual Expenses ──────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 font-serif text-2xl text-primary">
                <DollarSign className="h-5 w-5" />
                {t("budget.manual_expenses")}
              </CardTitle>
              <CardDescription>
                {t("budget.manual_expenses_desc")}
              </CardDescription>
            </div>
            <Button onClick={openAdd} className="gap-2 shrink-0">
              <Plus className="h-4 w-4" /> {t("budget.add_expense_label")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingManual ? (
            <Skeleton className="h-32" />
          ) : manualExpenses.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-border rounded-lg">
              <p className="text-muted-foreground mb-3">{t("budget.no_expenses")}</p>
              <Button variant="outline" onClick={openAdd} className="gap-2">
                <Plus className="h-4 w-4" /> {t("budget.add_first_expense")}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center font-bold">{t("budget.col_expense")}</TableHead>
                    <TableHead className="text-center font-bold">{t("budget.col_category")}</TableHead>
                    <TableHead className="text-center font-bold">{t("budget.col_cost")}</TableHead>
                    <TableHead className="text-center font-bold">{t("budget.col_paid")}</TableHead>
                    <TableHead className="text-center font-bold">{t("budget.col_remaining")}</TableHead>
                    <TableHead className="text-center font-bold">{t("budget.col_next_payment")}</TableHead>
                    <TableHead className="min-w-[180px] text-center font-bold">{t("budget.col_payment_actions", { defaultValue: "Payment actions" })}</TableHead>
                    <TableHead className="min-w-[180px] text-center font-bold">{t("budget.col_progress")}</TableHead>
                    <TableHead className="text-center font-bold">{t("budget.receipt_label")}</TableHead>
                    <TableHead className="text-right font-bold">{t("budget.col_actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manualExpenses.map((m) => {
                    const paid = cappedPaid(m.cost, m.amountPaid);
                    const remaining = Math.max(0, m.cost - paid);
                    const pct = m.cost > 0 ? Math.min((paid / m.cost) * 100, 100) : 0;
                    const nextPaymentPaysRemaining = !!m.nextPaymentDue && moneyMatches(m.nextPaymentAmount ?? 0, remaining);
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="text-center">
                          <div className="font-medium">{m.name}</div>
                          {m.notes && <div className="text-xs text-muted-foreground line-clamp-1">{m.notes}</div>}
                        </TableCell>
                        <TableCell className="text-center">
                          <CategoryBadge category={m.category} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(m.cost)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(paid)}</TableCell>
                        <TableCell className="text-right">
                          <RemainingAmount amount={remaining} />
                        </TableCell>
                        {remaining <= 0 ? (
                          <PaidInFullMergedCell
                            onUndo={recentPaymentUndo[`manual-${m.id}`] ? () => runRememberedUndo(`manual-${m.id}`) : undefined}
                            t={t}
                          />
                        ) : (
                          <>
                            <TableCell className="text-sm">
                              <div className="flex min-w-[180px] flex-col items-center gap-2">
                                {m.nextPaymentDue ? (
                                  <NextPaymentDisplay
                                    date={m.nextPaymentDue}
                                    amount={m.nextPaymentAmount ?? 0}
                                    t={t}
                                  />
                                ) : (
                                  <BalanceRemainingActions
                                    onSchedule={() => openEdit(m, { scheduleNextPayment: true })}
                                    t={t}
                                  />
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex min-w-[180px] flex-col items-center gap-2">
                              {recentPaymentUndo[`manual-${m.id}`] && (
                                <UndoPaymentButton onClick={() => runRememberedUndo(`manual-${m.id}`)} t={t} />
                              )}
                              {m.nextPaymentDue && (
                                <PaymentCompleteButton
                                  onClick={() => handleMarkPaid(m.id)}
                                  paysRemaining={nextPaymentPaysRemaining}
                                  t={t}
                                />
                              )}
                              {!nextPaymentPaysRemaining && <MarkPaidInFullButton onClick={() => handleManualPaidInFull(m)} t={t} />}
                              </div>
                            </TableCell>
                          </>
                        )}
                        <TableCell className="text-center">
                          <div className="space-y-1">
                            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  pct >= 100 ? "bg-emerald-500" : pct > 50 ? "bg-primary" : "bg-amber-400"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-muted-foreground">{t("budget.pct_paid", { pct: pct.toFixed(0) })}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const href = safeReceiptHref(m.receiptUrl);
                            return href ? (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline text-xs flex items-center gap-1"
                              >
                                <Paperclip className="h-3 w-3" />
                                {m.receiptName ?? "View"}
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(m.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Totals Summary ───────────────────────────────────────── */}
      <Card id="budget-summary" ref={summaryRef} className="scroll-mt-24 bg-muted/30">
        <CardHeader>
          <CardTitle className="font-serif text-2xl text-primary">{t("budget.summary_title")}</CardTitle>
          <CardDescription>{t("budget.summary_desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
            <SummaryStat label={t("budget.total_vendor_spend")} value={vendorCommitted} sub={t("budget.amount_paid", { amount: formatMoney(vendorPaid) })} />
            <SummaryStat label={t("budget.total_manual_spend")} value={manualCommitted} sub={t("budget.amount_paid", { amount: formatMoney(manualPaid) })} />
            <SummaryStat label={t("budget.combined_total_spend")} value={combinedSpend} highlight />
            <SummaryStat
              label={t("budget.total_paid_out")}
              value={combinedPaid}
              good={combinedPaid > 0}
              sub={combinedSpend > 0 ? t("budget.percent_used", { pct: Math.min((combinedPaid / combinedSpend) * 100, 100).toFixed(0) }) : undefined}
            />
            <SummaryStat
              label={t("budget.remaining_to_pay")}
              value={remainingToPay}
              danger={remainingToPay > 0}
              sub={combinedSpend > 0 ? t("budget.of_total", { amount: formatMoney(combinedSpend) }) : undefined}
            />
            <SummaryStat
              label={overBudget ? t("budget.over_budget") : t("budget.remaining_budget")}
              value={Math.abs(remaining)}
              danger={overBudget}
              good={!overBudget && totalBudget > 0}
            />
            <SummaryStat
              label={t("budget.total_budget_label")}
              value={totalBudget}
              sub={t("budget.percent_used", { pct: usedPct.toFixed(0) })}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Add/Edit Manual Expense Dialog ──────────────────────── */}
      <Dialog open={isAdding} onOpenChange={(open) => { if (!open) { setIsAdding(false); setEditingId(null); } }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-primary">
              {editingId != null ? t("budget.edit_expense_label") : t("budget.add_expense_label")}
            </DialogTitle>
            <DialogDescription>{t("budget.dialog_description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("budget.expense_name")}</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t("budget.expense_name_placeholder")}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("budget.col_category")}</label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MANUAL_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${categoryBadgeClass(c)}`}>
                          {displayCategoryLabel(c)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("budget.col_cost")}</label>
                <MoneyInput
                  value={form.cost}
                  onChange={(v) => setForm((f) => ({ ...f, cost: v, amountPaid: f.paidInFull ? v : f.amountPaid }))}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("budget.amount_paid_label")}</label>
              <MoneyInput
                value={form.amountPaid}
                onChange={(v) => setForm((f) => ({ ...f, amountPaid: v, paidInFull: false }))}
                placeholder="0"
                disabled={form.paidInFull}
              />
              <p className="text-xs text-muted-foreground">
                {t("budget.manual_partial_payment_hint", {
                  defaultValue: "Use Amount paid for payments already made. If a balance is still due, schedule the next payment below.",
                })}
              </p>
            </div>
            {(form.paidInFull || !form.nextPaymentDue) && (
              <PaymentStatusDecision
                paidInFull={form.paidInFull}
                remaining={manualFormRemaining}
                onPaidInFull={markManualFormPaidInFull}
                onSchedulePayment={scheduleManualFormPayment}
                paidHint={t("budget.paid_in_full_hint", { defaultValue: "Sets Paid to the full cost and skips the next payment date." })}
                partialHint={t("budget.partial_next_payment_hint", {
                  defaultValue: "Keeps the expense open and lets you enter the next amount and due date.",
                })}
                t={t}
              />
            )}
            {!form.paidInFull && (
              <div className="space-y-2">
                {form.nextPaymentDue && (
                  <p className="text-xs font-medium text-primary">
                    {t("budget.next_payment_already_scheduled", {
                      defaultValue: "Next payment is already scheduled. Update the date or amount below if needed.",
                    })}
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">{t("budget.next_payment_date_label", { defaultValue: "Next payment date" })}</label>
                    <Input
                      type="date"
                      value={form.nextPaymentDue}
                      onChange={(e) => setForm((f) => ({ ...f, nextPaymentDue: e.target.value }))}
                      className="[color-scheme:light]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">{t("budget.next_payment_amount_label", { defaultValue: "Next payment amount" })}</label>
                    <MoneyInput
                      value={form.nextPaymentAmount}
                      onChange={(v) => setForm((f) => ({ ...f, nextPaymentAmount: v }))}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("budget.notes_label")}</label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder={t("budget.notes_placeholder")}
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("budget.receipt_optional")}</label>
              {form.receiptUrl ? (
                <div className="flex items-center justify-between gap-2 p-2 border rounded-md text-sm">
                  <a href={safeReceiptHref(form.receiptUrl) ?? "#"} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate flex items-center gap-1">
                    <Paperclip className="h-3 w-3" />
                    {form.receiptName ?? t("budget.receipt_label")}
                  </a>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setForm((f) => ({ ...f, receiptUrl: null, receiptName: null }))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="block">
                  <input type="file" className="hidden" onChange={handleReceiptFile} disabled={upload.isUploading} />
                  <Button type="button" variant="outline" size="sm" asChild disabled={upload.isUploading}>
                    <span className="cursor-pointer gap-2">
                      <Paperclip className="h-4 w-4" />
                      {upload.isUploading ? t("budget.uploading") : t("budget.upload_receipt")}
                    </span>
                  </Button>
                </label>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAdding(false); setEditingId(null); }}>
              {t("common.cancel")}
            </Button>
            {editingId != null && (
              <Button
                type="button"
                variant="outline"
                onClick={handleResetManualPaymentStatus}
                disabled={createManual.isPending || updateManual.isPending || isResettingPaymentStatus || Number(form.amountPaid || 0) <= 0}
              >
                {isResettingPaymentStatus
                  ? t("common.saving", { defaultValue: "Saving..." })
                  : t("budget.reset_payment_status", { defaultValue: "Reset payment status" })}
              </Button>
            )}
            <Button onClick={submitForm} disabled={createManual.isPending || updateManual.isPending || isResettingPaymentStatus}>
              {editingId != null ? t("budget.save_changes") : t("budget.add_expense_label")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  sub,
  highlight,
  danger,
  good,
}: {
  label: string;
  value: number;
  sub?: string;
  highlight?: boolean;
  danger?: boolean;
  good?: boolean;
}) {
  const color = danger
    ? "text-destructive"
    : good
    ? "text-emerald-600"
    : highlight
    ? "text-primary"
    : "text-foreground";
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`font-serif text-2xl tabular-nums ${color}`}>{formatMoney(value)}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
