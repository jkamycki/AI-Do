import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  Clock,
  DollarSign,
  FileText,
  Search,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/authFetch";
import { useWorkspace, type WorkspaceInfo } from "@/contexts/WorkspaceContext";

interface PlannerWorkspace {
  profileId: number;
  role: string;
  workstationName?: string | null;
  partner1Name: string;
  partner2Name: string;
  weddingDate: string;
  accountType?: string;
}

interface WorkspacesData {
  ownProfile: PlannerWorkspace | null;
  ownWorkspaces?: PlannerWorkspace[];
  accountType?: string;
  sharedWorkspaces: PlannerWorkspace[];
}

function clientName(ws: PlannerWorkspace) {
  return ws.workstationName?.trim() || `${ws.partner2Name} & ${ws.partner1Name}`;
}

function formatDate(date: string) {
  if (!date) return "No date set";
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysUntil(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);
  return Math.ceil((parsed.getTime() - today.getTime()) / 86_400_000);
}

function statusFor(date: string) {
  const days = daysUntil(date);
  if (days === null) return { label: "Needs date", className: "bg-amber-50 text-amber-700 border-amber-200" };
  if (days < 0) return { label: "Past wedding", className: "bg-muted text-muted-foreground border-border" };
  if (days <= 30) return { label: "Final stretch", className: "bg-rose-50 text-rose-700 border-rose-200" };
  if (days <= 90) return { label: "Upcoming", className: "bg-blue-50 text-blue-700 border-blue-200" };
  return { label: "Active planning", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}

export default function PlannerDashboard() {
  const [, setLocation] = useLocation();
  const { setActiveWorkspace } = useWorkspace();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "final30" | "upcoming" | "past">("all");
  const { data, isLoading } = useQuery<WorkspacesData>({
    queryKey: ["my-workspaces"],
    queryFn: async () => {
      const res = await authFetch("/api/collaborators/my-workspaces");
      if (!res.ok) throw new Error("Could not load client workstations.");
      return res.json();
    },
  });

  const workspaces = (data?.ownWorkspaces ?? []).filter((ws) => ws.profileId !== data?.ownProfile?.profileId);
  const isPlanner = data?.accountType === "wedding_planner";
  const sortedWorkspaces = useMemo(() => [...workspaces].sort((a, b) => {
    const aDays = daysUntil(a.weddingDate);
    const bDays = daysUntil(b.weddingDate);
    if (aDays === null) return 1;
    if (bDays === null) return -1;
    if (aDays < 0 && bDays >= 0) return 1;
    if (bDays < 0 && aDays >= 0) return -1;
    return aDays - bDays;
  }), [workspaces]);
  const filteredWorkspaces = sortedWorkspaces.filter((ws) => {
    const days = daysUntil(ws.weddingDate);
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [
      clientName(ws),
      ws.partner1Name,
      ws.partner2Name,
      ws.weddingDate,
    ].some((value) => String(value ?? "").toLowerCase().includes(query));
    const matchesFilter =
      filter === "all" ||
      (filter === "final30" && days !== null && days >= 0 && days <= 30) ||
      (filter === "upcoming" && days !== null && days > 30) ||
      (filter === "past" && days !== null && days < 0);
    return matchesSearch && matchesFilter;
  });
  const upcoming = sortedWorkspaces.find((ws) => {
    const days = daysUntil(ws.weddingDate);
    return days !== null && days >= 0;
  });
  const next30 = sortedWorkspaces.filter((ws) => {
    const days = daysUntil(ws.weddingDate);
    return days !== null && days >= 0 && days <= 30;
  });
  const finalStretchCount = workspaces.filter((ws) => {
    const days = daysUntil(ws.weddingDate);
    return days !== null && days >= 0 && days <= 30;
  }).length;

  const openClient = (ws: PlannerWorkspace, path = "/dashboard") => {
    if (data?.ownProfile?.profileId === ws.profileId) {
      setActiveWorkspace(null);
    } else {
      const active: WorkspaceInfo = {
        profileId: ws.profileId,
        workstationName: ws.workstationName,
        partner1Name: ws.partner1Name,
        partner2Name: ws.partner2Name,
        weddingDate: ws.weddingDate,
        role: "owner",
      };
      setActiveWorkspace(active);
    }
    setLocation(path);
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-5">
        <Skeleton className="h-28 rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (!isPlanner) {
    return (
      <div className="mx-auto max-w-3xl text-center">
        <Card className="border-primary/15">
          <CardContent className="p-8">
            <BriefcaseBusiness className="mx-auto h-10 w-10 text-primary" />
            <h1 className="mt-4 font-serif text-3xl text-foreground">Wedding Planner Dashboard</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This dashboard is available for Wedding Planner accounts with client workstations.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-2xl border border-primary/15 bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <BriefcaseBusiness className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-widest">Wedding Planner</span>
            </div>
            <h1 className="mt-2 font-serif text-3xl text-foreground md:text-4xl">Client Dashboard</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Your planner command center. View client workstations, jump into their planning tools, and keep upcoming weddings easy to scan.
            </p>
          </div>
          <Button onClick={() => setLocation("/dashboard")} className="shrink-0 gap-2">
            Planner Workspace
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Card className="border-primary/15 shadow-sm">
          <CardContent className="p-5">
            <UsersRound className="h-5 w-5 text-primary" />
            <p className="mt-3 text-3xl font-serif font-semibold text-foreground">{workspaces.length}</p>
            <p className="text-sm text-muted-foreground">Client workstations</p>
          </CardContent>
        </Card>
        <Card className="border-primary/15 shadow-sm">
          <CardContent className="p-5">
            <CalendarDays className="h-5 w-5 text-primary" />
            <p className="mt-3 text-lg font-semibold text-foreground">{upcoming ? clientName(upcoming) : "No upcoming weddings"}</p>
            <p className="text-sm text-muted-foreground">{upcoming ? formatDate(upcoming.weddingDate) : "Add a client date to start tracking"}</p>
          </CardContent>
        </Card>
        <Card className="border-primary/15 shadow-sm">
          <CardContent className="p-5">
            <Clock className="h-5 w-5 text-primary" />
            <p className="mt-3 text-3xl font-serif font-semibold text-foreground">{finalStretchCount}</p>
            <p className="text-sm text-muted-foreground">In the final 30 days</p>
          </CardContent>
        </Card>
        <Card className="border-primary/15 shadow-sm">
          <CardContent className="p-5">
            <AlertTriangle className="h-5 w-5 text-rose-600" />
            <p className="mt-3 text-3xl font-serif font-semibold text-foreground">{next30.length}</p>
            <p className="text-sm text-muted-foreground">Need close attention</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-primary/15 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl text-foreground">Next 30 Days</h2>
                <p className="text-sm text-muted-foreground">Planner focus list for weddings that are closest.</p>
              </div>
              <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">{next30.length} clients</Badge>
            </div>
            <div className="mt-4 space-y-2">
              {next30.length ? next30.slice(0, 5).map((ws) => {
                const days = daysUntil(ws.weddingDate);
                return (
                  <button
                    key={ws.profileId}
                    type="button"
                    onClick={() => openClient(ws)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">{clientName(ws)}</span>
                      <span className="block text-xs text-muted-foreground">{formatDate(ws.weddingDate)}</span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-primary">{days} days</span>
                  </button>
                );
              }) : (
                <p className="rounded-xl border border-border/60 bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                  No client weddings are inside the next 30 days.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/15 shadow-sm">
          <CardContent className="p-5">
            <h2 className="font-serif text-xl text-foreground">Planner Shortcuts</h2>
            <p className="text-sm text-muted-foreground">Open the nearest active client directly into the tools planners check most.</p>
            <div className="mt-4 grid gap-2">
              <Button variant="outline" className="justify-start gap-2" disabled={!upcoming} onClick={() => upcoming && openClient(upcoming, "/checklist")}>
                <CheckSquare className="h-4 w-4" /> Nearest checklist
              </Button>
              <Button variant="outline" className="justify-start gap-2" disabled={!upcoming} onClick={() => upcoming && openClient(upcoming, "/budget")}>
                <DollarSign className="h-4 w-4" /> Nearest budget
              </Button>
              <Button variant="outline" className="justify-start gap-2" disabled={!upcoming} onClick={() => upcoming && openClient(upcoming, "/contracts")}>
                <FileText className="h-4 w-4" /> Nearest contracts
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {workspaces.length <= 1 && (
        <Card className="border-primary/15 bg-primary/5 shadow-sm">
          <CardContent className="p-5">
            <h2 className="font-serif text-xl text-foreground">Create your first client workstation.</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Use the workstation switcher in the sidebar to create a separate client workspace with its own profile, guests, budget, contracts, website, and planning tools.
            </p>
          </CardContent>
        </Card>
      )}

      <section className="rounded-2xl border border-primary/15 bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative md:max-w-sm md:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search clients"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ["all", "All"],
              ["final30", "Final 30"],
              ["upcoming", "Upcoming"],
              ["past", "Past"],
            ].map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={filter === value ? "default" : "outline"}
                onClick={() => setFilter(value as typeof filter)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {filteredWorkspaces.map((ws) => {
          const status = statusFor(ws.weddingDate);
          const days = daysUntil(ws.weddingDate);
          return (
            <Card key={ws.profileId} className="overflow-hidden border-primary/15 shadow-sm">
              <div className="h-1 bg-gradient-to-r from-primary via-[#B16C8E] to-[#E6A6B7]" />
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-2xl text-foreground">{clientName(ws)}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {ws.partner2Name} & {ws.partner1Name}
                    </p>
                  </div>
                  <Badge variant="outline" className={status.className}>{status.label}</Badge>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/60 bg-muted/25 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">Wedding Date</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{formatDate(ws.weddingDate)}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/25 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">Countdown</p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {days === null ? "Not set" : days < 0 ? `${Math.abs(days)} days ago` : `${days} days left`}
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => openClient(ws)} className="gap-1.5">
                    Open Dashboard <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openClient(ws, "/checklist")} className="gap-1.5">
                    <CheckSquare className="h-4 w-4" /> Checklist
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openClient(ws, "/timeline")} className="gap-1.5">
                    <CalendarDays className="h-4 w-4" /> Timeline
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openClient(ws, "/budget")} className="gap-1.5">
                    <DollarSign className="h-4 w-4" /> Budget
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openClient(ws, "/contracts")} className="gap-1.5">
                    <FileText className="h-4 w-4" /> Contracts
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filteredWorkspaces.length === 0 && (
          <Card className="border-primary/15 shadow-sm md:col-span-2">
            <CardContent className="p-8 text-center">
              <Search className="mx-auto h-8 w-8 text-muted-foreground" />
              <h2 className="mt-3 font-serif text-xl text-foreground">No clients match that view</h2>
              <p className="mt-1 text-sm text-muted-foreground">Adjust the search or filter to see more workstations.</p>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
