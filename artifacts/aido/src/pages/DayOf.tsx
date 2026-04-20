import { useState, useEffect, useRef } from "react";
import { useGetTimeline, useEmergencyAdvice, useGetProfile } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Clock, CheckCircle2, Siren, Pencil, Save, X, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/hooks/use-toast";

interface TimelineEvent {
  time: string;
  title: string;
  description: string;
  category: string;
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

export default function DayOf() {
  const { data: timeline, isLoading: isLoadingTimeline } = useGetTimeline();
  const { data: profile } = useGetProfile();
  const { activeWorkspace } = useWorkspace();
  const getAdvice = useEmergencyAdvice();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [emergencyText, setEmergencyText] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
      setEditableEvents(timeline.events as TimelineEvent[]);
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
      toast({ title: "Event updated" });
    } catch {
      toast({ title: "Couldn't save changes", variant: "destructive" });
    } finally {
      setIsSaving(false);
      setEditingIndex(null);
      setEditDraft(null);
    }
  };

  const resetAll = async () => {
    if (!timeline?.id) return;
    if (!confirm("Reset all edits to the original AI-generated timeline?")) return;
    const original = timeline.events as TimelineEvent[];
    setIsSaving(true);
    try {
      await patchTimeline(timeline.id, original);
      setEditableEvents(original);
      setHasUnsavedChanges(false);
      qc.invalidateQueries({ queryKey: ["/api/timeline"] });
      toast({ title: "Timeline reset" });
    } catch {
      toast({ title: "Couldn't reset timeline", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDone = (index: number) => {
    setCompletedSet((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
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

  const today = profile?.weddingDate ? new Date(profile.weddingDate) : new Date();
  const dateStr = format(today, "EEEE, MMMM do");
  const isEditing = (i: number) => editingIndex === i;

  return (
    <div className="max-w-md mx-auto pb-24 animate-in fade-in">
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b px-4 py-4 mb-6 text-center shadow-sm">
        <h1 className="font-serif text-2xl text-primary font-bold">The Big Day</h1>
        <p className="text-sm text-muted-foreground font-medium">{dateStr}</p>
        {activeWorkspace && activeWorkspace.role !== "owner" && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeWorkspace.partner1Name} &amp; {activeWorkspace.partner2Name}'s wedding
          </p>
        )}
        {hasUnsavedChanges && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">Unsaved changes</p>
        )}
      </div>

      <div className="px-4 space-y-6">
        {editableEvents.length === 0 ? (
          <Card className="border-none shadow-sm text-center py-12">
            <CardContent className="space-y-4">
              <Clock className="h-12 w-12 text-primary/40 mx-auto" />
              <p className="text-muted-foreground">No timeline generated yet.</p>
              <Button variant="outline" onClick={() => window.location.href = '/timeline'}>Go to Timeline</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground gap-1.5 text-xs h-7"
                onClick={resetAll}
                disabled={isSaving}
              >
                <RotateCcw className="h-3 w-3" />
                Reset to original
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
                              placeholder="Event title"
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
                            <button
                              className="flex-shrink-0 p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                              title="Edit this event"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveIndex(i);
                                startEditing(i);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {editing ? (
                          <Textarea
                            value={editDraft?.description ?? ""}
                            onChange={(e) => setEditDraft(d => d ? { ...d, description: e.target.value } : d)}
                            className="mt-2 text-sm resize-none border-primary/40 bg-background/80 min-h-[80px]"
                            placeholder="Describe what happens..."
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
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                className="gap-1.5 h-8 bg-primary hover:bg-primary/90"
                                onClick={saveEdit}
                                disabled={isSaving}
                              >
                                <Save className="h-3.5 w-3.5" />
                                {isSaving ? "Saving…" : "Save"}
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
                              {isDone ? "Mark Undone" : "Mark Done"}
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
              EMERGENCY HELP
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md w-[95vw] rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-destructive font-serif text-2xl flex items-center gap-2">
                <AlertCircle className="h-6 w-6" /> Stay Calm
              </DialogTitle>
              <DialogDescription className="text-base">
                What's going wrong right now? Be specific.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {!getAdvice.data ? (
                <>
                  <Textarea
                    placeholder="e.g. The florist forgot the bridal bouquet, ceremony is in 45 mins!"
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
                    {getAdvice.isPending ? "Analyzing crisis..." : "Get Immediate Advice"}
                  </Button>
                </>
              ) : (
                <div className="space-y-6 animate-in zoom-in-95 duration-300">
                  <div className="bg-secondary/20 p-4 rounded-xl border border-secondary/30">
                    <h4 className="font-serif text-lg font-medium text-foreground mb-2">Instant Advice:</h4>
                    <p className="text-foreground leading-relaxed">{getAdvice.data.advice}</p>
                  </div>

                  <div>
                    <h4 className="font-serif text-lg font-medium text-destructive mb-3">Action Steps:</h4>
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
                    Ask another question
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
