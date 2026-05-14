import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@clerk/react";
import { useUpload } from "@workspace/object-storage-web";
import { authFetch } from "@/lib/authFetch";
import { AuthMediaImage } from "@/components/AuthMediaImage";
import { WEBSITE_THEMES as THEMES } from "@/lib/websiteThemes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Save, Globe, Eye, Copy, Check, Image as ImageIcon, X,
  Lock, Type, Palette, ToggleLeft, FileText, Heart, MapPin, Clock, Gift, HelpCircle,
  QrCode, Download, Link2, Plus, Users, Undo2, Sparkles, Settings, Trash2, Smile,
  Move,
} from "lucide-react";
import { WebsiteRenderer, type WebsiteRendererPayload, parseRegistryLinks, type RegistryLink } from "@/components/website/WebsiteRenderer";
import { flushPendingEditableCommits, subscribeEditableDrag } from "@/components/website/EditableText";
import { EDITABLE_HIDDEN_MARKER, isEditableHiddenMarker } from "@/components/website/hiddenMarker";
import { HeroPhotoPositionDialog } from "@/components/HeroPhotoPositionDialog";
import { ImageCropDialog, type CropQueueItem } from "@/components/ImageCropDialog";

interface WebsiteRecord extends WebsiteRendererPayload {
  id: number;
  slug: string;
  heroImages: Array<{ url: string; order: number }>;
  passwordEnabled: boolean;
  published: boolean;
  publishedAt: string | null;
  lastUpdated: string;
}

// 10 themes (preset color + font combos) — shared with InvitationCustomization.

// Section keys that render a heading + body. Each gets a Title (chip),
// Subtitle (h2), and Body (paragraph) text override.
const SECTION_TEXT_KEYS: Array<{ key: string; label: string; defaultTitle: string; defaultSubtitle?: string }> = [
  { key: "welcome",  label: "Welcome",  defaultTitle: "Welcome" },
  { key: "story",    label: "Our Story", defaultTitle: "Our Story", defaultSubtitle: "How we got here" },
  { key: "schedule", label: "Schedule",  defaultTitle: "Schedule", defaultSubtitle: "The day of" },
  { key: "travel",   label: "Travel",    defaultTitle: "Travel & Venue", defaultSubtitle: "Where & how to get there" },
  { key: "registry", label: "Registry",  defaultTitle: "Registry", defaultSubtitle: "With love" },
  { key: "faq",      label: "FAQ",       defaultTitle: "FAQ", defaultSubtitle: "Good to know" },
  { key: "gallery",  label: "Gallery",   defaultTitle: "Gallery", defaultSubtitle: "Moments" },
];

const SECTION_LIST: Array<{ id: keyof WebsiteRecord["sectionsEnabled"]; label: string; icon: React.ElementType }> = [
  { id: "welcome",      label: "Welcome",       icon: Heart },
  { id: "story",        label: "Our Story",     icon: Heart },
  { id: "schedule",     label: "Schedule",      icon: Clock },
  { id: "travel",       label: "Travel",        icon: MapPin },
  { id: "registry",     label: "Registry",      icon: Gift },
  { id: "faq",          label: "FAQ",           icon: HelpCircle },
  { id: "gallery",      label: "Gallery",       icon: ImageIcon },
  { id: "weddingParty", label: "Wedding Party", icon: Heart },
  { id: "rsvp",         label: "RSVP",          icon: Heart },
];

// ---------- main ----------

