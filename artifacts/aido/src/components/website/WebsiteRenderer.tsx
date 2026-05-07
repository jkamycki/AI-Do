import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Calendar, MapPin, Heart, Clock, Gift, HelpCircle, Image as ImageIcon, ChevronLeft, ChevronRight, X, ExternalLink, Navigation, CheckCircle2, Wine, UtensilsCrossed } from "lucide-react";
import { EditableText, type TextPosition } from "./EditableText";
import { RsvpFlow } from "./RsvpFlow";
import { apiFetch } from "@/lib/authFetch";

// camelCase section id <-> kebab-case URL slug
const SECTION_TO_URL: Record<string, string> = {
  home: "",
  welcome: "welcome",
  story: "story",
  schedule: "schedule",
  travel: "travel",
  registry: "registry",
  weddingParty: "wedding-party",
  gallery: "gallery",
  faq: "faq",
  rsvp: "rsvp",
};
const URL_TO_SECTION: Record<string, string> = Object.fromEntries(
  Object.entries(SECTION_TO_URL).map(([k, v]) => [v, k])
);
URL_TO_SECTION[""] = "home";

export function urlSegmentForSection(id: string): string {
  return SECTION_TO_URL[id] ?? id;
}
export function sectionFromUrlSegment(seg: string | undefined): string {
  return URL_TO_SECTION[seg ?? ""] ?? "home";
}

export interface WebsiteRendererPayload {
  slug?: string;
  theme: string;
  layoutStyle: string;
  font: string;
  accentColor: string;
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
    neutral: string;
    background: string;
    text: string;
  };
  sectionsEnabled: {
    welcome: boolean;
    story: boolean;
    schedule: boolean;
    travel: boolean;
    registry: boolean;
    faq: boolean;
    gallery: boolean;
    weddingParty: boolean;
    rsvp?: boolean;
  };
  customText: Record<string, string>;
  textStyles?: Record<string, { fontFamily?: string; fontSize?: string; color?: string; bold?: boolean; italic?: boolean; animation?: string }>;
  textPositions?: Record<string, { x: number; y: number }>;
  // Wedding party members synced from the portal (takes precedence over customText._weddingPartyMembers)
  portalParty?: Array<{ id: number; name: string; role: string; side: string; photoUrl: string | null; sortOrder: number }>;
  galleryImages: Array<{ url: string; caption?: string; order: number }>;
  heroImage: string | null;
  couple: {
    partner1Name: string;
    partner2Name: string;
    weddingDate: string;
    ceremonyTime: string;
    receptionTime: string;
    venue: string;
    location: string;
    venueCity: string | null;
    venueState: string | null;
  };
  // timeline removed — wedding website schedule is entered directly by the couple
}

function formatWeddingDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type TextStyle = { fontFamily?: string; fontSize?: string; color?: string; bold?: boolean; italic?: boolean; animation?: string };

// Edit mode props passed to every section (and its EditableText spans).
interface EditCtx {
  editable: boolean;
  onTextChange: (key: string, value: string) => void;
  textStyles?: Record<string, TextStyle>;
  onStyleChange?: (key: string, style: TextStyle) => void;
  textPositions?: Record<string, TextPosition>;
  onPositionChange?: (key: string, position: TextPosition) => void;
  onDeleteElement?: (key: string) => void;
}
const NOOP_CTX: EditCtx = { editable: false, onTextChange: () => {} };

// Returns textStyle + onStyleChange + position + onPositionChange + onDelete props for an EditableText.
function tsp(ctx: EditCtx, key: string, deletable = false) {
  if (!ctx.editable) return {};
  return {
    textStyle: ctx.textStyles?.[key] ?? {},
    onStyleChange: ctx.onStyleChange ? (s: TextStyle) => ctx.onStyleChange!(key, s) : undefined,
    position: ctx.textPositions?.[key],
    onPositionChange: ctx.onPositionChange ? (p: TextPosition) => ctx.onPositionChange!(key, p) : undefined,
    onDelete: deletable && ctx.onDeleteElement ? () => ctx.onDeleteElement!(key) : undefined,
  };
}

function fontStack(font: string): string {
  return `'${font}', 'Playfair Display', Georgia, serif`;
}

function bodyFontStack(font: string): string {
  return `'${font}', system-ui, -apple-system, sans-serif`;
}

function imageUrl(url: string): string {
  if (url.startsWith("/objects/")) return `/api/storage${url}`;
  return url;
}

function headingFont(data: WebsiteRendererPayload): string {
  return (data.customText._headingFont || "").trim() || data.font;
}

function bodyFont(data: WebsiteRendererPayload): string {
  return (data.customText._bodyFont || "").trim() || "Inter";
}

// Returns the override font for an editable text element, or undefined to
// use the theme default. Used by EditableText's per-element font picker.
function elementFont(data: WebsiteRendererPayload, key: string): string | undefined {
  const v = (data.customText[`${key}_font`] || "").trim();
  return v || undefined;
}

// Compose a fontFamily string. If the element has its own override, use it.
// Otherwise fall back to the supplied default (heading or body).
function elementFontStack(data: WebsiteRendererPayload, key: string, fallbackFont: string, fallbackKind: "heading" | "body"): string {
  const own = elementFont(data, key);
  const f = own || fallbackFont;
  return fallbackKind === "heading" ? fontStack(f) : bodyFontStack(f);
}


// ---------- lightbox ----------

