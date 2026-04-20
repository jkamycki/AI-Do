import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  getListVendorsQueryKey,
  getGetVendorQueryKey,
} from "@workspace/api-client-react";
import type { Vendor, VendorPayment } from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";
import { Link } from "wouter";

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
  const qc = useQueryClient();
  const [form, setForm] = useState<VendorFormData>(
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
      : defaultFormData
  );

  const createMutation = useCreateVendor({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListVendorsQueryKey() });
        toast({ title: "Vendor added" });
        onClose();
      },
      onError: () => toast({ title: "Failed to save vendor", variant: "destructive" }),
    },
  });

  const updateMutation = useUpdateVendor({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListVendorsQueryKey() });
        if (vendor) qc.invalidateQueries({ queryKey: getGetVendorQueryKey(vendor.id) });
        toast({ title: "Vendor updated" });
        onClose();
      },
      onError: () => toast({ title: "Failed to update vendor", variant: "destructive" }),
    },
  });

  const isLoading = createMutation.isPending || updateMutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.category) {
      toast({ title: "Name and category are required", variant: "destructive" });
      return;
    }
    const payload = {
      name: form.name.trim(),
      category: form.category,
      email: form.email || undefined,
      phone: form.phone || undefined,
      website: form.website || undefined,
      portalLink: form.portalLink || undefined,
      notes: form.notes || undefined,
      totalCost: form.totalCost ? Number(form.totalCost) : 0,
      depositAmount: form.depositAmount ? Number(form.depositAmount) : 0,
      contractSigned: form.contractSigned,
    };
    if (vendor) {
      updateMutation.mutate({ id: vendor.id, data: payload });
    } else {
      createMutation.mutate({ data: payload });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {vendor ? "Edit Vendor" : "Add Vendor"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Vendor Name *</Label>
              <Input
                placeholder="e.g. The Grand Venue"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                data-testid="input-vendor-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger data-testid="select-vendor-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {VENDOR_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="contact@vendor.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                placeholder="+1 (555) 000-0000"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Website</Label>
              <Input
                placeholder="https://vendor.com"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Total Cost ($)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={form.totalCost}
                onChange={(e) => setForm({ ...form, totalCost: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Deposit Amount ($)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={form.depositAmount}
                onChange={(e) => setForm({ ...form, depositAmount: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Vendor Portal / Booking Link</Label>
              <Input
                placeholder="https://portal.vendor.com"
                value={form.portalLink}
                onChange={(e) => setForm({ ...form, portalLink: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Any notes about this vendor..."
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
              <Label htmlFor="contractSigned" className="cursor-pointer">Contract signed</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isLoading} data-testid="btn-save-vendor">
              {isLoading ? "Saving..." : vendor ? "Save Changes" : "Add Vendor"}
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
  const qc = useQueryClient();
  const toggleMutation = useUpdateVendorPayment({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetVendorQueryKey(vendorId) });
      },
      onError: () => toast({ title: "Failed to update payment", variant: "destructive" }),
    },
  });

  const days = daysUntil(payment.dueDate);
  const isOverdue = !payment.isPaid && days < 0;
  const isDueSoon = !payment.isPaid && days >= 0 && days <= 14;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
      payment.isPaid ? "bg-muted/30 border-border/40" : isOverdue ? "bg-red-50 border-red-200" : isDueSoon ? "bg-amber-50 border-amber-200" : "bg-card border-border/60"
    }`}>
      <button
        className="flex-shrink-0"
        onClick={() => toggleMutation.mutate({ id: vendorId, paymentId: payment.id, data: { isPaid: !payment.isPaid } })}
        disabled={toggleMutation.isPending}
      >
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
          payment.isPaid ? "bg-green-500 border-green-500" : "border-muted-foreground/40 hover:border-primary"
        }`}>
          {payment.isPaid && <CheckCircle2 className="h-3 w-3 text-white" />}
        </div>
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${payment.isPaid ? "line-through text-muted-foreground" : ""}`}>
          {payment.label}
        </p>
        <p className="text-xs text-muted-foreground">
          {payment.isPaid ? "Paid" : isOverdue ? `${Math.abs(days)} days overdue` : isDueSoon ? `Due in ${days} days` : `Due ${formatDate(payment.dueDate)}`}
        </p>
      </div>
      <div className="text-sm font-semibold text-right shrink-0">{formatCurrency(payment.amount)}</div>
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
  const qc = useQueryClient();
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");

  const mutation = useCreateVendorPayment({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetVendorQueryKey(vendorId) });
        toast({ title: "Payment added" });
        onDone();
      },
      onError: () => toast({ title: "Failed to add payment", variant: "destructive" }),
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label || !amount || !dueDate) {
      toast({ title: "All payment fields are required", variant: "destructive" });
      return;
    }
    mutation.mutate({ id: vendorId, data: { label, amount: Number(amount), dueDate } });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-muted/30 rounded-lg p-3 space-y-3 border">
      <p className="text-sm font-medium">Add Payment Milestone</p>
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder="e.g. Deposit"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="col-span-2"
        />
        <Input
          type="number"
          placeholder="Amount $"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min="0"
          step="0.01"
        />
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          {mutation.isPending ? "Adding..." : "Add Payment"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
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
  const qc = useQueryClient();
  const pendingFileRef = useRef<File | null>(null);

  const updateMutation = useUpdateVendor({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetVendorQueryKey(vendor.id) });
        qc.invalidateQueries({ queryKey: getListVendorsQueryKey() });
      },
      onError: () => toast({ title: "Failed to save file", variant: "destructive" }),
    },
  });

  const { uploadFile, isUploading } = useUpload({
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
      toast({ title: "File uploaded" });
    },
    onError: () => {
      pendingFileRef.current = null;
      toast({ title: "Upload failed", variant: "destructive" });
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
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Files</p>
        <label className={`cursor-pointer flex items-center gap-1.5 text-xs font-medium text-primary hover:underline ${isUploading ? "opacity-50 pointer-events-none" : ""}`}>
          <Upload className="h-3.5 w-3.5" />
          {isUploading ? "Uploading..." : "Upload File"}
          <input type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
        </label>
      </div>
      {vendor.files.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No files uploaded yet. Add contracts, invoices, or receipts.</p>
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

  const deletePaymentMutation = useDeleteVendorPayment({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetVendorQueryKey(vendorId) });
        setDeletingPaymentId(null);
        toast({ title: "Payment removed" });
      },
      onError: () => toast({ title: "Failed to remove payment", variant: "destructive" }),
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

  const paidAmount = vendor.payments.filter((p) => p.isPaid).reduce((s, p) => s + p.amount, 0);
  const totalScheduled = vendor.payments.reduce((s, p) => s + p.amount, 0);
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
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Contract signed
                    </Badge>
                  )}
                  {overdue.length > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertCircle className="h-3 w-3 mr-1" /> {overdue.length} overdue
                    </Badge>
                  )}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={onEdit}>
                <Edit className="h-3.5 w-3.5 mr-1.5" /> Edit
              </Button>
            </div>
          </DialogHeader>

          <Tabs defaultValue="overview">
            <TabsList className="w-full">
              <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
              <TabsTrigger value="payments" className="flex-1">
                Payments {vendor.payments.length > 0 && `(${vendor.payments.length})`}
              </TabsTrigger>
              <TabsTrigger value="files" className="flex-1">
                Files {vendor.files.length > 0 && `(${vendor.files.length})`}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-5 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Cost</p>
                  <p className="text-2xl font-serif font-semibold text-foreground">{formatCurrency(vendor.totalCost)}</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Deposit</p>
                  <p className="text-2xl font-serif font-semibold text-foreground">{formatCurrency(vendor.depositAmount)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{vendor.contractSigned ? "Contract signed" : "Contract pending"}</p>
                </div>
              </div>

              {totalScheduled > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Paid so far</span>
                    <span className="font-medium">{formatCurrency(paidAmount)} of {formatCurrency(totalScheduled)}</span>
                  </div>
                  <Progress value={totalScheduled > 0 ? (paidAmount / totalScheduled) * 100 : 0} className="h-2" />
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
                    <span className="group-hover:underline">Vendor Portal</span>
                    <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
                  </a>
                )}
              </div>

              {vendor.notes && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Notes</p>
                  <p className="text-sm text-foreground whitespace-pre-line">{vendor.notes}</p>
                </div>
              )}

              <div className="pt-2">
                <Link href={`/vendor-email?vendor=${encodeURIComponent(vendor.name)}&category=${encodeURIComponent(vendor.category)}`}>
                  <Button variant="outline" size="sm" className="w-full">
                    <Mail className="h-3.5 w-3.5 mr-2" />
                    Draft Email to {vendor.name}
                    <ChevronRight className="h-3.5 w-3.5 ml-auto" />
                  </Button>
                </Link>
              </div>
            </TabsContent>

            <TabsContent value="payments" className="space-y-4 mt-4">
              {vendor.payments.length === 0 && !showAddPayment && (
                <p className="text-sm text-muted-foreground text-center py-4">No payments scheduled yet. Add your deposit and final payment milestones.</p>
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
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Payment Milestone
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
            <AlertDialogTitle>Remove payment?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this payment milestone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deletingPaymentId) {
                  deletePaymentMutation.mutate({ id: vendorId, paymentId: deletingPaymentId });
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SummarizeEmailDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
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
    mutation.mutate({ data: { emailText } });
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
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <Edit className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
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
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-serif font-semibold text-foreground">{formatCurrency(vendor.totalCost)}</p>
          {vendor.depositAmount > 0 && (
            <p className="text-xs text-muted-foreground">Deposit: {formatCurrency(vendor.depositAmount)}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {vendor.contractSigned && (
            <div className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="h-3 w-3" />
              <span>Signed</span>
            </div>
          )}
          {!vendor.contractSigned && (
            <div className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
              <Clock className="h-3 w-3" />
              <span>Pending</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Vendors() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: vendors = [], isLoading } = useListVendors();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [viewingVendorId, setViewingVendorId] = useState<number | null>(null);
  const [deletingVendorId, setDeletingVendorId] = useState<number | null>(null);
  const [showSummarize, setShowSummarize] = useState(false);

  const deleteMutation = useDeleteVendor({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListVendorsQueryKey() });
        setDeletingVendorId(null);
        toast({ title: "Vendor removed" });
      },
      onError: () => toast({ title: "Failed to delete vendor", variant: "destructive" }),
    },
  });

  const totalCost = vendors.reduce((s, v) => s + v.totalCost, 0);
  const totalDeposit = vendors.reduce((s, v) => s + v.depositAmount, 0);
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
          <h1 className="text-3xl font-serif text-foreground">Vendors</h1>
          <p className="text-muted-foreground mt-0.5">{vendors.length} vendor{vendors.length !== 1 ? "s" : ""} tracked</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSummarize(true)}
            data-testid="btn-summarize-email-open"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Summarize Reply
          </Button>
          <Button
            size="sm"
            onClick={() => setShowAddDialog(true)}
            data-testid="btn-add-vendor"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Vendor
          </Button>
        </div>
      </div>

      {vendors.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border/60 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Total Committed</span>
            </div>
            <p className="text-2xl font-serif font-semibold">{formatCurrency(totalCost)}</p>
          </div>
          <div className="bg-card border border-border/60 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Total Deposits</span>
            </div>
            <p className="text-2xl font-serif font-semibold">{formatCurrency(totalDeposit)}</p>
          </div>
          <div className="bg-card border border-border/60 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Contracts Signed</span>
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
          <h2 className="text-2xl font-serif text-foreground mb-2">No vendors yet</h2>
          <p className="text-muted-foreground max-w-sm mb-6">
            Add all your wedding vendors in one place — venue, caterer, photographer, florist, and more. Track costs, contracts, and payment schedules.
          </p>
          <Button onClick={() => setShowAddDialog(true)} data-testid="btn-add-first-vendor">
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Vendor
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
            <span className="text-sm font-medium">Add Vendor</span>
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

      {viewingVendorId !== null && (
        <VendorDetailDialog
          vendorId={viewingVendorId}
          onClose={() => setViewingVendorId(null)}
          onEdit={() => {
            const v = vendors.find((vv) => vv.id === viewingVendorId);
            if (v) {
              setViewingVendorId(null);
              setEditingVendor(v);
            }
          }}
        />
      )}

      <AlertDialog open={deletingVendorId !== null} onOpenChange={() => setDeletingVendorId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this vendor?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the vendor and all associated payments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deletingVendorId) deleteMutation.mutate({ id: deletingVendorId }); }}
              data-testid="btn-confirm-delete-vendor"
            >
              Remove Vendor
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showSummarize && (
        <SummarizeEmailDialog open onClose={() => setShowSummarize(false)} />
      )}
    </div>
  );
}
