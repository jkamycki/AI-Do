import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Mail,
  BadgeDollarSign,
  BarChart3,
  Clock,
  AlertCircle,
  CheckCircle2,
  Eye,
  Trash2,
  Shield,
  RotateCcw,
  FileDown,
  Inbox,
  Loader2,
  Ticket,
  Send,
  Store,
  Users,
  Wrench,
} from "lucide-react";
import MessagesSection from "@/components/admin/MessagesSection";
import { MaintenanceNotice } from "@/components/MaintenanceNotice";

type WorkflowMilestone = {
  key: string;
  label: string;
  completed: boolean;
};

type WorkflowProgressUser = {
  userId: string;
  profileId: number;
  displayName: string;
  email: string | null;
  workspaceName: string;
  weddingDate: string | null;
  venue: string | null;
  createdAt: string | null;
  lastActive: string | null;
  status: "completed" | "in_progress" | "not_started";
  progress: number;
  completedCount: number;
  totalMilestones: number;
  lastCompleted: string;
  nextStep: string;
  counts: {
    guests: number;
    targetGuests: number;
    vendors: number;
    documents: number;
    checklistCompleted: number;
    checklistTotal: number;
    budgetItems: number;
    manualExpenses: number;
    vendorPayments: number;
    timelines: number;
    events: number;
  };
  milestones: WorkflowMilestone[];
};

type SignedUpUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  imageUrl: string | null;
  joinedAt: string;
  lastActive: string | null;
  eventCount: number;
  onboarded: boolean;
  hasProfile: boolean;
  hasSharedWorkspace: boolean;
  collaboratorRole: string | null;
  partner1Name: string | null;
  partner2Name: string | null;
  weddingDate: string | null;
  venue: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  sharedWith: Array<{
    profileId: number;
    userId: string | null;
    email: string | null;
    displayName: string;
    role: string;
    direction: "joined" | "shared_to";
    workspaceName: string;
    acceptedAt: string | null;
  }>;
};

type AdminUsersResponse = {
  users: SignedUpUser[];
  activeUsers?: SignedUpUser[];
  deletedUsers?: SignedUpUser[];
  total: number;
  summary?: {
    signedUp: number;
    active: number;
    onboarded: number;
    createdProfile: number;
    sharedWorkspace: number;
    deleted: number;
  };
};

type AdminMetricsResponse = {
  userMetrics: {
    totalUsers: number;
    dau: number;
    wau: number;
    mau: number;
    newToday: number;
    newThisWeek: number;
    newThisMonth: number;
    totalSignups: number;
    onboardedUsers: number;
    onboardingCompletionRate: number;
  };
  userGrowth?: Array<{ date: string; count: number }>;
  userGrowthSource?: "clerk" | string;
  pageViews: {
    today: number;
    week: number;
    total: number;
  };
  growthTracking: {
    acquisitionSources: Array<{ source: string; visits: number; visitors: number }>;
    landingPages: Array<{ path: string; visits: number; visitors: number }>;
    funnel: Array<{ step: string; count: number; rate: number }>;
    featureUsage: Array<{ feature: string; events: number; users: number }>;
    dropOffs: Array<{ stage: string; count: number; note: string }>;
    feedback: {
      contactMessages: { total: number; unread: number; unresolved: number; last30: number };
      feedbackMessages: { total: number; unread: number; unresolved: number; last30: number; averageRating: number | null };
      recent: Array<{
        id: number;
        rating: number | null;
        category: string | null;
        message: string;
        isResolved: boolean;
        createdAt: string;
      }>;
    };
  };
};

type ArchiveEntry = {
  id: number;
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  deletedAt: string;
  restoredAt: string | null;
  restoredToUserId: string | null;
};

type VendorPartnerApplication = {
  id: number;
  businessName: string;
  contactName: string;
  email: string;
  phone: string | null;
  category: string;
  serviceArea: string;
  website: string | null;
  instagram: string | null;
  startingPrice: string | null;
  description: string | null;
  about?: string | null;
  services?: string[];
  businessLogo?: { name: string; type: string; dataUrl: string } | null;
  servicePhotos?: Array<{ name: string; type: string; dataUrl: string }>;
  directoryListing?: VendorDirectoryListingDraft | Record<string, unknown>;
  directoryStatus?: "not_created" | "draft" | "published" | "unpublished" | string;
  directoryPublishedAt?: string | null;
  status: "new" | "reviewing" | "approved" | "declined" | string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  replies?: Array<{
    id: number;
    applicationId: number;
    direction: "outbound" | "inbound";
    body: string;
    senderUserId: string | null;
    senderEmail: string | null;
    senderName: string | null;
    createdAt: string;
  }>;
};

