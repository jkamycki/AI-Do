import { useEffect, useState, useId } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Plus, Trash2, Wand2, Heart, AlertTriangle, UserPlus,
  ChevronDown, ChevronUp, RefreshCw, Info, Armchair, Save,
  Clock, ChevronRight,
} from "lucide-react";

type RelType = "prefer" | "avoid";

interface Relation {
  targetId: string;
  type: RelType;
}

interface Guest {
  id: string;
  name: string;
  group: string;
  plusOne: boolean;
  notes: string;
  relations: Relation[];
}

interface SeatingTable {
  tableNumber: number;
  tableName: string;
  guests: string[];
  theme?: string;
}

interface SeatingResult {
  tables: SeatingTable[];
  insights: string[];
  warnings: string[];
  totalSeated: number;
}

interface SavedChart {
  id: number;
  name: string;
  tableCount: number;
  seatsPerTable: number;
  tables?: SeatingTable[] | null;
  guests?: Guest[] | null;
  createdAt: string;
}

const GROUPS = ["Bride's Family", "Groom's Family", "Bride's Friends", "Groom's Friends", "Colleagues", "Other"];

const TABLE_COLORS = [
  "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/50 text-rose-900 dark:text-rose-100",
  "bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800/50 text-violet-900 dark:text-violet-100",
  "bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800/50 text-sky-900 dark:text-sky-100",
  "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-100",
  "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-100",
  "bg-pink-50 dark:bg-pink-950/30 border-pink-200 dark:border-pink-800/50 text-pink-900 dark:text-pink-100",
  "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/50 text-indigo-900 dark:text-indigo-100",
  "bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800/50 text-teal-900 dark:text-teal-100",
  "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800/50 text-orange-900 dark:text-orange-100",
  "bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-800/50 text-cyan-900 dark:text-cyan-100",
];

