import { useState, useMemo } from "react";
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
import { DollarSign, Plus, Trash2, Pencil, ArrowUpRight, Sparkles, Lock, Paperclip, X, AlertTriangle } from "lucide-react";
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
}
interface VendorFinancials {
  vendorCount: number;
  totalCommitted: number;
  totalPaid: number;
  vendors: VendorRow[];
}

interface ManualExpenseFormState {
  name: string;
  category: string;
  cost: string;
  amountPaid: string;
  nextPaymentDue: string;
  nextPaymentAmount: string;
  notes: string;
  receiptUrl: string | null;
  receiptName: string | null;
}

const emptyManualForm = (): ManualExpenseFormState => ({
  name: "",
  category: "Other",
  cost: "",
  amountPaid: "",
  nextPaymentDue: "",
  nextPaymentAmount: "",
  notes: "",
  receiptUrl: null,
  receiptName: null,
});

function formatMoney(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
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

function normalizeCategoryLabel(category: string | null | undefined) {
  const raw = String(category ?? "").trim();
  if (/^dj\s*\/?\s*(band)?$/i.test(raw) || /^dj\s*\/\s*band$/i.test(raw)) return "DJ / Band";
  const found = Object.keys(VENDOR_CATEGORY_BADGE_STYLES).find((cat) => cat.toLowerCase() === raw.toLowerCase());
  return found ?? (raw || "Other");
}

function displayCategoryLabel(category: string | null | undefined) {
  const normalized = normalizeCategoryLabel(category);
  return normalized === "DJ / Band" ? "DJ/Band" : normalized;
}

function categoryBadgeClass(category: string) {
  return VENDOR_CATEGORY_BADGE_STYLES[normalizeCategoryLabel(category)] ?? VENDOR_CATEGORY_BADGE_STYLES.Other;
}

function categoryHighlightClass(category: string | null | undefined) {
  return `rounded-lg border p-4 ${categoryBadgeClass(normalizeCategoryLabel(category)).replace(/\bborder-transparent\b/g, "")}`;
}

function CategoryBadge({ category }: { category: string }) {
  const label = displayCategoryLabel(category);
  return (
    <Badge variant="outline" className={`rounded-full border px-2.5 py-0.5 font-medium ${categoryBadgeClass(label)}`}>
      {label}
    </Badge>
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
  t,
}: {
  date: string | null | undefined;
  amount?: number;
  onMarkPaid?: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  if (!date) return <span className="text-muted-foreground text-xs">-</span>;
  const daysUntil = daysUntilDate(date);
  const isOverdue = daysUntil < 0;
  const isSoon = daysUntil >= 0 && daysUntil <= 7;
  const tone = isOverdue
    ? "border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-200 dark:bg-red-500/15"
    : isSoon
      ? "border-amber-500/35 bg-amber-500/12 text-amber-800 dark:text-amber-100 dark:bg-amber-400/12"
      : "border-burgundy/20 bg-burgundy/8 text-foreground dark:border-champagne/20 dark:bg-champagne/8";
  const dueLabel = isOverdue
    ? t("budget.due_overdue", { n: Math.abs(daysUntil), defaultValue: `${Math.abs(daysUntil)} day(s) overdue` })
    : daysUntil === 0
      ? t("budget.due_today", { defaultValue: "Due today" })
      : isSoon
        ? t("budget.due_in_days", { n: daysUntil, defaultValue: `Due in ${daysUntil} day(s)` })
        : formatDate(date);

  return (
    <div className={`inline-flex max-w-[220px] flex-col gap-1 rounded-lg border px-2.5 py-1.5 text-xs ${tone}`}>
      <span className="font-semibold">{dueLabel}</span>
      <span className="text-[11px] opacity-85">{formatDate(date)}</span>
      {amount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="tabular-nums font-medium">{formatMoney(amount)}</span>
          {onMarkPaid && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px] border-emerald-500/40 bg-background/80 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
              onClick={onMarkPaid}
              title={t("budget.mark_paid_title", { defaultValue: "Mark this payment paid (rolls into Paid total)" })}
            >
              {t("budget.mark_paid", { defaultValue: "Mark Paid" })}
            </Button>
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
  const [, setLocation] = useLocation();

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
  const createManual = useCreateManualExpense();
  const updateManual = useUpdateManualExpense();
  const deleteManual = useDeleteManualExpense();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ManualExpenseFormState>(emptyManualForm());

  const upload = useUpload({
    getToken,
    onError: (e) => toast({ title: t("budget.toast_upload_failed"), description: e.message, variant: "destructive" }),
  });

  // ── Totals ────────────────────────────────────────────────────────
  const totalBudget = budget?.totalBudget ?? 0;
  const vendorCommitted = vendorFinancials?.totalCommitted ?? 0;
  const vendorPaid = vendorFinancials?.totalPaid ?? 0;
  const manualCommitted = useMemo(
    () => manualExpenses.reduce((s, m) => s + (m.cost ?? 0), 0),
    [manualExpenses],
  );
  const manualPaid = useMemo(
    () => manualExpenses.reduce((s, m) => s + (m.amountPaid ?? 0), 0),
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
    vendorFinancials?.vendors.forEach((v) => add(v.category, v.totalCost, v.totalPaid));
    manualExpenses.forEach((m) => add(m.category, m.cost ?? 0, m.amountPaid ?? 0));
    return [...byCategory.values()].sort((a, b) => b.total - a.total);
  }, [manualExpenses, vendorFinancials?.vendors]);
  const nextPayment = useMemo(() => {
    const payments: Array<{
      id: string;
      label: string;
      category: string;
      date: string;
      amount: number;
      source: "manual" | "vendor";
      manualId?: number;
    }> = [];
    vendorFinancials?.vendors.forEach((v) => {
      if (v.nextPaymentDue && Math.max(0, v.totalCost - v.totalPaid) > 0) {
        payments.push({
          id: `vendor-${v.id}`,
          label: v.name,
          category: v.category,
          date: v.nextPaymentDue,
          amount: 0,
          source: "vendor",
        });
      }
    });
    manualExpenses.forEach((m) => {
      if (m.nextPaymentDue && Math.max(0, (m.cost ?? 0) - (m.amountPaid ?? 0)) > 0) {
        payments.push({
          id: `manual-${m.id}`,
          label: m.name,
          category: m.category || "Other",
          date: m.nextPaymentDue,
          amount: m.nextPaymentAmount ?? 0,
          source: "manual",
          manualId: m.id,
        });
      }
    });
    return payments.sort((a, b) => dateTimeValue(a.date) - dateTimeValue(b.date))[0] ?? null;
  }, [manualExpenses, vendorFinancials?.vendors]);

  // ── Handlers ──────────────────────────────────────────────────────
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
  const openEdit = (m: typeof manualExpenses[number]) => {
    setForm({
      name: m.name,
      category: m.category || "Other",
      cost: String(m.cost ?? 0),
      amountPaid: String(m.amountPaid ?? 0),
      nextPaymentDue: m.nextPaymentDue ?? "",
      nextPaymentAmount: m.nextPaymentAmount != null ? String(m.nextPaymentAmount) : "",
      notes: m.notes ?? "",
      receiptUrl: m.receiptUrl ?? null,
      receiptName: m.receiptName ?? null,
    });
    setEditingId(m.id);
    setIsAdding(true);
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
    const payload = {
      name: form.name.trim(),
      category: form.category || "Other",
      cost: parseFloat(form.cost) || 0,
      amountPaid: parseFloat(form.amountPaid) || 0,
      nextPaymentDue: form.nextPaymentDue.trim() || null,
      nextPaymentAmount: parseFloat(form.nextPaymentAmount) || null,
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

  // One-click "Mark Paid" — hits the /mark-paid endpoint which atomically
  // adds nextPaymentAmount to amountPaid and clears both next-payment fields.
  // Generated client doesn't have a hook for this endpoint yet; calling
  // authFetch directly keeps the implementation self-contained.
  const handleMarkPaid = async (id: number) => {
    if (!confirm(t("budget.confirm_mark_paid", { defaultValue: "Mark this payment as paid? The amount will be added to the running paid total." }))) return;
    try {
      const r = await authFetch(`/api/manual-expenses/${id}/mark-paid`, { method: "POST" });
      if (!r.ok) {
        toast({ variant: "destructive", title: t("budget.toast_mark_paid_failed", { defaultValue: "Couldn't mark payment paid. Please try again." }) });
        return;
      }
      toast({ title: t("budget.toast_payment_recorded", { defaultValue: "Payment recorded" }) });
      queryClient.invalidateQueries({ queryKey: getListManualExpensesQueryKey() });
    } catch {
      toast({ variant: "destructive", title: t("budget.toast_mark_paid_failed", { defaultValue: "Couldn't mark payment paid. Please try again." }) });
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
      <div className="space-y-2">
        <h1 className="font-serif text-4xl text-primary">{t("budget.title")}</h1>
        <p className="text-muted-foreground">
          {t("budget.subtitle")}
        </p>
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
                {t("budget.vendor_synced_desc")}
              </CardDescription>
            </div>
            <Badge variant="secondary" className="gap-1 shrink-0">
              <Lock className="h-3 w-3" /> {t("budget.read_only")}
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
                    <TableHead>{t("budget.col_vendor")}</TableHead>
                    <TableHead>{t("budget.col_category")}</TableHead>
                    <TableHead className="text-right">{t("budget.col_total_cost")}</TableHead>
                    <TableHead className="text-right">{t("budget.col_paid")}</TableHead>
                    <TableHead className="text-right">{t("budget.col_remaining")}</TableHead>
                    <TableHead>{t("budget.col_next_payment")}</TableHead>
                    <TableHead className="min-w-[180px]">{t("budget.col_progress")}</TableHead>
                    <TableHead className="text-right">{t("budget.col_view")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendorFinancials.vendors.map((v) => {
                    const remaining = Math.max(0, v.totalCost - v.totalPaid);
                    const pct = v.totalCost > 0 ? Math.min((v.totalPaid / v.totalCost) * 100, 100) : 0;
                    return (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{v.name}</TableCell>
                        <TableCell>
                          <CategoryBadge category={v.category} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(v.totalCost)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(v.totalPaid)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(remaining)}</TableCell>
                        <TableCell className="text-sm">
                          <NextPaymentDisplay date={v.nextPaymentDue} t={t} />
                        </TableCell>
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
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setLocation(`/vendors?vendorId=${v.id}`)}
                            className="gap-1"
                          >
                            {t("budget.col_view")} <ArrowUpRight className="h-3 w-3" />
                          </Button>
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
                    <TableHead>{t("budget.col_expense")}</TableHead>
                    <TableHead>{t("budget.col_category")}</TableHead>
                    <TableHead className="text-right">{t("budget.col_cost")}</TableHead>
                    <TableHead className="text-right">{t("budget.col_paid")}</TableHead>
                    <TableHead className="text-right">{t("budget.col_remaining")}</TableHead>
                    <TableHead>{t("budget.col_next_payment")}</TableHead>
                    <TableHead className="min-w-[180px]">{t("budget.col_progress")}</TableHead>
                    <TableHead>{t("budget.receipt_label")}</TableHead>
                    <TableHead className="text-right">{t("budget.col_actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manualExpenses.map((m) => {
                    const remaining = Math.max(0, m.cost - m.amountPaid);
                    const pct = m.cost > 0 ? Math.min((m.amountPaid / m.cost) * 100, 100) : 0;
                    return (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div className="font-medium">{m.name}</div>
                          {m.notes && <div className="text-xs text-muted-foreground line-clamp-1">{m.notes}</div>}
                        </TableCell>
                        <TableCell>
                          <CategoryBadge category={m.category} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(m.cost)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(m.amountPaid)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(remaining)}</TableCell>
                        <TableCell className="text-sm">
                          {m.nextPaymentDue ? (() => {
                            const daysUntil = daysUntilDate(m.nextPaymentDue);
                            const isOverdue = daysUntil < 0;
                            const isSoon = daysUntil >= 0 && daysUntil <= 7;
                            const tone = isOverdue
                              ? "text-red-600 dark:text-red-400 font-semibold"
                              : isSoon
                                ? "text-amber-600 dark:text-amber-400 font-medium"
                                : "text-muted-foreground";
                            const dueLabel = isOverdue
                              ? t("budget.due_overdue", { n: Math.abs(daysUntil), defaultValue: `${Math.abs(daysUntil)} day(s) overdue` })
                              : daysUntil === 0
                                ? t("budget.due_today", { defaultValue: "Due today" })
                                : isSoon
                                  ? t("budget.due_in_days", { n: daysUntil, defaultValue: `Due in ${daysUntil} day(s)` })
                                  : formatDate(m.nextPaymentDue);
                            const amount = m.nextPaymentAmount ?? 0;
                            return (
                              <div className="space-y-1">
                                <div className={`text-xs ${tone}`}>{dueLabel}</div>
                                {amount > 0 && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs tabular-nums text-foreground">{formatMoney(amount)}</span>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 px-2 text-[10px] border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
                                      onClick={() => handleMarkPaid(m.id)}
                                      title={t("budget.mark_paid_title", { defaultValue: "Mark this payment paid (rolls into Paid total)" })}
                                    >
                                      {t("budget.mark_paid", { defaultValue: "Mark Paid" })}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })() : <span className="text-muted-foreground text-xs">-</span>}
                        </TableCell>
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
      <Card className="bg-muted/30">
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
              sub={combinedSpend > 0 ? t("budget.percent_used", { pct: ((combinedPaid / combinedSpend) * 100).toFixed(0) }) : undefined}
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
          {(categoryBreakdown.length > 0 || nextPayment) && (
            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              {categoryBreakdown.length > 0 && (
                <div className="rounded-lg border border-border/70 bg-background/70 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {t("budget.category_breakdown", { defaultValue: "Category breakdown" })}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {categoryBreakdown.map((item) => (
                      <div
                        key={item.category}
                        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs shadow-sm ${categoryBadgeClass(item.category)}`}
                      >
                        <span className="font-semibold">{displayCategoryLabel(item.category)}</span>
                        <span className="tabular-nums opacity-90">{formatMoney(item.total)}</span>
                        <span className="text-[10px] opacity-75">
                          {t("budget.category_item_count", { count: item.count, defaultValue: `${item.count} item(s)` })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {nextPayment && (
                <div className={categoryHighlightClass(nextPayment.category)}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest opacity-85">
                    {t("budget.next_payment_highlight", { defaultValue: "Next payment" })}
                  </p>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CategoryBadge category={nextPayment.category} />
                      <span className="font-medium text-foreground">{nextPayment.label}</span>
                    </div>
                    <NextPaymentDisplay
                      date={nextPayment.date}
                      amount={nextPayment.amount}
                      onMarkPaid={nextPayment.source === "manual" && nextPayment.manualId && nextPayment.amount > 0 ? () => handleMarkPaid(nextPayment.manualId!) : undefined}
                      t={t}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
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
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("budget.col_cost")}</label>
                <MoneyInput value={form.cost} onChange={(v) => setForm((f) => ({ ...f, cost: v }))} placeholder="0" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("budget.amount_paid_label")}</label>
              <MoneyInput
                value={form.amountPaid}
                onChange={(v) => setForm((f) => ({ ...f, amountPaid: v }))}
                placeholder="0"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("budget.next_payment_date_label", { defaultValue: "Next payment date" })}</label>
                <Input
                  type="date"
                  value={form.nextPaymentDue}
                  onChange={(e) => setForm((f) => ({ ...f, nextPaymentDue: e.target.value }))}
                  className="[color-scheme:light] dark:[color-scheme:dark]"
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
            <Button onClick={submitForm} disabled={createManual.isPending || updateManual.isPending}>
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
