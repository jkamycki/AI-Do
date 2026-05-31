import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useGetBudget,
  useGetChecklist,
  useGetProfile,
  useGetTimeline,
  useListVendors,
} from "@workspace/api-client-react";
import type { BudgetItem, ChecklistItem, Vendor, VendorPayment } from "@workspace/api-client-react";
import { authFetch } from "@/lib/authFetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarDays,
  CheckSquare,
  Clock,
  CreditCard,
  Hotel,
  Link as LinkIcon,
  Plus,
  Store,
  Trash2,
  Users,
} from "lucide-react";
import { Link } from "wouter";

import { API_BASE_URL } from "@/lib/apiBase";

const API = API_BASE_URL;
const CUSTOM_EVENTS_KEY = "aido_calendar_custom_events_v1";

type CalendarEventType =
  | "task"
  | "payment"
  | "vendor"
  | "hotel"
  | "day_of"
  | "wedding"
  | "custom";

type CalendarEvent = {
  id: string;
  type: CalendarEventType;
  title: string;
  date: string;
  time?: string | null;
  detail?: string;
  href?: string;
  sourceLabel: string;
  completed?: boolean;
};

type CustomCalendarEvent = {
  id: string;
  title: string;
  type: "custom" | "vendor" | "payment" | "task";
  date: string;
  time?: string;
  notes?: string;
};

type HotelBlock = {
  id: number;
  hotelName: string;
  cutoffDate?: string | null;
  checkInDate?: string | null;
  checkOutDate?: string | null;
};

const eventTypeMeta: Record<CalendarEventType, { label: string; className: string; icon: React.ElementType }> = {
  task: { label: "Task", className: "bg-rose-100 text-rose-800 border-rose-200", icon: CheckSquare },
  payment: { label: "Payment", className: "bg-amber-100 text-amber-800 border-amber-200", icon: CreditCard },
  vendor: { label: "Vendor", className: "bg-blue-100 text-blue-800 border-blue-200", icon: Store },
  hotel: { label: "Hotel", className: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: Hotel },
  day_of: { label: "Day-of", className: "bg-violet-100 text-violet-800 border-violet-200", icon: Clock },
  wedding: { label: "Wedding", className: "bg-pink-100 text-pink-800 border-pink-200", icon: CalendarDays },
  custom: { label: "Custom", className: "bg-slate-100 text-slate-800 border-slate-200", icon: LinkIcon },
};

function parseDateOnly(value?: string | null): Date | null {
  if (!value) return null;
  const datePart = value.slice(0, 10);
  const [year, month, day] = datePart.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(value: string) {
  const parsed = parseDateOnly(value);
  if (!parsed) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(parsed);
}

function formatMonthTitle(date: Date) {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date);
}

function eventSort(a: CalendarEvent, b: CalendarEvent) {
  const dateCompare = a.date.localeCompare(b.date);
  if (dateCompare !== 0) return dateCompare;
  return String(a.time ?? "").localeCompare(String(b.time ?? ""));
}

function daysUntil(value: string) {
  const parsed = parseDateOnly(value);
  if (!parsed) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);
  return Math.round((parsed.getTime() - today.getTime()) / 86400000);
}

