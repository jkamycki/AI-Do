import { useState, useRef, useMemo } from "react";
import { useAuth } from "@clerk/react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/authFetch";
import {
  useListVendors,
  useCreateVendor,
  useUpdateVendor,
  useDeleteVendor,
  useGetVendor,
  useCreateVendorPayment,
  useUpdateVendorPayment,
  useDeleteVendorPayment,
  useSummarizeVendorEmail,
  useGetProfile,
  getListVendorsQueryKey,
  getGetVendorQueryKey,
} from "@workspace/api-client-react";
import type { Vendor, VendorPayment } from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { VendorMessagesTab } from "@/components/VendorMessagesTab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Store,
  Plus,
  Trash2,
  Edit,
  Mail,
  Phone,
  Globe,
  Link2,
  StickyNote,
  FileText,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
  Upload,
  ExternalLink,
  Sparkles,
  X,
  ChevronRight,
  Bell,
} from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

const VENDOR_CATEGORIES = [
  "Venue",
  "Caterer",
  "Photographer",
  "Videographer",
  "Florist",
  "DJ / Band",
  "Officiant",
  "Hair & Makeup",
  "Transportation",
  "Cake & Desserts",
  "Invitations",
  "Lighting & AV",
  "Photo Booth",
  "Wedding Planner",
  "Other",
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  "Venue": "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300",
  "Caterer": "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300",
  "Photographer": "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
  "Videographer": "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300",
  "Florist": "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
  "DJ / Band": "bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300",
  "Officiant": "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300",
  "Hair & Makeup": "bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300",
  "Transportation": "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300",
  "Cake & Desserts": "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
  "Invitations": "bg-lime-100 dark:bg-lime-900/30 text-lime-800 dark:text-lime-300",
  "Lighting & AV": "bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-300",
  "Photo Booth": "bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-800 dark:text-fuchsia-300",
  "Wedding Planner": "bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300",
  "Other": "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300",
};

