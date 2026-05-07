import { useEffect, useMemo, useRef, useState } from "react";
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
  QrCode, Download, Link2, Plus,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WebsiteRenderer, type WebsiteRendererPayload, parseWeddingPartyMembers, parseRegistryLinks, type WeddingPartyMember, type WeddingPartySide, type RegistryLink } from "@/components/website/WebsiteRenderer";

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

const LAYOUT_STYLES = [
  { id: "standard", name: "Standard" },
  { id: "compact",  name: "Compact" },
  { id: "wide",     name: "Wide" },
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
];

// ---------- main ----------

export default function WebsiteEditor() {
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
  const [qrOpen, setQrOpen] = useState(false);
  const [lastAutosaved, setLastAutosaved] = useState<Date | null>(null);

  const upload = useUpload({
    getToken,
    onError: (e) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

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
  // For preview-only fields (timeline, couple names), the saved record
  // doesn't include them — we hit the public endpoint when published, or
  // synthesize a placeholder.
  const [previewExtra, setPreviewExtra] = useState<{ couple: WebsiteRendererPayload["couple"]; timeline: WebsiteRendererPayload["timeline"] } | null>(null);
  useEffect(() => {
    if (!record) return;
    let cancelled = false;
    (async () => {
      // Fetch profile + timeline directly to enrich preview.
      const [profileRes, timelineRes] = await Promise.all([
        authFetch("/api/profile"),
        authFetch("/api/timeline").catch(() => null),
      ]);
      if (cancelled) return;
      if (!profileRes?.ok) return;
      const profile = await profileRes.json();
      let timeline: WebsiteRendererPayload["timeline"] = [];
      if (timelineRes?.ok) {
        try {
          const tl = await timelineRes.json();
          if (tl && Array.isArray(tl.events)) timeline = tl.events;
        } catch {
          // ignore
        }
      }
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
        timeline,
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

  // ---- update helpers ----

  const update = (patch: Partial<WebsiteRecord>) => {
    setRecord((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  };

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
          galleryImages: record.galleryImages,
          heroImage: record.heroImage,
          ...(passwordInput.trim() ? { password: passwordInput.trim() } : {}),
        }),
      });
      if (!r.ok) throw new Error("Failed to save");
      const body = (await r.json()) as WebsiteRecord;
      setRecord(body);
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
          galleryImages: record.galleryImages,
          heroImage: record.heroImage,
          ...(passwordInput.trim() ? { password: passwordInput.trim() } : {}),
        }),
      });
      if (!r.ok) throw new Error("Failed to save");
      const body = (await r.json()) as WebsiteRecord;
      setRecord(body);
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
        <h1 className="text-3xl font-serif font-bold mb-3">Your Wedding Website</h1>
        <p className="text-muted-foreground mb-8">
          Create a beautiful, shareable site for your guests. We'll auto-generate it using your existing wedding details — you can customize everything afterwards.
        </p>
        <Button size="lg" onClick={handleCreate} disabled={creating}>
          {creating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</> : "Create My Wedding Website"}
        </Button>
      </div>
    );
  }

  const livePreview: WebsiteRendererPayload = {
    theme: record.theme,
    layoutStyle: record.layoutStyle,
    font: record.font,
    accentColor: record.accentColor,
    colorPalette: record.colorPalette,
    sectionsEnabled: record.sectionsEnabled,
    customText: record.customText,
    galleryImages: record.galleryImages,
    heroImage: record.heroImage,
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
    timeline: previewExtra?.timeline ?? [],
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] -m-6 lg:-m-8">
      {/* Sidebar */}
      <aside className="w-full lg:w-[340px] lg:flex-shrink-0 border-r bg-background overflow-y-auto">
        <div className="p-5 border-b sticky top-0 bg-background z-10">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-xl font-serif font-bold">Website Editor</h2>
            <Badge variant={record.published ? "default" : "secondary"}>
              {record.published ? "Live" : "Draft"}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              {saving ? "Saving..." : dirty ? "Save changes" : "Saved"}
            </Button>
            {!dirty && lastAutosaved && (
              <span className="text-[11px] text-muted-foreground">
                Autosaved {lastAutosaved.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
            )}
            <Button size="sm" variant={record.published ? "outline" : "default"} onClick={handlePublish} disabled={publishing}>
              {publishing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Globe className="h-3.5 w-3.5 mr-1.5" />}
              {record.published ? "Unpublish" : "Publish"}
            </Button>
            {record.published && (
              <Button size="sm" variant="outline" onClick={() => window.open(publicUrl, "_blank")}>
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                Preview
              </Button>
            )}
            {record.published && (
              <Button size="sm" variant="outline" onClick={() => setQrOpen(true)}>
                <QrCode className="h-3.5 w-3.5 mr-1.5" />
                QR Code
              </Button>
            )}
          </div>
          {record.published && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 text-xs">
              <Globe className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="truncate flex-1 font-mono">{publicUrl}</span>
              <Button size="sm" variant="ghost" className="h-6 px-2" onClick={copyLink}>
                {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          )}
        </div>

        {/* Theme picker */}
        <Section icon={<Palette className="h-4 w-4" />} title="Theme">
          <div className="grid grid-cols-2 gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => applyTheme(t.id)}
                className={`text-left p-3 rounded-md border transition-all ${record.theme === t.id ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50"}`}
              >
                <div className="flex gap-1 mb-2">
                  <div className="w-4 h-4 rounded-full" style={{ background: t.primary }} />
                  <div className="w-4 h-4 rounded-full" style={{ background: t.secondary }} />
                  <div className="w-4 h-4 rounded-full" style={{ background: t.neutral }} />
                </div>
                <div className="text-xs font-medium">{t.name}</div>
              </button>
            ))}
          </div>
        </Section>

        {/* Colors */}
        <Section icon={<Palette className="h-4 w-4" />} title="Colors">
          <div className="grid grid-cols-2 gap-3">
            <ColorField label="Primary"   value={record.colorPalette.primary}   onChange={(v) => update({ colorPalette: { ...record.colorPalette, primary: v }, accentColor: v })} />
            <ColorField label="Secondary" value={record.colorPalette.secondary} onChange={(v) => update({ colorPalette: { ...record.colorPalette, secondary: v } })} />
            <ColorField label="Background" value={record.colorPalette.background} onChange={(v) => update({ colorPalette: { ...record.colorPalette, background: v } })} />
            <ColorField label="Text"      value={record.colorPalette.text}      onChange={(v) => update({ colorPalette: { ...record.colorPalette, text: v } })} />
          </div>
        </Section>

        {/* Typography */}
        <Section icon={<Type className="h-4 w-4" />} title="Typography">
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Heading font (couple names, titles)</Label>
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
              <Label className="text-xs text-muted-foreground mb-1 block">Body font (paragraphs)</Label>
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
        </Section>

        {/* Layout */}
        <Section icon={<ToggleLeft className="h-4 w-4" />} title="Layout">
          <div className="flex gap-2">
            {LAYOUT_STYLES.map((l) => (
              <button
                key={l.id}
                onClick={() => update({ layoutStyle: l.id })}
                className={`flex-1 px-3 py-2 rounded-md border text-sm transition-all ${record.layoutStyle === l.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
              >
                {l.name}
              </button>
            ))}
          </div>
        </Section>

        {/* Sections */}
        <Section icon={<ToggleLeft className="h-4 w-4" />} title="Sections">
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
        </Section>

        {/* Inline-edit hint */}
        <Section icon={<FileText className="h-4 w-4" />} title="Edit Text">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Click any heading or paragraph in the preview to edit it directly. Press <strong>Enter</strong> on a heading or click outside to commit. Use this sidebar for theme, layout, photos, and section toggles.
          </p>
        </Section>

        {/* Hero image */}
        <Section icon={<ImageIcon className="h-4 w-4" />} title="Hero Image">
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
        </Section>

        {/* Gallery */}
        <Section icon={<ImageIcon className="h-4 w-4" />} title="Gallery">
          <div className="grid grid-cols-3 gap-2 mb-3">
            {record.galleryImages.map((img, i) => (
              <div key={i} className="relative aspect-square rounded-md overflow-hidden">
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
        </Section>

        {/* Registry Links */}
        <Section icon={<Link2 className="h-4 w-4" />} title="Registry Links">
          <RegistryLinksEditor
            links={parseRegistryLinks(record.customText._registryLinks)}
            onChange={(next) =>
              update({ customText: { ...record.customText, _registryLinks: JSON.stringify(next) } })
            }
          />
        </Section>

        {/* Wedding Party */}
        <Section icon={<Heart className="h-4 w-4" />} title="Wedding Party">
          <WeddingPartyEditor
            members={parseWeddingPartyMembers(record.customText._weddingPartyMembers)}
            onChange={(next) => update({ customText: { ...record.customText, _weddingPartyMembers: JSON.stringify(next) } })}
            uploadFile={async (file) => {
              const r = await upload.uploadFile(file);
              return r?.objectPath ?? null;
            }}
            isUploading={upload.isUploading}
          />
        </Section>

        {/* Password */}
        <Section icon={<Lock className="h-4 w-4" />} title="Password Protection">
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
                placeholder="Optional password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="text-sm"
              />
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-2">
            When set, guests must enter this password before viewing the site.
          </p>
        </Section>
      </aside>

      {/* Live preview */}
      <main className="flex-1 overflow-y-auto bg-muted/20">
        <div className="sticky top-0 z-10 px-4 py-2 bg-background/80 backdrop-blur border-b text-xs text-muted-foreground">
          Live preview — changes appear here instantly. Click <strong>Save changes</strong> when you're happy.
        </div>
        <div className="bg-white">
          <WebsiteRenderer
            data={livePreview}
            editable
            onTextChange={(key, value) => update({ customText: { ...record.customText, [key]: value } })}
          />
        </div>
      </main>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Wedding website QR code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="rounded-lg border bg-white p-3">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=10&data=${encodeURIComponent(publicUrl)}`}
                alt="QR code"
                className="w-64 h-64"
              />
            </div>
            <p className="text-xs text-muted-foreground text-center font-mono break-all">{publicUrl}</p>
            <Button
              variant="outline"
              className="w-full"
              asChild
            >
              <a
                href={`https://api.qrserver.com/v1/create-qr-code/?size=800x800&margin=10&data=${encodeURIComponent(publicUrl)}`}
                download="wedding-website-qr.png"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="h-4 w-4 mr-2" />
                Download QR
              </a>
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              Print this on save-the-dates, place cards, or signage. Guests scan it to open your wedding site.
            </p>
          </div>
        </DialogContent>
      </Dialog>
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

function RegistryLinksEditor({
  links,
  onChange,
}: {
  links: RegistryLink[];
  onChange: (next: RegistryLink[]) => void;
}) {
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
                <option key={p} value={p}>{p}</option>
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

// ---- wedding party avatar with drag-to-position ----

function PartyAvatar({
  photo,
  photoX,
  photoY,
  onPositionChange,
  onRemove,
}: {
  photo: string;
  photoX: number;
  photoY: number;
  onPositionChange: (x: number, y: number) => void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const updateFromEvent = (clientX: number, clientY: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    onPositionChange(Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)));
  };

  return (
    <div className="flex flex-col items-center gap-1 flex-shrink-0">
      <div
        ref={ref}
        className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-border bg-background cursor-move select-none"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          setDragging(true);
          updateFromEvent(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (!dragging) return;
          updateFromEvent(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
          setDragging(false);
        }}
        onPointerCancel={() => setDragging(false)}
        title="Drag to reposition photo"
      >
        <img
          src={photo.startsWith("/objects/") ? `/api/storage${photo}` : photo}
          alt=""
          className="w-full h-full object-cover pointer-events-none"
          style={{ objectPosition: `${photoX}% ${photoY}%` }}
          draggable={false}
        />
        {/* focal point indicator while dragging */}
        {dragging && (
          <div
            className="absolute w-3 h-3 rounded-full border-2 border-white shadow-md pointer-events-none"
            style={{
              left: `${photoX}%`,
              top: `${photoY}%`,
              transform: "translate(-50%, -50%)",
              background: "rgba(99,102,241,0.9)",
            }}
          />
        )}
      </div>
      <span className="text-[10px] text-muted-foreground">drag to position</span>
      <button
        type="button"
        onClick={onRemove}
        className="text-[10px] text-muted-foreground hover:text-destructive"
      >
        Remove photo
      </button>
    </div>
  );
}

// ---- wedding party editor ----

function WeddingPartyEditor({
  members,
  onChange,
  uploadFile,
  isUploading,
}: {
  members: WeddingPartyMember[];
  onChange: (next: WeddingPartyMember[]) => void;
  uploadFile: (file: File) => Promise<string | null>;
  isUploading: boolean;
}) {
  const updateMember = (index: number, patch: Partial<WeddingPartyMember>) => {
    const next = members.map((m, i) => (i === index ? { ...m, ...patch } : m));
    onChange(next);
  };
  const removeMember = (index: number) => {
    onChange(members.filter((_, i) => i !== index));
  };
  const addMember = () => {
    onChange([...members, { photo: "", name: "", role: "" }]);
  };

  return (
    <div className="space-y-3">
      {members.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Add bridesmaids, groomsmen, parents, or anyone else standing with you. Each member gets a photo, name, and role on the public site.
        </p>
      )}
      {members.map((m, i) => (
        <div key={i} className="rounded-md border border-border p-3 space-y-2 bg-muted/20">
          <div className="flex items-start gap-3">
            {m.photo ? (
              <PartyAvatar
                photo={m.photo}
                photoX={m.photoX ?? 50}
                photoY={m.photoY ?? 50}
                onPositionChange={(x, y) => updateMember(i, { photoX: x, photoY: y })}
                onRemove={() => updateMember(i, { photo: "", photoX: undefined, photoY: undefined })}
              />
            ) : (
              <label className="w-20 h-20 rounded-full overflow-hidden flex-shrink-0 cursor-pointer border-2 border-dashed border-border flex items-center justify-center bg-background hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const path = await uploadFile(file);
                    if (path) updateMember(i, { photo: path });
                    e.target.value = "";
                  }}
                  disabled={isUploading}
                />
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                )}
              </label>
            )}
            <div className="flex-1 space-y-1.5">
              <Input
                value={m.name}
                onChange={(e) => updateMember(i, { name: e.target.value })}
                placeholder="Name"
                className="h-8 text-sm"
              />
              <Input
                value={m.role}
                onChange={(e) => updateMember(i, { role: e.target.value })}
                placeholder="Role (e.g. Bridesmaid, Best Man)"
                className="h-8 text-sm"
              />
              <select
                value={m.side ?? ""}
                onChange={(e) => updateMember(i, { side: (e.target.value || undefined) as WeddingPartySide | undefined })}
                className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs"
              >
                <option value="">Family & Friends</option>
                <option value="groom">Groom's party</option>
                <option value="bride">Bride's party</option>
              </select>
            </div>
            <button
              onClick={() => removeMember(i)}
              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
              aria-label="Remove member"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={addMember} className="w-full" disabled={isUploading}>
        Add member
      </Button>
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
