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
  FlaskConical,
  ListChecks,
  Plus,
  Send,
  Sparkles,
  Store,
  Users,
  Wrench,
} from "lucide-react";
import MessagesSection from "@/components/admin/MessagesSection";
import { MaintenanceNotice } from "@/components/MaintenanceNotice";

type TestSessionRow = {
  sessionId: string;
  testMode: boolean;
  createdAt: string;
  lastActiveAt: string;
  totalEvents: number;
  workflowProgress: {
    pageViews: number;
    profileVisits: number;
    guestListVisits: number;
    invitationStudioVisits: number;
    websiteEditorVisits: number;
  };
  pagesVisited: string[];
  wizardsUsed: string[];
  errorsEncountered: number;
};

type LaunchPlanItem = {
  id: string;
  title: string;
  category: string;
  notes: string;
  assigneeEmail: string;
  priority: "low" | "medium" | "high";
  dueDate: string;
  completed: boolean;
};

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

const LAUNCH_PLAN_STORAGE_KEY = "aido_operations_launch_plan_v1";
const LAUNCH_PLAN_ASSIGNEES = [
  { name: "Joseph", email: "kamyckijoseph@gmail.com" },
  { name: "Michael", email: "michaelgang31@gmail.com" },
] as const;
const LAUNCH_PLAN_ASSIGNEE_EMAILS = LAUNCH_PLAN_ASSIGNEES.map(assignee => assignee.email);

const getLaunchPlanAssigneeName = (email: string) =>
  LAUNCH_PLAN_ASSIGNEES.find(assignee => assignee.email === email)?.name ?? "Unassigned";

const getLaunchPlanPriorityClass = (priority: LaunchPlanItem["priority"]) => {
  if (priority === "high") return "border-red-300 bg-red-50 text-red-700 focus:border-red-500";
  if (priority === "low") return "border-emerald-300 bg-emerald-50 text-emerald-700 focus:border-emerald-500";
  return "border-yellow-300 bg-yellow-50 text-yellow-700 focus:border-yellow-500";
};

const buildLaunchPlanTaskEmail = (item: LaunchPlanItem) => {
  const assigneeName = getLaunchPlanAssigneeName(item.assigneeEmail);
  const priority = item.priority.charAt(0).toUpperCase() + item.priority.slice(1);
  return {
    subject: `A.IDO Launch Task: ${item.title || "Launch task"}`,
    body: [
      "A.IDO Launch Plan Task",
      "",
      `Task: ${item.title || "Untitled task"}`,
      `Category: ${item.category || "Launch"}`,
      `Assigned to: ${assigneeName}`,
      `Priority: ${priority}`,
      `Due date: ${item.dueDate || "Not set"}`,
      `Status: ${item.completed ? "Completed" : "Open"}`,
      "",
      "Notes:",
      item.notes || "No notes added.",
      "",
      "Open the A.IDO Operations Center to update this task.",
    ].join("\n"),
  };
};

const fallbackLaunchPlanItems: LaunchPlanItem[] = [
  {
    id: "launch-positioning",
    title: "Finalize A.IDO launch positioning",
    category: "Brand",
    notes: "Confirm the primary promise, launch audience, and short description used across the website, previews, and outreach.",
    assigneeEmail: "kamyckijoseph@gmail.com",
    priority: "high",
    dueDate: "",
    completed: false,
  },
  {
    id: "launch-onboarding",
    title: "Test signup and onboarding from a fresh account",
    category: "Product",
    notes: "Walk through profile setup, guest list, budget, vendors, contracts, website editor, and Aria from mobile and desktop.",
    assigneeEmail: "michaelgang31@gmail.com",
    priority: "high",
    dueDate: "",
    completed: false,
  },
  {
    id: "launch-support",
    title: "Prepare support and feedback workflow",
    category: "Operations",
    notes: "Make sure support messages, feedback prompts, and Operations Center tickets are being received and reviewed daily.",
    assigneeEmail: "kamyckijoseph@gmail.com",
    priority: "medium",
    dueDate: "",
    completed: false,
  },
];

