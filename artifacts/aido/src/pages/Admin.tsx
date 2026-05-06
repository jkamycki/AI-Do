import React, { useState, useMemo } from "react";
import { authFetch } from "@/lib/authFetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import ExcelJS from "exceljs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, Legend, AreaChart, Area,
} from "recharts";
import {
  Users, TrendingUp, Zap, Shield, BarChart2, DollarSign,
  AlertCircle, RefreshCw, CalendarClock, Mail, CheckSquare,
  Smartphone, FileDown, DollarSign as BudgetIcon, Activity,
  ChevronRight, Inbox, Star, MessageSquare, Bug, Lightbulb, Heart, ThumbsUp,
  MailOpen, Circle, CheckCircle2, Search, Calendar, Clock, ExternalLink,
  ChevronDown as ChevronDownIcon, ChevronUp as ChevronUpIcon, Trash2, Loader2,
  UserX, TrendingDown, ArrowRight, SortAsc, Globe, Eye, UserCheck, UserMinus,
  Megaphone, Send, X, CheckCircle, XCircle, Sparkles,
} from "lucide-react";

interface AdminMetrics {
  userMetrics: {
    totalUsers: number;
    dau: number;
    wau: number;
    mau: number;
    newToday: number;
    newThisWeek: number;
    newThisMonth: number;
    onboardingCompletionRate: number;
    totalSignups: number;
    onboardedUsers: number;
  };
  usageMetrics: {
    timelinesGenerated: number;
    vendorEmailsGenerated: number;
    checklistItemsCompleted: number;
    budgetUpdates: number;
    dayOfActivations: number;
    pdfExports: number;
    totalEvents: number;
    features: Array<{ name: string; eventType: string; count: number }>;
    mostUsed: string;
    leastUsed: string;
  };
  moneyMetrics: {
    totalRevenue: number;
    mrr: number;
    arr: number;
    arpu: number;
    ltv: number;
    churnRate: number;
    failedPayments: number;
    note: string;
  };
  systemMetrics: {
    totalEvents: number;
    apiErrors: number;
    deviceBreakdown: Array<{ device: string; count: number }>;
  };
  userGrowth: Array<{ date: string; count: number }>;
  pageViews: {
    today: number;
    week: number;
    total: number;
  };
  onboardingGrowth: Array<{ date: string; count: number }>;
}

interface AdminEvent {
  id: number;
  userId: string;
  eventType: string;
  timestamp: string;
  metadata: Record<string, unknown> | null;
}

const BRAND = "#7C3F5E";
const TABS = [
  { key: "overview", label: "Overview", icon: BarChart2 },
  { key: "users", label: "Users", icon: Users },
  { key: "engagement", label: "Engagement", icon: Zap },
  { key: "marketing", label: "Marketing", icon: Megaphone },
  { key: "archive", label: "Archive", icon: Shield },
  { key: "events", label: "Event Log", icon: Activity },
  { key: "messages", label: "Messages", icon: Inbox },
];

const EVENT_LABELS: Record<string, string> = {
  user_signup: "User Signup",
  user_login: "User Login",
  onboarding_completed: "Onboarding Completed",
  timeline_generated: "Timeline Generated",
  vendor_email_generated: "Vendor Email Generated",
  checklist_item_completed: "Checklist Item Completed",
  budget_updated: "Budget Updated",
  day_of_mode_activated: "Day-Of Mode Activated",
  pdf_exported: "PDF Exported",
  api_error: "API Error",
  page_view: "Page View",
  marketing_email_sent: "Marketing Email Sent",
};

const EVENT_COLORS: Record<string, string> = {
  user_signup: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
  user_login: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  onboarding_completed: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
  timeline_generated: "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300",
  vendor_email_generated: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
  checklist_item_completed: "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300",
  budget_updated: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  day_of_mode_activated: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300",
  pdf_exported: "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300",
  api_error: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
};

function MetricCard({ title, value, sub, icon: Icon, accent = false }: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <Card className={`border-none shadow-sm ${accent ? "bg-primary text-primary-foreground" : "bg-card"}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-medium uppercase tracking-wider mb-1 ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
              {title}
            </p>
            <p className={`text-3xl font-bold font-serif ${accent ? "text-primary-foreground" : "text-foreground"}`}>
              {value}
            </p>
            {sub && (
              <p className={`text-xs mt-1 ${accent ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                {sub}
              </p>
            )}
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${accent ? "bg-white/20" : "bg-primary/10"}`}>
            <Icon className={`h-5 w-5 ${accent ? "text-primary-foreground" : "text-primary"}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-serif text-primary">{title}</h2>
      <p className="text-muted-foreground mt-1">{description}</p>
    </div>
  );
}

interface AdminUser {
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
  partner1Name: string | null;
  partner2Name: string | null;
  weddingDate: string | null;
  venue: string | null;
}