function formatCurrency(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysUntil(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T12:00:00");
  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

type VendorFormData = {
  name: string;
  category: string;
  email: string;
  phone: string;
  website: string;
  portalLink: string;
  notes: string;
  totalCost: string;
  depositAmount: string;
  contractSigned: boolean;
};

const defaultFormData: VendorFormData = {
  name: "",
  category: "",
  email: "",
  phone: "",
  website: "",
  portalLink: "",
  notes: "",
  totalCost: "",
  depositAmount: "",
  contractSigned: false,
};

function AddEditVendorDialog({
  open,
  onClose,
  vendor,
}: {
  open: boolean;
  onClose: () => void;
  vendor?: Vendor;
}) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const initialForm = useMemo<VendorFormData>(
    () =>
      vendor
        ? {
            name: vendor.name,
            category: vendor.category,
            email: vendor.email ?? "",
            phone: vendor.phone ?? "",
            website: vendor.website ?? "",
            portalLink: vendor.portalLink ?? "",
            notes: vendor.notes ?? "",
            totalCost: vendor.totalCost > 0 ? String(vendor.totalCost) : "",
            depositAmount: vendor.depositAmount > 0 ? String(vendor.depositAmount) : "",
            contractSigned: vendor.contractSigned,
          }
        : defaultFormData,
    [vendor]
  );
  const [form, setForm] = useState<VendorFormData>(initialForm);

  const createMutation = useCreateVendor({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListVendorsQueryKey() });
        qc.invalidateQueries({ queryKey: ["vendor-financials"] });
        toast({ title: t("vendors.vendor_added") });
        onClose();
      },
      onError: () => toast({ title: t("vendors.failed_save"), variant: "destructive" }),
    },
  });

  const updateMutation = useUpdateVendor({
    mutation: {
      onSuccess: async (updated) => {
        if (vendor) {
          const key = getGetVendorQueryKey(vendor.id);
          const existing = qc.getQueryData<{ payments?: unknown[] }>(key);
          qc.setQueryData(key, {
            ...(updated as object),
            payments: existing?.payments ?? [],
          });
          await qc.refetchQueries({ queryKey: key });
        }
        await qc.refetchQueries({ queryKey: getListVendorsQueryKey() });
        qc.invalidateQueries({ queryKey: ["vendor-financials"] });
        toast({ title: t("vendors.vendor_updated") });
        onClose();
      },
      onError: () => toast({ title: t("vendors.failed_update"), variant: "destructive" }),
    },
  });

  const isLoading = createMutation.isPending || updateMutation.isPending;

  function buildUpdatePayload() {
    return {
      name: form.name.trim(),
      category: form.category,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      website: form.website.trim() || null,
      portalLink: form.portalLink.trim() || null,
      notes: form.notes.trim() || null,
      totalCost: form.totalCost ? Number(form.totalCost) : 0,
      depositAmount: form.depositAmount ? Number(form.depositAmount) : 0,
      contractSigned: form.contractSigned,
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.category) {
      toast({ title: t("vendors.name_category_required"), variant: "destructive" });
      return;
    }
    if (vendor) {
      updateMutation.mutate({ id: vendor.id, data: buildUpdatePayload() as never });
    } else {
      const createPayload = {
        name: form.name.trim(),
        category: form.category,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        website: form.website.trim() || undefined,
        portalLink: form.portalLink.trim() || undefined,
        notes: form.notes.trim() || undefined,
        totalCost: form.totalCost ? Number(form.totalCost) : 0,
        depositAmount: form.depositAmount ? Number(form.depositAmount) : 0,
        contractSigned: form.contractSigned,
      };
      createMutation.mutate({ data: createPayload });
    }
  }


  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {vendor ? t("vendors.edit_vendor") : t("vendors.add_vendor_title")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("vendors.vendor_name")}</Label>
              <Input
                placeholder={t("vendors.vendor_name_placeholder")}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                data-testid="input-vendor-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("vendors.category")}</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger data-testid="select-vendor-category">
                  <SelectValue placeholder={t("vendors.select_category")} />
                </SelectTrigger>
                <SelectContent>
                  {VENDOR_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("vendors.email")}</Label>
              <Input
                type="email"
                placeholder={t("vendors.email_placeholder")}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("vendors.phone")}</Label>
              <Input
                placeholder={t("vendors.phone_placeholder")}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("vendors.website")}</Label>
              <Input
                placeholder={t("vendors.website_placeholder")}
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("vendors.total_cost")}</Label>
              <MoneyInput
                value={form.totalCost}
                onChange={(v) => setForm({ ...form, totalCost: v })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("vendors.deposit")}</Label>
              <MoneyInput
                value={form.depositAmount}
                onChange={(v) => setForm({ ...form, depositAmount: v })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("vendors.vendor_portal")}</Label>
              <Input
                placeholder={t("vendors.vendor_portal_placeholder")}
                value={form.portalLink}
                onChange={(e) => setForm({ ...form, portalLink: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("vendors.notes")}</Label>
              <Textarea
                placeholder={t("vendors.notes_placeholder")}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Checkbox
                id="contractSigned"
                checked={form.contractSigned}
                onCheckedChange={(checked) => setForm({ ...form, contractSigned: !!checked })}
              />
              <Label htmlFor="contractSigned" className="cursor-pointer">{t("vendors.contract_signed")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t("vendors.cancel")}</Button>
            <Button type="submit" disabled={isLoading} data-testid="btn-save-vendor">
              {isLoading ? t("vendors.saving") : vendor ? t("vendors.save_changes") : t("vendors.add_vendor")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PaymentRow({
  payment,
  vendorId,
  onDelete,
}: {
  payment: VendorPayment;
  vendorId: number;
  onDelete: () => void;
}) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(payment.label);
  const [editAmount, setEditAmount] = useState(String(payment.amount));
  const [editDueDate, setEditDueDate] = useState(payment.dueDate);
  const [editIsPaid, setEditIsPaid] = useState(payment.isPaid);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetVendorQueryKey(vendorId) });
    qc.invalidateQueries({ queryKey: getListVendorsQueryKey() });
    qc.invalidateQueries({ queryKey: ["vendor-financials"] });
  };

  const toggleMutation = useUpdateVendorPayment({
    mutation: {
      onSuccess: invalidate,
      onError: () => toast({ title: t("vendors.failed_update_payment"), variant: "destructive" }),
    },
  });

  const editMutation = useUpdateVendorPayment({
    mutation: {
      onSuccess: () => { invalidate(); setEditing(false); },
      onError: () => toast({ title: t("vendors.failed_update_payment"), variant: "destructive" }),
    },
  });

  const days = daysUntil(payment.dueDate);
  const isOverdue = !payment.isPaid && days < 0;

  function openEdit() {
    setEditLabel(payment.label);
    setEditAmount(String(payment.amount));
    setEditDueDate(payment.dueDate);
    setEditIsPaid(payment.isPaid);
    setEditing(true);
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editLabel || !editAmount || !editDueDate) {
      toast({ title: t("vendors.all_fields_required"), variant: "destructive" });
      return;
    }
    editMutation.mutate({ id: vendorId, paymentId: payment.id, data: { label: editLabel, amount: Number(editAmount), dueDate: editDueDate, isPaid: editIsPaid } });
  }

  if (editing) {
    return (
      <form onSubmit={handleEditSubmit} className="rounded-xl p-4 space-y-4 border bg-muted/20">
        <p className="text-sm font-semibold">Edit Payment</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">{t("vendors.payment_label")}</Label>
            <Input
              placeholder={t("vendors.payment_label_placeholder")}
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("vendors.payment_amount")}</Label>
            <MoneyInput value={editAmount} onChange={setEditAmount} placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("vendors.payment_due_date")}</Label>
            <Input
              type="date"
              value={editDueDate}
              onChange={(e) => setEditDueDate(e.target.value)}
              className="[color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>
          <div className="col-span-2">
            <Label className="text-xs mb-2 block">{t("vendors.payment_status")}</Label>
            <div className="flex rounded-lg overflow-hidden border">
              <button
                type="button"
                onClick={() => setEditIsPaid(false)}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${!editIsPaid ? "bg-red-500 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
              >
                {t("vendors.not_paid")}
              </button>
              <button
                type="button"
                onClick={() => setEditIsPaid(true)}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${editIsPaid ? "bg-green-500 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
              >
                {t("vendors.paid")}
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button type="submit" size="sm" disabled={editMutation.isPending} className="flex-1">
            {editMutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>{t("vendors.cancel")}</Button>
        </div>
      </form>
    );
  }

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
      payment.isPaid
        ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/50"
        : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50"
    }`}>
      <button
        className="flex-shrink-0"
        title={payment.isPaid ? t("vendors.mark_as_unpaid") : t("vendors.mark_as_paid")}
        onClick={() => toggleMutation.mutate({ id: vendorId, paymentId: payment.id, data: { isPaid: !payment.isPaid } })}
        disabled={toggleMutation.isPending}
      >
        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
          payment.isPaid
            ? "bg-green-500 border-green-500"
            : "border-red-400 dark:border-red-500 bg-white dark:bg-transparent hover:bg-red-100 dark:hover:bg-red-900/30"
        }`}>
          {payment.isPaid && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
        </div>
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${payment.isPaid ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300"}`}>
          {payment.label}
        </p>
        <p className={`text-xs ${payment.isPaid ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {payment.isPaid
            ? t("vendors.paid_date", { date: payment.paidAt ? formatDate(payment.paidAt.slice(0, 10)) : "" }).replace(" · ", payment.paidAt ? " · " : "")
            : isOverdue
              ? t("vendors.overdue_days_other", { n: Math.abs(days) })
              : days === 0
                ? t("vendors.due_today")
                : t("vendors.due_on", { date: formatDate(payment.dueDate) })}
        </p>
      </div>
      <div className={`text-sm font-bold text-right shrink-0 ${payment.isPaid ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>
        {formatCurrency(payment.amount)}
      </div>
      <button onClick={openEdit} title="Edit payment" className="text-muted-foreground hover:text-foreground transition-colors ml-1">
        <Edit className="h-3.5 w-3.5" />
      </button>
      <button onClick={onDelete} className="text-muted-foreground hover:text-destructive transition-colors">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function AddPaymentForm({
  vendorId,
  onDone,
}: {
  vendorId: number;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isPaid, setIsPaid] = useState(false);

  const mutation = useCreateVendorPayment({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetVendorQueryKey(vendorId) });
        qc.invalidateQueries({ queryKey: getListVendorsQueryKey() });
        qc.invalidateQueries({ queryKey: ["vendor-financials"] });
        toast({ title: t("vendors.payment_added") });
        onDone();
      },
      onError: () => toast({ title: t("vendors.failed_add_payment"), variant: "destructive" }),
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label || !amount || !dueDate) {
      toast({ title: t("vendors.all_fields_required"), variant: "destructive" });
      return;
    }
    mutation.mutate({ id: vendorId, data: { label, amount: Number(amount), dueDate, isPaid } });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl p-4 space-y-4 border bg-muted/20">
      <p className="text-sm font-semibold">{t("vendors.add_payment")}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label className="text-xs">{t("vendors.payment_label")}</Label>
          <Input
            placeholder={t("vendors.payment_label_placeholder")}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("vendors.payment_amount")}</Label>
          <MoneyInput
            value={amount}
            onChange={setAmount}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("vendors.payment_due_date")}</Label>
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="[color-scheme:light] dark:[color-scheme:dark]"
          />
        </div>
        <div className="col-span-2">
          <Label className="text-xs mb-2 block">{t("vendors.payment_status")}</Label>
          <div className="flex rounded-lg overflow-hidden border">
            <button
              type="button"
              onClick={() => setIsPaid(false)}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                !isPaid
                  ? "bg-red-500 text-white"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              {t("vendors.not_paid")}
            </button>
            <button
              type="button"
              onClick={() => setIsPaid(true)}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                isPaid
                  ? "bg-green-500 text-white"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              {t("vendors.paid")}
            </button>
          </div>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" disabled={mutation.isPending} className="flex-1">
          {mutation.isPending ? t("vendors.adding_payment") : t("vendors.add_payment")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>{t("vendors.cancel")}</Button>
      </div>
    </form>
  );
}