const normalizeLaunchPlanItem = (item: Partial<LaunchPlanItem>, index = 0): LaunchPlanItem => {
  const priority = String(item.priority ?? "medium").toLowerCase();
  const assigneeEmail = String(item.assigneeEmail ?? "").toLowerCase();
  return {
    id: String(item.id ?? makeLaunchPlanId()),
    title: String(item.title ?? `Launch task ${index + 1}`),
    category: String(item.category ?? "Launch"),
    notes: String(item.notes ?? ""),
    assigneeEmail: LAUNCH_PLAN_ASSIGNEE_EMAILS.includes(assigneeEmail as typeof LAUNCH_PLAN_ASSIGNEE_EMAILS[number]) ? assigneeEmail : "",
    priority: priority === "low" || priority === "high" ? priority : "medium",
    dueDate: String(item.dueDate ?? ""),
    completed: Boolean(item.completed),
  };
};

const appendNewLaunchPlanItems = (currentItems: LaunchPlanItem[], generatedItems: LaunchPlanItem[]) => {
  const existingTitles = new Set(currentItems.map(item => item.title.trim().toLowerCase()).filter(Boolean));
  const uniqueGenerated = generatedItems.filter(item => {
    const title = item.title.trim().toLowerCase();
    if (!title || existingTitles.has(title)) return false;
    existingTitles.add(title);
    return true;
  });
  return [...currentItems, ...uniqueGenerated];
};