function Lightbox({
  images,
  startIndex,
  onClose,
}: {
  images: Array<{ url: string; caption?: string }>;
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const prev = () => setIndex((i) => Math.max(0, i - 1));
  const next = () => setIndex((i) => Math.min(images.length - 1, i + 1));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const img = images[index];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/92"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>
      {index > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); prev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors"
          aria-label="Previous"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {index < images.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); next(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors"
          aria-label="Next"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
      <div
        className="flex flex-col items-center max-w-5xl mx-12 max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl(img.url)}
          alt={img.caption ?? ""}
          className="max-h-[80vh] max-w-full object-contain rounded-lg shadow-2xl"
        />
        {img.caption && (
          <p className="text-center text-white/80 text-sm mt-3 px-4">{img.caption}</p>
        )}
      </div>
      {images.length > 1 && (
        <div className="absolute bottom-5 flex gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setIndex(i); }}
              className={`w-2 h-2 rounded-full transition-all ${i === index ? "bg-white scale-125" : "bg-white/40"}`}
              aria-label={`Go to image ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- draggable row (icon + text unit) ----------

const DRAG_THRESHOLD_ROW = 5;

function DraggableRow({
  children,
  position,
  onPositionChange,
  editable,
  className,
  style,
}: {
  children: React.ReactNode;
  position?: TextPosition;
  onPositionChange?: (p: TextPosition) => void;
  editable: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [hovered, setHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);

  if (!editable || !onPositionChange) {
    return (
      <div
        className={className}
        style={{ ...style, transform: position ? `translate(${position.x}px, ${position.y}px)` : undefined }}
      >
        {children}
      </div>
    );
  }

  const transform = position ? `translate(${position.x}px, ${position.y}px)` : undefined;

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = { startX: e.clientX, startY: e.clientY, origX: position?.x ?? 0, origY: position?.y ?? 0, moved: false };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    if (Math.abs(dx) > DRAG_THRESHOLD_ROW || Math.abs(dy) > DRAG_THRESHOLD_ROW) dragState.current.moved = true;
    if (dragState.current.moved) onPositionChange({ x: dragState.current.origX + dx, y: dragState.current.origY + dy });
  };

  const handlePointerUp = () => { dragState.current = null; setIsDragging(false); };

  const hasOffset = position && (position.x !== 0 || position.y !== 0);

  return (
    <div
      className={className}
      style={{
        ...style,
        transform,
        position: "relative",
        cursor: isDragging ? "grabbing" : "grab",
        outline: hovered || isDragging ? "1.5px dashed rgba(99,102,241,0.4)" : undefined,
        outlineOffset: 4,
        borderRadius: 2,
        zIndex: isDragging ? 50 : undefined,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {hasOffset && (hovered || isDragging) && (
        <span
          style={{ position: "absolute", top: -20, right: 0, background: "rgba(99,102,241,0.9)", color: "#fff", borderRadius: 4, padding: "1px 6px", fontSize: 10, cursor: "pointer", userSelect: "none", zIndex: 300, lineHeight: 1.6 }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onPositionChange({ x: 0, y: 0 })}
        >
          ×
        </span>
      )}
      {children}
    </div>
  );
}

// ---------- countdown ----------

function calcTimeLeft(dateStr: string) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  const diff = new Date(y, m - 1, d).getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000),
  };
}

function CountdownTimer({ dateStr, accentColor }: { dateStr: string; accentColor: string }) {
  const [left, setLeft] = useState(() => calcTimeLeft(dateStr));
  useEffect(() => {
    const id = setInterval(() => setLeft(calcTimeLeft(dateStr)), 1000);
    return () => clearInterval(id);
  }, [dateStr]);
  if (!left) return null;
  const units = [
    { label: "Days", value: left.days },
    { label: "Hours", value: left.hours },
    { label: "Mins", value: left.minutes },
    { label: "Secs", value: left.seconds },
  ];
  return (
    <div className="flex items-center justify-center gap-4 sm:gap-8 mt-8">
      {units.map(({ label, value }) => (
        <div key={label} className="flex flex-col items-center">
          <span
            className="text-3xl sm:text-5xl font-bold tabular-nums leading-none"
            style={{ color: accentColor }}
          >
            {String(value).padStart(2, "0")}
          </span>
          <span className="text-[10px] sm:text-xs uppercase tracking-widest mt-2 opacity-70">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------- registry links ----------

export interface RegistryLink { name: string; url: string; }

export function parseRegistryLinks(raw: string | undefined): RegistryLink[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l): l is RegistryLink => l && typeof l.name === "string" && typeof l.url === "string"
    );
  } catch {
    return [];
  }
}

// ---------- add to calendar ----------

function buildIcs(couple: string, dateStr: string, ceremonyTime: string, venue: string, location: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h = 16, min = 0] = (ceremonyTime || "16:00").split(":").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const dt = `${y}${pad(m)}${pad(d)}T${pad(h)}${pad(min)}00`;
  const loc = [venue, location].filter(Boolean).join(", ");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `SUMMARY:${couple}'s Wedding`,
    `DTSTART:${dt}`,
    `LOCATION:${loc}`,
    `DESCRIPTION:Join us to celebrate the wedding of ${couple}!`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function AddToCalendarButton({ data }: { data: WebsiteRendererPayload }) {
  const [open, setOpen] = useState(false);
  if (!data.couple.weddingDate) return null;
  const couple = `${data.couple.partner1Name} & ${data.couple.partner2Name}`;

  function downloadIcs() {
    const ics = buildIcs(couple, data.couple.weddingDate, data.couple.ceremonyTime, data.couple.venue, data.couple.location);
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wedding.ics";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }

  const [y, m, d] = data.couple.weddingDate.split("-").map(Number);
  const [h = 16, min = 0] = (data.couple.ceremonyTime || "16:00").split(":").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const isoStart = `${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}:00`;
  const isoEnd   = `${y}-${pad(m)}-${pad(d)}T${pad(h + 4)}:${pad(min)}:00`;
  const locStr = [data.couple.venue, data.couple.location].filter(Boolean).join(", ");
  const title = encodeURIComponent(`${couple}'s Wedding`);
  const desc  = encodeURIComponent(`Join us to celebrate the wedding of ${couple}!`);
  const loc   = encodeURIComponent(locStr);

  const gcalDt    = `${y}${pad(m)}${pad(d)}T${pad(h)}${pad(min)}00`;
  const gcalEndDt = `${y}${pad(m)}${pad(d)}T${pad(h + 4)}${pad(min)}00`;
  const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${gcalDt}/${gcalEndDt}&location=${loc}&details=${desc}`;
  const outlook = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${encodeURIComponent(isoStart)}&enddt=${encodeURIComponent(isoEnd)}&location=${loc}&body=${desc}&path=/calendar/action/compose&rru=addevent`;

  const btnStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.15)",
    border: "1px solid rgba(255,255,255,0.4)",
    color: data.heroImage ? "#fff" : data.colorPalette.text,
    backdropFilter: "blur(4px)",
  };

  const itemClass = "block w-full text-left px-4 py-2 text-sm hover:bg-black/5 transition-colors";

  return (
    <div className="relative inline-flex flex-col items-center mt-6">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-medium transition-opacity hover:opacity-80"
        style={btnStyle}
        aria-expanded={open}
      >
        <Calendar className="h-4 w-4" />
        Add to Calendar
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            className="absolute top-full mt-2 z-50 rounded-lg shadow-xl border overflow-hidden min-w-[180px]"
            style={{ background: "#fff", color: "#222", borderColor: "rgba(0,0,0,0.1)" }}
          >
            <button
              type="button"
              className={itemClass}
              onClick={() => { downloadIcs(); setOpen(false); }}
            >
              Apple Calendar
            </button>
            <a
              href={gcal}
              target="_blank"
              rel="noopener noreferrer"
              className={itemClass}
              onClick={() => setOpen(false)}
            >
              Google Calendar
            </a>
            <a
              href={outlook}
              target="_blank"
              rel="noopener noreferrer"
              className={itemClass}
              onClick={() => setOpen(false)}
            >
              Outlook
            </a>
          </div>
        </>
      )}
    </div>
  );
}

// ---------- rsvp ----------

function RsvpSection({ data, ctx }: { data: WebsiteRendererPayload; ctx: EditCtx }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [attending, setAttending] = useState<"yes" | "no" | "maybe">("yes");
  const [plusOne, setPlusOne] = useState(0);
  const [dietary, setDietary] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr("Please enter your name."); return; }
    setSubmitting(true);
    setErr(null);
    try {
      const slug = data.slug ?? "";
      const res = await apiFetch(`/api/website/rsvp/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() || undefined, attending, plusOneCount: plusOne, dietaryRestrictions: dietary.trim() || undefined, message: message.trim() || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Submission failed");
      }
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.6rem 0.9rem",
    borderRadius: "0.5rem",
    border: `1px solid ${data.colorPalette.primary}44`,
    background: data.colorPalette.background,
    color: data.colorPalette.text,
    fontSize: "0.9rem",
    outline: "none",
    fontFamily: "inherit",
  };

  return (
    <SectionShell id="rsvp" titleKey="rsvp_title" defaultTitle="RSVP" icon={<Heart className="h-4 w-4" />} data={data} ctx={ctx}>
      <EditableText
        as="div"
        editable={ctx.editable}
        value={data.customText.rsvp_subtitle ?? ""}
        defaultValue="We'd love to know if you can make it"
        onCommit={(v) => ctx.onTextChange("rsvp_subtitle", v)}
        className="block text-center text-3xl sm:text-4xl mb-10"
        style={{ fontFamily: fontStack(headingFont(data)), color: data.colorPalette.text }}
        {...tsp(ctx, "rsvp_subtitle")}
      />
      {data.customText.rsvp_deadline && (
        <p className="text-center text-sm mb-8 opacity-70" style={{ color: data.colorPalette.text }}>
          Please RSVP by <strong>{data.customText.rsvp_deadline}</strong>
        </p>
      )}
      {ctx.editable ? (
        <p className="text-center text-sm opacity-60 py-8" style={{ color: data.colorPalette.text }}>
          RSVP form will appear here for guests on the published site.
        </p>
      ) : done ? (
        <div className="flex flex-col items-center gap-4 py-10">
          <CheckCircle2 className="h-12 w-12" style={{ color: data.colorPalette.primary }} />
          <p className="text-xl font-medium text-center" style={{ color: data.colorPalette.text, fontFamily: fontStack(headingFont(data)) }}>
            {attending === "no" ? "We're sorry you can't make it 💙" : "Thank you! We can't wait to celebrate with you!"}
          </p>
          <EditableText
            as="p"
            editable={false}
            value={data.customText.rsvp_thankyou ?? "We'll send you more details closer to the day."}
            defaultValue="We'll send you more details closer to the day."
            onCommit={() => {}}
            className="text-sm text-center max-w-sm"
            style={{ color: data.colorPalette.text, opacity: 0.75 }}
          />
        </div>
      ) : (
        <form onSubmit={submit} className="max-w-lg mx-auto space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 opacity-70" style={{ color: data.colorPalette.text }}>Name *</label>
              <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 opacity-70" style={{ color: data.colorPalette.text }}>Email</label>
              <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-2 opacity-70" style={{ color: data.colorPalette.text }}>Will you attend?</label>
            <div className="flex gap-2">
              {(["yes", "no", "maybe"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setAttending(opt)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize"
                  style={{
                    border: `1.5px solid ${data.colorPalette.primary}`,
                    background: attending === opt ? data.colorPalette.primary : "transparent",
                    color: attending === opt ? "#fff" : data.colorPalette.primary,
                  }}
                >
                  {opt === "yes" ? "Joyfully accepts" : opt === "no" ? "Regretfully declines" : "Maybe"}
                </button>
              ))}
            </div>
          </div>

          {attending !== "no" && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5 opacity-70" style={{ color: data.colorPalette.text }}>Additional guests</label>
                <select style={inputStyle} value={plusOne} onChange={(e) => setPlusOne(Number(e.target.value))}>
                  {[0,1,2,3,4,5].map((n) => (
                    <option key={n} value={n}>{n === 0 ? "Just me" : `+${n} guest${n > 1 ? "s" : ""}`}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5 opacity-70" style={{ color: data.colorPalette.text }}>Dietary restrictions</label>
                <input style={inputStyle} value={dietary} onChange={(e) => setDietary(e.target.value)} placeholder="Vegetarian, gluten-free…" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1.5 opacity-70" style={{ color: data.colorPalette.text }}>Message to the couple (optional)</label>
            <textarea
              style={{ ...inputStyle, resize: "vertical", minHeight: "80px" }}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Share a wish or note…"
              rows={3}
            />
          </div>

          {err && <p className="text-sm text-red-600">{err}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-lg text-white font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: data.colorPalette.primary }}
          >
            {submitting ? "Sending…" : "Send RSVP"}
          </button>
        </form>
      )}
    </SectionShell>
  );
}

// ---------- announcement banner ----------

function AnnouncementBanner({ data }: { data: WebsiteRendererPayload }) {
  const text = data.customText._announcement?.trim();
  const [dismissed, setDismissed] = useState(false);
  if (!text || dismissed) return null;
  return (
    <div
      className="relative flex items-start gap-3 px-5 py-3 text-sm"
      style={{ background: `${data.colorPalette.primary}18`, borderBottom: `2px solid ${data.colorPalette.primary}55` }}
    >
      <span className="flex-1 text-center" style={{ color: data.colorPalette.text }}>{text}</span>
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
        style={{ color: data.colorPalette.text }}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ---------- hero ----------

function Hero({ data, ctx }: { data: WebsiteRendererPayload; ctx: EditCtx }) {
  const couple = `${data.couple.partner1Name} & ${data.couple.partner2Name}`;
  const dateStr = formatWeddingDate(data.couple.weddingDate);
  return (
    <section
      id="home"
      className="relative min-h-[80vh] flex items-center justify-center text-center px-6 py-24"
      style={{
        background: data.heroImage
          ? `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.55)), url('${imageUrl(data.heroImage)}') center/cover no-repeat`
          : `linear-gradient(135deg, ${data.colorPalette.primary}22, ${data.colorPalette.secondary}22)`,
        color: data.heroImage ? "#fff" : data.colorPalette.text,
      }}
    >
      <div className="max-w-3xl">
        <EditableText
          as="div"
          editable={ctx.editable}
          value={data.customText._heroTagline ?? ""}
          defaultValue="We're getting married"
          onCommit={(v) => ctx.onTextChange("_heroTagline", v)}
          className="uppercase tracking-[0.3em] text-xs sm:text-sm mb-6 opacity-80"
          style={{ color: data.heroImage ? "#fff" : data.colorPalette.primary, fontFamily: elementFont(data, "_heroTagline") ? bodyFontStack(elementFont(data, "_heroTagline")!) : undefined }}
          {...tsp(ctx, "_heroTagline")}
        />
        <EditableText
          as="div"
          editable={ctx.editable}
          value={data.customText._coupleName ?? ""}
          defaultValue={couple}
          onCommit={(v) => ctx.onTextChange("_coupleName", v)}
          className="text-5xl sm:text-7xl md:text-8xl mb-6 leading-tight"
          style={{ fontFamily: fontStack(headingFont(data)), color: data.heroImage ? "#fff" : data.colorPalette.text }}
          {...tsp(ctx, "_coupleName")}
        />
        <DraggableRow
          editable={ctx.editable}
          position={ctx.textPositions?.["_heroDateRow"]}
          onPositionChange={ctx.onPositionChange ? (p) => ctx.onPositionChange!("_heroDateRow", p) : undefined}
          className="flex items-center justify-center gap-4 text-base sm:text-lg opacity-90"
        >
          <Calendar className="h-5 w-5 flex-shrink-0" style={{ pointerEvents: "none" }} />
          <EditableText
            editable={ctx.editable}
            value={data.customText._heroDate ?? ""}
            defaultValue={dateStr}
            onCommit={(v) => ctx.onTextChange("_heroDate", v)}
            style={{ color: "inherit" }}
            {...tsp(ctx, "_heroDate")}
          />
        </DraggableRow>
        {data.couple.venue && (
          <DraggableRow
            editable={ctx.editable}
            position={ctx.textPositions?.["_heroVenueRow"]}
            onPositionChange={ctx.onPositionChange ? (p) => ctx.onPositionChange!("_heroVenueRow", p) : undefined}
            className="flex items-center justify-center gap-2 mt-3 text-sm sm:text-base opacity-80"
          >
            <MapPin className="h-4 w-4 flex-shrink-0" style={{ pointerEvents: "none" }} />
            <EditableText
              editable={ctx.editable}
              value={data.customText._heroVenue ?? ""}
              defaultValue={[data.couple.venue, data.couple.venueCity, data.couple.venueState].filter(Boolean).join(", ")}
              onCommit={(v) => ctx.onTextChange("_heroVenue", v)}
              style={{ color: "inherit" }}
              {...tsp(ctx, "_heroVenue")}
            />
          </DraggableRow>
        )}
        {data.couple.weddingDate && (
          <DraggableRow
            editable={ctx.editable}
            position={ctx.textPositions?.["_countdown"]}
            onPositionChange={ctx.onPositionChange ? (p) => ctx.onPositionChange!("_countdown", p) : undefined}
          >
            <CountdownTimer
              dateStr={data.couple.weddingDate}
              accentColor={data.heroImage ? "rgba(255,255,255,0.9)" : data.colorPalette.primary}
            />
          </DraggableRow>
        )}
        <AddToCalendarButton data={data} />

        {/* Custom floating text boxes */}
        {Object.entries(data.customText)
          .filter(([k, v]) => {
            if (!k.startsWith("_custom_")) return false;
            // In guest mode, skip boxes that still have the placeholder text
            if (!ctx.editable) return !!v?.trim() && v.trim() !== "New text — click to edit";
            return true;
          })
          .map(([key, val]) => (
            <div key={key} style={{ marginTop: 16 }}>
              <EditableText
                as="div"
                editable={ctx.editable}
                value={val}
                defaultValue="New text — click to edit"
                onCommit={(v) => ctx.onTextChange(key, v || "New text — click to edit")}
                style={{
                  display: "inline-block",
                  background: "rgba(255,255,255,0.85)",
                  color: "#222",
                  padding: "6px 14px",
                  borderRadius: 8,
                  boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
                  fontSize: 18,
                  minWidth: 80,
                }}
                {...tsp(ctx, key, true)}
              />
            </div>
          ))
        }
      </div>
    </section>
  );
}

function SectionShell({
  id,
  titleKey,
  defaultTitle,
  icon,
  children,
  data,
  ctx,
}: {
  id: string;
  titleKey: string;
  defaultTitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  data: WebsiteRendererPayload;
  ctx: EditCtx;
}) {
  return (
    <section id={id} className="py-20 px-6" style={{ background: id === "gallery" ? data.colorPalette.neutral : data.colorPalette.background }}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-center gap-2 mb-3" style={{ color: data.colorPalette.primary }}>
          {icon}
          <EditableText
            editable={ctx.editable}
            value={data.customText[titleKey] ?? ""}
            defaultValue={defaultTitle}
            onCommit={(v) => ctx.onTextChange(titleKey, v)}
            className="uppercase tracking-[0.25em] text-xs"
          />
        </div>
        <div className="w-12 h-px mx-auto mb-12" style={{ background: data.colorPalette.primary }} />
        {children}
      </div>
    </section>
  );
}

function Welcome({ data, ctx }: { data: WebsiteRendererPayload; ctx: EditCtx }) {
  const text = data.customText.welcome ?? "";
  // In edit mode, always render so the user has somewhere to type. In
  // public mode, hide the section if there's no text.
  if (!text && !ctx.editable) return null;
  return (
    <SectionShell id="welcome" titleKey="welcome_title" defaultTitle="Welcome" icon={<Heart className="h-4 w-4" />} data={data} ctx={ctx}>
      <EditableText
        as="div"
        multiline
        editable={ctx.editable}
        value={text}
        defaultValue={ctx.editable ? "Click to write a warm welcome for your guests..." : ""}
        onCommit={(v) => ctx.onTextChange("welcome", v)}
        className="text-center text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto whitespace-pre-line"
        style={{ color: data.colorPalette.text, fontFamily: bodyFontStack(bodyFont(data)) }}
        {...tsp(ctx, "welcome")}
      />
    </SectionShell>
  );
}

function Story({ data, ctx }: { data: WebsiteRendererPayload; ctx: EditCtx }) {
  const text = data.customText.story ?? "";
  if (!text && !ctx.editable) return null;
  return (
    <SectionShell id="story" titleKey="story_title" defaultTitle="Our Story" icon={<Heart className="h-4 w-4" />} data={data} ctx={ctx}>
      <EditableText
        as="div"
        editable={ctx.editable}
        value={data.customText.story_subtitle ?? ""}
        defaultValue="How we got here"
        onCommit={(v) => ctx.onTextChange("story_subtitle", v)}
        className="block text-center text-3xl sm:text-4xl mb-8"
        style={{ fontFamily: elementFontStack(data, "story_subtitle", headingFont(data), "heading"), color: data.colorPalette.text }}
        {...tsp(ctx, "story_subtitle")}
      />
      <EditableText
        as="div"
        multiline
        editable={ctx.editable}
        value={text}
        defaultValue={ctx.editable ? "Tell guests how you two met, your story, your journey..." : ""}
        onCommit={(v) => ctx.onTextChange("story", v)}
        className="text-center text-base sm:text-lg leading-relaxed max-w-2xl mx-auto whitespace-pre-line"
        style={{ color: data.colorPalette.text, fontFamily: bodyFontStack(bodyFont(data)) }}
        {...tsp(ctx, "story")}
      />
    </SectionShell>
  );
}

function Schedule({ data, ctx }: { data: WebsiteRendererPayload; ctx: EditCtx }) {
  const customSchedule = data.customText.schedule ?? "";
  const ceremonyTime = (data.customText._scheduleCeremonyTime ?? "").trim() || data.couple.ceremonyTime || "";
  const cocktailTime = (data.customText._scheduleCocktailTime ?? "").trim();
  const receptionTime = (data.customText._scheduleReceptionTime ?? "").trim() || data.couple.receptionTime || "";
  const items: Array<{ key: string; label: string; Icon: typeof Heart; time: string }> = [
    { key: "_scheduleCeremonyTime", label: "Ceremony",     Icon: Heart,            time: ceremonyTime },
    { key: "_scheduleCocktailTime", label: "Cocktail Hour", Icon: Wine,             time: cocktailTime },
    { key: "_scheduleReceptionTime", label: "Reception",    Icon: UtensilsCrossed,  time: receptionTime },
  ];
  const visibleItems = ctx.editable ? items : items.filter((i) => i.time);
  if (!ctx.editable && visibleItems.length === 0 && !customSchedule) return null;
  return (
    <SectionShell id="schedule" titleKey="schedule_title" defaultTitle="Schedule" icon={<Clock className="h-4 w-4" />} data={data} ctx={ctx}>
      <div className="max-w-2xl mx-auto">
        <div className="space-y-3 mb-8">
          {visibleItems.map((it, idx) => (
            <div
              key={it.key}
              className="flex gap-4 items-center py-3"
              style={{
                borderBottom: idx < visibleItems.length - 1 ? `1px solid ${data.colorPalette.primary}22` : "none",
              }}
            >
              <div
                className="flex items-center justify-center w-9 h-9 rounded-full flex-shrink-0"
                style={{ background: `${data.colorPalette.primary}15`, color: data.colorPalette.primary }}
              >
                <it.Icon className="h-4 w-4" />
              </div>
              <div className="w-28 text-sm font-medium" style={{ color: data.colorPalette.primary }}>
                <EditableText
                  editable={ctx.editable}
                  value={data.customText[it.key] ?? ""}
                  defaultValue={it.time || (ctx.editable ? "Add time" : "")}
                  onCommit={(v) => ctx.onTextChange(it.key, v)}
                />
              </div>
              <div className="flex-1 text-base" style={{ color: data.colorPalette.text }}>{it.label}</div>
            </div>
          ))}
        </div>
        {/* Optional free-form notes below the schedule */}
        <EditableText
          as="div"
          multiline
          editable={ctx.editable}
          value={customSchedule}
          defaultValue={ctx.editable ? "Add any extra schedule notes — dress code, parking, after-party, etc." : ""}
          onCommit={(v) => ctx.onTextChange("schedule", v)}
          className="text-center text-base sm:text-lg leading-relaxed whitespace-pre-line"
          style={{ color: data.colorPalette.text, fontFamily: bodyFontStack(bodyFont(data)) }}
          {...tsp(ctx, "schedule")}
        />
      </div>
    </SectionShell>
  );
}

function Travel({ data, ctx }: { data: WebsiteRendererPayload; ctx: EditCtx }) {
  const text = data.customText.travel ?? "";
  if (!text && !data.couple.venue && !ctx.editable) return null;
  return (
    <SectionShell id="travel" titleKey="travel_title" defaultTitle="Travel & Venue" icon={<MapPin className="h-4 w-4" />} data={data} ctx={ctx}>
      <EditableText
        as="div"
        editable={ctx.editable}
        value={data.customText.travel_subtitle ?? ""}
        defaultValue="Where & how to get there"
        onCommit={(v) => ctx.onTextChange("travel_subtitle", v)}
        className="block text-center text-3xl sm:text-4xl mb-8"
        style={{ fontFamily: elementFontStack(data, "travel_subtitle", headingFont(data), "heading"), color: data.colorPalette.text }}
        {...tsp(ctx, "travel_subtitle")}
      />
      {data.couple.venue && (
        <div className="text-center mb-6">
          <div className="text-xl mb-1" style={{ color: data.colorPalette.text }}>{data.couple.venue}</div>
          {data.couple.location && (
            <div className="text-sm opacity-75 mb-3" style={{ color: data.colorPalette.text }}>
              {data.couple.location}
            </div>
          )}
          <a
            href={`https://www.google.com/maps/search/${encodeURIComponent([data.couple.venue, data.couple.venueCity, data.couple.venueState, data.couple.location].filter(Boolean).join(", "))}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-70"
            style={{ color: data.colorPalette.primary }}
          >
            <Navigation className="h-3.5 w-3.5" />
            Open in Google Maps
          </a>
        </div>
      )}
      <EditableText
        as="div"
        multiline
        editable={ctx.editable}
        value={text}
        defaultValue={ctx.editable ? "Add hotel recommendations, parking info, directions..." : ""}
        onCommit={(v) => ctx.onTextChange("travel", v)}
        className="text-center text-base sm:text-lg leading-relaxed max-w-2xl mx-auto whitespace-pre-line"
        style={{ color: data.colorPalette.text, fontFamily: bodyFontStack(bodyFont(data)) }}
        {...tsp(ctx, "travel")}
      />
    </SectionShell>
  );
}

