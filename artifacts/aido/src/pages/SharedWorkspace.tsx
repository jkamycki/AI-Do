import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Calendar, DollarSign, CheckSquare, Clock,
  Crown, Briefcase, Eye, Heart, Users,
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

export default function SharedWorkspacePage() {
  const { activeWorkspace, setActiveWorkspace } = useWorkspace();
  const { getToken } = useAuth();

  const authedFetch = async (url: string) => {
    const token = await getToken();
    return fetch(url, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  };

  const profileId = activeWorkspace?.profileId;

  const { data: workspaceData } = useQuery({
    queryKey: ["workspace", profileId],
    queryFn: async () => {
      const r = await authedFetch(`/api/workspace/${profileId}`);
      if (!r.ok) throw new Error("Access denied");
      return r.json() as Promise<{ profile: Record<string, unknown>; role: string }>;
    },
    enabled: !!profileId,
    refetchInterval: 5000,
  });

  const { data: timelineData } = useQuery({
    queryKey: ["workspace-timeline", profileId],
    queryFn: async () => {
      const r = await authedFetch(`/api/workspace/${profileId}/timeline`);
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!profileId,
    refetchInterval: 5000,
  });

  const { data: budgetData } = useQuery({
    queryKey: ["workspace-budget", profileId],
    queryFn: async () => {
      const r = await authedFetch(`/api/workspace/${profileId}/budget`);
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!profileId && activeWorkspace?.role !== "vendor",
    refetchInterval: 10000,
  });

  const { data: checklistData } = useQuery({
    queryKey: ["workspace-checklist", profileId],
    queryFn: async () => {
      const r = await authedFetch(`/api/workspace/${profileId}/checklist`);
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!profileId && activeWorkspace?.role !== "vendor",
    refetchInterval: 10000,
  });

  if (!activeWorkspace) {
    return (
      <div className="text-center py-24 space-y-4">
        <Users className="h-12 w-12 text-muted-foreground/40 mx-auto" />
        <p className="text-muted-foreground">No workspace selected.</p>
      </div>
    );
  }

  const role = activeWorkspace.role;
  const roleCfg = ROLE_LABELS[role] ?? ROLE_LABELS.vendor;
  const RoleIcon = roleCfg.icon;

  const profile = workspaceData?.profile as Record<string, unknown> | undefined;
  const events = timelineData?.events ?? [];
  const items = checklistData?.items ?? [];
  const completedItems = items.filter((i: { isCompleted: boolean }) => i.isCompleted).length;
  const budget = budgetData?.budget;
  const budgetItems = budgetData?.items ?? [];
  const totalSpent = budgetItems.reduce((s: number, i: { actualCost: number }) => s + i.actualCost, 0);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Heart className="h-6 w-6 fill-primary text-primary" />
            <h1 className="text-3xl font-serif text-primary">
              {activeWorkspace.partner1Name} & {activeWorkspace.partner2Name}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${roleCfg.color}`}>
              <RoleIcon className="h-3 w-3" />
              {roleCfg.label}
            </span>
            <span className="text-sm text-muted-foreground">{activeWorkspace.weddingDate}</span>
            <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50">
              Live · Updates every 5s
            </Badge>
          </div>
        </div>
        <button
          onClick={() => setActiveWorkspace(null)}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          ← Back to my workspace
        </button>
      </div>

      {!profile ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-none shadow-sm bg-primary text-primary-foreground">
              <CardContent className="p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-primary-foreground/70 mb-1">Couple</p>
                <p className="text-lg font-bold font-serif leading-tight">
                  {activeWorkspace.partner1Name}<br />& {activeWorkspace.partner2Name}
                </p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Wedding Date</p>
                <p className="text-lg font-bold font-serif text-foreground">{activeWorkspace.weddingDate}</p>
                <Calendar className="h-4 w-4 text-muted-foreground mt-1" />
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Timeline Events</p>
                <p className="text-3xl font-bold font-serif text-foreground">{events.length}</p>
              </CardContent>
            </Card>
            {role !== "vendor" && (
              <Card className="border-none shadow-sm">
                <CardContent className="p-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Checklist</p>
                  <p className="text-3xl font-bold font-serif text-foreground">{completedItems}<span className="text-lg text-muted-foreground">/{items.length}</span></p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Full profile details */}
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-lg flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                Wedding Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3 text-sm">
                {profile.venue && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Venue</p>
                    <p className="text-foreground font-medium">{String(profile.venue)}</p>
                  </div>
                )}
                {(profile.venueCity || profile.venueState || profile.location) && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Location</p>
                    <p className="text-foreground font-medium">
                      {[profile.venueCity, profile.venueState, profile.location].filter(Boolean).join(", ")}
                    </p>
                  </div>
                )}
                {profile.ceremonyTime && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Ceremony</p>
                    <p className="text-foreground font-medium">{String(profile.ceremonyTime)}</p>
                  </div>
                )}
                {profile.receptionTime && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Reception</p>
                    <p className="text-foreground font-medium">{String(profile.receptionTime)}</p>
                  </div>
                )}
                {profile.guestCount && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Guest Count</p>
                    <p className="text-foreground font-medium">{String(profile.guestCount)} guests</p>
                  </div>
                )}
                {profile.weddingVibe && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Wedding Vibe</p>
                    <p className="text-foreground font-medium capitalize">{String(profile.weddingVibe)}</p>
                  </div>
                )}
                {profile.totalBudget && Number(profile.totalBudget) > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Total Budget</p>
                    <p className="text-foreground font-medium">${Number(profile.totalBudget).toLocaleString()}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

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
                          <span className="text-xs font-mono text-muted-foreground">{event.time}</span>
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
          <div className="space-y-6">
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
                      <span className="font-semibold">${budget.totalBudget.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Spent</span>
                      <span className="font-semibold text-rose-600">${totalSpent.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Remaining</span>
                      <span className="font-semibold text-emerald-600">${(budget.totalBudget - totalSpent).toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.min(100, (totalSpent / budget.totalBudget) * 100)}%` }}
                      />
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
                    <span className="ml-auto text-xs text-muted-foreground font-normal">
                      {completedItems}/{items.length} done
                    </span>
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
                        <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center
                          ${item.isCompleted ? "bg-primary border-primary" : "border-border"}`}>
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

    </div>
  );
}
