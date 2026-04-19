import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/authFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  CreditCard,
  TrendingUp,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "";

const CATEGORIES = [
  "Venue", "Photographer", "Videographer", "Caterer", "Florist",
  "DJ / Band", "Officiant", "Hair & Makeup", "Wedding Planner",
  "Transportation", "Cake / Bakery", "Stationary", "Lighting",
  "Rentals", "Attire", "Other",
];

const PAYMENT_METHODS = [
  "Credit Card", "Debit Card", "Check", "Bank Transfer", "Zelle",
  "Venmo", "Cash", "PayPal", "Other",
];

interface Payment {
  id: number;
  vendorName: string;
  vendorCategory: string | null;
  description: string | null;
  totalAmount: number;
  amountPaid: number;
  dueDate: string | null;
  paidDate: string | null;
  paymentMethod: string | null;
  notes: string | null;
  status: "upcoming" | "paid" | "overdue";
  createdAt: string;
}

const EMPTY: Partial<Payment> = {
  vendorName: "",
  vendorCategory: "",
  description: "",
  totalAmount: 0,
  amountPaid: 0,
  dueDate: "",
  paidDate: "",
  paymentMethod: "",
  notes: "",
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function daysUntil(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

function StatusBadge({ status, dueDate }: { status: Payment["status"]; dueDate: string | null }) {
  if (status === "paid") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="h-3 w-3" /> Paid
      </span>
    );
  }
  if (status === "overdue") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
        <AlertTriangle className="h-3 w-3" /> Overdue
      </span>
    );
  }
  if (dueDate) {
    const days = daysUntil(dueDate);
    const urgent = days <= 7;
    return (
      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border
        ${urgent ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-sky-100 text-sky-700 border-sky-200"}`}>
        <Clock className="h-3 w-3" />
        {days === 0 ? "Due today" : days === 1 ? "Due tomorrow" : `${days}d away`}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/40">
      <Clock className="h-3 w-3" /> Upcoming
    </span>
  );
}

function PaymentForm({
  defaultValues,
  onSubmit,
  isPending,
  submitLabel,
}: {
  defaultValues?: Partial<Payment>;
  onSubmit: (data: Partial<Payment>) => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const [form, setForm] = useState<Partial<Payment>>({ ...EMPTY, ...defaultValues });
  const set = <K extends keyof Payment>(k: K, v: Payment[K] | null) =>
    setForm(f => ({ ...f, [k]: v }));

  const remaining = (form.totalAmount ?? 0) - (form.amountPaid ?? 0);

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form); }} className="space-y-4 py-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Vendor Name *</Label>
          <Input
            placeholder="Riverside Photography"
            value={form.vendorName ?? ""}
            onChange={e => set("vendorName", e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={form.vendorCategory ?? ""} onValueChange={v => set("vendorCategory", v)}>
            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Payment Method</Label>
          <Select value={form.paymentMethod ?? ""} onValueChange={v => set("paymentMethod", v)}>
            <SelectTrigger><SelectValue placeholder="How you'll pay" /></SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Total Contract Amount ($)</Label>
          <Input
            type="number" min="0" step="0.01" placeholder="4500"
            value={form.totalAmount ?? ""}
            onChange={e => set("totalAmount", e.target.value ? Number(e.target.value) : 0)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Amount Paid So Far ($)</Label>
          <Input
            type="number" min="0" step="0.01" placeholder="1000"
            value={form.amountPaid ?? ""}
            onChange={e => set("amountPaid", e.target.value ? Number(e.target.value) : 0)}
          />
        </div>
        {(form.totalAmount ?? 0) > 0 && (
          <div className="sm:col-span-2 rounded-lg bg-muted/30 px-3 py-2 text-sm text-muted-foreground flex justify-between">
            <span>Remaining balance</span>
            <span className={`font-semibold ${remaining > 0 ? "text-amber-700" : "text-emerald-700"}`}>
              {remaining > 0 ? fmt(remaining) : "Fully paid"}
            </span>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Payment Due Date</Label>
          <Input type="date" value={form.dueDate ?? ""} onChange={e => set("dueDate", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Date Paid</Label>
          <Input type="date" value={form.paidDate ?? ""} onChange={e => set("paidDate", e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Description / What This Covers</Label>
          <Input
            placeholder="e.g. Deposit for 8-hour coverage package"
            value={form.description ?? ""}
            onChange={e => set("description", e.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Notes</Label>
          <Textarea
            placeholder="Invoice #, confirmation number, special terms…"
            rows={2}
            className="resize-none"
            value={form.notes ?? ""}
            onChange={e => set("notes", e.target.value)}
          />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={isPending || !form.vendorName}>
        {isPending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

function PaymentCard({
  payment,
  onEdit,
  onDelete,
  onMarkPaid,
}: {
  payment: Payment;
  onEdit: () => void;
  onDelete: () => void;
  onMarkPaid: () => void;
}) {
  const pct = payment.totalAmount > 0 ? Math.min(100, (payment.amountPaid / payment.totalAmount) * 100) : 0;
  const remaining = payment.totalAmount - payment.amountPaid;

  return (
    <div className={`rounded-2xl border bg-card shadow-sm hover:shadow-md transition-shadow
      ${payment.status === "overdue" ? "border-red-200 bg-red-50/30" : "border-border/60"}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5
            ${payment.status === "paid" ? "bg-emerald-100" : payment.status === "overdue" ? "bg-red-100" : "bg-primary/10"}`}>
            {payment.status === "paid"
              ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              : payment.status === "overdue"
              ? <AlertTriangle className="h-5 w-5 text-red-500" />
              : <DollarSign className="h-5 w-5 text-primary" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-foreground text-sm">{payment.vendorName}</p>
                {payment.vendorCategory && (
                  <p className="text-xs text-muted-foreground">{payment.vendorCategory}</p>
                )}
              </div>
              <StatusBadge status={payment.status} dueDate={payment.dueDate} />
            </div>

            {payment.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{payment.description}</p>
            )}

            {/* Amounts */}
            <div className="mt-3 space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{fmt(payment.amountPaid)} paid</span>
                <span className="font-medium text-foreground">{fmt(payment.totalAmount)} total</span>
              </div>
              <Progress value={pct} className={`h-1.5 ${payment.status === "paid" ? "[&>div]:bg-emerald-500" : payment.status === "overdue" ? "[&>div]:bg-red-500" : ""}`} />
              {remaining > 0 && (
                <p className="text-xs font-medium text-amber-700">{fmt(remaining)} still owed</p>
              )}
            </div>

            {/* Meta row */}
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              {payment.dueDate && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Due {new Date(payment.dueDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              )}
              {payment.paidDate && (
                <span className="flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" />
                  Paid {new Date(payment.paidDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              )}
              {payment.paymentMethod && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CreditCard className="h-3 w-3" /> {payment.paymentMethod}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 pb-3 flex gap-2">
        {payment.status !== "paid" && (
          <Button size="sm" className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onMarkPaid}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Mark Paid
          </Button>
        )}
        <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 px-2" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default function Payments() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editPayment, setEditPayment] = useState<Payment | null>(null);

  const { data: paymentsRaw, isLoading } = useQuery<Payment[]>({
    queryKey: ["payments"],
    queryFn: async () => {
      const r = await authFetch(`${API}/api/payments`);
      if (!r.ok) throw new Error(`Server error ${r.status}`);
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });
  const payments = Array.isArray(paymentsRaw) ? paymentsRaw : [];

  const createMutation = useMutation({
    mutationFn: (data: Partial<Payment>) =>
      authFetch(`${API}/api/payments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payments"] }); setAddOpen(false); toast({ title: "Payment added." }); },
    onError: () => toast({ title: "Failed to add payment.", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Payment> }) =>
      authFetch(`${API}/api/payments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payments"] }); setEditPayment(null); toast({ title: "Payment updated." }); },
    onError: () => toast({ title: "Failed to update.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => authFetch(`${API}/api/payments/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payments"] }); toast({ title: "Payment removed." }); },
  });

  function markPaid(p: Payment) {
    const today = new Date().toISOString().split("T")[0]!;
    updateMutation.mutate({ id: p.id, data: { amountPaid: p.totalAmount, paidDate: p.paidDate || today } });
  }

  // Stats
  const totalOwed = payments.reduce((s, p) => s + p.totalAmount, 0);
  const totalPaid = payments.reduce((s, p) => s + p.amountPaid, 0);
  const totalRemaining = totalOwed - totalPaid;
  const overdue = payments.filter(p => p.status === "overdue");
  const upcoming = payments.filter(p => p.status === "upcoming").sort((a, b) => {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });
  const paid = payments.filter(p => p.status === "paid");

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-primary">Payment Tracker</h1>
          <p className="text-muted-foreground mt-1">Track every deposit and payment across all your vendors.</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shrink-0" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Add Payment
        </Button>
      </div>

      {/* Summary cards */}
      {payments.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border/50 bg-card p-3 text-center">
            <p className="text-xl font-bold text-primary">{fmt(totalOwed)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total Contracted</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-center">
            <p className="text-xl font-bold text-emerald-700">{fmt(totalPaid)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Paid</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-center">
            <p className="text-xl font-bold text-amber-700">{fmt(totalRemaining)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Still Owed</p>
          </div>
          <div className={`rounded-xl border p-3 text-center ${overdue.length > 0 ? "border-red-200 bg-red-50/50" : "border-border/50 bg-card"}`}>
            <p className={`text-xl font-bold ${overdue.length > 0 ? "text-red-600" : "text-foreground"}`}>{overdue.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Overdue</p>
          </div>
        </div>
      )}

      {/* Overall progress bar */}
      {totalOwed > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" /> Overall progress
            </span>
            <span className="font-semibold text-foreground">{Math.round((totalPaid / totalOwed) * 100)}% paid</span>
          </div>
          <Progress value={(totalPaid / totalOwed) * 100} className="h-2" />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-2xl bg-muted/40 animate-pulse" />)}
        </div>
      ) : payments.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-25" />
          <p className="font-medium">No payments tracked yet</p>
          <p className="text-sm mt-1">Add your first vendor payment to stay on top of deposits and due dates.</p>
          <Button className="mt-6 bg-primary hover:bg-primary/90 text-primary-foreground gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Your First Payment
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overdue */}
          {overdue.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-red-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Overdue ({overdue.length})
              </h2>
              <div className="space-y-3">
                {overdue.map(p => (
                  <PaymentCard key={p.id} payment={p} onEdit={() => setEditPayment(p)} onDelete={() => deleteMutation.mutate(p.id)} onMarkPaid={() => markPaid(p)} />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" /> Upcoming ({upcoming.length})
              </h2>
              <div className="space-y-3">
                {upcoming.map(p => (
                  <PaymentCard key={p.id} payment={p} onEdit={() => setEditPayment(p)} onDelete={() => deleteMutation.mutate(p.id)} onMarkPaid={() => markPaid(p)} />
                ))}
              </div>
            </div>
          )}

          {/* Paid */}
          {paid.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Paid ({paid.length})
              </h2>
              <div className="space-y-3">
                {paid.map(p => (
                  <PaymentCard key={p.id} payment={p} onEdit={() => setEditPayment(p)} onDelete={() => deleteMutation.mutate(p.id)} onMarkPaid={() => markPaid(p)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-primary">Add Payment</DialogTitle>
          </DialogHeader>
          <PaymentForm
            onSubmit={data => createMutation.mutate(data)}
            isPending={createMutation.isPending}
            submitLabel="Add Payment"
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editPayment} onOpenChange={open => { if (!open) setEditPayment(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-primary">Edit Payment</DialogTitle>
          </DialogHeader>
          {editPayment && (
            <PaymentForm
              defaultValues={editPayment}
              onSubmit={data => updateMutation.mutate({ id: editPayment.id, data })}
              isPending={updateMutation.isPending}
              submitLabel="Save Changes"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