function loadCustomEvents(): CustomCalendarEvent[] {
  try {
    const raw = localStorage.getItem(CUSTOM_EVENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCustomEvents(events: CustomCalendarEvent[]) {
  localStorage.setItem(CUSTOM_EVENTS_KEY, JSON.stringify(events));
}

function monthDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function asTimelineEvents(timeline: unknown): Array<Record<string, unknown>> {
  const events = (timeline as { events?: unknown })?.events;
  return Array.isArray(events) ? events.filter((item): item is Record<string, unknown> => !!item && typeof item === "object") : [];
}

function buildEvents({
  budgetItems,
  checklistItems,
  customEvents,
  hotels,
  profile,
  timeline,
  vendors,
}: {
  budgetItems: BudgetItem[];
  checklistItems: ChecklistItem[];
  customEvents: CustomCalendarEvent[];
  hotels: HotelBlock[];
  profile: ReturnType<typeof useGetProfile>["data"];
  timeline: unknown;
  vendors: Vendor[];
}): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const weddingDate = profile?.weddingDate?.slice(0, 10);

  if (weddingDate) {
    events.push({
      id: "wedding-date",
      type: "wedding",
      title: `${profile?.partner1Name ?? "Wedding"} & ${profile?.partner2Name ?? "Celebration"}`,
      date: weddingDate,
      time: profile?.ceremonyTime || undefined,
      detail: profile?.venue ? `Wedding day at ${profile.venue}` : "Wedding day",
      href: "/profile",
      sourceLabel: "Wedding profile",
    });
  }

  for (const item of checklistItems) {
    if (!item.dueDate) continue;
    events.push({
      id: `task:${item.id}`,
      type: "task",
      title: item.task,
      date: item.dueDate,
      detail: item.description || item.month,
      href: "/checklist",
      sourceLabel: "Checklist",
      completed: item.isCompleted,
    });
  }

  for (const item of budgetItems) {
    if (!item.nextPaymentDue || item.isPaid) continue;
    events.push({
      id: `budget:${item.id}`,
      type: "payment",
      title: `${item.vendor || item.category} payment due`,
      date: item.nextPaymentDue,
      detail: `$${(item.actualCost || item.estimatedCost || 0).toLocaleString()} budget item`,
      href: "/budget",
      sourceLabel: "Budget",
    });
  }

  for (const vendor of vendors) {
    if (vendor.nextPaymentDue && !vendor.contractSigned) {
      events.push({
        id: `vendor-next:${vendor.id}`,
        type: "vendor",
        title: `${vendor.name} follow-up`,
        date: vendor.nextPaymentDue,
        detail: `${vendor.category} next payment or contract follow-up`,
        href: "/vendors",
        sourceLabel: "Vendors",
      });
    }
    const payments = Array.isArray(vendor.payments) ? vendor.payments : [];
    for (const payment of payments as VendorPayment[]) {
      if (!payment.dueDate || payment.isPaid) continue;
      events.push({
        id: `vendor-payment:${payment.id}`,
        type: "payment",
        title: `${vendor.name}: ${payment.label}`,
        date: payment.dueDate,
        detail: `$${payment.amount.toLocaleString()} due`,
        href: "/vendors",
        sourceLabel: "Vendor payment",
      });
    }
  }

  for (const hotel of hotels) {
    if (hotel.cutoffDate) {
      events.push({
        id: `hotel-cutoff:${hotel.id}`,
        type: "hotel",
        title: `${hotel.hotelName} block cutoff`,
        date: hotel.cutoffDate,
        detail: "Final date for guests to book this room block",
        href: "/hotels",
        sourceLabel: "Hotel blocks",
      });
    }
    if (hotel.checkInDate) {
      events.push({
        id: `hotel-checkin:${hotel.id}`,
        type: "hotel",
        title: `${hotel.hotelName} check-in starts`,
        date: hotel.checkInDate,
        href: "/hotels",
        sourceLabel: "Hotel blocks",
      });
    }
  }

  if (weddingDate) {
    for (const event of asTimelineEvents(timeline)) {
      const title = String(event.title ?? "");
      if (!title) continue;
      events.push({
        id: `timeline:${String(event.id ?? title)}`,
        type: "day_of",
        title,
        date: weddingDate,
        time: String(event.startTime ?? event.time ?? ""),
        detail: String(event.description ?? event.location ?? ""),
        href: "/day-of",
        sourceLabel: "Day-of timeline",
      });
    }
  }

  for (const event of customEvents) {
    events.push({
      id: `custom:${event.id}`,
      type: event.type === "vendor" ? "vendor" : event.type === "payment" ? "payment" : event.type === "task" ? "task" : "custom",
      title: event.title,
      date: event.date,
      time: event.time,
      detail: event.notes,
      sourceLabel: "Custom",
    });
  }

  return events.sort(eventSort);
}

export default function Calendar() {
  const { data: profile, isLoading: profileLoading } = useGetProfile();
  const { data: checklist, isLoading: checklistLoading } = useGetChecklist();
  const { data: budget, isLoading: budgetLoading } = useGetBudget();
  const { data: vendors = [], isLoading: vendorsLoading } = useListVendors();
  const { data: timeline, isLoading: timelineLoading } = useGetTimeline();
  const { data: hotels = [], isLoading: hotelsLoading } = useQuery<HotelBlock[]>({
    queryKey: ["hotels"],
    queryFn: async () => {
      const response = await authFetch(`${API}/api/hotels`);
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const [customEvents, setCustomEvents] = useState<CustomCalendarEvent[]>(() =>
    typeof localStorage === "undefined" ? [] : loadCustomEvents(),
  );
  const [month, setMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [activeType, setActiveType] = useState<CalendarEventType | "all">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", type: "custom", date: dateKey(new Date()), time: "", notes: "" });

  const events = useMemo(() => buildEvents({
    budgetItems: budget?.items ?? [],
    checklistItems: checklist?.items ?? [],
    customEvents,
    hotels,
    profile,
    timeline,
    vendors,
  }), [budget?.items, checklist?.items, customEvents, hotels, profile, timeline, vendors]);

  const filteredEvents = useMemo(
    () => events.filter((event) => activeType === "all" || event.type === activeType),
    [activeType, events],
  );

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    for (const event of filteredEvents) {
      grouped.set(event.date, [...(grouped.get(event.date) ?? []), event]);
    }
    return grouped;
  }, [filteredEvents]);

  const selectedEvents = eventsByDate.get(selectedDate) ?? [];
  const upcomingEvents = filteredEvents.filter((event) => (daysUntil(event.date) ?? -1) >= 0).slice(0, 8);
  const overdueEvents = filteredEvents.filter((event) => {
    const delta = daysUntil(event.date);
    return delta !== null && delta < 0 && !event.completed;
  });
  const isLoading = profileLoading || checklistLoading || budgetLoading || vendorsLoading || timelineLoading || hotelsLoading;

  const saveCustomEvent = () => {
    if (!form.title.trim() || !form.date) return;
    const next: CustomCalendarEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: form.title.trim(),
      type: form.type as CustomCalendarEvent["type"],
      date: form.date,
      time: form.time || undefined,
      notes: form.notes.trim() || undefined,
    };
    const updated = [next, ...customEvents];
    setCustomEvents(updated);
    saveCustomEvents(updated);
    setDialogOpen(false);
    setForm({ title: "", type: "custom", date: selectedDate, time: "", notes: "" });
  };

  const removeCustomEvent = (eventId: string) => {
    const customId = eventId.replace(/^custom:/, "");
    const updated = customEvents.filter((event) => event.id !== customId);
    setCustomEvents(updated);
    saveCustomEvents(updated);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            <CalendarDays className="h-3.5 w-3.5" />
            Wedding Calendar
          </div>
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Every date, in one calm view.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
            Calendar automatically gathers checklist deadlines, payments, hotel blocks, and wedding-day timing. Add appointments manually while we build deeper calendar sync.
          </p>
        </div>
        <Button onClick={() => { setForm((current) => ({ ...current, date: selectedDate })); setDialogOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" />
          Add event
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard label="Upcoming" value={upcomingEvents.length} />
        <SummaryCard label="Overdue" value={overdueEvents.length} tone={overdueEvents.length ? "danger" : "default"} />
        <SummaryCard label="Custom" value={customEvents.length} />
        <SummaryCard label="Sources" value="6" />
      </div>

      <Card className="border-primary/15 bg-gradient-to-r from-primary/5 via-card to-[#F4DEBE]/35">
        <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-primary/20 bg-primary/10 shadow-sm">
              <img src="/aria-avatar.png" alt="Aria" className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Aria weekly brief</p>
              <p className="text-sm text-muted-foreground">
                You have {upcomingEvents.slice(0, 7).length} upcoming calendar items and {overdueEvents.length} overdue item{overdueEvents.length === 1 ? "" : "s"} to review.
              </p>
            </div>
          </div>
          <Button variant="outline" asChild>
            <Link href="/aria">Ask Aria what to prioritize</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {(["all", "task", "payment", "vendor", "hotel", "day_of", "wedding", "custom"] as const).map((type) => (
          <Button
            key={type}
            variant={activeType === type ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveType(type)}
          >
            {type === "all" ? "All" : eventTypeMeta[type].label}
          </Button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="font-serif text-2xl">{formatMonthTitle(month)}</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>Previous</Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = new Date();
                  setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                  setSelectedDate(dateKey(today));
                }}
              >
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>Next</Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 35 }, (_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)}
              </div>
            ) : (
              <>
                <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day}>{day}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {monthDays(month).map((day) => {
                    const key = dateKey(day);
                    const dayEvents = eventsByDate.get(key) ?? [];
                    const isCurrentMonth = day.getMonth() === month.getMonth();
                    const isSelected = key === selectedDate;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedDate(key)}
                        className={`min-h-24 rounded-xl border p-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 ${
                          isSelected ? "border-primary bg-primary/8" : "border-border bg-card"
                        } ${isCurrentMonth ? "" : "opacity-45"}`}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-sm font-semibold text-foreground">{day.getDate()}</span>
                          {dayEvents.length > 0 && <span className="text-[10px] font-bold text-primary">{dayEvents.length}</span>}
                        </div>
                        <div className="space-y-1">
                          {dayEvents.slice(0, 3).map((event) => (
                            <div key={event.id} className={`truncate rounded-full border px-1.5 py-0.5 text-[10px] ${eventTypeMeta[event.type].className}`}>
                              {event.title}
                            </div>
                          ))}
                          {dayEvents.length > 3 && <p className="text-[10px] text-muted-foreground">+{dayEvents.length - 3} more</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-2xl">{formatDateLabel(selectedDate)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedEvents.length === 0 ? (
                <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                  Nothing scheduled here yet.
                </div>
              ) : (
                selectedEvents.map((event) => <EventRow key={event.id} event={event} onDelete={event.id.startsWith("custom:") ? removeCustomEvent : undefined} />)
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-2xl">Upcoming agenda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming items for this filter.</p>
              ) : (
                upcomingEvents.map((event) => <EventRow key={`upcoming-${event.id}`} event={event} compact />)
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Add calendar event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Title</label>
              <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Florist design call" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Type</label>
                <Select value={form.type} onValueChange={(value) => setForm((current) => ({ ...current, type: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Custom</SelectItem>
                    <SelectItem value="vendor">Vendor meeting</SelectItem>
                    <SelectItem value="payment">Payment</SelectItem>
                    <SelectItem value="task">Task</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Date</label>
                <Input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Time</label>
                <Input type="time" value={form.time} onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Notes</label>
              <Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Add meeting link, location, or what to prepare." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveCustomEvent}>Save event</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ label, value, tone = "default" }: { label: string; value: number | string; tone?: "default" | "danger" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`mt-1 font-serif text-3xl font-semibold ${tone === "danger" ? "text-destructive" : "text-foreground"}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function EventRow({ compact = false, event, onDelete }: { compact?: boolean; event: CalendarEvent; onDelete?: (id: string) => void }) {
  const meta = eventTypeMeta[event.type];
  const Icon = meta.icon;
  const delta = daysUntil(event.date);
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${meta.className}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold leading-tight text-foreground">{event.title}</p>
            <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDateLabel(event.date)}{event.time ? ` at ${event.time}` : ""}{delta !== null && delta >= 0 ? ` - in ${delta} day${delta === 1 ? "" : "s"}` : ""}
          </p>
          {!compact && event.detail && <p className="mt-2 text-sm leading-5 text-muted-foreground">{event.detail}</p>}
          <div className="mt-2 flex items-center gap-2">
            {event.href && (
              <Button size="sm" variant="outline" asChild>
                <Link href={event.href}>Open {event.sourceLabel}</Link>
              </Button>
            )}
            {onDelete && (
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(event.id)}>
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