function Registry({ data, ctx }: { data: WebsiteRendererPayload; ctx: EditCtx }) {
  const text = data.customText.registry ?? "";
  const links = parseRegistryLinks(data.customText._registryLinks);
  if (!text && links.length === 0 && !ctx.editable) return null;
  return (
    <SectionShell id="registry" titleKey="registry_title" defaultTitle="Registry" icon={<Gift className="h-4 w-4" />} data={data} ctx={ctx}>
      <EditableText
        as="div"
        editable={ctx.editable}
        value={data.customText.registry_subtitle ?? ""}
        defaultValue="With love"
        onCommit={(v) => ctx.onTextChange("registry_subtitle", v)}
        className="block text-center text-3xl sm:text-4xl mb-8"
        style={{ fontFamily: elementFontStack(data, "registry_subtitle", headingFont(data), "heading"), color: data.colorPalette.text }}
        {...tsp(ctx, "registry_subtitle")}
      />
      {links.length > 0 && (
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {links.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-opacity hover:opacity-80"
              style={{
                background: `${data.colorPalette.primary}15`,
                border: `1.5px solid ${data.colorPalette.primary}`,
                color: data.colorPalette.primary,
                fontFamily: bodyFontStack(bodyFont(data)),
              }}
            >
              {link.name}
              <ExternalLink className="h-3.5 w-3.5 opacity-70" />
            </a>
          ))}
        </div>
      )}
      {(text || ctx.editable) && (
        <EditableText
          as="div"
          multiline
          editable={ctx.editable}
          value={text}
          defaultValue={ctx.editable ? "Add a note about your registry or gift preferences..." : ""}
          onCommit={(v) => ctx.onTextChange("registry", v)}
          className="text-center text-base sm:text-lg leading-relaxed max-w-2xl mx-auto whitespace-pre-line"
          style={{ color: data.colorPalette.text, fontFamily: bodyFontStack(bodyFont(data)) }}
          {...tsp(ctx, "registry")}
        />
      )}
    </SectionShell>
  );
}

