import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Activity,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  FileText,
  Search,
  StickyNote,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { authFetch } from "@/lib/authFetch";
import { useWorkspace, type WorkspaceInfo } from "@/contexts/WorkspaceContext";

type SectionKey = "clients" | "calendar" | "documents" | "vendors" | "activity";
type SortKey = "date" | "name";

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

interface VendorFollowUp {
  id: string;
  vendorName: string;
  clientName: string;
  profileId: number;
  status: string;
  lastContact: string;
  done?: boolean;
  note?: string;
  snoozed?: boolean;
}

interface ActivityEntry {
  id: string;
  profileId: number;
  clientName: string;
  eventType: string;
  timestamp: string;
  detail: string;
}

interface ClientDocument {
  id: string;
  contractId: number;
  profileId: number;
  clientName: string;
  fileName: string;
  vendorName?: string | null;
  fileSize?: number | null;
  riskLevel?: string | null;
  createdAt: string;
}

function clientName(ws: PlannerWorkspace) {
  return ws.workstationName?.trim() || `${ws.partner2Name} & ${ws.partner1Name}`;
}

function coupleNames(ws: PlannerWorkspace) {
  return `${ws.partner2Name} & ${ws.partner1Name}`;
}

function formatDate(date: string) {
  if (!date) return "No date set";
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatFileSize(bytes?: number | null) {
  if (!bytes) return "No size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function riskBadgeClass(risk?: string | null) {
  const normalized = risk?.toLowerCase();
  if (normalized === "high") return "border-red-200 bg-red-50 text-red-700";
  if (normalized === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  if (normalized === "low") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-primary/20 text-primary";
}

function sortDateValue(date: string) {
  const parsed = new Date(`${date}T12:00:00`).getTime();
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function daysUntil(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);
  return Math.ceil((parsed.getTime() - today.getTime()) / 86_400_000);
}

function clientProgress(ws: PlannerWorkspace) {
  const days = daysUntil(ws.weddingDate);
  if (days === null) return 10;
  if (days < 0) return 100;
  const windowDays = 365;
  return Math.max(8, Math.min(96, Math.round(((windowDays - Math.min(days, windowDays)) / windowDays) * 100)));
}

function eventDateFromWedding(date: string, offsetDays: number) {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  parsed.setDate(parsed.getDate() + offsetDays);
  return parsed.toISOString().slice(0, 10);
}

function sectionTitle(section: SectionKey) {
  if (section === "clients") return "My Clients";
  if (section === "calendar") return "Multi-Client Calendar";
  if (section === "documents") return "Client Documents";
  if (section === "vendors") return "Vendor Follow-Ups";
  return "Activity Log";
}

export default function PlannerDashboard() {
  const [location, setLocation] = useLocation();
  const { setActiveWorkspace } = useWorkspace();
  const [activeSection, setActiveSection] = useState<SectionKey>(location === "/planner-documents" ? "documents" : "clients");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [clientFilter, setClientFilter] = useState("all");
  const [vendorActions, setVendorActions] = useState<Record<string, Partial<VendorFollowUp>>>({});

  useEffect(() => {
    if (location === "/planner-documents") setActiveSection("documents");
    if (location === "/planner-dashboard") setActiveSection("clients");
  }, [location]);

  const { data, isLoading } = useQuery<WorkspacesData>({
    queryKey: ["my-workspaces"],
    queryFn: async () => {
      const res = await authFetch("/api/collaborators/my-workspaces");
      if (!res.ok) throw new Error("Could not load client workstations.");
      return res.json();
    },
  });

  const clients = useMemo(
    () => (data?.ownWorkspaces ?? []).filter((ws) => ws.profileId !== data?.ownProfile?.profileId),
    [data?.ownProfile?.profileId, data?.ownWorkspaces],
  );
  const isPlanner = data?.accountType === "wedding_planner";

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...clients]
      .filter((ws) => !query || [clientName(ws), coupleNames(ws), ws.weddingDate].some(value => value.toLowerCase().includes(query)))
      .sort((a, b) => {
        if (sortBy === "name") return clientName(a).localeCompare(clientName(b));
        return sortDateValue(a.weddingDate) - sortDateValue(b.weddingDate);
      });
  }, [clients, search, sortBy]);

  const { data: vendorRows = [] } = useQuery<VendorFollowUp[]>({
    queryKey: ["planner-vendor-followups", clients.map(c => c.profileId).join(",")],
    enabled: clients.length > 0,
    queryFn: async () => {
      const results = await Promise.all(clients.map(async (client) => {
        const res = await authFetch(`/api/workspace/${client.profileId}/vendors`);
        if (!res.ok) return [];
        const body = await res.json().catch(() => ({ vendors: [] }));
        const vendors = Array.isArray(body.vendors) ? body.vendors : [];
        return vendors
          .filter((vendor: { contractSigned?: boolean }) => !vendor.contractSigned)
          .map((vendor: { id: number; name: string; category?: string }) => ({
            id: `${client.profileId}-${vendor.id}`,
            vendorName: vendor.name || vendor.category || "Vendor",
            clientName: clientName(client),
            profileId: client.profileId,
            status: "Follow-up needed",
            lastContact: "Not recorded",
          }));
      }));
      return results.flat();
    },
  });

  const { data: activityRows = [] } = useQuery<ActivityEntry[]>({
    queryKey: ["planner-activity", clients.map(c => c.profileId).join(",")],
    enabled: clients.length > 0,
    queryFn: async () => {
      const results = await Promise.all(clients.map(async (client) => {
        const res = await authFetch(`/api/workspace/${client.profileId}/activity`);
        if (!res.ok) return [];
        const body = await res.json().catch(() => ({ activity: [] }));
        const rows = Array.isArray(body.activity) ? body.activity : [];
        return rows.map((entry: { id?: number; action?: string; type?: string; createdAt?: string }, index: number) => ({
          id: `${client.profileId}-${entry.id ?? index}`,
          profileId: client.profileId,
          clientName: clientName(client),
          eventType: entry.type || "Client activity",
          timestamp: entry.createdAt || new Date().toISOString(),
          detail: entry.action || "Workspace updated",
        }));
      }));
      return results.flat().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    },
  });

  const { data: documentRows = [] } = useQuery<ClientDocument[]>({
    queryKey: ["planner-client-documents", clients.map(c => c.profileId).join(",")],
    enabled: clients.length > 0,
    queryFn: async () => {
      const results = await Promise.all(clients.map(async (client) => {
        const res = await authFetch(`/api/workspace/${client.profileId}/contracts`);
        if (!res.ok) return [];
        const body = await res.json().catch(() => ({ contracts: [] }));
        const contracts = Array.isArray(body.contracts) ? body.contracts : [];
        return contracts.map((contract: {
          id: number;
          fileName?: string;
          vendorName?: string | null;
          fileSize?: number | null;
          analysis?: { overallRiskLevel?: string; riskLevel?: string } | null;
          createdAt?: string;
        }) => ({
          id: `${client.profileId}-${contract.id}`,
          contractId: contract.id,
          profileId: client.profileId,
          clientName: clientName(client),
          fileName: contract.fileName || "Contract",
          vendorName: contract.vendorName ?? null,
          fileSize: contract.fileSize ?? null,
          riskLevel: contract.analysis?.overallRiskLevel || contract.analysis?.riskLevel || null,
          createdAt: contract.createdAt || new Date().toISOString(),
        }));
      }));
      return results.flat().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
  });

  const calendarEvents = useMemo(() => {
    const events = clients.flatMap((client) => [
      { id: `wedding-${client.profileId}`, profileId: client.profileId, clientName: clientName(client), type: "Wedding", date: client.weddingDate, label: "Wedding day" },
      { id: `deadline-${client.profileId}`, profileId: client.profileId, clientName: clientName(client), type: "Deadline", date: eventDateFromWedding(client.weddingDate, -30), label: "Final vendor count deadline" },
      { id: `walkthrough-${client.profileId}`, profileId: client.profileId, clientName: clientName(client), type: "Walkthrough", date: eventDateFromWedding(client.weddingDate, -14), label: "Venue walkthrough" },
      { id: `payment-${client.profileId}`, profileId: client.profileId, clientName: clientName(client), type: "Payment", date: eventDateFromWedding(client.weddingDate, -7), label: "Vendor payment reminder" },
    ]).filter(event => event.date);
    return events
      .filter(event => clientFilter === "all" || String(event.profileId) === clientFilter)
      .sort((a, b) => sortDateValue(a.date) - sortDateValue(b.date));
  }, [clients, clientFilter]);

  const mergedVendorRows = vendorRows.map(row => ({ ...row, ...vendorActions[row.id] })).filter(row => !row.done);

  const openClient = (ws: PlannerWorkspace | { profileId: number }, path = "/dashboard") => {
    const client = clients.find(item => item.profileId === ws.profileId);
    if (!client) return;
    const active: WorkspaceInfo = {
      profileId: client.profileId,
      workstationName: client.workstationName,
      partner1Name: client.partner1Name,
      partner2Name: client.partner2Name,
      weddingDate: client.weddingDate,
      role: "owner",
    };
    setActiveWorkspace(active);
    setLocation(path);
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-5">
        <Skeleton className="h-28 rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
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
            <p className="mt-2 text-sm text-muted-foreground">This dashboard is available for Wedding Planner accounts.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const navItems: Array<{ key: SectionKey; label: string; icon: React.ElementType }> = [
    { key: "clients", label: "My Clients", icon: UsersRound },
    { key: "calendar", label: "Calendar", icon: CalendarDays },
    { key: "documents", label: "Client Documents", icon: FileText },
    { key: "vendors", label: "Vendor Follow-Ups", icon: Bell },
    { key: "activity", label: "Activity Log", icon: Activity },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-2xl border border-primary/15 bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BriefcaseBusiness className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Wedding Planner</p>
            <h1 className="font-serif text-3xl text-foreground md:text-4xl">Planner Dashboard</h1>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <aside className="rounded-2xl border border-primary/15 bg-card p-3 shadow-sm lg:sticky lg:top-6 lg:self-start">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveSection(item.key)}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                    active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-primary/5"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="font-serif text-2xl text-foreground">{sectionTitle(activeSection)}</h2>
              <p className="text-sm text-muted-foreground">Manage multiple weddings without extra clutter.</p>
            </div>
          </div>

          {activeSection === "clients" && (
            <section className="space-y-4">
              <Card className="border-primary/15 shadow-sm">
                <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="relative md:max-w-sm md:flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by client or couple name" className="pl-9" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Sort</span>
                    <select
                      value={sortBy}
                      onChange={(event) => setSortBy(event.target.value as SortKey)}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="date">Wedding date</option>
                      <option value="name">Name</option>
                    </select>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredClients.map((client) => {
                  const progress = clientProgress(client);
                  return (
                    <Card key={client.profileId} className="border-primary/15 shadow-sm">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate font-serif text-xl text-foreground">{coupleNames(client)}</h3>
                            <p className="mt-1 truncate text-sm text-muted-foreground">{clientName(client)}</p>
                          </div>
                          <Badge variant="outline" className="border-primary/20 text-primary">{formatDate(client.weddingDate)}</Badge>
                        </div>
                        <div className="mt-5 space-y-2">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Planning progress</span>
                            <span>{progress}%</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>
                        <Button className="mt-5 w-full gap-2" onClick={() => openClient(client)}>
                          Open Workstation <ChevronRight className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {activeSection === "calendar" && (
            <section className="space-y-4">
              <Card className="border-primary/15 shadow-sm">
                <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                  <p className="text-sm text-muted-foreground">All weddings, deadlines, payments, meetings, and walkthroughs across clients.</p>
                  <select
                    value={clientFilter}
                    onChange={(event) => setClientFilter(event.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="all">All clients</option>
                    {clients.map(client => <option key={client.profileId} value={client.profileId}>{clientName(client)}</option>)}
                  </select>
                </CardContent>
              </Card>
              <Card className="border-primary/15 shadow-sm">
                <CardContent className="divide-y divide-border/60 p-0">
                  {calendarEvents.map(event => (
                    <div key={event.id} className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <CalendarDays className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="font-medium text-foreground">{event.label}</p>
                          <p className="text-sm text-muted-foreground">{event.clientName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{event.type}</Badge>
                        <span className="text-sm font-medium text-foreground">{formatDate(event.date)}</span>
                      </div>
                    </div>
                  ))}
                  {calendarEvents.length === 0 && <EmptyState text="No calendar items yet. Add client workstations to populate this view." />}
                </CardContent>
              </Card>
            </section>
          )}

          {activeSection === "documents" && (
            <section>
              <Card className="border-primary/15 shadow-sm">
                <CardContent className="divide-y divide-border/60 p-0">
                  {documentRows.map(doc => (
                    <div key={doc.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_150px_140px_120px] lg:items-center">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <FileText className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{doc.fileName}</p>
                          <p className="text-sm text-muted-foreground">{doc.clientName}</p>
                          {doc.vendorName && <p className="text-xs text-primary">Vendor: {doc.vendorName}</p>}
                        </div>
                      </div>
                      <Badge variant="outline" className={riskBadgeClass(doc.riskLevel)}>
                        {doc.riskLevel ? `${doc.riskLevel} risk` : "Uploaded"}
                      </Badge>
                      <p className="text-sm text-muted-foreground">{formatFileSize(doc.fileSize)}</p>
                      <div className="flex items-center justify-end gap-2">
                        <span className="hidden text-xs text-muted-foreground xl:inline">{formatDate(doc.createdAt.slice(0, 10))}</span>
                        <Button size="sm" variant="outline" onClick={() => openClient(doc, "/contracts")}>
                          Open
                        </Button>
                      </div>
                    </div>
                  ))}
                  {documentRows.length === 0 && <EmptyState text="No client documents yet. Upload contracts inside a client workstation to populate this hub." />}
                </CardContent>
              </Card>
            </section>
          )}

          {activeSection === "vendors" && (
            <section>
              <Card className="border-primary/15 shadow-sm">
                <CardContent className="divide-y divide-border/60 p-0">
                  {mergedVendorRows.map(row => (
                    <div key={row.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_160px_140px_260px] lg:items-center">
                      <div>
                        <p className="font-medium text-foreground">{row.vendorName}</p>
                        <p className="text-sm text-muted-foreground">{row.clientName}</p>
                        {row.note && <p className="mt-1 text-xs text-primary">Note: {row.note}</p>}
                      </div>
                      <Badge variant="outline" className={row.snoozed ? "border-amber-200 text-amber-700" : "border-primary/20 text-primary"}>
                        {row.snoozed ? "Snoozed" : row.status}
                      </Badge>
                      <p className="text-sm text-muted-foreground">{row.lastContact}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => setVendorActions(prev => ({ ...prev, [row.id]: { ...prev[row.id], done: true } }))}>
                          <Check className="h-3.5 w-3.5" /> Done
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          const note = window.prompt("Add vendor note", row.note ?? "");
                          if (note !== null) setVendorActions(prev => ({ ...prev, [row.id]: { ...prev[row.id], note } }));
                        }}>
                          <StickyNote className="h-3.5 w-3.5" /> Note
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setVendorActions(prev => ({ ...prev, [row.id]: { ...prev[row.id], snoozed: true } }))}>
                          <Clock className="h-3.5 w-3.5" /> Snooze
                        </Button>
                      </div>
                    </div>
                  ))}
                  {mergedVendorRows.length === 0 && <EmptyState text="No vendor follow-ups right now." />}
                </CardContent>
              </Card>
            </section>
          )}

          {activeSection === "activity" && (
            <section>
              <Card className="border-primary/15 shadow-sm">
                <CardContent className="divide-y divide-border/60 p-0">
                  {activityRows.map(entry => (
                    <div key={entry.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Activity className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="font-medium text-foreground">{entry.detail}</p>
                          <p className="text-sm text-muted-foreground">{entry.clientName}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{entry.eventType}</Badge>
                        <span className="text-sm text-muted-foreground">{new Date(entry.timestamp).toLocaleString()}</span>
                        <Button size="sm" variant="outline" onClick={() => openClient(entry)}>
                          Open
                        </Button>
                      </div>
                    </div>
                  ))}
                  {activityRows.length === 0 && <EmptyState text="No client activity has been logged yet." />}
                </CardContent>
              </Card>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
