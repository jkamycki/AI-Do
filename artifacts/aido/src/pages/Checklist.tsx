import { useEffect, useMemo, useState } from "react";
import {
  useGetChecklist,
  useToggleChecklistItem,
  useGetProfile,
  getGetChecklistQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/authFetch";
import { getCurrentLanguageCode, getCurrentLanguageName } from "@/lib/languagePreference";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarDays, CheckSquare, Wand2, ClipboardList, Pencil, Trash2, Plus, Check, X, RotateCcw, StickyNote, Download, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Progress } from "@/components/ui/progress";

const API = import.meta.env.VITE_API_URL ?? "";
const CHECKLIST_TRANSLATION_CACHE_PREFIX = "aido_checklist_translation_v1";

type ChecklistItem = {
  id: number;
  month: string;
  task: string;
  description: string;
  dueDate?: string | null;
  isCompleted: boolean;
  completedAt?: string;
  resolveNote?: string;
};

function formatChecklistDueDate(value?: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (!Number.isFinite(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function parseChecklistDueDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function checklistDeadlineMonth(value?: string | null): string | null {
  const parsed = parseChecklistDueDate(value);
  if (!parsed) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(parsed);
}

function checklistDeadlineMonthKey(value?: string | null): string {
  const parsed = parseChecklistDueDate(value);
  return parsed ? parsed.toISOString().slice(0, 7) : "no-deadline";
}

function checklistDeadlineDelta(value?: string | null): number | null {
  const parsed = parseChecklistDueDate(value);
  if (!parsed) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);
  return Math.round((parsed.getTime() - today.getTime()) / 86400000);
}

function checklistDeadlineStatus(value?: string | null): string {
  const delta = checklistDeadlineDelta(value);
  if (delta === null) return "No deadline set";
  if (delta < 0) return `${Math.abs(delta)} day${Math.abs(delta) === 1 ? "" : "s"} overdue`;
  if (delta === 0) return "Due today";
  if (delta === 1) return "Due tomorrow";
  return `Due in ${delta} days`;
}

function checklistTranslationSignature(items: ChecklistItem[]): string {
  const raw = JSON.stringify(items.map((item) => ({
    id: item.id,
    month: item.month,
    task: item.task,
    description: item.description,
  })));
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = (hash * 31 + raw.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function checklistTranslationCacheKey({
  languageCode,
  signature,
}: {
  languageCode: string;
  signature: string;
}) {
  return `${CHECKLIST_TRANSLATION_CACHE_PREFIX}:${languageCode}:${signature}`;
}

function normalizeChecklistDisplayItem(source: ChecklistItem, translated?: Partial<ChecklistItem>): ChecklistItem {
  return {
    ...source,
    month: typeof translated?.month === "string" && translated.month.trim() ? translated.month : source.month,
    task: typeof translated?.task === "string" && translated.task.trim() ? translated.task : source.task,
    description: typeof translated?.description === "string" ? translated.description : source.description,
  };
}

export default function Checklist() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: checklist, isLoading: isLoadingChecklist } = useGetChecklist();
  const { data: profile, isLoading: isLoadingProfile } = useGetProfile();
  const toggleItem = useToggleChecklistItem();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTask, setEditTask] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editMonth, setEditMonth] = useState("");
  const [editDueDate, setEditDueDate] = useState("");

  const [addingToMonth, setAddingToMonth] = useState<string | null>(null);
  const [newTask, setNewTask] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDueDate, setNewDueDate] = useState("");

  const [noteEditingId, setNoteEditingId] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [planningFocus, setPlanningFocus] = useState("");
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [translatedItems, setTranslatedItems] = useState<ChecklistItem[] | null>(null);
  const [isTranslatingChecklist, setIsTranslatingChecklist] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetChecklistQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const updateItem = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ChecklistItem> }) => {
      const r = await authFetch(`${API}/api/checklist/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as any)?.error ?? r.statusText); }
    },
    onSuccess: () => { invalidate(); toast({ title: t("checklist.task_updated") }); },
    onError: () => toast({ title: t("checklist.could_not_update"), variant: "destructive" }),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: number) => {
      const r = await authFetch(`${API}/api/checklist/items/${id}`, { method: "DELETE" });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as any)?.error ?? r.statusText); }
    },
    onSuccess: () => { invalidate(); toast({ title: t("checklist.task_removed") }); },
    onError: () => toast({ title: t("checklist.could_not_delete"), variant: "destructive" }),
  });

  const addItem = useMutation({
    mutationFn: async (data: { task: string; description: string; month: string; dueDate?: string | null }) => {
      const r = await authFetch(`${API}/api/checklist/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as any)?.error ?? r.statusText); }
    },
    onSuccess: () => {
      invalidate();
      toast({ title: t("checklist.task_added") });
      setAddingToMonth(null);
      setNewTask("");
      setNewDescription("");
      setNewDueDate("");
    },
    onError: () => toast({ title: t("checklist.could_not_add"), variant: "destructive" }),
  });

  const resetChecklist = useMutation({
    mutationFn: async () => {
      const r = await authFetch(`${API}/api/checklist/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as any)?.error ?? r.statusText); }
    },
    onSuccess: () => {
      invalidate();
      toast({ title: t("checklist.reset_success"), description: t("checklist.reset_success_desc") });
    },
    onError: () => toast({ title: t("checklist.reset_failed"), variant: "destructive" }),
  });

  const generateChecklistWithFocus = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error(t("checklist.profile_required_desc"));
      const r = await authFetch(`${API}/api/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weddingDate: profile.weddingDate,
          weddingVibe: profile.weddingVibe,
          guestCount: profile.guestCount,
          planningFocus: planningFocus.trim() || undefined,
        }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error((e as any)?.error ?? r.statusText);
      }
      return r.json();
    },
  });

  const handleGenerate = () => {
    if (!profile) {
      toast({ variant: "destructive", title: t("checklist.profile_required"), description: t("checklist.profile_required_desc") });
      return;
    }
    generateChecklistWithFocus.mutate(undefined, {
      onSuccess: () => {
        toast({ title: t("checklist.checklist_generated"), description: t("checklist.checklist_generated_desc") });
        setPlanningFocus("");
        invalidate();
      },
      onError: (err: unknown) => {
        toast({
          variant: "destructive",
          title: t("checklist.generation_failed"),
          description: err instanceof Error ? err.message : t("checklist.generation_failed_desc"),
        });
      },
    });
  };

  const handleToggle = (id: number, currentStatus: boolean) => {
    const becomingComplete = !currentStatus;
    toggleItem.mutate(
      { id, data: { isCompleted: becomingComplete } },
      {
        onSuccess: () => {
          invalidate();
          if (becomingComplete) {
            setNoteEditingId(id);
            setNoteDraft("");
          } else if (noteEditingId === id) {
            setNoteEditingId(null);
            setNoteDraft("");
          }
        },
      }
    );
  };

  function startNoteEdit(item: ChecklistItem) {
    setNoteEditingId(item.id);
    setNoteDraft(item.resolveNote ?? "");
  }

  function cancelNoteEdit() {
    setNoteEditingId(null);
    setNoteDraft("");
  }

  function submitNote() {
    if (noteEditingId == null) return;
    updateItem.mutate(
      { id: noteEditingId, data: { resolveNote: noteDraft.trim() } },
      { onSuccess: () => { setNoteEditingId(null); setNoteDraft(""); } }
    );
  }

  function clearNote(item: ChecklistItem) {
    updateItem.mutate({ id: item.id, data: { resolveNote: "" } });
  }

  function startEdit(item: ChecklistItem) {
    setEditingId(item.id);
    setEditTask(item.task);
    setEditDescription(item.description);
    setEditMonth(item.month);
    setEditDueDate(item.dueDate ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTask("");
    setEditDescription("");
    setEditMonth("");
    setEditDueDate("");
  }

  function submitEdit() {
    if (!editingId) return;
    updateItem.mutate({
      id: editingId,
      data: {
        task: editTask.trim(),
        description: editDescription.trim(),
        month: editMonth.trim(),
        dueDate: editDueDate || null,
      },
    });
    cancelEdit();
  }

  function startAdd(month: string) {
    setAddingToMonth(month);
    setNewTask("");
    setNewDescription("");
    setNewDueDate("");
  }

  function cancelAdd() {
    setAddingToMonth(null);
    setNewTask("");
    setNewDescription("");
    setNewDueDate("");
  }

  function submitAdd() {
    if (!addingToMonth || !newTask.trim()) return;
    addItem.mutate({
      task: newTask.trim(),
      description: newDescription.trim(),
      month: addingToMonth,
      dueDate: newDueDate || null,
    });
  }

  const handleDownloadPdf = async () => {
    if (!visibleItems.length) return;
    setIsDownloadingPdf(true);
    try {
      const coupleName = profile ? `${profile.partner2Name} & ${profile.partner1Name}` : undefined;
      const response = await authFetch(`${API}/api/pdf/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: visibleItems.map(item => ({
            month: item.month,
            task: item.task,
            description: item.description,
            dueDate: item.dueDate,
            isCompleted: item.isCompleted,
            resolveNote: item.resolveNote,
          })),
          coupleName,
          weddingDate: profile?.weddingDate,
          venue: profile?.venue,
          completedCount: completedItems,
          totalCount: totalItems,
        }),
      });
      if (!response.ok) throw new Error("PDF failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "aido-checklist.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: t("checklist.pdf_downloaded", { defaultValue: "Checklist PDF downloaded" }) });
    } catch {
      toast({ variant: "destructive", title: t("checklist.pdf_failed_title", { defaultValue: "Download failed" }) });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const sourceItems = useMemo(() => (checklist?.items ?? []) as ChecklistItem[], [checklist?.items]);
  const languageCode = (i18n.resolvedLanguage || i18n.language || getCurrentLanguageCode()).split("-")[0] || "en";
  const languageName = getCurrentLanguageName();
  const checklistSignature = useMemo(() => checklistTranslationSignature(sourceItems), [sourceItems]);

  useEffect(() => {
    let cancelled = false;
    if (!sourceItems.length || languageCode === "en") {
      setTranslatedItems(null);
      setIsTranslatingChecklist(false);
      return;
    }

    setTranslatedItems(null);

    const cacheKey = checklistTranslationCacheKey({ languageCode, signature: checklistSignature });
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length === sourceItems.length) {
          setTranslatedItems(sourceItems.map((item, index) => normalizeChecklistDisplayItem(item, parsed[index])));
          setIsTranslatingChecklist(false);
          return;
        }
      }
    } catch {
      // Translation cache is best-effort only.
    }

    setIsTranslatingChecklist(true);
    authFetch(`${API}/api/checklist/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: sourceItems.map(({ id, month, task, description }) => ({ id, month, task, description })),
        preferredLanguage: languageName,
      }),
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error((body as any)?.error ?? response.statusText);
        if (languageCode !== "en" && (body as any)?.language === "English") {
          throw new Error("Checklist translation returned English");
        }
        const items = Array.isArray((body as any).items) ? (body as any).items : null;
        if (!items || items.length !== sourceItems.length || cancelled) return;
        const next = sourceItems.map((item, index) => normalizeChecklistDisplayItem(item, items[index]));
        const changedText = next.some((item, index) => (
          item.month !== sourceItems[index].month ||
          item.task !== sourceItems[index].task ||
          item.description !== sourceItems[index].description
        ));
        if (languageCode !== "en" && !changedText) {
          setTranslatedItems(null);
          return;
        }
        setTranslatedItems(next);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(items));
        } catch {
          // Ignore storage limits.
        }
      })
      .catch(() => {
        if (!cancelled) setTranslatedItems(null);
      })
      .finally(() => {
        if (!cancelled) setIsTranslatingChecklist(false);
      });

    return () => {
      cancelled = true;
    };
  }, [checklistSignature, languageCode, languageName, sourceItems]);

  const visibleItems = translatedItems ?? sourceItems;

  if (isLoadingChecklist || isLoadingProfile) {
    return (
      <div className="space-y-8 max-w-4xl mx-auto">
        <Skeleton className="h-12 w-64" />
        <div className="space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-8 w-32" />
              <Card><CardContent className="p-6"><Skeleton className="h-12 w-full" /></CardContent></Card>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const hasChecklist = sourceItems.length > 0;
  const deadlineItems = visibleItems.filter((item) => parseChecklistDueDate(item.dueDate));
  const undatedItems = visibleItems.filter((item) => !parseChecklistDueDate(item.dueDate));
  const nextDeadlineItem = deadlineItems
    .filter((item) => !item.isCompleted)
    .sort((a, b) => checklistDeadlineMonthKey(a.dueDate).localeCompare(checklistDeadlineMonthKey(b.dueDate)) || String(a.dueDate).localeCompare(String(b.dueDate)))[0];
  const groupedItems = Array.from(
    visibleItems.reduce((acc, item) => {
      const key = checklistDeadlineMonthKey(item.dueDate);
      const label = checklistDeadlineMonth(item.dueDate) ?? t("checklist.no_deadline_month", { defaultValue: "No Deadline Yet" });
      const existing = acc.get(key);
      if (existing) {
        existing.items.push(item);
      } else {
        acc.set(key, { key, label, items: [item] });
      }
      return acc;
    }, new Map<string, { key: string; label: string; items: ChecklistItem[] }>()),
  ).map(([, group]) => group).sort((a, b) => {
    if (a.key === "no-deadline") return 1;
    if (b.key === "no-deadline") return -1;
    return a.key.localeCompare(b.key);
  });

  const totalItems = sourceItems.length;
  const completedItems = sourceItems.filter(i => i.isCompleted).length;
  const progress = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-serif text-primary flex items-center gap-3">
            <CheckSquare className="h-8 w-8" />
            {t("checklist.title")}
          </h1>
          <p className="text-lg text-muted-foreground mt-2">{t("checklist.subtitle")}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={handleGenerate}
            disabled={generateChecklistWithFocus.isPending}
            variant={hasChecklist ? "outline" : "default"}
            size="lg"
            data-testid="btn-generate-checklist"
          >
            {generateChecklistWithFocus.isPending ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                {t("checklist.generating")}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Wand2 className="h-4 w-4" />
                {hasChecklist ? t("checklist.regenerate") : t("checklist.generate_button")}
              </span>
            )}
          </Button>
          {hasChecklist && (
            <Button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              variant="outline"
              size="lg"
              data-testid="btn-download-checklist-pdf"
            >
              <span className="flex items-center gap-2">
                {isDownloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {isDownloadingPdf
                  ? t("checklist.exporting_pdf", { defaultValue: "Exporting..." })
                  : t("checklist.download_pdf", { defaultValue: "Download PDF" })}
              </span>
            </Button>
          )}
          {hasChecklist && (
            <Button
              onClick={() => {
                if (confirm(t("checklist.reset_confirm"))) {
                  resetChecklist.mutate();
                }
              }}
              disabled={resetChecklist.isPending}
              variant="outline"
              size="lg"
              data-testid="btn-reset-checklist"
            >
              {resetChecklist.isPending ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  {t("checklist.resetting")}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" />
                  {t("checklist.reset_button")}
                </span>
              )}
            </Button>
          )}
        </div>
      </div>

      <Card className="border-none shadow-sm bg-card">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary flex-shrink-0" />
            <p className="text-sm font-medium text-primary">
              {t("checklist.focus_title", { defaultValue: "Checklist Focus" })}
            </p>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("checklist.focus_desc", {
              defaultValue: "Optional: tell A.IDO what kind of tasks you need next. Leave it blank to generate a balanced wedding checklist.",
            })}
          </p>
          <div className="relative">
            <Textarea
              placeholder={t("checklist.focus_placeholder", {
                defaultValue: "Tell A.IDO what to focus on, like budget-friendly planning, destination wedding travel, DIY decor, guest list cleanup, vendor contracts, or final month tasks...",
              })}
              value={planningFocus}
              onChange={e => setPlanningFocus(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!generateChecklistWithFocus.isPending) handleGenerate();
                }
              }}
              className="min-h-[80px] resize-none text-sm pr-12 pb-10"
              data-testid="input-checklist-focus"
            />
            <Button
              type="button"
              size="icon"
              onClick={handleGenerate}
              disabled={generateChecklistWithFocus.isPending}
              className="absolute bottom-2 right-2 h-8 w-8 rounded-full shadow-sm"
              title={t("checklist.generate_button")}
              aria-label={t("checklist.generate_button")}
              data-testid="btn-submit-checklist-focus"
            >
              {generateChecklistWithFocus.isPending
                ? <div className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                : <Wand2 className="h-4 w-4" />}
            </Button>
          </div>
          {generateChecklistWithFocus.isPending && (
            <div className="rounded-md border border-primary/15 bg-primary/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              {t("checklist.generation_wait_note", {
                defaultValue: "This may take a moment. A.IDO is matching tasks to your date and keeping completed items intact.",
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {!hasChecklist ? (
        <Card className="border-none shadow-md bg-card text-center py-16 px-6">
          <div className="max-w-md mx-auto space-y-6">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <ClipboardList className="h-10 w-10 text-primary" />
            </div>
            <h3 className="font-serif text-2xl text-primary">{t("checklist.no_checklist_title")}</h3>
            <p className="text-muted-foreground">
              {t("checklist.no_checklist_desc")}
            </p>
            <Button onClick={handleGenerate} disabled={generateChecklistWithFocus.isPending} size="lg" className="px-8 shadow-md">
              {t("checklist.generate_button")}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-8">
          <Card className="border-none shadow-sm bg-primary/5">
            <CardContent className="p-6">
              <div className="flex justify-between text-sm font-medium text-primary mb-2">
                <span>{t("checklist.overall_progress")}</span>
                <span>{t("checklist.tasks_completed_count", { completed: completedItems, total: totalItems })}</span>
              </div>
              <Progress value={progress} className="h-3" />
              {isTranslatingChecklist && (
                <p className="mt-3 text-xs font-medium text-primary">
                  {t("checklist.translating_saved_tasks", { defaultValue: "Translating saved tasks..." })}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border border-primary/15 shadow-sm bg-card">
            <CardContent className="p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-serif text-2xl text-primary">
                      {t("checklist.deadline_schedule_title", { defaultValue: "Deadline schedule" })}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {t("checklist.deadline_schedule_desc", {
                        defaultValue: "Checklist items are grouped by deadline month. Email reminders use the reminder timing you set in Settings.",
                      })}
                    </p>
                    {nextDeadlineItem && (
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {t("checklist.next_deadline_label", { defaultValue: "Next deadline" })}: {nextDeadlineItem.task} · {checklistDeadlineStatus(nextDeadlineItem.dueDate)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center sm:min-w-[210px]">
                  <div className="rounded-2xl bg-primary/5 px-4 py-3">
                    <div className="text-2xl font-serif text-primary">{deadlineItems.length}</div>
                    <div className="text-xs font-medium text-muted-foreground">
                      {t("checklist.with_deadlines", { defaultValue: "With deadlines" })}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-muted/60 px-4 py-3">
                    <div className="text-2xl font-serif text-foreground">{undatedItems.length}</div>
                    <div className="text-xs font-medium text-muted-foreground">
                      {t("checklist.need_deadlines", { defaultValue: "Need dates" })}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-12">
            {groupedItems.map(({ key, label: month, items }, index) => {
              const monthCompleted = items.filter(i => i.isCompleted).length;
              const isAllCompleted = monthCompleted === items.length;

              return (
                <div key={key} className="space-y-4 animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${index * 100}ms` }}>
                  <div className="flex items-center gap-4">
                    <h3 className="text-2xl font-serif text-foreground">{month}</h3>
                    <div className="h-px bg-border flex-1" />
                    <span className={`text-sm font-medium px-3 py-1 rounded-full ${isAllCompleted ? 'bg-secondary/50 text-secondary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {monthCompleted}/{items.length}
                    </span>
                  </div>

                  <Card className="border-none shadow-sm overflow-hidden bg-card">
                    <div className="divide-y divide-border/50">
                      {items.map((item) => (
                        <div key={item.id}>
                          {editingId === item.id ? (
                            <div className="p-4 md:p-5 space-y-3 bg-muted/20">
                              <Input
                                value={editTask}
                                onChange={e => setEditTask(e.target.value)}
                                placeholder={t("checklist.task_name_placeholder")}
                                className="font-medium"
                                autoFocus
                              />
                              <Textarea
                                value={editDescription}
                                onChange={e => setEditDescription(e.target.value)}
                                placeholder={t("checklist.description_optional")}
                                className="text-sm resize-none min-h-[72px]"
                              />
                              <Input
                                value={editMonth}
                                onChange={e => setEditMonth(e.target.value)}
                                placeholder={t("checklist.time_period_placeholder")}
                                className="text-sm"
                              />
                              <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 space-y-2">
                                <div>
                                  <label className="text-sm font-semibold text-primary">
                                    {t("checklist.deadline_section_title", { defaultValue: "Deadline and email reminder" })}
                                  </label>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {t("checklist.deadline_reminder_hint", {
                                      defaultValue: "Enter the task deadline. Email reminders use the timing you set in Settings.",
                                    })}
                                  </p>
                                </div>
                                <Input
                                  type="date"
                                  value={editDueDate}
                                  onChange={e => setEditDueDate(e.target.value)}
                                  className="text-sm bg-background"
                                  data-testid={`input-checklist-due-date-${item.id}`}
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" onClick={submitEdit} disabled={!editTask.trim()}>
                                  <Check className="h-3.5 w-3.5 mr-1.5" /> {t("common.save")}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={cancelEdit}>
                                  <X className="h-3.5 w-3.5 mr-1.5" /> {t("common.cancel")}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className={`p-4 md:p-6 flex gap-4 transition-colors hover:bg-muted/30 group ${item.isCompleted ? 'bg-muted/10' : ''}`}>
                              <div className="flex-1 space-y-1 min-w-0">
                                <h4 className={`text-lg font-medium transition-all ${item.isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                  {item.task}
                                </h4>
                                <p className={`text-sm ${item.isCompleted ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>
                                  {item.description}
                                </p>
                                {item.dueDate && (
                                  <div className="pt-1 flex items-center gap-1.5 text-xs font-medium text-primary">
                                    <CalendarDays className="h-3.5 w-3.5" />
                                    <span>
                                      {t("checklist.deadline_display", {
                                        defaultValue: "Due {{date}}",
                                        date: formatChecklistDueDate(item.dueDate) ?? item.dueDate,
                                      })}
                                    </span>
                                  </div>
                                )}
                                {noteEditingId === item.id ? (
                                  <div className="pt-2 space-y-2">
                                    <Textarea
                                      value={noteDraft}
                                      onChange={e => setNoteDraft(e.target.value)}
                                      placeholder={t("checklist.note_placeholder")}
                                      className="text-sm resize-none min-h-[60px]"
                                      autoFocus
                                      data-testid={`input-checklist-note-${item.id}`}
                                      onKeyDown={e => {
                                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitNote();
                                        if (e.key === "Escape") cancelNoteEdit();
                                      }}
                                    />
                                    <div className="flex gap-2">
                                      <Button size="sm" onClick={submitNote} disabled={updateItem.isPending} data-testid={`btn-checklist-note-save-${item.id}`}>
                                        <Check className="h-3.5 w-3.5 mr-1.5" /> {t("checklist.save_note")}
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={cancelNoteEdit}>
                                        <X className="h-3.5 w-3.5 mr-1.5" /> {t("common.cancel")}
                                      </Button>
                                    </div>
                                  </div>
                                ) : item.resolveNote ? (
                                  <div className="pt-2 flex items-start gap-2 text-sm">
                                    <StickyNote className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                                    <span className="text-foreground/80 italic flex-1 whitespace-pre-wrap break-words" data-testid={`text-checklist-note-${item.id}`}>
                                      {item.resolveNote}
                                    </span>
                                    <button
                                      onClick={() => startNoteEdit(item)}
                                      className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline shrink-0"
                                      data-testid={`btn-checklist-note-edit-${item.id}`}
                                    >
                                      {t("checklist.edit_note")}
                                    </button>
                                    <button
                                      onClick={() => clearNote(item)}
                                      className="text-xs text-muted-foreground hover:text-destructive underline-offset-2 hover:underline shrink-0"
                                      data-testid={`btn-checklist-note-clear-${item.id}`}
                                    >
                                      {t("checklist.remove_note")}
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => startNoteEdit(item)}
                                    className="pt-2 text-xs text-muted-foreground hover:text-primary flex items-center gap-1.5"
                                    data-testid={`btn-checklist-note-add-${item.id}`}
                                  >
                                    <StickyNote className="h-3.5 w-3.5" />
                                    {t("checklist.add_note")}
                                  </button>
                                )}
                              </div>
                              <div className="flex items-start gap-2 opacity-100 md:opacity-60 md:group-hover:opacity-100 transition-opacity shrink-0 pt-1">
                                <button
                                  onClick={() => startEdit(item)}
                                  className="p-1.5 rounded border border-border/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                  title={t("checklist.edit_task")}
                                  aria-label={t("checklist.edit_task")}
                                  data-testid={`btn-checklist-edit-${item.id}`}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => deleteItem.mutate(item.id)}
                                  className="p-1.5 rounded border border-border/40 hover:bg-destructive/10 hover:border-destructive/40 text-destructive transition-colors"
                                  title={t("checklist.delete_task")}
                                  aria-label={t("checklist.delete_task")}
                                  data-testid={`btn-checklist-delete-${item.id}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                                <Checkbox
                                  checked={item.isCompleted}
                                  onCheckedChange={() => handleToggle(item.id, item.isCompleted)}
                                  aria-label={item.isCompleted ? t("checklist.mark_incomplete", { defaultValue: "Mark incomplete" }) : t("checklist.mark_complete", { defaultValue: "Mark complete" })}
                                  data-testid={`checkbox-item-${item.id}`}
                                  className="ml-1 h-6 w-6 rounded-full border-primary/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      {addingToMonth === month ? (
                        <div className="p-4 md:p-5 space-y-3 bg-primary/5 border-t border-primary/10">
                          <Input
                            value={newTask}
                            onChange={e => setNewTask(e.target.value)}
                            placeholder={t("checklist.new_task_placeholder")}
                            className="font-medium"
                            autoFocus
                            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) submitAdd(); if (e.key === "Escape") cancelAdd(); }}
                          />
                          <Textarea
                            value={newDescription}
                            onChange={e => setNewDescription(e.target.value)}
                            placeholder={t("checklist.description_optional")}
                            className="text-sm resize-none min-h-[60px]"
                          />
                          <div className="rounded-2xl border border-primary/15 bg-background/70 p-4 space-y-2">
                            <div>
                              <label className="text-sm font-semibold text-primary">
                                {t("checklist.deadline_section_title", { defaultValue: "Deadline and email reminder" })}
                              </label>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {t("checklist.deadline_reminder_hint", {
                                  defaultValue: "Enter the task deadline. Email reminders use the timing you set in Settings.",
                                })}
                              </p>
                            </div>
                            <Input
                              type="date"
                              value={newDueDate}
                              onChange={e => setNewDueDate(e.target.value)}
                              className="text-sm bg-background"
                              data-testid={`input-new-checklist-due-date-${month}`}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={submitAdd} disabled={!newTask.trim() || addItem.isPending}>
                              <Plus className="h-3.5 w-3.5 mr-1.5" /> {t("checklist.add_task_button")}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelAdd}>
                              {t("common.cancel")}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => startAdd(month)}
                          className="w-full p-3 text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 flex items-center justify-center gap-2 transition-colors"
                        >
                          <Plus className="h-4 w-4" /> {t("checklist.add_task_to", { month })}
                        </button>
                      )}
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
