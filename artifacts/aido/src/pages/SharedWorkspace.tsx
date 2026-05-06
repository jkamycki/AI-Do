import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { useRoute } from "wouter";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Calendar, DollarSign, CheckSquare, Clock,
  Crown, Briefcase, Eye, Heart, Users,
  MapPin, Hotel, Building2, LayoutGrid,
  Armchair, UserCheck, ChevronRight, Phone,
  ExternalLink,
} from "lucide-react";

const ROLE_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  owner: { label: "Owner", icon: Crown, color: "bg-primary/10 text-primary" },
  partner: { label: "Partner", icon: Crown, color: "bg-purple-100 text-purple-700" },
  planner: { label: "Planner", icon: Briefcase, color: "bg-blue-100 text-blue-700" },
  vendor: { label: "Vendor", icon: Eye, color: "bg-amber-100 text-amber-700" },
};

const CATEGORY_COLORS: Record<string, string> = {
  ceremony: "#9B4D6C",
  reception: "#5B8E7D",
  photography: "#D4A017",
  preparation: "#7C6C8A",
  catering: "#C05746",
  transport: "#4A7CA5",
  other: "#808080",
};

function formatTime(timeStr: string | null | undefined) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

export default function SharedWorkspacePage() {
  const [, params] = useRoute("/workspace/:profileId");
  const urlProfileId = params?.profileId ? parseInt(params.profileId, 10) : null;
  const { activeWorkspace, setActiveWorkspace } = useWorkspace();
  const { getToken } = useAuth();

  const authedFetch = async (url: string) => {
    const token = await getToken();
    return fetch(url, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  };

  const profileId = activeWorkspace?.profileId ?? urlProfileId;
  const enabled = !!profileId;

  const { data: workspaceData } = useQuery({
    queryKey: ["workspace", profileId],
    queryFn: async () => { const r = await authedFetch(`/api/workspace/${profileId}`); if (!r.ok) throw new Error("Access denied"); return r.json() as Promise<{ profile: Record<string, unknown>; role: string }>; },
    enabled, refetchInterval: 5000,
  });

  const { data: timelineData } = useQuery({
    queryKey: ["workspace-timeline", profileId],
    queryFn: async () => { const r = await authedFetch(`/api/workspace/${profileId}/timeline`); if (!r.ok) return null; return r.json(); },
    enabled, refetchInterval: 5000,
  });

  const { data: budgetData } = useQuery({
    queryKey: ["workspace-budget", profileId],
    queryFn: async () => { const r = await authedFetch(`/api/workspace/${profileId}/budget`); if (!r.ok) return null; return r.json(); },
    enabled: enabled && activeWorkspace?.role !== "vendor", refetchInterval: 10000,
  });

  const { data: checklistData } = useQuery({
    queryKey: ["workspace-checklist", profileId],
    queryFn: async () => { const r = await authedFetch(`/api/workspace/${profileId}/checklist`); if (!r.ok) return null; return r.json(); },
    enabled: enabled && activeWorkspace?.role !== "vendor", refetchInterval: 10000,
  });

  const isPlanner = enabled && activeWorkspace?.role !== "vendor";

  const { data: guestData } = useQuery({
    queryKey: ["workspace-guests", profileId],
    queryFn: async () => { const r = await authedFetch(`/api/workspace/${profileId}/guests`); if (!r.ok) return null; return r.json(); },
    enabled: isPlanner, refetchInterval: 10000,
  });

  const { data: vendorData } = useQuery({
    queryKey: ["workspace-vendors", profileId],
    queryFn: async () => { const r = await authedFetch(`/api/workspace/${profileId}/vendors`); if (!r.ok) return null; return r.json(); },
    enabled: isPlanner, refetchInterval: 10000,
  });

  const { data: hotelData } = useQuery({
    queryKey: ["workspace-hotels", profileId],
    queryFn: async () => { const r = await authedFetch(`/api/workspace/${profileId}/hotels`); if (!r.ok) return null; return r.json(); },
    enabled: isPlanner, refetchInterval: 30000,
  });

  const { data: partyData } = useQuery({
    queryKey: ["workspace-party", profileId],
    queryFn: async () => { const r = await authedFetch(`/api/workspace/${profileId}/wedding-party`); if (!r.ok) return null; return r.json(); },
    enabled: isPlanner, refetchInterval: 30000,
  });

  const { data: seatingData } = useQuery({
    queryKey: ["workspace-seating", profileId],
    queryFn: async () => { const r = await authedFetch(`/api/workspace/${profileId}/seating`); if (!r.ok) return null; return r.json(); },
    enabled: isPlanner, refetchInterval: 30000,
  });

  useEffect(() => {
    if (!activeWorkspace && workspaceData && profileId) {
      setActiveWorkspace({
        profileId,
        role: workspaceData.role,
        partner1Name: (workspaceData.profile.partner1Name as string) || "",
        partner2Name: (workspaceData.profile.partner2Name as string) || "",
        weddingDate: (workspaceData.profile.weddingDate as string) || "",
      });
    }
  }, [workspaceData, activeWorkspace, profileId, setActiveWorkspace]);

  if (!activeWorkspace && !profileId) {
    return (
      <div className="text-center py-24 space-y-4">
        <Users className="h-12 w-12 text-muted-foreground/40 mx-auto" />
        <p className="text-muted-foreground">No workspace selected.</p>
      </div>
    );
  }

  const role = activeWorkspace?.role ?? workspaceData?.role ?? "vendor";
  const roleCfg = ROLE_LABELS[role] ?? ROLE_LABELS.vendor;
  const RoleIcon = roleCfg.icon;

  const workspace = activeWorkspace || (workspaceData && profileId ? {
    profileId,
    role: workspaceData.role,
    partner1Name: (workspaceData.profile.partner1Name as string) || "",
    partner2Name: (workspaceData.profile.partner2Name as string) || "",
    weddingDate: (workspaceData.profile.weddingDate as string) || "",
  } : null);

  const profile = workspaceData?.profile as Record<string, unknown> | undefined;
  const events = timelineData?.events ?? [];
  const items = checklistData?.items ?? [];
  const completedItems = items.filter((i: { isCompleted: boolean }) => i.isCompleted).length;
  const budget = budgetData?.budget;
  const budgetItems = budgetData?.items ?? [];
  const totalSpent = budgetItems.reduce((s: number, i: { actualCost: number }) => s + i.actualCost, 0);
  const budgetPct = budget ? Math.min(100, Math.round((totalSpent / budget.totalBudget) * 100)) : 0;

  const guestTotal = guestData?.total ?? 0;
  const guestAttending = guestData?.attending ?? 0;
  const guestDeclined = guestData?.declined ?? 0;
  const guestPending = guestData?.pending ?? 0;

  const vendorList: Array<{ id: number; name: string; category: string; booked?: boolean }> = vendorData?.vendors ?? [];
  const hotelList: Array<{ id: number; hotelName: string; address?: string | null; phone?: string | null; bookingLink?: string | null; discountCode?: string | null; cutoffDate?: string | null; roomsReserved?: number | null; roomsBooked: number; pricePerNight?: number | null; distanceFromVenue?: string | null }> = hotelData?.hotels ?? [];
  const partyList: Array<{ id: number; name: string; role: string; side: string }> = partyData?.members ?? [];
  const chartList: Array<{ id: number; name: string; tableCount: number; seatsPerTable: number; tables?: Array<{ tableName: string; guests: string[] }> | null }> = seatingData?.charts ?? [];

  if (!workspace) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Heart className="h-5 w-5 fill-primary text-primary" />
            <h1 className="text-3xl font-serif text-primary">
              {workspace.partner1Name} & {workspace.partner2Name}
            </h1>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${roleCfg.color}`}>
              <RoleIcon className="h-3 w-3" />
              {roleCfg.label}
            </span>
            <span className="text-sm text-muted-foreground">{workspace.weddingDate}</span>
            <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50">
              Live · Updates every 5s
            </Badge>
          </div>
        </div>
        <button
          onClick={() => setActiveWorkspace(null)}
          className="text-xs text-muted-foreground hover:text-foreground underline shrink-0"
        >
          ← Back to my workspace
        </button>
      </div>

      {!profile ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : (
        <>
          {/* Wedding Profile Card */}
          <div className="rounded-2xl bg-card border border-border/60 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-primary/20 via-primary to-primary/20" />
            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Date & Venue */}
                <div className="rounded-xl bg-muted/30 border border-border/40 p-4 space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Date & Time</p>
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{formatDate(workspace.weddingDate)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {[
                          profile.ceremonyTime && `Ceremony ${formatTime(String(profile.ceremonyTime))}`,
                          profile.receptionTime && `Reception ${formatTime(String(profile.receptionTime))}`,
                        ].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Venue & Location */}
                <div className="rounded-xl bg-muted/30 border border-border/40 p-4 space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Venue & Location</p>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      {!!profile.venue && <p className="text-sm font-medium text-foreground">{String(profile.venue)}</p>}
                      {[profile.venueCity, profile.venueState, profile.location].filter(Boolean).length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5 break-words">
                          {[profile.venueCity, profile.venueState, profile.location].filter(Boolean).join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                  {hotelList.length > 0 && (
                    <div className="pt-2 border-t border-border/30 space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                        <Hotel className="h-3 w-3" /> Hotel{hotelList.length > 1 ? "s" : ""}
                      </p>
                      {hotelList.map(h => (
                        <div key={h.id} className="text-xs space-y-0.5">
                          <p className="font-medium text-foreground">{h.hotelName}</p>
                          {h.address && <p className="text-muted-foreground">{h.address}</p>}
                          {h.phone && <p className="text-muted-foreground flex items-center gap-1"><Phone className="h-2.5 w-2.5" />{h.phone}</p>}
                          {h.discountCode && <p className="text-primary font-medium">Code: {h.discountCode}</p>}
                          {h.bookingLink && (
                            <a href={h.bookingLink} target="_blank" rel="noopener noreferrer" className="text-primary underline flex items-center gap-1">
                              Book <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                          {(h.roomsReserved || h.cutoffDate) && (
                            <p className="text-muted-foreground">
                              {h.roomsReserved && `${h.roomsBooked}/${h.roomsReserved} rooms`}
                              {h.cutoffDate && ` · Cutoff: ${h.cutoffDate}`}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="rounded-xl bg-muted/30 border border-border/40 p-4 space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Details</p>
                  {role !== "vendor" && !!profile.guestCount && (
                    <p className="text-sm text-foreground"><strong>{String(profile.guestCount)}</strong> expected guests</p>
                  )}
                  {!!profile.weddingVibe && (
                    <p className="text-sm text-foreground capitalize">{String(profile.weddingVibe)}</p>
                  )}
                  {role !== "vendor" && !!profile.totalBudget && Number(profile.totalBudget) > 0 && (
                    <p className="text-sm text-foreground">${Number(profile.totalBudget).toLocaleString()} budget</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Stat chips */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {role !== "vendor" && (
              <div className="bg-card border border-border/60 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Users className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wider">Guests</span>
                </div>
                <div className="text-2xl font-serif font-semibold text-foreground">{guestTotal}</div>
                <div className="text-xs text-muted-foreground mt-0.5">incl. plus-ones · {guestAttending} attending</div>
              </div>
            )}
            <div className="bg-card border border-border/60 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Clock className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Timeline</span>
              </div>
              <div className="text-2xl font-serif font-semibold text-foreground">{events.length}</div>
              <div className="text-xs text-muted-foreground mt-0.5">events scheduled</div>
            </div>
            {role !== "vendor" && (
              <>
                <div className="bg-card border border-border/60 rounded-2xl p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <CheckSquare className="h-4 w-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">Checklist</span>
                  </div>
                  <div className="text-2xl font-serif font-semibold text-foreground">{completedItems}<span className="text-base text-muted-foreground">/{items.length}</span></div>
                  <div className="text-xs text-muted-foreground mt-0.5">{items.length > 0 ? `${Math.round((completedItems / items.length) * 100)}% done` : "no items yet"}</div>
                </div>
                <div className="bg-card border border-border/60 rounded-2xl p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <DollarSign className="h-4 w-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">Budget</span>
                  </div>
                  <div className="text-2xl font-serif font-semibold text-foreground">${(totalSpent ?? 0).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{budget ? `of $${(budget.totalBudget ?? 0).toLocaleString()} spent` : "not set"}</div>
                  {budget && <Progress value={budgetPct} className="h-1 mt-2" />}
                </div>
              </>
            )}
          </div>

          {/* Overview mini-cards: RSVP + Vendors + Wedding Party + Seating */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {/* Guest RSVP (planner+ only) */}
            {role !== "vendor" ? (
              <div className="bg-card border border-border/60 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-3">
                  <Users className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wider">Guest RSVPs</span>
                </div>
                {guestTotal > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /><span className="text-xs text-muted-foreground">Attending</span></div>
                      <span className="text-sm font-semibold text-emerald-600">{guestAttending}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /><span className="text-xs text-muted-foreground">Declined</span></div>
                      <span className="text-sm font-semibold text-red-500">{guestDeclined}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /><span className="text-xs text-muted-foreground">Awaiting</span></div>
                      <span className="text-sm font-semibold text-amber-600">{guestPending}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden flex mt-1">
                      {guestAttending > 0 && <div className="h-full bg-emerald-500" style={{ width: `${(guestAttending / guestTotal) * 100}%` }} />}
                      {guestDeclined > 0 && <div className="h-full bg-red-400" style={{ width: `${(guestDeclined / guestTotal) * 100}%` }} />}
                    </div>
                  </div>
                ) : <p className="text-xs text-muted-foreground">No guests added yet</p>}
              </div>
            ) : <div />}

            {/* Vendors (non-vendor roles only) */}
            {role !== "vendor" ? (
              <div className="bg-card border border-border/60 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-3">
                  <Building2 className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wider">Vendors</span>
                </div>
                {vendorList.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl font-serif font-semibold text-foreground">{vendorList.length}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                        {vendorList.filter(v => v.booked).length} booked
                      </span>
                    </div>
                    {vendorList.slice(0, 3).map(v => (
                      <div key={v.id} className="flex items-center justify-between">
                        <span className="text-xs text-foreground truncate max-w-[120px]">{v.name}</span>
                        <span className="text-[10px] text-muted-foreground capitalize">{v.category}</span>
                      </div>
                    ))}
                    {vendorList.length > 3 && <p className="text-[10px] text-muted-foreground">+{vendorList.length - 3} more</p>}
                  </div>
                ) : <p className="text-xs text-muted-foreground">No vendors added yet</p>}
              </div>
            ) : <div />}

            {/* Wedding Party (planner+ only) */}
            {role !== "vendor" ? (
              <div className="bg-card border border-border/60 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-3">
                  <LayoutGrid className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wider">Wedding Party</span>
                </div>
                {partyList.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl font-serif font-semibold text-foreground">{partyList.length}</span>
                      <div className="text-xs text-muted-foreground leading-tight">
                        <div>{partyList.filter(m => m.side === "bride").length} bride side</div>
                        <div>{partyList.filter(m => m.side === "groom").length} groom side</div>
                      </div>
                    </div>
                    {partyList.slice(0, 3).map(m => (
                      <div key={m.id} className="flex items-center justify-between">
                        <span className="text-xs text-foreground truncate max-w-[120px]">{m.name}</span>
                        <span className="text-[10px] text-muted-foreground capitalize">{m.role}</span>
                      </div>
                    ))}
                    {partyList.length > 3 && <p className="text-[10px] text-muted-foreground">+{partyList.length - 3} more</p>}
                  </div>
                ) : <p className="text-xs text-muted-foreground">No members added yet</p>}
              </div>
            ) : <div />}

            {/* Seating (planner+ only) */}
            {role !== "vendor" ? (
              <div className="bg-card border border-border/60 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-3">
                  <Armchair className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wider">Seating</span>
                </div>
                {chartList.length > 0 ? (() => {
                  const latest = chartList[0];
                  const tableCount = latest.tables?.length ?? latest.tableCount ?? 0;
                  const totalSeated = latest.tables?.reduce((sum, t) => sum + t.guests.length, 0) ?? 0;
                  return (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl font-serif font-semibold text-foreground">{chartList.length}</span>
                        <span className="text-xs text-muted-foreground">chart{chartList.length !== 1 ? "s" : ""}</span>
                      </div>
                      <p className="text-xs font-medium text-foreground truncate">{latest.name}</p>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {tableCount > 0 && <div>{tableCount} tables</div>}
                        {totalSeated > 0 && <div>{totalSeated} guests seated</div>}
                      </div>
                    </div>
                  );
                })() : <p className="text-xs text-muted-foreground">No seating charts yet</p>}
              </div>
            ) : <div />}
          </div>

          {/* Timeline + Budget/Checklist */}
          <div className={`grid ${role !== "vendor" ? "md:grid-cols-2" : "md:grid-cols-1"} gap-6`}>
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="font-serif text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Day-Of Timeline
                  {timelineData && <span className="ml-auto text-xs text-muted-foreground font-normal">{events.length} events</span>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!timelineData ? (
                  <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}</div>
                ) : events.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No timeline generated yet.</p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                    {events.map((event: { time: string; title: string; category: string; description: string }, i: number) => {
                      const color = CATEGORY_COLORS[event.category] ?? CATEGORY_COLORS.other;
                      return (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/40 transition-colors">
                          <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: color }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-muted-foreground">{formatTime(event.time) ?? event.time}</span>
                              <span className="font-medium text-sm text-foreground truncate">{event.title}</span>
                            </div>
                            {event.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{event.description}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {role !== "vendor" && (
              <div className="space-y-4">
                <Card className="border-none shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="font-serif text-lg flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                      Budget Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!budget ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No budget set yet.</p>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total Budget</span>
                          <span className="font-semibold">${(budget.totalBudget ?? 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Spent</span>
                          <span className="font-semibold text-rose-600">${(totalSpent ?? 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Remaining</span>
                          <span className="font-semibold text-emerald-600">${((budget.totalBudget ?? 0) - (totalSpent ?? 0)).toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${budgetPct}%` }} />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="font-serif text-lg flex items-center gap-2">
                      <CheckSquare className="h-5 w-5 text-primary" />
                      Checklist
                      {items.length > 0 && (
                        <span className="ml-auto text-xs text-muted-foreground font-normal">{completedItems}/{items.length} done</span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {items.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No checklist generated yet.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                        {items.slice(0, 20).map((item: { id: number; task: string; isCompleted: boolean; month: string }) => (
                          <div key={item.id} className="flex items-center gap-2.5 p-2 rounded-lg">
                            <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${item.isCompleted ? "bg-primary border-primary" : "border-border"}`}>
                              {item.isCompleted && <span className="text-white text-xs">✓</span>}
                            </div>
                            <span className={`text-sm ${item.isCompleted ? "line-through text-muted-foreground" : "text-foreground"}`}>
                              {item.task}
                            </span>
                          </div>
                        ))}
                        {items.length > 20 && (
                          <p className="text-xs text-muted-foreground text-center pt-1">+{items.length - 20} more items</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
