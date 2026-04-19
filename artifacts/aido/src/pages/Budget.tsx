import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useGetBudget, 
  useSaveBudget, 
  useAddBudgetItem, 
  usePredictBudget, 
  useGetProfile,
  getGetBudgetQueryKey,
  useUpdateBudgetItem,
  useDeleteBudgetItem,
  useGetBudgetItemPayments,
  useAddBudgetItemPayment,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DollarSign, Plus, Wand2, Calculator, Trash2, Edit2, Sparkles, CheckCircle2, CreditCard, History, Bell, AlertTriangle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const itemSchema = z.object({
  category: z.string().min(1, "Category is required"),
  customCategory: z.string().optional(),
  vendor: z.string().min(1, "Vendor is required"),
  estimatedCost: z.coerce.number().min(0).default(0),
  actualCost: z.coerce.number().min(0, "Must be >= 0"),
  amountPaid: z.coerce.number().min(0, "Must be >= 0").default(0),
  isPaid: z.boolean().default(false),
  notes: z.string().optional(),
  nextPaymentDue: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.category === "Other" && !data.customCategory?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Please enter an expense name", path: ["customCategory"] });
  }
});

type ItemFormValues = z.infer<typeof itemSchema>;

function PaymentProgressCell({
  item,
  onUpdate,
}: {
  item: { actualCost: number; amountPaid?: number };
  onUpdate: (paid: number) => void;
}) {
  const total = item.actualCost;
  const paid = item.amountPaid ?? 0;
  const pct = total > 0 ? Math.min((paid / total) * 100, 100) : 0;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(paid));

  const commit = () => {
    const val = parseFloat(draft);
    if (!isNaN(val) && val >= 0) onUpdate(val);
    setEditing(false);
  };

  return (
    <div className="space-y-1 py-0.5">
      {editing ? (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">$</span>
          <input
            type="number"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
            className="w-20 text-sm border border-primary/40 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/50 bg-background"
            autoFocus
          />
          <span className="text-xs text-muted-foreground">of ${total.toLocaleString()}</span>
        </div>
      ) : (
        <button
          onClick={() => { setDraft(String(paid)); setEditing(true); }}
          className="text-xs text-left hover:text-primary transition-colors group/pay"
          title="Click to update payment"
        >
          <span className="font-medium">${paid.toLocaleString()}</span>
          <span className="text-muted-foreground"> / ${total.toLocaleString()}</span>
          <span className="ml-1 text-primary opacity-0 group-hover/pay:opacity-100 transition-opacity text-[10px]">edit</span>
        </button>
      )}
      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-emerald-500" : pct > 50 ? "bg-primary" : "bg-amber-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">{pct.toFixed(0)}% paid</p>
    </div>
  );
}