function GuestCard({
  guest,
  guests,
  onChange,
  onDelete,
}: {
  guest: Guest;
  guests: Guest[];
  onChange: (g: Guest) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const others = guests.filter(g => g.id !== guest.id);

  const toggleRelation = (targetId: string, type: RelType) => {
    const existing = guest.relations.find(r => r.targetId === targetId);
    if (existing?.type === type) {
      onChange({ ...guest, relations: guest.relations.filter(r => r.targetId !== targetId) });
    } else {
      const filtered = guest.relations.filter(r => r.targetId !== targetId);
      onChange({ ...guest, relations: [...filtered, { targetId, type }] });
    }
  };

  const preferCount = guest.relations.filter(r => r.type === "prefer").length;
  const avoidCount = guest.relations.filter(r => r.type === "avoid").length;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-card">
        <div className="flex-1 min-w-0">
          <Input
            value={guest.name}
            onChange={e => onChange({ ...guest, name: e.target.value })}
            placeholder="Guest name"
            className="border-0 bg-transparent p-0 h-auto text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <select
              value={guest.group}
              onChange={e => onChange({ ...guest, group: e.target.value })}
              className="text-xs text-muted-foreground bg-transparent border-none outline-none cursor-pointer"
            >
              {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            {(preferCount > 0 || avoidCount > 0) && (
              <span className="text-xs text-muted-foreground">
                {preferCount > 0 && <span className="text-emerald-600 dark:text-emerald-400">♥ {preferCount}</span>}
                {preferCount > 0 && avoidCount > 0 && " · "}
                {avoidCount > 0 && <span className="text-red-500 dark:text-red-400">⚡ {avoidCount}</span>}
              </span>
            )}
          </div>
        </div>
        <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer select-none flex-shrink-0">
          <input
            type="checkbox"
            checked={guest.plusOne}
            onChange={e => onChange({ ...guest, plusOne: e.target.checked })}
            className="rounded"
          />
          +1
        </label>
        <button onClick={() => setOpen(!open)} className="text-muted-foreground hover:text-foreground p-1">
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        <button onClick={onDelete} className="text-muted-foreground hover:text-destructive p-1">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-border/50 bg-muted/10 space-y-2">
          <Input
            value={guest.notes}
            onChange={e => onChange({ ...guest, notes: e.target.value })}
            placeholder="Notes (e.g., vegetarian, wheelchair access, speech giver…)"
            className="text-xs h-7"
          />
          {others.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Relationships
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {others.map(other => {
                  const rel = guest.relations.find(r => r.targetId === other.id);
                  return (
                    <div key={other.id} className="flex items-center gap-0.5 border border-border rounded-full overflow-hidden">
                      <span className="text-xs px-2 py-0.5">{other.name || "?"}</span>
                      <button
                        onClick={() => toggleRelation(other.id, "prefer")}
                        title="Seat together"
                        className={`px-1.5 py-0.5 text-xs transition-colors ${rel?.type === "prefer" ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300" : "hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-muted-foreground"}`}
                      >
                        ♥
                      </button>
                      <button
                        onClick={() => toggleRelation(other.id, "avoid")}
                        title="Keep apart"
                        className={`px-1.5 py-0.5 text-xs transition-colors ${rel?.type === "avoid" ? "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300" : "hover:bg-red-50 dark:hover:bg-red-900/30 text-muted-foreground"}`}
                      >
                        ⚡
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TableCard({ table, index }: { table: SeatingTable; index: number }) {
  const colorClass = TABLE_COLORS[index % TABLE_COLORS.length];
  return (
    <Card className={`border ${colorClass.split(" ").filter(c => c.startsWith("bg-") || c.startsWith("border-")).join(" ")} shadow-sm`}>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold font-serif text-foreground">{table.tableName}</CardTitle>
          <Badge variant="outline" className="text-xs border-current text-muted-foreground">
            <Armchair className="h-3 w-3 mr-1" />
            {table.guests.length} guests
          </Badge>
        </div>
        {table.theme && (
          <p className="text-xs text-muted-foreground">{table.theme}</p>
        )}
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <ul className="space-y-1">
          {table.guests.map((g, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-foreground">
              <div className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] flex items-center justify-center font-bold flex-shrink-0">
                {i + 1}
              </div>
              {g}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default function SeatingChartPage() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const uid = useId();
  const STORAGE_KEY = "aido_seating_draft_v1";
  const draft = (() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) as {
        guests?: Guest[];
        tableCount?: number;
        seatsPerTable?: number;
        additionalNotes?: string;
      } : null;
    } catch { return null; }
  })();

  const [guests, setGuests] = useState<Guest[]>(
    draft?.guests && Array.isArray(draft.guests) && draft.guests.length > 0
      ? draft.guests
      : [{ id: `${uid}-0`, name: "", group: "Bride's Family", plusOne: false, notes: "", relations: [] }]
  );
  const [tableCount, setTableCount] = useState(draft?.tableCount ?? 6);
  const [seatsPerTable, setSeatsPerTable] = useState(draft?.seatsPerTable ?? 8);
  const [additionalNotes, setAdditionalNotes] = useState(draft?.additionalNotes ?? "");

  // Persist the in-progress chart so leaving and returning to the tab
  // preserves whatever was being entered.
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ guests, tableCount, seatsPerTable, additionalNotes })
      );
    } catch {
      // ignore quota errors
    }
  }, [guests, tableCount, seatsPerTable, additionalNotes]);
  const [result, setResult] = useState<SeatingResult | null>(null);
  const [showGuests, setShowGuests] = useState(true);
  const [showSaved, setShowSaved] = useState(false);

  const addGuest = () => {
    setGuests(prev => [
      ...prev,
      { id: `${uid}-${Date.now()}`, name: "", group: "Bride's Family", plusOne: false, notes: "", relations: [] },
    ]);
  };

  const updateGuest = (id: string, updated: Guest) => {
    setGuests(prev => prev.map(g => g.id === id ? updated : g));
  };

  const deleteGuest = (id: string) => {
    setGuests(prev => prev
      .filter(g => g.id !== id)
      .map(g => ({ ...g, relations: g.relations.filter(r => r.targetId !== id) }))
    );
  };

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

  const { data: savedCharts = [], isLoading: chartsLoading } = useQuery<SavedChart[]>({
    queryKey: ["seating-charts"],
    queryFn: async () => {
      const r = await authedFetch("/api/seating/charts");
      if (!r.ok) return [];
      return r.json();
    },
  });

  const saveChartMutation = useMutation({
    mutationFn: async (chartResult: SeatingResult) => {
      const name = `Seating Chart ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
      const filledGuests = guests.filter(g => g.name.trim());
      const r = await authedFetch("/api/seating/charts", {
        method: "POST",
        body: JSON.stringify({
          name,
          guests: filledGuests,
          tables: chartResult.tables,
          tableCount,
          seatsPerTable,
        }),
      });
      if (!r.ok) throw new Error("Save failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seating-charts"] });
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
    },
  });

  const deleteChartMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await authedFetch(`/api/seating/charts/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seating-charts"] });
      toast({ title: "Chart deleted" });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const filledGuests = guests.filter(g => g.name.trim());
      if (filledGuests.length < 2) {
        throw new Error("Please add at least 2 guests with names.");
      }

      const payload = {
        guests: filledGuests.map(g => ({
          id: g.id,
          name: g.name.trim(),
          group: g.group,
          plusOne: g.plusOne,
          notes: g.notes,
          avoidIds: g.relations.filter(r => r.type === "avoid").map(r => r.targetId),
          preferIds: g.relations.filter(r => r.type === "prefer").map(r => r.targetId),
        })),
        tableCount,
        seatsPerTable,
        additionalNotes: additionalNotes.trim() || undefined,
      };

      const r = await authedFetch("/api/seating/generate", { method: "POST", body: JSON.stringify(payload) });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error ?? "Generation failed");
      }
      return r.json() as Promise<SeatingResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      setShowGuests(false);
      toast({ title: "Seating chart ready!", description: `${data.totalSeated} guests assigned across ${data.tables.length} tables.` });
      saveChartMutation.mutate(data);
    },
    onError: (err: Error) => {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    },
  });

  const loadChart = (chart: SavedChart) => {
    if (chart.tables) {
      setResult({
        tables: chart.tables,
        insights: [],
        warnings: [],
        totalSeated: chart.tables.reduce((sum, t) => sum + t.guests.length, 0),
      });
      setShowGuests(false);
      setShowSaved(false);
    }
    if (chart.guests && Array.isArray(chart.guests)) {
      setGuests(chart.guests as Guest[]);
      setTableCount(chart.tableCount);
      setSeatsPerTable(chart.seatsPerTable);
    }
  };

  const filledCount = guests.filter(g => g.name.trim()).length;
  const totalCapacity = tableCount * seatsPerTable;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-serif text-primary flex items-center gap-3">
          <Users className="h-8 w-8" />
          AI Seating Chart Generator
        </h1>
        <p className="text-lg text-muted-foreground mt-1">
          Add your guests, flag any tricky dynamics, and let AI arrange everyone harmoniously.
        </p>
      </div>

      {/* Saved charts */}
      {savedCharts.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <button
            onClick={() => setShowSaved(!showSaved)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Clock className="h-4 w-4 text-primary" />
              Saved Charts ({savedCharts.length})
            </div>
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showSaved ? "rotate-90" : ""}`} />
          </button>
          {showSaved && (
            <div className="border-t border-border/50 divide-y divide-border/40">
              {chartsLoading ? (
                <p className="text-sm text-muted-foreground px-5 py-4">Loading…</p>
              ) : savedCharts.map(chart => {
                const seated = chart.tables?.reduce((s, t) => s + t.guests.length, 0) ?? 0;
                const tables = chart.tables?.length ?? 0;
                return (
                  <div key={chart.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{chart.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {tables > 0 ? `${tables} tables · ${seated} guests` : "No layout yet"}
                        {" · "}{new Date(chart.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => loadChart(chart)} className="text-xs h-7 px-3">
                      Load
                    </Button>
                    <button
                      onClick={() => deleteChartMutation.mutate(chart.id)}
                      className="text-muted-foreground hover:text-destructive p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm">
          <CardContent className="p-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
              Number of Tables
            </label>
            <div className="flex items-center gap-2">
              <button onClick={() => setTableCount(t => Math.max(1, t - 1))} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-lg hover:bg-muted transition-colors">−</button>
              <span className="w-10 text-center font-bold text-xl">{tableCount}</span>
              <button onClick={() => setTableCount(t => Math.min(30, t + 1))} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-lg hover:bg-muted transition-colors">+</button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="p-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
              Seats Per Table
            </label>
            <div className="flex items-center gap-2">
              <button onClick={() => setSeatsPerTable(s => Math.max(2, s - 1))} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-lg hover:bg-muted transition-colors">−</button>
              <span className="w-10 text-center font-bold text-xl">{seatsPerTable}</span>
              <button onClick={() => setSeatsPerTable(s => Math.min(20, s + 1))} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-lg hover:bg-muted transition-colors">+</button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-primary/5">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Capacity Summary</p>
            <p className="text-2xl font-bold text-primary mt-1">{filledCount} / {totalCapacity}</p>
            <p className="text-xs text-muted-foreground">guests · seats</p>
            {filledCount > totalCapacity && (
              <p className="text-xs text-red-500 mt-1 font-medium">⚠ More guests than seats!</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowGuests(!showGuests)}
            className="flex items-center gap-2 font-serif text-xl font-semibold text-foreground hover:text-primary transition-colors"
          >
            <Users className="h-5 w-5" />
            Guest List ({filledCount})
            {showGuests ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={addGuest} className="gap-1">
              <UserPlus className="h-3.5 w-3.5" />
              Add Guest
            </Button>
          </div>
        </div>

        {showGuests && (
          <>
            <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-xl text-sm text-primary">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                <strong>Tip:</strong> Click the expand arrow on each guest to add relationships. Use ♥ to seat people together and ⚡ to keep them apart (divorces, feuds, etc.)
              </span>
            </div>

            <div className="grid md:grid-cols-2 gap-2">
              {guests.map(guest => (
                <GuestCard
                  key={guest.id}
                  guest={guest}
                  guests={guests}
                  onChange={updated => updateGuest(guest.id, updated)}
                  onDelete={() => deleteGuest(guest.id)}
                />
              ))}
              <button
                onClick={addGuest}
                className="border-2 border-dashed border-primary/30 rounded-xl p-4 text-primary/60 hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2 text-sm"
              >
                <Plus className="h-4 w-4" />
                Add another guest
              </button>
            </div>
          </>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold block">Additional Notes for AI</label>
        <Input
          value={additionalNotes}
          onChange={e => setAdditionalNotes(e.target.value)}
          placeholder="E.g., 'Keep the speeches table near the front', 'Couple's parents at Table 1', 'College friends like to party — seat near dance floor'"
          className="border-primary/20 focus:border-primary"
        />
      </div>

      <Button
        onClick={() => generateMutation.mutate()}
        disabled={generateMutation.isPending || filledCount < 2}
        size="lg"
        className="gap-2 w-full sm:w-auto"
      >
        {generateMutation.isPending ? (
          <>
            <RefreshCw className="h-5 w-5 animate-spin" />
            Generating seating chart…
          </>
        ) : (
          <>
            <Wand2 className="h-5 w-5" />
            Generate Seating Chart with AI
          </>
        )}
      </Button>

      {result && (
        <div className="space-y-6 pt-2">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-serif text-2xl font-semibold text-foreground flex items-center gap-2">
              <Heart className="h-6 w-6 text-primary fill-primary" />
              Your Seating Chart
            </h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  saveChartMutation.mutate(result);
                  toast({ title: "Saved!", description: "This chart has been saved to your collection." });
                }}
                disabled={saveChartMutation.isPending}
                className="gap-1"
              >
                <Save className="h-3.5 w-3.5" />
                Save Copy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="gap-1"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </Button>
            </div>
          </div>

          {result.warnings?.length > 0 && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-sm">Potential Conflicts</p>
                <ul className="space-y-0.5">
                  {result.warnings.map((w, i) => (
                    <li key={i} className="text-sm">{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {result.insights?.length > 0 && (
            <div className="grid md:grid-cols-2 gap-2">
              {result.insights.map((insight, i) => (
                <div key={i} className="flex items-start gap-2 p-3 bg-primary/5 rounded-xl text-sm text-primary">
                  <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {insight}
                </div>
              ))}
            </div>
          )}

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {result.tables.map((table, i) => (
              <TableCard key={table.tableNumber} table={table} index={i} />
            ))}
          </div>

          <div className="flex items-center justify-center gap-6 pt-2 text-sm text-muted-foreground border-t border-border/50">
            <span>{result.totalSeated} guests seated</span>
            <span>·</span>
            <span>{result.tables.length} tables</span>
            <span>·</span>
            <span>Generated by A.IDO AI</span>
            {saveChartMutation.isSuccess && (
              <>
                <span>·</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Auto-saved ✓</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