export default function WebsiteEditor() {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [record, setRecord] = useState<WebsiteRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [copied, setCopied] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [lastAutosaved, setLastAutosaved] = useState<Date | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSection, setPreviewSection] = useState<string>("home");
  const [editorSection, setEditorSection] = useState<string>("home");
  const [qrOpen, setQrOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"design" | "pages" | "animation" | "settings" | "content">("design");
  const inTab = (t: typeof activeTab) => activeTab === t;
  const [emojiFieldOpen, setEmojiFieldOpen] = useState<string | null>(null);
  const contentInputRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});
  // x/y are viewport coords (used to position the menu); canvasX/canvasY are
  // coords relative to the WebsiteRenderer container (used so a newly
  // inserted text box lands where the user right-clicked).
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; canvasX: number; canvasY: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [urlModalOpen, setUrlModalOpen] = useState(false);

  useEffect(() => {
    if (!ctxMenu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setCtxMenu(null); };
    const onDown = () => setCtxMenu(null);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [ctxMenu]);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const dragState = useRef<{ active: boolean; startX: number; startW: number }>({ active: false, startX: 0, startW: 260 });
  const previewRef = useRef<HTMLElement | null>(null);
  const mobilePreviewRef = useRef<HTMLDivElement | null>(null);
  const [overlayEl, setOverlayEl] = useState<HTMLDivElement | null>(null);
  // URL of the hero photo whose focal point is being edited. null = dialog closed.
  const [positioningUrl, setPositioningUrl] = useState<string | null>(null);
  // Whether ANY deletable EditableText is currently being dragged. Drives the
  // visual emphasis on the trash drop zone.
  const [editableDragging, setEditableDragging] = useState(false);
  useEffect(() => subscribeEditableDrag((phase) => setEditableDragging(phase === "start")), []);

  const upload = useUpload({
    getToken,
    onError: (e) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  // ---- sidebar resize drag ----

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragState.current.active) return;
      const dx = e.clientX - dragState.current.startX;
      setSidebarWidth(Math.max(200, Math.min(520, dragState.current.startW + dx)));
    };
    const onUp = () => { dragState.current.active = false; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  // ---- load ----

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await authFetch("/api/website/me");
      if (cancelled) return;
      if (r.ok) {
        const body = (await r.json()) as WebsiteRecord;
        setRecord(body);
      } else if (r.status !== 404) {
        toast({ title: "Failed to load website", variant: "destructive" });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Collaborator live sync: re-fetch /api/website/me every 5s, but only when
  // the local session has no unsaved edits and the user isn't actively
  // editing. Otherwise polling could clobber in-progress text or fight the
  // autosave round-trip. When another collaborator (partner / planner) saves
  // an edit, this picks it up within 5s so both workstations stay in sync
  // without needing a full WebSocket layer. Per-user UI language is already
  // independent (localStorage in i18n.ts), so each collaborator keeps their
  // own language regardless of remote updates.
  useEffect(() => {
    if (!record) return;
    const COLLAB_POLL_INTERVAL_MS = 5000;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      // Skip when the user is mid-edit or has unflushed work — we'd otherwise
      // overwrite their cursor/state with a remote snapshot.
      if (dirtyRef.current || inFlightSaveRef.current) return;
      const active = typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
      if (active && (active.isContentEditable || active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;
      try {
        const r = await authFetch("/api/website/me");
        if (cancelled || !r.ok) return;
        const remote = (await r.json()) as WebsiteRecord;
        // Only adopt remote state if it's strictly newer. Comparing lastUpdated
        // avoids spurious re-renders when the remote and local timestamps match
        // (same save round-trip), and prevents a slow response from rolling us
        // back to an older snapshot.
        const localTs = recordRef.current?.lastUpdated ? Date.parse(recordRef.current.lastUpdated) : 0;
        const remoteTs = remote.lastUpdated ? Date.parse(remote.lastUpdated) : 0;
        if (Number.isFinite(remoteTs) && remoteTs > localTs) {
          setRecord((prev) => ({ ...remote, portalParty: remote.portalParty ?? prev?.portalParty }));
          recordRef.current = { ...remote, portalParty: remote.portalParty ?? recordRef.current?.portalParty };
        }
      } catch { /* network blip — try again next tick */ }
    };
    const id = setInterval(tick, COLLAB_POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.id]);

  // Load couple data so the live preview can render even before the server
  // joins it. We fetch on demand from the public endpoint after first save.
  const [previewExtra, setPreviewExtra] = useState<{ couple: WebsiteRendererPayload["couple"] } | null>(null);
  useEffect(() => {
    if (!record) return;
    let cancelled = false;
    (async () => {
      const profileRes = await authFetch("/api/profile");
      if (cancelled) return;
      if (!profileRes?.ok) return;
      const profile = await profileRes.json();
      setPreviewExtra({
        couple: {
          partner1Name: profile.partner1Name ?? "",
          partner2Name: profile.partner2Name ?? "",
          weddingDate: profile.weddingDate ?? "",
          ceremonyTime: profile.ceremonyTime ?? "",
          receptionTime: profile.receptionTime ?? "",
          venue: profile.venue ?? "",
          location: profile.location ?? "",
          venueCity: profile.venueCity ?? null,
          venueState: profile.venueState ?? null,
        },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [record?.id]);

  // ---- create on first visit ----

  const handleCreate = async () => {
    setCreating(true);
    try {
      const r = await authFetch("/api/website/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!r.ok) throw new Error("Failed to create");
      const body = (await r.json()) as WebsiteRecord;
      setRecord(body);
      toast({ title: "Wedding website created!" });
    } catch {
      toast({ title: "Failed to create website", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  // ---- undo history ----
  // Coalesces rapid changes (drag, typing) into a single history entry so the
  // user undoes one logical action at a time rather than each pixel of a drag.
  const [historyLen, setHistoryLen] = useState(0);
  // Mirrors whether pendingPrevRef holds an uncommitted entry, so the Undo
  // button enables immediately after a change rather than after the 500ms
  // debounce flushes the pending entry into history.
  const [hasPending, setHasPending] = useState(false);
  const historyRef = useRef<WebsiteRecord[]>([]);
  const pendingPrevRef = useRef<WebsiteRecord | null>(null);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queueHistory = useCallback((prev: WebsiteRecord) => {
    if (!pendingPrevRef.current) {
      pendingPrevRef.current = prev;
      setHasPending(true);
    }
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    commitTimerRef.current = setTimeout(() => {
      const p = pendingPrevRef.current;
      pendingPrevRef.current = null;
      setHasPending(false);
      if (!p) return;
      historyRef.current = [...historyRef.current.slice(-49), p];
      setHistoryLen(historyRef.current.length);
    }, 500);
  }, []);

  const doUndo = useCallback(() => {
    // Flush any pending coalesced entry first so we don't lose a half-coalesced state
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    if (pendingPrevRef.current) {
      historyRef.current = [...historyRef.current.slice(-49), pendingPrevRef.current];
      pendingPrevRef.current = null;
      setHasPending(false);
    }
    if (historyRef.current.length === 0) return;
    const prev = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    setHistoryLen(historyRef.current.length);
    setRecord(prev);
    recordRef.current = prev;
    editSeqRef.current += 1;
    setDirty(true);
  }, []);

  const handleUndo = useCallback(() => {
    // EditableText debounces its blur-commit ~80ms. Clicking the Undo button
    // mousedown-blurs the active editable, but the Undo click runs BEFORE
    // that 80ms timer fires — so without flushing, the just-typed/deleted
    // change is invisible to the undo logic.
    //
    // Two-step:
    //   1. If something is still focused, blur it so its scheduleHide is queued.
    //   2. Force every queued commit to run synchronously, then pop history.
    const active = typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
    const editing = !!active && (active.isContentEditable || active.tagName === "INPUT" || active.tagName === "TEXTAREA");
    if (editing) active!.blur();
    flushPendingEditableCommits();
    // Defer one tick so React can apply the setRecord triggered by the
    // flushed onCommit (and thus queueHistory) before doUndo reads the slot.
    setTimeout(doUndo, 0);
  }, [doUndo]);

  // Cmd/Ctrl+Z to undo from anywhere in the editor (except inside form fields)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z" || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      handleUndo();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handleUndo]);

  // ---- update helpers ----

  // Mirror current record into a ref so update/patchRecord can call queueHistory
  // synchronously (refs are mutated immediately, while state updaters queued via
  // setRecord are only invoked at React's next render — which can land AFTER a
  // setTimeout(0) used to schedule undo, leaving pendingPrevRef empty).
  const recordRef = useRef<WebsiteRecord | null>(null);
  useEffect(() => { recordRef.current = record; }, [record]);

  // Mirror dirty into a ref so the beforeunload handler (which runs outside
  // React's lifecycle) can read the current dirty state synchronously.
  const dirtyRef = useRef(false);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);

  // Bumps on every user edit so saveNow can detect "user typed while POST was
  // in flight" and avoid clobbering those edits with the server's response.
  const editSeqRef = useRef(0);

  // recordRef must be the canonical "latest edited record" so callers reading
  // it synchronously (visibilitychange / pagehide / unmount save paths,
  // saveNow inside autosave, queueHistory across rapid edits) always see the
  // freshly merged value. We previously updated the ref inside the setRecord
  // updater, but React 18 batches state updates — the updater can run after
  // the calling code returns, so a follow-up `recordRef.current` read landed
  // on the pre-edit body. Mutate the ref first, then call setRecord with the
  // computed value so React state and the ref stay in lockstep.
  const update = (patch: Partial<WebsiteRecord>) => {
    if (!recordRef.current) return;
    const prev = recordRef.current;
    const next = { ...prev, ...patch };
    queueHistory(prev);
    recordRef.current = next;
    setRecord(next);
    dirtyRef.current = true;
    setDirty(true);
    editSeqRef.current += 1;
  };

  // Functional updater for callbacks fired during editing (drag, style changes, text commits).
  // Reads from recordRef so rapid back-to-back calls see each other's writes
  // without waiting for React to commit.
  const patchRecord = useCallback((fn: (prev: WebsiteRecord) => Partial<WebsiteRecord>) => {
    if (!recordRef.current) return;
    const prev = recordRef.current;
    const next = { ...prev, ...fn(prev) };
    queueHistory(prev);
    recordRef.current = next;
    setRecord(next);
    dirtyRef.current = true;
    setDirty(true);
    editSeqRef.current += 1;
  }, [queueHistory]);

  // Must be declared above any early return so the hook count stays stable.
  const livePreview = useMemo<WebsiteRendererPayload | null>(() => {
    if (!record) return null;
    return {
      slug: record.slug,
      theme: record.theme,
      layoutStyle: record.layoutStyle,
      font: record.font,
      accentColor: record.accentColor,
      colorPalette: record.colorPalette,
      sectionsEnabled: record.sectionsEnabled,
      customText: record.customText,
      textStyles: record.textStyles ?? {},
      textPositions: record.textPositions ?? {},
      galleryImages: record.galleryImages,
      heroImages: record.heroImages ?? [],
      heroImage: record.heroImage,
      portalParty: record.portalParty,
      couple: previewExtra?.couple ?? {
        partner1Name: "",
        partner2Name: "",
        weddingDate: "",
        ceremonyTime: "",
        receptionTime: "",
        venue: "",
        location: "",
        venueCity: null,
        venueState: null,
      },
    };
  }, [record, previewExtra?.couple]);

  const [saveError, setSaveError] = useState(false);
  // Tracks the most recent server/network error so handleSave can surface it
  // in the failure toast for diagnosis. Cleared on every successful save.
  const lastSaveErrorRef = useRef<{ status?: number; message: string } | null>(null);

  // localStorage backup — every dirty save snapshot is mirrored here so a
  // failed POST + closed tab still recovers on next mount.
  const PENDING_SAVE_KEY = "aido_website_pending_save_v1";

  const buildSaveBody = (rec: WebsiteRecord) => ({
    theme: rec.theme,
    layoutStyle: rec.layoutStyle,
    font: rec.font,
    accentColor: rec.accentColor,
    colorPalette: rec.colorPalette,
    sectionsEnabled: rec.sectionsEnabled,
    customText: rec.customText,
    textStyles: rec.textStyles ?? {},
    textPositions: rec.textPositions ?? {},
    galleryImages: rec.galleryImages,
    heroImages: rec.heroImages ?? [],
    heroImage: rec.heroImage,
    ...(passwordInput.trim() ? { password: passwordInput.trim() } : {}),
  });

  const writePendingBackup = (body: ReturnType<typeof buildSaveBody>, websiteId: number) => {
    try {
      localStorage.setItem(PENDING_SAVE_KEY, JSON.stringify({ websiteId, savedAt: Date.now(), body }));
    } catch { /* quota exceeded — ignore, retry will still run */ }
  };
  const clearPendingBackup = () => {
    try { localStorage.removeItem(PENDING_SAVE_KEY); } catch { /* ignore */ }
  };

  // Posts a save body. Retries 5xx + network errors with exponential backoff
  // capped at 30s. 4xx errors are not retried inside this call (the caller
  // decides — autosave reschedules; user-triggered handleSave surfaces them).
  const postSave = async (
    body: ReturnType<typeof buildSaveBody>,
    options: { maxAttempts?: number } = {},
  ): Promise<{ ok: true; record: WebsiteRecord } | { ok: false; err: unknown; status?: number }> => {
    const max = options.maxAttempts ?? 5;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= max; attempt++) {
      try {
        const r = await authFetch("/api/website/update", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (r.ok) {
          const rec = (await r.json()) as WebsiteRecord;
          return { ok: true, record: rec };
        }
        if (r.status < 500) {
          const text = await r.text().catch(() => "");
          return { ok: false, err: new Error(`HTTP ${r.status}${text ? `: ${text}` : ""}`), status: r.status };
        }
        lastErr = new Error(`HTTP ${r.status}`);
      } catch (err) {
        lastErr = err;
      }
      if (attempt < max) {
        const delay = Math.min(30000, 1000 * Math.pow(2, attempt - 1));
        await new Promise((res) => setTimeout(res, delay));
      }
    }
    return { ok: false, err: lastErr };
  };

  // Single in-flight save promise. handleSave + autosave both await this so a
  // click that lands while autosave is mid-POST never spawns a duplicate
  // request (which used to race the response and either fail or overwrite).
  const inFlightSaveRef = useRef<Promise<boolean> | null>(null);

  const saveNow = (silent: boolean): Promise<boolean> => {
    const start = inFlightSaveRef.current
      ? inFlightSaveRef.current.then(() => runSave(silent))
      : runSave(silent);
    const tracked = start.finally(() => {
      // Only clear the chain head when this exact promise is the tail —
      // otherwise a later chained save is still pending and we must wait.
      if (inFlightSaveRef.current === tracked) inFlightSaveRef.current = null;
    });
    inFlightSaveRef.current = tracked;
    return tracked;
  };

  const runSave = async (silent: boolean): Promise<boolean> => {
    // Always snapshot the latest state from the ref to avoid stale closures.
    const rec = recordRef.current;
    if (!rec) return false;
    // setSaving is managed by the caller (handleSave) for non-silent saves
    // so the button spinner appears immediately on click, before any chained
    // in-flight save resolves.
    try {
      const body = buildSaveBody(rec);
      // Mirror to localStorage BEFORE attempting the network — guarantees the
      // payload survives a tab close mid-request.
      writePendingBackup(body, rec.id);

      // Capture edit count before POST so we can detect concurrent edits and
      // avoid clobbering them with the server's response.
      const seqAtSend = editSeqRef.current;
      const result = await postSave(body);
      if (result.ok) {
        lastSaveErrorRef.current = null;
        const userEditedDuringSave = editSeqRef.current !== seqAtSend;
        setRecord((prev) => {
          if (!prev) return result.record;
          // If the user kept typing during the POST, keep their in-memory record
          // and only fold in server-owned metadata (id, slug, lastUpdated, etc.).
          // Otherwise mirror the server's authoritative response.
          if (userEditedDuringSave) {
            return {
              ...prev,
              id: result.record.id,
              slug: result.record.slug,
              published: result.record.published,
              lastUpdated: result.record.lastUpdated,
              password: result.record.password,
              portalParty: result.record.portalParty ?? prev.portalParty,
            };
          }
          return {
            ...result.record,
            portalParty: result.record.portalParty ?? prev.portalParty,
          };
        });
        setPasswordInput("");
        // Only mark clean if no edits happened during the POST. Otherwise the
        // local state is still ahead of the server and another save needs to run.
        if (editSeqRef.current === seqAtSend) setDirty(false);
        setSaveError(false);
        clearPendingBackup();
        return true;
      }

      console.error("[WebsiteEditor] save failed after retries", result.err);
      const message =
        result.err instanceof Error ? result.err.message : String(result.err ?? "Unknown error");
      lastSaveErrorRef.current = { status: result.status, message };
      setSaveError(true);
      return false;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err ?? "Unknown error");
      lastSaveErrorRef.current = { message };
      setSaveError(true);
      return false;
    }
  };

  // On mount, if the previous tab left a pending payload behind (e.g. a save
  // failed after the user closed the editor), replay it now so the work is
  // never lost. Runs once per `record.id` change.
  useEffect(() => {
    if (!record) return;
    let cancelled = false;
    (async () => {
      let pending: { websiteId: number; savedAt: number; body: ReturnType<typeof buildSaveBody> } | null = null;
      try {
        const raw = localStorage.getItem(PENDING_SAVE_KEY);
        if (raw) pending = JSON.parse(raw);
      } catch { return; }
      if (!pending || pending.websiteId !== record.id) return;
      // If the server's lastUpdated is already newer than the pending snapshot,
      // assume someone else (or another tab) saved it and drop the backup.
      const serverTs = record.lastUpdated ? Date.parse(record.lastUpdated) : 0;
      if (Number.isFinite(serverTs) && serverTs >= pending.savedAt) {
        clearPendingBackup();
        return;
      }
      const result = await postSave(pending.body);
      if (cancelled) return;
      if (result.ok) {
        setRecord((prev) => ({
          ...result.record,
          portalParty: result.record.portalParty ?? prev?.portalParty,
        }));
        clearPendingBackup();
      }
      // If it failed, leave the backup in place — autosave will pick it up
      // on the next dirty cycle, and the user sees the "Save failed" hint.
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.id]);

  // Fire a best-effort save whenever the user leaves the editor with unsaved
  // changes — closing the tab, navigating away in the SPA, switching tabs, or
  // backgrounding the window. The localStorage backup written inside saveNow
  // covers the case where the network request gets cancelled mid-flight; on
  // the next mount we replay it. We also force-blur any focused editable and
  // flush pending commits so text the user typed but hasn't blurred yet still
  // reaches the save payload.
  useEffect(() => {
    const flushAndSave = () => {
      // Blur active contentEditable / INPUT / TEXTAREA so the typed value
      // commits before the snapshot is taken. EditableText schedules its
      // commit on blur with an 80ms debounce; flushPendingEditableCommits
      // fires those callbacks synchronously.
      const active = typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
      if (active && (active.isContentEditable || active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
        try { active.blur(); } catch { /* ignore */ }
      }
      flushPendingEditableCommits();
      if (!dirtyRef.current || !recordRef.current) return;
      // Fire-and-forget — saveNow writes the localStorage backup BEFORE the
      // network call, so the data survives even if the request is cancelled
      // by tab close, navigation, or background-tab throttling. patchRecord
      // mutates recordRef synchronously before queuing the setRecord, so
      // saveNow's read of recordRef.current already reflects the just-flushed
      // commits — no need to wait a render frame.
      saveNow(true);
    };
    const onVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") flushAndSave();
    };
    window.addEventListener("beforeunload", flushAndSave);
    window.addEventListener("pagehide", flushAndSave);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", flushAndSave);
      window.removeEventListener("pagehide", flushAndSave);
      document.removeEventListener("visibilitychange", onVisibility);
      // Component unmount (e.g. SPA navigation to a different route) — the
      // autosave debounce timer is about to be cleared, so flush + save here
      // to capture anything still in flight.
      flushAndSave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave: ~1s after the last change so anything the user typed reaches
  // the server almost immediately and the explicit Save button is a no-op
  // confirmation rather than the only path that persists work. Reschedules
  // itself on failure so unsaved work is never silently dropped.
  //
  // autoSaveSeq is incremented on each failure. Without it, a failed save
  // leaves dirty=true and record unchanged — the effect deps don't change, so
  // the retry timer is never scheduled. The seq bump forces the effect to re-run
  // regardless of whether record or dirty changed.
  const autosaveFailedRef = useRef(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [autoSaveSeq, setAutoSaveSeq] = useState(0);
  // Stays true for 2s after any successful save so the button flashes green
  // even when the user immediately starts editing again (which sets dirty=true).
  const [savedFlash, setSavedFlash] = useState(false);
  const savedFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashSaved = () => {
    setSavedFlash(true);
    if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current);
    savedFlashTimerRef.current = setTimeout(() => setSavedFlash(false), 2000);
  };
  useEffect(() => {
    if (!record || !dirty) return;
    // With the explicit Save button removed, autosave is the only persistence
    // path — keep the debounce short (400ms) so a quick edit + tab-away saves
    // before navigation. After a failure, back off to 5s so we don't hammer a
    // broken endpoint.
    const delay = autosaveFailedRef.current ? 5000 : 400;
    const timer = setTimeout(async () => {
      // Flush any pending EditableText commits (blur-debounced by 80ms) so
      // the body autosave POSTs reflects everything the user has typed, not
      // just what landed in record before the timer started.
      flushPendingEditableCommits();
      setAutoSaving(true);
      const ok = await saveNow(true);
      setAutoSaving(false);
      autosaveFailedRef.current = !ok;
      if (ok) { setLastAutosaved(new Date()); flashSaved(); }
      else setAutoSaveSeq(n => n + 1); // reschedule retry
    }, delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record, dirty, autoSaveSeq]);

  const handleSave = async () => {
    // Flush any text the user typed but hasn't blurred yet. EditableText
    // defers onCommit by 80 ms after blur, and contentEditable / native input
    // values aren't in record state until the element blurs at all. Without
    // both steps, clicking Save right after typing can ship a stale snapshot.
    const active = typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
    if (active && (active.isContentEditable || active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
      active.blur();
    }
    flushPendingEditableCommits();
    // One paint frame so React applies the flushed setState before we read
    // recordRef.current inside saveNow.
    await new Promise<void>((res) => requestAnimationFrame(() => res()));
    // Show spinner immediately — before any in-flight auto-save resolves.
    setSaving(true);
    try {
      const ok = await saveNow(false);
      if (ok) { toast({ title: "Saved!" }); flashSaved(); }
      else {
        const err = lastSaveErrorRef.current;
        const detail = err
          ? `${err.status ? `HTTP ${err.status} — ` : ""}${err.message} (your work is backed up locally and will keep retrying)`
          : "We'll keep retrying in the background — your work is backed up locally.";
        toast({ title: "Save didn't go through", description: detail, variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClearPassword = async () => {
    if (!record) return;
    setSaving(true);
    try {
      const r = await authFetch("/api/website/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: null }),
      });
      if (!r.ok) throw new Error("Failed to clear password");
      const body = (await r.json()) as WebsiteRecord;
      setRecord(body);
      toast({ title: "Password removed." });
    } catch {
      toast({ title: "Failed to clear password", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!record) return;
    const pendingPassword = passwordInput.trim();
    // Flush + save BEFORE flipping the publish flag. /api/website/publish
    // returns the full website row and we replace local state with it — if
    // there are unsaved customText edits (e.g. AI-generated story copy that
    // was committed less than the 1s autosave window ago), the server's
    // response would clobber them and the published site would render the
    // stale text. Saving first guarantees the DB row already matches.
    const active = typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
    if (active && (active.isContentEditable || active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
      active.blur();
    }
    flushPendingEditableCommits();
    await new Promise<void>((res) => requestAnimationFrame(() => res()));

    setPublishing(true);
    try {
      if (dirtyRef.current) {
        if (pendingPassword) {
          // Never publish without first persisting a newly entered password.
          // The password field lives in local component state (not record),
          // so the guest-facing gate would be missing if we timed out and
          // published before this save completes.
          const saved = await saveNow(true);
          if (!saved) {
            const err = lastSaveErrorRef.current;
            const detail = err
              ? `${err.status ? `HTTP ${err.status} — ` : ""}${err.message} (your work is backed up locally and will keep retrying)`
              : "Your work is backed up locally and will keep retrying in the background.";
            toast({ title: "Couldn't save password before publishing", description: detail, variant: "destructive" });
            return;
          }
        } else {
        // Race the pre-publish save against a 6s timeout. saveNow chains onto
        // the in-flight autosave promise, so a stuck retry loop (server 5xx,
        // dropped network) would otherwise pin Publish forever and the button
        // appears to do nothing. After 6s we proceed and let the publish
        // endpoint run with whatever the server currently has — the user
        // explicitly clicked Publish, and the localStorage backup + autosave
        // retry will eventually push the latest edits.
        let timedOut = false;
        const saved = await Promise.race<boolean>([
          saveNow(true),
          new Promise<boolean>((res) => setTimeout(() => { timedOut = true; res(false); }, 6000)),
        ]);
        if (!saved && !timedOut) {
          const err = lastSaveErrorRef.current;
          const detail = err
            ? `${err.status ? `HTTP ${err.status} — ` : ""}${err.message} (your work is backed up locally and will keep retrying)`
            : "Your work is backed up locally and will keep retrying in the background.";
          toast({ title: "Couldn't save before publishing", description: detail, variant: "destructive" });
          return;
        }
        if (timedOut) {
          toast({
            title: "Publishing anyway…",
            description: "Save is still retrying in the background — your latest edits will sync once the connection recovers.",
          });
        }
        }
      }
      const r = await authFetch("/api/website/publish", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !record.published }),
      });
      if (!r.ok) throw new Error("Failed");
      const body = (await r.json()) as WebsiteRecord;
      setRecord((prev) => ({
        ...body,
        portalParty: body.portalParty ?? prev?.portalParty,
      }));
      if (body.published) {
        setPreviewSection("home");
        setEditorSection("home");
      }
      toast({ title: body.published ? "Website published!" : "Website unpublished" });
    } catch {
      toast({ title: "Failed to update publish state", variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  // Per-URL focal points for hero photos, JSON-encoded under _heroFocals so
  // a single customText entry covers every image instead of polluting the
  // map with one key per URL.
  const readHeroFocals = (): Record<string, string> => {
    const raw = recordRef.current?.customText._heroFocals;
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
    } catch {
      return {};
    }
  };

  const writeHeroFocal = (url: string, position: string) => {
    const next = { ...readHeroFocals(), [url]: position };
    update({ customText: { ...recordRef.current!.customText, _heroFocals: JSON.stringify(next) } });
  };

  const dropHeroFocal = (url: string) => {
    const current = readHeroFocals();
    if (!(url in current)) return;
    const { [url]: _drop, ...rest } = current;
    void _drop;
    update({ customText: { ...recordRef.current!.customText, _heroFocals: JSON.stringify(rest) } });
  };

  // Per-URL zoom levels (1.0 = native cover, up to 4.0). Same JSON-map shape
  // as _heroFocals so a single customText entry covers every hero photo.
  const readHeroZooms = (): Record<string, number> => {
    const raw = recordRef.current?.customText._heroZooms;
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return {};
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
      }
      return out;
    } catch {
      return {};
    }
  };

  const writeHeroZoom = (url: string, zoom: number) => {
    const current = readHeroZooms();
    // zoom of 1.0 is the default — drop the entry instead of storing redundant data.
    const next = { ...current };
    if (zoom === 1) delete next[url];
    else next[url] = zoom;
    update({ customText: { ...recordRef.current!.customText, _heroZooms: JSON.stringify(next) } });
  };

  const dropHeroZoom = (url: string) => {
    const current = readHeroZooms();
    if (!(url in current)) return;
    const { [url]: _drop, ...rest } = current;
    void _drop;
    update({ customText: { ...recordRef.current!.customText, _heroZooms: JSON.stringify(rest) } });
  };

  const handleGalleryUpload = async (files: FileList) => {
    if (!record) return;
    const newImages = [...record.galleryImages];
    for (const file of Array.from(files).slice(0, 10)) {
      const result = await upload.uploadFile(file);
      if (result) {
        newImages.push({ url: result.objectPath, order: newImages.length });
      }
    }
    update({ galleryImages: newImages });
  };

  const removeGalleryImage = (index: number) => {
    if (!record) return;
    const next = record.galleryImages.filter((_, i) => i !== index).map((img, i) => ({ ...img, order: i }));
    update({ galleryImages: next });
  };

  // ----- Hero photo crop-on-upload flow -------------------------------------
  // Upfront cropper. The user picks files → ImageCropDialog walks each one
  // → each cropped (or skipped) file is uploaded sequentially and appended
  // to record.heroImages. Sequential uploads avoid the race where two
  // parallel uploads each read the same recordRef snapshot and one append
  // wins, dropping the other from heroImages.
  const [heroCropQueue, setHeroCropQueue] = useState<File[]>([]);
  const [heroCropTotal, setHeroCropTotal] = useState(0);
  const heroUploadChainRef = useRef<Promise<void>>(Promise.resolve());

  const heroCropItem: CropQueueItem | null = heroCropQueue.length > 0
    ? {
        file: heroCropQueue[0],
        index: heroCropTotal - heroCropQueue.length,
        total: heroCropTotal,
      }
    : null;

  const startHeroCropFlow = (files: FileList) => {
    const arr = Array.from(files).slice(0, 10);
    if (arr.length === 0) return;
    setHeroCropQueue(arr);
    setHeroCropTotal(arr.length);
  };

  const enqueueHeroUpload = (file: File) => {
    heroUploadChainRef.current = heroUploadChainRef.current.then(async () => {
      const result = await upload.uploadFile(file);
      if (!result) return;
      const cur = recordRef.current;
      if (!cur) return;
      const next = [
        ...(cur.heroImages ?? []),
        { url: result.objectPath, order: cur.heroImages?.length ?? 0 },
      ];
      update({ heroImages: next });
    });
  };

  const advanceHeroCropQueue = () => setHeroCropQueue((q) => q.slice(1));

  const onHeroCropComplete = (croppedFile: File) => {
    enqueueHeroUpload(croppedFile);
    advanceHeroCropQueue();
  };

  const onHeroCropSkip = () => {
    const original = heroCropQueue[0];
    if (original) enqueueHeroUpload(original);
    advanceHeroCropQueue();
  };

  const onHeroCropCancelAll = () => {
    setHeroCropQueue([]);
    setHeroCropTotal(0);
  };

  const removeHeroImage = (index: number) => {
    if (!record) return;
    const next = (record.heroImages ?? []).filter((_, i) => i !== index).map((img, i) => ({ ...img, order: i }));
    update({ heroImages: next });
  };

  const applyTheme = (themeId: string) => {
    const t = THEMES.find((x) => x.id === themeId);
    if (!t) return;
    // Reset all per-element / per-page colour overrides so the theme's
    // colours actually take effect everywhere — otherwise leftover keys
    // like _storyBg or _navLinkColor would keep painting old values on
    // top of the new theme.
    const RESET_KEYS = [
      "_navLinkColor", "_navCoupleColor", "_footerColor",
      // Per-element text colour overrides — must clear so section text
      // picks up the new theme's colorPalette.text instead of the old hue.
      "_welcomeColor",
      // Per-page bg keys (legacy) plus the new shared sections bg.
      "_welcomeBg", "_sectionsBg",
      "_storyBg", "_scheduleBg", "_travelBg", "_registryBg",
      "_weddingPartyBg", "_galleryBg", "_faqBg", "_rsvpBg",
      // FAQ per-element style overrides
      "_faqQuestionFont", "_faqQuestionSize", "_faqQuestionColor", "_faqQuestionBold", "_faqQuestionItalic",
      "_faqAnswerFont", "_faqAnswerSize", "_faqAnswerColor", "_faqAnswerBold", "_faqAnswerItalic",
    ];
    const nextCustomText: Record<string, string> = { ...(record?.customText ?? {}) };
    for (const k of RESET_KEYS) delete nextCustomText[k];
    update({
      theme: t.id,
      font: t.font,
      accentColor: t.accent,
      colorPalette: {
        primary: t.primary,
        secondary: t.secondary,
        accent: t.accent,
        neutral: t.neutral,
        background: t.background,
        text: t.text,
      },
      customText: nextCustomText,
      // Clear per-element text styles (colour, size, font overrides) so they
      // inherit the new theme cleanly. Custom floating text boxes (_custom_*)
      // are preserved since those are intentional user additions.
      textStyles: Object.fromEntries(
        Object.entries(record?.textStyles ?? {}).filter(([k]) => k.startsWith("_custom_"))
      ),
    });
  };

  const publicUrl = useMemo(() => {
    if (!record) return "";
    return `${window.location.origin}/w/${record.slug}`;
  }, [record]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ title: "Failed to copy link", variant: "destructive" });
    }
  };

  const handleDeleteElement = (key: string) => {
    patchRecord((prev) => {
      const ct = { ...prev.customText };
      const ts = { ...(prev.textStyles ?? {}) };
      const tp = { ...(prev.textPositions ?? {}) };
      if (key.startsWith("_custom_")) {
        // User-added text box — fully remove the row.
        delete ct[key]; delete ts[key]; delete tp[key];
      } else {
        // Default field (couple names, story, schedule, etc.) — flag
        // it hidden via the sentinel marker so the deletion persists
        // across editor page changes, preview, and the published site.
        ct[key] = EDITABLE_HIDDEN_MARKER;
      }
      return { customText: ct, textStyles: ts, textPositions: tp };
    });
  };

  // ---- render ----

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-6 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
          <Globe className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-3xl font-serif font-bold mb-3">{t("website_editor.your_wedding_website", { defaultValue: "Your Wedding Website" })}</h1>
        <p className="text-muted-foreground mb-8">
          {t("website_editor.create_intro", { defaultValue: "Create a beautiful, shareable site for your guests. We'll auto-generate it using your existing wedding details — you can customize everything afterwards." })}
        </p>
        <Button size="lg" onClick={handleCreate} disabled={creating}>
          {creating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("website_editor.creating", { defaultValue: "Creating..." })}</> : t("website_editor.create_my_website", { defaultValue: "Create My Wedding Website" })}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] md:h-screen relative">
      {/* Mobile: live preview pinned to the top half so the user can see
          the page they're editing without flipping panels. lg+ shows it on
          the right via the sibling <main> below. */}
      <div className="lg:hidden flex-shrink-0 border-b bg-muted/20 overflow-hidden" style={{ height: "45vh" }}>
        <div ref={(el) => { if (el && !previewRef.current) previewRef.current = el; mobilePreviewRef.current = el; }} className="h-full overflow-y-auto">
          {livePreview && (
            <WebsiteRenderer
              data={livePreview}
              editable
              slug={record.slug ?? ""}
              previewMode
              scrollContainer={mobilePreviewRef.current}
              currentSection={editorSection}
              onSectionChange={(id) => {
                setEditorSection(id);
                mobilePreviewRef.current?.scrollTo({ top: 0, behavior: "auto" });
              }}
              onTextChange={(key, value) => patchRecord((prev) => ({ customText: { ...prev.customText, [key]: value } }))}
              onStyleChange={(key, style) => patchRecord((prev) => ({ textStyles: { ...(prev.textStyles ?? {}), [key]: style } }))}
              onPositionChange={(key, pos) => patchRecord((prev) => ({ textPositions: { ...(prev.textPositions ?? {}), [key]: pos } }))}
              onDeleteElement={handleDeleteElement}
              onGalleryCaptionChange={(imageUrl, caption) => patchRecord((prev) => {
                const next = (prev.galleryImages ?? []).map((img) =>
                  img.url === imageUrl ? { ...img, caption } : img,
                );
                return { galleryImages: next };
              })}
            />
          )}
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className="w-full lg:flex-shrink-0 border-r bg-background overflow-y-auto block"
        style={{ width: typeof window !== "undefined" && window.innerWidth >= 1024 ? sidebarWidth : undefined }}
      >
        <div className="p-5 border-b sticky top-0 bg-background z-10">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-xl font-serif font-bold">{t("website_editor.editor_title", { defaultValue: "Website Editor" })}</h2>
            <div className="flex items-center gap-2">
              {saveError && (
                <span className="text-[10px] font-medium text-destructive bg-destructive/10 rounded px-2 py-0.5">
                  Save failed — retrying…
                </span>
              )}
              <Badge
                variant={record.published ? "default" : "destructive"}
                className={record.published ? undefined : "bg-red-600 hover:bg-red-600 text-white"}
              >
                {record.published ? t("website_editor.live", { defaultValue: "Live" }) : t("website_editor.draft", { defaultValue: "Draft" })}
              </Badge>
            </div>
          </div>
          {/* Action toolbar — 2x2 grid. Brand gold backgrounds for the
              affirmative actions (Preview, Publish, Save), green when
              Save lands or site is Published, red for Undo / Unpublish.
              Button text now uses brand purple (#2A1745) so the labels
              read in the brand-name color against the gold/green/red
              backgrounds. All labels bold. */}
          <div className="grid grid-cols-2 gap-2 max-w-md">
            <Button
              size="sm"
              onClick={() => {
                // Flush any pending inline-text commit before showing preview
                // so the user sees their latest edits, not a stale snapshot.
                flushPendingEditableCommits();
                setPreviewSection(editorSection || "home");
                setPreviewOpen(true);
              }}
              className="border-0 font-bold"
              style={{ background: "#D4A017", color: "#2A1745" }}
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              {t("website_editor.preview", { defaultValue: "Preview" })}
            </Button>
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={publishing}
              className={
                record.published
                  ? "bg-emerald-600 hover:bg-red-600 border-0 group font-bold"
                  : "border-0 font-bold"
              }
              style={
                record.published
                  ? { color: "#2A1745" }
                  : { background: "#D4A017", color: "#2A1745" }
              }
            >
              {publishing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Globe className="h-3.5 w-3.5 mr-1.5" />}
              {record.published ? (
                <>
                  <span className="group-hover:hidden">{t("website_editor.published", { defaultValue: "Published" })}</span>
                  <span className="hidden group-hover:inline">{t("website_editor.unpublish", { defaultValue: "Unpublish" })}</span>
                </>
              ) : (
                t("website_editor.publish", { defaultValue: "Publish" })
              )}
            </Button>
            <Button
              size="sm"
              onClick={handleUndo}
              disabled={historyLen === 0 && !hasPending}
              title="Undo last change (Cmd/Ctrl+Z)"
              className="bg-red-600 hover:bg-red-700 border-0 disabled:opacity-50 font-bold"
              style={{ color: "#2A1745" }}
            >
              <Undo2 className="h-3.5 w-3.5 mr-1.5" />
              {t("website_editor.undo", { defaultValue: "Undo" })}
            </Button>
          </div>
          {record.published && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 text-xs">
                <Globe className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate flex-1 font-mono hover:underline"
                  onClick={(e) => {
                    // Flush and save before opening the published site so the
                    // visitor sees the latest edits rather than a stale snapshot.
                    // requestAnimationFrame waits one paint so flushPendingEditableCommits'
                    // state update lands in recordRef before saveNow reads it.
                    e.preventDefault();
                    flushPendingEditableCommits();
                    requestAnimationFrame(() => saveNow(true).then(() => window.open(publicUrl, "_blank")));
                  }}
                >
                  {publicUrl}
                </a>
                <Button size="sm" variant="ghost" className="h-6 px-2" onClick={copyLink}>
                  {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2"
                  onClick={() => setQrOpen((v) => !v)}
                  title={qrOpen ? t("website_editor.hide_qr", { defaultValue: "Hide QR code" }) : t("website_editor.generate_qr", { defaultValue: "Generate QR code" })}
                >
                  <QrCode className="h-3 w-3" />
                </Button>
              </div>
              {qrOpen && (
                <div className="rounded-md border bg-background p-3">
                  <QrCodeSection publicUrl={publicUrl} published={record.published} />
                </div>
              )}
            </div>
          )}

          {/* Tab rail */}
          <div className="mt-4 flex items-center gap-1 -mb-1 overflow-x-auto">
            {([
              // "content" is mobile-only — phones can't show the live preview
              // and the sidebar at the same time, so a plain form-based content
              // editor is the easiest way to type things in.
              { id: "content",   label: t("website_editor.tab_content", { defaultValue: "Content" }),  icon: FileText, mobileOnly: true },
              { id: "design",    label: t("website_editor.tab_design", { defaultValue: "Design" }),    icon: Palette,  mobileOnly: false },
              { id: "pages",     label: t("website_editor.tab_pages", { defaultValue: "Pages" }),     icon: FileText, mobileOnly: false },
              { id: "animation", label: t("website_editor.tab_animation", { defaultValue: "Animation" }), icon: Sparkles, mobileOnly: false },
              { id: "settings",  label: t("website_editor.tab_settings", { defaultValue: "Settings" }),  icon: Settings, mobileOnly: false },
            ] as const).map((tab) => {
              const TabIcon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${tab.mobileOnly ? "lg:hidden " : ""}flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
                >
                  <TabIcon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mobile-only Content editor — phones can't show preview + sidebar
            side-by-side, so this is a plain form for the highest-impact
            text fields. Updates flow through the existing customText jsonb
            so the live preview reflects them when the user toggles back. */}
        {inTab("content") && (() => {
          const CONTENT_EMOJIS = [
            "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃",
            "😉", "😊", "😇", "🤩", "😗", "☺️", "😚", "😋", "😎", "🥲",
            "💍", "💐", "💒", "👰", "🤵", "💕", "💖", "❤️", "🌹", "🥂",
            "🍾", "🎉", "🎊", "✨", "💫", "🕊️", "🦋", "🌸", "📅", "✉️",
            "🌷", "🌺", "🌻", "🌼", "🍰", "🧁", "🎂", "🎁", "💌", "👑",
            "🥰", "😍", "😘", "💋", "🫶", "💗", "💓", "💞", "🧡", "💙",
            "🌙", "⭐", "🌟", "☀️", "🌈", "🌊", "🏖️", "✈️", "🎵", "🎶",
            "🍷", "🫖", "🎀", "🎈", "🪄", "📸", "🙏", "🌿", "🔮", "👫",
          ];
          const insertEmoji = (key: string, emoji: string, currentValue: string, onChange: (v: string) => void) => {
            const el = contentInputRefs.current[key];
            const start = el?.selectionStart ?? currentValue.length;
            const end = el?.selectionEnd ?? currentValue.length;
            onChange(currentValue.slice(0, start) + emoji + currentValue.slice(end));
            setEmojiFieldOpen(null);
            requestAnimationFrame(() => {
              if (el) {
                el.focus();
                el.setSelectionRange(start + emoji.length, start + emoji.length);
              }
            });
          };
          const EmojiGrid = ({ fieldKey, currentValue, onChange }: { fieldKey: string; currentValue: string; onChange: (v: string) => void }) => (
            <div className="mt-1.5 p-2 rounded-lg border border-border bg-background shadow-md">
              <div className="grid grid-cols-10 gap-0.5">
                {CONTENT_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="text-base leading-none p-1 rounded hover:bg-accent transition-colors"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertEmoji(fieldKey, emoji, currentValue, onChange)}
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          );
          return (
            <Section icon={<Type className="h-4 w-4" />} title={t("website_editor.section_content", { defaultValue: "Page content" })}>
              <div className="space-y-4">
                {([
                  { key: "_heroTagline",  label: t("website_editor.content_hero_tagline", { defaultValue: "Hero tagline (e.g. We're getting married)" }), placeholder: "We're getting married" },
                  { key: "_coupleName",   label: t("website_editor.content_couple_name", { defaultValue: "Couple name (overrides profile)" }), placeholder: "Alex & Jordan" },
                  { key: "_heroDate",     label: t("website_editor.content_hero_date", { defaultValue: "Hero date" }), placeholder: "Saturday, June 15, 2025" },
                  { key: "_announcement", label: t("website_editor.content_announcement", { defaultValue: "Announcement banner" }), placeholder: "" },
                ] as const).map(({ key, label, placeholder }) => {
                  const currentValue = record.customText[key] ?? "";
                  const onChange = (v: string) => update({ customText: { ...record.customText, [key]: v } });
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-muted-foreground">{label}</label>
                        <button
                          type="button"
                          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title={t("text_toolbar.insert-emoji", { defaultValue: "Insert emoji" })}
                          onClick={() => setEmojiFieldOpen(emojiFieldOpen === key ? null : key)}
                        >
                          <Smile className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <Input
                        ref={(el) => { contentInputRefs.current[key] = el; }}
                        value={currentValue}
                        placeholder={placeholder}
                        onChange={(e) => onChange(e.target.value)}
                      />
                      {emojiFieldOpen === key && <EmojiGrid fieldKey={key} currentValue={currentValue} onChange={onChange} />}
                    </div>
                  );
                })}
                {([
                  { key: "welcome",        label: t("website_editor.content_welcome", { defaultValue: "Welcome message" }) },
                  { key: "story",          label: t("website_editor.content_story", { defaultValue: "Our story" }) },
                  { key: "rsvp_subtitle",  label: t("website_editor.content_rsvp_subtitle", { defaultValue: "RSVP subtitle" }) },
                  { key: "rsvp_thankyou",  label: t("website_editor.content_rsvp_thankyou", { defaultValue: "RSVP thank-you message" }) },
                ] as const).map(({ key, label }) => {
                  const currentValue = record.customText[key] ?? "";
                  const onChange = (v: string) => update({ customText: { ...record.customText, [key]: v } });
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-muted-foreground">{label}</label>
                        <button
                          type="button"
                          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title={t("text_toolbar.insert-emoji", { defaultValue: "Insert emoji" })}
                          onClick={() => setEmojiFieldOpen(emojiFieldOpen === key ? null : key)}
                        >
                          <Smile className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <textarea
                        ref={(el) => { contentInputRefs.current[key] = el; }}
                        value={currentValue}
                        onChange={(e) => onChange(e.target.value)}
                        rows={3}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                      {emojiFieldOpen === key && <EmojiGrid fieldKey={key} currentValue={currentValue} onChange={onChange} />}
                    </div>
                  );
                })}
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    {t("website_editor.content_rsvp_deadline", { defaultValue: "RSVP deadline" })}
                  </label>
                  <Input
                    value={record.customText.rsvp_deadline ?? ""}
                    placeholder="May 1, 2025"
                    onChange={(e) => update({ customText: { ...record.customText, rsvp_deadline: e.target.value } })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("website_editor.content_help", { defaultValue: "Tap Preview at the bottom to see your changes. Save when you're happy." })}
                </p>
              </div>
            </Section>
          );
        })()}

        {/* Text tools */}
        {inTab("design") && <Section icon={<Type className="h-4 w-4" />} title={t("website_editor.section_text_tools", { defaultValue: "Text Tools" })}>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t("website_editor.text_tools_hint", { defaultValue: "Right-click anywhere on the preview to add a new text box." })}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start gap-2 text-destructive hover:text-destructive"
              onClick={() => {
                if (!window.confirm("Reset all text edits, styles, and positions to defaults?")) return;
                update({ customText: {}, textStyles: {}, textPositions: {} });
              }}
            >
              <X className="h-3.5 w-3.5" />
              {t("website_editor.reset_all_to_default", { defaultValue: "Reset all to default" })}
            </Button>
          </div>
        </Section>}

        {/* Theme picker */}
        {inTab("design") && <Section icon={<Palette className="h-4 w-4" />} title={t("website_editor.section_theme", { defaultValue: "Theme" })}>
          <div className="grid grid-cols-2 gap-2">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => applyTheme(theme.id)}
                className={`text-left p-3 rounded-md border transition-all ${record.theme === theme.id ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50"}`}
              >
                <div className="flex gap-1 mb-2">
                  <div className="w-4 h-4 rounded-full" style={{ background: theme.primary }} />
                  <div className="w-4 h-4 rounded-full" style={{ background: theme.secondary }} />
                  <div className="w-4 h-4 rounded-full" style={{ background: theme.neutral }} />
                </div>
                <div className="text-xs font-medium">{theme.name}</div>
              </button>
            ))}
          </div>
        </Section>}

        {/* Colors */}
        {inTab("design") && <Section icon={<Palette className="h-4 w-4" />} title={t("website_editor.section_colors", { defaultValue: "Colors" })}>
          <div className="grid grid-cols-2 gap-3">
            <ColorField label={t("website_editor.color_focus_ring", { defaultValue: "Focus Ring" })}   value={record.colorPalette.primary}   onChange={(v) => update({ colorPalette: { ...record.colorPalette, primary: v }, accentColor: v })} />
            <ColorField label={t("website_editor.color_background", { defaultValue: "Background" })} value={record.colorPalette.background} onChange={(v) => update({ colorPalette: { ...record.colorPalette, background: v } })} />
            <ColorField
              label={t("website_editor.color_pages", { defaultValue: "Pages" })}
              value={record.customText._navLinkColor || record.colorPalette.text}
              onChange={(v) => update({ customText: { ...record.customText, _navLinkColor: v } })}
            />
            <ColorField
              label={t("website_editor.color_couple_names", { defaultValue: "Header (Names)" })}
              value={record.customText._navCoupleColor || record.colorPalette.primary}
              onChange={(v) => update({ customText: { ...record.customText, _navCoupleColor: v } })}
            />
            <ColorField
              label={t("website_editor.color_footer", { defaultValue: "Footer" })}
              value={record.customText._footerColor || record.colorPalette.primary}
              onChange={(v) => update({ customText: { ...record.customText, _footerColor: v } })}
            />
            {/* Welcome page keeps its own background picker. Every other
                non-home section (Story, Schedule, Travel, Registry, Wedding
                Party, Gallery, FAQ, RSVP) shares a single Sections BG so the
                user can recolour them all in one shot. */}
            <ColorField
              label={t("website_editor.bg_welcome", { defaultValue: "Welcome BG" })}
              value={record.customText._welcomeBg || record.colorPalette.background}
              onChange={(v) => update({ customText: { ...record.customText, _welcomeBg: v } })}
            />
            <ColorField
              label={t("website_editor.bg_sections", { defaultValue: "Body BG" })}
              value={record.customText._sectionsBg || record.colorPalette.background}
              onChange={(v) => update({ customText: { ...record.customText, _sectionsBg: v } })}
            />
          </div>
        </Section>}

        {/* Sections */}
        {inTab("pages") && <Section icon={<ToggleLeft className="h-4 w-4" />} title={t("website_editor.section_sections", { defaultValue: "Sections" })}>
          <div className="space-y-2.5">
            {SECTION_LIST.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.id} className="flex items-center justify-between gap-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm cursor-pointer">{s.label}</Label>
                  </div>
                  <Switch
                    checked={record.sectionsEnabled[s.id]}
                    onCheckedChange={(checked) => {
                      update({ sectionsEnabled: { ...record.sectionsEnabled, [s.id]: checked } });
                      // Jump the preview to the section the user just clicked,
                      // regardless of whether they toggled it on or off, so
                      // they're always looking at what their click affected.
                      setEditorSection(s.id);
                      previewRef.current?.scrollTo({ top: 0, behavior: "auto" });
                    }}
                  />
                </div>
              );
            })}
          </div>
        </Section>}

        {/* Hero elements — toggles for the rows that drag-to-trash hides
            (date, venue, countdown). Lets the user bring them back without
            needing to hit Undo. */}
        {inTab("pages") && <Section icon={<ToggleLeft className="h-4 w-4" />} title={t("website_editor.section_hero_elements", { defaultValue: "Home Elements" })}>
          <div className="space-y-2.5">
            {[
              { key: "_announcementHidden", label: t("website_editor.hero_announcement", { defaultValue: "Announcement Banner" }) },
              { key: "_heroTaglineHidden", label: "Tagline (\"We're getting married\")" },
              { key: "_coupleName", label: t("website_editor.hero_couple_names", { defaultValue: "Couple Names" }) },
              { key: "_heroDateRow", label: t("website_editor.hero_date_row", { defaultValue: "Wedding Date" }) },
              { key: "_heroDateIcon", label: t("website_editor.hero_date_icon", { defaultValue: "Date Calendar Icon" }) },
              { key: "_heroVenueRow", label: t("website_editor.hero_venue_row", { defaultValue: "Venue Address" }) },
              { key: "_heroVenueIcon", label: t("website_editor.hero_venue_icon", { defaultValue: "Venue Pin Icon" }) },
              { key: "_countdown", label: t("website_editor.hero_countdown", { defaultValue: "Countdown Timer" }) },
              { key: "_addToCalendarRow", label: t("website_editor.hero_add_to_calendar", { defaultValue: "Add to Calendar Button" }) },
            ].map((row) => {
              const isHidden = isEditableHiddenMarker(record.customText[row.key]);
              return (
                <div key={row.key} className="flex items-center justify-between gap-3 py-1.5">
                  <Label className="text-sm cursor-pointer">{row.label}</Label>
                  <Switch
                    checked={!isHidden}
                    onCheckedChange={(checked) => {
                      patchRecord((prev) => {
                        const ct = { ...prev.customText };
                        const tp = { ...(prev.textPositions ?? {}) };
                        if (checked) {
                          delete ct[row.key];
                          // Drop any stale drag offset so the element returns
                          // to its centered default when re-enabled.
                          delete tp[row.key];
                        } else {
                          ct[row.key] = EDITABLE_HIDDEN_MARKER;
                        }
                        return { customText: ct, textPositions: tp };
                      });
                      // Hero elements all live on the home page — jump there
                      // on any click so the user always sees the result.
                      setEditorSection("home");
                      previewRef.current?.scrollTo({ top: 0, behavior: "auto" });
                    }}
                  />
                </div>
              );
            })}
            <div className="flex items-center justify-between gap-3 py-1.5">
              <Label className="text-sm cursor-pointer">
                {t("website_editor.hero_announcement_marquee", {
                  defaultValue: "Announcement Marquee Scroll",
                })}
              </Label>
              <Switch
                checked={record.customText._announcementMarquee !== "false"}
                onCheckedChange={(checked) => {
                  update({
                    customText: {
                      ...record.customText,
                      _announcementMarquee: checked ? "" : "false",
                    },
                  });
                  setEditorSection("home");
                  previewRef.current?.scrollTo({ top: 0, behavior: "auto" });
                }}
              />
            </div>
          </div>
        </Section>}

        {/* Schedule event toggles */}
        {inTab("pages") && record.sectionsEnabled.travel && <Section icon={<MapPin className="h-4 w-4" />} title="Travel & Venue Items">
          <div className="space-y-2.5">
            {[
              { key: "_travelVenueHidden",  label: "Venue" },
              { key: "_travelHotelHidden",  label: "Hotel" },
              { key: "_travelNotesHidden",  label: "Travel Notes" },
            ].map((row) => {
              const isHidden = isEditableHiddenMarker(record.customText[row.key]);
              return (
                <div key={row.key} className="flex items-center justify-between gap-3 py-1.5">
                  <Label className="text-sm cursor-pointer">{row.label}</Label>
                  <Switch
                    checked={!isHidden}
                    onCheckedChange={(checked) => {
                      update({ customText: { ...record.customText, [row.key]: checked ? "" : EDITABLE_HIDDEN_MARKER } });
                      if (checked) {
                        setEditorSection("travel");
                        previewRef.current?.scrollTo({ top: 0, behavior: "auto" });
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>
        </Section>}

        {inTab("pages") && record.sectionsEnabled.schedule && <Section icon={<Clock className="h-4 w-4" />} title="Schedule Events">
          <div className="space-y-4">
            {[
              { hiddenKey: "_scheduleCeremonyHidden",  timeKey: "_scheduleCeremonyTime",  labelKey: "_scheduleCeremonyLabel",  defaultLabel: "Ceremony" },
              { hiddenKey: "_scheduleCocktailHidden",  timeKey: "_scheduleCocktailTime",  labelKey: "_scheduleCocktailLabel",  defaultLabel: "Cocktail Hour" },
              { hiddenKey: "_scheduleReceptionHidden", timeKey: "_scheduleReceptionTime", labelKey: "_scheduleReceptionLabel", defaultLabel: "Reception" },
            ].map((row) => {
              const isHidden = isEditableHiddenMarker(record.customText[row.hiddenKey]);
              return (
                <div key={row.hiddenKey} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-sm font-medium cursor-pointer text-foreground">{row.defaultLabel}</Label>
                    <Switch
                      checked={!isHidden}
                      onCheckedChange={(checked) => {
                        update({ customText: { ...record.customText, [row.hiddenKey]: checked ? "" : EDITABLE_HIDDEN_MARKER } });
                        // Always jump to the schedule page on click so the user
                        // sees the row they just toggled.
                        setEditorSection("schedule");
                        previewRef.current?.scrollTo({ top: 0, behavior: "auto" });
                      }}
                    />
                  </div>
                  {!isHidden && (
                    <div className="grid grid-cols-[auto_1fr] gap-2">
                      <Input
                        type="time"
                        className="h-9 text-sm"
                        value={record.customText[row.timeKey] ?? ""}
                        onChange={(e) => update({ customText: { ...record.customText, [row.timeKey]: e.target.value } })}
                        aria-label={`${row.defaultLabel} time`}
                      />
                      <Input
                        type="text"
                        className="h-9 text-sm"
                        placeholder={row.defaultLabel}
                        value={record.customText[row.labelKey] ?? ""}
                        onChange={(e) => update({ customText: { ...record.customText, [row.labelKey]: e.target.value } })}
                        aria-label={`${row.defaultLabel} label`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>}

        {/* FAQ items — structured Q/A entry, ~easier than typing the whole
            FAQ block as a single paragraph. Stored as JSON in
            customText.faq_items_json for backward compat with the legacy
            single-string customText.faq. */}
        {inTab("pages") && record.sectionsEnabled.faq && <Section icon={<HelpCircle className="h-4 w-4" />} title={t("website_editor.section_faq_items", { defaultValue: "FAQ Questions" })}>
          {(() => {
            type FaqItem = { question: string; answer: string };
            const QUESTION_MAX = 400;
            const ANSWER_MAX = 2000;
            let items: FaqItem[] = [];
            try {
              const raw = record.customText.faq_items_json;
              if (raw) items = JSON.parse(raw) as FaqItem[];
              if (!Array.isArray(items)) items = [];
            } catch { items = []; }

            const saveItems = (next: FaqItem[]) => {
              patchRecord((prev) => ({
                customText: { ...prev.customText, faq_items_json: JSON.stringify(next) },
              }));
            };

            const updateItem = (i: number, patch: Partial<FaqItem>) => {
              const next = items.slice();
              next[i] = { ...next[i], ...patch } as FaqItem;
              saveItems(next);
            };

            const removeItem = (i: number) => {
              const next = items.slice();
              next.splice(i, 1);
              saveItems(next);
            };

            const addItem = () => {
              saveItems([...items, { question: "", answer: "" }]);
            };

            return (
              <div className="space-y-4">
                {items.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("website_editor.faq_empty", { defaultValue: "No FAQ questions yet. Add your first one below." })}
                  </p>
                )}
                {items.map((item, i) => (
                  <div key={i} className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-xs">
                          {t("website_editor.faq_question", { defaultValue: "Question" })} <span className="text-destructive">*</span>
                        </Label>
                        <button
                          type="button"
                          onClick={() => removeItem(i)}
                          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                          title={t("website_editor.faq_remove", { defaultValue: "Remove question" })}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <Input
                        value={item.question}
                        onChange={(e) => updateItem(i, { question: e.target.value.slice(0, QUESTION_MAX) })}
                        placeholder={t("website_editor.faq_question_placeholder", { defaultValue: "What's the dress code?" })}
                        className="text-sm"
                      />
                      <p className="text-[10px] text-muted-foreground text-right mt-0.5">
                        {item.question.length}/{QUESTION_MAX}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">
                        {t("website_editor.faq_answer", { defaultValue: "Answer" })} <span className="text-destructive">*</span>
                      </Label>
                      <textarea
                        value={item.answer}
                        onChange={(e) => updateItem(i, { answer: e.target.value.slice(0, ANSWER_MAX) })}
                        placeholder={t("website_editor.faq_answer_placeholder", { defaultValue: "Formal attire keeps the evening elegant…" })}
                        rows={4}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                      />
                      <p className="text-[10px] text-muted-foreground text-right mt-0.5">
                        {item.answer.length}/{ANSWER_MAX}
                      </p>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  {t("website_editor.faq_add", { defaultValue: "Add Question" })}
                </Button>
              </div>
            );
          })()}
        </Section>}

        {/* FAQ style — font, size, color, bold/italic for questions and answers */}
        {inTab("pages") && record.sectionsEnabled.faq && <Section icon={<HelpCircle className="h-4 w-4" />} title="FAQ Style">
          {(["question", "answer"] as const).map((part) => {
            const fontKey  = part === "question" ? "_faqQuestionFont"   : "_faqAnswerFont";
            const sizeKey  = part === "question" ? "_faqQuestionSize"   : "_faqAnswerSize";
            const colorKey = part === "question" ? "_faqQuestionColor"  : "_faqAnswerColor";
            const boldKey  = part === "question" ? "_faqQuestionBold"   : "_faqAnswerBold";
            const italicKey = part === "question" ? "_faqQuestionItalic" : "_faqAnswerItalic";
            const defaultColor = part === "question" ? record.colorPalette.primary : record.colorPalette.text;
            const sizeVal = record.customText[sizeKey];
            return (
              <div key={part} className="mb-4">
                <p className="text-xs font-semibold mb-2 capitalize">{part}s</p>
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Font</Label>
                    <select
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      value={record.customText[fontKey] ?? ""}
                      onChange={(e) => update({ customText: { ...record.customText, [fontKey]: e.target.value } })}
                    >
                      <option value="">Theme default</option>
                      {["Georgia","Playfair Display","Cormorant Garamond","Times New Roman","Plus Jakarta Sans","Inter","Lato","Montserrat","Raleway","Lora","Merriweather","Dancing Script","Cinzel"].map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">
                      Size{sizeVal ? `: ${sizeVal}px` : " (default)"}
                    </Label>
                    <input
                      type="range"
                      min={part === "question" ? 13 : 11}
                      max={part === "question" ? 28 : 22}
                      value={sizeVal ?? (part === "question" ? "18" : "14")}
                      onChange={(e) => update({ customText: { ...record.customText, [sizeKey]: e.target.value } })}
                      className="w-full"
                    />
                  </div>
                  <ColorField
                    label="Color"
                    value={record.customText[colorKey] || defaultColor}
                    onChange={(v) => update({ customText: { ...record.customText, [colorKey]: v } })}
                  />
                  <div className="flex items-center gap-4 pt-1">
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`faq-${part}-bold`}
                        checked={record.customText[boldKey] === "true"}
                        onCheckedChange={(c) => update({ customText: { ...record.customText, [boldKey]: c ? "true" : "" } })}
                      />
                      <Label htmlFor={`faq-${part}-bold`} className="text-xs cursor-pointer">Bold</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`faq-${part}-italic`}
                        checked={record.customText[italicKey] === "true"}
                        onCheckedChange={(c) => update({ customText: { ...record.customText, [italicKey]: c ? "true" : "" } })}
                      />
                      <Label htmlFor={`faq-${part}-italic`} className="text-xs cursor-pointer">Italic</Label>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </Section>}

        {/* Inline-edit hint */}
        {inTab("design") && <Section icon={<FileText className="h-4 w-4" />} title={t("website_editor.section_edit_text", { defaultValue: "Edit Text" })}>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("website_editor.edit_text_hint_1", { defaultValue: "Click any heading or paragraph in the preview to edit it directly. Press" })} <strong>{t("website_editor.edit_text_hint_enter", { defaultValue: "Enter" })}</strong> {t("website_editor.edit_text_hint_2", { defaultValue: "on a heading or click outside to commit. Use this sidebar for theme, layout, photos, and section toggles." })}
          </p>
        </Section>}


        {/* Hero animation */}
        {inTab("animation") && <Section icon={<Sparkles className="h-4 w-4" />} title={t("website_editor.section_hero_animation", { defaultValue: "Hero Animation" })}>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">{t("website_editor.style_label", { defaultValue: "Style" })}</Label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={record.customText._heroAnimation ?? "static"}
                onChange={(e) => update({ customText: { ...record.customText, _heroAnimation: e.target.value } })}
              >
                <option value="static">{t("website_editor.anim_static", { defaultValue: "Static (single image)" })}</option>
                <option value="slideshow">{t("website_editor.anim_slideshow", { defaultValue: "Slideshow (cycle photos)" })}</option>
                <option value="kenburns">{t("website_editor.anim_kenburns", { defaultValue: "Ken Burns (slow zoom)" })}</option>
                <option value="pan-lr">{t("website_editor.anim_pan_lr", { defaultValue: "Pan left-to-right" })}</option>
                <option value="marquee">{t("website_editor.anim_marquee", { defaultValue: "Marquee (continuous scroll)" })}</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">{t("website_editor.speed_label", { defaultValue: "Speed" })}</Label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={record.customText._heroAnimationSpeed ?? "medium"}
                onChange={(e) => update({ customText: { ...record.customText, _heroAnimationSpeed: e.target.value } })}
              >
                <option value="slow">{t("website_editor.speed_slow", { defaultValue: "Slow" })}</option>
                <option value="medium">{t("website_editor.speed_medium", { defaultValue: "Medium" })}</option>
                <option value="fast">{t("website_editor.speed_fast", { defaultValue: "Fast" })}</option>
              </select>
            </div>
            {(record.customText._heroAnimation === "slideshow" || record.customText._heroAnimation === "marquee") && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Uses your hero image and any photos added in the <strong>Home Photos</strong> section in the Design tab. Gallery photos stay in the gallery only.
              </p>
            )}
          </div>
        </Section>}

        {/* Gallery animation */}
        {inTab("animation") && <Section icon={<ImageIcon className="h-4 w-4" />} title={t("website_editor.section_gallery_animation", { defaultValue: "Gallery Animation" })}>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">{t("website_editor.style_label", { defaultValue: "Style" })}</Label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={record.customText._galleryAnimation ?? "grid"}
                onChange={(e) => update({ customText: { ...record.customText, _galleryAnimation: e.target.value } })}
              >
                <option value="grid">Puzzle (photos fade in one by one)</option>
                <option value="slideshow">{t("website_editor.gallery_anim_slideshow", { defaultValue: "Slideshow (fade through photos)" })}</option>
                <option value="marquee">{t("website_editor.gallery_anim_marquee", { defaultValue: "Marquee (continuous scroll)" })}</option>
              </select>
            </div>
            {(record.customText._galleryAnimation === "slideshow" || record.customText._galleryAnimation === "marquee") && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">{t("website_editor.speed_label", { defaultValue: "Speed" })}</Label>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={record.customText._galleryAnimationSpeed ?? "medium"}
                  onChange={(e) => update({ customText: { ...record.customText, _galleryAnimationSpeed: e.target.value } })}
                >
                  <option value="slow">{t("website_editor.speed_slow", { defaultValue: "Slow" })}</option>
                  <option value="medium">{t("website_editor.speed_medium", { defaultValue: "Medium" })}</option>
                  <option value="fast">{t("website_editor.speed_fast", { defaultValue: "Fast" })}</option>
                </select>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {t("website_editor.gallery_anim_hint", { defaultValue: "Choose how gallery photos display. Guests can still click any photo to open the full lightbox." })}
            </p>
          </div>
        </Section>}

        {/* Photo effects */}
        {inTab("design") && <Section icon={<ImageIcon className="h-4 w-4" />} title={t("website_editor.section_photo_effects", { defaultValue: "Photo Effects" })}>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground mb-1 block">{t("website_editor.filter_label", { defaultValue: "Filter (applied to hero + gallery)" })}</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "none", label: t("website_editor.filter_original", { defaultValue: "Original" }) },
                { id: "bw", label: t("website_editor.filter_bw", { defaultValue: "B&W" }) },
                { id: "sepia", label: t("website_editor.filter_sepia", { defaultValue: "Sepia" }) },
                { id: "vintage", label: t("website_editor.filter_vintage", { defaultValue: "Vintage" }) },
                { id: "soft", label: t("website_editor.filter_soft", { defaultValue: "Soft" }) },
                { id: "cool", label: t("website_editor.filter_cool", { defaultValue: "Cool" }) },
                { id: "warm", label: t("website_editor.filter_warm", { defaultValue: "Warm" }) },
                { id: "dramatic", label: t("website_editor.filter_dramatic", { defaultValue: "Dramatic" }) },
                { id: "noir", label: t("website_editor.filter_noir", { defaultValue: "Noir" }) },
              ].map((f) => {
                const active = (record.customText._photoFilter ?? "none") === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => update({ customText: { ...record.customText, _photoFilter: f.id } })}
                    className={`px-2 py-1.5 rounded-md border text-xs transition-all ${active ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/40"}`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
              The lightbox always shows the original photo, so guests can still see the unfiltered version when they tap.
            </p>
          </div>
        </Section>}

        {/* Home Page Photos — primary background + extras for slideshow/marquee */}
        {inTab("design") && <Section icon={<ImageIcon className="h-4 w-4" />} title="Home Page Photos">
          <p className="text-[11px] text-muted-foreground mb-2 leading-relaxed">
            Photos shown on the home page background. Add multiple for slideshows and marquees. These are separate from the Gallery section.
          </p>
          <div className="grid grid-cols-3 gap-2 mb-3 items-start">
            {record.heroImage && (
              <div className="relative aspect-square rounded-md overflow-hidden">
                <AuthMediaImage
                  src={record.heroImage}
                  alt="Main"
                  className="w-full h-full object-cover"
                  style={(() => {
                    const focal = readHeroFocals()[record.heroImage] || "center";
                    const z = readHeroZooms()[record.heroImage] ?? 1;
                    return {
                      objectPosition: focal,
                      transformOrigin: focal,
                      transform: z === 1 ? undefined : `scale(${z})`,
                    };
                  })()}
                />
                <button
                  onClick={() => setPositioningUrl(record.heroImage)}
                  className="absolute bottom-1 left-1 p-1 rounded-full bg-black/60 hover:bg-black/80 text-white"
                  title="Position in frame"
                >
                  <Move className="h-3 w-3" />
                </button>
                <button
                  onClick={() => {
                    const url = record.heroImage;
                    update({ heroImage: null });
                    if (url) {
                      dropHeroFocal(url);
                      dropHeroZoom(url);
                    }
                  }}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/60 hover:bg-black/80 text-white"
                  title="Remove main photo"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {(record.heroImages ?? []).map((img, i) => (
              <div key={i} className="relative aspect-square rounded-md overflow-hidden">
                <AuthMediaImage
                  src={img.url}
                  alt=""
                  className="w-full h-full object-cover"
                  style={(() => {
                    const focal = readHeroFocals()[img.url] || "center";
                    const z = readHeroZooms()[img.url] ?? 1;
                    return {
                      objectPosition: focal,
                      transformOrigin: focal,
                      transform: z === 1 ? undefined : `scale(${z})`,
                    };
                  })()}
                />
                <button
                  onClick={() => setPositioningUrl(img.url)}
                  className="absolute bottom-1 left-1 p-1 rounded-full bg-black/60 hover:bg-black/80 text-white"
                  title="Position in frame"
                >
                  <Move className="h-3 w-3" />
                </button>
                <button
                  onClick={() => {
                    const url = img.url;
                    removeHeroImage(i);
                    dropHeroFocal(url);
                    dropHeroZoom(url);
                  }}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/60 hover:bg-black/80 text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <label className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-md border-2 border-dashed border-border cursor-pointer hover:border-primary/50 transition-colors text-sm text-muted-foreground">
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) startHeroCropFlow(e.target.files);
                e.target.value = "";
              }}
              disabled={upload.isUploading}
            />
            {upload.isUploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</> : <>Add photos</>}
          </label>
          {/* Cover (default) crops the photo to fill the hero. Contain shows
              the whole photo with the site's background color filling the bars. */}
          <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
            <div className="min-w-0">
              <Label className="text-xs font-medium">Show whole photo</Label>
              <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                Off: photo fills the frame and may crop. On: shows the entire photo with side bars.
              </p>
            </div>
            <Switch
              checked={record.customText._heroFit === "contain"}
              onCheckedChange={(checked) => update({ customText: { ...record.customText, _heroFit: checked ? "contain" : "" } })}
            />
          </div>
        </Section>}

        {/* Gallery */}
        {inTab("design") && <Section icon={<ImageIcon className="h-4 w-4" />} title="Gallery">
          <div className="grid grid-cols-3 gap-2 mb-3 items-start">
            {record.galleryImages.map((img, i) => (
              <div key={i} className="flex flex-col gap-1">
                <div className="relative aspect-square rounded-md overflow-hidden">
                  <AuthMediaImage
                    src={img.url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => removeGalleryImage(i)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/60 hover:bg-black/80 text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <input
                  value={img.caption ?? ""}
                  onChange={(e) => {
                    const next = record.galleryImages.map((im, idx) =>
                      idx === i ? { ...im, caption: e.target.value || undefined } : im
                    );
                    update({ galleryImages: next });
                  }}
                  placeholder={t("website_editor.caption_placeholder", { defaultValue: "Caption…" })}
                  className="w-full text-[10px] border border-border rounded px-1.5 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 truncate"
                />
              </div>
            ))}
          </div>
          <label className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-md border-2 border-dashed border-border cursor-pointer hover:border-primary/50 transition-colors text-sm text-muted-foreground">
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleGalleryUpload(e.target.files);
                e.target.value = "";
              }}
              disabled={upload.isUploading}
            />
            {upload.isUploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</> : <>Add photos</>}
          </label>
        </Section>}

        {/* Registry Links */}
        {inTab("pages") && <Section icon={<Link2 className="h-4 w-4" />} title="Registry Links">
          <RegistryLinksEditor
            links={parseRegistryLinks(record.customText._registryLinks)}
            onChange={(next) =>
              update({ customText: { ...record.customText, _registryLinks: JSON.stringify(next) } })
            }
          />
        </Section>}

        {/* Wedding Party — read-only on the website editor; managed in the portal */}
        {inTab("pages") && <Section icon={<Heart className="h-4 w-4" />} title="Wedding Party">
          {record.portalParty && record.portalParty.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-50 dark:bg-emerald-950/30 text-xs text-emerald-800 dark:text-emerald-200">
                <Users className="h-3.5 w-3.5 flex-shrink-0" />
                <span>Synced from your Wedding Party portal ({record.portalParty.length} member{record.portalParty.length !== 1 ? "s" : ""})</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Members are managed in the <strong>Wedding Party</strong> section of this portal. Changes there sync here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5 flex-shrink-0" />
                <span>No wedding party members yet</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Add and edit members in the <strong>Wedding Party</strong> section of this portal — they sync here automatically.
              </p>
              <Button size="sm" variant="outline" asChild>
                <a href="/wedding-party">Open Wedding Party</a>
              </Button>
            </div>
          )}
        </Section>}


        {/* RSVP settings — responses are tracked in the portal, not here */}
        {inTab("pages") && record.sectionsEnabled.rsvp && (
          <Section icon={<Heart className="h-4 w-4" />} title={t("website_editor.section_rsvp_settings", { defaultValue: "RSVP Settings" })}>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">RSVP deadline (shown to guests)</Label>
                <Input
                  value={record.customText.rsvp_deadline ?? ""}
                  onChange={(e) =>
                    update({ customText: { ...record.customText, rsvp_deadline: e.target.value } })
                  }
                  placeholder={t("website_editor.rsvp_deadline_placeholder", { defaultValue: "e.g. October 1, 2025" })}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Thank-you message (shown after submit)</Label>
                <Input
                  value={record.customText.rsvp_thankyou ?? ""}
                  onChange={(e) =>
                    update({ customText: { ...record.customText, rsvp_thankyou: e.target.value } })
                  }
                  placeholder={t("website_editor.rsvp_thankyou_placeholder", { defaultValue: "We'll send you more details closer to the day." })}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </Section>
        )}

        {/* Website visibility */}
        {inTab("settings") && (
          <Section icon={<Globe className="h-4 w-4" />} title={t("website_editor.section_visibility", { defaultValue: "Website Visibility" })}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium">{record.published ? t("website_editor.live", { defaultValue: "Live" }) : t("website_editor.not_published", { defaultValue: "Not published" })}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {record.published
                    ? t("website_editor.visibility_public", { defaultValue: "Your site is viewable by anyone with the link." })
                    : t("website_editor.visibility_draft", { defaultValue: "Your site is in draft. Guests can't view it yet." })}
                </p>
              </div>
              <Button size="sm" variant={record.published ? "outline" : "default"} onClick={handlePublish} disabled={publishing}>
                {publishing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                {record.published ? t("website_editor.unpublish", { defaultValue: "Unpublish" }) : t("website_editor.publish", { defaultValue: "Publish" })}
              </Button>
            </div>
          </Section>
        )}

        {/* Website URL */}
        {inTab("settings") && <Section icon={<Link2 className="h-4 w-4" />} title={t("website_editor.section_url", { defaultValue: "Website URL" })}>
          <SlugEditor
            slug={record.slug}
            published={record.published}
            onSaved={(newSlug, lastUpdated) =>
              setRecord((prev) => prev ? { ...prev, slug: newSlug, lastUpdated } : prev)
            }
          />
        </Section>}

        {/* Password */}
        {inTab("settings") && <Section icon={<Lock className="h-4 w-4" />} title={t("website_editor.section_password", { defaultValue: "Password Protection" })}>
          {record.passwordEnabled ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-800 dark:text-amber-200">
                <Lock className="h-3.5 w-3.5" /> Password is set
              </div>
              <Button size="sm" variant="outline" onClick={handleClearPassword}>
                Remove password
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder={t("website_editor.password_placeholder", { defaultValue: "Optional password" })}
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  dirtyRef.current = true;
                  setDirty(true);
                }}
                className="text-sm"
              />
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-2">
            When set, guests must enter this password before viewing the site.
          </p>
        </Section>}
      </aside>

      {/* Drag handle to resize sidebar */}
      <div
        className="hidden lg:flex w-1.5 cursor-col-resize bg-border hover:bg-primary/40 flex-shrink-0 transition-colors items-center justify-center"
        onMouseDown={(e) => {
          dragState.current = { active: true, startX: e.clientX, startW: sidebarWidth };
          e.preventDefault();
        }}
        title={t("website_editor.drag_to_resize", { defaultValue: "Drag to resize" })}
      />

      {/* Live preview — desktop only; mobile renders its own copy at the top. */}
      <main
        ref={previewRef}
        className="flex-1 overflow-y-auto bg-muted/20 pb-0 hidden lg:block"
        onContextMenu={(e) => {
          e.preventDefault();
          const rect = canvasRef.current?.getBoundingClientRect();
          setCtxMenu({
            x: e.clientX,
            y: e.clientY,
            canvasX: rect ? e.clientX - rect.left : 0,
            canvasY: rect ? e.clientY - rect.top : 0,
          });
        }}
        onClick={() => { if (ctxMenu) setCtxMenu(null); }}
      >
        <div className="sticky top-0 z-10 px-4 py-2 bg-background/80 backdrop-blur border-b text-xs flex items-center justify-between gap-3 flex-wrap">
          <span style={{ color: "#D4A017" }}>
            {t("website_editor.live_preview_label", { defaultValue: "Live preview" })}
          </span>
          {record.published && (
            <button
              type="button"
              onClick={() => setUrlModalOpen(true)}
              className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-4 hover:opacity-80 transition-opacity whitespace-nowrap"
              style={{ color: "#D4A017" }}
            >
              <Link2 className="h-3 w-3" />
              {t("website_editor.custom_url_cta", { defaultValue: "Click here to get your custom website URL" })}
            </button>
          )}
        </div>
        <div ref={canvasRef} className="bg-white relative">
          <WebsiteRenderer
            data={livePreview!}
            editable
            // Page-per-section navigation — same flow guests will see — so the
            // editor preview matches what a guest gets when they click through.
            slug={record.slug ?? ""}
            previewMode
            scrollContainer={previewRef.current}
            currentSection={editorSection}
            onSectionChange={(id) => {
              setEditorSection(id);
              // Reset preview scroll to top when switching pages
              previewRef.current?.scrollTo({ top: 0, behavior: "auto" });
            }}
            onTextChange={(key, value) => patchRecord((prev) => ({ customText: { ...prev.customText, [key]: value } }))}
            onStyleChange={(key, style) => patchRecord((prev) => ({ textStyles: { ...(prev.textStyles ?? {}), [key]: style } }))}
            onPositionChange={(key, pos) => patchRecord((prev) => ({ textPositions: { ...(prev.textPositions ?? {}), [key]: pos } }))}
            onGalleryCaptionChange={(imageUrl, caption) => patchRecord((prev) => {
              const next = (prev.galleryImages ?? []).map((img) =>
                img.url === imageUrl ? { ...img, caption } : img,
              );
              return { galleryImages: next };
            })}
            onDeleteElement={handleDeleteElement}
          />
        </div>
      </main>




      {ctxMenu && (
        <div
          className="fixed z-[10000] rounded-md border border-border bg-popover shadow-lg py-1 min-w-[180px]"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex items-center gap-2"
            onClick={() => {
              // Scope new text boxes to the page where they were created.
              // This keeps generated content from appearing on every page.
              const section = editorSection || "home";
              const key = `_custom_${section}__${Date.now()}`;
              const insertAt = ctxMenu ? { x: ctxMenu.canvasX, y: ctxMenu.canvasY } : { x: 0, y: 0 };
              patchRecord((prev) => {
                const sectionOf = (k: string) => {
                  const m = k.match(/^_custom_([a-zA-Z]+)__\d+$/);
                  return m ? m[1] : "home";
                };
                const customCount = Object.keys(prev.customText).filter(
                  (k) => k.startsWith("_custom_") && sectionOf(k) === section,
                ).length;
                const baseLeft = 24;
                const baseTop = 120 + customCount * 56;
                return {
                  customText: { ...prev.customText, [key]: t("website_editor.new_text", { defaultValue: "New text — click to edit" }) },
                  textPositions: {
                    ...(prev.textPositions ?? {}),
                    [key]: { x: insertAt.x - baseLeft, y: insertAt.y - baseTop },
                  },
                };
              });
              setCtxMenu(null);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Insert text box
          </button>
        </div>
      )}

      {/* Hero photo crop dialog — runs once per uploaded photo so the user
          sees the whole image and chooses the crop themselves before the
          file is uploaded. */}
      <ImageCropDialog
        item={heroCropItem}
        initialAspect="wide"
        onComplete={onHeroCropComplete}
        onSkip={onHeroCropSkip}
        onCancelAll={onHeroCropCancelAll}
      />

      {/* Hero photo focal-point picker — lets the user choose which part of
          a home-page photo stays centered when the hero crops to fit. */}
      <HeroPhotoPositionDialog
        open={!!positioningUrl}
        imageUrl={positioningUrl}
        initialPosition={positioningUrl ? readHeroFocals()[positioningUrl] ?? null : null}
        initialZoom={positioningUrl ? readHeroZooms()[positioningUrl] ?? null : null}
        onCommit={(pos, zoom) => {
          if (positioningUrl) {
            writeHeroFocal(positioningUrl, pos);
            writeHeroZoom(positioningUrl, zoom);
          }
          setPositioningUrl(null);
        }}
        onClose={() => setPositioningUrl(null)}
      />

      {/* Custom URL modal — surfaces the existing SlugEditor in a focused
          popup so users can find the URL setting from the Pages tab, not
          just buried in Settings. */}
      {urlModalOpen && (
        <div
          className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setUrlModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: "#D4A017" }}>
                <Link2 className="h-4 w-4" />
                {t("website_editor.custom_url_modal_title", { defaultValue: "Your custom website URL" })}
              </h3>
              <button
                type="button"
                onClick={() => setUrlModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              {t("website_editor.custom_url_modal_help", { defaultValue: "Pick a URL guests will type in their browser. Stick to letters, numbers, and dashes." })}
            </p>
            <SlugEditor
              slug={record.slug}
              published={record.published}
              onSaved={(newSlug, lastUpdated) => {
                setRecord((prev) => prev ? { ...prev, slug: newSlug, lastUpdated } : prev);
              }}
            />
          </div>
        </div>
      )}

      {/* Guest preview overlay */}
      {previewOpen && (
        <div ref={setOverlayEl} className="fixed inset-0 z-[9999] bg-background overflow-auto">
          <div className="sticky top-3 right-0 z-[10000] flex justify-end px-4 pointer-events-none">
            <div className="flex items-center gap-2 pointer-events-auto bg-background/90 backdrop-blur border border-border rounded-full px-3 py-1.5 shadow-lg">
              {record.published ? (
                <span className="text-xs text-muted-foreground font-medium">{t("website_editor.preview", { defaultValue: "Preview" })}</span>
              ) : (
                <>
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-red-600 text-white rounded px-1.5 py-0.5">
                    {t("website_editor.preview", { defaultValue: "Preview" })}
                  </span>
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {t("website_editor.preview_hidden_notice", { defaultValue: "Your website is currently hidden and is not visible to guests." })}
                  </span>
                </>
              )}
              <div className="w-px h-4 bg-border" />
              <Button
                size="sm"
                variant={record.published ? "outline" : "default"}
                className="h-6 px-2 text-xs"
                onClick={handlePublish}
                disabled={publishing}
              >
                {publishing
                  ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  : <Globe className="h-3 w-3 mr-1" />}
                {record.published ? t("website_editor.unpublish", { defaultValue: "Unpublish" }) : t("website_editor.publish", { defaultValue: "Publish" })}
              </Button>
              {record.published && (
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={() => {
                    flushPendingEditableCommits();
                    requestAnimationFrame(() => saveNow(true).then(() => window.open(publicUrl, "_blank")));
                  }}
                >
                  Open live site ↗
                </button>
              )}
              <div className="w-px h-4 bg-border" />
              <button
                className="inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:text-primary transition-colors"
                onClick={() => setPreviewOpen(false)}
                title={t("website_editor.close_preview", { defaultValue: "Close preview" })}
              >
                <X className="h-3.5 w-3.5" />
                {t("website_editor.back_to_editor", { defaultValue: "Back to editor" })}
              </button>
            </div>
          </div>
          <WebsiteRenderer
            data={livePreview!}
            editable={false}
            slug={record.slug ?? ""}
            previewMode
            scrollContainer={overlayEl}
            currentSection={previewSection}
            onSectionChange={setPreviewSection}
          />
        </div>
      )}
    </div>
  );
}


// ---- slug editor ----

function SlugEditor({
  slug,
  published,
  onSaved,
}: {
  slug: string;
  published: boolean;
  onSaved: (newSlug: string, lastUpdated: string) => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(slug);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sanitize = (v: string) =>
    v.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/, "").replace(/-{2,}/g, "-").slice(0, 60);

  const save = async () => {
    const clean = sanitize(input);
    if (clean.length < 3) { setError(t("website_editor.slug_too_short", { defaultValue: "At least 3 characters required" })); return; }
    setSaving(true);
    setError(null);
    try {
      const r = await authFetch("/api/website/slug", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: clean }),
      });
      const body = await r.json() as { slug?: string; lastUpdated?: string; error?: string };
      if (!r.ok) { setError(body.error ?? t("website_editor.failed_update_url", { defaultValue: "Failed to update URL" })); return; }
      onSaved(body.slug!, body.lastUpdated!);
      setEditing(false);
      toast({ title: "Website URL updated!" });
    } catch {
      setError(t("website_editor.network_error", { defaultValue: "Network error. Please try again." }));
    } finally {
      setSaving(false);
    }
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const host = origin.replace(/^https?:\/\//, "");
  const fullUrl = `${origin}/w/${slug}`;
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-2.5">
      <div className="rounded-md bg-muted/40 border border-border/70 px-3 py-2 space-y-1">
        <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Guest website link</p>
        <div className="flex items-center gap-2">
          <p className="text-xs font-mono break-all flex-1">
            <span className="opacity-60">{host}/w/</span><span className="text-foreground">{slug}</span>
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-2 shrink-0"
            onClick={copyLink}
            title="Copy guest website link"
          >
            {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      </div>
      {published && (
        <p className="text-[11px] text-green-700 dark:text-green-400">
          URL is now locked to keep your shared link and QR code permanent.
        </p>
      )}
      {editing && !published ? (
        <div className="space-y-2">
          <div className="flex items-center text-xs font-mono rounded-md border border-border bg-background overflow-hidden focus-within:ring-2 focus-within:ring-primary/30">
            <span className="px-2.5 py-1.5 bg-muted text-muted-foreground border-r border-border whitespace-nowrap">{host}/w/</span>
            <input
              value={input}
              onChange={(e) => { setInput(sanitize(e.target.value)); setError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") void save(); if (e.key === "Escape") { setEditing(false); setInput(slug); setError(null); } }}
              placeholder="your-url-slug"
              autoFocus
              className="flex-1 h-8 px-2 bg-background text-sm font-mono focus:outline-none"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => void save()}
              disabled={saving || sanitize(input).length < 3}
              className="flex-1"
            >
              {saving ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Saving</> : "Save URL"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setEditing(false); setInput(slug); setError(null); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-end">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => { setEditing(true); setInput(slug); }}
            disabled={published}
            title={published ? "URL is locked after publish" : "Edit URL"}
          >
            Edit URL
          </Button>
        </div>
      )}
    </div>
  );
}

// ---- registry links editor ----

const REGISTRY_PRESETS = [
  "Amazon Wishlist",
  "Zola",
  "Crate & Barrel",
  "Williams-Sonoma",
  "Target",
  "Bed Bath & Beyond",
  "Pottery Barn",
  "Honeymoon Fund",
];

const REGISTRY_PRESET_KEYS: Record<string, string> = {
  "Amazon Wishlist": "website_editor.registry_amazon",
  "Zola": "website_editor.registry_zola",
  "Crate & Barrel": "website_editor.registry_crate",
  "Williams-Sonoma": "website_editor.registry_williams",
  "Target": "website_editor.registry_target",
  "Bed Bath & Beyond": "website_editor.registry_bedbath",
  "Pottery Barn": "website_editor.registry_pottery",
  "Honeymoon Fund": "website_editor.registry_honeymoon",
};

function RegistryLinksEditor({
  links,
  onChange,
}: {
  links: RegistryLink[];
  onChange: (next: RegistryLink[]) => void;
}) {
  const { t } = useTranslation();
  const add = () => onChange([...links, { name: "", url: "" }]);
  const remove = (i: number) => onChange(links.filter((_, idx) => idx !== i));
  const update = (i: number, patch: Partial<RegistryLink>) =>
    onChange(links.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  return (
    <div className="space-y-3">
      {links.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Add clickable buttons to your registry pages — Amazon, Zola, or any custom URL.
        </p>
      )}
      {links.map((link, i) => (
        <div key={i} className="rounded-md border border-border p-3 space-y-2 bg-muted/20">
          <div className="flex items-center gap-2">
            <select
              className="flex-1 h-8 rounded-md border border-border bg-background px-2 text-xs"
              value={REGISTRY_PRESETS.includes(link.name) ? link.name : "__custom__"}
              onChange={(e) => {
                if (e.target.value !== "__custom__") update(i, { name: e.target.value });
              }}
            >
              {REGISTRY_PRESETS.map((p) => (
                <option key={p} value={p}>{t(REGISTRY_PRESET_KEYS[p], { defaultValue: p })}</option>
              ))}
              <option value="__custom__">Custom name…</option>
            </select>
            <button
              type="button"
              onClick={() => remove(i)}
              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              aria-label="Remove registry"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {!REGISTRY_PRESETS.includes(link.name) && (
            <Input
              value={link.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="Registry name"
              className="h-8 text-xs"
            />
          )}
          <Input
            value={link.url}
            onChange={(e) => update(i, { url: e.target.value })}
            placeholder="https://registry.example.com/..."
            className="h-8 text-xs font-mono"
            type="url"
          />
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={add} className="w-full" disabled={links.length >= 8}>
        <Plus className="h-3.5 w-3.5 mr-1.5" /> Add registry
      </Button>
    </div>
  );
}


// ---- QR code section ----

const QR_SIZES = [
  { labelKey: "website_editor.qr_small", labelDefault: "Small (400px)", size: 400, desc: "Digital sharing, email" },
  { labelKey: "website_editor.qr_medium", labelDefault: "Medium (800px)", size: 800, desc: "Save-the-dates, small print" },
  { labelKey: "website_editor.qr_large", labelDefault: "Large (1200px)", size: 1200, desc: "Invitations, 4×4\" print" },
  { labelKey: "website_editor.qr_print", labelDefault: "Print (2000px)", size: 2000, desc: "Large signage, posters" },
];

function QrCodeSection({ publicUrl, published }: { publicUrl: string; published: boolean }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [selectedSize, setSelectedSize] = useState(800);

  const qrUrl = (size: number) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=12&data=${encodeURIComponent(publicUrl)}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  if (!published) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border-2 border-dashed border-border p-4 text-center">
          <QrCode className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Publish your website first to generate a QR code for your physical invitations.
          </p>
        </div>
        <Button size="sm" className="w-full" onClick={() => {}}>
          <Globe className="h-3.5 w-3.5 mr-1.5" />
          Publish to get QR code
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Print this QR code on physical invitations, save-the-dates, or wedding signage. Guests scan it to open your site instantly.
      </p>

      {/* Preview */}
      <div className="flex justify-center">
        <div className="rounded-xl border-2 border-border bg-white p-3 shadow-sm inline-block">
          <img
            src={qrUrl(300)}
            alt="Wedding website QR code"
            className="w-40 h-40 block"
          />
        </div>
      </div>

      {/* URL + copy */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted/50 text-[11px]">
        <Globe className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        <span className="truncate flex-1 font-mono text-muted-foreground">{publicUrl}</span>
        <Button size="sm" variant="ghost" className="h-6 px-1.5 flex-shrink-0" onClick={copyLink}>
          {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>

      {/* Size picker */}
      <div>
        <p className="text-[11px] font-medium text-muted-foreground mb-2 uppercase tracking-wide">Download size</p>
        <div className="grid grid-cols-2 gap-1.5">
          {QR_SIZES.map((s) => (
            <button
              key={s.size}
              onClick={() => setSelectedSize(s.size)}
              className={`text-left px-2.5 py-2 rounded-md border text-xs transition-all ${selectedSize === s.size ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/40"}`}
            >
              <div className="font-medium leading-tight">{t(s.labelKey, { defaultValue: s.labelDefault })}</div>
              <div className="text-[10px] opacity-60 mt-0.5">{s.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Download */}
      <a
        href={qrUrl(selectedSize)}
        download={`wedding-qr-${selectedSize}px.png`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
        style={{ background: "hsl(var(--primary))" }}
      >
        <Download className="h-4 w-4" />
        Download {selectedSize}×{selectedSize}px
      </a>

      {/* Print tips */}
      <div className="rounded-lg bg-muted/40 px-3 py-2.5 space-y-1">
        <p className="text-[11px] font-semibold text-foreground">Printing tips</p>
        <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc list-inside">
          <li>Use 800px+ for print — 400px is fine for digital</li>
          <li>Keep a white border around the code (already included)</li>
          <li>Test by scanning with your phone before printing</li>
          <li>Minimum print size: about 1×1 inch for reliable scanning</li>
        </ul>
      </div>
    </div>
  );
}

// ---- small components ----

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="border-b py-5 px-5">
      <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col">
      <Label className="text-xs text-muted-foreground mb-1 block truncate" title={label}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-9 h-9 rounded border border-border cursor-pointer flex-shrink-0"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-xs font-mono h-9 min-w-0"
        />
      </div>
    </div>
  );
}
