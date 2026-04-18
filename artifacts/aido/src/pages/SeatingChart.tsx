import { useState, useId } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Plus, Trash2, Wand2, Heart, AlertTriangle, UserPlus,
  ChevronDown, ChevronUp, Download, RefreshCw, Info, Armchair,
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

const GROUPS = ["Bride's Family", "Groom's Family", "Bride's Friends", "Groom's Friends", "Colleagues", "Other"];
const TABLE_COLORS = [
  "bg-rose-50 border-rose-200",
  "bg-violet-50 border-violet-200",
  "bg-sky-50 border-sky-200",
  "bg-emerald-50 border-emerald-200",
  "bg-amber-50 border-amber-200",
  "bg-pink-50 border-pink-200",
  "bg-indigo-50 border-indigo-200",
  "bg-teal-50 border-teal-200",
  "bg-orange-50 border-orange-200",
  "bg-cyan-50 border-cyan-200",
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
                {preferCount > 0 && <span className="text-emerald-600">♥ {preferCount}</span>}
                {preferCount > 0 && avoidCount > 0 && " · "}
                {avoidCount > 0 && <span className="text-red-500">⚡ {avoidCount}</span>}
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
                        className={`px-1.5 py-0.5 text-xs transition-colors ${rel?.type === "prefer" ? "bg-emerald-100 text-emerald-700" : "hover:bg-emerald-50 text-muted-foreground"}`}
                      >
                        ♥
                      </button>
                      <button
                        onClick={() => toggleRelation(other.id, "avoid")}
                        title="Keep apart"
                        className={`px-1.5 py-0.5 text-xs transition-colors ${rel?.type === "avoid" ? "bg-red-100 text-red-700" : "hover:bg-red-50 text-muted-foreground"}`}
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
    <Card className={`border ${colorClass} shadow-sm`}>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold font-serif">{table.tableName}</CardTitle>
          <Badge variant="outline" className="text-xs border-current">
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
            <li key={i} className="flex items-center gap-2 text-sm">
              <div className="w-5 h-5 rounded-full bg-current/15 text-[10px] flex items-center justify-center font-bold flex-shrink-0">
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
  const uid = useId();
  const [guests, setGuests] = useState<Guest[]>([
    { id: `${uid}-0`, name: "", group: "Bride's Family", plusOne: false, notes: "", relations: [] },
  ]);
  const [tableCount, setTableCount] = useState(6);
  const [seatsPerTable, setSeatsPerTable] = useState(8);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [result, setResult] = useState<SeatingResult | null>(null);
  const [showGuests, setShowGuests] = useState(true);

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
    },
    onError: (err: Error) => {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    },
  });

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
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
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
          </div>
        </div>
      )}
    </div>
  );
}
