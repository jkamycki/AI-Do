import { useState, useEffect, useRef } from "react";
import { useGetTimeline, useGenerateTimeline, useGetProfile, getGetTimelineQueryKey } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import {
  CalendarClock, Wand2, Clock, FileDown, Sparkles,
  Pencil, Trash2, Plus, Check, X, Save,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "";

type TimelineEvent = {
  time: string;
  title: string;
  description: string;
  category: string;
};

const CATEGORIES = ["preparation", "ceremony", "cocktail", "reception", "dancing", "other"];
const VISION_STORAGE_KEY = "aido_timeline_day_vision";

function categoryColor(cat: string) {
  if (cat.toLowerCase().includes("ceremony")) return "text-primary bg-primary/10 border-primary/20";
  if (cat.toLowerCase().includes("reception")) return "text-secondary-foreground bg-secondary/50 border-secondary/50";
  if (cat.toLowerCase().includes("prep")) return "text-accent-foreground bg-accent border-accent/50";
  return "text-muted-foreground bg-muted border-muted-foreground/20";
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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<TimelineEvent>({ time: "", title: "", description: "", category: "other" });
  const [addingEvent, setAddingEvent] = useState(false);
  const [newEvent, setNewEvent] = useState<TimelineEvent>({ time: "", title: "", description: "", category: "other" });

  useEffect(() => {
    if (timeline?.events) {
      setLocalEvents(timeline.events as TimelineEvent[]);
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
    },
    onError: () => toast({ title: t("timeline.could_not_save"), variant: "destructive" }),
  });

  // Refs for autosave-on-unmount
  const eventsRef = useRef<TimelineEvent[]>(localEvents);
  const dirtyRef = useRef(false);
  const timelineIdRef = useRef<number | null>(null);
  useEffect(() => { eventsRef.current = localEvents; }, [localEvents]);
  useEffect(() => { dirtyRef.current = isDirty; }, [isDirty]);
  useEffect(() => { timelineIdRef.current = timeline?.id ?? null; }, [timeline?.id]);

  // Debounced autosave: save 700ms after edits stop
  useEffect(() => {
    if (!isDirty || !timeline?.id) return;
    const t = setTimeout(() => {
      saveTimeline.mutate(localEvents);
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, localEvents, timeline?.id]);

  // Save on unmount (navigating to another tab) and on full page unload
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
    return () => {
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, []);

  function updateLocal(events: TimelineEvent[]) {
    setLocalEvents(events);
    setIsDirty(true);
  }

  function startEdit(index: number) {
    setEditingIndex(index);
    setEditDraft({ ...localEvents[index] });
  }

  function cancelEdit() {
    setEditingIndex(null);
  }

  function submitEdit() {
    if (editingIndex === null) return;
    const updated = localEvents.map((e, i) => (i === editingIndex ? { ...editDraft } : e));
    updateLocal(updated);
    setEditingIndex(null);
  }

  function deleteEvent(index: number) {
    updateLocal(localEvents.filter((_, i) => i !== index));
  }

  function startAdd() {
    setNewEvent({ time: "", title: "", description: "", category: "other" });
    setAddingEvent(true);
  }

  function submitAdd() {
    if (!newEvent.time.trim() || !newEvent.title.trim()) return;
    updateLocal([...localEvents, { ...newEvent }]);
    setAddingEvent(false);
  }

  const handleVisionChange = (val: string) => {
    setDayVision(val);
    localStorage.setItem(VISION_STORAGE_KEY, val);
  };

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
          setEditingIndex(null);
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
      const response = await fetch("/api/pdf/timeline", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: localEvents, coupleName, weddingDate: profile?.weddingDate, venue: profile?.venue }),
      });
      if (!response.ok) throw new Error("PDF generation failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "aido-timeline.pdf";
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: t("timeline.pdf_downloaded"), description: t("timeline.pdf_downloaded_desc") });
    } catch {
      toast({ variant: "destructive", title: t("timeline.pdf_failed_title"), description: t("timeline.pdf_failed_desc") });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (isLoadingTimeline || isLoadingProfile) {
    return (
      <div className="space-y-8 max-w-4xl mx-auto">
        <Skeleton className="h-12 w-64" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </div>
    );
  }

  const hasTimeline = localEvents.length > 0;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-serif text-primary flex items-center gap-3">
            <CalendarClock className="h-8 w-8" />
            {t("timeline.title")}
          </h1>
          <p className="text-lg text-muted-foreground mt-2">{t("timeline.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {isDirty && (
            <Button
              variant="default"
              size="lg"
              onClick={() => saveTimeline.mutate(localEvents)}
              disabled={saveTimeline.isPending}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {saveTimeline.isPending ? (
                <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {t("timeline.save_btn")}
            </Button>
          )}
          {hasTimeline && (
            <Button variant="outline" size="lg" onClick={handleDownloadPdf} disabled={isDownloadingPdf} data-testid="btn-download-timeline-pdf" className="gap-2">
              {isDownloadingPdf ? <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <FileDown className="h-4 w-4" />}
              {isDownloadingPdf ? t("timeline.exporting_pdf") : t("timeline.download_pdf")}
            </Button>
          )}
          <Button
            onClick={handleGenerate}
            disabled={generateTimeline.isPending}
            variant={hasTimeline ? "outline" : "default"}
            size="lg"
            data-testid="btn-generate-timeline"
          >
            {generateTimeline.isPending ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                {t("timeline.crafting_magic")}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Wand2 className="h-4 w-4" />
                {hasTimeline ? t("timeline.regenerate_timeline") : t("timeline.generate_with_ai")}
              </span>
            )}
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-md bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-serif text-primary flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            {t("timeline.vision_card_title")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("timeline.vision_card_desc")}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder={t("timeline.vision_placeholder")}
            value={dayVision}
            onChange={e => handleVisionChange(e.target.value)}
            className="min-h-[120px] resize-none text-sm leading-relaxed"
            data-testid="input-day-vision"
          />
          <p className="text-[11px] text-muted-foreground text-right">
            {dayVision.length > 0 ? t("timeline.vision_chars", { n: dayVision.length }) : t("timeline.vision_autosave")}
          </p>
        </CardContent>
      </Card>

      {!hasTimeline ? (
        <Card className="border-none shadow-md bg-card text-center py-16 px-6">
          <div className="max-w-md mx-auto space-y-6">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Clock className="h-10 w-10 text-primary" />
            </div>
            <h3 className="font-serif text-2xl text-primary">{t("timeline.no_timeline_yet")}</h3>
            <p className="text-muted-foreground">
              {t("timeline.no_timeline_generate_desc")}
            </p>
            <Button onClick={handleGenerate} disabled={generateTimeline.isPending} size="lg" className="px-8 shadow-md">
              {t("timeline.generate_now")}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="relative mt-12 pb-12">
          <div className="absolute left-[27px] md:left-1/2 top-4 bottom-0 w-0.5 bg-primary/20 transform md:-translate-x-1/2" />

          <div className="space-y-8">
            {localEvents.map((event, index) => {
              const isEven = index % 2 === 0;
              const catColor = categoryColor(event.category);

              if (editingIndex === index) {
                return (
                  <div key={index} className="relative flex flex-col md:flex-row items-start md:items-center gap-6">
                    <div className="absolute left-[28px] md:left-1/2 w-4 h-4 rounded-full bg-primary border-2 border-background transform -translate-x-1/2 mt-6 md:mt-0 z-10" />
                    <div className={`w-full md:w-1/2 ${isEven ? 'md:pr-12' : 'md:order-last md:pl-12'} pl-16 md:pl-0`} />
                    <div className={`w-full md:w-1/2 ${isEven ? 'md:order-last md:pl-12' : 'md:pr-12'} pl-16 md:pl-0`}>
                      <Card className="border-primary/30 shadow-md">
                        <CardContent className="p-5 space-y-3">
                          <div className="flex gap-2">
                            <Input
                              value={editDraft.time}
                              onChange={e => setEditDraft(d => ({ ...d, time: e.target.value }))}
                              placeholder={t("timeline.time_placeholder")}
                              className="w-36 font-serif text-primary"
                            />
                            <Select value={editDraft.category} onValueChange={v => setEditDraft(d => ({ ...d, category: v }))}>
                              <SelectTrigger className="flex-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <Input
                            value={editDraft.title}
                            onChange={e => setEditDraft(d => ({ ...d, title: e.target.value }))}
                            placeholder={t("timeline.event_title_placeholder")}
                            className="font-medium"
                          />
                          <Textarea
                            value={editDraft.description}
                            onChange={e => setEditDraft(d => ({ ...d, description: e.target.value }))}
                            placeholder={t("timeline.description_placeholder")}
                            className="text-sm resize-none min-h-[72px]"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={submitEdit} disabled={!editDraft.time.trim() || !editDraft.title.trim()}>
                              <Check className="h-3.5 w-3.5 mr-1.5" /> {t("timeline.save_btn")}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelEdit}>
                              <X className="h-3.5 w-3.5 mr-1.5" /> {t("timeline.cancel_btn")}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                );
              }

              return (
                <div key={index} className="relative flex flex-col md:flex-row items-start md:items-center gap-6 group animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${index * 80}ms` }}>
                  <div className="absolute left-[28px] md:left-1/2 w-4 h-4 rounded-full bg-background border-2 border-primary transform -translate-x-1/2 mt-6 md:mt-0 z-10 group-hover:scale-125 group-hover:bg-primary transition-transform duration-300" />

                  <div className={`w-full md:w-1/2 ${isEven ? 'md:text-right md:pr-12' : 'md:order-last md:pl-12'} pl-16 md:pl-0`}>
                    <div className={`hidden md:block text-2xl font-serif text-primary font-medium tracking-tight ${!isEven && 'md:text-left'}`}>
                      {event.time}
                    </div>
                  </div>

                  <div className={`w-full md:w-1/2 ${isEven ? 'md:order-last md:pl-12' : 'md:text-right md:pr-12'} pl-16 md:pl-0`}>
                    <Card className="hover-elevate transition-all border-none shadow-sm group-hover:shadow-md">
                      <CardContent className="p-5 space-y-2">
                        <div className="flex items-center justify-between gap-4 mb-2 md:hidden">
                          <span className="text-xl font-serif text-primary font-medium">{event.time}</span>
                          <span className={`text-xs px-2 py-1 rounded-full border ${catColor}`}>{event.category}</span>
                        </div>
                        <div className="hidden md:flex justify-between items-start mb-1">
                          <span className={`text-xs px-2 py-1 rounded-full border ${catColor} ${isEven ? '' : 'ml-auto'}`}>{event.category}</span>
                        </div>
                        <h4 className="text-lg font-medium text-foreground">{event.title}</h4>
                        <p className="text-muted-foreground text-sm leading-relaxed">{event.description}</p>
                        <div className="flex gap-1 pt-2 opacity-100 md:opacity-60 md:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEdit(index)}
                            className="p-1.5 rounded border border-border/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 text-xs"
                            title={t("timeline.edit_event_title")}
                            aria-label={t("timeline.edit_event_title")}
                            data-testid={`btn-timeline-edit-${index}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">{t("timeline.edit_btn")}</span>
                          </button>
                          <button
                            onClick={() => deleteEvent(index)}
                            className="p-1.5 rounded border border-border/40 hover:bg-destructive/10 hover:border-destructive/40 text-destructive transition-colors flex items-center gap-1 text-xs"
                            title={t("timeline.delete_event_title")}
                            aria-label={t("timeline.delete_event_title")}
                            data-testid={`btn-timeline-delete-${index}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">{t("timeline.delete_btn")}</span>
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              );
            })}

            {addingEvent ? (
              <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6 pl-16 md:pl-0">
                <div className="absolute left-[28px] md:left-1/2 w-4 h-4 rounded-full bg-primary border-2 border-background transform -translate-x-1/2 z-10" />
                <div className="w-full md:w-1/2 md:order-last md:pl-12">
                  <Card className="border-primary/30 shadow-md">
                    <CardContent className="p-5 space-y-3">
                      <p className="text-sm font-medium text-primary">{t("timeline.new_event_label")}</p>
                      <div className="flex gap-2">
                        <Input
                          value={newEvent.time}
                          onChange={e => setNewEvent(d => ({ ...d, time: e.target.value }))}
                          placeholder={t("timeline.time_placeholder_new")}
                          className="w-36 font-serif text-primary"
                          autoFocus
                        />
                        <Select value={newEvent.category} onValueChange={v => setNewEvent(d => ({ ...d, category: v }))}>
                          <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <Input
                        value={newEvent.title}
                        onChange={e => setNewEvent(d => ({ ...d, title: e.target.value }))}
                        placeholder={t("timeline.event_title_placeholder")}
                        className="font-medium"
                      />
                      <Textarea
                        value={newEvent.description}
                        onChange={e => setNewEvent(d => ({ ...d, description: e.target.value }))}
                        placeholder={t("timeline.description_optional")}
                        className="text-sm resize-none min-h-[60px]"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={submitAdd} disabled={!newEvent.time.trim() || !newEvent.title.trim()}>
                          <Plus className="h-3.5 w-3.5 mr-1.5" /> {t("timeline.add_event_btn")}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setAddingEvent(false)}>{t("timeline.cancel_btn")}</Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <div className="flex justify-center pt-4">
                <Button variant="outline" onClick={startAdd} className="gap-2">
                  <Plus className="h-4 w-4" /> {t("timeline.add_event_btn")}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