function Faq({ data, ctx }: { data: WebsiteRendererPayload; ctx: EditCtx }) {
  const text = data.customText.faq ?? "";
  if (!text && !ctx.editable) return null;
  return (
    <SectionShell id="faq" titleKey="faq_title" defaultTitle="FAQ" icon={<HelpCircle className="h-4 w-4" />} data={data} ctx={ctx}>
      <EditableText
        as="div"
        editable={ctx.editable}
        value={data.customText.faq_subtitle ?? ""}
        defaultValue="Good to know"
        onCommit={(v) => ctx.onTextChange("faq_subtitle", v)}
        className="block text-center text-3xl sm:text-4xl mb-8"
        style={{ fontFamily: elementFontStack(data, "faq_subtitle", headingFont(data), "heading"), color: data.colorPalette.text }}
        {...tsp(ctx, "faq_subtitle")}
      />
      <EditableText
        as="div"
        multiline
        editable={ctx.editable}
        value={text}
        defaultValue={ctx.editable ? "Answer common guest questions: dress code, parking, kids welcome, plus-ones..." : ""}
        onCommit={(v) => ctx.onTextChange("faq", v)}
        className="text-center text-base sm:text-lg leading-relaxed max-w-2xl mx-auto whitespace-pre-line"
        style={{ color: data.colorPalette.text, fontFamily: bodyFontStack(bodyFont(data)) }}
        {...tsp(ctx, "faq")}
      />
    </SectionShell>
  );
}

