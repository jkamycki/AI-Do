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
import { DollarSign, Plus, Trash2, Pencil, ArrowUpRight, Sparkles, Lock, Paperclip, X } from "lucide-react";

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
  notes: string;
  receiptUrl: string | null;
  receiptName: string | null;
}

const emptyManualForm = (): ManualExpenseFormState => ({
  name: "",
  category: "Other",
  cost: "",
  amountPaid: "",
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
  if (!d) return "—";
  try {
    const dt = new Date(d.length <= 10 ? `${d}T00:00:00` : d);
    return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return d;
  }
}

export default function Budget() {
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
    onError: (e) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
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
  const overBudget = combinedSpend > totalBudget && totalBudget > 0;
  const usedPct = totalBudget > 0 ? Math.min((combinedSpend / totalBudget) * 100, 100) : 0;

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
          toast({ title: "Budget updated" });
          queryClient.invalidateQueries({ queryKey: getGetBudgetQueryKey() });
          setEditingBudget(false);
        },
        onError: () => toast({ variant: "destructive", title: "Could not update budget" }),
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
    if (result?.url) {
      setForm((f) => ({ ...f, receiptUrl: result.url, receiptName: file.name }));
      toast({ title: "Receipt uploaded" });
    }
    e.target.value = "";
  };

  const submitForm = () => {
    if (!form.name.trim()) {
      toast({ variant: "destructive", title: "Name is required" });
      return;
    }
    const payload = {
      name: form.name.trim(),
      category: form.category || "Other",
      cost: parseFloat(form.cost) || 0,
      amountPaid: parseFloat(form.amountPaid) || 0,
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
            toast({ title: "Expense updated" });
            onDone();
          },
          onError: () => toast({ variant: "destructive", title: "Could not update expense" }),
        },
      );
    } else {
      createManual.mutate(
        { data: payload as never },
        {
          onSuccess: () => {
            toast({ title: "Expense added" });
            onDone();
          },
          onError: () => toast({ variant: "destructive", title: "Could not add expense" }),
        },
      );
    }
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this expense?")) return;
    deleteManual.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Expense deleted" });
          queryClient.invalidateQueries({ queryKey: getListManualExpensesQueryKey() });
        },
        onError: () => toast({ variant: "destructive", title: "Could not delete expense" }),
      },
    );
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
        <h1 className="font-serif text-4xl text-primary">Budget Tracker</h1>
        <p className="text-muted-foreground">
          Track every dollar of your wedding spend. Vendor expenses are pulled in automatically; everything else lives in Manual Expenses below.
        </p>
      </div>

      <Card className="border-primary/30 shadow-sm">
        <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Total wedding budget</p>
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
                  Save
                </Button>
              </div>
            ) : (
              <button
                onClick={startEditBudget}
                className="font-serif text-4xl text-primary hover:opacity-80 transition flex items-center gap-2 group"
                title="Click to edit"
              >
                {formatMoney(totalBudget)}
                <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </button>
            )}
          </div>
          <div className="flex-1 max-w-md w-full">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Spent so far</span>
              <span className="font-medium text-foreground">{formatMoney(combinedSpend)}</span>
            </div>
            <Progress value={usedPct} className={overBudget ? "[&>div]:bg-destructive" : ""} />
            <p className={`text-xs mt-1 ${overBudget ? "text-destructive font-medium" : "text-muted-foreground"}`}>
              {overBudget
                ? `${formatMoney(combinedSpend - totalBudget)} over budget`
                : `${formatMoney(remaining)} remaining`}
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
                Vendor-Synced Expenses
              </CardTitle>
              <CardDescription>
                Pulled automatically from your Vendor List. Edit these by opening the vendor — they're read-only here.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="gap-1 shrink-0">
              <Lock className="h-3 w-3" /> Read-only
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingVendors ? (
            <Skeleton className="h-40" />
          ) : !vendorFinancials || vendorFinancials.vendors.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-border rounded-lg">
              <p className="text-muted-foreground mb-3">No vendors added yet.</p>
              <Button variant="outline" onClick={() => setLocation("/vendors")}>
                Go to Vendor List
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Total cost</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead>Next payment</TableHead>
                    <TableHead className="min-w-[180px]">Progress</TableHead>
                    <TableHead className="text-right">View</TableHead>
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
                          <Badge variant="outline">{v.category}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(v.totalCost)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(v.totalPaid)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(remaining)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(v.nextPaymentDue)}</TableCell>
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
                            <p className="text-[10px] text-muted-foreground">{pct.toFixed(0)}% paid</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setLocation(`/vendors?vendorId=${v.id}`)}
                            className="gap-1"
                          >
                            View <ArrowUpRight className="h-3 w-3" />
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
                Manual Expenses
              </CardTitle>
              <CardDescription>
                Anything outside your vendor list — dress, rings, décor, tips, hotel, DIY, gifts, etc.
              </CardDescription>
            </div>
            <Button onClick={openAdd} className="gap-2 shrink-0">
              <Plus className="h-4 w-4" /> Add Expense
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingManual ? (
            <Skeleton className="h-32" />
          ) : manualExpenses.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-border rounded-lg">
              <p className="text-muted-foreground mb-3">No manual expenses yet.</p>
              <Button variant="outline" onClick={openAdd} className="gap-2">
                <Plus className="h-4 w-4" /> Add your first expense
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Expense</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead>Receipt</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manualExpenses.map((m) => {
                    const remaining = Math.max(0, m.cost - m.amountPaid);
                    return (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div className="font-medium">{m.name}</div>
                          {m.notes && <div className="text-xs text-muted-foreground line-clamp-1">{m.notes}</div>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{m.category}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(m.cost)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(m.amountPaid)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(remaining)}</TableCell>
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
                              <span className="text-xs text-muted-foreground">—</span>
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
          <CardTitle className="font-serif text-2xl text-primary">Budget Summary</CardTitle>
          <CardDescription>Combined totals across vendor and manual expenses.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <SummaryStat label="Total vendor spend" value={vendorCommitted} sub={`${formatMoney(vendorPaid)} paid`} />
            <SummaryStat label="Total manual spend" value={manualCommitted} sub={`${formatMoney(manualPaid)} paid`} />
            <SummaryStat label="Combined total spend" value={combinedSpend} highlight />
            <SummaryStat
              label={overBudget ? "Over budget" : "Remaining budget"}
              value={Math.abs(remaining)}
              danger={overBudget}
              good={!overBudget && totalBudget > 0}
            />
            <SummaryStat
              label="Total budget"
              value={totalBudget}
              sub={`${usedPct.toFixed(0)}% used`}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Add/Edit Manual Expense Dialog ──────────────────────── */}
      <Dialog open={isAdding} onOpenChange={(open) => { if (!open) { setIsAdding(false); setEditingId(null); } }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-primary">
              {editingId != null ? "Edit Expense" : "Add Expense"}
            </DialogTitle>
            <DialogDescription>Track a non-vendor cost like rings, décor, or tips.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Expense name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Wedding bands, Honeymoon flights"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Category</label>
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
                <label className="text-sm font-medium">Cost</label>
                <MoneyInput value={form.cost} onChange={(v) => setForm((f) => ({ ...f, cost: v }))} placeholder="0" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Amount paid</label>
              <MoneyInput
                value={form.amountPaid}
                onChange={(v) => setForm((f) => ({ ...f, amountPaid: v }))}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional details…"
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Receipt (optional)</label>
              {form.receiptUrl ? (
                <div className="flex items-center justify-between gap-2 p-2 border rounded-md text-sm">
                  <a href={safeReceiptHref(form.receiptUrl) ?? "#"} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate flex items-center gap-1">
                    <Paperclip className="h-3 w-3" />
                    {form.receiptName ?? "Receipt"}
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
                      {upload.isUploading ? "Uploading…" : "Upload receipt"}
                    </span>
                  </Button>
                </label>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAdding(false); setEditingId(null); }}>
              Cancel
            </Button>
            <Button onClick={submitForm} disabled={createManual.isPending || updateManual.isPending}>
              {editingId != null ? "Save changes" : "Add expense"}
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
