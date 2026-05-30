import { Component, type ReactNode, useState, useRef, useMemo, useEffect } from "react";
import { useAuth, useUser } from "@clerk/react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { authFetch } from "@/lib/authFetch";
import { qrSvgDataUrl } from "@/lib/localQr";
import { getCurrentLanguageName } from "@/lib/languagePreference";
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
  useListConversations,
  getListVendorsQueryKey,
  getListConversationsQueryKey,
  getGetVendorQueryKey,
  getGetDashboardSummaryQueryKey,
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import {
  Store,
  ArrowLeft,
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
  ChevronDown,
  ChevronRight,
  Bell,
  Inbox,
  MessageSquare,
  Star,
  Instagram,
  Check,
} from "lucide-react";
import { Link, useLocation } from "wouter";
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

type VendorManagementTab = "vendors" | "messages" | "contacts" | "directory";

const VENDOR_DIRECTORY_PREVIEW_EMAIL = "kamyckijoseph@gmail.com";

function getRequestedVendorManagementTab(
  requestedTab: string | null,
  canPreviewVendorDirectory: boolean,
): VendorManagementTab {
  if (requestedTab === "contacts") return "contacts";
  if (requestedTab === "messages") return "messages";
  if (requestedTab === "directory" && canPreviewVendorDirectory) return "directory";
  return "vendors";
}

type VendorDirectoryListing = {
  about: string;
  category: string;
  contactName: string;
  email: string;
  fit: string;
  gallery: string[];
  id: string;
  instagram: string;
  location: string;
  logoUrl?: string;
  logoLabel: string;
  name: string;
  phone: string;
  price: number;
  reviews: number;
  rating: string;
  responseTime: string;
  services: string[];
  tags: string[];
  website: string;
};