function Gallery({ data, ctx }: { data: WebsiteRendererPayload; ctx: EditCtx }) {
  const images = (data.galleryImages ?? []).slice().sort((a, b) => a.order - b.order);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  if (images.length === 0 && !ctx.editable) return null;
  return (
    <SectionShell id="gallery" titleKey="gallery_title" defaultTitle="Gallery" icon={<ImageIcon className="h-4 w-4" />} data={data} ctx={ctx}>
      {lightboxIndex !== null && (
        <Lightbox
          images={images}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
      <EditableText
        as="div"
        editable={ctx.editable}
        value={data.customText.gallery_subtitle ?? ""}
        defaultValue="Moments"
        onCommit={(v) => ctx.onTextChange("gallery_subtitle", v)}
        className="block text-center text-3xl sm:text-4xl mb-10"
        style={{ fontFamily: elementFontStack(data, "gallery_subtitle", headingFont(data), "heading"), color: data.colorPalette.text }}
        {...tsp(ctx, "gallery_subtitle")}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {images.map((img, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setLightboxIndex(i)}
            className="relative aspect-square overflow-hidden rounded-lg group focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ ["--tw-ring-color" as string]: data.colorPalette.primary }}
            aria-label={img.caption ?? `Photo ${i + 1}`}
          >
            <img
              src={imageUrl(img.url)}
              alt={img.caption ?? ""}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <ImageIcon className="h-6 w-6 text-white opacity-0 group-hover:opacity-80 transition-opacity" />
            </div>
            {img.caption && (
              <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/60 to-transparent text-white text-sm opacity-0 group-hover:opacity-100 transition-opacity text-left">
                {img.caption}
              </div>
            )}
          </button>
        ))}
      </div>
    </SectionShell>
  );
}

export type WeddingPartySide = "groom" | "bride" | "family";

export interface WeddingPartyMember {
  photo: string;
  name: string;
  role: string;
  side?: WeddingPartySide;
  // Photo focal point as percentages 0–100. Defaults to 50/50 (centered).
  photoX?: number;
  photoY?: number;
}

export function parseWeddingPartyMembers(raw: string | undefined): WeddingPartyMember[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m) => m && typeof m === "object")
      .map((m) => ({
        photo: typeof m.photo === "string" ? m.photo : "",
        name: typeof m.name === "string" ? m.name : "",
        role: typeof m.role === "string" ? m.role : "",
        side: m.side === "groom" || m.side === "bride" || m.side === "family" ? m.side : undefined,
        photoX: typeof m.photoX === "number" ? Math.max(0, Math.min(100, m.photoX)) : undefined,
        photoY: typeof m.photoY === "number" ? Math.max(0, Math.min(100, m.photoY)) : undefined,
      }));
  } catch {
    return [];
  }
}

