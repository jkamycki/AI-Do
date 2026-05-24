import { useEffect, useState, useId, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { useGetGuests, useGetProfile, getGetGuestsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import type { Guest as GuestListGuest } from "@workspace/api-client-react";
import { authFetch } from "@/lib/authFetch";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import {
  Users, Plus, Minus, Trash2, Wand2, Heart, AlertTriangle, UserPlus,
  ChevronDown, ChevronUp, RefreshCw, Info, Armchair, Save,
  Clock, ChevronRight, Download, GripVertical, MoveRight, Pencil, FileDown,
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
  plusOneName?: string | null;
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

interface PreviewSeat {
  label: string;
  moveName: string;
  isPlusOne?: boolean;
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
const LEGACY_DRAFT_STORAGE_KEY = "aido_seating_draft_v1";

const TABLE_ACCENTS = [
  { bar: "bg-rose-500", chip: "bg-rose-100 text-rose-900 dark:bg-rose-900/50 dark:text-rose-100" },
  { bar: "bg-violet-500", chip: "bg-violet-100 text-violet-900 dark:bg-violet-900/50 dark:text-violet-100" },
  { bar: "bg-sky-500", chip: "bg-sky-100 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100" },
  { bar: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100" },
  { bar: "bg-amber-500", chip: "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100" },
  { bar: "bg-pink-500", chip: "bg-pink-100 text-pink-900 dark:bg-pink-900/50 dark:text-pink-100" },
  { bar: "bg-indigo-500", chip: "bg-indigo-100 text-indigo-900 dark:bg-indigo-900/50 dark:text-indigo-100" },
  { bar: "bg-teal-500", chip: "bg-teal-100 text-teal-900 dark:bg-teal-900/50 dark:text-teal-100" },
  { bar: "bg-orange-500", chip: "bg-orange-100 text-orange-900 dark:bg-orange-900/50 dark:text-orange-100" },
  { bar: "bg-cyan-500", chip: "bg-cyan-100 text-cyan-900 dark:bg-cyan-900/50 dark:text-cyan-100" },
];

function safeText(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function normalizeSeatingTables(tables: unknown): SeatingTable[] {
  if (!Array.isArray(tables)) return [];
  return tables.map((raw, index) => {
    const row = raw && typeof raw === "object" ? raw as Partial<SeatingTable> : {};
    const tableNumber = Number.isFinite(Number(row.tableNumber)) && Number(row.tableNumber) > 0
      ? Number(row.tableNumber)
      : index + 1;
    const guests = Array.isArray(row.guests)
      ? row.guests.map((guest) => safeText(guest)).filter(Boolean)
      : [];
    const tableName = safeText(row.tableName, `Table ${tableNumber}`);
    const theme = safeText(row.theme);
    return {
      tableNumber,
      tableName: tableName || `Table ${tableNumber}`,
      guests,
      ...(theme ? { theme } : {}),
    };
  });
}

function ensurePlannedTableCount(tables: SeatingTable[], expectedCount?: number): SeatingTable[] {
  const plannedCount = Number.isFinite(Number(expectedCount)) && Number(expectedCount) > 0
    ? Math.round(Number(expectedCount))
    : tables.length;
  if (plannedCount <= tables.length && tables.every((table, index) => table.tableNumber === index + 1)) {
    return tables;
  }

  const tableByNumber = new Map<number, SeatingTable>();
  tables.forEach((table) => {
    if (!tableByNumber.has(table.tableNumber)) {
      tableByNumber.set(table.tableNumber, table);
    }
  });

  const plannedTables = Array.from({ length: plannedCount }, (_, index) => {
    const tableNumber = index + 1;
    return tableByNumber.get(tableNumber) ?? {
      tableNumber,
      tableName: `Table ${tableNumber}`,
      guests: [],
    };
  });

  const extras = tables.filter((table) => table.tableNumber > plannedCount);
  return [...plannedTables, ...extras];
}

function normalizeSeatingResult(value: SeatingResult, expectedTableCount?: number): SeatingResult {
  const tables = ensurePlannedTableCount(normalizeSeatingTables(value.tables), expectedTableCount);
  const totalSeated = tables.reduce((sum, table) => sum + table.guests.length, 0);
  return {
    tables,
    insights: Array.isArray(value.insights) ? value.insights.map((item) => safeText(item)).filter(Boolean) : [],
    warnings: Array.isArray(value.warnings) ? value.warnings.map((item) => safeText(item)).filter(Boolean) : [],
    totalSeated: Number.isFinite(Number(value.totalSeated)) ? Number(value.totalSeated) : totalSeated,
  };
}

function normalizeSeatDisplayName(value: string) {
  return value.trim().toLowerCase();
}

function attachedGuestFromPlusOneNoteText(notes?: string | null) {
  const match = (notes ?? "").match(/^Plus one for\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function seatingDisplayRows(guestNames: string[], seatingGuests: Guest[]) {
  const seatingGuestByName = new Map(
    seatingGuests.map((guest) => [normalizeSeatDisplayName(guest.name), guest]),
  );
  return guestNames.flatMap((guestName) => {
    const guest = seatingGuestByName.get(normalizeSeatDisplayName(guestName));
    if (guest && attachedGuestFromPlusOneNoteText(guest.notes)) return [];
    const cleanPlusOneName = guest?.plusOneName?.trim();
    return [{
      name: guestName,
      plusOneLabel: guest?.plusOne ? (cleanPlusOneName ? `+ ${cleanPlusOneName}` : "+1") : null,
    }];
  });
}

function tableDisplayLabel(index: number) {
  let value = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return label;
}

function seatingPreviewSeats(guestNames: string[], seatingGuests: Guest[], seatsPerTable: number) {
  const rows = seatingDisplayRows(guestNames, seatingGuests);
  const assigned = rows.flatMap<PreviewSeat>((row) => {
    const seats: PreviewSeat[] = [{ label: row.name, moveName: row.name }];
    if (row.plusOneLabel) {
      const plusOneName = row.plusOneLabel.replace(/^\+\s*/, "").trim();
      seats.push({
        label: plusOneName && plusOneName !== "1" ? plusOneName : "Plus one",
        moveName: row.name,
        isPlusOne: true,
      });
    }
    return seats;
  });

  return {
    seats: Array.from({ length: seatsPerTable }, (_, index) => assigned[index] ?? null),
    overflow: assigned.slice(seatsPerTable),
    assignedCount: assigned.length,
  };
}

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
  const { t } = useTranslation();
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

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-card">
        <div className="flex-1 min-w-0">
          <Input
            value={guest.name}
            onChange={e => onChange({ ...guest, name: e.target.value })}
            placeholder={t("seating.guest_name_placeholder")}
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
            placeholder={t("seating.guest_notes_placeholder")}
            className="text-xs h-7"
          />
          {others.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                {t("seating.relationships")}
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {others.map(other => {
                  const rel = guest.relations.find(r => r.targetId === other.id);
                  return (
                    <div key={other.id} className="flex items-center gap-0.5 border border-border rounded-full overflow-hidden">
                      <span className="text-xs px-2 py-0.5">{other.name || "?"}</span>
                      <button
                        onClick={() => toggleRelation(other.id, "prefer")}
                        title={t("seating.seat_together")}
                        className={`px-1.5 py-0.5 text-xs transition-colors ${rel?.type === "prefer" ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300" : "hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-muted-foreground"}`}
                      >
                        Together
                      </button>
                      <button
                        onClick={() => toggleRelation(other.id, "avoid")}
                        title={t("seating.keep_apart")}
                        className={`px-1.5 py-0.5 text-xs transition-colors ${rel?.type === "avoid" ? "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300" : "hover:bg-red-50 dark:hover:bg-red-900/30 text-muted-foreground"}`}
                      >
                        Apart
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

function TableCard({
  table,
  index,
  allTables,
  seatingGuests,
  onMoveGuest,
  onUpdateTable,
}: {
  table: SeatingTable;
  index: number;
  allTables: SeatingTable[];
  seatingGuests: Guest[];
  onMoveGuest: (fromTableNumber: number, toTableNumber: number, guestName: string) => void;
  onUpdateTable: (tableNumber: number, updates: { theme?: string }) => void;
}) {
  const { t } = useTranslation();
  const accent = TABLE_ACCENTS[index % TABLE_ACCENTS.length];
  const guestNames = Array.isArray(table.guests) ? table.guests : [];
  const displayGuests = seatingDisplayRows(guestNames, seatingGuests);
  const seatCount = displayGuests.reduce((count, row) => count + 1 + (row.plusOneLabel ? 1 : 0), 0);
  const [dragOver, setDragOver] = useState(false);
  const [editingTheme, setEditingTheme] = useState(false);
  const [themeDraft, setThemeDraft] = useState(table.theme ?? "");

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const raw = e.dataTransfer.getData("application/x-aido-guest");
    if (!raw) return;
    try {
      const { fromTable, name } = JSON.parse(raw) as { fromTable: number; name: string };
      if (fromTable !== table.tableNumber) {
        onMoveGuest(fromTable, table.tableNumber, name);
      }
    } catch {
      // ignore malformed payloads
    }
  };

  const commitTheme = () => {
    const next = themeDraft.trim();
    if (next !== (table.theme ?? "")) {
      onUpdateTable(table.tableNumber, { theme: next });
    }
    setEditingTheme(false);
  };

  return (
    <Card
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`overflow-hidden border bg-card text-card-foreground shadow-sm transition-all ${dragOver ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-[1.01]" : ""}`}
    >
      <div className={`h-1.5 ${accent.bar}`} aria-hidden="true" />
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-bold font-serif text-foreground">
            Table {table.tableNumber}
          </h3>
          <Badge className={`text-xs font-medium border-0 ${accent.chip} flex-shrink-0`}>
            <Armchair className="h-3 w-3 mr-1" />
            {seatCount}
          </Badge>
        </div>
        {editingTheme ? (
          <Input
            autoFocus
            value={themeDraft}
            onChange={(e) => setThemeDraft(e.target.value)}
            onBlur={commitTheme}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commitTheme(); }
              if (e.key === "Escape") { setThemeDraft(table.theme ?? ""); setEditingTheme(false); }
            }}
            placeholder="Add a descriptionâ€¦"
            className="h-7 text-xs mt-1"
            data-testid={`input-table-theme-${table.tableNumber}`}
          />
        ) : (
          <button
            type="button"
            onClick={() => { setThemeDraft(table.theme ?? ""); setEditingTheme(true); }}
            className="group/t inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors text-left mt-0.5"
            title="Edit description"
            data-testid={`btn-edit-table-theme-${table.tableNumber}`}
          >
            <span className="truncate">
              {table.theme || <span className="italic opacity-70">Add a descriptionâ€¦</span>}
            </span>
            <Pencil className="h-3 w-3 opacity-50 md:opacity-30 group-hover/t:opacity-100 transition-opacity flex-shrink-0" />
          </button>
        )}
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0">
        <ul className="space-y-0.5">
          {displayGuests.map((row, i) => (
            <li
              key={`${row.name}-${i}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  "application/x-aido-guest",
                  JSON.stringify({ fromTable: table.tableNumber, name: row.name }),
                );
                e.dataTransfer.effectAllowed = "move";
              }}
              className="group/g flex items-start gap-2 text-sm font-medium text-foreground rounded-md px-2 py-1.5 hover:bg-muted cursor-grab active:cursor-grabbing"
              title={t("seating.drag_to_move")}
            >
              <GripVertical className="h-3.5 w-3.5 mt-1 text-muted-foreground/60 group-hover/g:text-foreground flex-shrink-0" />
              <div className={`w-5 h-5 mt-0.5 rounded-full ${accent.chip} text-[10px] flex items-center justify-center font-bold flex-shrink-0`}>
                {i + 1}
              </div>
              <span className="flex-1 min-w-0 whitespace-normal break-words leading-snug">
                {row.name}
                {row.plusOneLabel && (
                  <span className="ml-1 font-semibold text-primary">{row.plusOneLabel}</span>
                )}
              </span>
              <select
                aria-label={`Move ${row.name} to another table`}
                value=""
                onChange={(e) => {
                  const target = parseInt(e.target.value, 10);
                  if (!Number.isNaN(target) && target !== table.tableNumber) {
                    onMoveGuest(table.tableNumber, target, row.name);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="mt-0.5 w-24 sm:w-28 flex-shrink-0 text-xs bg-background text-foreground border border-border rounded px-1.5 py-0.5 cursor-pointer opacity-100 md:opacity-70 group-hover/g:opacity-100 focus:opacity-100 hover:border-primary focus:outline-none focus:border-primary"
              >
                <option value="">{t("seating.move_option")}</option>
                {allTables
                  .filter(t => t.tableNumber !== table.tableNumber)
                  .map(t => (
                    <option key={t.tableNumber} value={t.tableNumber}>
                      â†’ Table {t.tableNumber}
                    </option>
                  ))}
              </select>
            </li>
          ))}
          {displayGuests.length === 0 && (
            <li className="text-xs text-muted-foreground italic px-2 py-3 text-center border border-dashed border-border rounded-md">
              {t("seating.drop_guest_here")}
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

function SeatingPreviewTable({
  table,
  index,
  seatsPerTable,
  seatingGuests,
  onMoveGuest,
}: {
  table: SeatingTable;
  index: number;
  seatsPerTable: number;
  seatingGuests: Guest[];
  onMoveGuest: (fromTableNumber: number, toTableNumber: number, guestName: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const seatTotal = Math.max(2, Math.min(20, Math.round(seatsPerTable)));
  const { seats, overflow, assignedCount } = seatingPreviewSeats(table.guests, seatingGuests, seatTotal);
  const tableLabel = tableDisplayLabel(index);
  const tableSize = seatTotal > 14 ? 124 : seatTotal > 10 ? 116 : 104;
  const seatSize = seatTotal > 14 ? 20 : 23;
  const stageSize = tableSize + 58;
  const accent = TABLE_ACCENTS[index % TABLE_ACCENTS.length];

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const raw = e.dataTransfer.getData("application/x-aido-guest");
    if (!raw) return;
    try {
      const { fromTable, name } = JSON.parse(raw) as { fromTable: number; name: string };
      if (fromTable !== table.tableNumber) {
        onMoveGuest(fromTable, table.tableNumber, name);
      }
    } catch {
      // ignore malformed payloads
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`rounded-2xl border bg-white/85 p-3 shadow-[0_12px_30px_rgba(141,41,77,0.08)] transition-all ${dragOver ? "ring-2 ring-primary/70 scale-[1.01]" : "border-primary/10"}`}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">
            Table {tableLabel}
          </p>
          <p className="text-sm font-semibold text-foreground truncate">
            {table.tableName || `Table ${table.tableNumber}`}
          </p>
        </div>
        <Badge variant={assignedCount > seatTotal ? "destructive" : "secondary"} className="rounded-full">
          {Math.min(assignedCount, seatTotal)} / {seatTotal}
        </Badge>
      </div>

      <div className="flex items-center gap-4">
        <div
          className="relative flex-shrink-0"
          style={{ width: stageSize, height: stageSize }}
          aria-label={`Visual preview for Table ${tableLabel}`}
        >
          <div
            className="absolute left-1/2 top-1/2 rounded-full border border-primary/25 bg-gradient-to-br from-white to-[#FFF7F2] shadow-inner"
            style={{ width: tableSize, height: tableSize, transform: "translate(-50%, -50%)" }}
          >
            <div className="absolute inset-5 rounded-full border border-dashed border-primary/15" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-serif text-3xl font-bold text-primary">{tableLabel}</span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {seatTotal} seats
              </span>
            </div>
          </div>
          {seats.map((seat, seatIndex) => {
            const angle = (-90 + seatIndex * (360 / seatTotal)) * (Math.PI / 180);
            const radius = tableSize / 2 + 13;
            const x = stageSize / 2 + Math.cos(angle) * radius;
            const y = stageSize / 2 + Math.sin(angle) * radius;
            return (
              <div
                key={seatIndex}
                className={`absolute flex items-center justify-center rounded-full border text-[10px] font-semibold shadow-sm ${seat ? "border-primary/45 bg-primary/10 text-primary" : "border-primary/20 bg-white text-muted-foreground"}`}
                style={{
                  left: x,
                  top: y,
                  width: seatSize,
                  height: seatSize,
                  transform: "translate(-50%, -50%)",
                }}
                title={seat?.label ?? `Open seat ${seatIndex + 1}`}
              >
                {seatIndex + 1}
              </div>
            );
          })}
        </div>

        <div className="min-w-[132px] flex-1 overflow-hidden rounded-xl border border-primary/15 bg-white/90 text-xs">
          <div className={`grid grid-cols-[2rem_1fr] ${accent.chip}`}>
            <div className="border-r border-primary/15 px-2 py-1 font-semibold">#</div>
            <div className="px-2 py-1 font-semibold">Guest</div>
          </div>
          {seats.map((seat, seatIndex) => (
            <div
              key={seatIndex}
              draggable={Boolean(seat)}
              onDragStart={(e) => {
                if (!seat) return;
                e.dataTransfer.setData(
                  "application/x-aido-guest",
                  JSON.stringify({ fromTable: table.tableNumber, name: seat.moveName }),
                );
                e.dataTransfer.effectAllowed = "move";
              }}
              className={`grid grid-cols-[2rem_1fr] border-t border-primary/10 ${seat ? "cursor-grab active:cursor-grabbing hover:bg-primary/5" : "text-muted-foreground/55"}`}
              title={seat ? "Drag to another table" : "Open seat"}
            >
              <div className="border-r border-primary/10 px-2 py-1 tabular-nums">{seatIndex + 1}</div>
              <div className="px-2 py-1 truncate">
                {seat ? (
                  <span className={seat.isPlusOne ? "text-primary/75 italic" : "text-foreground"}>
                    {seat.label}
                  </span>
                ) : (
                  "Open seat"
                )}
              </div>
            </div>
          ))}
          {overflow.length > 0 && (
            <div className="border-t border-destructive/20 bg-destructive/10 px-2 py-1 text-[11px] font-medium text-destructive">
              +{overflow.length} over capacity
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SeatingFloorPlanPreview({
  tables,
  tableCount,
  seatsPerTable,
  seatingGuests,
  onMoveGuest,
}: {
  tables: SeatingTable[];
  tableCount: number;
  seatsPerTable: number;
  seatingGuests: Guest[];
  onMoveGuest: (fromTableNumber: number, toTableNumber: number, guestName: string) => void;
}) {
  const { t } = useTranslation();
  const seatTotal = Math.max(2, Math.min(20, Math.round(seatsPerTable)));
  const previewTables = ensurePlannedTableCount(tables, tableCount);
  const columns = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(Math.max(previewTables.length, 1)))));
  const totalCapacity = previewTables.length * seatTotal;
  const assignedSeats = previewTables.reduce(
    (sum, table) => sum + seatingPreviewSeats(table.guests, seatingGuests, seatTotal).assignedCount,
    0,
  );

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-[#FFFDFB] via-[#FFF7F2] to-[#F7DDE2]/45 shadow-[0_18px_50px_rgba(141,41,77,0.12)]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="font-serif text-2xl text-foreground">
              {t("seating.floor_plan_preview", { defaultValue: "Reception Layout Preview" })}
            </CardTitle>
            <CardDescription className="mt-1">
              {t("seating.floor_plan_preview_desc", { defaultValue: "A visual table map that follows your table count and seats-per-table settings." })}
            </CardDescription>
          </div>
          <Badge className="rounded-full bg-white text-primary border border-primary/20 shadow-sm hover:bg-white">
            {assignedSeats} / {totalCapacity} seats
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-2xl border border-primary/15 bg-white/55 p-3">
          <div
            className="grid gap-5"
            style={{
              gridTemplateColumns: `repeat(${columns}, minmax(292px, 1fr))`,
              minWidth: columns * 292 + (columns - 1) * 20,
            }}
          >
            {previewTables.map((table, index) => (
              <SeatingPreviewTable
                key={table.tableNumber}
                table={table}
                index={index}
                seatsPerTable={seatTotal}
                seatingGuests={seatingGuests}
                onMoveGuest={onMoveGuest}
              />
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {t("seating.floor_plan_drag_hint", { defaultValue: "Tip: drag a guest name in the preview or in the table cards below to move them to another table." })}
        </p>
      </CardContent>
    </Card>
  );
}

export default function SeatingChartPage() {
  const { t, i18n } = useTranslation();
  const { userId } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const uid = useId();
  const { data: profile } = useGetProfile();
  const [exportingPdf, setExportingPdf] = useState(false);
  const [resetting, setResetting] = useState(false);
  const storageScopeKey = activeWorkspace?.profileId
    ? `workspace:${activeWorkspace.profileId}`
    : userId
      ? `user:${userId}`
      : null;
  const draftStorageKey = storageScopeKey ? `aido_seating_draft_v2:${storageScopeKey}` : null;
  const seatingChartsQueryKey = ["seating-charts", storageScopeKey] as const;
  const starterGuest = () => ({ id: `${uid}-0`, name: "", group: "Bride's Family", plusOne: false, plusOneName: null, notes: "", relations: [] });

  const [guests, setGuests] = useState<Guest[]>([starterGuest()]);
  const [tableCount, setTableCount] = useState(6);
  const [seatsPerTable, setSeatsPerTable] = useState(8);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const autoLoadedRef = useRef(false);
  const loadedDraftKeyRef = useRef<string | null>(null);

  // Persist the in-progress chart so leaving and returning to the tab
  // preserves whatever was being entered. The key is scoped by user/workspace;
  // never reuse a prior account's draft guests.
  useEffect(() => {
    if (!draftStorageKey || loadedDraftKeyRef.current !== draftStorageKey) return;
    try {
      localStorage.setItem(
        draftStorageKey,
        JSON.stringify({ guests, tableCount, seatsPerTable, additionalNotes })
      );
    } catch {
      // ignore quota errors
    }
  }, [draftStorageKey, guests, tableCount, seatsPerTable, additionalNotes]);
  const [result, setResult] = useState<SeatingResult | null>(null);
  const [chartDirty, setChartDirty] = useState(false);
  const [activeChartId, setActiveChartId] = useState<number | null>(null);
  const [showGuests, setShowGuests] = useState(true);
  const [showSaved, setShowSaved] = useState(true);

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_DRAFT_STORAGE_KEY);
    } catch {
      // best-effort cleanup
    }
  }, []);

  useEffect(() => {
    if (!draftStorageKey) {
      loadedDraftKeyRef.current = null;
      return;
    }
    autoLoadedRef.current = false;
    loadedDraftKeyRef.current = null;
    setResult(null);
    setChartDirty(false);
    setActiveChartId(null);
    setShowGuests(true);
    setShowSaved(true);
    try {
      const raw = localStorage.getItem(draftStorageKey);
      const draft = raw ? JSON.parse(raw) as {
        guests?: Guest[];
        tableCount?: number;
        seatsPerTable?: number;
        additionalNotes?: string;
      } : null;
      setGuests(
        draft?.guests && Array.isArray(draft.guests) && draft.guests.length > 0
          ? draft.guests
          : [starterGuest()]
      );
      setTableCount(Number.isFinite(Number(draft?.tableCount)) ? Number(draft?.tableCount) : 6);
      setSeatsPerTable(Number.isFinite(Number(draft?.seatsPerTable)) ? Number(draft?.seatsPerTable) : 8);
      setAdditionalNotes(typeof draft?.additionalNotes === "string" ? draft.additionalNotes : "");
      loadedDraftKeyRef.current = draftStorageKey;
    } catch {
      setGuests([starterGuest()]);
      setTableCount(6);
      setSeatsPerTable(8);
      setAdditionalNotes("");
      loadedDraftKeyRef.current = draftStorageKey;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftStorageKey]);

  const moveGuest = (fromTableNumber: number, toTableNumber: number, guestName: string) => {
    if (fromTableNumber === toTableNumber || !result) return;

    const fromTable = result.tables.find(t => t.tableNumber === fromTableNumber);
    if (!fromTable) return;
    const pairNames = new Set([guestName]);
    const movingPlusOne = guests.find((guest) => normalizeSeatDisplayName(guest.name) === normalizeSeatDisplayName(guestName));
    const attachedMainName = attachedGuestFromPlusOneNoteText(movingPlusOne?.notes);
    if (attachedMainName) {
      pairNames.add(attachedMainName);
    } else {
      guests.forEach((guest) => {
        const mainName = attachedGuestFromPlusOneNoteText(guest.notes);
        if (mainName && normalizeSeatDisplayName(mainName) === normalizeSeatDisplayName(guestName)) {
          pairNames.add(guest.name);
        }
      });
    }
    const namesToMove = fromTable.guests.filter((name) => {
      for (const pairName of pairNames) {
        if (normalizeSeatDisplayName(name) === normalizeSeatDisplayName(pairName)) return true;
      }
      return false;
    });
    if (namesToMove.length === 0) return;

    const toTable = result.tables.find(t => t.tableNumber === toTableNumber);
    const namesAlreadyAtDestination = new Set((toTable?.guests ?? []).map(normalizeSeatDisplayName));
    const moveNames = namesToMove.filter((name) => !namesAlreadyAtDestination.has(normalizeSeatDisplayName(name)));
    if (moveNames.length === 0) return; // already at destination, no-op

    const destinationExists = Boolean(toTable);
    const tables = result.tables.map(t => {
      if (t.tableNumber === fromTableNumber) {
        const movingKeys = new Set(namesToMove.map(normalizeSeatDisplayName));
        const next = t.guests.filter((name) => !movingKeys.has(normalizeSeatDisplayName(name)));
        return { ...t, guests: next };
      }
      if (t.tableNumber === toTableNumber) {
        return { ...t, guests: [...t.guests, ...moveNames] };
      }
      return t;
    });
    if (!destinationExists) {
      tables.push({
        tableNumber: toTableNumber,
        tableName: `Table ${toTableNumber}`,
        guests: moveNames,
      });
      tables.sort((a, b) => a.tableNumber - b.tableNumber);
    }

    setResult({ ...result, tables });
    setChartDirty(true);
  };

  const updateTable = (tableNumber: number, updates: { theme?: string }) => {
    if (!result) return;
    const tables = result.tables.map(t =>
      t.tableNumber === tableNumber ? { ...t, ...updates } : t
    );
    setResult({ ...result, tables });
    setChartDirty(true);
  };

  const { data: guestListData, isLoading: guestListLoading, isError: guestListError } = useGetGuests();
  const guestListGuests: GuestListGuest[] = guestListData?.guests ?? [];
  const eligibleGuestListGuests = guestListGuests.filter(
    g => g.rsvpStatus !== "declined" && g.name.trim()
  );
  const importableGuestCount = eligibleGuestListGuests.length;
  const importableSeatCount = eligibleGuestListGuests.reduce(
    (count, guest) => count + 1 + (guest.plusOne ? 1 : 0),
    0,
  );
  const importCountLabel = importableGuestCount > 0
    ? ` (${importableGuestCount} guests / ${importableSeatCount} seats)`
    : "";

  const mapGuestGroup = (g?: string | null): string => {
    if (g && GROUPS.includes(g)) return g;
    switch (g) {
      case "brides_family": return "Bride's Family";
      case "grooms_family": return "Groom's Family";
      case "brides_friends": return "Bride's Friends";
      case "grooms_friends": return "Groom's Friends";
      case "brides_coworkers":
      case "grooms_coworkers":
        return "Colleagues";
      case "maid_of_honor": return "Maid of Honor";
      case "bridesmaid": return "Bridesmaid";
      case "best_man": return "Best Man";
      case "groomsmen": return "Groomsmen";
      case "other": return "Other";
      default: return "Other";
    }
  };

  const normalizeSeatName = (value: string) => value.trim().toLowerCase();
  const attachedGuestFromPlusOneNote = (notes: string) => {
    const match = notes.match(/^Plus one for\s+(.+)$/i);
    return match?.[1]?.trim() || null;
  };

  const syncGuestListPlusOnes = (current: Guest[]) => {
    if (!eligibleGuestListGuests.length) return current;

    const plusOnePlan = new Map(
      eligibleGuestListGuests
        .filter((src) => src.name.trim())
        .map((src, idx) => {
          const guestName = src.name.trim();
          return [
            normalizeSeatName(guestName),
            {
              id: `${uid}-guestlist-plus-one-${src.id ?? idx}`,
              guestName,
              plusOne: Boolean(src.plusOne),
              plusOneName: src.plusOne ? (src.plusOneName?.trim() || null) : null,
              group: mapGuestGroup(src.guestGroup),
            },
          ];
        }),
    );

    const combined = current
      .filter((guest) => !attachedGuestFromPlusOneNote(guest.notes))
      .map((guest) => {
        const plan = plusOnePlan.get(normalizeSeatName(guest.name));
        if (!plan) return guest;
        return { ...guest, group: plan.group, plusOne: plan.plusOne, plusOneName: plan.plusOneName };
      });
    const activeIds = new Set(combined.map((guest) => guest.id));

    return combined.map((guest) => {
      const relationIds = new Set<string>();
      const relations = guest.relations
        .filter((relation) => activeIds.has(relation.targetId))
        .filter((relation) => {
          const key = `${relation.type}:${relation.targetId}`;
          if (relationIds.has(key)) return false;
          relationIds.add(key);
          return true;
        });

      return { ...guest, relations };
    });
  };

  const guestSyncSignature = (list: Guest[]) => JSON.stringify(list.map((guest) => ({
    id: guest.id,
    name: guest.name,
    group: guest.group,
    plusOne: guest.plusOne,
    plusOneName: guest.plusOneName ?? null,
    notes: guest.notes,
    relations: guest.relations.map((relation) => `${relation.type}:${relation.targetId}`).sort(),
  })));

  useEffect(() => {
    if (!eligibleGuestListGuests.length) return;
    const synced = syncGuestListPlusOnes(guests);
    if (guestSyncSignature(guests) !== guestSyncSignature(synced)) {
      setGuests(synced);
      setChartDirty(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestListGuests]);

  const importFromGuestList = () => {
    if (guestListError) {
      toast({
        title: t("seating.toast_cant_load_list"),
        description: t("seating.toast_cant_load_list_desc"),
        variant: "destructive",
      });
      return;
    }
    if (guestListGuests.length === 0) {
      toast({
        title: t("seating.toast_list_empty"),
        description: t("seating.toast_list_empty_desc"),
      });
      return;
    }

    // Only seat guests who are attending or pending â€” skip declined.
    const eligible = eligibleGuestListGuests;

    const currentGuests = guests.filter((guest) => guest.name.trim() && !attachedGuestFromPlusOneNote(guest.notes));

    // Build a name set of guests already on the seating chart after dropping stale plus-one rows.
    const existingNames = new Set(
      currentGuests
        .map(g => normalizeSeatName(g.name))
        .filter(Boolean)
    );

    const additions: Guest[] = [];
    const updatesById = new Map<string, Partial<Guest>>();
    let skipped = 0;
    let updated = 0;

    eligible.forEach((src, idx) => {
      const cleanName = src.name.trim();
      if (!cleanName) return;
      const key = normalizeSeatName(cleanName);
      const group = mapGuestGroup(src.guestGroup);
      const mainGuestId = `${uid}-import-${Date.now()}-${idx}`;
      const existingMainGuest = currentGuests.find((guest) => normalizeSeatName(guest.name) === key);
      if (existingNames.has(key)) {
        const nextPlusOneName = src.plusOne ? (src.plusOneName?.trim() || null) : null;
        if (
          existingMainGuest &&
          (
            existingMainGuest.plusOne !== Boolean(src.plusOne) ||
            existingMainGuest.group !== group ||
            (existingMainGuest.plusOneName ?? null) !== nextPlusOneName
          )
        ) {
          updated++;
          updatesById.set(existingMainGuest.id, { plusOne: Boolean(src.plusOne), plusOneName: nextPlusOneName, group });
        } else {
          skipped++;
        }
        return;
      } else {
        existingNames.add(key);
        const noteParts: string[] = [];
        if (src.dietaryNotes) noteParts.push(src.dietaryNotes);
        if (src.mealChoice) noteParts.push(`meal: ${src.mealChoice}`);
        if (src.notes) noteParts.push(src.notes);
        additions.push({
          id: mainGuestId,
          name: cleanName,
          group,
          plusOne: Boolean(src.plusOne),
          plusOneName: src.plusOne ? (src.plusOneName?.trim() || null) : null,
          notes: noteParts.join(" - "),
          relations: [],
        });
      }
    });

    // Replace any empty starter rows so we don't leave blank cards behind.
    setGuests(prev => {
      const activeIds = new Set(currentGuests.map((guest) => guest.id));
      const combined = [
        ...prev
          .filter((guest) => activeIds.has(guest.id))
          .map((guest) => ({ ...guest, ...(updatesById.get(guest.id) ?? {}) })),
        ...additions,
      ];
      return syncGuestListPlusOnes(combined);
    });

    if (additions.length === 0 && updated === 0) {
      toast({
        title: t("seating.toast_in_sync"),
        description: skipped > 0
          ? t("seating.toast_in_sync_skipped", { count: skipped })
          : t("seating.toast_no_eligible"),
      });
    } else {
      toast({
        title: t("seating.toast_imported", { count: additions.length + updated }),
        description: skipped > 0
          ? t("seating.toast_skipped", { count: skipped })
          : t("seating.toast_synced"),
      });
    }
  };

  const addGuest = () => {
    setGuests(prev => [
      ...prev,
      { id: `${uid}-${Date.now()}`, name: "", group: "Bride's Family", plusOne: false, plusOneName: null, notes: "", relations: [] },
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
    return authFetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  };

  const { data: savedCharts = [], isLoading: chartsLoading } = useQuery<SavedChart[]>({
    queryKey: seatingChartsQueryKey,
    queryFn: async () => {
      const r = await authedFetch("/api/seating/charts");
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!storageScopeKey,
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
      return r.json() as Promise<SavedChart>;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: seatingChartsQueryKey });
      queryClient.invalidateQueries({ queryKey: getGetGuestsQueryKey() });
      if (saved && typeof saved.id === "number") {
        setActiveChartId(saved.id);
        // Generate auto-saves a new chart, so apply that fresh chart's
        // assignments to the guest list right away â€” same behavior as
        // explicitly clicking Load.
        applyChartMutation.mutate(saved.id);
      }
      if (draftStorageKey) {
        try { localStorage.removeItem(draftStorageKey); } catch {}
      }
    },
  });

  const updateChartMutation = useMutation({
    mutationFn: async ({ id, chartResult }: { id: number; chartResult: SeatingResult }) => {
      const filledGuests = guests.filter(g => g.name.trim());
      const r = await authedFetch(`/api/seating/charts/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          guests: filledGuests,
          tables: chartResult.tables,
          tableCount,
          seatsPerTable,
        }),
      });
      if (!r.ok) throw new Error("Update failed");
      return r.json() as Promise<SavedChart>;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: seatingChartsQueryKey });
      queryClient.invalidateQueries({ queryKey: getGetGuestsQueryKey() });
      // The chart being updated is by definition the currently loaded one,
      // so sync the guest list to its new tables.
      if (saved && typeof saved.id === "number") {
        applyChartMutation.mutate(saved.id);
      }
    },
  });

  const deleteChartMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await authedFetch(`/api/seating/charts/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: seatingChartsQueryKey });
      queryClient.invalidateQueries({ queryKey: getGetGuestsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      toast({ title: t("seating.chart_deleted") });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const filledGuests = guests.filter(g => g.name.trim());
      if (filledGuests.length < 2) {
        throw new Error("Please add at least 2 guests with names.");
      }
      const filledGuestIds = new Set(filledGuests.map((guest) => guest.id));

      const payload = {
        guests: filledGuests.map(g => ({
          id: g.id,
          name: g.name.trim(),
          group: g.group,
          plusOne: g.plusOne,
          plusOneName: g.plusOne ? (g.plusOneName?.trim() || undefined) : undefined,
          notes: g.notes,
          avoidIds: g.relations.filter(r => r.type === "avoid" && filledGuestIds.has(r.targetId)).map(r => r.targetId),
          preferIds: g.relations.filter(r => r.type === "prefer" && filledGuestIds.has(r.targetId)).map(r => r.targetId),
        })),
        tableCount,
        seatsPerTable,
        additionalNotes: additionalNotes.trim() || undefined,
        language: i18n.language,
      };

      const r = await authedFetch("/api/seating/generate", { method: "POST", body: JSON.stringify(payload) });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error ?? "Generation failed");
      }
      return r.json() as Promise<SeatingResult>;
    },
    onSuccess: (data) => {
      const normalized = normalizeSeatingResult(data, tableCount);
      setResult(normalized);
      setChartDirty(false);
      setShowGuests(false);
      toast({ title: t("seating.toast_chart_ready"), description: t("seating.toast_chart_ready_desc", { guests: normalized.totalSeated, tables: normalized.tables.length }) });
      saveChartMutation.mutate(normalized);
    },
    onError: (err: Error) => {
      toast({ title: t("seating.toast_generation_failed"), description: err.message, variant: "destructive" });
    },
  });

  const applyChartMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await authedFetch(`/api/seating/charts/${id}/apply`, { method: "POST" });
      if (!r.ok) throw new Error("Apply failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetGuestsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    },
  });

  const loadChart = (chart: SavedChart) => {
    if (chart.tables) {
      const tables = ensurePlannedTableCount(normalizeSeatingTables(chart.tables), chart.tableCount);
      setResult({
        tables,
        insights: [],
        warnings: [],
        totalSeated: tables.reduce((sum, t) => sum + t.guests.length, 0),
      });
      setChartDirty(false);
      setActiveChartId(chart.id);
      setShowGuests(false);
      setShowSaved(false);
      applyChartMutation.mutate(chart.id);
    }
    if (chart.guests && Array.isArray(chart.guests)) {
      setGuests(chart.guests as Guest[]);
      setTableCount(chart.tableCount);
      setSeatsPerTable(chart.seatsPerTable);
    }
  };

  // On first mount, if there's no in-memory result and the user has saved
  // charts, surface the most recently generated chart as the active view.
  // savedCharts come back ordered by desc(createdAt), so [0] is the latest.
  // Older charts stay accessible from the "Saved charts" list.
  useEffect(() => {
    if (autoLoadedRef.current) return;
    if (result || activeChartId !== null) { autoLoadedRef.current = true; return; }
    if (chartsLoading || savedCharts.length === 0) return;
    autoLoadedRef.current = true;
    loadChart(savedCharts[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartsLoading, savedCharts]);

  const filledGuestCount = guests.filter(g => g.name.trim()).length;
  const filledSeatCount = guests.reduce(
    (count, guest) => count + (guest.name.trim() ? 1 + (guest.plusOne ? 1 : 0) : 0),
    0,
  );
  const totalCapacity = tableCount * seatsPerTable;

  // Wipe all saved seating charts AND clear table assignments on the guest
  // list, so the dashboard tile flips back to "No seating chart yet" and the
  // guest-list assignments column resets in lockstep.
  const handleReset = async () => {
    if (!confirm(t("seating.reset_confirm", { defaultValue: "Reset seating chart? This deletes every saved chart and clears table assignments on your guest list. This cannot be undone." }))) {
      return;
    }
    setResetting(true);
    try {
      const r = await authedFetch("/api/seating/charts", { method: "DELETE" });
      if (!r.ok) throw new Error("Failed to reset");
      // Clear in-page state
      setResult(null);
      setActiveChartId(null);
      setChartDirty(false);
      setShowSaved(false);
      setShowGuests(true);
      setGuests([starterGuest()]);
      if (draftStorageKey) {
        try { localStorage.removeItem(draftStorageKey); } catch {}
      }
      // Refresh the saved-charts list and the dashboard tile (which reads
      // from /dashboard/summary's seatingSummary block).
      queryClient.invalidateQueries({ queryKey: seatingChartsQueryKey });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetGuestsQueryKey() });
      toast({ title: t("seating.reset_done", { defaultValue: "Seating chart reset" }) });
    } catch (err) {
      toast({
        title: t("seating.reset_failed", { defaultValue: "Reset failed" }),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setResetting(false);
    }
  };

  const handleExportPdf = async () => {
    if (!result) return;
    setExportingPdf(true);
    try {
      const pdfResult = normalizeSeatingResult(result, tableCount);
      if (pdfResult.tables.length === 0) {
        throw new Error("There are no seating tables to export yet.");
      }
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "p", unit: "pt", format: "letter" });

      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 48;
      const colGap = 28;
      const colW = (pageW - margin * 2 - colGap) / 2;
      let col = 0;

      // â”€â”€ Brand palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const PURPLE: [number, number, number] = [255, 247, 242];   // #FFF7F2
      const PURPLE_2: [number, number, number] = [255, 255, 255]; // #FFFFFF
      const GOLD: [number, number, number] = [141, 41, 77];   // #8D294D
      const GOLD_SOFT: [number, number, number] = [177, 108, 142]; // #B16C8E
      const WHITE: [number, number, number] = [36, 23, 29]; // #24171D
      const WHITE_DIM: [number, number, number] = [111, 62, 84]; // #6F3E54

      // Paint the entire page background â€” this fn is called for the first
      // page now and again every time we addPage().
      const paintBackground = () => {
        doc.setFillColor(...PURPLE);
        doc.rect(0, 0, pageW, pageH, "F");
      };
      paintBackground();

      // â”€â”€ Logo (right corner) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // Fetch /logo.png as a data URL so jsPDF's addImage() can embed it.
      let logoDataUrl: string | null = null;
      try {
        const res = await fetch("/logo.png");
        if (res.ok) {
          const blob = await res.blob();
          logoDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          });
        }
      } catch { /* logo failure is non-fatal */ }

      // Sized to look balanced at letter scale â€” not too small, not too big.
      const LOGO_H = 48;
      const LOGO_W = 43;
      const placeLogo = () => {
        if (!logoDataUrl) return;
        try {
          doc.addImage(logoDataUrl, "PNG", pageW - margin - LOGO_W, margin - 8, LOGO_W, LOGO_H);
        } catch { /* ignore PNG-read issues */ }
      };

      const couple = profile
        ? `${profile.partner2Name ?? ""} & ${profile.partner1Name ?? ""}`.trim()
        : "";
      const weddingDate = profile?.weddingDate
        ? (() => {
            try {
              return new Date(profile.weddingDate + "T12:00:00").toLocaleDateString(undefined, {
                weekday: "long", year: "numeric", month: "long", day: "numeric",
              });
            } catch { return profile.weddingDate; }
          })()
        : "";

      // â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      let cursorY = margin + 6;
      placeLogo();

      const centerX = pageW / 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(24);
      doc.setTextColor(...GOLD);
      doc.text(
        t("seating.your_seating_chart", { defaultValue: "Seating Chart" }),
        centerX,
        cursorY + 14,
        { align: "center" },
      );
      cursorY += 30;

      if (couple) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(13);
        doc.setTextColor(...WHITE);
        doc.text(couple, centerX, cursorY, { align: "center" });
        cursorY += 16;
      }
      if (weddingDate) {
        doc.setFontSize(11);
        doc.setTextColor(...WHITE_DIM);
        doc.text(weddingDate, centerX, cursorY, { align: "center" });
        cursorY += 18;
      }
      // Gold divider under the header
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(1);
      doc.line(margin, cursorY, pageW - margin, cursorY);
      cursorY += 22;

      const headerBottomY = cursorY;
      let leftY = headerBottomY;
      let rightY = headerBottomY;

      // â”€â”€ Tables (2-column flow) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      for (const table of pdfResult.tables) {
        const displayRows = seatingDisplayRows(table.guests, guests);
        const lineHeight = 14;
        const headerH = 18 + 8;
        const rowsH = (displayRows.length || 1) * lineHeight;
        const themeH = table.theme ? 14 : 0;
        const blockH = headerH + themeH + rowsH + 22;

        const pickCol = (): 0 | 1 => {
          const lFits = leftY + blockH <= pageH - margin - 24;
          const rFits = rightY + blockH <= pageH - margin - 24;
          if (!lFits && !rFits) return -1 as unknown as 0 | 1;
          if (!lFits) return 1;
          if (!rFits) return 0;
          return leftY <= rightY ? 0 : 1;
        };
        let chosen = pickCol();
        if ((chosen as number) === -1) {
          doc.addPage();
          paintBackground();
          placeLogo();
          // re-draw a slim gold rule at the top of new pages so the brand
          // stays consistent without repeating the full title block
          doc.setDrawColor(...GOLD);
          doc.setLineWidth(0.6);
          doc.line(margin, margin + LOGO_H + 6, pageW - margin, margin + LOGO_H + 6);
          leftY = margin + LOGO_H + 22;
          rightY = leftY;
          chosen = 0;
        }
        col = chosen;
        const x = margin + col * (colW + colGap);
        let y = col === 0 ? leftY : rightY;

        // Subtle card behind each table block for separation.
        const cardPad = 12;
        const cardX = x - cardPad;
        const cardY = y - 12;
        const cardW = colW + cardPad * 2;
        const cardH = blockH;
        doc.setFillColor(...PURPLE_2);
        doc.roundedRect(cardX, cardY, cardW, cardH, 8, 8, "F");
        doc.setDrawColor(230, 166, 183);
        doc.roundedRect(cardX, cardY, cardW, cardH, 8, 8, "S");

        // Card center used for the title/theme so the heading reads
        // symmetrically inside its rounded card.
        const cardCenterX = x + colW / 2;

        // Table header
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(...GOLD);
        const tableName = safeText(table.tableName);
        const tableTitle = tableName
          ? `Table ${table.tableNumber} - ${tableName}`
          : `Table ${table.tableNumber}`;
        doc.text(tableTitle, cardCenterX, y, { align: "center" });
        y += 16;

        const theme = safeText(table.theme);
        if (theme) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(10);
          doc.setTextColor(...GOLD_SOFT);
          const themeLines = doc.splitTextToSize(theme, colW);
          doc.text(themeLines, cardCenterX, y, { align: "center" });
          y += themeLines.length * 12 + 2;
        }

        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(...WHITE);
        if (displayRows.length === 0) {
          doc.setTextColor(...WHITE_DIM);
          doc.text("(empty)", x, y);
          y += lineHeight;
        } else {
          for (const guest of displayRows) {
            const plusOneText = guest.plusOneLabel ? ` ${guest.plusOneLabel}` : "";
            const lines = doc.splitTextToSize(`- ${safeText(guest.name, "Guest")}${plusOneText}`, colW);
            doc.text(lines, x, y);
            y += lines.length * lineHeight;
          }
        }
        y += 18;

        if (col === 0) leftY = y;
        else rightY = y;
      }

      // â”€â”€ Footer (page numbers + brand) on every page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const totalPages = (doc.internal.pages.length - 1) | 0;
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...WHITE_DIM);
        doc.text(`Page ${p} / ${totalPages}`, margin, pageH - 22);
        const right = "Generated by A.IDO";
        const rightW = doc.getTextWidth(right);
        doc.setTextColor(...GOLD_SOFT);
        doc.text(right, pageW - margin - rightW, pageH - 22);
      }

      const safe = (couple || "wedding").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      doc.save(`seating-chart-${safe || "wedding"}.pdf`);
      toast({ title: t("seating.pdf_saved", { defaultValue: "Seating chart PDF saved" }) });
    } catch (err) {
      toast({
        title: t("seating.pdf_failed", { defaultValue: "PDF export failed" }),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-serif text-primary flex items-center gap-3">
          <Users className="h-8 w-8" />
          {t("seating.title")}
        </h1>
        <p className="text-lg text-muted-foreground mt-1">
          {t("seating.subtitle")}
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
              {t("seating.saved_charts", { count: savedCharts.length })}
            </div>
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showSaved ? "rotate-90" : ""}`} />
          </button>
          {showSaved && (
            <div className="border-t border-border/50 divide-y divide-border/40">
              {chartsLoading ? (
                <p className="text-sm text-muted-foreground px-5 py-4">{t("seating.loading")}</p>
              ) : savedCharts.map(chart => {
                const chartTables = normalizeSeatingTables(chart.tables);
                const seated = chartTables.reduce((sum, table) => sum + table.guests.length, 0);
                const tables = chartTables.length;
                return (
                  <div key={chart.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{chart.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {tables > 0 ? t("seating.tables_guests_summary", { tables, seated }) : t("seating.no_layout")}
                        {" Â· "}{new Date(chart.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => loadChart(chart)} className="text-xs h-7 px-3">
                      {t("seating.load_btn")}
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
              {t("seating.number_of_tables")}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Decrease number of tables"
                onClick={() => setTableCount(t => Math.max(1, t - 1))}
                className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-lg hover:bg-muted transition-colors"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-10 text-center font-bold text-xl">{tableCount}</span>
              <button
                type="button"
                aria-label="Increase number of tables"
                onClick={() => setTableCount(t => Math.min(30, t + 1))}
                className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-lg hover:bg-muted transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="p-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
              {t("seating.seats_per_table")}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Decrease seats per table"
                onClick={() => setSeatsPerTable(s => Math.max(2, s - 1))}
                className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-lg hover:bg-muted transition-colors"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-10 text-center font-bold text-xl">{seatsPerTable}</span>
              <button
                type="button"
                aria-label="Increase seats per table"
                onClick={() => setSeatsPerTable(s => Math.min(20, s + 1))}
                className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-lg hover:bg-muted transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-primary/5">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("seating.capacity_summary")}</p>
            <p className="text-2xl font-bold text-primary mt-1">{filledSeatCount} / {totalCapacity}</p>
            <p className="text-xs text-muted-foreground">{t("seating.guests_seats")}</p>
            {filledSeatCount > totalCapacity && (
              <p className="text-xs text-red-500 mt-1 font-medium inline-flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                {t("seating.over_capacity")}
              </p>
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
            {t("seating.guest_list_header", { count: filledGuestCount })}
            {filledSeatCount !== filledGuestCount && (
              <span className="font-sans text-sm font-medium text-muted-foreground">
                / {filledSeatCount} seats
              </span>
            )}
            {showGuests ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={importFromGuestList}
              disabled={guestListLoading}
              className="gap-1"
              title={t("seating.import_title")}
            >
              <Download className="h-3.5 w-3.5" />
              {guestListLoading
                ? t("seating.loading")
                : t("seating.import_btn") + importCountLabel}
            </Button>
            <Button size="sm" variant="outline" onClick={addGuest} className="gap-1">
              <UserPlus className="h-3.5 w-3.5" />
              {t("seating.add_guest_btn")}
            </Button>
          </div>
        </div>

        {showGuests && (
          <>
            <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-xl text-sm text-primary">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                {t("seating.tip_text")}
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
                {t("seating.add_another_guest")}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold block">{t("seating.additional_notes_label")}</label>
        <Input
          value={additionalNotes}
          onChange={e => setAdditionalNotes(e.target.value)}
          placeholder={t("seating.additional_notes_placeholder")}
          className="border-primary/20 focus:border-primary"
        />
      </div>

      <Button
        onClick={() => generateMutation.mutate()}
        disabled={generateMutation.isPending || filledGuestCount < 2}
        size="lg"
        className="gap-2 w-full sm:w-auto"
      >
        {generateMutation.isPending ? (
          <>
            <RefreshCw className="h-5 w-5 animate-spin" />
            {t("seating.generating")}
          </>
        ) : (
          <>
            <Wand2 className="h-5 w-5" />
            {t("seating.generate_btn")}
          </>
        )}
      </Button>

      {result && (
        <div className="space-y-6 pt-2">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-serif text-2xl font-semibold text-foreground flex items-center gap-2">
              <Heart className="h-6 w-6 text-primary fill-primary" />
              {t("seating.your_seating_chart")}
            </h2>
            <div className="flex gap-2">
              <Button
                variant={chartDirty ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  // If we have an active chart and there are unsaved changes,
                  // update it in place. Otherwise create a new saved copy.
                  if (chartDirty && activeChartId !== null) {
                    updateChartMutation.mutate(
                      { id: activeChartId, chartResult: result },
                      {
                        onSuccess: () => {
                          setChartDirty(false);
                          toast({
                            title: t("seating.save_changes_success"),
                            description: t("seating.save_changes_success_desc"),
                          });
                        },
                        onError: () => {
                          toast({
                            title: t("seating.could_not_save"),
                            description: t("seating.could_not_save_desc"),
                            variant: "destructive",
                          });
                        },
                      },
                    );
                  } else {
                    saveChartMutation.mutate(result, {
                      onSuccess: () => {
                        setChartDirty(false);
                        toast({
                          title: t("seating.save_success"),
                          description: t("seating.save_success_desc"),
                        });
                      },
                    });
                  }
                }}
                disabled={saveChartMutation.isPending || updateChartMutation.isPending}
                className="gap-1"
              >
                <Save className="h-3.5 w-3.5" />
                {chartDirty
                  ? activeChartId !== null
                    ? t("seating.save_changes")
                    : t("seating.save_chart")
                  : t("seating.save_copy")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="gap-1"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t("seating.regenerate")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPdf}
                disabled={exportingPdf}
                className="gap-1"
                title={t("seating.export_pdf_title", { defaultValue: "Download a printable PDF of every table" })}
              >
                <FileDown className="h-3.5 w-3.5" />
                {exportingPdf
                  ? t("seating.exporting_pdf", { defaultValue: "Exportingâ€¦" })
                  : t("seating.export_pdf", { defaultValue: "Export PDF" })}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={resetting}
                className="gap-1 text-destructive hover:text-destructive border-destructive/40 hover:bg-destructive/5"
                title={t("seating.reset_title", { defaultValue: "Delete all saved seating charts and clear table assignments" })}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {resetting
                  ? t("seating.resetting", { defaultValue: "Resettingâ€¦" })
                  : t("seating.reset", { defaultValue: "Reset" })}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-primary/40 bg-primary/10 text-sm font-medium text-foreground">
            <Info className="h-4 w-4 text-primary flex-shrink-0" />
            <span>Saving this chart automatically updates the <strong className="text-primary">Table Assignment</strong> column in your Guest List.</span>
          </div>

          <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-xl text-sm text-primary">
            <MoveRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              <strong>{t("seating.make_it_yours_title")}</strong> {t("seating.drag_instruction")}
            </span>
          </div>

          {chartDirty && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl text-sm text-amber-900 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>{t("seating.unsaved_changes")}</span>
            </div>
          )}

          {result.warnings?.length > 0 && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-sm">{t("seating.potential_conflicts")}</p>
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

          <SeatingFloorPlanPreview
            tables={result.tables}
            tableCount={tableCount}
            seatsPerTable={seatsPerTable}
            seatingGuests={guests}
            onMoveGuest={moveGuest}
          />

          <div>
            <h3 className="font-serif text-xl font-semibold text-foreground">
              {t("seating.editable_table_cards", { defaultValue: "Editable Table Assignments" })}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("seating.editable_table_cards_desc", { defaultValue: "Use these cards for detailed edits, table notes, and quick move menus." })}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {result.tables.map((table, i) => (
              <TableCard
                key={table.tableNumber}
                table={table}
                index={i}
                allTables={result.tables}
                seatingGuests={guests}
                onMoveGuest={moveGuest}
                onUpdateTable={updateTable}
              />
            ))}
          </div>

          <div className="flex items-center justify-center gap-6 pt-2 text-sm text-muted-foreground border-t border-border/50">
            <span>{t("seating.guests_seated", { n: result.totalSeated })}</span>
            <span>Â·</span>
            <span>{t("seating.tables_count", { n: result.tables.length })}</span>
            <span>Â·</span>
            <span>{t("seating.generated_by")}</span>
            {saveChartMutation.isSuccess && (
              <>
                <span>Â·</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">{t("seating.auto_saved")}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
