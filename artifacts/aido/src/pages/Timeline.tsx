import { useState, useEffect, useRef, useMemo } from "react";
import {
  DndContext, closestCenter, KeyboardSensor, MouseSensor, TouchSensor,
  useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useGetTimeline, useGenerateTimeline, useGetProfile, getGetTimelineQueryKey } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import {
  CalendarClock, Wand2, Clock, FileDown, Sparkles,
  Pencil, Trash2, Plus, Save, GripVertical, MapPin,
  Camera, Music, Heart, Users, Car, AlertTriangle,
  Eye, Crown, Wine, PartyPopper, Check, X, ChevronDown,
  ChevronUp,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "";

export type Category =
  | "preparation"
  | "ceremony"
  | "cocktail"
  | "reception"
  | "photos"
  | "vendors"
  | "travel"
  | "dancing"
  | "other";

export type TimelineEvent = {
  id: string;
  startTime: string;
  endTime: string;
  title: string;
  description: string;
  category: Category;
  location: string;
  notes: string;
};

type ViewMode = "master" | "guest" | "vendor";

type Conflict = {
  eventId: string;
  type: "overlap" | "tight_gap";
  message: string;
};

const CATEGORY_CONFIG: Record<Category, {
  label: string;
  dotColor: string;
  borderColor: string;
  textColor: string;
  bgColor: string;
  badgeClass: string;
  icon: React.ReactNode;
}> = {
  preparation: {
    label: "Preparation",
    dotColor: "bg-amber-400",
    borderColor: "border-l-amber-400",
    textColor: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/20",
    badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-700",
    icon: <Sparkles className="h-3.5 w-3.5" />,
  },
  ceremony: {
    label: "Ceremony",
    dotColor: "bg-yellow-400",
    borderColor: "border-l-yellow-400",
    textColor: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-50 dark:bg-yellow-950/20",
    badgeClass: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700",
    icon: <Heart className="h-3.5 w-3.5" />,
  },
  cocktail: {
    label: "Cocktail",
    dotColor: "bg-orange-400",
    borderColor: "border-l-orange-400",
    textColor: "text-orange-500 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-950/20",
    badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-700",
    icon: <Wine className="h-3.5 w-3.5" />,
  },
  reception: {
    label: "Reception",
    dotColor: "bg-pink-400",
    borderColor: "border-l-pink-400",
    textColor: "text-pink-500 dark:text-pink-400",
    bgColor: "bg-pink-50 dark:bg-pink-950/20",
    badgeClass: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300 border-pink-200 dark:border-pink-700",
    icon: <PartyPopper className="h-3.5 w-3.5" />,
  },
  photos: {
    label: "Photos",
    dotColor: "bg-purple-400",
    borderColor: "border-l-purple-400",
    textColor: "text-purple-500 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-950/20",
    badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-700",
    icon: <Camera className="h-3.5 w-3.5" />,
  },
  vendors: {
    label: "Vendors",
    dotColor: "bg-blue-400",
    borderColor: "border-l-blue-400",
    textColor: "text-blue-500 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/20",
    badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-700",
    icon: <Users className="h-3.5 w-3.5" />,
  },
  travel: {
    label: "Travel",
    dotColor: "bg-slate-400",
    borderColor: "border-l-slate-400",
    textColor: "text-slate-500 dark:text-slate-400",
    bgColor: "bg-slate-50 dark:bg-slate-950/20",
    badgeClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-600",
    icon: <Car className="h-3.5 w-3.5" />,
  },
  dancing: {
    label: "Dancing",
    dotColor: "bg-fuchsia-400",
    borderColor: "border-l-fuchsia-400",
    textColor: "text-fuchsia-500 dark:text-fuchsia-400",
    bgColor: "bg-fuchsia-50 dark:bg-fuchsia-950/20",
    badgeClass: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-700",
    icon: <Music className="h-3.5 w-3.5" />,
  },
  other: {
    label: "Other",
    dotColor: "bg-gray-300",
    borderColor: "border-l-gray-300",
    textColor: "text-gray-500 dark:text-gray-400",
    bgColor: "bg-gray-50 dark:bg-gray-900/20",
    badgeClass: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
};

const ALL_CATEGORIES = Object.keys(CATEGORY_CONFIG) as Category[];
const VISION_STORAGE_KEY = "aido_timeline_day_vision";

function parseMinutes(time: string): number {
  if (!time) return -1;
  const parts = time.split(":");
  if (parts.length < 2) return -1;
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

function formatTime(time: string): string {
  if (!time) return "";
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr);
  const m = parseInt(mStr);
  if (isNaN(h) || isNaN(m)) return time;
  const ampm = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 || 12;
  return `${displayH}:${String(m).padStart(2, "0")} ${ampm}`;
}

function convertTimeToHHMM(time: string): string {
  if (!time) return "";
  const match = time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return "";
  const [, hStr, mStr, ampm] = match;
  let h = parseInt(hStr);
  const m = mStr.padStart(2, "0");
  if (ampm?.toUpperCase() === "PM" && h !== 12) h += 12;
  if (ampm?.toUpperCase() === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m}`;
}

function normalizeEvent(e: any): TimelineEvent {
  if (e.startTime !== undefined) {
    return {
      id: e.id ?? crypto.randomUUID(),
      startTime: e.startTime ?? "",
      endTime: e.endTime ?? "",
      title: e.title ?? "",
      description: e.description ?? "",
      category: (e.category as Category) ?? "other",
      location: e.location ?? "",
      notes: e.notes ?? "",
    };
  }
  return {
    id: crypto.randomUUID(),
    startTime: convertTimeToHHMM(e.time ?? ""),
    endTime: "",
    title: e.title ?? "",
    description: e.description ?? "",
    category: (e.category as Category) ?? "other",
    location: "",
    notes: "",
  };
}

function detectConflicts(events: TimelineEvent[]): Conflict[] {
  const sorted = [...events]
    .filter(e => e.startTime)
    .sort((a, b) => parseMinutes(a.startTime) - parseMinutes(b.startTime));

  const conflicts: Conflict[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = sorted[i];
    const next = sorted[i + 1];
    const currStart = parseMinutes(curr.startTime);
    const currEnd = curr.endTime ? parseMinutes(curr.endTime) : currStart + 30;
    const nextStart = parseMinutes(next.startTime);

    if (currEnd > nextStart && currStart < nextStart) {
      conflicts.push({
        eventId: next.id,
        type: "overlap",
        message: `Overlaps with "${curr.title}" — ends at ${formatTime(curr.endTime || "")} but next block starts at ${formatTime(next.startTime)}.`,
      });
    } else if (curr.location && next.location && curr.location !== next.location) {
      const gap = nextStart - currEnd;
      if (gap >= 0 && gap < 15) {
        conflicts.push({
          eventId: next.id,
          type: "tight_gap",
          message: `Only ${gap}min to travel from "${curr.location}" to "${next.location}".`,
        });
      }
    }
  }

  return conflicts;
}

function getViewModeEvents(events: TimelineEvent[], mode: ViewMode): TimelineEvent[] {
  if (mode === "guest") {
    return events.filter(e => ["ceremony", "cocktail", "reception", "dancing", "other"].includes(e.category));
  }
  if (mode === "vendor") {
    return events.filter(e => ["vendors", "ceremony", "reception", "other"].includes(e.category));
  }
  return events;
}

const BLANK_EVENT: Omit<TimelineEvent, "id"> = {
  startTime: "",
  endTime: "",
  title: "",
  description: "",
  category: "other",
  location: "",
  notes: "",
};

function EventFormFields({
  value,
  onChange,
}: {
  value: Omit<TimelineEvent, "id">;
  onChange: (v: Omit<TimelineEvent, "id">) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Start time</label>
          <Input
            type="time"
            value={value.startTime}
            onChange={e => onChange({ ...value, startTime: e.target.value })}
            className="font-mono"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">End time</label>
          <Input
            type="time"
            value={value.endTime}
            onChange={e => onChange({ ...value, endTime: e.target.value })}
            className="font-mono"
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Category</label>
        <Select value={value.category} onValueChange={v => onChange({ ...value, category: v as Category })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ALL_CATEGORIES.map(c => (
              <SelectItem key={c} value={c}>
                <span className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${CATEGORY_CONFIG[c].dotColor}`} />
                  {CATEGORY_CONFIG[c].label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Title *</label>
        <Input
          value={value.title}
          onChange={e => onChange({ ...value, title: e.target.value })}
          placeholder="e.g. First Dance"
          className="font-medium"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Description</label>
        <Textarea
          value={value.description}
          onChange={e => onChange({ ...value, description: e.target.value })}
          placeholder="What happens during this block..."
          className="text-sm resize-none min-h-[72px]"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Location</label>
        <Input
          value={value.location}
          onChange={e => onChange({ ...value, location: e.target.value })}
          placeholder="e.g. Main Ballroom"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Notes (private)</label>
        <Input
          value={value.notes}
          onChange={e => onChange({ ...value, notes: e.target.value })}
          placeholder="Internal notes..."
        />
      </div>
    </div>
  );
}

function SortableEventCard({
  event,
  conflict,
  onEdit,
  onDelete,
}: {
  event: TimelineEvent;
  conflict: Conflict | undefined;
  onEdit: (e: TimelineEvent) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: event.id });
  const cfg = CATEGORY_CONFIG[event.category] ?? CATEGORY_CONFIG.other;
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex gap-2 sm:gap-3 group ${isDragging ? "opacity-50 z-50" : ""}`}
    >
      <div
        {...listeners}
        {...attributes}
        className="mt-3 p-1.5 rounded text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted cursor-grab active:cursor-grabbing transition-colors flex-shrink-0 select-none"
        title="Drag to reorder"
        role="button"
        tabIndex={0}
      >
        <GripVertical className="h-4 w-4" />
      </div>

      <div className="w-16 sm:w-20 flex-shrink-0 text-right pt-3">
        <span className="text-sm font-mono font-medium text-foreground leading-tight">
          {formatTime(event.startTime)}
        </span>
        {event.endTime && (
          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
            → {formatTime(event.endTime)}
          </div>
        )}
      </div>

      <div className="relative flex-shrink-0 flex flex-col items-center mt-3">
        <div className={`w-3 h-3 rounded-full border-2 border-background ${cfg.dotColor} flex-shrink-0 z-10`} />
        <div className="w-0.5 bg-border/40 flex-1 mt-1" />
      </div>

      <div className="flex-1 pb-4 min-w-0">
        <Card className={`border-l-4 ${cfg.borderColor} border-t-0 border-r-0 border-b-0 shadow-sm hover:shadow-md transition-shadow rounded-l-none ${conflict ? "ring-1 ring-orange-400/60" : ""}`}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 font-medium flex items-center gap-1 ${cfg.badgeClass}`}>
                  {cfg.icon}
                  {cfg.label}
                </Badge>
                {conflict && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-700 flex items-center gap-1">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    {conflict.type === "overlap" ? "Overlap" : "Tight gap"}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button
                  onClick={() => onEdit(event)}
                  className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Edit block"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onDelete(event.id)}
                  className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete block"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>

            <h4 className="font-medium text-foreground text-sm leading-snug">{event.title}</h4>

            {event.description && (
              <div className={`text-sm text-muted-foreground leading-relaxed mt-1 ${!expanded && event.description.length > 120 ? "line-clamp-2" : ""}`}>
                {event.description}
              </div>
            )}
            {event.description && event.description.length > 120 && (
              <button
                onClick={() => setExpanded(v => !v)}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 mt-0.5 transition-colors"
              >
                {expanded ? <><ChevronUp className="h-3 w-3" /> Less</> : <><ChevronDown className="h-3 w-3" /> More</>}
              </button>
            )}

            {event.location && (
              <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{event.location}</span>
              </div>
            )}

            {conflict && (
              <div className="mt-2 flex items-start gap-1.5 text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20 rounded px-2 py-1.5">
                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>{conflict.message}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function Timeline() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: timeline, isLoading: isLoadingTimeline } = useGetTimeline();
  const { data: profile, isLoading: isLoadingProfile } = useGetProfile();
  const generateTimeline = useGenerateTimeline();

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [dayVision, setDayVision] = useState<string>(
    () => localStorage.getItem(VISION_STORAGE_KEY) ?? ""
  );
  const [localEvents, setLocalEvents] = useState<TimelineEvent[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("master");

  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  const [editDraft, setEditDraft] = useState<Omit<TimelineEvent, "id">>(BLANK_EVENT);

  const [addingEvent, setAddingEvent] = useState(false);
  const [newEventDraft, setNewEventDraft] = useState<Omit<TimelineEvent, "id">>(BLANK_EVENT);

  useEffect(() => {
    if (timeline?.events) {
      setLocalEvents((timeline.events as any[]).map(normalizeEvent));
      setIsDirty(false);
    }
  }, [timeline]);

  const saveTimeline = useMutation({
    mutationFn: (events: TimelineEvent[]) =>
      authFetch(`${API}/api/timeline/${timeline!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetTimelineQueryKey() });
      setIsDirty(false);
      toast({ title: "Timeline saved" });
    },
    onError: () => toast({ title: t("timeline.could_not_save"), variant: "destructive" }),
  });

  const eventsRef = useRef<TimelineEvent[]>(localEvents);
  const dirtyRef = useRef(false);
  const timelineIdRef = useRef<number | null>(null);
  useEffect(() => { eventsRef.current = localEvents; }, [localEvents]);
  useEffect(() => { dirtyRef.current = isDirty; }, [isDirty]);
  useEffect(() => { timelineIdRef.current = timeline?.id ?? null; }, [timeline?.id]);

  useEffect(() => {
    if (!isDirty || !timeline?.id) return;
    const timer = setTimeout(() => saveTimeline.mutate(localEvents), 1000);
    return () => clearTimeout(timer);
  }, [isDirty, localEvents, timeline?.id]);

  useEffect(() => {
    const flush = () => {
      if (!dirtyRef.current || !timelineIdRef.current) return;
      authFetch(`${API}/api/timeline/${timelineIdRef.current}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: eventsRef.current }),
        keepalive: true,
      }).catch(() => {});
      dirtyRef.current = false;
    };
    window.addEventListener("beforeunload", flush);
    return () => { window.removeEventListener("beforeunload", flush); flush(); };
  }, []);

  function updateLocal(events: TimelineEvent[]) {
    setLocalEvents(events);
    setIsDirty(true);
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = localEvents.findIndex(ev => ev.id === active.id);
    const newIndex = localEvents.findIndex(ev => ev.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) updateLocal(arrayMove(localEvents, oldIndex, newIndex));
  }

  function openEdit(event: TimelineEvent) {
    setEditingEvent(event);
    setEditDraft({ startTime: event.startTime, endTime: event.endTime, title: event.title, description: event.description, category: event.category, location: event.location, notes: event.notes });
  }

  function submitEdit() {
    if (!editingEvent || !editDraft.title.trim()) return;
    updateLocal(localEvents.map(e => e.id === editingEvent.id ? { ...editDraft, id: editingEvent.id } : e));
    setEditingEvent(null);
  }

  function deleteEvent(id: string) {
    updateLocal(localEvents.filter(e => e.id !== id));
  }

  function openAdd() {
    setNewEventDraft({ ...BLANK_EVENT });
    setAddingEvent(true);
  }

  function submitAdd() {
    if (!newEventDraft.title.trim()) return;
    updateLocal([...localEvents, { ...newEventDraft, id: crypto.randomUUID() }]);
    setAddingEvent(false);
  }

  const conflicts = useMemo(() => detectConflicts(localEvents), [localEvents]);

  const visibleEvents = useMemo(() => getViewModeEvents(localEvents, viewMode), [localEvents, viewMode]);

  const handleGenerate = () => {
    if (!profile?.id) {
      toast({ variant: "destructive", title: t("timeline.profile_required_title"), description: t("timeline.profile_required_desc") });
      return;
    }
    generateTimeline.mutate(
      { data: { profileId: profile.id, dayVision: dayVision.trim() || undefined } },
      {
        onSuccess: () => {
          toast({ title: t("timeline.generated_title"), description: t("timeline.generated_desc") });
          queryClient.invalidateQueries({ queryKey: getGetTimelineQueryKey() });
          setIsDirty(false);
          setEditingEvent(null);
          setAddingEvent(false);
        },
        onError: () => toast({ variant: "destructive", title: t("timeline.generation_failed_title"), description: t("timeline.generation_failed_desc") }),
      }
    );
  };

  const handleDownloadPdf = async () => {
    if (!localEvents.length) return;
    setIsDownloadingPdf(true);
    try {
      const coupleName = profile ? `${profile.partner1Name} & ${profile.partner2Name}` : undefined;
      const eventsForPdf = visibleEvents.map(e => ({
        time: e.startTime ? formatTime(e.startTime) : "",
        title: e.title,
        description: e.description,
        category: e.category,
        location: e.location,
        endTime: e.endTime ? formatTime(e.endTime) : "",
      }));
      const response = await fetch("/api/pdf/timeline", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: eventsForPdf, coupleName, weddingDate: profile?.weddingDate, venue: profile?.venue }),
      });
      if (!response.ok) throw new Error("PDF failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const suffix = viewMode !== "master" ? `-${viewMode}` : "";
      a.href = url; a.download = `aido-timeline${suffix}.pdf`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: t("timeline.pdf_downloaded") });
    } catch {
      toast({ variant: "destructive", title: t("timeline.pdf_failed_title") });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (isLoadingTimeline || isLoadingProfile) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-32 w-full" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      </div>
    );
  }

  const hasTimeline = localEvents.length > 0;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-serif text-primary flex items-center gap-3">
            <CalendarClock className="h-8 w-8" />
            {t("timeline.title")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("timeline.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isDirty && (
            <Button
              variant="default" size="sm"
              onClick={() => saveTimeline.mutate(localEvents)}
              disabled={saveTimeline.isPending}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            >
              {saveTimeline.isPending
                ? <div className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                : <Save className="h-3.5 w-3.5" />}
              {t("timeline.save_btn")}
            </Button>
          )}
          {hasTimeline && (
            <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={isDownloadingPdf} data-testid="btn-download-timeline-pdf" className="gap-1.5">
              {isDownloadingPdf
                ? <div className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                : <FileDown className="h-3.5 w-3.5" />}
              {isDownloadingPdf ? "Exporting…" : "PDF"}
            </Button>
          )}
          <Button
            onClick={handleGenerate}
            disabled={generateTimeline.isPending}
            variant={hasTimeline ? "outline" : "default"}
            size="sm"
            data-testid="btn-generate-timeline"
            className="gap-1.5"
          >
            {generateTimeline.isPending
              ? <><div className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />{t("timeline.crafting_magic")}</>
              : <><Wand2 className="h-3.5 w-3.5" />{hasTimeline ? t("timeline.regenerate_timeline") : t("timeline.generate_with_ai")}</>}
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-sm bg-card">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
            <p className="text-sm font-medium text-primary">{t("timeline.vision_card_title")}</p>
          </div>
          <Textarea
            placeholder={t("timeline.vision_placeholder")}
            value={dayVision}
            onChange={e => { setDayVision(e.target.value); localStorage.setItem(VISION_STORAGE_KEY, e.target.value); }}
            className="min-h-[80px] resize-none text-sm"
            data-testid="input-day-vision"
          />
        </CardContent>
      </Card>

      {!hasTimeline ? (
        <Card className="border-none shadow-sm bg-card text-center py-16 px-6">
          <div className="max-w-sm mx-auto space-y-5">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Clock className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-serif text-2xl text-primary">{t("timeline.no_timeline_yet")}</h3>
            <p className="text-muted-foreground text-sm">{t("timeline.no_timeline_generate_desc")}</p>
            <Button onClick={handleGenerate} disabled={generateTimeline.isPending} size="lg" className="px-8">
              {generateTimeline.isPending
                ? <span className="flex items-center gap-2"><div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />{t("timeline.crafting_magic")}</span>
                : t("timeline.generate_now")}
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              {([
                { mode: "master", icon: <Crown className="h-3.5 w-3.5" />, label: "Master" },
                { mode: "guest", icon: <Eye className="h-3.5 w-3.5" />, label: "Guest View" },
                { mode: "vendor", icon: <Users className="h-3.5 w-3.5" />, label: "Vendor View" },
              ] as const).map(({ mode, icon, label }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    viewMode === mode
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {icon}{label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {conflicts.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20 rounded-lg px-3 py-1.5 border border-orange-200 dark:border-orange-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>{conflicts.length} conflict{conflicts.length > 1 ? "s" : ""} detected</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {visibleEvents.length} block{visibleEvents.length !== 1 ? "s" : ""}
                {viewMode !== "master" && <span className="text-primary ml-1">({viewMode} view)</span>}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={visibleEvents.map(e => e.id)} strategy={verticalListSortingStrategy}>
                {visibleEvents.map(event => (
                  <SortableEventCard
                    key={event.id}
                    event={event}
                    conflict={conflicts.find(c => c.eventId === event.id)}
                    onEdit={openEdit}
                    onDelete={deleteEvent}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {viewMode === "master" && (
              <div className="flex justify-center pt-2 pl-24 sm:pl-28">
                <Button variant="outline" size="sm" onClick={openAdd} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Add Block
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      <Dialog open={!!editingEvent} onOpenChange={open => !open && setEditingEvent(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-primary">Edit Block</DialogTitle>
            <DialogDescription>Update this timeline block's details.</DialogDescription>
          </DialogHeader>
          <EventFormFields value={editDraft} onChange={setEditDraft} />
          <div className="flex gap-2 pt-2">
            <Button onClick={submitEdit} disabled={!editDraft.title.trim()} className="flex-1 gap-1.5">
              <Check className="h-3.5 w-3.5" /> Save Changes
            </Button>
            <Button variant="outline" onClick={() => setEditingEvent(null)} className="gap-1.5">
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addingEvent} onOpenChange={open => !open && setAddingEvent(false)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-primary">Add Block</DialogTitle>
            <DialogDescription>Add a new event to your wedding day timeline.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-1.5 pb-2">
            {(["ceremony", "reception", "photos", "vendors", "travel"] as Category[]).map(cat => (
              <button
                key={cat}
                onClick={() => setNewEventDraft(d => ({ ...d, category: cat }))}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border transition-all ${
                  newEventDraft.category === cat
                    ? CATEGORY_CONFIG[cat].badgeClass + " ring-1 ring-current"
                    : "border-border/40 text-muted-foreground hover:border-border"
                }`}
              >
                {CATEGORY_CONFIG[cat].icon}
                {CATEGORY_CONFIG[cat].label}
              </button>
            ))}
          </div>
          <EventFormFields value={newEventDraft} onChange={setNewEventDraft} />
          <div className="flex gap-2 pt-2">
            <Button onClick={submitAdd} disabled={!newEventDraft.title.trim()} className="flex-1 gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add Block
            </Button>
            <Button variant="outline" onClick={() => setAddingEvent(false)} className="gap-1.5">
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