function FileUploadSection({
  vendor,
}: {
  vendor: { id: number; files: Array<{ name: string; url: string; type: string }> };
}) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const pendingFileRef = useRef<File | null>(null);

  const updateMutation = useUpdateVendor({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetVendorQueryKey(vendor.id) });
        qc.invalidateQueries({ queryKey: getListVendorsQueryKey() });
        qc.invalidateQueries({ queryKey: ["vendor-financials"] });
      },
      onError: () => toast({ title: t("vendors.failed_save_file"), variant: "destructive" }),
    },
  });

  const { uploadFile, isUploading } = useUpload({
    getToken,
    onSuccess: (response) => {
      const newFile = {
        name: pendingFileRef.current?.name ?? response.objectPath.split("/").pop() ?? "File",
        url: response.objectPath,
        type: pendingFileRef.current?.type ?? "application/octet-stream",
      };
      updateMutation.mutate({
        id: vendor.id,
        data: { files: [...vendor.files, newFile] },
      });
      pendingFileRef.current = null;
      toast({ title: t("vendors.file_uploaded") });
    },
    onError: () => {
      pendingFileRef.current = null;
      toast({ title: t("vendors.upload_failed"), variant: "destructive" });
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    pendingFileRef.current = file;
    uploadFile(file);
    e.target.value = "";
  }

  function removeFile(idx: number) {
    const newFiles = vendor.files.filter((_, i) => i !== idx);
    updateMutation.mutate({ id: vendor.id, data: { files: newFiles } });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t("vendors.files_label")}</p>
        <label className={`cursor-pointer flex items-center gap-1.5 text-xs font-medium text-primary hover:underline ${isUploading ? "opacity-50 pointer-events-none" : ""}`}>
          <Upload className="h-3.5 w-3.5" />
          {isUploading ? t("vendors.uploading_file") : t("vendors.upload_file")}
          <input type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
        </label>
      </div>
      {vendor.files.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">{t("vendors.no_files_desc")}</p>
      ) : (
        <div className="space-y-2">
          {vendor.files.map((file, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/20">
              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <a
                href={`/api/storage/objects${file.url.replace(/^\/objects/, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex-1 truncate"
              >
                {file.name}
              </a>
              <button onClick={() => removeFile(idx)} className="text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VendorDetailDialog({
  vendorId,
  onClose,
  onEdit,
}: {
  vendorId: number;
  onClose: () => void;
  onEdit: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: vendor, isLoading } = useGetVendor(vendorId);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<number | null>(null);

  const { t } = useTranslation();
  const deletePaymentMutation = useDeleteVendorPayment({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetVendorQueryKey(vendorId) });
        qc.invalidateQueries({ queryKey: getListVendorsQueryKey() });
        qc.invalidateQueries({ queryKey: ["vendor-financials"] });
        setDeletingPaymentId(null);
        toast({ title: t("vendors.payment_removed") });
      },
      onError: () => toast({ title: t("vendors.failed_remove_payment"), variant: "destructive" }),
    },
  });

  if (isLoading || !vendor) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl">
          <div className="space-y-4 py-4">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const hasDepositMilestone = vendor.payments.some((p) => p.label.toLowerCase() === "deposit");
  const paidFromPayments = vendor.payments.filter((p) => p.isPaid).reduce((s, p) => s + p.amount, 0);
  const paidAmount = (hasDepositMilestone ? 0 : vendor.depositAmount) + paidFromPayments;
  const totalScheduled = vendor.payments.reduce((s, p) => s + p.amount, 0);
  const totalForProgress = vendor.totalCost > 0 ? vendor.totalCost : totalScheduled;
  const overdue = vendor.payments.filter((p) => !p.isPaid && daysUntil(p.dueDate) < 0);

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-2 pr-6">
              <div>
                <DialogTitle className="font-serif text-2xl">{vendor.name}</DialogTitle>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge className={`text-xs ${CATEGORY_COLORS[vendor.category] ?? "bg-gray-100 text-gray-800"}`} variant="secondary">
                    {vendor.category}
                  </Badge>
                  {vendor.contractSigned && (
                    <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> {t("vendors.contract_signed_badge")}
                    </Badge>
                  )}
                  {overdue.length > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertCircle className="h-3 w-3 mr-1" /> {t("vendors.overdue_badge", { n: overdue.length })}
                    </Badge>
                  )}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={onEdit}>
                <Edit className="h-3.5 w-3.5 mr-1.5" /> {t("vendors.edit_btn")}
              </Button>
            </div>
          </DialogHeader>

          <Tabs defaultValue="overview">
            <TabsList className="w-full">
              <TabsTrigger value="overview" className="flex-1">{t("vendors.tab_overview")}</TabsTrigger>
              <TabsTrigger value="messages" className="flex-1">{t("vendors.tab_messages")}</TabsTrigger>
              <TabsTrigger value="payments" className="flex-1">
                {t("vendors.tab_payments")} {vendor.payments.length > 0 && `(${vendor.payments.length})`}
              </TabsTrigger>
              <TabsTrigger value="files" className="flex-1">
                {t("vendors.tab_files")} {vendor.files.length > 0 && `(${vendor.files.length})`}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="messages" className="mt-4">
              <VendorMessagesTab vendorId={vendor.id} />
            </TabsContent>

            <TabsContent value="overview" className="space-y-5 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t("vendors.overview_tab_total_cost")}</p>
                  <p className="text-2xl font-serif font-semibold text-foreground">{formatCurrency(vendor.totalCost)}</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t("vendors.overview_tab_deposit")}</p>
                  <p className="text-2xl font-serif font-semibold text-foreground">{formatCurrency(vendor.depositAmount)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{vendor.contractSigned ? t("vendors.overview_tab_contract_signed") : t("vendors.overview_tab_contract_pending")}</p>
                </div>
              </div>

              {totalForProgress > 0 && (
                <div className={`space-y-2 rounded-xl p-3 transition-colors ${paidAmount >= totalForProgress ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50" : "bg-muted/20"}`}>
                  <div className="flex justify-between text-sm items-center">
                    <span className={`font-medium ${paidAmount >= totalForProgress ? "text-green-700 dark:text-green-300" : "text-muted-foreground"}`}>
                      {paidAmount >= totalForProgress ? t("vendors.fully_paid") : t("vendors.paid_so_far")}
                    </span>
                    <span className={`font-bold tabular-nums ${paidAmount >= totalForProgress ? "text-green-700 dark:text-green-300" : "text-foreground"}`}>
                      {formatCurrency(paidAmount)}
                      <span className="font-normal text-muted-foreground"> of {formatCurrency(totalForProgress)}</span>
                    </span>
                  </div>
                  <Progress
                    value={Math.min((paidAmount / totalForProgress) * 100, 100)}
                    className={`h-2 ${paidAmount >= totalForProgress ? "[&>div]:bg-green-500" : ""}`}
                  />
                </div>
              )}

              <div className="space-y-3">
                {vendor.email && (
                  <a href={`mailto:${vendor.email}`} className="flex items-center gap-3 text-sm text-foreground hover:text-primary transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="group-hover:underline">{vendor.email}</span>
                  </a>
                )}
                {vendor.phone && (
                  <a href={`tel:${vendor.phone}`} className="flex items-center gap-3 text-sm text-foreground hover:text-primary transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="group-hover:underline">{vendor.phone}</span>
                  </a>
                )}
                {vendor.website && (
                  <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-foreground hover:text-primary transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="group-hover:underline truncate">{vendor.website}</span>
                    <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
                  </a>
                )}
                {vendor.portalLink && (
                  <a href={vendor.portalLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-foreground hover:text-primary transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Link2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="group-hover:underline">{t("vendors.vendor_portal_label")}</span>
                    <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
                  </a>
                )}
              </div>

              {vendor.notes && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">{t("vendors.notes_label")}</p>
                  <p className="text-sm text-foreground whitespace-pre-line">{vendor.notes}</p>
                </div>
              )}

            </TabsContent>

            <TabsContent value="payments" className="space-y-4 mt-4">
              {vendor.payments.length === 0 && !showAddPayment && (
                <p className="text-sm text-muted-foreground text-center py-4">{t("vendors.no_payments_yet")}</p>
              )}

              {(vendor.payments.length > 0 || vendor.depositAmount > 0) && (
                <div className="rounded-xl border bg-muted/20 p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground font-medium">{t("vendors.total_paid_label")}</span>
                    <span className={`font-bold tabular-nums ${totalForProgress > 0 && paidAmount >= totalForProgress ? "text-green-600 dark:text-green-400" : "text-foreground"}`}>
                      {formatCurrency(paidAmount)}
                      <span className="font-normal text-muted-foreground"> / {formatCurrency(totalForProgress)}</span>
                    </span>
                  </div>
                  <Progress
                    value={totalForProgress > 0 ? Math.min((paidAmount / totalForProgress) * 100, 100) : 0}
                    className="h-2.5"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {vendor.depositAmount > 0 && (
                        <span>{t("vendors.deposit_included", { amount: formatCurrency(vendor.depositAmount) })}</span>
                      )}
                      {t("vendors.milestones_paid", { paid: vendor.payments.filter(p => p.isPaid).length, total: vendor.payments.length })}
                    </span>
                    {totalForProgress > 0 && paidAmount < totalForProgress && (
                      <span>{t("vendors.remaining_label", { amount: formatCurrency(totalForProgress - paidAmount) })}</span>
                    )}
                    {totalForProgress > 0 && paidAmount >= totalForProgress && (
                      <span className="text-green-600 dark:text-green-400 font-medium">{t("vendors.all_paid")}</span>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {vendor.payments.map((payment) => (
                  <PaymentRow
                    key={payment.id}
                    payment={payment}
                    vendorId={vendorId}
                    onDelete={() => setDeletingPaymentId(payment.id)}
                  />
                ))}
              </div>
              {showAddPayment ? (
                <AddPaymentForm vendorId={vendorId} onDone={() => setShowAddPayment(false)} />
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddPayment(true)}
                  className="w-full"
                  data-testid="btn-add-payment"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> {t("vendors.add_payment_milestone")}
                </Button>
              )}
            </TabsContent>

            <TabsContent value="files" className="mt-4">
              <FileUploadSection vendor={vendor} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deletingPaymentId !== null} onOpenChange={() => setDeletingPaymentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("vendors.remove_payment_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("vendors.remove_payment_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("vendors.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deletingPaymentId) {
                  deletePaymentMutation.mutate({ id: vendorId, paymentId: deletingPaymentId });
                }
              }}
            >
              {t("vendors.payment_removed")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SummarizeEmailDialog({ open, onClose, preferredLanguage }: { open: boolean; onClose: () => void; preferredLanguage?: string }) {
  const { toast } = useToast();
  const [emailText, setEmailText] = useState("");
  const mutation = useSummarizeVendorEmail({
    mutation: {
      onError: () => toast({ title: "Failed to summarize email", variant: "destructive" }),
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!emailText.trim()) return;
    mutation.mutate({ data: { emailText, preferredLanguage } });
  }

  const result = mutation.data;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Summarize Vendor Reply
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Paste the vendor's email here</Label>
            <Textarea
              placeholder="Paste the full email text you received from your vendor..."
              value={emailText}
              onChange={(e) => setEmailText(e.target.value)}
              rows={8}
              data-testid="input-email-to-summarize"
            />
          </div>
          <Button type="submit" disabled={mutation.isPending || !emailText.trim()} className="w-full" data-testid="btn-summarize-email">
            {mutation.isPending ? "Summarizing..." : "Summarize Email"}
          </Button>
        </form>

        {result && (
          <div className="space-y-4 border-t pt-4 mt-2">
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <p className="text-xs font-medium text-primary uppercase tracking-wider mb-2">Summary</p>
              <p className="text-sm text-foreground">{result.summary}</p>
            </div>
            {result.keyPoints.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Key Points</p>
                <ul className="space-y-1.5">
                  {result.keyPoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.actionItems.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Action Items</p>
                <ul className="space-y-1.5">
                  {result.actionItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function VendorCard({
  vendor,
  onClick,
  onEdit,
  onDelete,
}: {
  vendor: Vendor;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const payments = vendor.payments ?? [];
  const hasDepositMilestone = payments.some((p) => p.label.toLowerCase() === "deposit");
  const paidFromPayments = payments.filter((p) => p.isPaid).reduce((s, p) => s + p.amount, 0);
  const paidAmount = (hasDepositMilestone ? 0 : vendor.depositAmount) + paidFromPayments;
  const totalScheduled = payments.reduce((s, p) => s + p.amount, 0);
  const totalForProgress = vendor.totalCost > 0 ? vendor.totalCost : totalScheduled;
  const isFullyPaid = totalForProgress > 0 && paidAmount >= totalForProgress;
  return (
    <div
      className="bg-card border border-border/60 rounded-2xl p-5 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer group relative"
      onClick={onClick}
      data-testid={`vendor-card-${vendor.id}`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">{vendor.name}</h3>
          <Badge className={`text-xs mt-1 ${CATEGORY_COLORS[vendor.category] ?? "bg-gray-100 text-gray-800"}`} variant="secondary">
            {vendor.category}
          </Badge>
        </div>
        <div className="flex gap-1 opacity-100 md:opacity-60 md:group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-1.5 rounded-lg border border-border/40 hover:bg-muted hover:border-border transition-colors"
            title="Edit vendor"
            aria-label="Edit vendor"
            data-testid={`btn-vendor-edit-${vendor.id}`}
          >
            <Edit className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg border border-border/40 hover:bg-destructive/10 hover:border-destructive/40 transition-colors"
            title="Delete vendor"
            aria-label="Delete vendor"
            data-testid={`btn-vendor-delete-${vendor.id}`}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </button>
        </div>
      </div>

      <div className="space-y-1.5 mb-4">
        {vendor.email && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Mail className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{vendor.email}</span>
          </div>
        )}
        {vendor.phone && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Phone className="h-3 w-3 flex-shrink-0" />
            <span>{vendor.phone}</span>
          </div>
        )}
        {vendor.website && (
          <a
            href={vendor.website}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <Globe className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{vendor.website}</span>
          </a>
        )}
        {vendor.portalLink && (
          <a
            href={vendor.portalLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <Link2 className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{t("vendors.vendor_portal_label")}</span>
          </a>
        )}
        {vendor.notes && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <StickyNote className="h-3 w-3 flex-shrink-0 mt-0.5" />
            <span className="line-clamp-2 whitespace-pre-line">{vendor.notes}</span>
          </div>
        )}
      </div>

      {vendor.nextPaymentDue && (() => {
        const days = daysUntil(vendor.nextPaymentDue);
        const isOverdue = days < 0;
        const isDueSoon = days >= 0 && days <= 14;
        if (isOverdue) {
          return (
            <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-lg">
              <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <span className="text-xs font-medium text-red-700 dark:text-red-300">
                {t("vendors.payment_overdue_banner", { n: Math.abs(days) })}
              </span>
            </div>
          );
        }
        if (isDueSoon) {
          return (
            <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg">
              <Bell className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                {days === 0 ? t("vendors.payment_due_today_banner") : t("vendors.payment_due_in_banner", { n: days })}
              </span>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-1.5 mb-3 text-xs text-muted-foreground">
            <Bell className="h-3 w-3 flex-shrink-0" />
            <span>{t("vendors.next_payment_label", { date: formatDate(vendor.nextPaymentDue) })}</span>
          </div>
        );
      })()}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-serif font-semibold text-foreground">{formatCurrency(vendor.totalCost)}</p>
          {vendor.depositAmount > 0 && (
            <p className="text-xs text-muted-foreground">{t("vendors.deposit_label", { amount: formatCurrency(vendor.depositAmount) })}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {isFullyPaid && (
            <div className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/50 px-2 py-0.5 rounded-full font-medium">
              <CheckCircle2 className="h-3 w-3" />
              <span>{t("vendors.fully_paid")}</span>
            </div>
          )}
          {vendor.contractSigned && (
            <div className="flex items-center gap-1 text-xs text-green-700 bg-green-50 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="h-3 w-3" />
              <span>{t("vendors.signed_badge")}</span>
            </div>
          )}
          {!vendor.contractSigned && (
            <div className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 rounded-full">
              <Clock className="h-3 w-3" />
              <span>{t("vendors.pending_badge")}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Vendors() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: vendors = [], isLoading } = useListVendors();
  const { data: profile } = useGetProfile();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [viewingVendorId, setViewingVendorId] = useState<number | null>(null);
  const [deletingVendorId, setDeletingVendorId] = useState<number | null>(null);
  const [showSummarize, setShowSummarize] = useState(false);

  const deleteMutation = useDeleteVendor({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListVendorsQueryKey() });
        qc.invalidateQueries({ queryKey: ["vendor-financials"] });
        setDeletingVendorId(null);
        toast({ title: t("vendors.vendor_removed") });
      },
      onError: () => toast({ title: t("vendors.failed_delete"), variant: "destructive" }),
    },
  });

  const { data: vendorFinancials } = useQuery({
    queryKey: ["vendor-financials"],
    queryFn: async () => {
      const res = await authFetch("/api/vendors/financials");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ totalCommitted: number; totalDeposits: number; totalPaidMilestones: number; totalPaid: number; vendorCount: number }>;
    },
  });

  const totalCost = vendors.reduce((s, v) => s + v.totalCost, 0);
  const totalDeposit = vendors.reduce((s, v) => s + v.depositAmount, 0);
  const paidOut = vendorFinancials?.totalPaid ?? totalDeposit;
  const signedCount = vendors.filter((v) => v.contractSigned).length;

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-40" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-foreground">{t("vendors.title")}</h1>
          <p className="text-muted-foreground mt-0.5">{vendors.length} {t("vendors.tracked", { count: vendors.length })}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSummarize(true)}
            data-testid="btn-summarize-email-open"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            {t("vendors.summarize_reply")}
          </Button>
          <Button
            size="sm"
            onClick={() => setShowAddDialog(true)}
            data-testid="btn-add-vendor"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            {t("vendors.add_vendor")}
          </Button>
        </div>
      </div>

      {vendors.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border/60 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">{t("vendors.total_committed")}</span>
            </div>
            <p className="text-2xl font-serif font-semibold">{formatCurrency(totalCost)}</p>
          </div>
          <div className="bg-card border border-border/60 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">{t("vendors.paid_out")}</span>
            </div>
            <p className="text-2xl font-serif font-semibold">{formatCurrency(paidOut)}</p>
          </div>
          <div className="bg-card border border-border/60 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">{t("vendors.contracts_signed")}</span>
            </div>
            <p className="text-2xl font-serif font-semibold">{signedCount}<span className="text-base text-muted-foreground font-sans font-normal"> / {vendors.length}</span></p>
          </div>
        </div>
      )}

      {vendors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Store className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-serif text-foreground mb-2">{t("vendors.no_vendors")}</h2>
          <p className="text-muted-foreground max-w-sm mb-6">
            {t("vendors.no_vendors_desc")}
          </p>
          <Button onClick={() => setShowAddDialog(true)} data-testid="btn-add-first-vendor">
            <Plus className="h-4 w-4 mr-2" />
            {t("vendors.add_first_vendor")}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendors.map((vendor) => (
            <VendorCard
              key={vendor.id}
              vendor={vendor}
              onClick={() => setViewingVendorId(vendor.id)}
              onEdit={() => setEditingVendor(vendor)}
              onDelete={() => setDeletingVendorId(vendor.id)}
            />
          ))}
          <button
            onClick={() => setShowAddDialog(true)}
            className="border-2 border-dashed border-border/60 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 hover:border-primary/30 hover:bg-primary/5 transition-all text-muted-foreground hover:text-primary min-h-[160px]"
            data-testid="btn-add-vendor-card"
          >
            <Plus className="h-6 w-6" />
            <span className="text-sm font-medium">{t("vendors.add_vendor_card")}</span>
          </button>
        </div>
      )}

      {showAddDialog && (
        <AddEditVendorDialog open onClose={() => setShowAddDialog(false)} />
      )}

      {editingVendor && (
        <AddEditVendorDialog
          open
          vendor={editingVendor}
          onClose={() => setEditingVendor(null)}
        />
      )}

      {viewingVendorId !== null && !editingVendor && (
        <VendorDetailDialog
          vendorId={viewingVendorId}
          onClose={() => setViewingVendorId(null)}
          onEdit={() => {
            const v = vendors.find((vv) => vv.id === viewingVendorId);
            if (v) {
              setEditingVendor(v);
            }
          }}
        />
      )}

      <AlertDialog open={deletingVendorId !== null} onOpenChange={() => setDeletingVendorId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("vendors.remove_vendor_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("vendors.remove_vendor_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("vendors.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deletingVendorId) deleteMutation.mutate({ id: deletingVendorId }); }}
              data-testid="btn-confirm-delete-vendor"
            >
              {t("vendors.remove_vendor_action")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showSummarize && (
        <SummarizeEmailDialog open onClose={() => setShowSummarize(false)} preferredLanguage={profile?.preferredLanguage ?? "English"} />
      )}
    </div>
  );
}