function LogPaymentContent({
  item,
  onDone,
}: {
  item: { id: number; vendor: string; actualCost: number; amountPaid: number };
  onDone: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: payments, isLoading } = useGetBudgetItemPayments(item.id);
  const addPayment = useAddBudgetItemPayment();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));

  const totalLogged = payments ? payments.reduce((s, p) => s + p.amount, 0) : item.amountPaid;
  const pct = item.actualCost > 0 ? Math.min((totalLogged / item.actualCost) * 100, 100) : 0;
  const amountNum = parseFloat(amount);
  const projectedTotal = !isNaN(amountNum) ? totalLogged + amountNum : totalLogged;
  const willComplete = projectedTotal >= item.actualCost;

  const handleSubmit = () => {
    if (isNaN(amountNum) || amountNum <= 0) return;
    addPayment.mutate(
      { id: item.id, data: { amount: amountNum, ...(note.trim() ? { note: note.trim() } : {}), ...(paidAt ? { paidAt } : {}) } },
      {
        onSuccess: () => {
          toast({ title: "Payment logged", description: `$${amountNum.toLocaleString()} recorded for ${item.vendor}.` });
          queryClient.invalidateQueries({ queryKey: getGetBudgetQueryKey() });
          setAmount("");
          setNote("");
          onDone();
        },
        onError: () => {
          toast({ variant: "destructive", title: "Error", description: "Could not log payment." });
        },
      }
    );
  };

  return (
    <div className="space-y-5 py-1">
      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Total paid</span>
          <span className="font-medium text-foreground">${totalLogged.toLocaleString()} of ${item.actualCost.toLocaleString()}</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-emerald-500" : pct > 50 ? "bg-primary" : "bg-amber-400"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground text-right">{pct.toFixed(0)}% paid</p>
      </div>

      {/* Payment history */}
      {isLoading ? (
        <div className="text-xs text-muted-foreground text-center py-2">Loading history…</div>
      ) : payments && payments.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <History className="h-3 w-3" /> Payment history
          </p>
          <div className="max-h-40 overflow-y-auto rounded-lg border border-border/50 divide-y divide-border/40">
            {payments.map(p => (
              <div key={p.id} className="flex items-start justify-between px-3 py-2 text-sm">
                <div>
                  <span className="font-medium text-foreground">${p.amount.toLocaleString()}</span>
                  {p.note && <span className="ml-2 text-muted-foreground text-xs italic">{p.note}</span>}
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-3">
                  {new Date(p.paidAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-1">No payments recorded yet.</p>
      )}

      {/* Add payment */}
      <div className="space-y-3 pt-1 border-t border-border/40">
        <p className="text-sm font-medium">Log a new payment</p>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
            placeholder="Amount paid today"
            autoFocus
            className="w-full pl-7 pr-3 py-2 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 bg-background"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Date paid</label>
            <input
              type="date"
              value={paidAt}
              onChange={e => setPaidAt(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 bg-background"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. deposit, final…"
              className="w-full px-3 py-2 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 bg-background"
            />
          </div>
        </div>
        {amount && !isNaN(amountNum) && amountNum > 0 && (
          <p className="text-xs text-muted-foreground">
            New total: <span className="font-semibold text-foreground">${projectedTotal.toLocaleString()}</span> of ${item.actualCost.toLocaleString()}
            {willComplete && <span className="ml-1 text-emerald-600 font-medium">· Fully paid! ✓</span>}
          </p>
        )}
        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={addPayment.isPending || !amount || isNaN(amountNum) || amountNum <= 0}
        >
          {addPayment.isPending ? "Saving…" : "Record Payment"}
        </Button>
      </div>
    </div>
  );
}

export default function Budget() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: budget, isLoading: isLoadingBudget } = useGetBudget();
  const { data: profile, isLoading: isLoadingProfile } = useGetProfile();
  
  const saveBudget = useSaveBudget();
  const addBudgetItem = useAddBudgetItem();
  const predictBudget = usePredictBudget();
  const updateItem = useUpdateBudgetItem();
  const deleteItem = useDeleteBudgetItem();

  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [editingItem, setEditingItem] = useState<{ id: number; category: string; vendor: string; estimatedCost: number; actualCost: number; amountPaid: number; isPaid: boolean; notes?: string | null } | null>(null);
  const [logPaymentItem, setLogPaymentItem] = useState<{ id: number; vendor: string; actualCost: number; amountPaid: number } | null>(null);

  const CATEGORIES = ["Venue", "Catering", "Photography", "Florist", "Attire", "Music", "Decor", "Other"];

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      category: "",
      customCategory: "",
      vendor: "",
      estimatedCost: 0,
      actualCost: 0,
      amountPaid: 0,
      isPaid: false,
      notes: "",
      nextPaymentDue: "",
    },
  });

  const editForm = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      category: "",
      customCategory: "",
      vendor: "",
      estimatedCost: 0,
      actualCost: 0,
      amountPaid: 0,
      isPaid: false,
      notes: "",
      nextPaymentDue: "",
    },
  });

  const watchedCategory = form.watch("category");
  const watchedEditCategory = editForm.watch("category");

  // Populate edit form whenever a different item is selected for editing
  const openEdit = (item: typeof editingItem) => {
    if (!item) return;
    const isKnown = CATEGORIES.slice(0, -1).includes(item.category);
    editForm.reset({
      category: isKnown ? item.category : "Other",
      customCategory: isKnown ? "" : item.category,
      vendor: item.vendor,
      estimatedCost: item.estimatedCost,
      actualCost: item.actualCost,
      amountPaid: item.amountPaid,
      isPaid: item.isPaid,
      notes: item.notes ?? "",
      nextPaymentDue: (item as Record<string, unknown>).nextPaymentDue as string ?? "",
    });
    setEditingItem(item);
  };

  const onSubmitItem = (data: ItemFormValues) => {
    const resolvedCategory = data.category === "Other" && data.customCategory?.trim()
      ? data.customCategory.trim()
      : data.category;
    const { customCategory: _omit, ...rest } = data;
    addBudgetItem.mutate({ data: { ...rest, category: resolvedCategory, nextPaymentDue: data.nextPaymentDue || null } as never }, {
      onSuccess: () => {
        toast({ title: "Item added", description: "Budget item saved." });
        queryClient.invalidateQueries({ queryKey: getGetBudgetQueryKey() });
        setIsAddingItem(false);
        form.reset();
      },
      onError: () => {
        toast({ variant: "destructive", title: "Error", description: "Could not add item." });
      }
    });
  };

  const onSubmitEdit = (data: ItemFormValues) => {
    if (!editingItem) return;
    const resolvedCategory = data.category === "Other" && data.customCategory?.trim()
      ? data.customCategory.trim()
      : data.category;
    const { customCategory: _omit, ...rest } = data;
    updateItem.mutate(
      { id: editingItem.id, data: { ...rest, category: resolvedCategory, nextPaymentDue: data.nextPaymentDue || null } as never },
      {
        onSuccess: () => {
          toast({ title: "Expense updated" });
          queryClient.invalidateQueries({ queryKey: getGetBudgetQueryKey() });
          setEditingItem(null);
        },
        onError: () => {
          toast({ variant: "destructive", title: "Error", description: "Could not update item." });
        },
      }
    );
  };

  const togglePaid = (id: number, currentPaid: boolean) => {
    updateItem.mutate(
      { id, data: { isPaid: !currentPaid } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetBudgetQueryKey() });
        }
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteItem.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Item deleted" });
        queryClient.invalidateQueries({ queryKey: getGetBudgetQueryKey() });
      }
    });
  };

  const handlePredict = () => {
    if (!profile) {
      toast({ variant: "destructive", title: "Profile Required", description: "Complete your profile first." });
      return;
    }
    
    setIsPredicting(true);
    predictBudget.mutate(
      { data: { location: profile.location, guestCount: profile.guestCount, weddingVibe: profile.weddingVibe } },
      {
        onSuccess: (data) => {
          toast({ title: "Prediction Complete", description: "AI has estimated your costs." });
        },
        onError: () => {
          toast({ variant: "destructive", title: "Error", description: "Prediction failed." });
        },
        onSettled: () => {
          setIsPredicting(false);
        }
      }
    );
  };

  if (isLoadingBudget || isLoadingProfile) {
    return (
      <div className="space-y-8 max-w-5xl mx-auto">
        <Skeleton className="h-12 w-64" />
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const spentPercentage = budget && budget.totalBudget > 0 ? (budget.spent / budget.totalBudget) * 100 : 0;
  const isOverBudget = budget ? budget.spent > budget.totalBudget : false;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* ── Log Payment Dialog ── */}
      <Dialog open={!!logPaymentItem} onOpenChange={open => { if (!open) setLogPaymentItem(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-primary flex items-center gap-2">
              <CreditCard className="h-5 w-5" /> Payment Tracker
            </DialogTitle>
            <DialogDescription>
              {logPaymentItem && <>Payments for <strong>{logPaymentItem.vendor}</strong></>}
            </DialogDescription>
          </DialogHeader>
          {logPaymentItem && (
            <LogPaymentContent item={logPaymentItem} onDone={() => setLogPaymentItem(null)} />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Edit Expense Dialog ── */}
      <Dialog open={!!editingItem} onOpenChange={open => { if (!open) setEditingItem(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-primary">Edit Expense</DialogTitle>
            <DialogDescription>Update the details for this expense.</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onSubmitEdit)} className="space-y-4 py-4">
              <FormField
                control={editForm.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CATEGORIES.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {watchedEditCategory === "Other" && (
                <FormField
                  control={editForm.control}
                  name="customCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expense Name</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g. Hair & Makeup, Rehearsal Dinner…" {...field} autoFocus />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={editForm.control}
                name="vendor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor Name</FormLabel>
                    <FormControl>
                      <Input placeholder="E.g. Sweet Magnolia Florals" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="actualCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost ($)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="amountPaid"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount Paid So Far ($)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="isPaid"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Fully Paid</FormLabel>
                      <CardDescription>Has this been completely paid off?</CardDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g. contract signed, deposit due June 1…"
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="nextPaymentDue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <Bell className="h-3.5 w-3.5 text-primary" /> Next Payment Due Date
                    </FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <p className="text-[11px] text-muted-foreground">Set a reminder for your next deposit or final payment.</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full mt-4" disabled={updateItem.isPending}>
                {updateItem.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-serif text-primary flex items-center gap-3">
            <DollarSign className="h-8 w-8" /> 
            Budget Manager
          </h1>
          <p className="text-lg text-muted-foreground mt-2">Track every penny, stress-free.</p>
        </div>
        <Dialog open={isAddingItem} onOpenChange={setIsAddingItem}>
          <DialogTrigger asChild>
            <Button size="lg" className="shadow-md" data-testid="btn-add-item">
              <Plus className="mr-2 h-4 w-4" /> Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl text-primary">New Expense</DialogTitle>
              <DialogDescription>Log a new quote or paid invoice.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitItem)} className="space-y-4 py-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CATEGORIES.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {watchedCategory === "Other" && (
                  <FormField
                    control={form.control}
                    name="customCategory"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expense Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="E.g. Hair & Makeup, Rehearsal Dinner…"
                            {...field}
                            data-testid="input-custom-category"
                            autoFocus
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="vendor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor Name</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g. Sweet Magnolia Florals" {...field} data-testid="input-vendor" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="actualCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cost ($)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="input-actual" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="amountPaid"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount Paid So Far ($)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="input-amount-paid" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isPaid"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Fully Paid</FormLabel>
                        <CardDescription>Has this been completely paid off?</CardDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-paid"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g. contract signed, deposit due June 1…"
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nextPaymentDue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <Bell className="h-3.5 w-3.5 text-primary" /> Next Payment Due Date
                      </FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <p className="text-[11px] text-muted-foreground">Optional — get a reminder as this date approaches.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full mt-4" disabled={addBudgetItem.isPending} data-testid="btn-submit-item">
                  {addBudgetItem.isPending ? "Saving..." : "Save Expense"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {budget && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-primary/5 border-none shadow-sm">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Budget</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-3xl font-serif text-primary">${budget.totalBudget.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-none shadow-sm">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Committed</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-3xl font-serif">${budget.spent.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-0.5">Total billed</p>
            </CardContent>
          </Card>
          <Card className="bg-emerald-50 border-none shadow-sm">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-emerald-700 uppercase tracking-wider">Paid Out</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-3xl font-serif text-emerald-700">${(budget as any).totalPaid?.toLocaleString() ?? "0"}</div>
              <p className="text-xs text-emerald-600 mt-0.5">
                {budget.spent > 0 ? Math.round(((budget as any).totalPaid / budget.spent) * 100) : 0}% of committed
              </p>
            </CardContent>
          </Card>
          <Card className={`${(budget as any).stillOwed > 0 ? 'bg-amber-50' : 'bg-secondary/20'} border-none shadow-sm`}>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className={`text-xs font-medium uppercase tracking-wider ${(budget as any).stillOwed > 0 ? 'text-amber-700' : 'text-muted-foreground'}`}>
                Still Owed
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className={`text-3xl font-serif ${(budget as any).stillOwed > 0 ? 'text-amber-700' : 'text-foreground'}`}>
                ${(budget as any).stillOwed?.toLocaleString() ?? "0"}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Remaining payments</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Upcoming Payment Reminders ── */}
      {budget && (() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcoming = (budget.items as Array<{ id: number; vendor: string; category: string; actualCost: number; amountPaid: number; isPaid: boolean; nextPaymentDue?: string | null }>)
          .filter(item => item.nextPaymentDue && !item.isPaid)
          .map(item => {
            const due = new Date(item.nextPaymentDue! + "T12:00:00");
            const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000);
            return { ...item, due, diff };
          })
          .sort((a, b) => a.diff - b.diff);

        if (upcoming.length === 0) return null;

        const overdue = upcoming.filter(i => i.diff < 0);
        const urgent = upcoming.filter(i => i.diff >= 0 && i.diff <= 7);
        const later = upcoming.filter(i => i.diff > 7);

        return (
          <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
            <div className="px-4 py-3 flex items-center gap-2 border-b border-border/50 bg-muted/30">
              <Bell className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm text-foreground">Upcoming Payment Reminders</span>
              <span className="ml-auto text-xs text-muted-foreground">{upcoming.length} payment{upcoming.length !== 1 ? "s" : ""} scheduled</span>
            </div>
            <div className="divide-y divide-border/40">
              {overdue.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3 bg-red-50/60">
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-red-800 truncate">{item.vendor}</p>
                    <p className="text-xs text-red-600">
                      {item.category} · ${(item.actualCost - item.amountPaid).toLocaleString()} remaining
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-red-600 shrink-0 bg-red-100 px-2 py-0.5 rounded-full border border-red-200">
                    {Math.abs(item.diff)}d overdue
                  </span>
                </div>
              ))}
              {urgent.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3 bg-amber-50/60">
                  <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-amber-900 truncate">{item.vendor}</p>
                    <p className="text-xs text-amber-700">
                      {item.category} · ${(item.actualCost - item.amountPaid).toLocaleString()} remaining
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-amber-700 shrink-0 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                    {item.diff === 0 ? "Due today" : item.diff === 1 ? "Due tomorrow" : `${item.diff}d left`}
                  </span>
                </div>
              ))}
              {later.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <Bell className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.vendor}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.category} · ${(item.actualCost - item.amountPaid).toLocaleString()} remaining
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {item.due.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {budget && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{spentPercentage.toFixed(1)}% utilized</span>
            <span>{isOverBudget ? "Over budget" : "On track"}</span>
          </div>
          <Progress value={spentPercentage > 100 ? 100 : spentPercentage} className={`h-3 ${isOverBudget ? '[&>div]:bg-destructive' : ''}`} />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="border-none shadow-md overflow-hidden">
            <CardHeader className="bg-muted/30 border-b pb-4">
              <CardTitle className="font-serif text-xl">Expenses</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {budget && budget.items && budget.items.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/10">
                      <TableRow>
                        <TableHead>Vendor / Category</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead>Payment Progress</TableHead>
                        <TableHead className="text-center">Paid</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {budget.items.map((item) => (
                        <TableRow key={item.id} className="group transition-colors">
                          <TableCell>
                            <div className="font-medium text-foreground">{item.vendor}</div>
                            <div className="text-xs text-muted-foreground">{item.category}</div>
                            {item.notes && (
                              <div className="text-xs text-muted-foreground/70 italic mt-0.5 max-w-[220px] truncate" title={item.notes}>
                                {item.notes}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ${item.actualCost.toLocaleString()}
                          </TableCell>
                          <TableCell className="min-w-[160px]">
                            <PaymentProgressCell item={item} onUpdate={(paid) => {
                              updateItem.mutate({ id: item.id, data: { amountPaid: paid } }, {
                                onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetBudgetQueryKey() }),
                              });
                            }} />
                          </TableCell>
                          <TableCell className="text-center">
                            <button 
                              onClick={() => togglePaid(item.id, item.isPaid)}
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors ${item.isPaid ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                              data-testid={`btn-toggle-paid-${item.id}`}
                              title={item.isPaid ? "Mark unpaid" : "Mark paid"}
                            >
                              <CheckCircle2 className="h-5 w-5" />
                            </button>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs gap-1 border-primary/20 text-primary hover:bg-primary/5 hidden sm:flex"
                                onClick={() => setLogPaymentItem({ id: item.id, vendor: item.vendor, actualCost: item.actualCost, amountPaid: item.amountPaid ?? 0 })}
                                data-testid={`btn-log-payment-${item.id}`}
                                title="Log a payment"
                              >
                                <CreditCard className="h-3 w-3" /> Pay
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-primary hover:text-primary/80 sm:hidden"
                                onClick={() => setLogPaymentItem({ id: item.id, vendor: item.vendor, actualCost: item.actualCost, amountPaid: item.amountPaid ?? 0 })}
                                title="Log a payment"
                              >
                                <CreditCard className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-primary"
                                onClick={() => openEdit(item)}
                                data-testid={`btn-edit-item-${item.id}`}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => handleDelete(item.id)}
                                data-testid={`btn-delete-item-${item.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="p-12 text-center text-muted-foreground">
                  <Calculator className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No expenses logged yet.</p>
                  <Button variant="link" onClick={() => setIsAddingItem(true)} className="mt-2 text-primary">
                    Add your first expense
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="border-none shadow-md bg-gradient-to-br from-primary/5 to-secondary/10 relative overflow-hidden">
            <CardHeader>
              <CardTitle className="font-serif text-xl flex items-center gap-2 text-primary">
                <Sparkles className="h-5 w-5" /> AI Prediction
              </CardTitle>
              <CardDescription>Based on {profile?.location || "your location"} and {profile?.guestCount || "guest"} guests.</CardDescription>
            </CardHeader>
            <CardContent>
              {predictBudget.data ? (
                <div className="space-y-4 animate-in fade-in">
                  <div className="text-center p-4 bg-background rounded-xl border border-primary/10 shadow-sm">
                    <p className="text-sm text-muted-foreground mb-1">Estimated Total Need</p>
                    <div className="text-3xl font-serif font-bold text-primary">
                      ${predictBudget.data.totalEstimate.toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="space-y-3 mt-6">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Predicted Breakdown</h4>
                    {predictBudget.data.breakdown.map((b, i) => (
                      <div key={i} className="flex justify-between items-center text-sm border-b border-border/50 pb-2 last:border-0">
                        <span>{b.category}</span>
                        <span className="font-medium">${b.estimatedCost.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 p-4 bg-primary/10 rounded-xl text-sm leading-relaxed text-primary-foreground/90 text-foreground">
                    <p className="italic text-muted-foreground">"{predictBudget.data.aiSuggestions}"</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <Wand2 className="h-8 w-8 text-primary opacity-50" />
                  </div>
                  <p className="text-muted-foreground text-sm mb-6">Let AI analyze market rates for your specific wedding vibe and location to predict realistic costs.</p>
                  <Button 
                    onClick={handlePredict} 
                    disabled={isPredicting || predictBudget.isPending} 
                    className="w-full"
                    data-testid="btn-predict-budget"
                  >
                    {isPredicting || predictBudget.isPending ? "Analyzing market..." : "Predict Costs"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
