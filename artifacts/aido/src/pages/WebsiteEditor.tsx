import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@clerk/react";
import { useUpload } from "@workspace/object-storage-web";
import { authFetch } from "@/lib/authFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Save, Globe, Eye, Copy, Check, Image as ImageIcon, X,
  Lock, Type, Palette, ToggleLeft, FileText, Heart, MapPin, Clock, Gift, HelpCircle,
  QrCode, Download, Link2, Plus, Megaphone, Users, Undo2, Sparkles, Settings, Trash2,
} from "lucide-react";
import { WebsiteRenderer, type WebsiteRendererPayload, parseRegistryLinks, type RegistryLink } from "@/components/website/WebsiteRenderer";
import { flushPendingEditableCommits, subscribeEditableDrag, EDITABLE_HIDDEN_MARKER } from "@/components/website/EditableText";

interface WebsiteRecord extends WebsiteRendererPayload {
  id: number;
  slug: string;
  passwordEnabled: boolean;
  published: boolean;
  publishedAt: string | null;
  lastUpdated: string;
}

// 10 themes (preset color + font combos)
const THEMES = [
  { id: "classic",   name: "Classic Gold",      font: "Playfair Display", primary: "#D4A017", secondary: "#F5C842", accent: "#D4A017", neutral: "#F5EFE3", background: "#FFFFFF", text: "#222222" },
  { id: "romantic",  name: "Romantic Blush",    font: "Cormorant Garamond", primary: "#D4736E", secondary: "#F0C4BD", accent: "#D4736E", neutral: "#FAF0EE", background: "#FFFCFA", text: "#3A2A28" },
  { id: "modern",    name: "Modern Charcoal",   font: "Inter",           primary: "#2C2C2C", secondary: "#7A7A7A", accent: "#1A1A1A", neutral: "#F0F0F0", background: "#FFFFFF", text: "#1A1A1A" },
  { id: "earthy",    name: "Earthy Sage",       font: "Cormorant Garamond", primary: "#7A8C6A", secondary: "#B8C5A8", accent: "#5C7050", neutral: "#EDF0E6", background: "#FBFCF8", text: "#2E3A24" },
  { id: "boho",      name: "Boho Terracotta",   font: "Playfair Display", primary: "#C0664A", secondary: "#E8A487", accent: "#A04E36", neutral: "#FAF1EB", background: "#FFFBF7", text: "#3D2418" },
  { id: "coastal",   name: "Coastal Navy",      font: "Playfair Display", primary: "#2A4D6E", secondary: "#7FA1C2", accent: "#1A3854", neutral: "#EAF1F8", background: "#FFFFFF", text: "#1A2A3A" },
  { id: "garden",    name: "Garden Lavender",   font: "Cormorant Garamond", primary: "#8A6FA8", secondary: "#C5AED5", accent: "#6E5388", neutral: "#F4EFFA", background: "#FFFBFC", text: "#2E2538" },
  { id: "minimal",   name: "Minimal Beige",     font: "Inter",           primary: "#A89580", secondary: "#D4C4AE", accent: "#8A7560", neutral: "#F5F0E8", background: "#FCFAF6", text: "#3A3024" },
  { id: "luxe",      name: "Luxe Black & Gold", font: "Playfair Display", primary: "#C9A96E", secondary: "#E8D8B8", accent: "#9D7E48", neutral: "#1A1A1A", background: "#FFFFFF", text: "#222222" },
  { id: "garden2",   name: "Wildflower",        font: "Cormorant Garamond", primary: "#C18AAA", secondary: "#E8C5D5", accent: "#A8688A", neutral: "#F8EEF3", background: "#FFFCFD", text: "#3A2530" },
];

const FONTS = [
  "Playfair Display", "Cormorant Garamond", "Lora", "Merriweather", "Bodoni Moda", "Cinzel", "Italiana", "Tangerine", "Great Vibes", "Allura", "Parisienne",
];