const makeLaunchPlanId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `launch-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

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
  const { getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [expandedTicketIds, setExpandedTicketIds] = useState<Set<number | string>>(new Set());
  const [activeTab, setActiveTab] = useState<"tickets" | "messages" | "vendorIntake" | "users" | "recovery" | "workflow" | "testActivity" | "launchPlan" | "maintenance">("tickets");
  const [workflowFilter, setWorkflowFilter] = useState<"all" | "completed" | "in_progress" | "not_started">("all");
  const [testSessionFilter, setTestSessionFilter] = useState<"test" | "all" | "real">("test");
  const [userSearch, setUserSearch] = useState("");
  const [userToDelete, setUserToDelete] = useState<SignedUpUser | null>(null);
  const [expandedArchiveId, setExpandedArchiveId] = useState<number | null>(null);
  const [archiveDetails, setArchiveDetails] = useState<Record<number, Record<string, unknown>>>({});
  const [archiveDetailLoadingId, setArchiveDetailLoadingId] = useState<number | null>(null);
  const [restoreArchiveId, setRestoreArchiveId] = useState<number | null>(null);
  const [restoreUserId, setRestoreUserId] = useState("");
  const [launchPlanPrompt, setLaunchPlanPrompt] = useState("");
  const [hasLoadedLaunchPlan, setHasLoadedLaunchPlan] = useState(false);
  const launchPlanItemsRef = useRef<LaunchPlanItem[]>([]);
  const hasLoadedLaunchPlanRef = useRef(false);
  const [launchPlanEmailRecipients, setLaunchPlanEmailRecipients] = useState<Record<string, string>>({});
  const [vendorReplyOpenId, setVendorReplyOpenId] = useState<number | null>(null);
  const [vendorReplyText, setVendorReplyText] = useState<Record<number, string>>({});
  const [vendorDirectoryEditorId, setVendorDirectoryEditorId] = useState<number | null>(null);
  const [vendorDirectoryDrafts, setVendorDirectoryDrafts] = useState<Record<number, VendorDirectoryListingDraft>>({});
  const [vendorIntakeFilter, setVendorIntakeFilter] = useState<"all" | "new" | "reviewing" | "approved" | "declined" | "published">("all");
  const [launchPlanItems, setLaunchPlanItems] = useState<LaunchPlanItem[]>(() => {
    if (typeof window === "undefined") return fallbackLaunchPlanItems;
    try {
      const stored = window.localStorage.getItem(LAUNCH_PLAN_STORAGE_KEY);
      if (!stored) return fallbackLaunchPlanItems;
      const parsed = JSON.parse(stored) as LaunchPlanItem[];
      if (!Array.isArray(parsed) || parsed.length === 0) return fallbackLaunchPlanItems;
      return parsed.map(normalizeLaunchPlanItem);
    } catch {
      return fallbackLaunchPlanItems;
    }
  });
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
  });

  const { data: messagesData } = useQuery<{ contacts: { isRead: boolean; isResolved: boolean }[]; unreadCount: number }>({
    queryKey: ["admin-messages"],
    queryFn: async () => {
      const r = await authedFetch("/api/help/messages");
      if (!r.ok) throw new Error("Failed to fetch messages");
      return r.json();
    },
    refetchInterval: 30000,
  });
  const unreadMessageCount = messagesData?.unreadCount ?? 0;

  const { data: vendorApplicationsData, isLoading: isLoadingVendorApplications } = useQuery<{ applications: VendorPartnerApplication[] }>({
    queryKey: ["admin-vendor-partner-applications"],
    queryFn: async () => {
      const r = await authedFetch("/api/admin/vendor-partner-applications");
      if (!r.ok) throw new Error("Failed to fetch vendor partner applications");
      return r.json();
    },
    enabled: activeTab === "vendorIntake",
    refetchInterval: activeTab === "vendorIntake" ? 30000 : false,
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

  const { data: testSessionsData, isLoading: isLoadingTestSessions } = useQuery<{ sessions: TestSessionRow[] }>({
    queryKey: ["admin-test-sessions", testSessionFilter],
    queryFn: async () => {
      const r = await authedFetch(`/api/admin/test-sessions?mode=${testSessionFilter}`);
      if (!r.ok) throw new Error("Failed to fetch test sessions");
      return r.json();
    },
    enabled: activeTab === "testActivity",
    refetchInterval: activeTab === "testActivity" ? 30000 : false,
  });
  const testSessions = testSessionsData?.sessions ?? [];

  const { data: signedUpUsersData, isLoading: isLoadingSignedUpUsers } = useQuery<AdminUsersResponse>({
    queryKey: ["admin-signed-up-users", userSearch],
    queryFn: async () => {
      const params = userSearch.trim() ? `?search=${encodeURIComponent(userSearch.trim())}` : "";
      const r = await authedFetch(`/api/admin/users${params}`);
      if (!r.ok) throw new Error("Failed to fetch signed-up users");
      return r.json();
    },
    enabled: activeTab === "users",
    refetchInterval: activeTab === "users" ? 15000 : false,
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
    enabled: activeTab === "maintenance",
    refetchInterval: activeTab === "maintenance" ? 15000 : false,
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
    enabled: activeTab === "recovery",
    refetchInterval: activeTab === "recovery" ? 30000 : false,
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
    enabled: activeTab === "workflow",
    refetchInterval: activeTab === "workflow" ? 30000 : false,
  });
  const workflowUsers = workflowData?.users ?? [];
  const filteredWorkflowUsers = workflowFilter === "all"
    ? workflowUsers
    : workflowUsers.filter(user => user.status === workflowFilter);

  const { data: launchPlanData, isLoading: isLoadingLaunchPlan } = useQuery<{
    items: Array<Partial<LaunchPlanItem>>;
    assignees: string[];
  }>({
    queryKey: ["admin-launch-plan"],
    queryFn: async () => {
      const r = await authedFetch("/api/admin/launch-plan");
      if (!r.ok) throw new Error("Failed to load launch plan");
      return r.json();
    },
    enabled: activeTab === "launchPlan",
  });

  useEffect(() => {
    window.localStorage.setItem(LAUNCH_PLAN_STORAGE_KEY, JSON.stringify(launchPlanItems));
  }, [launchPlanItems]);

  useEffect(() => {
    if (!launchPlanData?.items) return;
    setLaunchPlanItems(launchPlanData.items.map(normalizeLaunchPlanItem));
    setHasLoadedLaunchPlan(true);
  }, [launchPlanData]);

  const launchPlanCompletedCount = launchPlanItems.filter(item => item.completed).length;
  const launchPlanProgress = launchPlanItems.length > 0
    ? Math.round((launchPlanCompletedCount / launchPlanItems.length) * 100)
    : 0;
  const launchPlanOpenCount = launchPlanItems.length - launchPlanCompletedCount;
  const openLaunchPlanItems = launchPlanItems.filter(item => !item.completed);
  const completedLaunchPlanItems = launchPlanItems.filter(item => item.completed);
  const launchPlanAssigneeStats = LAUNCH_PLAN_ASSIGNEES.map(assignee => ({
    ...assignee,
    total: launchPlanItems.filter(item => item.assigneeEmail === assignee.email).length,
    open: launchPlanItems.filter(item => item.assigneeEmail === assignee.email && !item.completed).length,
  }));

  const updateLaunchPlanItem = (id: string, patch: Partial<LaunchPlanItem>) => {
    setHasLoadedLaunchPlan(true);
    setLaunchPlanItems(items => items.map(item => item.id === id ? { ...item, ...patch } : item));
  };

  const addLaunchPlanItem = () => {
    setHasLoadedLaunchPlan(true);
    setLaunchPlanItems(items => [
      ...items,
      {
        id: makeLaunchPlanId(),
        title: "New launch task",
        category: "Launch",
        notes: "",
        assigneeEmail: "",
        priority: "medium",
        dueDate: "",
        completed: false,
      },
    ]);
  };

  const saveLaunchPlanMutation = useMutation({
    mutationFn: async (items: LaunchPlanItem[]) => {
      const r = await authedFetch("/api/admin/launch-plan", {
        method: "PUT",
        body: JSON.stringify({ items }),
      });
      if (!r.ok) throw new Error("Failed to save launch plan");
      return r.json();
    },
    onError: () => {
      toast({ title: "Launch plan could not be saved", variant: "destructive" });
    },
  });

  const saveLaunchPlanItems = async (items: LaunchPlanItem[]) => {
    const r = await authedFetch("/api/admin/launch-plan", {
      method: "PUT",
      body: JSON.stringify({ items }),
    });
    if (!r.ok) throw new Error("Failed to save launch plan");
  };

  useEffect(() => {
    launchPlanItemsRef.current = launchPlanItems;
  }, [launchPlanItems]);

  useEffect(() => {
    hasLoadedLaunchPlanRef.current = hasLoadedLaunchPlan;
  }, [hasLoadedLaunchPlan]);

  useEffect(() => {
    if (!hasLoadedLaunchPlan) return;
    const timeout = window.setTimeout(() => {
      saveLaunchPlanMutation.mutate(launchPlanItems);
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [hasLoadedLaunchPlan, launchPlanItems]);

  useEffect(() => {
    const flushPendingLaunchPlan = () => {
      if (!hasLoadedLaunchPlanRef.current) return;
      void saveLaunchPlanItems(launchPlanItemsRef.current);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushPendingLaunchPlan();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flushPendingLaunchPlan);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flushPendingLaunchPlan);
      flushPendingLaunchPlan();
    };
  }, []);

  const generateLaunchPlanMutation = useMutation({
    mutationFn: async () => {
      const r = await authedFetch("/api/admin/launch-plan/generate", {
        method: "POST",
        body: JSON.stringify({
          focus: launchPlanPrompt,
          currentItems: launchPlanItems.map(({ title, category, notes, assigneeEmail, priority, dueDate, completed }) => ({
            title,
            category,
            notes,
            assigneeEmail,
            priority,
            dueDate,
            completed,
          })),
        }),
      });
      if (!r.ok) throw new Error("Failed to generate launch plan");
      return r.json() as Promise<{ items: Array<Partial<LaunchPlanItem>>; source?: string }>;
    },
    onSuccess: (data) => {
      const generatedItems = (data.items ?? [])
        .filter(item => String(item.title ?? "").trim().length > 0)
        .map((item, index) => normalizeLaunchPlanItem({
          id: makeLaunchPlanId(),
          title: String(item.title ?? "").trim(),
          category: String(item.category ?? "Launch").trim() || "Launch",
          notes: String(item.notes ?? "").trim(),
          assigneeEmail: String(item.assigneeEmail ?? ""),
          priority: item.priority as LaunchPlanItem["priority"],
          dueDate: String(item.dueDate ?? ""),
          completed: Boolean(item.completed),
        }, index));

      if (generatedItems.length === 0) {
        toast({ title: "No checklist items generated", variant: "destructive" });
        return;
      }

      setHasLoadedLaunchPlan(true);
      setLaunchPlanItems(current => appendNewLaunchPlanItems(current, generatedItems));
      toast({
        title: data.source === "fallback" ? "Launch plan starter added" : "Launch plan items added",
        description: "Existing tasks and completed items were kept in place.",
      });
    },
    onError: () => {
      toast({ title: "Could not generate launch plan", variant: "destructive" });
    },
  });

  const sendLaunchPlanTaskMutation = useMutation({
    mutationFn: async ({ item, recipientEmail }: { item: LaunchPlanItem; recipientEmail: string }) => {
      const taskEmail = buildLaunchPlanTaskEmail(item);
      const r = await authedFetch("/api/admin/launch-plan/send-task", {
        method: "POST",
        body: JSON.stringify({ task: item, recipientEmail }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        const fallback = await authedFetch("/api/admin/marketing/send", {
          method: "POST",
          body: JSON.stringify({
            emails: [recipientEmail],
            subject: taskEmail.subject,
            body: taskEmail.body,
          }),
        });
        const fallbackBody = await fallback.json().catch(() => ({}));
        if (!fallback.ok || fallbackBody?.failed > 0) {
          const firstError = Array.isArray(fallbackBody?.results)
            ? fallbackBody.results.find((result: { ok?: boolean; error?: string }) => !result.ok)?.error
            : undefined;
          throw new Error(firstError ?? fallbackBody?.error ?? body?.error ?? "Failed to email launch task");
        }
        return fallbackBody;
      }
      return body;
    },
    onSuccess: (_data, variables) => {
      toast({
        title: "Task emailed",
        description: `Sent to ${getLaunchPlanAssigneeName(variables.recipientEmail)}.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Could not email task",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

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

  const renderLaunchPlanTaskCard = (item: LaunchPlanItem) => {
    const recipientEmail = launchPlanEmailRecipients[item.id] || item.assigneeEmail || LAUNCH_PLAN_ASSIGNEES[0].email;
    return (
      <Card key={item.id} className={item.completed ? "border-emerald-200 bg-emerald-50/40" : ""}>
        <CardContent className="py-4">
          <div className="grid gap-4 lg:grid-cols-[auto_1fr_auto] lg:items-start">
            <button
              type="button"
              onClick={() => updateLaunchPlanItem(item.id, { completed: !item.completed })}
              className={`mt-1 flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
                item.completed
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-[#E7C7D3] bg-white text-[#9A2E5C] hover:border-[#9A2E5C]"
              }`}
              aria-label={item.completed ? "Mark launch task incomplete" : "Mark launch task complete"}
            >
              <CheckCircle2 className="h-5 w-5" />
            </button>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[150px_1fr_220px_130px_150px]">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[#7A5062]">Category</label>
                <Input
                  value={item.category}
                  onChange={(event) => updateLaunchPlanItem(item.id, { category: event.target.value })}
                  className="mt-1"
                />
              </div>
              <div className="md:col-span-1 xl:col-span-1">
                <label className="text-xs font-bold uppercase tracking-wide text-[#7A5062]">Task</label>
                <Input
                  value={item.title}
                  onChange={(event) => updateLaunchPlanItem(item.id, { title: event.target.value })}
                  className={`mt-1 font-semibold ${item.completed ? "line-through decoration-2" : ""}`}
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[#7A5062]">Assigned To</label>
                <Select
                  value={item.assigneeEmail || "unassigned"}
                  onValueChange={assigneeEmail => updateLaunchPlanItem(item.id, {
                    assigneeEmail: assigneeEmail === "unassigned" ? "" : assigneeEmail,
                  })}
                >
                  <SelectTrigger className={`mt-1 ${getLaunchPlanPriorityClass(item.priority)}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {LAUNCH_PLAN_ASSIGNEES.map(assignee => (
                      <SelectItem key={assignee.email} value={assignee.email}>{assignee.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[#7A5062]">Priority</label>
                <Select
                  value={item.priority}
                  onValueChange={priority => updateLaunchPlanItem(item.id, { priority: priority as LaunchPlanItem["priority"] })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[#7A5062]">Due Date</label>
                <Input
                  type="date"
                  value={item.dueDate}
                  onChange={(event) => updateLaunchPlanItem(item.id, { dueDate: event.target.value })}
                  className="mt-1"
                />
              </div>
              <div className="md:col-span-2 xl:col-span-5">
                <label className="text-xs font-bold uppercase tracking-wide text-[#7A5062]">Notes</label>
                <Textarea
                  value={item.notes}
                  onChange={(event) => updateLaunchPlanItem(item.id, { notes: event.target.value })}
                  placeholder="Add launch notes, owner, blockers, links, or next action."
                  className="mt-1 min-h-[82px]"
                />
              </div>
              <div className="rounded-lg border border-[#F0D7E0] bg-[#FFF8FA] p-3 md:col-span-2 xl:col-span-5">
                <label className="text-xs font-bold uppercase tracking-wide text-[#7A5062]">Email this task</label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <Select
                    value={recipientEmail}
                    onValueChange={email => setLaunchPlanEmailRecipients(current => ({ ...current, [item.id]: email }))}
                  >
                    <SelectTrigger className="min-h-10 flex-1 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LAUNCH_PLAN_ASSIGNEES.map(assignee => (
                        <SelectItem key={assignee.email} value={assignee.email}>
                          {assignee.name} ({assignee.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    disabled={sendLaunchPlanTaskMutation.isPending}
                    onClick={() => sendLaunchPlanTaskMutation.mutate({ item, recipientEmail })}
                  >
                    {sendLaunchPlanTaskMutation.isPending ? <Clock className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    Send Task
                  </Button>
                </div>
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setLaunchPlanItems(items => items.filter(current => current.id !== item.id))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

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
          onClick={() => setActiveTab("testActivity")}
          className={`flex shrink-0 items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
            ${activeTab === "testActivity" ? "border-primary text-[#5B0F2A]" : "border-transparent text-[#4A3941] hover:text-[#24171D]"}`}
        >
          <FlaskConical className="h-4 w-4" />
          Free Test Account Activity
        </button>
        <button
          onClick={() => setActiveTab("launchPlan")}
          className={`flex shrink-0 items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
            ${activeTab === "launchPlan" ? "border-primary text-[#5B0F2A]" : "border-transparent text-[#4A3941] hover:text-[#24171D]"}`}
        >
          <ListChecks className="h-4 w-4" />
          A.IDO Launch Plan
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
                Every account appears once with its current Active or Inactive status, workspace ownership, and sharing details. Refreshes automatically while open.
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

      {activeTab === "testActivity" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-serif font-semibold text-[#24171D]">Free Test Account Activity</h2>
              <p className="text-sm font-medium text-[#4A3941]">
                Anonymous test sessions are separated from real user analytics.
              </p>
            </div>
            <div className="flex gap-2">
              {[
                { value: "test", label: "Show only testMode sessions" },
                { value: "all", label: "Show all sessions" },
                { value: "real", label: "Show real users only" },
              ].map((option) => (
                <Button
                  key={option.value}
                  size="sm"
                  variant={testSessionFilter === option.value ? "default" : "outline"}
                  onClick={() => setTestSessionFilter(option.value as "test" | "all" | "real")}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {isLoadingTestSessions ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-lg" />)}
            </div>
          ) : testSessions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FlaskConical className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                <p className="font-medium text-[#4A3941]">No sessions found for this filter.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {testSessions.map((session) => (
                <Card key={session.sessionId}>
                  <CardContent className="py-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="font-mono text-sm font-semibold text-[#24171D] break-all">{session.sessionId}</h3>
                          <Badge className={session.testMode ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-800"}>
                            testMode = {String(session.testMode)}
                          </Badge>
                          {session.errorsEncountered > 0 && (
                            <Badge className="bg-red-100 text-red-800">{session.errorsEncountered} errors</Badge>
                          )}
                        </div>
                        <div className="grid gap-2 text-xs font-medium text-[#4A3941] sm:grid-cols-2 lg:grid-cols-4">
                          <span>Created: {new Date(session.createdAt).toLocaleString()}</span>
                          <span>Last active: {new Date(session.lastActiveAt).toLocaleString()}</span>
                          <span>Total events: {session.totalEvents}</span>
                          <span>Pages visited: {session.pagesVisited.length}</span>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-5">
                          <span className="rounded-md bg-muted px-2 py-1">Page views: {session.workflowProgress.pageViews}</span>
                          <span className="rounded-md bg-muted px-2 py-1">Profile: {session.workflowProgress.profileVisits}</span>
                          <span className="rounded-md bg-muted px-2 py-1">Guests: {session.workflowProgress.guestListVisits}</span>
                          <span className="rounded-md bg-muted px-2 py-1">Invites: {session.workflowProgress.invitationStudioVisits}</span>
                          <span className="rounded-md bg-muted px-2 py-1">Website: {session.workflowProgress.websiteEditorVisits}</span>
                        </div>
                        {session.pagesVisited.length > 0 && (
                          <p className="mt-3 text-xs font-medium text-[#4A3941]">
                            <span className="font-semibold text-[#24171D]">Pages:</span>{" "}
                            {session.pagesVisited.slice(0, 10).join(", ")}
                            {session.pagesVisited.length > 10 ? ` +${session.pagesVisited.length - 10} more` : ""}
                          </p>
                        )}
                        {session.wizardsUsed.length > 0 && (
                          <p className="mt-1 text-xs font-medium text-[#4A3941]">
                            <span className="font-semibold text-[#24171D]">Wizards used:</span>{" "}
                            {session.wizardsUsed.join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "launchPlan" && (
        <div className="space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-xl font-serif font-semibold text-[#24171D]">A.IDO Launch Plan</h2>
              <p className="text-sm font-medium text-[#4A3941]">
                Generate a launch checklist, edit each task, add working notes, and check off what is finished.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={addLaunchPlanItem}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
              <Button
                type="button"
                onClick={() => generateLaunchPlanMutation.mutate()}
                disabled={generateLaunchPlanMutation.isPending}
                className="gap-2 bg-[#9A2E5C] hover:bg-[#7B2148]"
              >
                <Sparkles className="h-4 w-4" />
                {generateLaunchPlanMutation.isPending ? "Generating..." : "Generate Checklist"}
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="py-5">
              <div className="grid gap-4 lg:grid-cols-[1fr_260px] lg:items-end">
                <div>
                  <label className="text-sm font-semibold text-[#24171D]">AI focus</label>
                  <Textarea
                    value={launchPlanPrompt}
                    onChange={(event) => setLaunchPlanPrompt(event.target.value)}
                    placeholder="Example: launch public beta, prep social posts, test payments, confirm privacy/security, and plan first users."
                    className="mt-2 min-h-[86px]"
                  />
                </div>
                <div className="rounded-lg border border-[#F0D7E0] bg-[#FFF8FA] p-4">
                  <p className="text-sm font-semibold text-[#4A3941]">Progress</p>
                  <p className="mt-1 text-3xl font-bold text-[#9A2E5C]">{launchPlanProgress}%</p>
                  <p className="mt-1 text-xs font-medium text-[#4A3941]">
                    {launchPlanCompletedCount} complete, {launchPlanOpenCount} open
                  </p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#F4DDE5]">
                    <div
                      className="h-full rounded-full bg-[#9A2E5C] transition-all"
                      style={{ width: `${launchPlanProgress}%` }}
                    />
                  </div>
                  <div className="mt-3 space-y-1 text-xs font-medium text-[#4A3941]">
                    {launchPlanAssigneeStats.map(stat => (
                      <div key={stat.email} className="flex justify-between gap-3">
                        <span className="truncate">{stat.name}</span>
                        <span className="shrink-0">{stat.open} open</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] font-medium text-[#7A5062]">
                    {saveLaunchPlanMutation.isPending ? "Saving..." : hasLoadedLaunchPlan ? "Shared plan saved automatically" : "Loading shared plan"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {isLoadingLaunchPlan ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-lg" />)}
            </div>
          ) : (
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#7A5062]">Open Tasks</h3>
              {openLaunchPlanItems.length > 0 ? openLaunchPlanItems.map(renderLaunchPlanTaskCard) : (
                <Card>
                  <CardContent className="py-8 text-center text-sm font-medium text-[#4A3941]">No open launch tasks.</CardContent>
                </Card>
              )}
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-emerald-700">Completed</h3>
              {completedLaunchPlanItems.length > 0 ? completedLaunchPlanItems.map(renderLaunchPlanTaskCard) : (
                <Card>
                  <CardContent className="py-8 text-center text-sm font-medium text-[#4A3941]">Completed launch tasks will move here.</CardContent>
                </Card>
              )}
            </div>
          </div>
          )}

          {launchPlanItems.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <ListChecks className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
                <p className="font-medium text-[#4A3941]">No launch tasks yet. Generate a checklist or add an item.</p>
              </CardContent>
            </Card>
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
