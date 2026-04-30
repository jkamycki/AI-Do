import { Component, useState, useEffect, useRef } from "react";
import { useGetTimeline, useGenerateTimeline, useEmergencyAdvice, useGetProfile, getGetTimelineQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Clock, CheckCircle2, Siren, Pencil, Save, X, RotateCcw, Info, RefreshCw, Trash2, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface TimelineEvent {
  time: string;
  title: string;
  description: string;
  category: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  notes?: string;
  id?: string;
}

function toDisplayTime(raw: any): string {
  if (raw?.time) return String(raw.time);
  if (raw?.startTime) {
    try {
      const [hStr, mStr] = String(raw.startTime).split(":");
      const h = parseInt(hStr, 10);
      if (isNaN(h)) return "";
      const ampm = h >= 12 ? "PM" : "AM";
      const displayH = h % 12 || 12;
      return `${displayH}:${mStr ?? "00"} ${ampm}`;
    } catch {
      return "";
    }
  }
  return "";
}

function normalizeEvent(raw: any): TimelineEvent {
  return {
    time: toDisplayTime(raw),
    title: raw?.title ?? "",
    description: raw?.description ?? "",
    category: raw?.category ?? "other",
    startTime: raw?.startTime,
    endTime: raw?.endTime,
    location: raw?.location,
    notes: raw?.notes,
    id: raw?.id,
  };
}

class DayOfErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
          <AlertCircle className="h-12 w-12 text-destructive/60" />
          <h2 className="font-serif text-xl text-foreground">Something went wrong loading Day-Of</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            There was an error rendering your timeline. Please refresh the page to try again.
          </p>
          <Button variant="outline" onClick={() => window.location.reload()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh Page
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

async function patchTimeline(id: number, events: TimelineEvent[]) {
  const res = await fetch(`/api/timeline/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ events }),
  });
  if (!res.ok) throw new Error("Failed to save timeline");
  return res.json();
}

function DayOfInner() {
  const { t } = useTranslation();
  const { data: timeline, isLoading: isLoadingTimeline } = useGetTimeline();
  const { data: profile } = useGetProfile();
  const { activeWorkspace } = useWorkspace();
  const getAdvice = useEmergencyAdvice();
  const generateTimeline = useGenerateTimeline();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [emergencyText, setEmergencyText] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRegenerateOpen, setIsRegenerateOpen] = useState(false);
  const [dayVision, setDayVision] = useState("");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [completedSet, setCompletedSet] = useState<Set<number>>(new Set());

  const [editableEvents, setEditableEvents] = useState<TimelineEvent[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<TimelineEvent | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (timeline?.events) {
      setEditableEvents((timeline.events as any[]).map(normalizeEvent));
    }
  }, [timeline]);

  useEffect(() => {
    if (editingIndex !== null) {
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [editingIndex]);

  const handleEmergencySubmit = () => {
    if (!emergencyText.trim()) return;
    getAdvice.mutate({ data: { situation: emergencyText } });
  };

  const resetEmergency = () => {
    setEmergencyText("");
    getAdvice.reset();
  };

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setEditDraft({ ...editableEvents[index] });
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditDraft(null);
  };

  const saveEdit = async () => {
    if (!editDraft || editingIndex === null || !timeline?.id) return;
    const updated = editableEvents.map((ev, i) => (i === editingIndex ? editDraft : ev));
    setIsSaving(true);
    try {
      await patchTimeline(timeline.id, updated);
      setEditableEvents(updated);
      setHasUnsavedChanges(false);
      qc.invalidateQueries({ queryKey: ["/api/timeline"] });
      toast({ title: t("dayof.event_updated") });
    } catch {
      toast({ title: t("dayof.save_failed"), variant: "destructive" });
    } finally {
      setIsSaving(false);
      setEditingIndex(null);
      setEditDraft(null);
    }
  };

  const resetAll = async () => {
    if (!timeline?.id) return;
    if (!confirm(t("dayof.reset_confirm"))) return;
    const original = timeline.events as TimelineEvent[];
    setIsSaving(true);
    try {
      await patchTimeline(timeline.id, original);
      setEditableEvents(original);
      setHasUnsavedChanges(false);
      qc.invalidateQueries({ queryKey: ["/api/timeline"] });
      toast({ title: t("dayof.timeline_reset") });
    } catch {
      toast({ title: t("dayof.reset_failed"), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerate = () => {
    if (!profile?.id) return;
    generateTimeline.mutate(
      { data: { profileId: profile.id, dayVision: dayVision.trim() || undefined } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetTimelineQueryKey() });
          setIsRegenerateOpen(false);
          setDayVision("");
          toast({ title: "Timeline regenerated" });
        },
        onError: () => {
          toast({ title: "Failed to regenerate timeline", variant: "destructive" });
        },
      }
    );
  };

  const toggleDone = (index: number) => {
    setCompletedSet((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const deleteEvent = async (index: number) => {
    if (!timeline?.id) return;
    const updated = editableEvents.filter((_, i) => i !== index);
    setCompletedSet((prev) => {
      const next = new Set<number>();
      prev.forEach(ci => { if (ci < index) next.add(ci); else if (ci > index) next.add(ci - 1); });
      return next;
    });
    if (activeIndex === index) setActiveIndex(null);
    else if (activeIndex !== null && activeIndex > index) setActiveIndex(activeIndex - 1);
    setEditableEvents(updated);
    try {
      await patchTimeline(timeline.id, updated);
      qc.invalidateQueries({ queryKey: ["/api/timeline"] });
      toast({ title: "Event removed" });
    } catch {
      toast({ title: "Failed to remove event", variant: "destructive" });
    }
  };

  if (isLoadingTimeline) {
    return (
      <div className="space-y-4 max-w-md mx-auto p-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const today = profile?.weddingDate ? new Date(profile.weddingDate + "T00:00:00") : new Date();
  const dateStr = format(today, "EEEE, MMMM do");
  const isEditing = (i: number) => editingIndex === i;

  return (
    <div className="max-w-md mx-auto pb-24 animate-in fade-in">
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b px-4 py-4 mb-6 text-center shadow-sm">
        <h1 className="font-serif text-2xl text-primary font-bold">{t("dayof.title")}</h1>
        <p className="text-sm text-muted-foreground font-medium">{dateStr}</p>
        {activeWorkspace && activeWorkspace.role !== "owner" && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeWorkspace.partner1Name} &amp; {activeWorkspace.partner2Name}'s wedding
          </p>
        )}
        {hasUnsavedChanges && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">{t("dayof.unsaved_changes")}</p>
        )}
      </div>

      <div className="px-4 pt-1 pb-2">
        <div className="flex items-start gap-2.5 rounded-lg border border-blue-500/25 bg-blue-500/8 px-3 py-2.5 text-xs text-blue-800 dark:text-blue-300">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <p>
            Day-Of tools are planning aids only — not professional event coordination services. Verify all timelines with your vendors.{" "}
            <a href="/terms" className="underline underline-offset-2 font-medium hover:opacity-80 transition-opacity">Terms apply.</a>
          </p>
        </div>
      </div>

      <div className="px-4 space-y-6">
        {editableEvents.length === 0 ? (
          <Card className="border-none shadow-sm text-center py-12">
            <CardContent className="space-y-4">
              <Clock className="h-12 w-12 text-primary/40 mx-auto" />
              <p className="text-muted-foreground">{t("dayof.no_timeline")}</p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button
                  className="gap-2"
                  onClick={() => setIsRegenerateOpen(true)}
                  disabled={generateTimeline.isPending}
                >
                  <Sparkles className="h-4 w-4" />
                  Generate with AI
                </Button>
                <Button variant="outline" onClick={() => window.location.href = '/timeline'}>{t("dayof.go_to_timeline")}</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-7 border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => setIsRegenerateOpen(true)}
                disabled={generateTimeline.isPending}
              >
                <Sparkles className="h-3 w-3" />
                Regenerate with AI
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground gap-1.5 text-xs h-7"
                onClick={resetAll}
                disabled={isSaving}
              >
                <RotateCcw className="h-3 w-3" />
                {t("dayof.reset_original")}
              </Button>
            </div>

            <div className="space-y-4">
              {editableEvents.map((event, i) => {
                const isActive = activeIndex === i;
                const isDone = completedSet.has(i);
                const editing = isEditing(i);

                return (
                  <Card
                    key={i}
                    className={`border-none shadow-sm overflow-hidden transition-all duration-300
                      ${isDone ? 'opacity-50' : ''}
                      ${isActive && !editing ? 'ring-2 ring-primary bg-primary/5 scale-[1.02]' : ''}
                      ${editing ? 'ring-2 ring-primary/60 bg-primary/5' : 'hover:bg-muted/30'}
                    `}
                  >
                    <CardContent className="p-0 flex">
                      {/* Time column */}
                      <div
                        className={`w-24 p-4 flex flex-col justify-center items-center text-center border-r flex-shrink-0 cursor-pointer select-none
                          ${isActive || editing ? 'bg-primary/10 text-primary font-bold' : 'bg-muted/30 text-muted-foreground font-medium'}
                        `}
                        onClick={() => {
                          if (editing) return;
                          setActiveIndex(isActive ? null : i);
                        }}
                      >
                        {editing ? (
                          <Input
                            value={editDraft?.time ?? ""}
                            onChange={(e) => setEditDraft(d => d ? { ...d, time: e.target.value } : d)}
                            className="text-center text-sm font-serif h-8 p-1 border-primary/40 bg-background/80 w-full"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <>
                            <span className="text-xl font-serif">{event.time.replace(/ AM| PM/i, '')}</span>
                            <span className="text-[10px] uppercase tracking-widest mt-1">{event.time.toUpperCase().includes('AM') ? 'AM' : 'PM'}</span>
                          </>
                        )}
                      </div>

                      {/* Content column */}
                      <div className="p-4 flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          {editing ? (
                            <Input
                              ref={titleRef}
                              value={editDraft?.title ?? ""}
                              onChange={(e) => setEditDraft(d => d ? { ...d, title: e.target.value } : d)}
                              className="font-serif text-base h-8 border-primary/40 flex-1"
                              placeholder={t("dayof.event_title_placeholder")}
                            />
                          ) : (
                            <h4
                              className={`font-serif text-lg leading-tight flex-1 cursor-pointer ${isActive ? 'text-primary' : isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                              onClick={() => setActiveIndex(isActive ? null : i)}
                            >
                              {event.title}
                            </h4>
                          )}

                          {!editing && (
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                              <button
                                className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                title={t("dayof.edit_event_title")}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveIndex(i);
                                  startEditing(i);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                title="Delete event"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteEvent(i);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {editing ? (
                          <Textarea
                            value={editDraft?.description ?? ""}
                            onChange={(e) => setEditDraft(d => d ? { ...d, description: e.target.value } : d)}
                            className="mt-2 text-sm resize-none border-primary/40 bg-background/80 min-h-[80px]"
                            placeholder={t("dayof.description_placeholder")}
                            rows={3}
                          />
                        ) : (
                          <p
                            className={`text-sm mt-2 cursor-pointer ${isActive ? 'text-foreground' : 'text-muted-foreground line-clamp-2'}`}
                            onClick={() => setActiveIndex(isActive ? null : i)}
                          >
                            {event.description}
                          </p>
                        )}

                        {/* Action row */}
                        <div className="mt-3 pt-3 border-t flex justify-end gap-2 animate-in fade-in">
                          {editing ? (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-muted-foreground hover:text-foreground gap-1.5 h-8"
                                onClick={cancelEditing}
                                disabled={isSaving}
                              >
                                <X className="h-3.5 w-3.5" />
                                {t("dayof.cancel_btn")}
                              </Button>
                              <Button
                                size="sm"
                                className="gap-1.5 h-8 bg-primary hover:bg-primary/90"
                                onClick={saveEdit}
                                disabled={isSaving}
                              >
                                <Save className="h-3.5 w-3.5" />
                                {isSaving ? t("dayof.saving") : t("dayof.save_btn")}
                              </Button>
                            </>
                          ) : isActive ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className={`gap-2 h-8 ${isDone ? 'text-muted-foreground' : 'text-primary hover:text-primary'}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleDone(i);
                              }}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              {isDone ? t("dayof.mark_undone") : t("dayof.mark_done")}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Regenerate Timeline Dialog */}
      <Dialog open={isRegenerateOpen} onOpenChange={(open) => { setIsRegenerateOpen(open); if (!open) { setDayVision(""); generateTimeline.reset(); } }}>
        <DialogContent className="sm:max-w-md w-[95vw] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Regenerate Timeline
            </DialogTitle>
            <DialogDescription>
              AI will create a fresh wedding day timeline based on your profile. Optionally describe any vision for the day.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Textarea
              placeholder="Any special notes? (e.g. outdoor ceremony, first look before ceremony, extra time for photos…)"
              value={dayVision}
              onChange={(e) => setDayVision(e.target.value)}
              className="min-h-[100px] resize-none bg-muted/50"
              disabled={generateTimeline.isPending}
            />
            <Button
              onClick={handleRegenerate}
              disabled={generateTimeline.isPending}
              className="w-full gap-2"
            >
              {generateTimeline.isPending ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Generate New Timeline</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Floating Emergency Button */}
      <div className="fixed bottom-6 left-0 right-0 px-4 z-30 pointer-events-none flex justify-center">
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setTimeout(resetEmergency, 300);
        }}>
          <DialogTrigger asChild>
            <Button
              size="lg"
              className="pointer-events-auto w-full max-w-sm rounded-full h-16 shadow-xl bg-destructive hover:bg-destructive/90 text-white font-bold text-lg gap-3 animate-bounce shadow-destructive/20 border-2 border-white/20"
              data-testid="btn-emergency-trigger"
            >
              <Siren className="h-6 w-6" />
              {t("dayof.emergency_btn")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md w-[95vw] rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-destructive font-serif text-2xl flex items-center gap-2">
                <AlertCircle className="h-6 w-6" /> {t("dayof.stay_calm")}
              </DialogTitle>
              <DialogDescription className="text-base">
                {t("dayof.whats_wrong")}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {!getAdvice.data ? (
                <>
                  <Textarea
                    placeholder={t("dayof.emergency_placeholder")}
                    value={emergencyText}
                    onChange={(e) => setEmergencyText(e.target.value)}
                    className="min-h-[120px] text-lg p-4 resize-none bg-muted/50 border-destructive/20 focus-visible:ring-destructive"
                    data-testid="textarea-emergency"
                  />
                  <Button
                    onClick={handleEmergencySubmit}
                    disabled={!emergencyText.trim() || getAdvice.isPending}
                    className="w-full h-14 text-lg bg-destructive hover:bg-destructive/90"
                    data-testid="btn-emergency-submit"
                  >
                    {getAdvice.isPending ? t("dayof.analyzing") : t("dayof.get_advice")}
                  </Button>
                </>
              ) : (
                <div className="space-y-6 animate-in zoom-in-95 duration-300">
                  <div className="bg-secondary/20 p-4 rounded-xl border border-secondary/30">
                    <h4 className="font-serif text-lg font-medium text-foreground mb-2">{t("dayof.instant_advice")}</h4>
                    <p className="text-foreground leading-relaxed">{getAdvice.data.advice}</p>
                  </div>

                  <div>
                    <h4 className="font-serif text-lg font-medium text-destructive mb-3">{t("dayof.action_steps")}</h4>
                    <ul className="space-y-3">
                      {getAdvice.data.steps.map((step, idx) => (
                        <li key={idx} className="flex gap-3 bg-muted p-3 rounded-lg">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-destructive text-white flex items-center justify-center text-sm font-bold">
                            {idx + 1}
                          </span>
                          <span className="text-sm font-medium">{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Button variant="outline" className="w-full h-12" onClick={resetEmergency}>
                    {t("dayof.ask_another")}
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export default function DayOf() {
  return (
    <DayOfErrorBoundary>
      <DayOfInner />
    </DayOfErrorBoundary>
  );
}
