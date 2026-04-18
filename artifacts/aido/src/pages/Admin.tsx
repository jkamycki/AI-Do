import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Users, TrendingUp, Zap, Shield, BarChart2, DollarSign,
  AlertCircle, RefreshCw, CalendarClock, Mail, CheckSquare,
  Smartphone, FileDown, DollarSign as BudgetIcon, Activity,
  ChevronRight,
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
  { key: "users", label: "User Metrics", icon: Users },
  { key: "usage", label: "Product Usage", icon: Zap },
  { key: "money", label: "Money Metrics", icon: DollarSign },
  { key: "system", label: "System Health", icon: Shield },
  { key: "events", label: "Event Log", icon: Activity },
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
};

const EVENT_COLORS: Record<string, string> = {
  user_signup: "bg-emerald-100 text-emerald-700",
  user_login: "bg-blue-100 text-blue-700",
  onboarding_completed: "bg-purple-100 text-purple-700",
  timeline_generated: "bg-pink-100 text-pink-700",
  vendor_email_generated: "bg-orange-100 text-orange-700",
  checklist_item_completed: "bg-teal-100 text-teal-700",
  budget_updated: "bg-amber-100 text-amber-700",
  day_of_mode_activated: "bg-indigo-100 text-indigo-700",
  pdf_exported: "bg-rose-100 text-rose-700",
  api_error: "bg-red-100 text-red-700",
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

function UserMetricsSection({ metrics }: { metrics: AdminMetrics }) {
  const { userMetrics, userGrowth } = metrics;
  const growthData = userGrowth.length > 0
    ? userGrowth.map(d => ({ date: d.date.slice(5), count: d.count }))
    : [];

  return (
    <div className="space-y-6">
      <SectionHeader title="User Metrics" description="Registration, activity, and retention across the platform." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Total Users" value={userMetrics.totalUsers} icon={Users} accent />
        <MetricCard title="DAU" value={userMetrics.dau} sub="Daily active" icon={TrendingUp} />
        <MetricCard title="WAU" value={userMetrics.wau} sub="Weekly active" icon={TrendingUp} />
        <MetricCard title="MAU" value={userMetrics.mau} sub="Monthly active" icon={TrendingUp} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <MetricCard title="New Today" value={userMetrics.newToday} icon={Users} />
        <MetricCard title="New This Week" value={userMetrics.newThisWeek} icon={Users} />
        <MetricCard title="New This Month" value={userMetrics.newThisMonth} icon={Users} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <MetricCard
          title="Onboarding Completion Rate"
          value={`${userMetrics.onboardingCompletionRate}%`}
          sub="Users who completed profile setup"
          icon={CheckSquare}
        />
        <MetricCard
          title="Total Signups (All Time)"
          value={userMetrics.totalSignups}
          sub="Users who created a profile"
          icon={Users}
        />
      </div>
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-lg">New User Signups — Last 30 Days</CardTitle>
        </CardHeader>
        <CardContent>
          {growthData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
              No signup data yet. Data will appear as users register.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={growthData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}
                  formatter={(v: number) => [v, "New Users"]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {growthData.map((_, i) => (
                    <Cell key={i} fill={BRAND} opacity={0.7 + (i / growthData.length) * 0.3} />
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
          { title: "Total Revenue", value: `$${moneyMetrics.totalRevenue.toLocaleString()}` },
          { title: "MRR", value: `$${moneyMetrics.mrr.toLocaleString()}` },
          { title: "ARR", value: `$${moneyMetrics.arr.toLocaleString()}` },
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

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("users");
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Total Users", value: metrics.userMetrics.totalUsers },
            { label: "DAU", value: metrics.userMetrics.dau },
            { label: "Events Tracked", value: metrics.systemMetrics.totalEvents },
            { label: "PDFs Exported", value: metrics.usageMetrics.pdfExports },
            { label: "Timelines Gen.", value: metrics.usageMetrics.timelinesGenerated },
          ].map(s => (
            <div key={s.label} className="bg-primary/5 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold font-serif text-primary">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
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
        {metricsLoading && activeTab !== "events" && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        )}

        {!metricsLoading && metrics && (
          <>
            {activeTab === "users" && <UserMetricsSection metrics={metrics} />}
            {activeTab === "usage" && <ProductUsageSection metrics={metrics} />}
            {activeTab === "money" && <MoneySection metrics={metrics} />}
            {activeTab === "system" && <SystemSection metrics={metrics} />}
          </>
        )}

        {activeTab === "events" && (
          <EventLogSection events={eventsData?.events ?? []} isLoading={eventsLoading} />
        )}
      </div>
    </div>
  );
}