const BODY_FONTS = [
  "Inter", "Montserrat", "Josefin Sans", "Lato", "Open Sans", "Source Sans 3", "Nunito", "Raleway", "Poppins",
];

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
  const [activeTab, setActiveTab] = useState<"design" | "pages" | "animation" | "settings">("design");
  const inTab = (t: typeof activeTab) => activeTab === t;
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
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
  const [overlayEl, setOverlayEl] = useState<HTMLDivElement | null>(null);
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

  const update = (patch: Partial<WebsiteRecord>) => {
    if (recordRef.current) queueHistory(recordRef.current);
    setRecord((prev) => prev ? { ...prev, ...patch } : prev);
    setDirty(true);
  };

  // Functional updater for callbacks fired during editing (drag, style changes, text commits).
  // Uses prev state to avoid stale-closure bugs when rapid events fire before a re-render.
  const patchRecord = useCallback((fn: (prev: WebsiteRecord) => Partial<WebsiteRecord>) => {
    if (recordRef.current) queueHistory(recordRef.current);
    setRecord((prev) => prev ? { ...prev, ...fn(prev) } : prev);
    setDirty(true);
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

  const saveNow = async (silent: boolean): Promise<boolean> => {
    if (!record) return false;
    if (!silent) setSaving(true);
    try {
      const r = await authFetch("/api/website/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
          heroImage: record.heroImage,
          ...(passwordInput.trim() ? { password: passwordInput.trim() } : {}),
        }),
      });
      if (!r.ok) throw new Error("Failed to save");
      const body = (await r.json()) as WebsiteRecord;
      // The /api/website/update endpoint manages the website record only —
      // portalParty is a JOIN from the wedding-party portal table that the
      // GET endpoint enriches but PUT doesn't return. Preserve whatever we
      // already had so the wedding-party section doesn't blank out on save.
      setRecord((prev) => ({
        ...body,
        portalParty: body.portalParty ?? prev?.portalParty,
      }));
      setPasswordInput("");
      setDirty(false);
      return true;
    } catch {
      return false;
    } finally {
      if (!silent) setSaving(false);
    }
  };

  // Autosave: 10 seconds after the last change.
  useEffect(() => {
    if (!record || !dirty) return;
    const timer = setTimeout(async () => {
      const ok = await saveNow(true);
      if (ok) setLastAutosaved(new Date());
    }, 10000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record, dirty]);

  const handleSave = async () => {
    if (!record) return;
    setSaving(true);
    try {
      const r = await authFetch("/api/website/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
          heroImage: record.heroImage,
          ...(passwordInput.trim() ? { password: passwordInput.trim() } : {}),
        }),
      });
      if (!r.ok) throw new Error("Failed to save");
      const body = (await r.json()) as WebsiteRecord;
      // Same fix as saveNow() — PUT response is the website row only and
      // doesn't include portalParty (a JOIN the GET endpoint enriches).
      // Preserve the populated value from prev so the wedding-party
      // section doesn't blank out when the user clicks Save while on
      // the Wedding Party page.
      setRecord((prev) => ({
        ...body,
        portalParty: body.portalParty ?? prev?.portalParty,
      }));
      setPasswordInput("");
      setDirty(false);
      toast({ title: "Saved!" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
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
    setPublishing(true);
    try {
      const r = await authFetch("/api/website/publish", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !record.published }),
      });
      if (!r.ok) throw new Error("Failed");
      const body = (await r.json()) as WebsiteRecord;
      setRecord(body);
      toast({ title: body.published ? "Website published!" : "Website unpublished" });
    } catch {
      toast({ title: "Failed to update publish state", variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  const handleHeroUpload = async (file: File) => {
    const result = await upload.uploadFile(file);
    if (result) update({ heroImage: result.objectPath });
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

  const applyTheme = (themeId: string) => {
    const t = THEMES.find((x) => x.id === themeId);
    if (!t) return;
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
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] md:h-screen">
      {/* Sidebar */}
      <aside
        className="w-full lg:flex-shrink-0 border-r bg-background overflow-y-auto"
        style={{ width: typeof window !== "undefined" && window.innerWidth >= 1024 ? sidebarWidth : undefined }}
      >
        <div className="p-5 border-b sticky top-0 bg-background z-10">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-xl font-serif font-bold">{t("website_editor.editor_title", { defaultValue: "Website Editor" })}</h2>
            <Badge
              variant={record.published ? "default" : "destructive"}
              className={record.published ? undefined : "bg-red-600 hover:bg-red-600 text-white"}
            >
              {record.published ? t("website_editor.live", { defaultValue: "Live" }) : t("website_editor.draft", { defaultValue: "Draft" })}
            </Badge>
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
              onClick={() => { setPreviewSection("home"); setPreviewOpen(true); }}
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
              onClick={handleSave}
              disabled={!dirty || saving}
              className={
                !dirty && !saving
                  ? "bg-emerald-600 hover:bg-emerald-700 border-0 disabled:opacity-100 disabled:bg-emerald-600 font-bold"
                  : "border-0 font-bold"
              }
              style={
                !dirty && !saving
                  ? { color: "#2A1745" }
                  : { background: "#D4A017", color: "#2A1745" }
              }
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : (!dirty ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />)}
              {saving
                ? t("website_editor.saving", { defaultValue: "Saving..." })
                : dirty
                  ? t("website_editor.save", { defaultValue: "Save" })
                  : t("website_editor.saved", { defaultValue: "Saved" })}
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
          {!dirty && lastAutosaved && (
            <span className="text-[11px] text-muted-foreground mt-2 inline-block">
              Autosaved {lastAutosaved.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
          )}
          {record.published && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 text-xs">
                <Globe className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="truncate flex-1 font-mono">{publicUrl}</span>
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
              { id: "design",    label: t("website_editor.tab_design", { defaultValue: "Design" }),    icon: Palette },
              { id: "pages",     label: t("website_editor.tab_pages", { defaultValue: "Pages" }),     icon: FileText },
              { id: "animation", label: t("website_editor.tab_animation", { defaultValue: "Animation" }), icon: Sparkles },
              { id: "settings",  label: t("website_editor.tab_settings", { defaultValue: "Settings" }),  icon: Settings },
            ] as const).map((tab) => {
              const TabIcon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
                >
                  <TabIcon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

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
            <ColorField label={t("website_editor.color_primary", { defaultValue: "Primary" })}   value={record.colorPalette.primary}   onChange={(v) => update({ colorPalette: { ...record.colorPalette, primary: v }, accentColor: v })} />
            <ColorField label={t("website_editor.color_secondary", { defaultValue: "Secondary" })} value={record.colorPalette.secondary} onChange={(v) => update({ colorPalette: { ...record.colorPalette, secondary: v } })} />
            <ColorField label={t("website_editor.color_background", { defaultValue: "Background" })} value={record.colorPalette.background} onChange={(v) => update({ colorPalette: { ...record.colorPalette, background: v } })} />
            <ColorField label={t("website_editor.color_text", { defaultValue: "Text" })}      value={record.colorPalette.text}      onChange={(v) => update({ colorPalette: { ...record.colorPalette, text: v } })} />
          </div>
          {/* Background opacity slider — lets the user fade the section
              backgrounds so any underlying hero image / page background
              shows through. */}
          {(() => {
            const raw = record.customText._backgroundOpacity;
            const opacity = raw === undefined || raw === "" ? 100 : Math.max(0, Math.min(100, parseInt(raw, 10) || 100));
            return (
              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">
                    {t("website_editor.background_opacity", { defaultValue: "Background opacity" })}
                  </Label>
                  <span className="text-xs text-muted-foreground tabular-nums">{opacity}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={opacity}
                  onChange={(e) => update({ customText: { ...record.customText, _backgroundOpacity: e.target.value } })}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>
            );
          })()}
        </Section>}

        {/* Typography */}
        {inTab("design") && <Section icon={<Type className="h-4 w-4" />} title={t("website_editor.section_typography", { defaultValue: "Typography" })}>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">{t("website_editor.heading_font_label", { defaultValue: "Heading font (couple names, titles)" })}</Label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={record.customText._headingFont || record.font}
                onChange={(e) => update({ customText: { ...record.customText, _headingFont: e.target.value }, font: e.target.value })}
              >
                {FONTS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">{t("website_editor.body_font_label", { defaultValue: "Body font (paragraphs)" })}</Label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={record.customText._bodyFont || "Inter"}
                onChange={(e) => update({ customText: { ...record.customText, _bodyFont: e.target.value } })}
              >
                {BODY_FONTS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
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
                    onCheckedChange={(checked) =>
                      update({ sectionsEnabled: { ...record.sectionsEnabled, [s.id]: checked } })
                    }
                  />
                </div>
              );
            })}
          </div>
        </Section>}

        {/* Hero elements — toggles for the rows that drag-to-trash hides
            (date, venue, countdown). Lets the user bring them back without
            needing to hit Undo. */}
        {inTab("pages") && <Section icon={<ToggleLeft className="h-4 w-4" />} title={t("website_editor.section_hero_elements", { defaultValue: "Hero Elements" })}>
          <div className="space-y-2.5">
            {[
              { key: "_heroDateRow", label: t("website_editor.hero_date_row", { defaultValue: "Wedding Date" }) },
              { key: "_heroDateIcon", label: t("website_editor.hero_date_icon", { defaultValue: "Date Calendar Icon" }) },
              { key: "_heroVenueRow", label: t("website_editor.hero_venue_row", { defaultValue: "Venue Address" }) },
              { key: "_heroVenueIcon", label: t("website_editor.hero_venue_icon", { defaultValue: "Venue Pin Icon" }) },
              { key: "_countdown", label: t("website_editor.hero_countdown", { defaultValue: "Countdown Timer" }) },
              { key: "_addToCalendarRow", label: t("website_editor.hero_add_to_calendar", { defaultValue: "Add to Calendar Button" }) },
            ].map((row) => {
              const isHidden = record.customText[row.key] === " __aido_hidden__ " || record.customText[row.key] === EDITABLE_HIDDEN_MARKER;
              return (
                <div key={row.key} className="flex items-center justify-between gap-3 py-1.5">
                  <Label className="text-sm cursor-pointer">{row.label}</Label>
                  <Switch
                    checked={!isHidden}
                    onCheckedChange={(checked) => patchRecord((prev) => {
                      const ct = { ...prev.customText };
                      if (checked) delete ct[row.key];
                      else ct[row.key] = EDITABLE_HIDDEN_MARKER;
                      return { customText: ct };
                    })}
                  />
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
            {(record.customText._heroAnimation === "slideshow") && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {t("website_editor.slideshow_hint", { defaultValue: "Slideshow uses your hero image and all gallery photos. Add more photos in the Gallery section below to extend the rotation." })}
              </p>
            )}
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

        {/* Hero image */}
        {inTab("design") && <Section icon={<ImageIcon className="h-4 w-4" />} title={t("website_editor.section_hero_image", { defaultValue: "Hero Image" })}>
          {record.heroImage ? (
            <div className="relative rounded-md overflow-hidden">
              <img
                src={record.heroImage.startsWith("/objects/") ? `/api/storage${record.heroImage}` : record.heroImage}
                alt="Hero"
                className="w-full h-32 object-cover"
              />
              <button
                onClick={() => update({ heroImage: null })}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 w-full px-4 py-8 rounded-md border-2 border-dashed border-border cursor-pointer hover:border-primary/50 transition-colors text-sm text-muted-foreground">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleHeroUpload(file);
                  e.target.value = "";
                }}
                disabled={upload.isUploading}
              />
              {upload.isUploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</> : <><ImageIcon className="h-4 w-4" /> Upload hero image</>}
            </label>
          )}
        </Section>}

        {/* Gallery */}
        {inTab("design") && <Section icon={<ImageIcon className="h-4 w-4" />} title="Gallery">
          <div className="grid grid-cols-3 gap-2 mb-3 items-start">
            {record.galleryImages.map((img, i) => (
              <div key={i} className="flex flex-col gap-1">
                <div className="relative aspect-square rounded-md overflow-hidden">
                  <img
                    src={img.url.startsWith("/objects/") ? `/api/storage${img.url}` : img.url}
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

        {/* Announcement banner */}
        {inTab("settings") && <Section icon={<Megaphone className="h-4 w-4" />} title={t("website_editor.section_announcement", { defaultValue: "Announcement" })}>
          <p className="text-xs text-muted-foreground mb-2">
            Show a dismissible banner at the top of your site — great for last-minute updates.
          </p>
          <Textarea
            value={record.customText._announcement ?? ""}
            onChange={(e) =>
              update({ customText: { ...record.customText, _announcement: e.target.value } })
            }
            placeholder={t("website_editor.announcement_placeholder", { defaultValue: "e.g. Venue has changed — please check the Travel section for updated details." })}
            className="text-sm resize-none"
            rows={3}
          />
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
                onChange={(e) => setPasswordInput(e.target.value)}
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

      {/* Live preview */}
      <main
        ref={previewRef}
        className="flex-1 overflow-y-auto bg-muted/20"
        onContextMenu={(e) => {
          e.preventDefault();
          setCtxMenu({ x: e.clientX, y: e.clientY });
        }}
        onClick={() => { if (ctxMenu) setCtxMenu(null); }}
      >
        <div className="sticky top-0 z-10 px-4 py-2 bg-background/80 backdrop-blur border-b text-xs text-muted-foreground flex items-center justify-between gap-3 flex-wrap">
          <span>
            Live preview — changes appear here instantly. Click <strong>Save</strong> when you're happy.
          </span>
          <button
            type="button"
            onClick={() => setUrlModalOpen(true)}
            className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-4 hover:opacity-80 transition-opacity whitespace-nowrap"
            style={{ color: "#D4A017" }}
          >
            <Link2 className="h-3 w-3" />
            {t("website_editor.custom_url_cta", { defaultValue: "Click here to get your custom website URL" })}
          </button>
        </div>
        <div className="bg-white">
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
            onDeleteElement={(key) => patchRecord((prev) => {
              const ct = { ...prev.customText };
              const ts = { ...(prev.textStyles ?? {}) };
              const tp = { ...(prev.textPositions ?? {}) };
              if (key.startsWith("_custom_")) {
                // User-added text box — fully remove the row.
                delete ct[key]; delete ts[key]; delete tp[key];
              } else {
                // Default field (couple names, story, schedule, etc.) — flag
                // it hidden via the sentinel marker. EditableText collapses
                // the wrap on the page; underlying portal data (profile
                // couple names, dates, etc.) is untouched. Undo restores by
                // patching the marker back to its prior value.
                ct[key] = EDITABLE_HIDDEN_MARKER;
              }
              return { customText: ct, textStyles: ts, textPositions: tp };
            })}
          />
        </div>
      </main>

      {/* Trash drop zone — appears whenever a deletable text element is being
          dragged. Drop the box here to remove it (Undo restores). */}
      <div
        data-aido-trash="true"
        className={`pointer-events-auto fixed bottom-6 right-6 z-[200] flex items-center gap-2 px-4 py-3 rounded-full border-2 shadow-lg transition-all duration-200 ${
          editableDragging
            ? "border-red-500 bg-red-500/95 text-white scale-110"
            : "border-border bg-background/90 text-muted-foreground opacity-50 hover:opacity-100 backdrop-blur"
        }`}
        title="Drag a text box here to delete"
      >
        <Trash2 className={`h-4 w-4 ${editableDragging ? "text-white" : ""}`} />
        <span className="text-xs font-medium">
          {editableDragging ? t("website_editor.release_to_delete", { defaultValue: "Release to delete" }) : t("website_editor.drop_to_delete", { defaultValue: "Drop to delete" })}
        </span>
      </div>

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
              const key = `_custom_${Date.now()}`;
              patchRecord((prev) => ({
                customText: { ...prev.customText, [key]: t("website_editor.new_text", { defaultValue: "New text — click to edit" }) },
                textPositions: { ...(prev.textPositions ?? {}), [key]: { x: 0, y: 0 } },
              }));
              setCtxMenu(null);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Insert text box
          </button>
        </div>
      )}

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
              <span className="text-xs text-muted-foreground font-medium">{t("website_editor.preview", { defaultValue: "Preview" })}</span>
              <Badge
                variant={record.published ? "default" : "destructive"}
                className={record.published ? "text-[10px] py-0 px-1.5" : "text-[10px] py-0 px-1.5 bg-red-600 hover:bg-red-600 text-white"}
              >
                {record.published ? t("website_editor.live", { defaultValue: "Live" }) : t("website_editor.draft", { defaultValue: "Draft" })}
              </Badge>
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
                  onClick={() => window.open(publicUrl, "_blank")}
                >
                  Open live site ↗
                </button>
              )}
              <button
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setPreviewOpen(false)}
                title={t("website_editor.close_preview", { defaultValue: "Close preview" })}
              >
                <X className="h-3.5 w-3.5" />
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
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          Changing the URL will break any previously shared links.
        </p>
      )}
      {editing ? (
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
    <div>
      <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
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
          className="text-xs font-mono h-9"
        />
      </div>
    </div>
  );
}