function PartyMemberCard({ data, member }: { data: WebsiteRendererPayload; member: WeddingPartyMember }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div
        className="w-32 h-32 sm:w-36 sm:h-36 rounded-full overflow-hidden mb-4 flex items-center justify-center"
        style={{ background: `${data.colorPalette.primary}15`, border: `1px solid ${data.colorPalette.primary}33` }}
      >
        {member.photo ? (
          <img
            src={imageUrl(member.photo)}
            alt={member.name}
            className="w-full h-full object-cover"
            style={{ objectPosition: `${member.photoX ?? 50}% ${member.photoY ?? 50}%` }}
            loading="lazy"
          />
        ) : (
          <Heart className="h-8 w-8 opacity-30" style={{ color: data.colorPalette.primary }} />
        )}
      </div>
      <div className="text-2xl sm:text-3xl mb-1" style={{ fontFamily: fontStack(headingFont(data)), color: data.colorPalette.primary }}>
        {member.name || "Name"}
      </div>
      <div className="text-sm opacity-80" style={{ color: data.colorPalette.text, fontFamily: bodyFontStack(bodyFont(data)) }}>
        {member.role || "Role"}
      </div>
    </div>
  );
}

function WeddingParty({ data, ctx }: { data: WebsiteRendererPayload; ctx: EditCtx }) {
  // Portal party members take precedence over manually-entered ones
  const members: WeddingPartyMember[] = data.portalParty && data.portalParty.length > 0
    ? data.portalParty.map((m) => ({
        photo: m.photoUrl ?? "",
        name: m.name,
        role: m.role,
        side: (m.side === "groom" || m.side === "bride" || m.side === "family") ? m.side as WeddingPartySide : undefined,
      }))
    : parseWeddingPartyMembers(data.customText._weddingPartyMembers);
  if (members.length === 0 && !ctx.editable) return null;

  const groomSide = members.filter((m) => m.side === "groom");
  const brideSide = members.filter((m) => m.side === "bride");
  const familySide = members.filter((m) => m.side === "family" || !m.side);

  return (
    <SectionShell id="weddingParty" titleKey="weddingParty_title" defaultTitle="Wedding Party" icon={<Heart className="h-4 w-4" />} data={data} ctx={ctx}>
      <EditableText
        as="div"
        editable={ctx.editable}
        value={data.customText.weddingParty_subtitle ?? ""}
        defaultValue="Meet our family & friends standing with us"
        onCommit={(v) => ctx.onTextChange("weddingParty_subtitle", v)}
        className="block text-center text-base sm:text-lg max-w-2xl mx-auto mb-12 opacity-80"
        style={{ color: data.colorPalette.text, fontFamily: elementFontStack(data, "weddingParty_subtitle", bodyFont(data), "body") }}
        {...tsp(ctx, "weddingParty_subtitle")}
      />
      {members.length === 0 ? (
        <p className="text-center text-sm opacity-60" style={{ color: data.colorPalette.text }}>
          No wedding party members yet — add some from the sidebar.
        </p>
      ) : (
        <div className="space-y-16">
          {(groomSide.length > 0 || brideSide.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-0 max-w-5xl mx-auto relative">
              {/* Groom's side */}
              <div className="md:pr-12 md:border-r" style={{ borderColor: `${data.colorPalette.primary}33` }}>
                <h3
                  className="text-center text-2xl sm:text-3xl mb-10"
                  style={{ fontFamily: fontStack(headingFont(data)), color: data.colorPalette.text }}
                >
                  <EditableText
                    editable={ctx.editable}
                    value={data.customText.weddingParty_groomLabel ?? ""}
                    defaultValue="Groom's Party"
                    onCommit={(v) => ctx.onTextChange("weddingParty_groomLabel", v)}
                  />
                </h3>
                {groomSide.length === 0 ? (
                  <p className="text-center text-xs opacity-50" style={{ color: data.colorPalette.text }}>
                    {ctx.editable ? "Add members from the sidebar with side set to “Groom”" : ""}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-10">
                    {groomSide.map((m, i) => (
                      <PartyMemberCard key={`g-${i}`} data={data} member={m} />
                    ))}
                  </div>
                )}
              </div>

              {/* Bride's side */}
              <div className="md:pl-12">
                <h3
                  className="text-center text-2xl sm:text-3xl mb-10"
                  style={{ fontFamily: fontStack(headingFont(data)), color: data.colorPalette.text }}
                >
                  <EditableText
                    editable={ctx.editable}
                    value={data.customText.weddingParty_brideLabel ?? ""}
                    defaultValue="Bride's Party"
                    onCommit={(v) => ctx.onTextChange("weddingParty_brideLabel", v)}
                  />
                </h3>
                {brideSide.length === 0 ? (
                  <p className="text-center text-xs opacity-50" style={{ color: data.colorPalette.text }}>
                    {ctx.editable ? "Add members from the sidebar with side set to “Bride”" : ""}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-10">
                    {brideSide.map((m, i) => (
                      <PartyMemberCard key={`b-${i}`} data={data} member={m} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {familySide.length > 0 && (
            <div className="max-w-4xl mx-auto">
              <h3
                className="text-center text-2xl sm:text-3xl mb-10"
                style={{ fontFamily: fontStack(headingFont(data)), color: data.colorPalette.text }}
              >
                <EditableText
                  editable={ctx.editable}
                  value={data.customText.weddingParty_familyLabel ?? ""}
                  defaultValue="Family & Friends"
                  onCommit={(v) => ctx.onTextChange("weddingParty_familyLabel", v)}
                />
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-10">
                {familySide.map((m, i) => (
                  <PartyMemberCard key={`f-${i}`} data={data} member={m} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </SectionShell>
  );
}

function Footer({ data, ctx }: { data: WebsiteRendererPayload; ctx: EditCtx }) {
  const couple = `${data.couple.partner1Name} & ${data.couple.partner2Name}`;
  const dateStr = formatWeddingDate(data.couple.weddingDate);
  return (
    <>
      <footer className="py-12 px-6 text-center" style={{ background: data.colorPalette.primary, color: "#fff" }}>
        <EditableText
          as="div"
          editable={ctx.editable}
          value={data.customText._footerCoupleName ?? ""}
          defaultValue={couple}
          onCommit={(v) => ctx.onTextChange("_footerCoupleName", v)}
          className="text-2xl mb-2"
          style={{ fontFamily: fontStack(headingFont(data)), color: "#fff" }}
          {...tsp(ctx, "_footerCoupleName")}
        />
        <EditableText
          as="div"
          editable={ctx.editable}
          value={data.customText._footerText ?? ""}
          defaultValue={dateStr}
          onCommit={(v) => ctx.onTextChange("_footerText", v)}
          className="text-sm opacity-80 whitespace-pre-line"
          {...tsp(ctx, "_footerText")}
        />
      </footer>
      <BrandingFooter />
    </>
  );
}

function BrandingFooter() {
  return (
    <div className="py-6 px-6 text-center bg-[#1E1A2E] text-white/80">
      <a
        href="https://aidowedding.net?utm_source=wedding_website&utm_medium=footer"
        target="_blank"
        rel="noopener"
        className="inline-flex items-center gap-2 text-xs hover:text-white transition-colors group"
      >
        <span className="opacity-70">Built with</span>
        <img src="/logo.png" alt="A.IDO" className="h-5 w-5 rounded-full" />
        <span className="font-medium tracking-wide" style={{ color: "#D4A017" }}>
          A.IDO
        </span>
        <span className="opacity-50 group-hover:opacity-80 transition-opacity">— Plan your wedding too →</span>
      </a>
    </div>
  );
}

function TopNav({
  data,
  scrollContainer,
  pageMode,
  slug,
  currentSection,
}: {
  data: WebsiteRendererPayload;
  scrollContainer?: HTMLElement | null;
  pageMode: boolean;
  slug?: string;
  currentSection: string;
}) {
  const couple = `${data.couple.partner1Name} & ${data.couple.partner2Name}`;
  const [scrollActive, setScrollActive] = useState<string>("home");

  // Build the ordered list of nav items only for sections that are enabled.
  const items: Array<{ id: string; label: string }> = [{ id: "home", label: "Home" }];
  if (data.sectionsEnabled.story) items.push({ id: "story", label: "Our Story" });
  if (data.sectionsEnabled.schedule) items.push({ id: "schedule", label: "Schedule" });
  if (data.sectionsEnabled.travel) items.push({ id: "travel", label: "Travel" });
  if (data.sectionsEnabled.registry) items.push({ id: "registry", label: "Registry" });
  if (data.sectionsEnabled.weddingParty) items.push({ id: "weddingParty", label: "Wedding Party" });
  if (data.sectionsEnabled.gallery) items.push({ id: "gallery", label: "Gallery" });
  if (data.sectionsEnabled.faq) items.push({ id: "faq", label: "FAQ" });
  // RSVP is always available — it's the whole point of the site for guests.
  items.push({ id: "rsvp", label: "RSVP" });

  // Anchor-scroll mode (used by editor preview): track the visible section
  // with IntersectionObserver to underline the right item.
  useEffect(() => {
    if (pageMode) return;
    const root = scrollContainer ?? null;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setScrollActive(visible[0].target.id);
      },
      { root, rootMargin: "-30% 0px -50% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    items.forEach((it) => {
      const el = scrollContainer
        ? (scrollContainer.querySelector(`#${CSS.escape(it.id)}`) as HTMLElement | null)
        : document.getElementById(it.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageMode, data.sectionsEnabled, scrollContainer]);

  const scrollTo = (id: string) => {
    // Scope the lookup to scrollContainer when one is provided so two simultaneous
    // renderers (e.g. live editor + Guest Preview overlay) don't collide on duplicate IDs.
    const el = scrollContainer
      ? (scrollContainer.querySelector(`#${CSS.escape(id)}`) as HTMLElement | null)
      : document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setScrollActive(id);
  };

  const active = pageMode ? currentSection : scrollActive;

  const renderItem = (it: { id: string; label: string }) => {
    const className = `relative pb-1 font-semibold transition-colors hover:opacity-80 ${active === it.id ? "" : "opacity-70"}`;
    const style = {
      color: data.colorPalette.text,
      borderBottom: active === it.id ? `2px solid ${data.colorPalette.primary}` : "2px solid transparent",
      fontFamily: fontStack(headingFont(data)),
      fontWeight: 600,
    };
    if (slug) {
      const seg = urlSegmentForSection(it.id);
      const href = seg ? `/w/${slug}/${seg}` : `/w/${slug}`;
      return (
        <Link key={it.id} href={href} className={className} style={style}>
          {it.label}
        </Link>
      );
    }
    return (
      <button key={it.id} onClick={() => scrollTo(it.id)} className={className} style={style}>
        {it.label}
      </button>
    );
  };

  const homeHref = slug ? `/w/${slug}` : undefined;

  return (
    <nav
      className="sticky top-0 z-30 backdrop-blur-md border-b"
      style={{
        background: `${data.colorPalette.background}ee`,
        borderColor: `${data.colorPalette.primary}22`,
      }}
    >
      <div className="max-w-5xl mx-auto px-4 py-3 sm:py-4 flex flex-col items-center gap-2">
        {homeHref ? (
          <Link
            href={homeHref}
            className="text-2xl sm:text-3xl leading-tight transition-colors hover:opacity-80"
            style={{ fontFamily: fontStack(headingFont(data)), color: data.colorPalette.primary }}
          >
            {couple}
          </Link>
        ) : (
          <button
            onClick={() => scrollTo("home")}
            className="text-2xl sm:text-3xl leading-tight transition-colors hover:opacity-80"
            style={{ fontFamily: fontStack(headingFont(data)), color: data.colorPalette.primary }}
          >
            {couple}
          </button>
        )}
        <div className="flex flex-wrap items-center justify-center gap-x-5 sm:gap-x-7 gap-y-1 text-xs sm:text-sm">
          {items.map(renderItem)}
        </div>
      </div>
    </nav>
  );
}

export function WebsiteRenderer({
  data,
  scrollContainer,
  editable = false,
  onTextChange,
  onStyleChange,
  onPositionChange,
  onDeleteElement,
  currentSection,
  slug,
  password,
  previewMode = false,
}: {
  data: WebsiteRendererPayload;
  scrollContainer?: HTMLElement | null;
  editable?: boolean;
  onTextChange?: (key: string, value: string) => void;
  onStyleChange?: (key: string, style: TextStyle) => void;
  onPositionChange?: (key: string, position: TextPosition) => void;
  onDeleteElement?: (key: string) => void;
  currentSection?: string;
  slug?: string;
  password?: string | null;
  // Force scroll-based nav even when slug is provided (used by editor guest preview)
  previewMode?: boolean;
}) {
  const ctx: EditCtx = editable && onTextChange
    ? { editable: true, onTextChange, textStyles: data.textStyles, onStyleChange, textPositions: data.textPositions, onPositionChange, onDeleteElement }
    : NOOP_CTX;

  // Dynamically load the chosen heading + body Google Fonts so that fonts not
  // preloaded in index.html (e.g. Tangerine, Great Vibes, Allura) actually render.
  const headingFontName = headingFont(data);
  const bodyFontName = bodyFont(data);
  useEffect(() => {
    const families = Array.from(new Set([headingFontName, bodyFontName].filter(Boolean)));
    families.forEach((family) => {
      const id = `aido-font-${family.replace(/\s+/g, "-").toLowerCase()}`;
      if (document.getElementById(id)) return;
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@400;500;600;700&display=swap`;
      document.head.appendChild(link);
    });
  }, [headingFontName, bodyFontName]);

  const pageMode = !!currentSection;
  const showAll = !pageMode;
  const show = (id: string, enabled: boolean) =>
    enabled && (showAll || currentSection === id);
  // In previewMode, force scroll-based nav so TopNav buttons don't navigate away
  const navSlug = previewMode ? undefined : slug;

  return (
    <div style={{ background: data.colorPalette.background, color: data.colorPalette.text, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <AnnouncementBanner data={data} />
      <TopNav
        data={data}
        scrollContainer={scrollContainer}
        pageMode={pageMode}
        slug={navSlug}
        currentSection={currentSection ?? "home"}
      />
      {(showAll || currentSection === "home") && <Hero data={data} ctx={ctx} />}
      {show("welcome", data.sectionsEnabled.welcome) && <Welcome data={data} ctx={ctx} />}
      {show("story", data.sectionsEnabled.story) && <Story data={data} ctx={ctx} />}
      {show("schedule", data.sectionsEnabled.schedule) && <Schedule data={data} ctx={ctx} />}
      {show("travel", data.sectionsEnabled.travel) && <Travel data={data} ctx={ctx} />}
      {show("registry", data.sectionsEnabled.registry) && <Registry data={data} ctx={ctx} />}
      {show("weddingParty", data.sectionsEnabled.weddingParty) && <WeddingParty data={data} ctx={ctx} />}
      {show("faq", data.sectionsEnabled.faq) && <Faq data={data} ctx={ctx} />}
      {show("gallery", data.sectionsEnabled.gallery) && <Gallery data={data} ctx={ctx} />}
      {(showAll || currentSection === "rsvp") && (
        slug
          ? <RsvpFlow data={data} slug={slug} password={password ?? undefined} previewMode={previewMode} />
          : <RsvpSection data={data} ctx={ctx} />
      )}
      <Footer data={data} ctx={ctx} />
    </div>
  );
}