function UserAvatar({ user }: { user: AdminUser }) {
  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "?";
  if (user.imageUrl) {
    return <img src={user.imageUrl} alt={initials} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />;
  }
  return (
    <div className="w-8 h-8 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
      {initials}
    </div>
  );
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function UserDetailModal({ user, onClose, onDeleted }: { user: AdminUser; onClose: () => void; onDeleted: () => void }) {
  const { getToken } = useAuth();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const expected = user.email ?? user.id;
  const canDelete = confirmText.trim().toLowerCase() === expected.toLowerCase() && !deleting;

  const handleDelete = async () => {
    if (!canDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const r = await authFetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? `Delete failed (${r.status})`);
      }
      onDeleted();
      onClose();
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : "Delete failed");
      setDeleting(false);
    }
  };

  const fullName = `${user.firstName} ${user.lastName}`.trim() || "Unknown";
  const sections = [
    {
      title: "Account",
      items: [
        { label: "Full Name", value: fullName },
        { label: "Email", value: user.email ?? "—" },
        { label: "Clerk ID", value: user.id },
        { label: "Joined", value: new Date(user.joinedAt).toLocaleString() },
        { label: "Last Active", value: user.lastActive ? new Date(user.lastActive).toLocaleString() : "Never" },
        { label: "Total Events", value: String(user.eventCount) },
      ],
    },
    {
      title: "Profile",
      items: [
        { label: "Has Profile", value: user.hasProfile ? "Yes" : "No" },
        { label: "Onboarded", value: user.onboarded ? "Yes" : "No" },
        { label: "Partner 1", value: user.partner1Name ?? "—" },
        { label: "Partner 2", value: user.partner2Name ?? "—" },
        { label: "Wedding Date", value: user.weddingDate ?? "—" },
        { label: "Venue", value: user.venue ?? "—" },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-background border-b border-border/50 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <UserAvatar user={user} />
            <div>
              <h2 className="font-serif text-lg font-semibold">{fullName}</h2>
              <p className="text-xs text-muted-foreground">{user.email ?? "No email"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user.onboarded && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold uppercase tracking-wide">
                Onboarded
              </span>
            )}
            {!user.hasProfile && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold uppercase tracking-wide">
                No profile
              </span>
            )}
            <button
              onClick={onClose}
              className="ml-2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {sections.map(section => (
            <div key={section.title}>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                {section.title}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {section.items.map(item => (
                  <div key={item.label} className="bg-muted/30 rounded-xl p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</p>
                    <p className="text-sm text-foreground mt-1 break-all">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="pt-2">
            <div className="flex items-center gap-4 text-sm text-muted-foreground bg-muted/20 rounded-xl p-4">
              <Clock className="h-4 w-4 flex-shrink-0 text-primary" />
              <span>Last seen <strong className="text-foreground">{timeAgo(user.lastActive)}</strong></span>
              <Calendar className="h-4 w-4 flex-shrink-0 text-primary ml-auto" />
              <span>Joined <strong className="text-foreground">{new Date(user.joinedAt).toLocaleDateString()}</strong></span>
            </div>
          </div>

          <div className="pt-2">
            <div className="border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/30 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Trash2 className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-red-900 dark:text-red-200">Danger zone — delete this user</h3>
                  <p className="text-xs text-red-800/80 dark:text-red-300/90 mt-1">
                    Permanently removes the user's Clerk account and wipes every wedding profile,
                    vendor, budget, guest, checklist, message, and contract they created. This cannot be undone.
                  </p>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-red-900 dark:text-red-200">
                  To confirm, type: <span className="font-mono text-foreground">{expected}</span>
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder={expected}
                  className="mt-1 w-full px-3 py-2 text-sm border border-red-300 dark:border-red-800 rounded-lg bg-white dark:bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-red-400"
                  disabled={deleting}
                />
              </div>
              {deleteError && (
                <p className="text-xs text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-950/60 rounded p-2">{deleteError}</p>
              )}
              <Button
                variant="destructive"
                size="sm"
                disabled={!canDelete}
                onClick={handleDelete}
                className="w-full"
              >
                {deleting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting…</>
                ) : (
                  <><Trash2 className="h-4 w-4 mr-2" /> Permanently delete user</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DropoffUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  imageUrl: string | null;
  joinedAt: string;
  daysSince: number;
  loginCount: number;
  lastSeen: string | null;
  neverReturned: boolean;
}

interface DropoffData {
  dropoffs: DropoffUser[];
  total: number;
  neverReturned: number;
  cameBack: number;
  cohorts: Array<{ week: string; dropoffs: number; neverReturned: number }>;
}

function DropoffUserRow({ user }: { user: DropoffUser }) {
  const [open, setOpen] = useState(false);
  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "?";
  const fullName = `${user.firstName} ${user.lastName}`.trim() || "—";

  return (
    <>
      <tr
        className="border-b border-border/40 hover:bg-muted/30 cursor-pointer transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            {user.imageUrl
              ? <img src={user.imageUrl} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
              : <div className="w-7 h-7 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">{initials}</div>
            }
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{fullName}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email ?? "—"}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
          {new Date(user.joinedAt).toLocaleDateString()}
        </td>
        <td className="px-4 py-3 text-sm text-center">
          <span className={user.daysSince <= 3 ? "text-amber-600 font-medium" : user.daysSince >= 14 ? "text-red-500 font-medium" : "text-foreground"}>
            {user.daysSince}d ago
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-center">
          {user.loginCount > 0
            ? <span className="text-amber-600 font-medium">{user.loginCount}×</span>
            : <span className="text-muted-foreground">—</span>
          }
        </td>
        <td className="px-4 py-3 text-center">
          {user.neverReturned
            ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-semibold uppercase tracking-wide">Ghost</span>
            : <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-semibold uppercase tracking-wide">Stalled</span>
          }
        </td>
        <td className="px-4 py-3 text-center">
          <span className={`transition-transform inline-block text-muted-foreground ${open ? "rotate-180" : ""}`}>
            <ChevronDownIcon className="h-4 w-4" />
          </span>
        </td>
      </tr>
      {open && (
        <tr className="bg-muted/20 border-b border-border/40">
          <td colSpan={6} className="px-6 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div><p className="text-xs text-muted-foreground mb-0.5">Clerk ID</p><p className="font-mono text-xs truncate">{user.id}</p></div>
              <div><p className="text-xs text-muted-foreground mb-0.5">Signed Up</p><p>{new Date(user.joinedAt).toLocaleString()}</p></div>
              <div><p className="text-xs text-muted-foreground mb-0.5">Last Seen</p><p>{user.lastSeen ? new Date(user.lastSeen).toLocaleString() : "Never"}</p></div>
              <div><p className="text-xs text-muted-foreground mb-0.5">Login Events</p><p>{user.loginCount}</p></div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DropoffAnalysisTab({ totalSignups, onboardedUsers }: { totalSignups: number; onboardedUsers: number }) {
  const { getToken } = useAuth();
  const [days, setDays] = useState(30);
  const [filter, setFilter] = useState<"all" | "ghost" | "stalled">("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "most_logins" | "least_logins">("newest");
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useQuery<DropoffData>({
    queryKey: ["admin-dropoffs", days],
    queryFn: async () => {
      const r = await authFetch(`/api/admin/dropoffs?days=${days}`);
      if (!r.ok) throw new Error("Failed to fetch drop-offs");
      return r.json();
    },
  });

  const filtered = useMemo(() => {
    let list = data?.dropoffs ?? [];
    if (filter === "ghost") list = list.filter(u => u.neverReturned);
    if (filter === "stalled") list = list.filter(u => !u.neverReturned);
    switch (sort) {
      case "oldest": list = [...list].sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()); break;
      case "most_logins": list = [...list].sort((a, b) => b.loginCount - a.loginCount); break;
      case "least_logins": list = [...list].sort((a, b) => a.loginCount - b.loginCount); break;
      default: list = [...list].sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());
    }
    return list;
  }, [data, filter, sort]);

  const conversionRate = totalSignups > 0 ? Math.round((onboardedUsers / totalSignups) * 100) : 0;
  const dropoffRate = 100 - conversionRate;

  const exportToExcel = async () => {
    if (!data) return;
    setExporting(true);
    try {
      const rows = data.dropoffs.map(u => ({
        "First Name": u.firstName,
        "Last Name": u.lastName,
        "Email": u.email ?? "",
        "Clerk ID": u.id,
        "Signed Up": new Date(u.joinedAt).toLocaleString(),
        "Days Since Signup": u.daysSince,
        "Login Count": u.loginCount,
        "Last Seen": u.lastSeen ? new Date(u.lastSeen).toLocaleString() : "Never",
        "Type": u.neverReturned ? "Ghost" : "Stalled",
      }));
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Drop-offs");
      if (rows.length > 0) {
        const headers = Object.keys(rows[0]);
        ws.columns = headers.map(h => ({ header: h, key: h, width: 20 }));
        rows.forEach(row => ws.addRow(row));
      }
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aido-dropoffs-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Drop-off Analysis"
        description="Users who signed up but never completed onboarding."
      />

      {/* Funnel */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { label: "Total Signups", value: totalSignups, color: "bg-blue-500" },
          { label: "Never Onboarded", value: totalSignups - onboardedUsers, color: "bg-red-400" },
          { label: "Onboarded", value: onboardedUsers, color: "bg-emerald-500" },
        ].map((step, i, arr) => (
          <React.Fragment key={step.label}>
            <div className="flex-1 min-w-[110px] bg-card border border-border/60 rounded-xl p-4 text-center shadow-sm">
              <div className={`w-2 h-2 rounded-full ${step.color} mx-auto mb-2`} />
              <p className="text-2xl font-bold font-serif">{(step.value ?? 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{step.label}</p>
              {i === 1 && (
                <p className="text-xs font-semibold text-red-500 mt-1">{dropoffRate}% drop-off</p>
              )}
              {i === 2 && (
                <p className="text-xs font-semibold text-emerald-600 mt-1">{conversionRate}% converted</p>
              )}
            </div>
            {i < arr.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center flex-wrap gap-3">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {[
            { label: "All time", value: 0 },
            { label: "7 days", value: 7 },
            { label: "30 days", value: 30 },
            { label: "90 days", value: 90 },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${days === opt.value ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {[
            { label: "All", value: "all" as const },
            { label: "Ghost (never returned)", value: "ghost" as const },
            { label: "Stalled (came back)", value: "stalled" as const },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${filter === opt.value ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <SortAsc className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={sort}
            onChange={e => setSort(e.target.value as typeof sort)}
            className="text-xs bg-muted border-0 rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="most_logins">Most logins</option>
            <option value="least_logins">Fewest logins</option>
          </select>
        </div>

        <Button variant="outline" size="sm" onClick={exportToExcel} disabled={exporting || !data}>
          {exporting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5 mr-1.5" />}
          Export
        </Button>
      </div>

      {/* Summary chips */}
      {data && !isLoading && (
        <div className="flex items-center gap-3 flex-wrap text-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
            <span className="font-semibold text-red-500">{data.neverReturned}</span>
            <span className="text-muted-foreground">ghost users (signed up, never came back)</span>
          </span>
          <span className="text-border">|</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            <span className="font-semibold text-amber-600">{data.cameBack}</span>
            <span className="text-muted-foreground">stalled (returned but never finished)</span>
          </span>
          <span className="text-border">|</span>
          <span className="text-muted-foreground">{filtered.length} shown</span>
        </div>
      )}

      {/* Cohort chart */}
      {data && data.cohorts.length > 0 && (
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-400" />
              Drop-offs by week
            </CardTitle>
            <CardDescription>How many users dropped off each week they signed up</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.cohorts} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={v => {
                    const d = new Date(v);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip
                  formatter={(value, name) => [value, name === "dropoffs" ? "Drop-offs" : "Never returned"]}
                  labelFormatter={v => `Week of ${new Date(v).toLocaleDateString()}`}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="dropoffs" fill="#f87171" radius={[3, 3, 0, 0]} name="dropoffs" />
                <Bar dataKey="neverReturned" fill="#fca5a5" radius={[3, 3, 0, 0]} name="neverReturned" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* User table */}
      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">
            {isLoading ? "Loading…" : `${filtered.length} drop-off users`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <UserX className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No drop-offs in this window.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/30">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Signed up</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Age</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Logins</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(user => <DropoffUserRow key={user.id} user={user} />)}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type UserFilter = "all" | "onboarded" | "not_onboarded" | "new_today";

function UserDirectory() {
  const { getToken } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [userFilter, setUserFilter] = useState<UserFilter>("all");
  const queryClient = useQueryClient();

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const authedFetch = async (url: string) => {
    const token = await getToken();
    return fetch(url, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  };

  const { data, isLoading, error } = useQuery<{ users: AdminUser[]; total: number }>({
    queryKey: ["admin-users", debouncedSearch],
    queryFn: async () => {
      const params = debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : "";
      const r = await authedFetch(`/api/admin/users${params}`);
      if (!r.ok) throw new Error("Failed to fetch users");
      return r.json();
    },
  });

  const exportToExcel = async () => {
    setExporting(true);
    try {
      const r = await authedFetch(`/api/admin/users?limit=10000`);
      if (!r.ok) throw new Error("Failed to fetch");
      const result: { users: AdminUser[] } = await r.json();

      const rows = result.users.map(u => ({
        "First Name": u.firstName,
        "Last Name": u.lastName,
        "Email": u.email ?? "",
        "Clerk ID": u.id,
        "Joined": new Date(u.joinedAt).toLocaleString(),
        "Last Active": u.lastActive ? new Date(u.lastActive).toLocaleString() : "Never",
        "Events Fired": u.eventCount,
        "Has Profile": u.hasProfile ? "Yes" : "No",
        "Onboarded": u.onboarded ? "Yes" : "No",
        "Partner 1": u.partner1Name ?? "",
        "Partner 2": u.partner2Name ?? "",
        "Wedding Date": u.weddingDate ?? "",
        "Venue": u.venue ?? "",
      }));

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Users");
      const colWidths = [14, 14, 28, 32, 20, 20, 12, 12, 12, 18, 18, 14, 24];
      if (rows.length > 0) {
        const headers = Object.keys(rows[0]);
        ws.columns = headers.map((h, i) => ({ header: h, key: h, width: colWidths[i] ?? 14 }));
        rows.forEach(row => ws.addRow(row));
      }
      const today = new Date().toISOString().slice(0, 10);
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aido-users-${today}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
    } finally {
      setExporting(false);
    }
  };

  const allUsers = data?.users ?? [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const users = useMemo(() => {
    return allUsers.filter(u => {
      if (userFilter === "onboarded") return u.onboarded;
      if (userFilter === "not_onboarded") return !u.onboarded;
      if (userFilter === "new_today") return new Date(u.joinedAt) >= today;
      return true;
    });
  }, [allUsers, userFilter]);

  const filterOptions: { key: UserFilter; label: string; icon: React.ElementType; count: number }[] = [
    { key: "all", label: "All Users", icon: Users, count: allUsers.length },
    { key: "onboarded", label: "Onboarded", icon: UserCheck, count: allUsers.filter(u => u.onboarded).length },
    { key: "not_onboarded", label: "Not Onboarded", icon: UserMinus, count: allUsers.filter(u => !u.onboarded).length },
    { key: "new_today", label: "New Today", icon: TrendingUp, count: allUsers.filter(u => new Date(u.joinedAt) >= today).length },
  ];

  return (
    <>
      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onDeleted={() => {
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            queryClient.invalidateQueries({ queryKey: ["admin-metrics"] });
          }}
        />
      )}

      <div className="flex gap-2 flex-wrap mb-4">
        {filterOptions.map(opt => {
          const Icon = opt.icon;
          const active = userFilter === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => setUserFilter(opt.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {opt.label}
              <span className={`ml-0.5 text-xs font-bold ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {isLoading ? "…" : opt.count}
              </span>
            </button>
          );
        })}
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="font-serif text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                {filterOptions.find(f => f.key === userFilter)?.label ?? "Users"}
              </CardTitle>
              <CardDescription className="mt-0.5">
                {data ? `Showing ${users.length} of ${data.total} total user${data.total !== 1 ? "s" : ""}` : "Loading…"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by name or email…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 w-52"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={exportToExcel}
                disabled={exporting || !data || data.total === 0}
                className="gap-1.5 text-xs"
              >
                <FileDown className="h-3.5 w-3.5" />
                {exporting ? "Exporting…" : "Export Excel"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
            </div>
          ) : error ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Failed to load users.</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {search ? "No users match your search." : "No users have signed up yet."}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {users.map(user => {
                const fullName = `${user.firstName} ${user.lastName}`.trim() || "Unknown";
                return (
                  <div
                    key={user.id}
                    className="px-5 py-3.5 flex items-center gap-3 hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => setSelectedUser(user)}
                  >
                    <UserAvatar user={user} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{fullName}</span>
                        {user.onboarded && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold uppercase tracking-wide">
                            Onboarded
                          </span>
                        )}
                        {!user.hasProfile && !user.onboarded && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold uppercase tracking-wide">
                            No profile
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{user.email ?? "—"}</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-5 text-xs text-muted-foreground flex-shrink-0">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(user.joinedAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {timeAgo(user.lastActive)}
                      </span>
                      <span className="text-primary font-medium">{user.eventCount} events</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function OverviewSection({ metrics }: { metrics: AdminMetrics }) {
  const { userMetrics, usageMetrics, systemMetrics, pageViews, userGrowth, onboardingGrowth } = metrics;
  const dropoffs = Math.max(0, userMetrics.totalUsers - userMetrics.onboardedUsers);
  const convRate = userMetrics.totalUsers > 0
    ? Math.round((userMetrics.onboardedUsers / userMetrics.totalUsers) * 100)
    : 0;

  const growthDateSet = new Set([...userGrowth.map(d => d.date), ...onboardingGrowth.map(d => d.date)]);
  const signupsMap = Object.fromEntries(userGrowth.map(d => [d.date, d.count]));
  const onboardedMap = Object.fromEntries(onboardingGrowth.map(d => [d.date, d.count]));
  const chartData = Array.from(growthDateSet).sort().slice(-30).map(date => ({
    date: date.slice(5),
    signups: signupsMap[date] ?? 0,
    onboarded: onboardedMap[date] ?? 0,
  }));

  const funnelSteps = [
    { label: "Website Visits", value: pageViews.total, color: "bg-indigo-500", pct: 100 },
    {
      label: "Signups",
      value: userMetrics.totalUsers,
      color: "bg-primary",
      pct: pageViews.total > 0 ? Math.min(100, Math.round((userMetrics.totalUsers / pageViews.total) * 100)) : 100,
    },
    {
      label: "Onboarded",
      value: userMetrics.onboardedUsers,
      color: "bg-emerald-500",
      pct: userMetrics.totalUsers > 0 ? Math.round((userMetrics.onboardedUsers / Math.max(userMetrics.totalUsers, 1)) * 100) : 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard title="Visits Today" value={pageViews.today} sub="Landing page" icon={Globe} accent />
        <MetricCard title="Visits (7 days)" value={pageViews.week} sub="Landing page" icon={Eye} />
        <MetricCard title="New Signups Today" value={userMetrics.newToday} sub="Clerk accounts" icon={Users} />
        <MetricCard title="Total Signups" value={userMetrics.totalUsers} sub="All time" icon={Users} />
        <MetricCard title="Onboarded" value={userMetrics.onboardedUsers} sub="Completed setup" icon={UserCheck} />
        <MetricCard title="Conversion" value={`${convRate}%`} sub="Signup → onboarded" icon={TrendingUp} />
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <MetricCard title="Active Today (DAU)" value={userMetrics.dau} sub="Logged in today" icon={Activity} />
        <MetricCard title="Active This Week (WAU)" value={userMetrics.wau} sub="Logged in 7 days" icon={Activity} />
        <MetricCard title="Not Onboarded" value={dropoffs} sub="Signed up, no profile" icon={UserMinus} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Growth — Last 30 Days
            </CardTitle>
            <CardDescription>Onboardings completed per day (from profile creation)</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {chartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorOnboarded" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorSignups" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={BRAND} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={BRAND} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="onboarded" stroke="#10b981" fill="url(#colorOnboarded)" name="Onboarded" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="signups" stroke={BRAND} fill="url(#colorSignups)" name="Profile Created" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-primary" />
              Conversion Funnel
            </CardTitle>
            <CardDescription>From website visit to active planner</CardDescription>
          </CardHeader>
          <CardContent className="pt-2 space-y-4">
            {funnelSteps.map((step, i) => (
              <div key={step.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium">{step.label}</span>
                  <span className="text-sm font-bold tabular-nums">{(step.value ?? 0).toLocaleString()}</span>
                </div>
                <div className="h-8 bg-muted rounded-lg overflow-hidden relative">
                  <div
                    className={`h-full ${step.color} rounded-lg transition-all duration-500 flex items-center justify-end pr-3`}
                    style={{ width: `${Math.max(step.pct, 4)}%` }}
                  >
                    <span className="text-white text-xs font-semibold">{step.pct}%</span>
                  </div>
                </div>
                {i < funnelSteps.length - 1 && (
                  <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground pl-1">
                    <ChevronRight className="h-3 w-3 opacity-40" />
                    {i === 0
                      ? `${funnelSteps[1].pct}% of visitors sign up`
                      : `${convRate}% of signups complete onboarding`}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Feature Usage
          </CardTitle>
          <CardDescription>Total times each feature was used across all users</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {usageMetrics.totalEvents === 0 ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No usage data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={usageMetrics.features} layout="vertical" margin={{ top: 0, right: 30, left: 80, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={76} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [v, "Uses"]}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {usageMetrics.features.map((_, i) => (
                    <Cell key={i} fill={BRAND} opacity={0.5 + (i / usageMetrics.features.length) * 0.5} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <MetricCard title="Total Events Tracked" value={systemMetrics.totalEvents} sub="All analytics events" icon={Activity} />
        <MetricCard title="API Errors" value={systemMetrics.apiErrors} sub="In analytics log" icon={AlertCircle} />
        <MetricCard title="New This Month" value={userMetrics.newThisMonth} sub="Clerk signups" icon={Users} />
      </div>
    </div>
  );
}

function UserMetricsSection({ metrics }: { metrics: AdminMetrics }) {
  const { userMetrics } = metrics;
  const dropoffs = Math.max(0, userMetrics.totalUsers - userMetrics.onboardedUsers);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div
          className="rounded-xl p-4 text-center border-2 border-emerald-200 bg-emerald-50 cursor-default"
        >
          <UserCheck className="h-6 w-6 text-emerald-600 mx-auto mb-1" />
          <p className="text-3xl font-bold font-serif text-emerald-700">{userMetrics.onboardedUsers}</p>
          <p className="text-xs text-emerald-600 mt-0.5 font-medium">Onboarded</p>
          <p className="text-xs text-muted-foreground">Completed profile setup</p>
        </div>
        <div className="rounded-xl p-4 text-center border-2 border-amber-200 bg-amber-50 cursor-default">
          <UserMinus className="h-6 w-6 text-amber-600 mx-auto mb-1" />
          <p className="text-3xl font-bold font-serif text-amber-700">{dropoffs}</p>
          <p className="text-xs text-amber-600 mt-0.5 font-medium">Not Onboarded</p>
          <p className="text-xs text-muted-foreground">Signed up, no profile</p>
        </div>
        <div className="rounded-xl p-4 text-center border-2 border-blue-200 bg-blue-50 cursor-default">
          <Users className="h-6 w-6 text-blue-600 mx-auto mb-1" />
          <p className="text-3xl font-bold font-serif text-blue-700">{userMetrics.newToday}</p>
          <p className="text-xs text-blue-600 mt-0.5 font-medium">New Today</p>
          <p className="text-xs text-muted-foreground">Signed up in last 24h</p>
        </div>
      </div>
      <UserDirectory />
    </div>
  );
}

function ProductUsageSection({ metrics }: { metrics: AdminMetrics }) {
  const { usageMetrics } = metrics;
  const featureIcons: Record<string, React.ElementType> = {
    Timeline: CalendarClock,
    "Vendor Email": Mail,
    Checklist: CheckSquare,
    Budget: BudgetIcon,
    "Day-Of Mode": Smartphone,
    "PDF Export": FileDown,
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Product Usage" description="How couples are using each feature across the platform." />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {usageMetrics.features.map(f => {
          const Icon = featureIcons[f.name] ?? Zap;
          return (
            <MetricCard key={f.name} title={f.name} value={f.count} sub="times used" icon={Icon} />
          );
        })}
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <MetricCard title="Total Events Tracked" value={usageMetrics.totalEvents} icon={Activity} accent />
        <MetricCard title="Most Used Feature" value={usageMetrics.mostUsed} icon={TrendingUp} />
        <MetricCard title="Least Used Feature" value={usageMetrics.leastUsed === "—" ? "N/A" : usageMetrics.leastUsed} icon={BarChart2} />
      </div>
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-lg">Feature Usage Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          {usageMetrics.totalEvents === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
              No usage data yet. Features will appear here as users interact with the app.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={usageMetrics.features}
                layout="vertical"
                margin={{ top: 4, right: 20, left: 60, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F0E8F0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}
                  formatter={(v: number) => [v, "Uses"]}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {usageMetrics.features.map((_, i) => (
                    <Cell key={i} fill={BRAND} opacity={0.55 + (i / usageMetrics.features.length) * 0.45} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MoneySection({ metrics }: { metrics: AdminMetrics }) {
  const { moneyMetrics } = metrics;
  return (
    <div className="space-y-6">
      <SectionHeader title="Money Metrics" description="Revenue, subscriptions, and financial health." />
      <Card className="border border-amber-200 bg-amber-50 shadow-none">
        <CardContent className="p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">{moneyMetrics.note}</p>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { title: "Total Revenue", value: `$${(moneyMetrics.totalRevenue ?? 0).toLocaleString()}` },
          { title: "MRR", value: `$${(moneyMetrics.mrr ?? 0).toLocaleString()}` },
          { title: "ARR", value: `$${(moneyMetrics.arr ?? 0).toLocaleString()}` },
          { title: "ARPU", value: `$${moneyMetrics.arpu.toFixed(2)}` },
          { title: "LTV", value: `$${moneyMetrics.ltv.toFixed(2)}` },
          { title: "Churn Rate", value: `${moneyMetrics.churnRate}%` },
        ].map(m => (
          <Card key={m.title} className="border-none shadow-sm bg-card">
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{m.title}</p>
              <p className="text-2xl font-bold font-serif text-foreground">{m.value}</p>
              <p className="text-xs text-muted-foreground mt-1">Not yet configured</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <MetricCard title="Failed Payments" value={moneyMetrics.failedPayments} icon={AlertCircle} />
        <Card className="border-none shadow-sm bg-card">
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Trial-to-Paid Conversion</p>
            <p className="text-2xl font-bold font-serif text-foreground">—</p>
            <p className="text-xs text-muted-foreground mt-1">Requires payment integration</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SystemSection({ metrics }: { metrics: AdminMetrics }) {
  const { systemMetrics } = metrics;
  const hasDeviceData = systemMetrics.deviceBreakdown.length > 0;

  return (
    <div className="space-y-6">
      <SectionHeader title="System Health" description="Errors, device breakdown, and platform performance." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Total Events" value={systemMetrics.totalEvents} icon={Activity} accent />
        <MetricCard title="API Errors" value={systemMetrics.apiErrors} sub="Tracked errors" icon={AlertCircle} />
        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Uptime</p>
            <p className="text-3xl font-bold font-serif text-emerald-600">99.9%</p>
            <p className="text-xs text-muted-foreground mt-1">Estimated</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Avg Response Time</p>
            <p className="text-3xl font-bold font-serif text-foreground">&lt;200ms</p>
            <p className="text-xs text-muted-foreground mt-1">Estimated</p>
          </CardContent>
        </Card>
      </div>
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-lg">Device Breakdown</CardTitle>
          <CardDescription>Based on tracked metadata. Only populated when device info is sent.</CardDescription>
        </CardHeader>
        <CardContent>
          {!hasDeviceData ? (
            <p className="text-sm text-muted-foreground py-4">No device data tracked yet.</p>
          ) : (
            <div className="space-y-3">
              {systemMetrics.deviceBreakdown.map(d => {
                const total = systemMetrics.deviceBreakdown.reduce((a, b) => a + b.count, 0);
                const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
                return (
                  <div key={d.device} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{d.device}</span>
                      <span className="text-muted-foreground">{d.count} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EventLogSection({ events, isLoading }: { events: AdminEvent[]; isLoading: boolean }) {
  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }
  return (
    <div className="space-y-6">
      <SectionHeader title="Event Log" description="Real-time record of every tracked user action across the platform." />
      <Card className="border-none shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary/5 border-b border-primary/10">
                <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Time</th>
                <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Event</th>
                <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">User ID</th>
                <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    No events yet. Start using the app to generate tracking data.
                  </td>
                </tr>
              ) : (
                events.map(event => (
                  <tr key={event.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap font-mono">
                      {new Date(event.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${EVENT_COLORS[event.eventType] ?? "bg-gray-100 text-gray-700"}`}>
                        {EVENT_LABELS[event.eventType] ?? event.eventType}
                      </span>
                    </td>
                    <td className="p-3 text-xs font-mono text-muted-foreground max-w-[140px] truncate">
                      {event.userId.slice(0, 20)}…
                    </td>
                    <td className="p-3 text-xs text-muted-foreground font-mono max-w-[200px] truncate">
                      {event.metadata ? JSON.stringify(event.metadata) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

interface HelpMessage {
  id: number;
  userId: string | null;
  name: string;
  email: string;
  subject: string;
  message: string;
  isRead: boolean;
  isResolved: boolean;
  createdAt: string;
}

interface FeedbackItem {
  id: number;
  userId: string | null;
  rating: number | null;
  category: string | null;
  message: string;
  isRead: boolean;
  isResolved: boolean;
  createdAt: string;
}

const CATEGORY_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  bug: { label: "Bug Report", icon: Bug, color: "text-red-600 bg-red-50" },
  feature: { label: "Feature Request", icon: Lightbulb, color: "text-amber-600 bg-amber-50" },
  general: { label: "General Feedback", icon: ThumbsUp, color: "text-blue-600 bg-blue-50" },
  praise: { label: "Something I Love", icon: Heart, color: "text-rose-600 bg-rose-50" },
};

function MessagesSection() {
  const { getToken } = useAuth();
  const [subTab, setSubTab] = useState<"contact" | "feedback">("contact");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const queryClient = useQueryClient();

  const authedFetch = async (url: string, init: RequestInit = {}) => {
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

  const { data, isLoading } = useQuery({
    queryKey: ["admin-messages"],
    queryFn: async () => {
      const r = await authedFetch("/api/help/messages");
      if (!r.ok) throw new Error("Fetch failed");
      return r.json() as Promise<{ contacts: HelpMessage[]; feedback: FeedbackItem[]; unreadCount: number }>;
    },
    refetchInterval: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: async ({ type, id }: { type: "contact" | "feedback"; id: number }) => {
      await authedFetch(`/api/help/messages/${type}/${id}/read`, { method: "PATCH" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-messages"] }),
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ type, id, resolved }: { type: "contact" | "feedback"; id: number; resolved: boolean }) => {
      await authedFetch(`/api/help/messages/${type}/${id}/resolve`, {
        method: "PATCH",
        body: JSON.stringify({ resolved }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-messages"] }),
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async ({ type, id }: { type: "contact" | "feedback"; id: number }) => {
      const r = await authedFetch(`/api/help/messages/${type}/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-messages"] }),
  });

  const handleExpand = (id: number, type: "contact" | "feedback") => {
    setExpanded(prev => {
      if (prev === id) return null;
      markReadMutation.mutate({ type, id });
      return id;
    });
  };

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>;
  }

  const allContacts = data?.contacts ?? [];
  const allFeedback = data?.feedback ?? [];
  const contacts = showResolved ? allContacts : allContacts.filter(c => !c.isResolved);
  const feedback = showResolved ? allFeedback : allFeedback.filter(f => !f.isResolved);
  const unreadC = allContacts.filter(c => !c.isRead && !c.isResolved).length;
  const unreadF = allFeedback.filter(f => !f.isRead && !f.isResolved).length;
  const resolvedCount = allContacts.filter(c => c.isResolved).length + allFeedback.filter(f => f.isResolved).length;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Messages & Feedback"
        description="Contact requests and user feedback submitted through the Help page."
      />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setSubTab("contact")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border
              ${subTab === "contact" ? "bg-primary text-white border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}
          >
            <Mail className="h-4 w-4" />
            Contact Messages
            {unreadC > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 leading-none font-bold min-w-[18px] text-center
                ${subTab === "contact" ? "bg-white/20 text-white" : "bg-primary/15 text-primary"}`}>
                {unreadC}
              </span>
            )}
          </button>
          <button
            onClick={() => setSubTab("feedback")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border
              ${subTab === "feedback" ? "bg-primary text-white border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}
          >
            <MessageSquare className="h-4 w-4" />
            Feedback
            {unreadF > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 leading-none font-bold min-w-[18px] text-center
                ${subTab === "feedback" ? "bg-white/20 text-white" : "bg-primary/15 text-primary"}`}>
                {unreadF}
              </span>
            )}
          </button>
        </div>

        {resolvedCount > 0 && (
          <button
            onClick={() => setShowResolved(s => !s)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border
              ${showResolved ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30"}`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {showResolved ? "Hiding resolved" : `Show resolved (${resolvedCount})`}
          </button>
        )}
      </div>

      {subTab === "contact" && (
        <div className="space-y-2">
          {contacts.length === 0 ? (
            <Card className="border-none shadow-sm">
              <CardContent className="py-12 text-center text-muted-foreground">
                <Inbox className="h-10 w-10 mx-auto mb-3 opacity-30" />
                {allContacts.length === 0 ? "No contact messages yet." : "All messages are resolved."}
              </CardContent>
            </Card>
          ) : (
            contacts.map(msg => (
              <Card
                key={msg.id}
                className={`border-none shadow-sm overflow-hidden transition-all
                  ${msg.isResolved ? "opacity-60" : !msg.isRead ? "ring-1 ring-primary/30" : ""}`}
              >
                <button
                  className="w-full text-left px-5 py-4 hover:bg-muted/20 transition-colors"
                  onClick={() => handleExpand(msg.id, "contact")}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {!msg.isRead && !msg.isResolved && (
                        <Circle className="h-2 w-2 fill-primary text-primary flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-medium text-sm truncate ${!msg.isRead && !msg.isResolved ? "text-foreground" : "text-muted-foreground"}`}>
                            {msg.subject}
                          </p>
                          {msg.isResolved && (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex-shrink-0">
                              Resolved
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {msg.name} &lt;{msg.email}&gt;
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                      {new Date(msg.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </button>
                {expanded === msg.id && (
                  <div className="px-5 pb-4 pt-0 border-t border-border/30 bg-muted/5">
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3 mt-3">
                      <span><strong>From:</strong> {msg.name}</span>
                      <span><strong>Email:</strong> {msg.email}</span>
                      <span><strong>Submitted:</strong> {new Date(msg.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-lg p-3">
                      {msg.message}
                    </p>
                    <div className="mt-3 flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={e => { e.stopPropagation(); if (confirm("Delete this message? This cannot be undone.")) deleteMessageMutation.mutate({ type: "contact", id: msg.id }); }}
                        disabled={deleteMessageMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                      <Button
                        size="sm"
                        variant={msg.isResolved ? "outline" : "default"}
                        className={`gap-1.5 ${msg.isResolved ? "" : "bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"}`}
                        onClick={e => { e.stopPropagation(); resolveMutation.mutate({ type: "contact", id: msg.id, resolved: !msg.isResolved }); }}
                        disabled={resolveMutation.isPending}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {msg.isResolved ? "Mark as Open" : "Mark as Resolved"}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      )}

      {subTab === "feedback" && (
        <div className="space-y-2">
          {feedback.length === 0 ? (
            <Card className="border-none shadow-sm">
              <CardContent className="py-12 text-center text-muted-foreground">
                <Star className="h-10 w-10 mx-auto mb-3 opacity-30" />
                {allFeedback.length === 0 ? "No feedback submissions yet." : "All feedback is resolved."}
              </CardContent>
            </Card>
          ) : (
            feedback.map(item => {
              const catMeta = item.category ? CATEGORY_META[item.category] : null;
              const CatIcon = catMeta?.icon ?? MessageSquare;
              return (
                <Card
                  key={item.id}
                  className={`border-none shadow-sm overflow-hidden transition-all
                    ${item.isResolved ? "opacity-60" : !item.isRead ? "ring-1 ring-primary/30" : ""}`}
                >
                  <button
                    className="w-full text-left px-5 py-4 hover:bg-muted/20 transition-colors"
                    onClick={() => handleExpand(item.id, "feedback")}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        {!item.isRead && !item.isResolved && (
                          <Circle className="h-2 w-2 fill-primary text-primary flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex items-center gap-2 flex-wrap">
                          {catMeta && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${catMeta.color}`}>
                              <CatIcon className="h-3 w-3" />
                              {catMeta.label}
                            </span>
                          )}
                          {item.rating != null && (
                            <span className="flex items-center gap-0.5 text-amber-500 text-xs font-medium">
                              {"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}
                            </span>
                          )}
                          {item.isResolved && (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                              Resolved
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 truncate px-5 -mx-5">
                      {item.message.slice(0, 80)}{item.message.length > 80 ? "…" : ""}
                    </p>
                  </button>
                  {expanded === item.id && (
                    <div className="px-5 pb-4 pt-0 border-t border-border/30 bg-muted/5">
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-lg p-3 mt-3">
                        {item.message}
                      </p>
                      <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                        <p className="text-xs text-muted-foreground">
                          Submitted: {new Date(item.createdAt).toLocaleString()}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={e => { e.stopPropagation(); if (confirm("Delete this feedback? This cannot be undone.")) deleteMessageMutation.mutate({ type: "feedback", id: item.id }); }}
                            disabled={deleteMessageMutation.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </Button>
                          <Button
                            size="sm"
                            variant={item.isResolved ? "outline" : "default"}
                            className={`gap-1.5 ${item.isResolved ? "" : "bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"}`}
                            onClick={e => { e.stopPropagation(); resolveMutation.mutate({ type: "feedback", id: item.id, resolved: !item.isResolved }); }}
                            disabled={resolveMutation.isPending}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {item.isResolved ? "Mark as Open" : "Mark as Resolved"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

const DEFAULT_SUBJECT = "Join A.IDO — Your AI Wedding Planning Assistant";
const DEFAULT_BODY = `Hi there,

I'm reaching out to share something I've been building that I think you'll find helpful. It's called A.IDO, an AI wedding-planning assistant designed to make planning easier, clearer, and way less stressful.

You can use it to create timelines, manage vendors, track budgets, organize communication, and more — all in one simple place.

If you'd like to try it out, here's the link to join the beta: https://www.aidowedding.net

Would love to hear your feedback.

Thanks,
Joseph
Founder, A.IDO`;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmails(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map(e => e.trim())
    .filter(e => EMAIL_RE.test(e));
}

interface SendResult {
  email: string;
  ok: boolean;
  error?: string;
}

function MarketingOutreachSection() {
  const { getToken } = useAuth();
  const [emailsRaw, setEmailsRaw] = useState("");
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResults, setSendResults] = useState<SendResult[] | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const parsedEmails = parseEmails(emailsRaw);

  const authedFetch = async (url: string, opts: RequestInit = {}) => {
    const token = await getToken();
    return fetch(url, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...opts,
    });
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const r = await authedFetch("/api/admin/marketing/generate", { method: "POST" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(j.error ?? "Generate failed");
      }
      const { subject: s, body: b } = await r.json() as { subject: string; body: string };
      if (s) setSubject(s);
      if (b) setBody(b);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to generate template");
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    if (parsedEmails.length === 0) {
      setSendError("No valid email addresses to send to.");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setSendError("Subject and body are required.");
      return;
    }
    setSending(true);
    setSendError(null);
    setSendResults(null);
    try {
      const r = await authedFetch("/api/admin/marketing/send", {
        method: "POST",
        body: JSON.stringify({ emails: parsedEmails, subject, body }),
      });
      const json = await r.json() as { results?: SendResult[]; error?: string; succeeded?: number; failed?: number };
      if (!r.ok || json.error) throw new Error(json.error ?? "Send failed");
      setSendResults(json.results ?? []);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send emails");
    } finally {
      setSending(false);
    }
  };

  const succeeded = sendResults?.filter(r => r.ok).length ?? 0;
  const failed = sendResults?.filter(r => !r.ok).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-serif text-primary flex items-center gap-2">
            <Megaphone className="h-6 w-6" />
            Marketing Outreach
          </h2>
          <p className="text-muted-foreground mt-1">Send personalized invitations to potential users and vendors.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-primary/5 rounded-lg px-3 py-2">
          <Mail className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          Sends individually — no CC/BCC
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Recipients
              </CardTitle>
              <CardDescription>Enter email addresses — one per line, or comma-separated</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                value={emailsRaw}
                onChange={e => {
                  setEmailsRaw(e.target.value);
                  setSendResults(null);
                  setSendError(null);
                }}
                placeholder={"jane@example.com\njohn@example.com, vendor@company.com"}
                rows={5}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none font-mono"
              />
              {emailsRaw.trim().length > 0 && (
                <div className="space-y-1">
                  {parsedEmails.length > 0 ? (
                    <>
                      <p className="text-xs font-semibold text-emerald-600">{parsedEmails.length} valid email{parsedEmails.length !== 1 ? "s" : ""} found</p>
                      <div className="flex flex-wrap gap-1.5">
                        {parsedEmails.map(email => (
                          <span key={email} className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-2 py-0.5 rounded-full">
                            {email}
                            <button
                              onClick={() => {
                                const newRaw = emailsRaw.split(/[\n,;]+/).filter(e => e.trim() !== email).join("\n");
                                setEmailsRaw(newRaw);
                              }}
                              className="hover:text-red-500 transition-colors"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-amber-600">No valid emails detected yet.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {sendResults && (
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  {failed === 0 ? (
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  Send Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-3 text-sm">
                  <span className="text-emerald-600 font-semibold">{succeeded} sent</span>
                  {failed > 0 && <span className="text-red-600 font-semibold">{failed} failed</span>}
                </div>
                <div className="space-y-1.5">
                  {sendResults.map(r => (
                    <div key={r.email} className={`flex items-center gap-2 text-xs rounded-lg px-3 py-1.5 ${r.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
                      {r.ok ? <CheckCircle className="h-3 w-3 flex-shrink-0" /> : <XCircle className="h-3 w-3 flex-shrink-0" />}
                      <span className="font-mono truncate">{r.email}</span>
                      {!r.ok && r.error && <span className="ml-auto text-red-600 flex-shrink-0">{r.error}</span>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {sendError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <XCircle className="h-4 w-4 flex-shrink-0" />
              {sendError}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    Email Template
                  </CardTitle>
                  <CardDescription>Edit the subject and body before sending</CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/5"
                >
                  {generating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {generating ? "Generating…" : "Generate AI Template"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
                  placeholder="Email subject line"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Body</label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={14}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none leading-relaxed"
                  placeholder="Email body…"
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-muted-foreground">
                  {body.split(/\s+/).filter(Boolean).length} words
                </p>
                <Button
                  onClick={handleSend}
                  disabled={sending || parsedEmails.length === 0 || !subject.trim() || !body.trim()}
                  className="gap-2 bg-primary hover:bg-primary/90"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {sending
                    ? "Sending…"
                    : parsedEmails.length === 0
                      ? "Add recipients first"
                      : `Send to ${parsedEmails.length} recipient${parsedEmails.length !== 1 ? "s" : ""}`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

interface ArchiveEntry {
  id: number;
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  deletedAt: string;
  restoredAt: string | null;
  restoredToUserId: string | null;
}

interface ArchiveSummary {
  profile: boolean;
  guests: number;
  vendors: number;
  timelines: number;
  checklistItems: number;
  budgets: boolean;
  vendorContracts: number;
  weddingParty: number;
}

function archiveSummary(archivedData: Record<string, unknown>): ArchiveSummary {
  const arr = (k: string) => Array.isArray(archivedData[k]) ? (archivedData[k] as unknown[]).length : 0;
  return {
    profile: !!archivedData.profile,
    guests: arr("guests"),
    vendors: arr("vendors"),
    timelines: arr("timelines"),
    checklistItems: arr("checklistItems"),
    budgets: arr("budgets") > 0,
    vendorContracts: arr("vendorContracts"),
    weddingParty: arr("weddingParty"),
  };
}

function DeletedArchiveSection() {
  const { getToken } = useAuth();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [restoreId, setRestoreId] = useState<number | null>(null);
  const [newUserId, setNewUserId] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<{ ok: boolean; restored?: Record<string, number>; error?: string } | null>(null);
  const [fullData, setFullData] = useState<Record<number, Record<string, unknown>>>({});
  const [loadingFull, setLoadingFull] = useState<number | null>(null);

  const authedFetch = async (url: string, opts: RequestInit = {}) => {
    const token = await getToken();
    return fetch(url, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...opts,
    });
  };

  const { data, isLoading, refetch } = useQuery<{ archives: ArchiveEntry[] }>({
    queryKey: ["admin-archive"],
    queryFn: async () => {
      const r = await authedFetch("/api/admin/archive");
      if (!r.ok) throw new Error("Failed to load archive");
      return r.json();
    },
  });

  const loadFull = async (id: number) => {
    if (fullData[id]) return;
    setLoadingFull(id);
    try {
      const r = await authedFetch(`/api/admin/archive/${id}`);
      if (!r.ok) throw new Error("Failed to load archive detail");
      const j = await r.json() as { archive: { archivedData: Record<string, unknown> } };
      setFullData(prev => ({ ...prev, [id]: j.archive.archivedData }));
    } catch {
    } finally {
      setLoadingFull(null);
    }
  };

  const handleExpand = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      await loadFull(id);
    }
  };

  const handleRestore = async (archiveId: number) => {
    if (!newUserId.trim()) return;
    setRestoring(true);
    setRestoreResult(null);
    try {
      const r = await authedFetch(`/api/admin/archive/${archiveId}/restore`, {
        method: "POST",
        body: JSON.stringify({ newUserId: newUserId.trim() }),
      });
      const j = await r.json() as { ok?: boolean; restored?: Record<string, number>; error?: string };
      if (!r.ok || j.error) {
        setRestoreResult({ ok: false, error: j.error ?? "Restore failed" });
      } else {
        setRestoreResult({ ok: true, restored: j.restored });
        refetch();
      }
    } catch {
      setRestoreResult({ ok: false, error: "Network error" });
    } finally {
      setRestoring(false);
    }
  };

  const exportJson = (entry: ArchiveEntry, archivedData: Record<string, unknown>) => {
    const blob = new Blob([JSON.stringify({ ...entry, archivedData }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aido-archive-${entry.userId}-${entry.deletedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const archives = data?.archives ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-serif text-primary flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Deleted User Archive
          </h2>
          <p className="text-muted-foreground mt-1">
            Every user deletion is fully archived here — profile, guests, vendors, timeline, budget, and more. You can restore it all to a new account at any time.
          </p>
        </div>
        {archives.length > 0 && (
          <div className="flex items-center gap-2 text-sm font-medium bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {archives.filter(a => !a.restoredAt).length} awaiting potential restore
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : archives.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Shield className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No archived users yet</p>
          <p className="text-sm mt-1">When a user deletes their account, their full data snapshot will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {archives.map(entry => {
            const isExpanded = expandedId === entry.id;
            const isRestored = !!entry.restoredAt;
            const full = fullData[entry.id];
            const summary = full ? archiveSummary(full) : null;
            const name = [entry.firstName, entry.lastName].filter(Boolean).join(" ") || "Unknown User";
            const isRestoringThis = restoreId === entry.id;

            return (
              <Card key={entry.id} className={`border-none shadow-sm overflow-hidden transition-all ${isRestored ? "opacity-60" : ""}`}>
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => handleExpand(entry.id)}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${isRestored ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {isRestored ? "✓" : (name[0] ?? "?")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{name}</span>
                      {isRestored ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold uppercase tracking-wide">Restored</span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold uppercase tracking-wide">Archived</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{entry.email ?? entry.userId}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-5 text-xs text-muted-foreground flex-shrink-0">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Deleted {new Date(entry.deletedAt).toLocaleDateString()}
                    </span>
                    {isRestored && entry.restoredAt && (
                      <span className="flex items-center gap-1 text-emerald-600">
                        <CheckCircle className="h-3 w-3" />
                        Restored {new Date(entry.restoredAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {isExpanded ? <ChevronUpIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronDownIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                </div>

                {isExpanded && (
                  <div className="border-t border-border/40 px-5 py-4 bg-muted/10 space-y-4">
                    {loadingFull === entry.id ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading archive data…
                      </div>
                    ) : summary ? (
                      <>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">What's Archived</p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {[
                              { label: "Wedding Profile", value: summary.profile ? "Yes" : "None", ok: summary.profile },
                              { label: "Guests", value: summary.guests, ok: summary.guests > 0 },
                              { label: "Vendors", value: summary.vendors, ok: summary.vendors > 0 },
                              { label: "Timeline", value: summary.timelines > 0 ? "Yes" : "None", ok: summary.timelines > 0 },
                              { label: "Checklist Items", value: summary.checklistItems, ok: summary.checklistItems > 0 },
                              { label: "Budget", value: summary.budgets ? "Yes" : "None", ok: summary.budgets },
                              { label: "Contracts", value: summary.vendorContracts, ok: summary.vendorContracts > 0 },
                              { label: "Wedding Party", value: summary.weddingParty, ok: summary.weddingParty > 0 },
                            ].map(s => (
                              <div key={s.label} className={`rounded-lg p-2.5 text-center text-xs ${s.ok ? "bg-emerald-50 text-emerald-800" : "bg-muted/40 text-muted-foreground"}`}>
                                <p className="font-bold text-base">{s.value}</p>
                                <p className="text-[10px] mt-0.5">{s.label}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs"
                            onClick={() => exportJson(entry, full)}
                          >
                            <FileDown className="h-3.5 w-3.5" />
                            Export Full JSON
                          </Button>
                          {!isRestored && (
                            <Button
                              size="sm"
                              className="gap-1.5 text-xs bg-primary hover:bg-primary/90"
                              onClick={() => {
                                setRestoreId(isRestoringThis ? null : entry.id);
                                setNewUserId("");
                                setRestoreResult(null);
                              }}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              Restore to Account
                            </Button>
                          )}
                        </div>

                        {isRestoringThis && !isRestored && (
                          <div className="border border-primary/20 rounded-xl p-4 bg-primary/5 space-y-3">
                            <p className="text-sm font-medium text-primary">Enter the new Clerk User ID to restore data to:</p>
                            <p className="text-xs text-muted-foreground">This is the Clerk ID of the user's new account (starts with <code className="bg-muted px-1 py-0.5 rounded text-[10px]">user_</code>). All their data will be re-created under this account.</p>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="user_2aBcDeFgHiJkLmNoPqRs"
                                value={newUserId}
                                onChange={e => setNewUserId(e.target.value)}
                                className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 font-mono"
                              />
                              <Button
                                size="sm"
                                disabled={!newUserId.trim() || restoring}
                                onClick={() => handleRestore(entry.id)}
                                className="gap-1.5 bg-primary hover:bg-primary/90 whitespace-nowrap"
                              >
                                {restoring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                {restoring ? "Restoring…" : "Restore Now"}
                              </Button>
                            </div>
                            {restoreResult && (
                              <div className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2.5 ${restoreResult.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                                {restoreResult.ok ? <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                                <div>
                                  {restoreResult.ok ? (
                                    <>
                                      <p className="font-semibold">Restore complete!</p>
                                      <p className="text-xs mt-0.5">
                                        {Object.entries(restoreResult.restored ?? {}).map(([k, v]) => `${v} ${k}`).join(", ")} restored.
                                      </p>
                                    </>
                                  ) : (
                                    <p>{restoreResult.error}</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {isRestored && entry.restoredToUserId && (
                          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                            <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
                            Restored to account <code className="font-mono bg-emerald-100 px-1 py-0.5 rounded">{entry.restoredToUserId}</code> on {new Date(entry.restoredAt!).toLocaleDateString()}
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const { getToken, isSignedIn } = useAuth();

  const adminFetch = async (url: string) => {
    const token = await getToken();
    return fetch(url, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  };

  const { data: adminCheck, isLoading: checkLoading } = useQuery({
    queryKey: ["admin-check"],
    queryFn: async () => {
      const r = await adminFetch("/api/admin/check");
      return r.json() as Promise<{ isAdmin: boolean }>;
    },
    enabled: !!isSignedIn,
    staleTime: 60000,
  });

  const { data: metrics, isLoading: metricsLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-metrics"],
    queryFn: async () => {
      const r = await adminFetch("/api/admin/metrics");
      if (!r.ok) throw new Error("Failed to fetch metrics");
      return r.json() as Promise<AdminMetrics>;
    },
    enabled: adminCheck?.isAdmin === true,
    staleTime: 30000,
  });

  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ["admin-events"],
    queryFn: async () => {
      const r = await adminFetch("/api/admin/events?page=1");
      if (!r.ok) throw new Error("Failed to fetch events");
      return r.json() as Promise<{ events: AdminEvent[]; total: number }>;
    },
    enabled: adminCheck?.isAdmin === true,
    staleTime: 15000,
  });

  if (checkLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  if (!adminCheck?.isAdmin) {
    return (
      <div className="max-w-2xl mx-auto text-center py-24 space-y-6">
        <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
          <Shield className="h-10 w-10 text-destructive" />
        </div>
        <h1 className="text-3xl font-serif text-foreground">Access Restricted</h1>
        <p className="text-muted-foreground">
          The Operations Center is only accessible to admin accounts. If you're the platform owner, ask a current admin to promote your account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-4xl font-serif text-primary flex items-center gap-3">
              <Shield className="h-8 w-8" />
              Operations Center
            </h1>
            <Badge className="bg-primary/10 text-primary border-primary/20">Admin</Badge>
          </div>
          <p className="text-lg text-muted-foreground">Full platform visibility — users, usage, revenue, and system health.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Quick stats row */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { label: "Visits Today", value: metrics.pageViews?.today ?? 0, accent: true },
            { label: "New Signups Today", value: metrics.userMetrics.newToday, accent: false },
            { label: "Total Signups", value: metrics.userMetrics.totalUsers, accent: false },
            { label: "Onboarded", value: metrics.userMetrics.onboardedUsers, accent: false },
            { label: "Conversion", value: `${metrics.userMetrics.totalUsers > 0 ? Math.round((metrics.userMetrics.onboardedUsers / metrics.userMetrics.totalUsers) * 100) : 0}%`, accent: false },
            { label: "DAU", value: metrics.userMetrics.dau, accent: false },
          ].map(s => (
            <div key={s.label} className={`rounded-xl p-3 text-center ${s.accent ? "bg-primary text-primary-foreground" : "bg-primary/5"}`}>
              <p className={`text-2xl font-bold font-serif ${s.accent ? "text-primary-foreground" : "text-primary"}`}>{s.value}</p>
              <p className={`text-xs mt-1 ${s.accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex gap-1 p-1 bg-muted/40 rounded-xl overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                ${isActive
                  ? "bg-card shadow text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                }
              `}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {isActive && <ChevronRight className="h-3 w-3 opacity-50" />}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div>
        {metricsLoading && activeTab !== "events" && activeTab !== "messages" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-24" />)}
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Skeleton className="h-64" />
              <Skeleton className="h-64" />
            </div>
            <Skeleton className="h-48 w-full" />
          </div>
        )}

        {!metricsLoading && metrics && (
          <>
            {activeTab === "overview" && <OverviewSection metrics={metrics} />}
            {activeTab === "users" && <UserMetricsSection metrics={metrics} />}
            {activeTab === "engagement" && <ProductUsageSection metrics={metrics} />}
          </>
        )}

        {activeTab === "marketing" && <MarketingOutreachSection />}
        {activeTab === "archive" && <DeletedArchiveSection />}

        {activeTab === "events" && (
          <EventLogSection events={eventsData?.events ?? []} isLoading={eventsLoading} />
        )}

        {activeTab === "messages" && <MessagesSection />}
      </div>
    </div>
  );
}