class VendorMessagesErrorBoundary extends Component<
  { children: ReactNode; resetKey?: string | number | null },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || String(error) };
  }

  componentDidUpdate(prevProps: { resetKey?: string | number | null }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, message: "" });
    }
  }

  componentDidCatch(error: Error) {
    console.error("[VendorMessagesErrorBoundary]", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-6 text-sm text-amber-900">
          <p className="font-semibold">Messages could not load for this vendor.</p>
          <p className="mt-1 leading-6">
            Select another vendor from the dropdown, or refresh and try this conversation again.
          </p>
          {this.state.message && (
            <p className="mt-3 text-xs text-amber-800/80">Error: {this.state.message}</p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

const SAMPLE_VENDOR_DIRECTORY: VendorDirectoryListing[] = [
  {
    about: "Lumen & Lace creates editorial wedding photography with soft film tones, calm direction, and strong coverage from getting-ready moments through the final dance.",
    category: "Photography",
    contactName: "Maya Bennett",
    email: "hello@lumenandlace.example",
    fit: "Editorial style, warm film tones, and strong getting-ready coverage.",
    gallery: ["/images/default-wedding-couple.jpg", "/images/floral-bg.png", "/opengraph.jpg", "/images/bokeh-bg.png"],
    id: "lumen-lace-photo",
    instagram: "@lumenandlacephoto",
    location: "South Florida",
    logoUrl: "",
    logoLabel: "Lumen & Lace",
    name: "Lumen & Lace Photo",
    phone: "(555) 021-1402",
    price: 4200,
    reviews: 128,
    rating: "4.9",
    responseTime: "Replies in 1 day",
    services: ["Full wedding day coverage", "Engagement sessions", "Second photographer", "Online gallery delivery"],
    tags: ["Editorial", "Film look", "Engagement session"],
    website: "https://example.com/lumen-lace",
  },
  {
    about: "Verde Petal Studio designs romantic, garden-style florals for ceremonies and receptions, with a focus on soft movement, layered texture, and candlelit tables.",
    category: "Florist",
    contactName: "Isabel Cruz",
    email: "studio@verdepetal.example",
    fit: "Romantic garden arrangements, ceremony arches, and candle-heavy reception styling.",
    gallery: ["/images/floral-bg.png", "/images/default-wedding-couple.jpg", "/images/bokeh-bg.png", "/opengraph.jpg"],
    id: "verde-petal-studio",
    instagram: "@verdepetalstudio",
    location: "Miami / Fort Lauderdale",
    logoUrl: "",
    logoLabel: "Verde Petal",
    name: "Verde Petal Studio",
    phone: "(555) 019-7288",
    price: 2800,
    reviews: 96,
    rating: "4.8",
    responseTime: "Replies same day",
    services: ["Bridal bouquets", "Ceremony arches", "Reception centerpieces", "Full-service floral design"],
    tags: ["Garden", "Installations", "Candles"],
    website: "https://example.com/verde-petal",
  },
  {
    about: "Cole Events DJ brings clean MC hosting, bilingual announcements, polished ceremony sound, and a reception flow built around a packed dance floor.",
    category: "DJ / Band",
    contactName: "Andre Cole",
    email: "bookings@coleevents.example",
    fit: "Clean MC style, bilingual announcements, ceremony sound, and reception dance floor.",
    gallery: ["/opengraph.jpg", "/images/bokeh-bg.png", "/images/default-wedding-couple.jpg", "/images/floral-bg.png"],
    id: "cole-events-dj",
    instagram: "@coleeventsdj",
    location: "Tri-County Area",
    logoUrl: "",
    logoLabel: "Cole Events",
    name: "Cole Events DJ",
    phone: "(555) 017-9091",
    price: 1650,
    reviews: 84,
    rating: "5.0",
    responseTime: "Replies in 2 hours",
    services: ["Reception DJ", "Ceremony audio", "Bilingual MC services", "Dance floor lighting"],
    tags: ["Bilingual", "Ceremony audio", "Lighting"],
    website: "https://example.com/cole-events",
  },
];

function usePublishedPartnerListings(enabled = true) {
  return useQuery<VendorDirectoryListing[]>({
    queryKey: ["published-vendor-partner-directory"],
    queryFn: async () => {
      const response = await authFetch("/api/vendor-partners/directory");
      if (!response.ok) return [];
      const body = await response.json().catch(() => ({}));
      return Array.isArray(body.listings) ? body.listings : [];
    },
    enabled,
    staleTime: 60_000,
  });
}

function mergePartnerListings(publishedListings: VendorDirectoryListing[] | undefined) {
  const published = publishedListings ?? [];
  const publishedIds = new Set(published.map(listing => listing.id));
  return [
    ...published,
    ...SAMPLE_VENDOR_DIRECTORY.filter(listing => !publishedIds.has(listing.id)),
  ];
}

function isUsableImageSrc(src: string | null | undefined) {
  const value = typeof src === "string" ? src.trim() : "";
  return /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value) || value.startsWith("/") || /^https?:\/\//i.test(value);
}

function normalizeVendorCategory(category: string | null | undefined) {
  const raw = String(category ?? "").trim();
  if (/^dj\s*\/?\s*(band)?$/i.test(raw) || /^dj\s*\/\s*band$/i.test(raw)) return "DJ / Band";
  return VENDOR_CATEGORIES.find((cat) => cat.toLowerCase() === raw.toLowerCase()) ?? raw;
}

function vendorCategoryLabel(category: string | null | undefined) {
  const normalized = normalizeVendorCategory(category);
  return normalized === "DJ / Band" ? "DJ/Band" : normalized || "Other";
}

function vendorCategoryBadgeClass(category: string | null | undefined) {
  const normalized = normalizeVendorCategory(category);
  return CATEGORY_COLORS[normalized] ?? CATEGORY_COLORS.Other;
}

function vendorDisplayName(vendor: Pick<Vendor, "id" | "name"> | null | undefined) {
  const name = typeof vendor?.name === "string" ? vendor.name.trim() : "";
  return name || `Vendor ${vendor?.id ?? ""}`.trim();
}

function formatCurrency(n: number | null | undefined) {
  return `$${(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysUntil(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = year && month && day
    ? new Date(year, month - 1, day)
    : new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

type VendorFormData = {
  name: string;
  category: string;
  email: string;
  phone: string;
  website: string;
  portalLink: string;
  streetAddress: string;
  aptUnit: string;
  city: string;
  state: string;
  zip: string;
  address: string;
  notes: string;
  totalCost: string;
  depositAmount: string;
  contractSigned: boolean;
  primaryContact: string;
};

type VendorContactType = "General" | "Vendor";

type VendorContact = {
  id: string;
  source: "vendor" | "manual";
  vendorId: number | null;
  name: string;
  businessName: string | null;
  email: string | null;
  phone: string | null;
  contactType: VendorContactType;
  createdAt: string;
  updatedAt: string;
};

type VendorContactFormData = {
  vendorId: number | null;
  name: string;
  businessName: string;
  phone: string;
  email: string;
  contactType: VendorContactType;
};

const vendorContactsQueryKey = ["vendor-contacts"] as const;

function phoneHref(phone: string, scheme: "tel" | "sms") {
  const first = splitContactValues(phone)[0] ?? phone;
  const cleaned = first.replace(/[^\d+]/g, "");
  return `${scheme}:${cleaned || first}`;
}

function splitContactValues(value: string | null | undefined) {
  return (value ?? "")
    .split(/[,\n;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinContactValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.flatMap(splitContactValues))).join(", ");
}

function firstContactValue(value: string | null | undefined) {
  return splitContactValues(value)[0] ?? "";
}

async function fetchVendorContacts(): Promise<VendorContact[]> {
  const res = await authFetch("/api/vendor-contacts");
  if (!res.ok) throw new Error("Failed to load contacts");
  return res.json();
}

async function createVendorContact(data: VendorContactFormData): Promise<VendorContact> {
  const res = await authFetch("/api/vendor-contacts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to save contact");
  return res.json();
}

async function updateVendorContact(id: string, data: VendorContactFormData): Promise<VendorContact> {
  const res = await authFetch(`/api/vendor-contacts/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update contact");
  return res.json();
}

async function deleteVendorContact(id: string): Promise<void> {
  const res = await authFetch(`/api/vendor-contacts/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to remove contact");
}

const defaultFormData: VendorFormData = {
  name: "",
  category: "",
  email: "",
  phone: "",
  website: "",
  portalLink: "",
  streetAddress: "",
  aptUnit: "",
  city: "",
  state: "",
  zip: "",
  address: "",
  notes: "",
  totalCost: "",
  depositAmount: "",
  contractSigned: false,
  primaryContact: "",
};

function buildVendorAddress({
  streetAddress,
  aptUnit,
  city,
  state,
  zip,
}: Pick<VendorFormData, "streetAddress" | "aptUnit" | "city" | "state" | "zip">) {
  const stateZip = [state.trim(), zip.trim()].filter(Boolean).join(" ");
  const cityStateZip = [city.trim(), stateZip].filter(Boolean).join(", ");
  return [streetAddress.trim(), aptUnit.trim(), cityStateZip].filter(Boolean).join(", ");
}

function ContractStatusDropdown({
  signed,
  disabled,
  onChange,
}: {
  signed: boolean;
  disabled?: boolean;
  onChange: (signed: boolean) => void;
}) {
  const { t } = useTranslation();
  const label = signed
    ? t("vendors.contract_signed", { defaultValue: "Contract signed" })
    : t("vendors.contract_pending_badge", { defaultValue: "Contract pending" });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-pressed={signed}
          disabled={disabled}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:pointer-events-none disabled:opacity-60 ${
            signed
              ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-800/50 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50"
              : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800/50 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
          }`}
          data-testid="btn-vendor-contract-status"
        >
          {signed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
          <span>{label}</span>
          <ChevronDown className="h-3 w-3 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="z-[80] w-48"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem
          onSelect={() => {
            onChange(false);
          }}
          className="gap-2"
        >
          <Clock className="h-3.5 w-3.5 text-amber-700" />
          {t("vendors.contract_pending_badge", { defaultValue: "Contract pending" })}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            onChange(true);
          }}
          className="gap-2"
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-green-700" />
          {t("vendors.contract_signed", { defaultValue: "Contract signed" })}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
            streetAddress: (vendor as any).address ?? "",
            aptUnit: "",
            city: "",
            state: "",
            zip: "",
            address: (vendor as any).address ?? "",
            notes: vendor.notes ?? "",
            totalCost: vendor.totalCost > 0 ? String(vendor.totalCost) : "",
            depositAmount: vendor.depositAmount > 0 ? String(vendor.depositAmount) : "",
            contractSigned: vendor.contractSigned,
            primaryContact: (vendor as any).primaryContact ?? "",
          }
        : defaultFormData,
    [vendor]
  );
  const [form, setForm] = useState<VendorFormData>(initialForm);
  const [includeAddress, setIncludeAddress] = useState(Boolean(initialForm.address));

  function updateAddressFields(patch: Partial<Pick<VendorFormData, "streetAddress" | "aptUnit" | "city" | "state" | "zip">>) {
    setForm((current) => {
      const next = { ...current, ...patch };
      return { ...next, address: buildVendorAddress(next) };
    });
  }

  const createMutation = useCreateVendor({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListVendorsQueryKey() });
        qc.invalidateQueries({ queryKey: vendorContactsQueryKey });
        qc.invalidateQueries({ queryKey: ["vendor-financials"] });
        qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: t("vendors.vendor_added") });
        onClose();
      },
      onError: (err: unknown) => {
        const apiErr = err as { data?: { error?: string }; status?: number } | undefined;
        const serverMsg = apiErr?.data?.error;
        if (serverMsg?.toLowerCase().includes("no wedding profile")) {
          toast({
            title: t("vendors.no_profile_title", "Wedding profile required"),
            description: t("vendors.no_profile_desc", "Please complete your wedding profile setup on the Dashboard before adding vendors."),
            variant: "destructive",
          });
        } else {
          toast({
            title: t("vendors.failed_save"),
            description: serverMsg || undefined,
            variant: "destructive",
          });
        }
      },
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
        qc.invalidateQueries({ queryKey: vendorContactsQueryKey });
        qc.invalidateQueries({ queryKey: ["vendor-financials"] });
        qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: t("vendors.vendor_updated") });
        onClose();
      },
      onError: (err: unknown) => {
        const apiErr = err as { data?: { error?: string } } | undefined;
        toast({
          title: t("vendors.failed_update"),
          description: apiErr?.data?.error || undefined,
          variant: "destructive",
        });
      },
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
      address: includeAddress ? (form.address.trim() || null) : null,
      notes: form.notes.trim() || null,
      totalCost: form.totalCost ? Number(form.totalCost) : 0,
      depositAmount: form.depositAmount ? Number(form.depositAmount) : 0,
      contractSigned: form.contractSigned,
      primaryContact: form.primaryContact.trim() || null,
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
        address: includeAddress ? (form.address.trim() || undefined) : undefined,
        notes: form.notes.trim() || undefined,
        totalCost: form.totalCost ? Number(form.totalCost) : 0,
        depositAmount: form.depositAmount ? Number(form.depositAmount) : 0,
        contractSigned: form.contractSigned,
        primaryContact: form.primaryContact.trim() || undefined,
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
                    <SelectItem key={cat} value={cat}>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${vendorCategoryBadgeClass(cat)}`}>
                        {vendorCategoryLabel(cat)}
                      </span>
                    </SelectItem>
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
              <Label>{t("vendors.primary_contact", { defaultValue: "Primary Contact" })}</Label>
              <Input
                placeholder={t("vendors.primary_contact_placeholder", { defaultValue: "Contact person name" })}
                value={form.primaryContact}
                onChange={(e) => setForm({ ...form, primaryContact: e.target.value })}
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
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="includeAddress"
                  checked={includeAddress}
                  onCheckedChange={(checked) => setIncludeAddress(!!checked)}
                />
                <Label htmlFor="includeAddress" className="cursor-pointer">
                  {t("vendors.add_address", { defaultValue: "Add vendor address" })}
                </Label>
              </div>
              {includeAddress && (
                <div className="space-y-3 rounded-md border border-border/70 bg-muted/20 p-3">
                  <div className="space-y-1.5">
                    <Label>{t("vendors.street_address", { defaultValue: "Street address" })}</Label>
                    <AddressAutocomplete
                      value={form.streetAddress}
                      onChange={(value) => updateAddressFields({ streetAddress: value })}
                      onSelect={(suggestion) => updateAddressFields({
                        streetAddress: suggestion.street,
                        city: suggestion.city,
                        state: suggestion.state,
                        zip: suggestion.zip,
                      })}
                      placeholder={t("vendors.address_placeholder", { defaultValue: "123 Main St" })}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>{t("vendors.apt_unit_optional", { defaultValue: "Apt / suite (optional)" })}</Label>
                      <Input
                        value={form.aptUnit}
                        onChange={(e) => updateAddressFields({ aptUnit: e.target.value })}
                        placeholder={t("vendors.apt_unit_placeholder", { defaultValue: "Apt 4B" })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("vendors.city", { defaultValue: "City" })}</Label>
                      <Input
                        value={form.city}
                        onChange={(e) => updateAddressFields({ city: e.target.value })}
                        placeholder={t("vendors.city_placeholder", { defaultValue: "City" })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("vendors.state", { defaultValue: "State" })}</Label>
                      <Input
                        value={form.state}
                        onChange={(e) => updateAddressFields({ state: e.target.value })}
                        placeholder={t("vendors.state_placeholder", { defaultValue: "State" })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("vendors.zip", { defaultValue: "ZIP" })}</Label>
                      <Input
                        value={form.zip}
                        onChange={(e) => updateAddressFields({ zip: e.target.value })}
                        placeholder={t("vendors.zip_placeholder", { defaultValue: "ZIP code" })}
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("vendors.full_address_preview", { defaultValue: "Full address preview" })}</Label>
                    <Input
                      value={form.address}
                      readOnly
                      placeholder={t("vendors.full_address_preview_placeholder", { defaultValue: "Address fills as you type" })}
                      className="bg-background/70 text-muted-foreground"
                    />
                  </div>
                </div>
              )}
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
    qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
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
        <p className="text-sm font-semibold">{t("vendors.edit_payment", { defaultValue: "Edit Payment" })}</p>
        <p className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-md p-2.5">
          {t("vendors.deposit_note", { defaultValue: "Note: don't log your deposit here or label a payment as \"Deposit\" — the deposit amount belongs in the Edit Vendor section so it isn't double-counted." })}
        </p>
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
            {editMutation.isPending ? t("vendors.saving_ellipsis", { defaultValue: "Saving…" }) : t("vendors.save_changes_btn", { defaultValue: "Save Changes" })}
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
      <button onClick={openEdit} title={t("vendors.edit_payment", { defaultValue: "Edit payment" })} className="text-muted-foreground hover:text-foreground transition-colors ml-1">
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
        qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
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
      <p className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-md p-2.5">
        {t("vendors.deposit_note", { defaultValue: "Note: don't log your deposit here or label a payment as \"Deposit\" — the deposit amount belongs in the Edit Vendor section so it isn't double-counted." })}
      </p>
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
  vendor: { id: number; files: Array<{ name: string; url: string; type: string; uploadedAt?: string }> };
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
        qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
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
        uploadedAt: new Date().toISOString(),
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

  function formatUploadedDate(uploadedAt?: string) {
    if (!uploadedAt) return "";
    const date = new Date(uploadedAt);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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
          {vendor.files.map((file, idx) => {
            const uploadedDate = formatUploadedDate(file.uploadedAt);
            return (
              <div key={idx} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/20">
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                    <a
                      href={`/api/storage/objects${file.url.replace(/^\/objects/, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-sm text-primary hover:underline"
                    >
                      {file.name}
                    </a>
                    {uploadedDate && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        Uploaded {uploadedDate}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => removeFile(idx)} className="text-muted-foreground hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VendorDetailDialog({
  vendorId,
  onClose,
  onEdit,
  initialTab = "overview",
}: {
  vendorId: number;
  onClose: () => void;
  onEdit: () => void;
  initialTab?: "overview" | "messages" | "files";
}) {
  const { data: vendor, isLoading } = useGetVendor(vendorId);
  const [activeTab, setActiveTab] = useState(initialTab);
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  const updateContractMutation = useUpdateVendor({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetVendorQueryKey(vendorId) });
        qc.invalidateQueries({ queryKey: getListVendorsQueryKey() });
        qc.invalidateQueries({ queryKey: ["vendor-financials"] });
        qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: t("vendors.contract_status_updated", { defaultValue: "Contract status updated" }) });
      },
      onError: () => toast({ title: t("vendors.failed_update"), variant: "destructive" }),
    },
  });

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, vendorId]);

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
  const setContractStatus = (contractSigned: boolean) => {
    if (vendor.contractSigned === contractSigned) return;
    updateContractMutation.mutate({
      id: vendor.id,
      data: { contractSigned } as never,
    });
  };

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-2 pr-6">
              <div>
                <DialogTitle className="font-serif text-2xl">{vendor.name}</DialogTitle>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge className={`text-xs ${vendorCategoryBadgeClass(vendor.category)}`} variant="secondary">
                    {vendorCategoryLabel(vendor.category)}
                  </Badge>
                  <ContractStatusDropdown
                    signed={vendor.contractSigned}
                    disabled={updateContractMutation.isPending}
                    onChange={setContractStatus}
                  />
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

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "overview" | "messages" | "files")}>
            <TabsList className="w-full">
              <TabsTrigger value="overview" className="flex-1">{t("vendors.tab_overview")}</TabsTrigger>
              <TabsTrigger value="messages" className="flex-1">{t("vendors.tab_messages")}</TabsTrigger>
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

            <TabsContent value="files" className="mt-4">
              <FileUploadSection vendor={vendor} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SummarizeEmailDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
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
    mutation.mutate({ data: { emailText, preferredLanguage: getCurrentLanguageName() } });
  }

  const result = mutation.data;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t("vendors.summarize_reply_title", { defaultValue: "Summarize Vendor Reply" })}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("vendors.paste_vendor_email", { defaultValue: "Paste the vendor's email here" })}</Label>
            <Textarea
              placeholder={t("vendors.paste_vendor_email_placeholder", { defaultValue: "Paste the full email text you received from your vendor..." })}
              value={emailText}
              onChange={(e) => setEmailText(e.target.value)}
              rows={8}
              data-testid="input-email-to-summarize"
            />
          </div>
          <Button type="submit" disabled={mutation.isPending || !emailText.trim()} className="w-full" data-testid="btn-summarize-email">
            {mutation.isPending ? t("vendors.summarizing", { defaultValue: "Summarizing..." }) : t("vendors.summarize_email", { defaultValue: "Summarize Email" })}
          </Button>
        </form>

        {result && (
          <div className="space-y-4 border-t pt-4 mt-2">
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <p className="text-xs font-medium text-primary uppercase tracking-wider mb-2">{t("vendors.summary_label", { defaultValue: "Summary" })}</p>
              <p className="text-sm text-foreground">{result.summary}</p>
            </div>
            {result.keyPoints.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{t("vendors.key_points_label", { defaultValue: "Key Points" })}</p>
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
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{t("vendors.action_items_label", { defaultValue: "Action Items" })}</p>
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

function VendorContactDialog({
  open,
  onClose,
  contact,
}: {
  open: boolean;
  onClose: () => void;
  contact?: VendorContact | null;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: vendors = [] } = useListVendors();
  const [primaryContactChoice, setPrimaryContactChoice] = useState<"manual" | "primary">("manual");
  const [additionalPhone, setAdditionalPhone] = useState("");
  const [additionalEmail, setAdditionalEmail] = useState("");
  const [form, setForm] = useState<VendorContactFormData>({
    vendorId: contact?.vendorId ?? null,
    name: contact?.name ?? "",
    businessName: contact?.businessName ?? "",
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
    contactType: contact?.contactType ?? "General",
  });

  useEffect(() => {
    setForm({
      vendorId: contact?.vendorId ?? null,
      name: contact?.name ?? "",
      businessName: contact?.businessName ?? "",
      phone: contact?.phone ?? "",
      email: contact?.email ?? "",
      contactType: contact?.contactType ?? "General",
    });
    setPrimaryContactChoice("manual");
    setAdditionalPhone("");
    setAdditionalEmail("");
  }, [contact]);

  const selectedVendor = form.vendorId ? vendors.find((vendor) => vendor.id === form.vendorId) : null;

  function applyVendor(vendorId: string) {
    const nextVendorId = Number(vendorId);
    const vendor = vendors.find((item) => item.id === nextVendorId);
    setForm((current) => ({
      ...current,
      vendorId: Number.isFinite(nextVendorId) ? nextVendorId : null,
      businessName: vendor?.name ?? current.businessName,
      contactType: "Vendor",
    }));
    setPrimaryContactChoice("manual");
  }

  function applyPrimaryContactChoice(choice: "manual" | "primary") {
    setPrimaryContactChoice(choice);
    if (choice !== "primary" || !selectedVendor) return;
    setForm((current) => ({
      ...current,
      name: selectedVendor.primaryContact?.trim() || current.name || selectedVendor.name,
      businessName: selectedVendor.name,
      phone: joinContactValues([selectedVendor.phone, additionalPhone]),
      email: joinContactValues([selectedVendor.email, additionalEmail]),
    }));
  }

  function updateAdditionalPhone(value: string) {
    setAdditionalPhone(value);
    if (primaryContactChoice !== "primary" || !selectedVendor) return;
    setForm((current) => ({
      ...current,
      phone: joinContactValues([selectedVendor.phone, value]),
    }));
  }

  function updateAdditionalEmail(value: string) {
    setAdditionalEmail(value);
    if (primaryContactChoice !== "primary" || !selectedVendor) return;
    setForm((current) => ({
      ...current,
      email: joinContactValues([selectedVendor.email, value]),
    }));
  }

  const createMutation = useMutation({
    mutationFn: createVendorContact,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vendorContactsQueryKey });
      toast({ title: t("vendors.contact_saved", { defaultValue: "Contact saved" }) });
      onClose();
    },
    onError: () => toast({ title: t("vendors.contact_save_failed", { defaultValue: "Could not save contact" }), variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: VendorContactFormData) => updateVendorContact(contact?.id ?? "", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vendorContactsQueryKey });
      toast({ title: t("vendors.contact_updated", { defaultValue: "Contact updated" }) });
      onClose();
    },
    onError: () => toast({ title: t("vendors.contact_save_failed", { defaultValue: "Could not save contact" }), variant: "destructive" }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: t("vendors.contact_name_required", { defaultValue: "Contact name is required" }), variant: "destructive" });
      return;
    }
    const payload: VendorContactFormData = {
      vendorId: form.contactType === "Vendor" ? form.vendorId : null,
      name: form.name.trim(),
      businessName: form.businessName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      contactType: form.contactType,
    };
    if (contact) updateMutation.mutate(payload);
    else createMutation.mutate(payload);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {contact
              ? t("vendors.edit_contact", { defaultValue: "Edit Contact" })
              : t("vendors.add_contact", { defaultValue: "Add Contact" })}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("vendors.contact_name", { defaultValue: "Name" })}</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t("vendors.contact_name_placeholder", { defaultValue: "Contact name" })}
              data-testid="input-vendor-contact-name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("vendors.contact_business_name", { defaultValue: "Business Name (if applicable)" })}</Label>
            <Input
              value={form.businessName}
              onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              placeholder={t("vendors.contact_business_placeholder", { defaultValue: "Business or company name" })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("vendors.phone")}</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder={t("vendors.phone_placeholder", { defaultValue: "Phone number(s)" })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("vendors.email")} {t("vendors.optional_label", { defaultValue: "(optional)" })}</Label>
              <Input
                type="text"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder={t("vendors.email_placeholder", { defaultValue: "Email address(es)" })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("vendors.contact_type", { defaultValue: "Contact Type" })}</Label>
            <Select
              value={form.contactType}
              onValueChange={(value) => setForm({
                ...form,
                contactType: value as VendorContactType,
                vendorId: value === "Vendor" ? form.vendorId : null,
              })}
            >
              <SelectTrigger data-testid="select-vendor-contact-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="General">{t("vendors.contact_type_general", { defaultValue: "General" })}</SelectItem>
                <SelectItem value="Vendor">{t("vendors.contact_type_vendor", { defaultValue: "Vendor" })}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.contactType === "Vendor" && (
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="space-y-1.5">
                <Label>{t("vendors.choose_vendor", { defaultValue: "Choose Vendor" })}</Label>
                <Select value={form.vendorId ? String(form.vendorId) : ""} onValueChange={applyVendor}>
                  <SelectTrigger data-testid="select-contact-vendor">
                    <SelectValue placeholder={t("vendors.select_vendor_placeholder", { defaultValue: "Select a vendor" })} />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={String(vendor.id)}>
                        {vendor.name} {vendor.category ? `(${vendor.category})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedVendor && (
                <>
                  <div className="space-y-1.5">
                    <Label>{t("vendors.use_primary_vendor_contact", { defaultValue: "Use this vendor's primary contact" })}</Label>
                    <Select value={primaryContactChoice} onValueChange={(value) => applyPrimaryContactChoice(value as "manual" | "primary")}>
                      <SelectTrigger data-testid="select-primary-vendor-contact">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">
                          {t("vendors.add_different_contact_name", { defaultValue: "Add a different contact name" })}
                        </SelectItem>
                        {selectedVendor.primaryContact?.trim() && (
                          <SelectItem value="primary">
                            {selectedVendor.primaryContact.trim()}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  {primaryContactChoice !== "primary" && (
                    <p className="text-xs text-muted-foreground">
                      {t("vendors.vendor_contact_custom_name_hint", { defaultValue: "Enter a different contact name above if this is not the primary contact." })}
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>{t("vendors.additional_phone", { defaultValue: "Additional Phone Numbers" })}</Label>
                      <Input
                        value={additionalPhone}
                        onChange={(e) => updateAdditionalPhone(e.target.value)}
                        placeholder={t("vendors.additional_phone_placeholder", { defaultValue: "Separate with commas" })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("vendors.additional_email", { defaultValue: "Additional Emails" })}</Label>
                      <Input
                        value={additionalEmail}
                        onChange={(e) => updateAdditionalEmail(e.target.value)}
                        placeholder={t("vendors.additional_email_placeholder", { defaultValue: "Separate with commas" })}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t("vendors.cancel")}</Button>
            <Button type="submit" disabled={isPending} data-testid="btn-save-vendor-contact">
              {isPending ? t("vendors.saving") : t("vendors.save_contact", { defaultValue: "Save Contact" })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VendorContactsTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<VendorContact | null>(null);
  const [removingContact, setRemovingContact] = useState<VendorContact | null>(null);
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: vendorContactsQueryKey,
    queryFn: fetchVendorContacts,
  });

  const removeMutation = useMutation({
    mutationFn: deleteVendorContact,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vendorContactsQueryKey });
      setRemovingContact(null);
      toast({ title: t("vendors.contact_removed", { defaultValue: "Contact removed" }) });
    },
    onError: () => toast({ title: t("vendors.contact_remove_failed", { defaultValue: "Could not remove contact" }), variant: "destructive" }),
  });

  const importedCount = contacts.filter((contact) => contact.source === "vendor").length;
  const manualCount = contacts.length - importedCount;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-serif text-foreground">{t("vendors.contacts_title", { defaultValue: "Contacts" })}</h2>
          <p className="text-sm text-muted-foreground">
            {t("vendors.contacts_summary", {
              defaultValue: "{{imported}} vendor contacts used | {{manual}} added here",
              imported: importedCount,
              manual: manualCount,
            })}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditingContact(null);
            setShowContactDialog(true);
          }}
          data-testid="btn-add-vendor-contact"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          {t("vendors.add_contact", { defaultValue: "Add Contact" })}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border/60 rounded-2xl">
          <Store className="h-8 w-8 text-muted-foreground mb-3" />
          <h3 className="font-serif text-xl text-foreground">{t("vendors.no_contacts_title", { defaultValue: "No contacts yet" })}</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
            {t("vendors.no_contacts_desc", { defaultValue: "Add a contact manually, or use vendor contacts from your Vendor List when you need them here." })}
          </p>
          <Button size="sm" onClick={() => setShowContactDialog(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            {t("vendors.add_contact", { defaultValue: "Add Contact" })}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="grid gap-3 rounded-xl border border-border/60 bg-card p-4 md:grid-cols-[minmax(0,1fr)_minmax(260px,auto)_auto] md:items-center"
              data-testid={`vendor-contact-${contact.id}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-foreground truncate">{contact.name}</h3>
                  <Badge
                    variant={contact.contactType === "Vendor" ? "secondary" : "outline"}
                    className={contact.contactType === "Vendor" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200" : ""}
                  >
                    {contact.contactType === "Vendor"
                      ? t("vendors.vendor_contact_badge", { defaultValue: "Vendor Contact" })
                      : t("vendors.contact_type_general", { defaultValue: "General" })}
                  </Badge>
                </div>
                {contact.businessName && (
                  <p className="text-sm text-muted-foreground truncate mt-1">{contact.businessName}</p>
                )}
              </div>
              {contact.phone && (
                <div className="grid grid-cols-2 gap-2 md:hidden">
                  <a
                    href={phoneHref(contact.phone, "tel")}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10"
                    aria-label={t("vendors.call_contact", { defaultValue: "Call {{name}}", name: contact.name })}
                  >
                    <Phone className="h-4 w-4" />
                    {t("vendors.call", { defaultValue: "Call" })}
                  </a>
                  <a
                    href={phoneHref(contact.phone, "sms")}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10"
                    aria-label={t("vendors.text_contact", { defaultValue: "Text {{name}}", name: contact.name })}
                  >
                    <MessageSquare className="h-4 w-4" />
                    {t("vendors.text", { defaultValue: "Text" })}
                  </a>
                </div>
              )}
              <div className="grid gap-2 text-sm sm:grid-cols-2 md:w-[380px]">
                {contact.phone && (
                  <span className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-muted-foreground min-w-0">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{contact.phone}</span>
                  </span>
                )}
                {contact.email && (
                  <a href={`mailto:${firstContactValue(contact.email)}`} className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-muted-foreground hover:text-primary min-w-0">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{contact.email}</span>
                  </a>
                )}
              </div>
              <div className="flex items-center gap-1 md:justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setEditingContact(contact);
                    setShowContactDialog(true);
                  }}
                  aria-label={t("vendors.edit_contact", { defaultValue: "Edit Contact" })}
                >
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setRemovingContact(contact)}
                  aria-label={t("vendors.remove_contact", { defaultValue: "Remove Contact" })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showContactDialog && (
        <VendorContactDialog
          open
          contact={editingContact}
          onClose={() => {
            setShowContactDialog(false);
            setEditingContact(null);
          }}
        />
      )}

      <AlertDialog open={!!removingContact} onOpenChange={() => setRemovingContact(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("vendors.remove_contact_title", { defaultValue: "Remove this contact?" })}</AlertDialogTitle>
            <AlertDialogDescription>
              {removingContact?.source === "vendor"
                ? t("vendors.remove_synced_contact_desc", { defaultValue: "This removes the contact from this Contacts tab only. The vendor stays in your Vendor list." })
                : t("vendors.remove_manual_contact_desc", { defaultValue: "This will permanently delete this saved contact." })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("vendors.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (removingContact) removeMutation.mutate(removingContact.id);
              }}
            >
              {t("vendors.remove_contact", { defaultValue: "Remove Contact" })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function VendorDirectoryTab({
  onOpenVendorMessages,
}: {
  onOpenVendorMessages: (vendorId: number) => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useUser();
  const { data: vendors = [] } = useListVendors();
  const { data: publishedPartnerListings = [] } = usePublishedPartnerListings();
  const partnerListings = useMemo(() => mergePartnerListings(publishedPartnerListings), [publishedPartnerListings]);
  const [selectedListing, setSelectedListing] = useState<VendorDirectoryListing | null>(null);
  const [pendingMessageListing, setPendingMessageListing] = useState<VendorDirectoryListing | null>(null);
  const accountEmail = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? "";
  const createPartnerVendorMutation = useCreateVendor({
    mutation: {
      onSuccess: async (created) => {
        await qc.invalidateQueries({ queryKey: getListVendorsQueryKey() });
        qc.invalidateQueries({ queryKey: vendorContactsQueryKey });
        qc.invalidateQueries({ queryKey: ["vendor-financials"] });
        qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        if (accountEmail) {
          sessionStorage.setItem(`aido_vendor_message_default_cc_${created.id}`, accountEmail);
        }
        toast({ title: "Partner added to your Vendor List" });
        onOpenVendorMessages(created.id);
      },
      onError: () => {
        toast({
          title: "Could not start partner message",
          description: "Try adding this partner to your Vendor List manually, then open Messages.",
          variant: "destructive",
        });
      },
    },
  });
  const createPartnerInquiryMutation = useMutation({
    mutationFn: async (listing: VendorDirectoryListing) => {
      const response = await authFetch("/api/messaging/partner-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: listing.name,
          category: normalizeVendorCategory(listing.category),
          email: listing.email,
          phone: listing.phone,
          website: listing.website,
          primaryContact: listing.contactName,
        }),
      });
      if (!response.ok) throw new Error("Could not start partner inquiry");
      return response.json() as Promise<{ vendorId: number; conversationId: number }>;
    },
    onSuccess: ({ vendorId }) => {
      if (accountEmail) {
        sessionStorage.setItem(`aido_vendor_message_default_cc_${vendorId}`, accountEmail);
      }
      toast({ title: "Partner message opened" });
      onOpenVendorMessages(vendorId);
    },
    onError: () => {
      toast({
        title: "Could not start partner message",
        description: "Try again or add this partner to your Vendor List first.",
        variant: "destructive",
      });
    },
  });

  const existingVendorForListing = (listing: VendorDirectoryListing) => vendors.find((vendor) => (
    vendor.email?.toLowerCase() === listing.email.toLowerCase() ||
    vendor.name.toLowerCase() === listing.name.toLowerCase()
  ));

  const createPartnerVendorAndOpenMessages = (listing: VendorDirectoryListing) => {
    createPartnerVendorMutation.mutate({
      data: {
        name: listing.name,
        category: normalizeVendorCategory(listing.category),
        email: listing.email,
        phone: listing.phone,
        website: listing.website,
        notes: `Added from A.I DO Partner Network.\n\n${listing.fit}`,
        totalCost: listing.price,
        depositAmount: 0,
        contractSigned: false,
        primaryContact: listing.contactName,
      },
    });
  };

  const createPartnerInquiryAndOpenMessages = (listing: VendorDirectoryListing) => {
    createPartnerInquiryMutation.mutate(listing);
  };

  const requestPartnerMessages = (listing: VendorDirectoryListing) => {
    const existingVendor = existingVendorForListing(listing);
    if (existingVendor) {
      if (accountEmail) {
        sessionStorage.setItem(`aido_vendor_message_default_cc_${existingVendor.id}`, accountEmail);
      }
      onOpenVendorMessages(existingVendor.id);
      return;
    }
    createPartnerInquiryAndOpenMessages(listing);
  };

  const askToAddPartnerAndMessage = (listing: VendorDirectoryListing) => {
    const existingVendor = existingVendorForListing(listing);
    if (existingVendor) {
      requestPartnerMessages(listing);
      return;
    }
    setPendingMessageListing(listing);
  };

  const confirmAddPartnerDialog = (
    <AlertDialog open={!!pendingMessageListing} onOpenChange={(open) => !open && setPendingMessageListing(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Add partner to your Vendor List?</AlertDialogTitle>
          <AlertDialogDescription>
            You can message {pendingMessageListing?.name ?? "this partner"} during discovery without adding them to your Vendor List,
            or add them now if you want to track them as a saved vendor.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={createPartnerInquiryMutation.isPending || createPartnerVendorMutation.isPending}
            onClick={() => {
              if (pendingMessageListing) {
                createPartnerInquiryAndOpenMessages(pendingMessageListing);
                setPendingMessageListing(null);
              }
            }}
          >
            Message only
          </Button>
          <AlertDialogCancel disabled={createPartnerInquiryMutation.isPending || createPartnerVendorMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={createPartnerVendorMutation.isPending || createPartnerInquiryMutation.isPending}
            onClick={() => {
              if (pendingMessageListing) {
                createPartnerVendorAndOpenMessages(pendingMessageListing);
                setPendingMessageListing(null);
              }
            }}
          >
            Add and message
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (selectedListing) {
    return (
      <>
        <VendorDirectoryProfile
          listing={selectedListing}
          accountEmail={accountEmail}
          isOpeningMessages={createPartnerVendorMutation.isPending || createPartnerInquiryMutation.isPending}
          onAddPartner={() => askToAddPartnerAndMessage(selectedListing)}
          onBack={() => setSelectedListing(null)}
          onOpenMessages={() => requestPartnerMessages(selectedListing)}
        />
        {confirmAddPartnerDialog}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/15 bg-primary/5 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Private preview</p>
            <h2 className="mt-1 font-serif text-2xl text-foreground">A.I DO Partner Network</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Curated preview of approved vendor partners connected with A.I DO. This is not a public vendor search marketplace yet.
            </p>
          </div>
          <Badge className="w-fit bg-primary text-primary-foreground">Only {VENDOR_DIRECTORY_PREVIEW_EMAIL}</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {partnerListings.map((listing) => (
          <div
            key={listing.id}
            role="button"
            tabIndex={0}
            className="cursor-pointer rounded-2xl border border-border/70 bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40"
            onClick={() => setSelectedListing(listing)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setSelectedListing(listing);
              }
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge className={vendorCategoryBadgeClass(listing.category)}>
                  {vendorCategoryLabel(listing.category)}
                </Badge>
                <h3 className="mt-3 font-serif text-xl text-foreground">{listing.name}</h3>
                <p className="text-sm text-muted-foreground">{listing.location}</p>
              </div>
              <div className="rounded-full bg-amber-50 px-2.5 py-1 text-sm font-semibold text-amber-700">
                {listing.rating}
              </div>
            </div>

            <p className="mt-4 text-sm leading-6 text-foreground">{listing.fit}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {listing.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-5 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="h-4 w-4 text-primary" />
                From {formatCurrency(listing.price)}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4 text-primary" />
                {listing.responseTime}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4 text-primary" />
                <a className="hover:text-primary" href={`mailto:${listing.email}`}>{listing.email}</a>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 text-primary" />
                <a className="hover:text-primary" href={phoneHref(listing.phone, "tel")}>{listing.phone}</a>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <Button
                type="button"
                size="sm"
                className="flex-1"
                disabled={createPartnerVendorMutation.isPending || createPartnerInquiryMutation.isPending}
                onClick={(event) => {
                  event.stopPropagation();
                  requestPartnerMessages(listing);
                }}
              >
                <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                Message Partner
              </Button>
              <Button asChild variant="outline" size="sm" onClick={(event) => event.stopPropagation()}>
                <a href={listing.website} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                  <Globe className="mr-1.5 h-3.5 w-3.5" />
                  Site
                </a>
              </Button>
            </div>
          </div>
        ))}
      </div>
      {confirmAddPartnerDialog}
    </div>
  );
}

function VendorHubMessagesTab({
  initialVendorId,
  onSelectVendor,
}: {
  initialVendorId?: number | null;
  onSelectVendor?: (vendorId: number) => void;
}) {
  const { data: vendors = [], isLoading: vendorsLoading } = useListVendors();
  const { data: conversations = [], isLoading } = useListConversations({
    query: {
      queryKey: getListConversationsQueryKey(),
      refetchInterval: 5000,
    },
  });
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(initialVendorId ?? null);

  useEffect(() => {
    if (initialVendorId) setSelectedVendorId(initialVendorId);
  }, [initialVendorId]);

  useEffect(() => {
    if (!selectedVendorId && conversations.length > 0) {
      setSelectedVendorId(conversations[0].vendorId);
    }
  }, [conversations, selectedVendorId]);

  const selectedConversation = conversations.find((conversation) => conversation.vendorId === selectedVendorId);
  const selectedVendor = vendors.find((vendor) => vendor.id === selectedVendorId);
  const sortedVendors = useMemo(
    () => [...vendors].sort((a, b) => vendorDisplayName(a).localeCompare(vendorDisplayName(b))),
    [vendors]
  );
  const selectedConversationName = typeof selectedConversation?.vendorName === "string" ? selectedConversation.vendorName.trim() : "";
  const selectedVendorName = selectedConversationName || vendorDisplayName(selectedVendor) || "Vendor";
  const selectedVendorEmail = selectedConversation?.vendorEmail ?? selectedVendor?.email;
  const selectedDropdownValue = selectedVendorId ? `vendor:${selectedVendorId}` : "";

  function selectVendorMessages(vendorId: number) {
    if (!Number.isFinite(vendorId)) return;
    setSelectedVendorId(vendorId);
    onSelectVendor?.(vendorId);
  }

  function handleNewMessageSelect(value: string) {
    const [type, id] = value.split(":");
    if (type === "vendor") selectVendorMessages(Number(id));
  }

  if (isLoading || vendorsLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-3">
          {[1, 2, 3].map((item) => <Skeleton key={item} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-[520px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="space-y-2 rounded-2xl border border-border/70 bg-card p-3 shadow-sm lg:max-h-[680px] lg:overflow-y-auto">
        <div className="px-2 pb-2">
          <h2 className="font-serif text-xl text-foreground">Messages</h2>
          <p className="text-xs text-muted-foreground">Vendor conversations in one place.</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-background/70 p-3">
          <Label className="text-xs font-semibold uppercase tracking-wider text-primary">New message</Label>
          <Select
            value={selectedDropdownValue}
            onValueChange={handleNewMessageSelect}
          >
            <SelectTrigger className="mt-2 bg-card" data-testid="select-message-vendor">
              <SelectValue placeholder="Select a current vendor" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>My Current Vendors</SelectLabel>
                {sortedVendors.length > 0 ? (
                  sortedVendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={`vendor:${vendor.id}`}>
                      {vendorDisplayName(vendor)} {vendor.category ? `(${vendorCategoryLabel(vendor.category)})` : ""}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="vendor:none" disabled>No current vendors yet</SelectItem>
                )}
              </SelectGroup>
            </SelectContent>
          </Select>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Pick one of your current vendors to start or continue a conversation.
          </p>
        </div>
        {conversations.length === 0 && (
          <div className="rounded-xl border border-dashed border-primary/25 bg-primary/5 px-4 py-6 text-center">
            <Inbox className="mx-auto h-7 w-7 text-primary/70" />
            <p className="mt-2 text-sm font-semibold text-foreground">No conversations yet</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Use the dropdown above to start with an existing vendor.
            </p>
          </div>
        )}
        {conversations.map((conversation) => {
          const isActive = conversation.vendorId === selectedVendorId;
          const lastMessageDate = new Date(conversation.lastMessageAt);
          const lastMessageLabel = Number.isNaN(lastMessageDate.getTime())
            ? ""
            : lastMessageDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
          return (
            <button
              key={conversation.id}
              type="button"
              className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                isActive
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-transparent hover:border-border hover:bg-muted/40"
              }`}
              onClick={() => {
                selectVendorMessages(conversation.vendorId);
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {(typeof conversation.vendorName === "string" && conversation.vendorName.trim()) || `Vendor ${conversation.vendorId}`}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {conversation.lastMessagePreview || conversation.subject || "No messages yet"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {lastMessageLabel && <span className="text-[10px] text-muted-foreground">{lastMessageLabel}</span>}
                  {conversation.unreadCount > 0 && (
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                      {conversation.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </aside>

      <section className="min-w-0 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
        {selectedVendorId ? (
          <div className="space-y-3">
            <div className="border-b border-border/70 pb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Conversation</p>
              <h3 className="font-serif text-2xl text-foreground">{selectedVendorName}</h3>
              {selectedVendorEmail && (
                <p className="text-sm text-muted-foreground">{selectedVendorEmail}</p>
              )}
            </div>
            <VendorMessagesErrorBoundary resetKey={selectedVendorId}>
              <VendorMessagesTab vendorId={selectedVendorId} />
            </VendorMessagesErrorBoundary>
          </div>
        ) : (
          <div className="flex min-h-[360px] items-center justify-center text-center text-sm text-muted-foreground">
            Select a conversation to view messages.
          </div>
        )}
      </section>
    </div>
  );
}

function VendorDirectoryProfile({
  accountEmail,
  isOpeningMessages,
  listing,
  onAddPartner,
  onBack,
  onOpenMessages,
}: {
  accountEmail?: string;
  isOpeningMessages?: boolean;
  listing: VendorDirectoryListing;
  onAddPartner: () => void;
  onBack: () => void;
  onOpenMessages: () => void;
}) {
  const profileUrl = `https://aidowedding.net/vendors/${listing.id}`;
  const galleryImages = listing.gallery.filter(isUsableImageSrc);

  return (
    <div className="space-y-5">
      <Button type="button" variant="ghost" className="h-9 gap-2 px-2 text-primary" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
        Back to directory
      </Button>

      <div className="rounded-xl border border-[#E8C9D4] bg-card p-5 shadow-sm">
        <div className="grid gap-5 md:grid-cols-[140px_1fr] md:items-center">
          <div className="flex h-24 items-center justify-center rounded-xl border border-[#E8C9D4] bg-[#FFF7F2] px-4 text-center">
            {isUsableImageSrc(listing.logoUrl) ? (
              <img
                src={listing.logoUrl}
                alt={`${listing.name} logo`}
                className="h-full w-full object-contain p-2"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div>
                <p className="font-serif text-2xl leading-none text-[#8D294D]">{listing.logoLabel}</p>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#B16C8E]">
                  {vendorCategoryLabel(listing.category)}
                </p>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="font-serif text-3xl font-semibold leading-tight text-foreground">{listing.name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm leading-none">
              <span className="flex items-center gap-0.5 text-amber-500">
                {Array.from({ length: 5 }, (_, index) => (
                  <Star key={index} className="h-4 w-4 fill-current" />
                ))}
              </span>
              <span className="font-semibold text-foreground">{listing.rating}</span>
              <span className="text-muted-foreground">({listing.reviews} reviews)</span>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-foreground sm:grid-cols-3">
              <div className="rounded-lg bg-[#FFF7F2] px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#B16C8E]">Category</p>
                <p className="mt-0.5 font-semibold">{vendorCategoryLabel(listing.category)}</p>
              </div>
              <div className="rounded-lg bg-[#FFF7F2] px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#B16C8E]">Starting Price</p>
                <p className="mt-0.5 font-semibold">From {formatCurrency(listing.price)}</p>
              </div>
              <div className="rounded-lg bg-[#FFF7F2] px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#B16C8E]">Service Area</p>
                <p className="mt-0.5 font-semibold">{listing.location}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className="space-y-5">
          {galleryImages.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {galleryImages.map((src, index) => (
              <img
                key={`${listing.id}-gallery-${index}`}
                src={src}
                alt={`${listing.name} service example ${index + 1}`}
                className="aspect-[4/3] w-full rounded-xl border border-[#E8C9D4] bg-card object-cover shadow-sm"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            ))}
          </div>
          )}

          <section className="rounded-xl border border-[#E8C9D4] bg-card p-5 shadow-sm">
            <h3 className="border-b border-[#E8C9D4] pb-3 font-serif text-xl font-semibold text-foreground">About Us</h3>
            <p className="mt-4 text-sm leading-7 text-foreground/90">{listing.about}</p>
          </section>

          <section className="rounded-xl border border-[#E8C9D4] bg-card p-5 shadow-sm">
            <h3 className="border-b border-[#E8C9D4] pb-3 font-serif text-xl font-semibold text-foreground">Services</h3>
            <div className="mt-4 grid gap-x-6 gap-y-3 text-sm text-foreground sm:grid-cols-2">
              {listing.services.map((service) => (
                <div key={service} className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                  {service}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-[#E8C9D4] bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-[#E8C9D4] pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-serif text-xl font-semibold text-foreground">Partner Messages</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Start a discovery thread in the Messages tab without adding this partner to your Vendor List.
                </p>
              </div>
              <Button
                type="button"
                variant="default"
                size="sm"
                className="w-fit"
                disabled={isOpeningMessages}
                onClick={onOpenMessages}
              >
                <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                Open in Messages
              </Button>
            </div>
            <div className="mt-4">
              <div className="rounded-xl border border-dashed border-[#E8C9D4] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">Ready to save them?</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 border-[#E8C9D4] text-primary"
                    disabled={isOpeningMessages}
                    onClick={onAddPartner}
                  >
                    Add to Vendor List
                  </Button>
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Add this partner only when you want them tracked with your current vendors, payments, files, and contacts.
                </p>
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-xl border border-[#E8C9D4] bg-card p-5 shadow-sm">
            <h3 className="font-serif text-xl font-semibold text-foreground">Contact Us</h3>
            <Button
              type="button"
              disabled={isOpeningMessages}
              className="mt-4 h-11 w-full rounded-lg bg-[linear-gradient(110deg,#D98984,#9D6AD8)] font-semibold text-white hover:opacity-95"
              onClick={onOpenMessages}
            >
              {isOpeningMessages ? "Opening Messages..." : "Message Partner"}
            </Button>
            {accountEmail && (
              <p className="mt-3 rounded-lg bg-[#FFF7F2] px-3 py-2 text-xs leading-5 text-[#6F3E54]">
                This opens under Vendor Hub Messages. It will not add the partner to your Vendor List unless you choose to save them.
              </p>
            )}
            <div className="mt-5 space-y-4 text-sm">
              <a className="grid grid-cols-[18px_1fr] gap-3 text-muted-foreground hover:text-primary" href={`mailto:${listing.email}`}>
                <Mail className="mt-0.5 h-4 w-4 text-primary" />
                <span className="min-w-0">
                  <span className="block font-semibold text-foreground">Email</span>
                  <span className="block break-words">{listing.email}</span>
                </span>
              </a>
              <div className="grid grid-cols-[18px_1fr] gap-3 text-muted-foreground">
                <Instagram className="mt-0.5 h-4 w-4 text-primary" />
                <span className="min-w-0">
                  <span className="block font-semibold text-foreground">Instagram</span>
                  <span className="block break-words">{listing.instagram}</span>
                </span>
              </div>
              <a className="grid grid-cols-[18px_1fr] gap-3 text-muted-foreground hover:text-primary" href={listing.website} target="_blank" rel="noreferrer">
                <Globe className="mt-0.5 h-4 w-4 text-primary" />
                <span className="min-w-0">
                  <span className="block font-semibold text-foreground">Website</span>
                  <span className="block break-words">{listing.website.replace(/^https?:\/\//, "")}</span>
                </span>
              </a>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-[#E8C9D4] bg-card shadow-sm">
            <div className="grid grid-cols-[1fr_86px] items-center gap-3 bg-[linear-gradient(90deg,#FFF7F2,#FFFFFF)] p-4">
              <div className="flex min-w-0 items-center gap-2">
                <img src="/logo.png" alt="A.I DO logo" className="h-11 w-11 shrink-0 object-contain" />
                <div>
                  <p className="text-[11px] font-semibold text-[#8D294D]">Proud Partner of</p>
                  <p className="font-serif text-2xl leading-none text-[#8D294D]">A.I DO</p>
                  <p className="text-[10px] text-[#6F3E54]">AI Wedding Planner Assistant</p>
                </div>
              </div>
              <img src={qrSvgDataUrl(profileUrl, 3, 2)} alt={`${listing.name} profile QR code`} className="h-20 w-20 rounded-lg bg-white p-1 shadow-sm" />
            </div>
            <p className="border-t border-[#E8C9D4] px-4 py-3 text-center text-sm font-medium text-muted-foreground">
              Scan to View Our Profile
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function VendorCard({
  vendor,
  onClick,
  onEdit,
  onDelete,
  onViewBudget,
  onSetContractStatus,
  isContractUpdating,
}: {
  vendor: Vendor;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewBudget: () => void;
  onSetContractStatus: (signed: boolean) => void;
  isContractUpdating?: boolean;
}) {
  const { t } = useTranslation();
  const payments = vendor.payments ?? [];
  const hasDepositMilestone = payments.some((p) => p.label.toLowerCase() === "deposit");
  const paidFromPayments = payments.filter((p) => p.isPaid).reduce((s, p) => s + p.amount, 0);
  const paidAmount = (hasDepositMilestone ? 0 : vendor.depositAmount) + paidFromPayments;
  const totalScheduled = payments.reduce((s, p) => s + p.amount, 0);
  const totalForProgress = vendor.totalCost > 0 ? vendor.totalCost : totalScheduled;
  const remainingBalance = Math.max(0, totalForProgress - paidAmount);
  const isFullyPaid = totalForProgress > 0 && paidAmount >= totalForProgress;
  const nextPaymentDays = vendor.nextPaymentDue ? daysUntil(vendor.nextPaymentDue) : null;
  const paymentStatus = isFullyPaid
    ? t("vendors.fully_paid")
    : vendor.nextPaymentDue
      ? nextPaymentDays != null && nextPaymentDays < 0
        ? t("vendors.payment_overdue_banner", { n: Math.abs(nextPaymentDays) })
        : nextPaymentDays === 0
          ? t("vendors.payment_due_today_banner")
          : t("vendors.payment_due_in_banner", { n: nextPaymentDays ?? 0 })
      : t("vendors.remaining_label", { amount: formatCurrency(remainingBalance) });
  return (
    <div
      className="bg-card border border-border/60 rounded-2xl p-5 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer group relative"
      onClick={onClick}
      data-testid={`vendor-card-${vendor.id}`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">{vendor.name}</h3>
          <Badge className={`text-xs mt-1 ${vendorCategoryBadgeClass(vendor.category)}`} variant="secondary">
            {vendorCategoryLabel(vendor.category)}
          </Badge>
        </div>
        <div className="flex gap-1 opacity-100 md:opacity-60 md:group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-1.5 rounded-lg border border-border/40 hover:bg-muted hover:border-border transition-colors"
            title={t("vendors.edit_vendor_title", { defaultValue: "Edit vendor" })}
            aria-label={t("vendors.edit_vendor_title", { defaultValue: "Edit vendor" })}
            data-testid={`btn-vendor-edit-${vendor.id}`}
          >
            <Edit className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg border border-border/40 hover:bg-destructive/10 hover:border-destructive/40 transition-colors"
            title={t("vendors.delete_vendor_title", { defaultValue: "Delete vendor" })}
            aria-label={t("vendors.delete_vendor_title", { defaultValue: "Delete vendor" })}
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

      <div className={`mb-3 rounded-lg border px-2.5 py-2 ${
        isFullyPaid
          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/30"
          : vendor.nextPaymentDue
            ? "border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/30"
            : "border-border/70 bg-muted/30"
      }`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className={`flex items-center gap-1.5 text-xs font-semibold ${
              isFullyPaid
                ? "text-emerald-800 dark:text-emerald-300"
                : vendor.nextPaymentDue
                  ? "text-amber-800 dark:text-amber-300"
                  : "text-muted-foreground"
            }`}>
              {isFullyPaid ? <CheckCircle2 className="h-3.5 w-3.5" /> : vendor.nextPaymentDue ? <Bell className="h-3.5 w-3.5" /> : <DollarSign className="h-3.5 w-3.5" />}
              <span className="truncate">{paymentStatus}</span>
            </div>
            {vendor.nextPaymentDue && !isFullyPaid && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {formatDate(vendor.nextPaymentDue)} · {t("vendors.remaining_label", { amount: formatCurrency(remainingBalance) })}
              </p>
            )}
          </div>
          <button
            type="button"
            className="shrink-0 rounded-md border border-border/60 bg-background px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/5"
            onClick={(e) => {
              e.stopPropagation();
              onViewBudget();
            }}
          >
            {t("vendors.view_in_budget", { defaultValue: "View in Budget" })}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-serif font-semibold text-foreground">{formatCurrency(vendor.totalCost)}</p>
          {vendor.depositAmount > 0 && (
            <p className="mt-1 inline-flex rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:border-yellow-800/60 dark:bg-yellow-950/30 dark:text-yellow-200">
              {t("vendors.deposit_label", { amount: formatCurrency(vendor.depositAmount) })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <ContractStatusDropdown
            signed={vendor.contractSigned}
            disabled={isContractUpdating}
            onChange={onSetContractStatus}
          />
        </div>
      </div>
    </div>
  );
}

export default function Vendors() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useUser();
  const { data: vendors = [], isLoading } = useListVendors();
  const { data: profile, isLoading: profileLoading } = useGetProfile();
  const [location, setLocation] = useLocation();
  const browserSearch = typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";
  const queryString = browserSearch || (location.includes("?") ? location.slice(location.indexOf("?") + 1) : "");
  const query = new URLSearchParams(queryString);
  const requestedVendorId = Number(query.get("vendorId") ?? "");
  const requestedTab = query.get("tab");
  const requestedManagementTab = query.get("management");
  const userEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? "";
  const canPreviewVendorDirectory = userEmail === VENDOR_DIRECTORY_PREVIEW_EMAIL;
  const requestedManagementView = getRequestedVendorManagementTab(requestedManagementTab, canPreviewVendorDirectory);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [viewingVendorId, setViewingVendorId] = useState<number | null>(null);
  const [detailInitialTab, setDetailInitialTab] = useState<"overview" | "messages" | "files">("overview");
  const [deletingVendorId, setDeletingVendorId] = useState<number | null>(null);
  const [showSummarize, setShowSummarize] = useState(false);
  const [activeManagementTab, setActiveManagementTab] = useState<VendorManagementTab>(requestedManagementView);
  const [selectedMessageVendorId, setSelectedMessageVendorId] = useState<number | null>(
    requestedManagementView === "messages" && requestedVendorId ? requestedVendorId : null,
  );

  const handleAddVendor = () => {
    if (!profileLoading && !profile) {
      toast({
        title: t("vendors.no_profile_title", "Wedding profile required"),
        description: t("vendors.no_profile_desc", "Please complete your wedding profile setup on the Dashboard before adding vendors."),
        variant: "destructive",
      });
      return;
    }
    setShowAddDialog(true);
  };

  const deleteMutation = useDeleteVendor({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListVendorsQueryKey() });
        qc.invalidateQueries({ queryKey: vendorContactsQueryKey });
        qc.invalidateQueries({ queryKey: ["vendor-financials"] });
        qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
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

  const toggleContractMutation = useUpdateVendor({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListVendorsQueryKey() });
        qc.invalidateQueries({ queryKey: ["vendor-financials"] });
        qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: t("vendors.contract_status_updated", { defaultValue: "Contract status updated" }) });
      },
      onError: () => toast({ title: t("vendors.failed_update"), variant: "destructive" }),
    },
  });

  const handleSetContractStatus = (vendor: Vendor, contractSigned: boolean) => {
    if (vendor.contractSigned === contractSigned) return;
    toggleContractMutation.mutate({
      id: vendor.id,
      data: { contractSigned } as never,
    });
  };

  const totalCost = vendors.reduce((s, v) => s + v.totalCost, 0);
  const totalDeposit = vendors.reduce((s, v) => s + v.depositAmount, 0);
  const paidOut = vendorFinancials?.totalPaid ?? totalDeposit;
  const signedCount = vendors.filter((v) => v.contractSigned).length;

  useEffect(() => {
    if (isLoading || !requestedVendorId) return;
    if (requestedManagementTab === "messages") {
      setSelectedMessageVendorId(requestedVendorId);
      return;
    }
    setDetailInitialTab(
      requestedTab === "messages" || requestedTab === "files"
        ? requestedTab
        : "overview"
    );
    setViewingVendorId(requestedVendorId);
    setLocation("/vendors", { replace: true });
  }, [isLoading, requestedManagementTab, requestedVendorId, requestedTab, setLocation]);

  useEffect(() => {
    setActiveManagementTab(requestedManagementView);
  }, [requestedManagementView]);

  const handleManagementTabChange = (value: string) => {
    const nextTab = value as VendorManagementTab;
    const allowedTab = nextTab === "directory" && !canPreviewVendorDirectory ? "vendors" : nextTab;
    setActiveManagementTab(allowedTab);
    setLocation(
      allowedTab === "vendors" ? "/vendors?management=vendors" : `/vendors?management=${allowedTab}`,
      { replace: true },
    );
  };

  const openVendorHubMessages = (vendorId: number) => {
    setSelectedMessageVendorId(vendorId);
    setActiveManagementTab("messages");
    setLocation(`/vendors?management=messages&vendorId=${vendorId}`, { replace: true });
  };

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
        {activeManagementTab === "vendors" && (
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
              onClick={handleAddVendor}
              data-testid="btn-add-vendor"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              {t("vendors.add_vendor")}
            </Button>
          </div>
        )}
      </div>

      <Tabs value={activeManagementTab} onValueChange={handleManagementTabChange}>
        <TabsList>
          <TabsTrigger value="vendors">{t("vendors.tab_vendors", { defaultValue: "Vendor List" })}</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          {canPreviewVendorDirectory && (
            <TabsTrigger value="directory">Partner Network</TabsTrigger>
          )}
          <TabsTrigger value="contacts">{t("vendors.tab_contacts", { defaultValue: "Contacts" })}</TabsTrigger>
        </TabsList>

        <TabsContent value="vendors" className="space-y-6 mt-4">
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
              <Button onClick={handleAddVendor} data-testid="btn-add-first-vendor">
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
                  onClick={() => {
                    setDetailInitialTab("overview");
                    setViewingVendorId(vendor.id);
                  }}
                  onEdit={() => setEditingVendor(vendor)}
                  onDelete={() => setDeletingVendorId(vendor.id)}
                  onViewBudget={() => setLocation("/budget/summary")}
                  onSetContractStatus={(contractSigned) => handleSetContractStatus(vendor, contractSigned)}
                  isContractUpdating={toggleContractMutation.isPending}
                />
              ))}
              <button
                onClick={handleAddVendor}
                className="border-2 border-dashed border-border/60 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 hover:border-primary/30 hover:bg-primary/5 transition-all text-muted-foreground hover:text-primary min-h-[160px]"
                data-testid="btn-add-vendor-card"
              >
                <Plus className="h-6 w-6" />
                <span className="text-sm font-medium">{t("vendors.add_vendor_card")}</span>
              </button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="messages" className="mt-4">
          <VendorMessagesErrorBoundary resetKey={`hub-${selectedMessageVendorId ?? "none"}`}>
            <VendorHubMessagesTab
              initialVendorId={selectedMessageVendorId}
              onSelectVendor={(vendorId) => {
                setSelectedMessageVendorId(vendorId);
                setLocation(`/vendors?management=messages&vendorId=${vendorId}`, { replace: true });
              }}
            />
          </VendorMessagesErrorBoundary>
        </TabsContent>

        <TabsContent value="contacts" className="mt-4">
          <VendorContactsTab />
        </TabsContent>
        {canPreviewVendorDirectory && (
          <TabsContent value="directory" className="mt-4">
            <VendorDirectoryTab
              onOpenVendorMessages={openVendorHubMessages}
            />
          </TabsContent>
        )}
      </Tabs>

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
          initialTab={detailInitialTab}
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
        <SummarizeEmailDialog open onClose={() => setShowSummarize(false)} />
      )}
    </div>
  );
}