type VendorDirectoryListingDraft = {
  about: string;
  category: string;
  contactName: string;
  email: string;
  fit: string;
  gallery: string[];
  id: string;
  instagram: string;
  location: string;
  logoUrl: string;
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

function vendorDirectorySlug(application: Pick<VendorPartnerApplication, "id" | "businessName">) {
  const slug = application.businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${slug || "vendor"}-${application.id}`;
}

function parseVendorPrice(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
  if (!value) return 0;
  const numeric = Number(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : 0;
}

function buildVendorDirectoryDraft(application: VendorPartnerApplication): VendorDirectoryListingDraft {
  const existing = application.directoryListing && typeof application.directoryListing === "object"
    ? application.directoryListing as Partial<VendorDirectoryListingDraft>
    : {};
  const fallbackGallery = (application.servicePhotos ?? [])
    .map(photo => photo.dataUrl)
    .filter(Boolean)
    .slice(0, 4);
  const category = application.category || "Wedding Vendor";
  const location = application.serviceArea || "Service area available on request";
  const services = Array.isArray(application.services) && application.services.length
    ? application.services.filter(Boolean).slice(0, 10)
    : [`${category} services`, "Wedding consultation", "Custom quote"];
  const about = application.about || application.description || `${application.businessName} is an A.I DO partner serving ${location}.`;
  return {
    about: existing.about || about,
    category: existing.category || category,
    contactName: existing.contactName || application.contactName,
    email: existing.email || application.email,
    fit: existing.fit || application.description?.slice(0, 180) || about.slice(0, 180) || `${category} partner serving ${location}.`,
    gallery: Array.isArray(existing.gallery) && existing.gallery.length ? existing.gallery : fallbackGallery,
    id: existing.id || vendorDirectorySlug(application),
    instagram: existing.instagram || application.instagram || "",
    location: existing.location || location,
    logoUrl: existing.logoUrl || application.businessLogo?.dataUrl || "",
    logoLabel: existing.logoLabel || application.businessName,
    name: existing.name || application.businessName,
    phone: existing.phone || application.phone || "",
    price: parseVendorPrice(existing.price ?? application.startingPrice),
    reviews: Number.isFinite(existing.reviews) ? Number(existing.reviews) : 0,
    rating: existing.rating || "New",
    responseTime: existing.responseTime || "Replies after inquiry",
    services: Array.isArray(existing.services) && existing.services.length
      ? existing.services
      : services,
    tags: Array.isArray(existing.tags) && existing.tags.length
      ? existing.tags
      : [category, location, "A.I DO Partner"],
    website: existing.website || application.website || "",
  };
}

function listToTextarea(value: string[]) {
  return value.join("\n");
}

function textareaToList(value: string) {
  return value.split("\n").map(item => item.trim()).filter(Boolean);
}

type ArchiveSummary = {
  archiveType: string;
  profile: boolean;
  guests: number;
  rsvps: number;
  websiteRsvps: number;
  analyticsEvents: number;
  vendors: number;
  timelines: number;
  checklistItems: number;
  budgets: boolean;
  budgetItems: number;
  vendorContracts: number;
  weddingParty: number;
  seatingCharts: number;
  hotelBlocks: number;
  manualExpenses: number;
};

type MaintenanceSection =
  | "guest-collector"
  | "rsvp"
  | "save-the-date"
  | "wedding-website"
  | "public-guest-experience"
  | "portal-dashboard"
  | "portal-profile"
  | "portal-mood-board"
  | "portal-timeline"
  | "portal-checklist"
  | "portal-vendors"
  | "portal-budget"
  | "portal-documents"
  | "portal-guests"
  | "portal-wedding-party"
  | "portal-seating-chart"
  | "portal-hotels"
  | "portal-aria"
  | "portal-day-of"
  | "portal-website-editor"
  | "portal-experience";

type MaintenanceFlag = {
  section: MaintenanceSection;
  enabled: boolean;
  configuredEnabled: boolean;
  message: string;
  expiresAt: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
};

function nameFromEmail(email: string | null): string {
  const local = (email ?? "").split("@")[0] ?? "";
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\d+/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function getSignedUpUserDisplayName(user: SignedUpUser): string {
  const clerkName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  if (clerkName) return clerkName;
  return nameFromEmail(user.email) || user.email || user.id;
}

function workspaceSharingText(share: SignedUpUser["sharedWith"][number]): string {
  const relatedName = share.displayName || share.email || "Unknown user";
  return share.direction === "joined"
    ? `Joined ${relatedName}'s workspace as ${share.role}`
    : `Shared with ${relatedName} as ${share.role}`;
}

const maintenanceSections: Array<{
  section: MaintenanceSection;
  label: string;
  description: string;
  group: "Portal Tabs" | "Public Guest Links";
}> = [
  {
    section: "portal-dashboard",
    label: "Dashboard",
    description: "Blocks the dashboard tab for non-admin users.",
    group: "Portal Tabs",
  },
  {
    section: "portal-profile",
    label: "Wedding Profile",
    description: "Blocks the wedding profile tab for non-admin users.",
    group: "Portal Tabs",
  },
  {
    section: "portal-mood-board",
    label: "Mood Board",
    description: "Blocks the mood board tab for non-admin users.",
    group: "Portal Tabs",
  },
  {
    section: "portal-timeline",
    label: "Timeline",
    description: "Blocks the timeline tab for non-admin users.",
    group: "Portal Tabs",
  },
  {
    section: "portal-checklist",
    label: "Checklist",
    description: "Blocks the checklist tab for non-admin users.",
    group: "Portal Tabs",
  },
  {
    section: "portal-vendors",
    label: "Vendor Tracking",
    description: "Blocks vendor tracking for non-admin users.",
    group: "Portal Tabs",
  },
  {
    section: "portal-budget",
    label: "Budget & Payments",
    description: "Blocks budget and payment planning for non-admin users.",
    group: "Portal Tabs",
  },
  {
    section: "portal-documents",
    label: "Document Library",
    description: "Blocks the document library for non-admin users.",
    group: "Portal Tabs",
  },
  {
    section: "portal-guests",
    label: "Guest List & Invitations",
    description: "Blocks the guest list and invitation studio for non-admin users.",
    group: "Portal Tabs",
  },
  {
    section: "portal-wedding-party",
    label: "Wedding Party",
    description: "Blocks the wedding party tab for non-admin users.",
    group: "Portal Tabs",
  },
  {
    section: "portal-seating-chart",
    label: "Seating Chart",
    description: "Blocks the seating chart tab for non-admin users.",
    group: "Portal Tabs",
  },
  {
    section: "portal-hotels",
    label: "Hotel Blocks",
    description: "Blocks the hotel blocks tab for non-admin users.",
    group: "Portal Tabs",
  },
  {
    section: "portal-aria",
    label: "Aria — Planner AI",
    description: "Blocks Aria Planner AI for non-admin users.",
    group: "Portal Tabs",
  },
  {
    section: "portal-day-of",
    label: "Day-Of Coordinator",
    description: "Blocks the day-of coordinator tab for non-admin users.",
    group: "Portal Tabs",
  },
  {
    section: "portal-website-editor",
    label: "Website Editor",
    description: "Blocks the website editor for non-admin users.",
    group: "Portal Tabs",
  },
  {
    section: "portal-experience",
    label: "All Portal Tabs",
    description: "Blocks all maintenance-covered portal tabs for non-admin users.",
    group: "Portal Tabs",
  },
  {
    section: "guest-collector",
    label: "Guest Collector",
    description: "Blocks the public contact-info collection form.",
    group: "Public Guest Links",
  },
  {
    section: "rsvp",
    label: "RSVP Invitations",
    description: "Blocks RSVP links and shared RSVP guest search/submission.",
    group: "Public Guest Links",
  },
  {
    section: "save-the-date",
    label: "Save the Date",
    description: "Blocks public save-the-date invitation pages.",
    group: "Public Guest Links",
  },
  {
    section: "wedding-website",
    label: "Wedding Website",
    description: "Blocks published wedding websites and website RSVP actions.",
    group: "Public Guest Links",
  },
  {
    section: "public-guest-experience",
    label: "All Public Guest Pages",
    description: "Blocks every public guest-facing page covered by maintenance mode.",
    group: "Public Guest Links",
  },
];

const defaultMaintenanceMessage =
  "This experience is temporarily unavailable. Please check back soon.";

function archiveSummary(archivedData: Record<string, unknown>): ArchiveSummary {
  const count = (key: string) => Array.isArray(archivedData[key]) ? (archivedData[key] as unknown[]).length : 0;
  const guestRows = Array.isArray(archivedData.guests) ? archivedData.guests as Array<Record<string, unknown>> : [];
  return {
    archiveType: String(archivedData.archiveType ?? "user"),
    profile: !!archivedData.profile,
    guests: guestRows.length,
    rsvps: guestRows.filter((guest) => typeof guest.rsvpStatus === "string" && guest.rsvpStatus !== "pending").length,
    websiteRsvps: count("websiteRsvps"),
    analyticsEvents: count("analyticsEvents"),
    vendors: count("vendors"),
    timelines: count("timelines"),
    checklistItems: count("checklistItems"),
    budgets: count("budgets") > 0,
    budgetItems: count("budgetItems"),
    vendorContracts: count("vendorContracts"),
    weddingParty: count("weddingParty"),
    seatingCharts: count("seatingCharts"),
    hotelBlocks: count("hotelBlocks"),
    manualExpenses: count("manualExpenses"),
  };
}

export default function OperationsCenterPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [expandedTicketIds, setExpandedTicketIds] = useState<Set<number | string>>(new Set());
  const [activeTab, setActiveTab] = useState<"tickets" | "email" | "messages" | "tracking" | "vendorIntake" | "users" | "recovery" | "workflow" | "pricing" | "maintenance">("tickets");
  const [activeMailbox, setActiveMailbox] = useState<"partners" | "support">("partners");
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMailbox, setComposeMailbox] = useState<"partners" | "support">("partners");
  const [composeForm, setComposeForm] = useState({ to: "", subject: "", message: "" });
  const [workflowFilter, setWorkflowFilter] = useState<"all" | "completed" | "in_progress" | "not_started">("all");
  const [userSearch, setUserSearch] = useState("");
  const [userToDelete, setUserToDelete] = useState<SignedUpUser | null>(null);
  const [expandedArchiveId, setExpandedArchiveId] = useState<number | null>(null);
  const [archiveDetails, setArchiveDetails] = useState<Record<number, Record<string, unknown>>>({});
  const [archiveDetailLoadingId, setArchiveDetailLoadingId] = useState<number | null>(null);
  const [restoreArchiveId, setRestoreArchiveId] = useState<number | null>(null);
  const [restoreUserId, setRestoreUserId] = useState("");
  const [vendorReplyOpenId, setVendorReplyOpenId] = useState<number | null>(null);
  const [vendorReplyText, setVendorReplyText] = useState<Record<number, string>>({});
  const [vendorDirectoryEditorId, setVendorDirectoryEditorId] = useState<number | null>(null);
  const [vendorDirectoryDrafts, setVendorDirectoryDrafts] = useState<Record<number, VendorDirectoryListingDraft>>({});
  const [vendorIntakeFilter, setVendorIntakeFilter] = useState<"all" | "new" | "reviewing" | "approved" | "declined" | "published">("all");
  const [followUpForm, setFollowUpForm] = useState({
    followUpEmail: "",
    followUpNotes: "",
  });

  const authedFetch = async (url: string, init: any = {}) => {
    const token = await getToken();
    return fetch(url, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  };

  const { data: adminCheck, isLoading: isLoadingAdminCheck } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["admin-check"],
    queryFn: async () => {
      const r = await authedFetch("/api/admin/check");
      if (!r.ok) return { isAdmin: false };
      return r.json();
    },
    enabled: isLoaded && !!isSignedIn,
    staleTime: 30_000,
    retry: false,
  });
  const isAdmin = adminCheck?.isAdmin === true;

  const { data: ticketsData, isLoading, error: ticketsError } = useQuery<{ tickets: unknown[] }, Error>({
    queryKey: ["support-tickets"],
    queryFn: async () => {
      const r = await authedFetch("/api/help/support-tickets");
      if (!r.ok) {
        // Surface the real error so the page can explain why no tickets show.
        // 403 = signed-in user isn't on OWNER_EMAILS; anything else is server.
        let serverMessage = "";
        try { serverMessage = (await r.json())?.error ?? ""; } catch { /* ignore */ }
        throw new Error(
          r.status === 403
            ? `Access denied (403): only emails on the OWNER list can view tickets. Signed in as the right account?`
            : `Failed to fetch tickets (${r.status})${serverMessage ? `: ${serverMessage}` : ""}`,
        );
      }
      return r.json();
    },
    enabled: isAdmin,
  });

  const { data: messagesData } = useQuery<{ contacts: { isRead: boolean; isResolved: boolean }[]; unreadCount: number }>({
    queryKey: ["admin-messages"],
    queryFn: async () => {
      const r = await authedFetch("/api/help/messages");
      if (!r.ok) throw new Error("Failed to fetch messages");
      return r.json();
    },
    enabled: isAdmin,
    refetchInterval: isAdmin ? 30000 : false,
  });
  const unreadMessageCount = messagesData?.unreadCount ?? 0;

  const { data: vendorApplicationsData, isLoading: isLoadingVendorApplications } = useQuery<{ applications: VendorPartnerApplication[] }>({
    queryKey: ["admin-vendor-partner-applications"],
    queryFn: async () => {
      const r = await authedFetch("/api/admin/vendor-partner-applications");
      if (!r.ok) throw new Error("Failed to fetch vendor partner applications");
      return r.json();
    },
    enabled: isAdmin && (activeTab === "vendorIntake" || activeTab === "email"),
    refetchInterval: isAdmin && (activeTab === "vendorIntake" || activeTab === "email") ? 30000 : false,
  });
  const vendorApplications = vendorApplicationsData?.applications ?? [];
  const newVendorApplicationCount = vendorApplications.filter(application => application.status === "new").length;
  const vendorIntakeCounts = {
    total: vendorApplications.length,
    new: vendorApplications.filter(application => application.status === "new").length,
    reviewing: vendorApplications.filter(application => application.status === "reviewing").length,
    approved: vendorApplications.filter(application => application.status === "approved").length,
    declined: vendorApplications.filter(application => application.status === "declined").length,
    published: vendorApplications.filter(application => application.directoryStatus === "published").length,
  };
  const filteredVendorApplications = vendorApplications.filter(application => {
    if (vendorIntakeFilter === "all") return true;
    if (vendorIntakeFilter === "published") return application.directoryStatus === "published";
    return application.status === vendorIntakeFilter;
  });

  const updateVendorApplicationMutation = useMutation({
    mutationFn: async ({ id, notes, status }: { id: number; notes?: string; status: string }) => {
      const r = await authedFetch(`/api/admin/vendor-partner-applications/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ notes, status }),
      });
      if (!r.ok) throw new Error("Failed to update vendor application");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-vendor-partner-applications"] });
      toast({ title: "Vendor application updated" });
    },
    onError: () => {
      toast({ title: "Vendor application could not be updated", variant: "destructive" });
    },
  });

  const replyVendorApplicationMutation = useMutation({
    mutationFn: async ({ id, replyText }: { id: number; replyText: string }) => {
      const r = await authedFetch(`/api/admin/vendor-partner-applications/${id}/reply`, {
        method: "POST",
        body: JSON.stringify({ replyText }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error ?? "Failed to send vendor reply");
      return body;
    },
    onSuccess: (_data, variables) => {
      setVendorReplyOpenId(null);
      setVendorReplyText(current => ({ ...current, [variables.id]: "" }));
      queryClient.invalidateQueries({ queryKey: ["admin-vendor-partner-applications"] });
      toast({ title: "Vendor reply sent" });
    },
    onError: (error) => {
      toast({
        title: "Vendor reply could not be sent",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const composeEmailMutation = useMutation({
    mutationFn: async (payload: { mailbox: "partners" | "support"; to: string; subject: string; message: string }) => {
      const r = await authedFetch("/api/admin/email/compose", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error ?? "Failed to send email");
      return body;
    },
    onSuccess: () => {
      toast({ title: "Email sent" });
      setComposeOpen(false);
      setComposeForm({ to: "", subject: "", message: "" });
    },
    onError: (error) => {
      toast({
        title: "Email could not be sent",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteVendorApplicationMutation = useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      const r = await authedFetch(`/api/admin/vendor-partner-applications/${id}`, {
        method: "DELETE",
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error ?? "Failed to delete vendor application");
      return body;
    },
    onSuccess: (_data, variables) => {
      setVendorReplyOpenId(current => current === variables.id ? null : current);
      setVendorDirectoryEditorId(current => current === variables.id ? null : current);
      setVendorDirectoryDrafts(current => {
        const next = { ...current };
        delete next[variables.id];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["admin-vendor-partner-applications"] });
      toast({ title: "Vendor intake deleted" });
    },
    onError: (error) => {
      toast({
        title: "Vendor intake could not be deleted",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateVendorDirectoryListingMutation = useMutation({
    mutationFn: async ({
      id,
      directoryListing,
      directoryStatus,
    }: {
      id: number;
      directoryListing: VendorDirectoryListingDraft;
      directoryStatus: "draft" | "published" | "unpublished";
    }) => {
      const r = await authedFetch(`/api/admin/vendor-partner-applications/${id}/directory-listing`, {
        method: "PATCH",
        body: JSON.stringify({ directoryListing, directoryStatus }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error ?? "Failed to update directory listing");
      return body;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-vendor-partner-applications"] });
      queryClient.invalidateQueries({ queryKey: ["published-vendor-partner-directory"] });
      toast({
        title: variables.directoryStatus === "published"
          ? "Partner listing published"
          : variables.directoryStatus === "unpublished"
            ? "Partner listing unpublished"
            : "Directory draft saved",
      });
    },
    onError: (error) => {
      toast({
        title: "Directory listing could not be saved",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const { data: signedUpUsersData, isLoading: isLoadingSignedUpUsers } = useQuery<AdminUsersResponse>({
    queryKey: ["admin-signed-up-users", userSearch],
    queryFn: async () => {
      const params = userSearch.trim() ? `?search=${encodeURIComponent(userSearch.trim())}` : "";
      const r = await authedFetch(`/api/admin/users${params}`);
      if (!r.ok) throw new Error("Failed to fetch signed-up users");
      return r.json();
    },
    enabled: isAdmin && activeTab === "users",
    refetchInterval: isAdmin && activeTab === "users" ? 15000 : false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const { data: maintenanceData, isLoading: isLoadingMaintenance } = useQuery<{
    flags: MaintenanceFlag[];
    defaultMessage: string;
  }>({
    queryKey: ["admin-maintenance"],
    queryFn: async () => {
      const r = await authedFetch("/api/admin/maintenance");
      if (!r.ok) throw new Error("Failed to fetch maintenance settings");
      return r.json();
    },
    enabled: isAdmin && activeTab === "maintenance",
    refetchInterval: isAdmin && activeTab === "maintenance" ? 15000 : false,
  });

  const { data: pricingData, isLoading: isLoadingPricing } = useQuery<{
    enabled: boolean;
    updatedAt: string | null;
    updatedBy: string | null;
  }>({
    queryKey: ["admin-pricing"],
    queryFn: async () => {
      const r = await authedFetch("/api/admin/pricing");
      if (!r.ok) throw new Error("Failed to fetch pricing settings");
      return r.json();
    },
    enabled: isAdmin && activeTab === "pricing",
  });

  const { data: metricsData, isLoading: isLoadingMetrics } = useQuery<AdminMetricsResponse>({
    queryKey: ["admin-metrics"],
    queryFn: async () => {
      const r = await authedFetch("/api/admin/metrics");
      if (!r.ok) throw new Error("Failed to fetch growth metrics");
      return r.json();
    },
    enabled: isAdmin && activeTab === "tracking",
    refetchInterval: isAdmin && activeTab === "tracking" ? 30000 : false,
  });

  const maintenanceMutation = useMutation({
    mutationFn: async ({
      section,
      enabled,
      message,
      minutes,
    }: {
      section: MaintenanceSection;
      enabled: boolean;
      message: string;
      minutes?: number | null;
    }) => {
      const expiresAt = enabled && minutes
        ? new Date(Date.now() + minutes * 60_000).toISOString()
        : null;
      const r = await authedFetch(`/api/admin/maintenance/${section}`, {
        method: "PUT",
        body: JSON.stringify({ enabled, message, expiresAt }),
      });
      if (!r.ok) throw new Error("Failed to save maintenance setting");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-maintenance"] });
      toast({ title: "Maintenance setting updated" });
    },
    onError: () => {
      toast({ title: "Maintenance setting could not be saved", variant: "destructive" });
    },
  });

  const pricingMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const r = await authedFetch("/api/admin/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!r.ok) throw new Error("Failed to save pricing setting");
      return r.json() as Promise<{ enabled: boolean; updatedAt: string | null; updatedBy: string | null }>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["admin-pricing"], data);
      toast({ title: data.enabled ? "Launch pricing is visible" : "Launch pricing is hidden" });
    },
    onError: () => {
      toast({ title: "Pricing setting could not be saved", variant: "destructive" });
    },
  });
  const signedUpUsers = signedUpUsersData?.activeUsers ?? signedUpUsersData?.users?.filter(user => !user.isDeleted) ?? [];
  const deletedSignedUpUsers = signedUpUsersData?.deletedUsers ?? signedUpUsersData?.users?.filter(user => user.isDeleted) ?? [];
  const accountUsers = (() => {
    const byIdentity = new Map<string, SignedUpUser>();
    for (const user of [...signedUpUsers, ...deletedSignedUpUsers]) {
      const key = user.email?.trim().toLowerCase() || user.id;
      const current = byIdentity.get(key);
      if (!current || (current.isDeleted && !user.isDeleted)) {
        byIdentity.set(key, user);
      }
    }
    return Array.from(byIdentity.values()).sort((a, b) => {
      const aTime = new Date(a.deletedAt ?? a.joinedAt).getTime();
      const bTime = new Date(b.deletedAt ?? b.joinedAt).getTime();
      return bTime - aTime;
    });
  })();

  const { data: archiveData, isLoading: isLoadingArchive } = useQuery<{ archives: ArchiveEntry[] }>({
    queryKey: ["admin-archive"],
    queryFn: async () => {
      const r = await authedFetch("/api/admin/archive");
      if (!r.ok) throw new Error("Failed to load recovery archive");
      return r.json();
    },
    enabled: isAdmin && activeTab === "recovery",
    refetchInterval: isAdmin && activeTab === "recovery" ? 30000 : false,
  });
  const archiveRows = archiveData?.archives ?? [];
  const openArchiveCount = archiveRows.filter(entry => !entry.restoredAt).length;

  const loadArchiveDetail = async (archiveId: number) => {
    if (archiveDetails[archiveId]) return;
    setArchiveDetailLoadingId(archiveId);
    try {
      const r = await authedFetch(`/api/admin/archive/${archiveId}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Failed to load archive detail");
      const archivedData = (j.archive?.archivedData ?? {}) as Record<string, unknown>;
      setArchiveDetails(current => ({ ...current, [archiveId]: archivedData }));
    } catch (error) {
      toast({
        title: "Could not load archive",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setArchiveDetailLoadingId(null);
    }
  };

  const restoreArchiveMutation = useMutation({
    mutationFn: async ({ archiveId, newUserId }: { archiveId: number; newUserId: string }) => {
      const r = await authedFetch(`/api/admin/archive/${archiveId}/restore`, {
        method: "POST",
        body: JSON.stringify({ newUserId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Restore failed");
      return j as { ok: boolean; restored: Record<string, number> };
    },
    onSuccess: (result) => {
      toast({
        title: "Archive restored",
        description: Object.entries(result.restored ?? {}).map(([key, value]) => `${value} ${key}`).join(", "),
      });
      setRestoreArchiveId(null);
      setRestoreUserId("");
      queryClient.invalidateQueries({ queryKey: ["admin-archive"] });
      queryClient.invalidateQueries({ queryKey: ["admin-signed-up-users"] });
    },
    onError: (error) => {
      toast({
        title: "Restore failed",
        description: error instanceof Error ? error.message : "Please check the target Clerk user ID.",
        variant: "destructive",
      });
    },
  });

  const exportArchiveJson = (entry: ArchiveEntry, archivedData: Record<string, unknown>) => {
    const blob = new Blob([JSON.stringify({ ...entry, archivedData }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aido-recovery-${entry.userId}-${entry.deletedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteUserMutation = useMutation({
    mutationFn: async (user: SignedUpUser) => {
      const r = await authedFetch(`/api/admin/users/${encodeURIComponent(user.id)}`, { method: "DELETE" });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to delete user");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "User deleted", description: "The account and workspace data were archived and removed." });
      setUserToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["admin-signed-up-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-workflow-progress"] });
      queryClient.invalidateQueries({ queryKey: ["admin-archive"] });
    },
    onError: (error) => {
      toast({
        title: "Could not delete user",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const { data: workflowData, isLoading: isLoadingWorkflow } = useQuery<{
    users: WorkflowProgressUser[];
    summary: { total: number; completed: number; inProgress: number; notStarted: number };
  }>({
    queryKey: ["admin-workflow-progress"],
    queryFn: async () => {
      const r = await authedFetch("/api/admin/workflow-progress");
      if (!r.ok) throw new Error("Failed to fetch workflow progress");
      return r.json();
    },
    enabled: isAdmin && activeTab === "workflow",
    refetchInterval: isAdmin && activeTab === "workflow" ? 30000 : false,
  });
  const workflowUsers = workflowData?.users ?? [];
  const filteredWorkflowUsers = workflowFilter === "all"
    ? workflowUsers
    : workflowUsers.filter(user => user.status === workflowFilter);

  const lastSeenUnread = useRef<number | null>(null);
  useEffect(() => {
    if (lastSeenUnread.current === null) {
      lastSeenUnread.current = unreadMessageCount;
      return;
    }
    if (unreadMessageCount > lastSeenUnread.current) {
      const delta = unreadMessageCount - lastSeenUnread.current;
      toast({
        title: delta === 1 ? "New message" : `${delta} new messages`,
        description: "Operations Center → Messages & Feedback",
      });
    }
    lastSeenUnread.current = unreadMessageCount;
  }, [unreadMessageCount, toast]);

  const followUpMutation = useMutation({
    mutationFn: async (ticketId: number) => {
      const r = await authedFetch(`/api/help/support-tickets/${ticketId}/follow-up`, {
        method: "PATCH",
        body: JSON.stringify(followUpForm),
      });
      if (!r.ok) throw new Error("Failed to send follow-up");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Follow-up sent successfully!" });
      setSelectedTicket(null);
      setFollowUpForm({ followUpEmail: "", followUpNotes: "" });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
    onError: () => {
      toast({ title: "Failed to send follow-up", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (ticketId: number) => {
      const r = await authedFetch(`/api/help/support-tickets/${ticketId}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Failed to delete ticket");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Ticket deleted." });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
    onError: () => {
      toast({ title: "Failed to delete ticket", variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: number; status: string }) => {
      const r = await authedFetch(`/api/help/support-tickets/${ticketId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error("Failed to update status");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Status updated!" });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
  });

  const tickets = ticketsData?.tickets ?? [];
  const filteredTickets = filterStatus === "all"
    ? tickets
    : tickets.filter((t: any) => t.status === filterStatus);
  const emailPartnerThreads = [...vendorApplications].sort((a, b) => {
    const aLast = a.replies?.at(-1)?.createdAt ?? a.updatedAt ?? a.createdAt;
    const bLast = b.replies?.at(-1)?.createdAt ?? b.updatedAt ?? b.createdAt;
    return new Date(bLast).getTime() - new Date(aLast).getTime();
  });
  const emailSupportThreads = [...tickets].sort((a: any, b: any) =>
    new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
  );
  const openSupportThreadCount = tickets.filter((ticket: any) => ticket.status !== "resolved" && ticket.status !== "closed").length;
  const composeFromAddress = composeMailbox === "partners" ? "partners@aidowedding.net" : "support@aidowedding.net";
  const canSendComposeEmail =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(composeForm.to.trim()) &&
    composeForm.subject.trim().length > 0 &&
    composeForm.message.trim().length > 0;
  const openCompose = (
    mailbox: "partners" | "support",
    draft: Partial<typeof composeForm> = {},
  ) => {
    setActiveMailbox(mailbox);
    setComposeMailbox(mailbox);
    setComposeOpen(true);
    setComposeForm({
      to: draft.to ?? "",
      subject: draft.subject ?? "",
      message: draft.message ?? "",
    });
  };

  const stats = {
    total: tickets.length,
    open: tickets.filter((t: any) => t.status === "open").length,
    inProgress: tickets.filter((t: any) => t.status === "in_progress").length,
    resolved: tickets.filter((t: any) => t.status === "resolved").length,
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      urgent: "bg-red-100 text-red-800",
      high: "bg-red-100 text-red-800",
      medium: "bg-yellow-100 text-yellow-800",
      low: "bg-green-100 text-green-800",
    };
    return colors[priority] || colors.medium;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open":
        return <AlertCircle className="h-4 w-4 text-blue-600" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-amber-600" />;
      case "resolved":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      default:
        return <Eye className="h-4 w-4" />;
    }
  };

  if (!isLoaded || isLoadingAdminCheck) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 text-[#24171D]">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!isSignedIn || !isAdmin) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-[#E8C9D4] bg-white p-6 text-[#24171D] shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-[#F8E7EE] p-2 text-[#8D294D]">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#24171D]">Operations Center access only</h1>
            <p className="mt-2 text-sm leading-6 text-[#4A3941]">
              This area is only available to approved A.I DO admin accounts. Sign in with an owner account to manage
              support, pricing, vendor intake, tracking, users, and maintenance settings.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto text-[#24171D]">
      <Dialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-[#4A3941]">
            <p>
              This archives the user's workspace data, removes their planning records, and deletes the Clerk account when it still exists.
            </p>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
              <p className="font-semibold">{userToDelete ? getSignedUpUserDisplayName(userToDelete) : ""}</p>
              <p>{userToDelete?.email ?? userToDelete?.id}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setUserToDelete(null)} disabled={deleteUserMutation.isPending}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => userToDelete && deleteUserMutation.mutate(userToDelete)}
                disabled={!userToDelete || userToDelete.isDeleted || deleteUserMutation.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {deleteUserMutation.isPending ? "Deleting..." : userToDelete?.isDeleted ? "Already deleted" : "Delete user"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div>
        <h1 className="text-3xl font-serif font-bold text-[#24171D]">Operations Center</h1>
        <p className="mt-1 text-sm font-medium text-[#4A3941]">Support tickets, contact messages, and feedback in one place</p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border pb-px">
        <button
          onClick={() => setActiveTab("tickets")}
          className={`flex shrink-0 items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
            ${activeTab === "tickets" ? "border-primary text-[#5B0F2A]" : "border-transparent text-[#4A3941] hover:text-[#24171D]"}`}
        >
          <Ticket className="h-4 w-4" />
          Support Tickets
        </button>
        <button
          onClick={() => setActiveTab("email")}
          className={`flex shrink-0 items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
            ${activeTab === "email" ? "border-primary text-[#5B0F2A]" : "border-transparent text-[#4A3941] hover:text-[#24171D]"}`}
        >
          <Mail className="h-4 w-4" />
          Email
          {newVendorApplicationCount + openSupportThreadCount > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-white">
              {newVendorApplicationCount + openSupportThreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("messages")}
          className={`flex shrink-0 items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
            ${activeTab === "messages" ? "border-primary text-[#5B0F2A]" : "border-transparent text-[#4A3941] hover:text-[#24171D]"}`}
        >
          <Inbox className="h-4 w-4" />
          Messages & Feedback
          {unreadMessageCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-600 text-white text-xs font-bold">
              {unreadMessageCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("tracking")}
          className={`flex shrink-0 items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
            ${activeTab === "tracking" ? "border-primary text-[#5B0F2A]" : "border-transparent text-[#4A3941] hover:text-[#24171D]"}`}
        >
          <BarChart3 className="h-4 w-4" />
          Growth Tracking
        </button>
        <button
          onClick={() => setActiveTab("vendorIntake")}
          className={`flex shrink-0 items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
            ${activeTab === "vendorIntake" ? "border-primary text-[#5B0F2A]" : "border-transparent text-[#4A3941] hover:text-[#24171D]"}`}
        >
          <Store className="h-4 w-4" />
          Vendor Intake
          {newVendorApplicationCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-white text-xs font-bold">
              {newVendorApplicationCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`flex shrink-0 items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
            ${activeTab === "users" ? "border-primary text-[#5B0F2A]" : "border-transparent text-[#4A3941] hover:text-[#24171D]"}`}
        >
          <Users className="h-4 w-4" />
          Users & Sharing
        </button>
        <button
          onClick={() => setActiveTab("recovery")}
          className={`flex shrink-0 items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
            ${activeTab === "recovery" ? "border-primary text-[#5B0F2A]" : "border-transparent text-[#4A3941] hover:text-[#24171D]"}`}
        >
          <Shield className="h-4 w-4" />
          Recovery Center
          {openArchiveCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-600 text-white text-xs font-bold">
              {openArchiveCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("workflow")}
          className={`flex shrink-0 items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
            ${activeTab === "workflow" ? "border-primary text-[#5B0F2A]" : "border-transparent text-[#4A3941] hover:text-[#24171D]"}`}
        >
          <Users className="h-4 w-4" />
          User Workflow Progress
        </button>
        <button
          onClick={() => setActiveTab("pricing")}
          className={`flex shrink-0 items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
            ${activeTab === "pricing" ? "border-primary text-[#5B0F2A]" : "border-transparent text-[#4A3941] hover:text-[#24171D]"}`}
        >
          <BadgeDollarSign className="h-4 w-4" />
          Pricing
        </button>
        <button
          onClick={() => setActiveTab("maintenance")}
          className={`flex shrink-0 items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
            ${activeTab === "maintenance" ? "border-primary text-[#5B0F2A]" : "border-transparent text-[#4A3941] hover:text-[#24171D]"}`}
        >
          <Wrench className="h-4 w-4" />
          Maintenance Mode
        </button>
      </div>

      {activeTab === "email" && (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-serif font-semibold text-[#24171D]">Email</h2>
              <p className="text-sm font-medium text-[#4A3941]">
                Keep partner and support conversations organized while email sending is being connected.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="inline-flex rounded-full border border-[#E6C7D2] bg-[#FFF8F4] p-1">
                <button
                  type="button"
                  onClick={() => setActiveMailbox("partners")}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    activeMailbox === "partners" ? "bg-primary text-white shadow-sm" : "text-[#6F3E54] hover:bg-white"
                  }`}
                >
                  Partners
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMailbox("support")}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    activeMailbox === "support" ? "bg-primary text-white shadow-sm" : "text-[#6F3E54] hover:bg-white"
                  }`}
                >
                  Support
                </button>
              </div>
              <Button type="button" onClick={() => openCompose(activeMailbox)} className="gap-2">
                <Send className="h-4 w-4" />
                Compose
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Card className={activeMailbox === "partners" ? "border-primary/40 bg-[#FFF8FA]" : ""}>
              <CardContent className="flex items-start justify-between gap-3 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8D294D]/70">Partners mailbox</p>
                  <p className="mt-1 font-serif text-xl font-semibold text-[#24171D]">partners@aidowedding.net</p>
                  <p className="mt-1 text-sm font-medium text-[#6F3E54]">{emailPartnerThreads.length} vendor conversation{emailPartnerThreads.length === 1 ? "" : "s"}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => openCompose("partners")}>
                  Compose
                </Button>
              </CardContent>
            </Card>
            <Card className={activeMailbox === "support" ? "border-primary/40 bg-[#FFF8FA]" : ""}>
              <CardContent className="flex items-start justify-between gap-3 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8D294D]/70">Support mailbox</p>
                  <p className="mt-1 font-serif text-xl font-semibold text-[#24171D]">support@aidowedding.net</p>
                  <p className="mt-1 text-sm font-medium text-[#6F3E54]">{openSupportThreadCount} open support thread{openSupportThreadCount === 1 ? "" : "s"}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => openCompose("support")}>
                  Compose
                </Button>
              </CardContent>
            </Card>
          </div>

          {composeOpen && (
            <Card className="border-primary/30 bg-[#FFF8FA]">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="font-serif text-lg text-[#24171D]">Compose Message</CardTitle>
                    <p className="mt-1 text-sm font-medium text-[#6F3E54]">
                      Sending from {composeMailbox === "partners" ? "Partners" : "Support"} with replies directed to {composeFromAddress}.
                    </p>
                  </div>
                  <div className="inline-flex rounded-full border border-[#E6C7D2] bg-white p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setComposeMailbox("partners");
                        setActiveMailbox("partners");
                      }}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                        composeMailbox === "partners" ? "bg-primary text-white" : "text-[#6F3E54] hover:bg-[#FFF8F4]"
                      }`}
                    >
                      Partners
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setComposeMailbox("support");
                        setActiveMailbox("support");
                      }}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                        composeMailbox === "support" ? "bg-primary text-white" : "text-[#6F3E54] hover:bg-[#FFF8F4]"
                      }`}
                    >
                      Support
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-[1fr_1.4fr]">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-[0.14em] text-[#8D294D]/70">To</label>
                    <Input
                      type="email"
                      value={composeForm.to}
                      onChange={(event) => setComposeForm(current => ({ ...current, to: event.target.value }))}
                      placeholder="name@example.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-[0.14em] text-[#8D294D]/70">Subject</label>
                    <Input
                      value={composeForm.subject}
                      onChange={(event) => setComposeForm(current => ({ ...current, subject: event.target.value }))}
                      placeholder={composeMailbox === "partners" ? "A.I DO Founding Vendor Partner Program" : "A.I DO Support"}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-[0.14em] text-[#8D294D]/70">Message</label>
                  <Textarea
                    value={composeForm.message}
                    onChange={(event) => setComposeForm(current => ({ ...current, message: event.target.value }))}
                    placeholder="Write your message here..."
                    className="min-h-[180px]"
                  />
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setComposeOpen(false);
                      setComposeForm({ to: "", subject: "", message: "" });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    className="gap-2"
                    disabled={!canSendComposeEmail || composeEmailMutation.isPending}
                    onClick={() => composeEmailMutation.mutate({
                      mailbox: composeMailbox,
                      to: composeForm.to.trim(),
                      subject: composeForm.subject.trim(),
                      message: composeForm.message.trim(),
                    })}
                  >
                    {composeEmailMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Send Email
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg text-[#24171D]">
                {activeMailbox === "partners" ? "Partner Conversations" : "Support Conversations"}
              </CardTitle>
              <p className="text-sm font-medium text-[#4A3941]">
                {activeMailbox === "partners"
                  ? "Vendor applications and partner replies that should live under partners@aidowedding.net."
                  : "Support tickets and follow-ups that should live under support@aidowedding.net."}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeMailbox === "partners" ? (
                isLoadingVendorApplications ? (
                  [1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)
                ) : emailPartnerThreads.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#E6C7D2] bg-[#FFF8F4] p-8 text-center">
                    <Store className="mx-auto h-9 w-9 text-[#8D294D]/60" />
                    <p className="mt-3 font-semibold text-[#24171D]">No partner messages yet</p>
                    <p className="mt-1 text-sm text-[#6F3E54]">Vendor applications will appear here first.</p>
                  </div>
                ) : (
                  emailPartnerThreads.map(application => {
                    const latestReply = application.replies?.[application.replies.length - 1];
                    return (
                      <div key={application.id} className="rounded-xl border border-[#E6C7D2] bg-white p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate font-serif text-xl font-semibold text-[#24171D]">{application.businessName}</p>
                              <Badge variant="outline" className="border-[#E6C7D2] bg-[#FFF8F4] text-[#6F3E54]">{application.status}</Badge>
                            </div>
                            <p className="mt-1 text-sm font-medium text-[#4A3941]">
                              {application.contactName} · {application.email}
                            </p>
                            <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#24171D]">
                              {latestReply?.body || application.description || "Vendor partner application received. No thread replies yet."}
                            </p>
                            <p className="mt-2 text-xs font-medium text-[#6F3E54]">
                              Last activity {new Date(latestReply?.createdAt ?? application.updatedAt ?? application.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            className="shrink-0"
                            onClick={() => {
                              setVendorIntakeFilter("all");
                              setActiveTab("vendorIntake");
                              setVendorReplyOpenId(application.id);
                            }}
                          >
                            Open thread
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )
              ) : isLoading ? (
                [1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)
              ) : ticketsError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
                  {ticketsError.message}
                </div>
              ) : emailSupportThreads.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#E6C7D2] bg-[#FFF8F4] p-8 text-center">
                  <Ticket className="mx-auto h-9 w-9 text-[#8D294D]/60" />
                  <p className="mt-3 font-semibold text-[#24171D]">No support messages yet</p>
                  <p className="mt-1 text-sm text-[#6F3E54]">Support tickets will appear here when couples or users need help.</p>
                </div>
              ) : (
                emailSupportThreads.map((ticket: any) => (
                  <div key={ticket.id} className="rounded-xl border border-[#E6C7D2] bg-white p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {getStatusIcon(ticket.status)}
                          <p className="truncate font-serif text-xl font-semibold text-[#24171D]">{ticket.subject}</p>
                          <Badge variant="outline" className="border-[#E6C7D2] bg-[#FFF8F4] text-[#6F3E54]">{ticket.status}</Badge>
                        </div>
                        <p className="mt-1 text-sm font-medium text-[#4A3941]">
                          {ticket.name} · {ticket.email}
                        </p>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#24171D]">{ticket.message}</p>
                        <p className="mt-2 text-xs font-medium text-[#6F3E54]">
                          {ticket.ticketNumber ? `${ticket.ticketNumber} · ` : ""}{new Date(ticket.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => {
                          setFilterStatus("all");
                          setActiveTab("tickets");
                          setExpandedTicketIds(prev => new Set(prev).add(ticket.id));
                        }}
                      >
                        Open thread
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "tracking" && (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-serif font-semibold text-[#24171D]">Growth Tracking</h2>
            <p className="text-sm font-medium text-[#4A3941]">
              Track signups by source, landing visits, profile setup conversion, feature usage, drop-off, and feedback.
            </p>
          </div>

          {isLoadingMetrics ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: "Landing visits", value: metricsData?.pageViews.week ?? 0, detail: "Last 7 days" },
                  { label: "Signups", value: metricsData?.userMetrics.newThisMonth ?? 0, detail: "Clerk accounts this month" },
                  { label: "Profile setup", value: `${metricsData?.userMetrics.onboardingCompletionRate ?? 0}%`, detail: `${metricsData?.userMetrics.onboardedUsers ?? 0} completed` },
                  {
                    label: "Feedback",
                    value: (metricsData?.growthTracking.feedback.contactMessages.last30 ?? 0) + (metricsData?.growthTracking.feedback.feedbackMessages.last30 ?? 0),
                    detail: "Last 30 days",
                  },
                ].map(item => (
                  <Card key={item.label}>
                    <CardContent className="py-4">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#7A5062]">{item.label}</p>
                      <p className="mt-2 text-3xl font-bold text-[#24171D]">{item.value}</p>
                      <p className="mt-1 text-sm font-medium text-[#6F3E54]">{item.detail}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-serif text-lg text-[#24171D]">Conversion Funnel</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(metricsData?.growthTracking.funnel ?? []).map(item => (
                      <div key={item.step}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-[#24171D]">{item.step}</p>
                          <p className="text-sm font-bold text-[#8D294D]">{item.count.toLocaleString()} / {item.rate}%</p>
                        </div>
                        <Progress value={Math.min(item.rate, 100)} />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="font-serif text-lg text-[#24171D]">Drop-Off Watchlist</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(metricsData?.growthTracking.dropOffs ?? []).map(item => (
                      <div key={item.stage} className="rounded-lg border border-[#E6C7D2] bg-[#FFF8FA] p-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold text-[#24171D]">{item.stage}</p>
                          <Badge className="bg-[#6F3E54] text-white">{item.count}</Badge>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-[#6F3E54]">{item.note}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-serif text-lg text-[#24171D]">Signups & Visits By Source</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(metricsData?.growthTracking.acquisitionSources ?? []).length === 0 ? (
                      <p className="text-sm font-medium text-[#6F3E54]">No source data yet. UTM/referrer tracking starts on new visits.</p>
                    ) : (
                      metricsData?.growthTracking.acquisitionSources.map(item => (
                        <div key={item.source} className="flex items-center justify-between gap-3 rounded-lg border border-[#E6C7D2] bg-white p-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#24171D]">{item.source}</p>
                            <p className="text-xs font-medium text-[#6F3E54]">{item.visitors.toLocaleString()} visitors</p>
                          </div>
                          <p className="text-sm font-bold text-[#8D294D]">{item.visits.toLocaleString()} visits</p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="font-serif text-lg text-[#24171D]">Landing Page Visits</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(metricsData?.growthTracking.landingPages ?? []).length === 0 ? (
                      <p className="text-sm font-medium text-[#6F3E54]">No landing page visits tracked yet.</p>
                    ) : (
                      metricsData?.growthTracking.landingPages.map(item => (
                        <div key={item.path} className="flex items-center justify-between gap-3 rounded-lg border border-[#E6C7D2] bg-white p-3">
                          <div className="min-w-0">
                            <p className="truncate font-mono text-sm font-semibold text-[#24171D]">{item.path}</p>
                            <p className="text-xs font-medium text-[#6F3E54]">{item.visitors.toLocaleString()} visitors</p>
                          </div>
                          <p className="text-sm font-bold text-[#8D294D]">{item.visits.toLocaleString()} visits</p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-serif text-lg text-[#24171D]">Feature Usage</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(metricsData?.growthTracking.featureUsage ?? []).length === 0 ? (
                      <p className="text-sm font-medium text-[#6F3E54]">No tracked feature usage yet.</p>
                    ) : (
                      metricsData?.growthTracking.featureUsage.map(item => (
                        <div key={item.feature} className="rounded-lg border border-[#E6C7D2] bg-white p-3">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <p className="truncate text-sm font-semibold text-[#24171D]">{item.feature}</p>
                            <p className="text-xs font-bold uppercase tracking-wide text-[#7A5062]">{item.users} users</p>
                          </div>
                          <Progress value={Math.min(item.events, 100)} />
                          <p className="mt-2 text-xs font-medium text-[#6F3E54]">{item.events.toLocaleString()} events in the last 30 days</p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="font-serif text-lg text-[#24171D]">Feedback Messages</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-[#E6C7D2] bg-[#FFF8FA] p-3">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#7A5062]">Contact</p>
                        <p className="mt-2 text-2xl font-bold text-[#24171D]">{metricsData?.growthTracking.feedback.contactMessages.total ?? 0}</p>
                        <p className="text-xs font-medium text-[#6F3E54]">{metricsData?.growthTracking.feedback.contactMessages.unresolved ?? 0} unresolved</p>
                      </div>
                      <div className="rounded-lg border border-[#E6C7D2] bg-[#FFF8FA] p-3">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#7A5062]">Feedback</p>
                        <p className="mt-2 text-2xl font-bold text-[#24171D]">{metricsData?.growthTracking.feedback.feedbackMessages.total ?? 0}</p>
                        <p className="text-xs font-medium text-[#6F3E54]">
                          Avg rating {metricsData?.growthTracking.feedback.feedbackMessages.averageRating ?? "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {(metricsData?.growthTracking.feedback.recent ?? []).length === 0 ? (
                        <p className="text-sm font-medium text-[#6F3E54]">No recent feedback yet.</p>
                      ) : (
                        metricsData?.growthTracking.feedback.recent.map(item => (
                          <div key={item.id} className="rounded-lg border border-[#E6C7D2] bg-white p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs font-bold uppercase tracking-wide text-[#7A5062]">{item.category || "Feedback"}</p>
                              <Badge className={item.isResolved ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>
                                {item.isResolved ? "Resolved" : "Open"}
                              </Badge>
                            </div>
                            <p className="mt-2 line-clamp-2 text-sm leading-5 text-[#4A3941]">{item.message}</p>
                            <p className="mt-2 text-xs font-medium text-[#6F3E54]">{new Date(item.createdAt).toLocaleString()}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "pricing" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-xl text-[#24171D]">Launch Pricing</CardTitle>
              <p className="text-sm font-medium text-[#4A3941]">
                Control whether the public website and app show the first-launch couple pricing packages.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {isLoadingPricing ? (
                <Skeleton className="h-36 rounded-xl" />
              ) : (
                <div className={`rounded-xl border p-5 ${pricingData?.enabled ? "border-primary/40 bg-primary/5" : "border-[#E6C7D2] bg-[#F8EEDB]"}`}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[#24171D]">Show pricing to couples</p>
                        <Badge className={pricingData?.enabled ? "bg-primary text-primary-foreground" : "bg-[#6F3E54] text-white"}>
                          {pricingData?.enabled ? "Visible" : "Hidden"}
                        </Badge>
                      </div>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6F3E54]">
                        When enabled, couples see launch pricing: Free, A.I DO Complete Monthly for $9/month, and A.I DO Complete One-Time for $99 per wedding.
                        When disabled, pricing is hidden and the site keeps using the free beta messaging.
                      </p>
                      {pricingData?.updatedAt && (
                        <p className="mt-2 text-xs font-medium text-[#7A5062]">
                          Last updated {new Date(pricingData.updatedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <Switch
                      checked={pricingData?.enabled === true}
                      disabled={pricingMutation.isPending}
                      onCheckedChange={(checked) => pricingMutation.mutate(checked)}
                      aria-label="Toggle launch pricing visibility"
                    />
                  </div>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-[#E6C7D2] bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#B16C8E]">Free</p>
                  <p className="mt-2 font-serif text-3xl text-[#8D294D]">$0</p>
                  <p className="mt-2 text-sm leading-6 text-[#6F3E54]">
                    Website, A.I DO URL, basic RSVP, guest list, checklist, budget, travel, registry, photo QR, limited AI, and A.I DO branding.
                  </p>
                </div>
                <div className="rounded-xl border border-primary/35 bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#B16C8E]">A.I DO Complete Monthly</p>
                  <p className="mt-2 font-serif text-3xl text-[#8D294D]">$9/mo</p>
                  <p className="mt-2 text-sm leading-6 text-[#6F3E54]">
                    Same Complete features with a softer monthly entry while couples are actively planning.
                  </p>
                </div>
                <div className="rounded-xl border border-primary/40 bg-primary p-4 text-white">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/80">A.I DO Complete One-Time</p>
                  <p className="mt-2 font-serif text-3xl">$99</p>
                  <p className="mt-2 text-sm leading-6 text-white/88">
                    One-time per wedding with premium designs, no branding, advanced RSVP, seating, vendors, invitations, contract AI, day-of tools, photo upgrades, collaboration, and priority support.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg text-[#24171D]">Launch Note</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-[#6F3E54]">
              <p>
                Keep this hidden until payment links, plan limits, and upgrade messaging are ready. Turning it on only changes public pricing visibility.
              </p>
              <p className="font-semibold text-[#24171D]">
                Recommended first launch: Free + $9/month Complete + $99 one-time Complete.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "maintenance" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-xl text-[#24171D]">Maintenance Mode</CardTitle>
              <p className="text-sm font-medium text-[#4A3941]">
                Temporarily block public pages or portal tabs while you debug. Signed-in admins can keep working in the portal.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoadingMaintenance ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
                </div>
              ) : (
                maintenanceSections.map((item, index) => {
                  const flag = maintenanceData?.flags.find(row => row.section === item.section);
                  const enabled = !!flag?.enabled;
                  const message = flag?.message || maintenanceData?.defaultMessage || defaultMaintenanceMessage;
                  const showGroupHeader = index === 0 || maintenanceSections[index - 1]?.group !== item.group;
                  const expiresAtMs = flag?.expiresAt ? new Date(flag.expiresAt).getTime() : null;
                  const remainingMinutes = expiresAtMs
                    ? Math.max(1, Math.ceil((expiresAtMs - Date.now()) / 60000))
                    : null;
                  const autoOffValue = !remainingMinutes
                    ? "none"
                    : remainingMinutes <= 30
                      ? "30"
                      : remainingMinutes <= 60
                        ? "60"
                        : "120";
                  return (
                    <div key={item.section} className="space-y-2">
                      {showGroupHeader && (
                        <p className="pt-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                          {item.group}
                        </p>
                      )}
                      <div className={`rounded-xl border p-4 ${enabled ? "border-primary/40 bg-primary/5" : "border-[#E6C7D2] bg-[#F8EEDB]"}`}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-[#24171D]">{item.label}</p>
                              {enabled && <Badge className="bg-primary text-primary-foreground">Active</Badge>}
                            </div>
                            <p className="mt-1 text-sm text-[#6F3E54]">{item.description}</p>
                            {flag?.expiresAt && (
                              <p className="mt-1 text-xs font-medium text-[#7A5062]">
                                Auto-off: {new Date(flag.expiresAt).toLocaleString()}
                              </p>
                            )}
                          </div>
                          <Switch
                            checked={enabled}
                            disabled={maintenanceMutation.isPending}
                            onCheckedChange={(checked) => maintenanceMutation.mutate({
                              section: item.section,
                              enabled: checked,
                              message,
                              minutes: checked ? 60 : null,
                            })}
                            aria-label={`Toggle ${item.label} maintenance`}
                          />
                        </div>
                        <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_140px]">
                          <Input
                            value={message}
                            onChange={(event) => {
                              queryClient.setQueryData<{ flags: MaintenanceFlag[]; defaultMessage: string }>(["admin-maintenance"], current => {
                                if (!current) return current;
                                return {
                                  ...current,
                                  flags: current.flags.map(row => row.section === item.section ? { ...row, message: event.target.value } : row),
                                };
                              });
                            }}
                            onBlur={(event) => maintenanceMutation.mutate({
                              section: item.section,
                              enabled,
                              message: event.target.value.trim() || defaultMaintenanceMessage,
                              minutes: remainingMinutes && enabled ? remainingMinutes : null,
                            })}
                            className="bg-white"
                            placeholder={defaultMaintenanceMessage}
                          />
                          <Select
                            value={autoOffValue}
                            onValueChange={(value) => maintenanceMutation.mutate({
                              section: item.section,
                              enabled,
                              message,
                              minutes: value === "none" ? null : Number(value),
                            })}
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Auto-off" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No auto-off</SelectItem>
                              <SelectItem value="30">30 minutes</SelectItem>
                              <SelectItem value="60">1 hour</SelectItem>
                              <SelectItem value="120">2 hours</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <div className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-lg text-[#24171D]">Guest Preview</CardTitle>
              </CardHeader>
              <CardContent className="overflow-hidden rounded-xl border border-[#E6C7D2] p-0">
                <div className="scale-[0.58] origin-top-left w-[172%] h-[580px] pointer-events-none">
                  <MaintenanceNotice
                    preview
                    message={maintenanceData?.flags.find(row => row.enabled)?.message || defaultMaintenanceMessage}
                  />
                </div>
              </CardContent>
            </Card>
            <p className="text-xs font-medium leading-relaxed text-[#6F3E54]">
              Admins bypass portal-tab maintenance so you can debug the real page. Public invitation and website submissions are blocked with a 503 while their maintenance switches are active.
            </p>
          </div>
        </div>
      )}

      {activeTab === "messages" && (
        <MessagesSection
          title="Messages & Feedback"
          description="Contact requests (including emails to support@aidowedding.net) and user feedback."
        />
      )}

      {activeTab === "vendorIntake" && (
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-xl text-[#24171D]">Vendor Intake</CardTitle>
              <p className="text-sm font-medium text-[#4A3941]">
                Applications submitted from the public vendor partner form. Use this as the review queue before adding vendors to the directory.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                {[
                  { key: "all" as const, label: "Total", value: vendorIntakeCounts.total },
                  { key: "new" as const, label: "New", value: vendorIntakeCounts.new },
                  { key: "reviewing" as const, label: "Reviewing", value: vendorIntakeCounts.reviewing },
                  { key: "approved" as const, label: "Approved", value: vendorIntakeCounts.approved },
                  { key: "declined" as const, label: "Not approved", value: vendorIntakeCounts.declined },
                  { key: "published" as const, label: "Published", value: vendorIntakeCounts.published },
                ].map(item => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setVendorIntakeFilter(item.key)}
                    className={`rounded-lg border p-4 text-left transition ${
                      vendorIntakeFilter === item.key
                        ? "border-[#8D294D] bg-[#F7DDE2]/70 shadow-sm"
                        : "border-[#E6D2D8] bg-[#FFF8F4] hover:border-[#B16C8E]"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#8D294D]/70">{item.label}</p>
                    <p className="mt-1 text-2xl font-serif font-bold text-[#24171D]">{item.value}</p>
                  </button>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#8D294D]/70">Showing</span>
                <Badge variant="outline" className="border-[#E6D2D8] bg-white text-[#6F3E54]">
                  {vendorIntakeFilter === "all"
                    ? "All intake"
                    : vendorIntakeFilter === "declined"
                      ? "Not approved"
                      : vendorIntakeFilter === "published"
                        ? "Published directory listings"
                        : vendorIntakeFilter}
                </Badge>
                {vendorIntakeFilter !== "all" && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setVendorIntakeFilter("all")}>
                    Clear filter
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {isLoadingVendorApplications ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-44 rounded-lg" />)}
            </div>
          ) : vendorApplications.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Store className="mx-auto h-10 w-10 text-[#8D294D]/60" />
                <h2 className="mt-3 font-serif text-xl font-semibold text-[#24171D]">No vendor applications yet</h2>
                <p className="mt-1 text-sm text-[#4A3941]">When vendors fill out the website intake form, they will show up here.</p>
              </CardContent>
            </Card>
          ) : filteredVendorApplications.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Store className="mx-auto h-10 w-10 text-[#8D294D]/60" />
                <h2 className="mt-3 font-serif text-xl font-semibold text-[#24171D]">No vendors in this bucket</h2>
                <p className="mt-1 text-sm text-[#4A3941]">Choose another intake status or clear the filter.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredVendorApplications.map(application => {
                const statusClass =
                  application.status === "approved"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : application.status === "declined"
                      ? "bg-red-50 text-red-700 border-red-200"
                      : application.status === "reviewing"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-primary/10 text-primary border-primary/20";
                const directoryDraft = vendorDirectoryDrafts[application.id] ?? buildVendorDirectoryDraft(application);
                const directoryStatus = application.directoryStatus || "not_created";
                const directoryStatusClass =
                  directoryStatus === "published"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : directoryStatus === "draft"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : directoryStatus === "unpublished"
                        ? "border-slate-200 bg-slate-50 text-slate-700"
                        : "border-[#E6D2D8] bg-[#FFF8F4] text-[#6F3E54]";
                return (
                  <Card key={application.id}>
                    <CardContent className="space-y-4 pt-6">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="font-serif text-2xl font-semibold text-[#24171D]">{application.businessName}</h2>
                            <Badge className={`border ${statusClass}`}>
                              {application.status === "declined" ? "not approved" : application.status}
                            </Badge>
                            <Badge variant="outline" className={`border ${directoryStatusClass}`}>
                              Directory: {directoryStatus.replace("_", " ")}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm font-medium text-[#4A3941]">
                            {application.category} | {application.serviceArea}
                          </p>
                          <p className="mt-1 text-xs text-[#4A3941]/70">
                            Submitted {new Date(application.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                          <Select
                            value={application.status}
                            onValueChange={status => updateVendorApplicationMutation.mutate({
                              id: application.id,
                              notes: application.notes ?? "",
                              status,
                            })}
                          >
                            <SelectTrigger className="w-full lg:w-44">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">New</SelectItem>
                              <SelectItem value="reviewing">Reviewing</SelectItem>
                              <SelectItem value="approved">Approved</SelectItem>
                              <SelectItem value="declined">Not approved</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="outline"
                            className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                            disabled={deleteVendorApplicationMutation.isPending || directoryStatus === "published"}
                            onClick={() => {
                              const confirmed = window.confirm(
                                `Delete ${application.businessName} from Vendor Intake? This removes the intake details and response thread.`,
                              );
                              if (confirmed) deleteVendorApplicationMutation.mutate({ id: application.id });
                            }}
                            title={directoryStatus === "published" ? "Unpublish this partner listing before deleting the intake." : "Delete vendor intake"}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-lg border border-[#E6D2D8] p-3">
                          <p className="text-xs font-semibold uppercase text-[#8D294D]/70">Contact</p>
                          <p className="mt-1 text-sm font-semibold text-[#24171D]">{application.contactName}</p>
                          <a className="text-sm text-primary underline-offset-2 hover:underline" href={`mailto:${application.email}`}>{application.email}</a>
                          {application.phone ? <p className="text-sm text-[#4A3941]">{application.phone}</p> : null}
                        </div>
                        <div className="rounded-lg border border-[#E6D2D8] p-3">
                          <p className="text-xs font-semibold uppercase text-[#8D294D]/70">Pricing</p>
                          <p className="mt-1 text-sm text-[#24171D]">{application.startingPrice || "Not provided"}</p>
                        </div>
                        <div className="rounded-lg border border-[#E6D2D8] p-3">
                          <p className="text-xs font-semibold uppercase text-[#8D294D]/70">Website</p>
                          {application.website ? (
                            <a className="break-all text-sm text-primary underline-offset-2 hover:underline" href={application.website} rel="noreferrer" target="_blank">{application.website}</a>
                          ) : <p className="text-sm text-[#4A3941]">Not provided</p>}
                        </div>
                        <div className="rounded-lg border border-[#E6D2D8] p-3">
                          <p className="text-xs font-semibold uppercase text-[#8D294D]/70">Instagram</p>
                          <p className="mt-1 break-all text-sm text-[#24171D]">{application.instagram || "Not provided"}</p>
                        </div>
                      </div>

                      {application.businessLogo ? (
                        <div className="rounded-lg border border-[#E6D2D8] bg-white p-3">
                          <p className="mb-3 text-xs font-semibold uppercase text-[#8D294D]/70">Business logo</p>
                          <div className="flex h-24 w-40 items-center justify-center overflow-hidden rounded-lg border border-[#E6D2D8] bg-[#FFF8F4]">
                            <img
                              src={application.businessLogo.dataUrl}
                              alt={`${application.businessName} logo`}
                              className="h-full w-full object-contain p-3"
                            />
                          </div>
                        </div>
                      ) : null}

                      {application.description ? (
                        <div className="rounded-lg bg-[#FFF8F4] p-4 text-sm leading-6 text-[#4A3941]">
                          <p className="mb-2 text-xs font-semibold uppercase text-[#8D294D]/70">Short profile intro</p>
                          {application.description}
                        </div>
                      ) : null}

                      {application.about ? (
                        <div className="rounded-lg border border-[#E6D2D8] bg-white p-4 text-sm leading-6 text-[#4A3941]">
                          <p className="mb-2 text-xs font-semibold uppercase text-[#8D294D]/70">About Us</p>
                          {application.about}
                        </div>
                      ) : null}

                      {application.services && application.services.length > 0 ? (
                        <div className="rounded-lg border border-[#E6D2D8] bg-white p-4">
                          <p className="mb-3 text-xs font-semibold uppercase text-[#8D294D]/70">Services</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {application.services.map((service, index) => (
                              <div key={`${application.id}-service-${index}`} className="flex gap-2 text-sm text-[#4A3941]">
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#8D294D]" />
                                <span>{service}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {application.servicePhotos && application.servicePhotos.length > 0 ? (
                        <div className="rounded-lg border border-[#E6D2D8] bg-white p-3">
                          <p className="mb-3 text-xs font-semibold uppercase text-[#8D294D]/70">Service photos</p>
                          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                            {application.servicePhotos.map((photo, index) => (
                              <a
                                key={`${application.id}-photo-${index}`}
                                href={photo.dataUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="group aspect-[4/3] overflow-hidden rounded-lg border border-[#E6D2D8] bg-[#FFF8F4]"
                              >
                                <img
                                  src={photo.dataUrl}
                                  alt={photo.name || `${application.businessName} service photo ${index + 1}`}
                                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                />
                              </a>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="rounded-lg border border-[#E6D2D8] bg-white p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="font-serif text-lg font-semibold text-[#24171D]">Partner Network listing</p>
                            <p className="text-sm text-[#4A3941]">
                              Build the user-facing directory profile from this intake, edit each section, then publish it to the website Partner Network.
                            </p>
                            {application.directoryPublishedAt ? (
                              <p className="mt-1 text-xs font-medium text-[#6F3E54]">
                                Published {new Date(application.directoryPublishedAt).toLocaleString()}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2"
                              onClick={() => {
                                const draft = buildVendorDirectoryDraft(application);
                                setVendorDirectoryDrafts(current => ({ ...current, [application.id]: draft }));
                                setVendorDirectoryEditorId(current => current === application.id ? null : application.id);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                              {vendorDirectoryEditorId === application.id ? "Close editor" : "Edit listing"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={updateVendorDirectoryListingMutation.isPending}
                              onClick={() => updateVendorDirectoryListingMutation.mutate({
                                id: application.id,
                                directoryListing: directoryDraft,
                                directoryStatus: "draft",
                              })}
                            >
                              Save draft
                            </Button>
                            <Button
                              size="sm"
                              disabled={updateVendorDirectoryListingMutation.isPending}
                              onClick={() => updateVendorDirectoryListingMutation.mutate({
                                id: application.id,
                                directoryListing: directoryDraft,
                                directoryStatus: "published",
                              })}
                            >
                              Publish
                            </Button>
                            {directoryStatus === "published" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={updateVendorDirectoryListingMutation.isPending}
                                onClick={() => updateVendorDirectoryListingMutation.mutate({
                                  id: application.id,
                                  directoryListing: directoryDraft,
                                  directoryStatus: "unpublished",
                                })}
                              >
                                Unpublish
                              </Button>
                            ) : null}
                          </div>
                        </div>

                        {vendorDirectoryEditorId === application.id && (
                          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                            <div className="space-y-4 rounded-lg border border-[#E6D2D8] bg-[#FFF8F4] p-4">
                              <div className="grid gap-3 md:grid-cols-2">
                                <div>
                                  <p className="mb-1 text-xs font-semibold uppercase text-[#8D294D]/70">Display name</p>
                                  <Input
                                    value={directoryDraft.name}
                                    onChange={event => setVendorDirectoryDrafts(current => ({
                                      ...current,
                                      [application.id]: { ...directoryDraft, name: event.target.value, logoLabel: directoryDraft.logoLabel || event.target.value },
                                    }))}
                                    className="bg-white"
                                  />
                                </div>
                                <div>
                                  <p className="mb-1 text-xs font-semibold uppercase text-[#8D294D]/70">Logo label</p>
                                  <Input
                                    value={directoryDraft.logoLabel}
                                    onChange={event => setVendorDirectoryDrafts(current => ({
                                      ...current,
                                      [application.id]: { ...directoryDraft, logoLabel: event.target.value },
                                    }))}
                                    className="bg-white"
                                  />
                                </div>
                                <div>
                                  <p className="mb-1 text-xs font-semibold uppercase text-[#8D294D]/70">Category</p>
                                  <Input
                                    value={directoryDraft.category}
                                    onChange={event => setVendorDirectoryDrafts(current => ({
                                      ...current,
                                      [application.id]: { ...directoryDraft, category: event.target.value },
                                    }))}
                                    className="bg-white"
                                  />
                                </div>
                                <div>
                                  <p className="mb-1 text-xs font-semibold uppercase text-[#8D294D]/70">Service area</p>
                                  <Input
                                    value={directoryDraft.location}
                                    onChange={event => setVendorDirectoryDrafts(current => ({
                                      ...current,
                                      [application.id]: { ...directoryDraft, location: event.target.value },
                                    }))}
                                    className="bg-white"
                                  />
                                </div>
                                <div>
                                  <p className="mb-1 text-xs font-semibold uppercase text-[#8D294D]/70">Starting price</p>
                                  <Input
                                    type="number"
                                    value={directoryDraft.price}
                                    onChange={event => setVendorDirectoryDrafts(current => ({
                                      ...current,
                                      [application.id]: { ...directoryDraft, price: parseVendorPrice(event.target.value) },
                                    }))}
                                    className="bg-white"
                                  />
                                </div>
                                <div>
                                  <p className="mb-1 text-xs font-semibold uppercase text-[#8D294D]/70">Response time</p>
                                  <Input
                                    value={directoryDraft.responseTime}
                                    onChange={event => setVendorDirectoryDrafts(current => ({
                                      ...current,
                                      [application.id]: { ...directoryDraft, responseTime: event.target.value },
                                    }))}
                                    className="bg-white"
                                  />
                                </div>
                              </div>

                              <div>
                                <p className="mb-1 text-xs font-semibold uppercase text-[#8D294D]/70">Short card summary</p>
                                <Textarea
                                  value={directoryDraft.fit}
                                  onChange={event => setVendorDirectoryDrafts(current => ({
                                    ...current,
                                    [application.id]: { ...directoryDraft, fit: event.target.value },
                                  }))}
                                  className="min-h-[90px] bg-white"
                                />
                              </div>
                              <div>
                                <p className="mb-1 text-xs font-semibold uppercase text-[#8D294D]/70">About section</p>
                                <Textarea
                                  value={directoryDraft.about}
                                  onChange={event => setVendorDirectoryDrafts(current => ({
                                    ...current,
                                    [application.id]: { ...directoryDraft, about: event.target.value },
                                  }))}
                                  className="min-h-[120px] bg-white"
                                />
                              </div>
                              <div className="grid gap-3 md:grid-cols-2">
                                <div>
                                  <p className="mb-1 text-xs font-semibold uppercase text-[#8D294D]/70">Services, one per line</p>
                                  <Textarea
                                    value={listToTextarea(directoryDraft.services)}
                                    onChange={event => setVendorDirectoryDrafts(current => ({
                                      ...current,
                                      [application.id]: { ...directoryDraft, services: textareaToList(event.target.value) },
                                    }))}
                                    className="min-h-[130px] bg-white"
                                  />
                                </div>
                                <div>
                                  <p className="mb-1 text-xs font-semibold uppercase text-[#8D294D]/70">Tags, one per line</p>
                                  <Textarea
                                    value={listToTextarea(directoryDraft.tags)}
                                    onChange={event => setVendorDirectoryDrafts(current => ({
                                      ...current,
                                      [application.id]: { ...directoryDraft, tags: textareaToList(event.target.value) },
                                    }))}
                                    className="min-h-[130px] bg-white"
                                  />
                                </div>
                              </div>
                              <div className="grid gap-3 md:grid-cols-2">
                                {(["contactName", "email", "phone", "website", "instagram", "logoUrl"] as const).map(field => (
                                  <div key={field}>
                                    <p className="mb-1 text-xs font-semibold uppercase text-[#8D294D]/70">{field}</p>
                                    <Input
                                      value={String(directoryDraft[field] ?? "")}
                                      onChange={event => setVendorDirectoryDrafts(current => ({
                                        ...current,
                                        [application.id]: { ...directoryDraft, [field]: event.target.value },
                                      }))}
                                      className="bg-white"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-3 rounded-lg border border-[#E6D2D8] bg-white p-4">
                              <p className="text-xs font-semibold uppercase tracking-wider text-[#8D294D]/70">Preview</p>
                              <div className="rounded-xl border border-[#E8C9D4] bg-[#FFF8F4] p-4">
                                <div className="flex h-20 items-center justify-center rounded-lg border border-[#E8C9D4] bg-white px-3 text-center">
                                  {directoryDraft.logoUrl ? (
                                    <img src={directoryDraft.logoUrl} alt={`${directoryDraft.name} logo`} className="h-full w-full object-contain p-2" />
                                  ) : (
                                    <p className="font-serif text-xl text-[#8D294D]">{directoryDraft.logoLabel}</p>
                                  )}
                                </div>
                                <h3 className="mt-3 font-serif text-2xl text-[#24171D]">{directoryDraft.name}</h3>
                                <p className="text-sm font-medium text-[#6F3E54]">{directoryDraft.category} | {directoryDraft.location}</p>
                                <p className="mt-3 text-sm leading-6 text-[#4A3941]">{directoryDraft.fit}</p>
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                  {directoryDraft.tags.slice(0, 4).map(tag => (
                                    <span key={tag} className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{tag}</span>
                                  ))}
                                </div>
                                {directoryDraft.gallery.length > 0 ? (
                                  <div className="mt-3 grid grid-cols-3 gap-2">
                                    {directoryDraft.gallery.slice(0, 3).map((photo, index) => (
                                      <img key={`${application.id}-directory-preview-${index}`} src={photo} alt="" className="aspect-square rounded-lg object-cover" />
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <Textarea
                        defaultValue={application.notes ?? ""}
                        onBlur={event => updateVendorApplicationMutation.mutate({
                          id: application.id,
                          notes: event.target.value,
                          status: application.status,
                        })}
                        placeholder="Internal notes: fit, follow-up, market, badge/referral plan..."
                      />

                      <div className="rounded-lg border border-[#E6D2D8] bg-white p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-serif text-lg font-semibold text-[#24171D]">Response thread</p>
                            <p className="text-sm text-[#4A3941]">
                              Email {application.contactName} and keep the conversation attached to this application.
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2"
                            onClick={() => {
                              setVendorReplyOpenId(current => current === application.id ? null : application.id);
                              setVendorReplyText(current => ({
                                ...current,
                                [application.id]: current[application.id] ?? "",
                              }));
                            }}
                          >
                            <Send className="h-4 w-4" />
                            {vendorReplyOpenId === application.id ? "Cancel reply" : "Reply"}
                          </Button>
                        </div>

                        {application.replies && application.replies.length > 0 ? (
                          <div className="mt-4 space-y-3">
                            {application.replies.map(reply => {
                              const isOutbound = reply.direction === "outbound";
                              return (
                                <div
                                  key={reply.id}
                                  className={`rounded-lg border p-3 ${isOutbound ? "ml-5 border-primary/20 bg-primary/5" : "mr-5 border-[#E6D2D8] bg-[#FFF8F4]"}`}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-[#4A3941]/75">
                                    <span>
                                      {isOutbound
                                        ? `A.I DO replied${reply.senderEmail ? ` (${reply.senderEmail})` : ""}`
                                        : `${reply.senderName || reply.senderEmail || "Vendor"} replied`}
                                    </span>
                                    <span>{new Date(reply.createdAt).toLocaleString()}</span>
                                  </div>
                                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#24171D]">{reply.body}</p>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="mt-4 rounded-lg bg-[#FFF8F4] p-3 text-sm text-[#4A3941]">
                            No replies yet. Send the approval or follow-up email from here so future vendor responses stay attached.
                          </p>
                        )}

                        {vendorReplyOpenId === application.id && (
                          <div className="mt-4 space-y-3 rounded-lg border border-primary/20 bg-[#FFF8F4] p-3">
                            <p className="text-xs font-semibold uppercase tracking-wider text-[#8D294D]/70">
                              To {application.email}
                            </p>
                            <Textarea
                              value={vendorReplyText[application.id] ?? ""}
                              onChange={event => setVendorReplyText(current => ({ ...current, [application.id]: event.target.value }))}
                              placeholder="Write your vendor approval, follow-up, or question..."
                              className="min-h-[150px] bg-white"
                            />
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                onClick={() => setVendorReplyOpenId(null)}
                                disabled={replyVendorApplicationMutation.isPending}
                              >
                                Cancel
                              </Button>
                              <Button
                                className="gap-2"
                                onClick={() => replyVendorApplicationMutation.mutate({
                                  id: application.id,
                                  replyText: vendorReplyText[application.id] ?? "",
                                })}
                                disabled={replyVendorApplicationMutation.isPending || !(vendorReplyText[application.id] ?? "").trim()}
                              >
                                {replyVendorApplicationMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                Send email
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "users" && (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-serif font-semibold text-[#24171D]">Users & Workspace Sharing</h2>
              <p className="text-sm font-medium text-[#4A3941]">
                Every Clerk account appears once with its current Active or Inactive status, workspace ownership, and sharing details. Refreshes automatically while open.
              </p>
            </div>
            <div className="w-full lg:w-80">
              <Input
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Search name, email, or workspace"
                className="bg-white"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {[
              { label: "Signed up", value: signedUpUsersData?.summary?.signedUp ?? signedUpUsersData?.total ?? 0 },
              { label: "Active", value: signedUpUsersData?.summary?.active ?? signedUpUsers.length },
              { label: "Inactive", value: signedUpUsersData?.summary?.deleted ?? deletedSignedUpUsers.length },
              { label: "Onboarded", value: signedUpUsersData?.summary?.onboarded ?? signedUpUsers.filter(user => user.onboarded).length },
              { label: "Created profile", value: signedUpUsersData?.summary?.createdProfile ?? signedUpUsers.filter(user => user.hasProfile).length },
              { label: "Shared workspace", value: signedUpUsersData?.summary?.sharedWorkspace ?? signedUpUsers.filter(user => user.hasSharedWorkspace).length },
            ].map(stat => (
              <Card key={stat.label}>
                <CardContent className="py-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#7A5062]">{stat.label}</p>
                  <p className="mt-1 text-2xl font-bold text-[#24171D]">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {isLoadingSignedUpUsers ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}
            </div>
          ) : accountUsers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                <p className="font-medium text-[#4A3941]">No signed-up users found.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-[#7A5062]">Accounts</h3>
                  <Badge variant="outline">{accountUsers.length}</Badge>
                </div>
                {accountUsers.map(user => {
                const displayName = getSignedUpUserDisplayName(user);
                const workspaceName = [user.partner1Name, user.partner2Name].filter(Boolean).join(" & ");
                return (
                  <Card key={`${user.isDeleted ? "inactive" : "active"}-${user.email ?? user.id}`} className={user.isDeleted ? "border-red-200 bg-red-50/30" : undefined}>
                    <CardContent className="py-4">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-[#24171D]">{displayName}</h3>
                            <Badge className={user.isDeleted ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}>
                              {user.isDeleted ? "Inactive" : "Active"}
                            </Badge>
                            <Badge className={user.onboarded ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-800"}>
                              {user.onboarded ? "Onboarded" : "Signed up"}
                            </Badge>
                            {user.hasSharedWorkspace && <Badge variant="outline">Collaborator</Badge>}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-[#4A3941]">
                            <span className="inline-flex items-center gap-1.5">
                              <Mail className="h-3.5 w-3.5" />
                              {user.email || "No email"}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5" />
                              {user.isDeleted && user.deletedAt
                                ? `Inactive since ${new Date(user.deletedAt).toLocaleString()}`
                                : `Joined ${new Date(user.joinedAt).toLocaleString()}`}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-[#7A5062]">
                            {[workspaceName || null, user.venue, user.weddingDate ? `Wedding: ${user.weddingDate}` : null].filter(Boolean).join(" | ") || "No wedding workspace started yet"}
                          </p>
                          <div className="mt-3 rounded-lg border border-[#F0D7E0] bg-white/70 p-3">
                            <p className="text-xs font-bold uppercase tracking-wide text-[#7A5062]">Workspace sharing</p>
                            {user.sharedWith.length > 0 ? (
                              <div className="mt-2 space-y-2">
                                {user.sharedWith.map((share, index) => (
                                  <div key={`${share.profileId}-${share.userId ?? share.email ?? index}`} className="rounded-md bg-[#FFF8FA] px-3 py-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-sm font-semibold text-[#24171D]">{share.workspaceName}</span>
                                      <Badge variant="outline" className="text-[10px]">
                                        {share.direction === "joined" ? "Joined" : "Shared out"}
                                      </Badge>
                                    </div>
                                    <p className="mt-1 text-xs font-medium text-[#4A3941]">
                                      {workspaceSharingText(share)}
                                      {share.email ? ` (${share.email})` : ""}
                                    </p>
                                    {share.acceptedAt && (
                                      <p className="mt-1 text-[11px] text-[#7A5062]">
                                        Accepted {new Date(share.acceptedAt).toLocaleString()}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-2 text-xs font-medium text-[#4A3941]">
                                {user.hasProfile ? "Owns a workspace with no active shared users." : "No workspace sharing yet."}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="rounded-lg border border-[#F0D7E0] bg-[#FFF8FA] px-4 py-3 text-xs font-medium text-[#4A3941] md:w-56">
                          <p><span className="font-semibold text-[#24171D]">Last active:</span> {user.lastActive ? new Date(user.lastActive).toLocaleString() : "Unknown"}</p>
                          <p className="mt-1"><span className="font-semibold text-[#24171D]">Events:</span> {user.eventCount}</p>
                          <p className="mt-1"><span className="font-semibold text-[#24171D]">Profile:</span> {user.hasProfile ? "Yes" : "No"}</p>
                          {user.deletedAt && (
                            <p className="mt-1 text-red-700"><span className="font-semibold">Inactive:</span> {new Date(user.deletedAt).toLocaleString()}</p>
                          )}
                          <Button
                            size="sm"
                            variant={user.isDeleted ? "outline" : "destructive"}
                            className="mt-3 w-full"
                            disabled={user.isDeleted}
                            onClick={() => setUserToDelete(user)}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            {user.isDeleted ? "Inactive account" : "Delete user"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "recovery" && (
        <div className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-serif text-xl text-[#24171D]">
                  <Shield className="h-5 w-5 text-primary" />
                  Recovery Center
                </CardTitle>
                <p className="text-sm font-medium text-[#4A3941]">
                  Deleted accounts are archived before purge so Operations can restore guest lists, RSVP responses, planning records, and tracking events to a new Clerk account.
                </p>
              </CardHeader>
            </Card>
            <Card className="border-amber-200 bg-amber-50/70">
              <CardContent className="py-4">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-900">Restore coverage</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-amber-900">
                  <span className="rounded-md bg-white/70 px-2 py-1">Guest list</span>
                  <span className="rounded-md bg-white/70 px-2 py-1">RSVP details</span>
                  <span className="rounded-md bg-white/70 px-2 py-1">Analytics events</span>
                  <span className="rounded-md bg-white/70 px-2 py-1">Budgets/vendors</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {isLoadingArchive ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}
            </div>
          ) : archiveRows.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Shield className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
                <p className="font-medium text-[#4A3941]">No deleted account archives yet.</p>
                <p className="mt-1 text-sm text-[#7A5062]">When a user is deleted, their recovery snapshot will appear here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {archiveRows.map(entry => {
                const archivedData = archiveDetails[entry.id];
                const summary = archivedData ? archiveSummary(archivedData) : null;
                const isExpanded = expandedArchiveId === entry.id;
                const isRestored = !!entry.restoredAt;
                const displayName = [entry.firstName, entry.lastName].filter(Boolean).join(" ") || entry.email || entry.userId;
                const restoringThis = restoreArchiveId === entry.id;

                return (
                  <Card key={entry.id} className={isRestored ? "border-emerald-200 bg-emerald-50/30" : "border-[#E6C7D2]"}>
                    <CardContent className="py-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-[#24171D]">{displayName}</h3>
                            <Badge className={isRestored ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>
                              {isRestored ? "Restored" : "Recovery snapshot"}
                            </Badge>
                            {summary?.archiveType === "workspace" && <Badge variant="outline">Workstation</Badge>}
                          </div>
                          <p className="mt-1 break-all text-sm font-medium text-[#4A3941]">{entry.email ?? entry.userId}</p>
                          <p className="mt-1 text-xs font-medium text-[#7A5062]">
                            Deleted {new Date(entry.deletedAt).toLocaleString()}
                            {entry.restoredAt ? ` | Restored ${new Date(entry.restoredAt).toLocaleString()}` : ""}
                          </p>

                          {summary && (
                            <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:grid-cols-6">
                              {[
                                { label: "Guests", value: summary.guests },
                                { label: "Guest RSVPs", value: summary.rsvps },
                                { label: "Website RSVPs", value: summary.websiteRsvps },
                                { label: "Tracking", value: summary.analyticsEvents },
                                { label: "Vendors", value: summary.vendors },
                                { label: "Budget items", value: summary.budgetItems },
                                { label: "Hotels", value: summary.hotelBlocks },
                              ].map(item => (
                                <div key={item.label} className="rounded-lg border border-[#F0D7E0] bg-white/75 px-3 py-2">
                                  <p className="text-lg font-bold text-[#9A2E5C]">{item.value}</p>
                                  <p className="font-semibold text-[#7A5062]">{item.label}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {restoringThis && !isRestored && (
                            <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                              <p className="text-sm font-semibold text-primary">Restore this archive to a Clerk user ID</p>
                              <p className="mt-1 text-xs font-medium text-[#6F3E54]">
                                Use the user's new account ID, usually starting with user_. Restore recreates the archived rows under that account.
                              </p>
                              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                <Input
                                  value={restoreUserId}
                                  onChange={(event) => setRestoreUserId(event.target.value)}
                                  placeholder="user_..."
                                  className="bg-white font-mono"
                                />
                                <Button
                                  disabled={!restoreUserId.trim() || restoreArchiveMutation.isPending}
                                  onClick={() => restoreArchiveMutation.mutate({ archiveId: entry.id, newUserId: restoreUserId.trim() })}
                                  className="gap-2 bg-primary hover:bg-primary/90"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                  {restoreArchiveMutation.isPending ? "Restoring..." : "Restore"}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 lg:w-56 lg:flex-col">
                          <Button
                            variant="outline"
                            className="gap-2"
                            onClick={async () => {
                              const nextExpanded = isExpanded ? null : entry.id;
                              setExpandedArchiveId(nextExpanded);
                              if (nextExpanded) await loadArchiveDetail(entry.id);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                            {archiveDetailLoadingId === entry.id ? "Loading..." : isExpanded ? "Hide details" : "View details"}
                          </Button>
                          {archivedData && (
                            <Button variant="outline" className="gap-2" onClick={() => exportArchiveJson(entry, archivedData)}>
                              <FileDown className="h-4 w-4" />
                              Export JSON
                            </Button>
                          )}
                          {!isRestored && (
                            <Button
                              className="gap-2 bg-primary hover:bg-primary/90"
                              onClick={() => {
                                setRestoreArchiveId(restoringThis ? null : entry.id);
                                setRestoreUserId("");
                              }}
                            >
                              <RotateCcw className="h-4 w-4" />
                              Restore
                            </Button>
                          )}
                          {isRestored && entry.restoredToUserId && (
                            <div className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-emerald-800">
                              Restored to <span className="font-mono">{entry.restoredToUserId}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "workflow" && (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-serif font-semibold text-[#24171D]">User Workflow Progress</h2>
              <p className="text-sm font-medium text-[#4A3941]">
                Track which users completed the core portal setup milestones and where they stopped.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "all", label: "All" },
                { value: "completed", label: "Completed" },
                { value: "in_progress", label: "In Progress" },
                { value: "not_started", label: "Not Started" },
              ].map(option => (
                <Button
                  key={option.value}
                  size="sm"
                  variant={workflowFilter === option.value ? "default" : "outline"}
                  onClick={() => setWorkflowFilter(option.value as typeof workflowFilter)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            {[
              { label: "Total users", value: workflowData?.summary.total ?? 0 },
              { label: "Completed", value: workflowData?.summary.completed ?? 0 },
              { label: "In progress", value: workflowData?.summary.inProgress ?? 0 },
              { label: "Not started", value: workflowData?.summary.notStarted ?? 0 },
            ].map(stat => (
              <Card key={stat.label}>
                <CardContent className="py-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#7A5062]">{stat.label}</p>
                  <p className="mt-1 text-2xl font-bold text-[#24171D]">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {isLoadingWorkflow ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-44 rounded-lg" />)}
            </div>
          ) : filteredWorkflowUsers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                <p className="font-medium text-[#4A3941]">No users found for this filter.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredWorkflowUsers.map(user => (
                <Card key={`${user.userId}-${user.profileId}`}>
                  <CardContent className="py-4">
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-[#24171D]">{user.displayName}</h3>
                          <Badge
                            className={
                              user.status === "completed"
                                ? "bg-emerald-100 text-emerald-800"
                                : user.status === "in_progress"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-800"
                            }
                          >
                            {user.status === "completed" ? "Completed" : user.status === "in_progress" ? "In progress" : "Not started"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm font-medium text-[#4A3941]">
                          {[user.email, user.workspaceName, user.venue].filter(Boolean).join(" | ")}
                        </p>
                        <div className="mt-3 grid gap-2 text-xs font-medium text-[#4A3941] sm:grid-cols-2 lg:grid-cols-4">
                          <span>Guests: {user.counts.guests}/{user.counts.targetGuests || "?"}</span>
                          <span>Vendors: {user.counts.vendors}</span>
                          <span>Documents: {user.counts.documents}</span>
                          <span>Checklist: {user.counts.checklistCompleted}/{user.counts.checklistTotal}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {user.milestones.map(milestone => (
                            <Badge
                              key={milestone.key}
                              variant={milestone.completed ? "secondary" : "outline"}
                              className={milestone.completed ? "bg-emerald-50 text-emerald-800" : "text-[#7A5062]"}
                            >
                              {milestone.completed ? "✓ " : ""}
                              {milestone.label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-lg border border-[#F0D7E0] bg-[#FFF8FA] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-[#24171D]">Progress</p>
                          <p className="text-2xl font-bold text-[#9A2E5C]">{user.progress}%</p>
                        </div>
                        <Progress value={user.progress} className="mt-3" />
                        <p className="mt-3 text-xs font-medium text-[#4A3941]">
                          {user.completedCount}/{user.totalMilestones} milestones complete
                        </p>
                        <p className="mt-2 text-xs font-medium text-[#4A3941]">
                          <span className="font-semibold text-[#24171D]">Last:</span> {user.lastCompleted}
                        </p>
                        <p className="mt-1 text-xs font-medium text-[#4A3941]">
                          <span className="font-semibold text-[#24171D]">Next:</span> {user.nextStep}
                        </p>
                        <p className="mt-2 text-[11px] font-medium text-[#7A5062]">
                          Last active: {user.lastActive ? new Date(user.lastActive).toLocaleString() : "Unknown"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "tickets" && (<>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-[#4A3941]">Total Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-[#4A3941]">Open</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1D4E89]">{stats.open}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-[#4A3941]">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#8A5200]">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-[#4A3941]">Resolved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#217244]">{stats.resolved}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {["all", "open", "in_progress", "resolved"].map(status => (
          <Button
            key={status}
            variant={filterStatus === status ? "default" : "outline"}
            onClick={() => setFilterStatus(status)}
            className="capitalize"
          >
            {status.replace("_", " ")}
          </Button>
        ))}
      </div>

      {/* Tickets List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-lg" />)}
        </div>
      ) : ticketsError ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-destructive/60 mx-auto mb-4" />
            <p className="text-destructive font-medium mb-1">Couldn't load tickets</p>
            <p className="text-sm font-medium text-[#4A3941]">{ticketsError.message}</p>
          </CardContent>
        </Card>
      ) : filteredTickets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="font-medium text-[#4A3941]">No tickets found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((ticket: any) => {
            const message = String(ticket.message ?? "");
            const isExpanded = expandedTicketIds.has(ticket.id);
            const canExpand = message.length > 180;
            return (
            <Card key={ticket.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(ticket.status)}
                      <h3 className="font-semibold text-[#24171D] truncate">{ticket.subject}</h3>
                      <Badge variant="outline">{ticket.ticketNumber}</Badge>
                      <Badge className={getPriorityColor(ticket.priority)}>
                        {ticket.priority}
                      </Badge>
                    </div>
                    <p className="mb-2 text-sm font-medium text-[#4A3941]">
                      From: {ticket.name} ({ticket.email})
                    </p>
                    <p className={`text-sm font-medium leading-relaxed text-[#24171D] ${isExpanded ? "whitespace-pre-wrap" : "line-clamp-2"}`}>
                      {message}
                    </p>
                    {canExpand && (
                      <button
                        type="button"
                        className="mt-1 text-xs font-semibold text-primary underline-offset-4 hover:underline"
                        onClick={() =>
                          setExpandedTicketIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(ticket.id)) next.delete(ticket.id);
                            else next.add(ticket.id);
                            return next;
                          })
                        }
                      >
                        {isExpanded ? "Collapse message" : "Read full message"}
                      </button>
                    )}
                    <div className="flex gap-4 mt-3 text-xs font-medium text-[#4A3941]">
                      <span>Category: {ticket.category}</span>
                      <span>
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </span>
                      {ticket.followUpSentAt && (
                        <span className="text-green-600">
                          Follow-up sent
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm("Delete this ticket? This cannot be undone.")) {
                          deleteMutation.mutate(ticket.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedTicket(ticket)}
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Send Follow-up</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium">Follow-up Email</label>
                            <Input
                              type="email"
                              placeholder="recipient@example.com"
                              value={followUpForm.followUpEmail}
                              onChange={e =>
                                setFollowUpForm(prev => ({
                                  ...prev,
                                  followUpEmail: e.target.value,
                                }))
                              }
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium">Message</label>
                            <Textarea
                              placeholder="Type your follow-up message..."
                              value={followUpForm.followUpNotes}
                              onChange={e =>
                                setFollowUpForm(prev => ({
                                  ...prev,
                                  followUpNotes: e.target.value,
                                }))
                              }
                              className="mt-1 h-32"
                            />
                          </div>
                          <Button
                            onClick={() => selectedTicket && followUpMutation.mutate(selectedTicket.id)}
                            disabled={
                              followUpMutation.isPending ||
                              !followUpForm.followUpEmail ||
                              !followUpForm.followUpNotes
                            }
                            className="w-full"
                          >
                            Send Follow-up
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Select
                      value={ticket.status}
                      onValueChange={status =>
                        statusMutation.mutate({ ticketId: ticket.id, status })
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      </>)}
    </div>
  );
}
