import {
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link } from "wouter";
import {
  Calendar,
  MapPin,
  Heart,
  Clock,
  Gift,
  HelpCircle,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  X,
  ExternalLink,
  Navigation,
  CheckCircle2,
  Wine,
  UtensilsCrossed,
  Bed,
  Share2,
  Check,
} from "lucide-react";
import {
  EditableText,
  emitEditableDrag,
  type TextPosition,
} from "./EditableText";
import { isEditableHiddenMarker } from "./hiddenMarker";
import { RsvpFlow } from "./RsvpFlow";
import { apiFetch, authFetch } from "@/lib/authFetch";
import { resolveMediaUrl, isMediaAuthRequired } from "@/lib/mediaUrl";
import { AuthMediaImage } from "@/components/AuthMediaImage";

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
  Object.entries(SECTION_TO_URL).map(([k, v]) => [v, k]),
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
  textStyles?: Record<
    string,
    {
      fontFamily?: string;
      fontSize?: string;
      color?: string;
      bold?: boolean;
      italic?: boolean;
      animation?: string;
    }
  >;
  textPositions?: Record<string, { x: number; y: number }>;
  // Wedding party members synced from the portal (takes precedence over customText._weddingPartyMembers)
  portalParty?: Array<{
    id: number;
    name: string;
    role: string;
    side: string;
    photoUrl: string | null;
    sortOrder: number;
  }>;
  hotelOptions?: Array<{
    id: number;
    hotelName: string;
    bookingLink?: string | null;
    discountCode?: string | null;
    groupName?: string | null;
    cutoffDate?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  }>;
  mealOptions?: Array<{ value: string; label: string }>;
  galleryImages: Array<{ url: string; caption?: string; order: number }>;
  heroImages?: Array<{ url: string; order: number }>;
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

function formatTime12h(time: string): string {
  if (!time) return time;
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return time;
  const h = parseInt(match[1], 10);
  const min = match[2];
  if (h < 0 || h > 23) return time;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return min === "00" ? `${hour12} ${period}` : `${hour12}:${min} ${period}`;
}

type TextStyle = {
  fontFamily?: string;
  fontSize?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  animation?: string;
};

// Edit mode props passed to every section (and its EditableText spans).
interface EditCtx {
  editable: boolean;
  // True when rendered inside the editor's fullscreen "Preview" popup. The
  // editor wants to show the section's layout (heading, tall background, etc.)
  // even if the user hasn't filled in the body yet, but the public site
  // should still hide empty sections from guests.
  previewMode?: boolean;
  onTextChange: (key: string, value: string) => void;
  textStyles?: Record<string, TextStyle>;
  onStyleChange?: (key: string, style: TextStyle) => void;
  textPositions?: Record<string, TextPosition>;
  onPositionChange?: (key: string, position: TextPosition) => void;
  onDeleteElement?: (key: string) => void;
  onGalleryCaptionChange?: (imageUrl: string, caption: string) => void;
}
const NOOP_CTX: EditCtx = { editable: false, onTextChange: () => {} };

// Returns textStyle + onStyleChange + position + onPositionChange + onDelete props for an EditableText.
// Every editable text now wires up the trash drop. For custom text boxes
// (keys prefixed with "_custom_") the editor fully removes the row; for
// default fields it stores the hidden marker so the value visibly empties
// (and the EditableText wrap auto-hides via its empty-state path).
function tsp(ctx: EditCtx, key: string, _deletable = false) {
  if (!ctx.editable)
    return {
      textStyle: ctx.textStyles?.[key],
      position: ctx.textPositions?.[key],
    };
  return {
    textStyle: ctx.textStyles?.[key] ?? {},
    onStyleChange: ctx.onStyleChange
      ? (s: TextStyle) => ctx.onStyleChange!(key, s)
      : undefined,
    position: ctx.textPositions?.[key],
    onPositionChange: ctx.onPositionChange
      ? (p: TextPosition) => ctx.onPositionChange!(key, p)
      : undefined,
    onDelete: ctx.onDeleteElement ? () => ctx.onDeleteElement!(key) : undefined,
    aiEnabled: true,
  };
}

// Style-only variant for EditableTexts already wrapped in a DraggableRow.
// The row owns position for the whole group; wiring position onto the inner
// text would let users drag just the text and leave the row icon behind.
// No onDelete: hero row elements are hidden/shown only via sidebar toggles.
function tspStyle(ctx: EditCtx, key: string) {
  if (!ctx.editable) return { textStyle: ctx.textStyles?.[key] };
  return {
    textStyle: ctx.textStyles?.[key] ?? {},
    onStyleChange: ctx.onStyleChange
      ? (s: TextStyle) => ctx.onStyleChange!(key, s)
      : undefined,
    aiEnabled: false as const,
  };
}

// Style-only, no delete, no drag — for hero elements that must stay
// centered. Visibility is controlled exclusively via sidebar toggles.
function tspNoDelete(ctx: EditCtx, key: string, aiEnabled = false) {
  if (!ctx.editable) return { textStyle: ctx.textStyles?.[key] };
  return {
    textStyle: ctx.textStyles?.[key] ?? {},
    onStyleChange: ctx.onStyleChange
      ? (s: TextStyle) => ctx.onStyleChange!(key, s)
      : undefined,
    aiEnabled,
  };
}

function fontStack(font: string): string {
  return `'${font}', 'Playfair Display', Georgia, serif`;
}

// Compose a section background that respects the user's opacity slider
// (customText._backgroundOpacity, 0-100). The base color stays the user's
// chosen hex; we just prefix it with an alpha so the hero image / page
// behind shows through. Returns the bare hex when opacity is 100 or unset.
function backgroundWithOpacity(
  data: WebsiteRendererPayload,
  baseColor?: string,
): string {
  const color = baseColor ?? data.colorPalette.background;
  const raw = data.customText._backgroundOpacity;
  const pct =
    raw === undefined || raw === ""
      ? 100
      : Math.max(0, Math.min(100, parseInt(raw, 10)));
  if (Number.isNaN(pct) || pct >= 100) return color;
  // Convert 0-100 percentage to a 2-digit hex alpha (00-FF).
  const alpha = Math.round((pct / 100) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  // Only valid for 6-digit hex colors. If the user picked something exotic
  // (rgba, hsl, etc.) we leave it alone rather than corrupt the value.
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  return `${color}${alpha}`;
}

function bodyFontStack(font: string): string {
  return `'${font}', system-ui, -apple-system, sans-serif`;
}

function hexIsLight(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length !== 6) return true;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 128;
}

function sectionTextColor(data: WebsiteRendererPayload, id: string): string {
  const bg =
    (id === "welcome"
      ? data.customText._welcomeBg
      : data.customText._sectionsBg) || data.colorPalette.neutral;
  return hexIsLight(bg) ? data.colorPalette.text : "#FFFFFF";
}

// Merges a base color into tsp/tspStyle results so EditableText inherits it
// even when no explicit textStyle.color is stored. User-set colors (spread last)
// override the base, so custom styling from the inline toolbar is preserved.
function withBaseColor<T extends { textStyle?: TextStyle }>(
  props: T,
  baseColor: string,
): T {
  return {
    ...props,
    textStyle: { color: baseColor, ...(props.textStyle ?? {}) },
  };
}

function imageUrl(url: string): string {
  return resolveMediaUrl(url) ?? url;
}

// Fetches a protected media URL as a blob so CSS background-image can use it.
// Falls back to the resolved URL when auth isn't required or fetch fails.
function useAuthBlobUrl(url: string | null | undefined): string | null {
  const resolved = resolveMediaUrl(url);
  const [blobSrc, setBlobSrc] = useState<string | null>(null);
  const blobRef = useRef<string | null>(null);

  useEffect(() => {
    if (blobRef.current) {
      URL.revokeObjectURL(blobRef.current);
      blobRef.current = null;
    }
    setBlobSrc(null);
    if (!resolved || !isMediaAuthRequired(url)) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(resolved);
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        const next = URL.createObjectURL(blob);
        blobRef.current = next;
        setBlobSrc(next);
      } catch {
        /* fall back to direct URL */
      }
    })();
    return () => {
      cancelled = true;
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
    };
  }, [resolved, url]);

  return blobSrc ?? resolved;
}

function headingFont(data: WebsiteRendererPayload): string {
  return (data.customText._headingFont || "").trim() || data.font;
}

function bodyFont(data: WebsiteRendererPayload): string {
  return (data.customText._bodyFont || "").trim() || "Inter";
}

// Returns the override font for an editable text element, or undefined to
// use the theme default. Used by EditableText's per-element font picker.
function elementFont(
  data: WebsiteRendererPayload,
  key: string,
): string | undefined {
  const v = (data.customText[`${key}_font`] || "").trim();
  return v || undefined;
}

// Compose a fontFamily string. If the element has its own override, use it.
// Otherwise fall back to the supplied default (heading or body).
function elementFontStack(
  data: WebsiteRendererPayload,
  key: string,
  fallbackFont: string,
  fallbackKind: "heading" | "body",
): string {
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
          onClick={(e) => {
            e.stopPropagation();
            prev();
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors"
          aria-label="Previous"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {index < images.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
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
        <AuthMediaImage
          src={img.url}
          alt={img.caption ?? ""}
          className="max-h-[80vh] max-w-full object-contain rounded-lg shadow-2xl"
        />
        {img.caption && (
          <p className="text-center text-white/80 text-sm mt-3 px-4">
            {img.caption}
          </p>
        )}
      </div>
      {images.length > 1 && (
        <div className="absolute bottom-5 flex gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                setIndex(i);
              }}
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

// Same rationale as EditableText: 5px was too touchy and a normal click
// could trip a drag mid-press. 12px feels more deliberate.
const DRAG_THRESHOLD_ROW = 12;

function DraggableRow({
  children,
  position,
  onPositionChange,
  onDelete,
  editable,
  className,
  style,
}: {
  children: React.ReactNode;
  position?: TextPosition;
  onPositionChange?: (p: TextPosition) => void;
  onDelete?: () => void;
  editable: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [hovered, setHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);
  const transform = position
    ? `translate(${position.x}px, ${position.y}px)`
    : undefined;

  if (!editable || !onPositionChange) {
    return (
      <div className={className} style={{ ...style, transform }}>
        {children}
      </div>
    );
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    // If the user pressed inside an inner EditableText (contenteditable),
    // don't hijack the pointer — let the inner element get focus and open
    // its own toolbar / inline drag. DraggableRow only captures pointer
    // events that originate on its own padding / icons.
    const target = e.target as HTMLElement | null;
    if (target?.closest('[contenteditable="true"]')) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: position?.x ?? 0,
      origY: position?.y ?? 0,
      moved: false,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    if (
      Math.abs(dx) > DRAG_THRESHOLD_ROW ||
      Math.abs(dy) > DRAG_THRESHOLD_ROW
    ) {
      if (!dragState.current.moved && onDelete) {
        // Trigger trash-zone reveal exactly the same way EditableText does.
        emitEditableDrag("start");
      }
      dragState.current.moved = true;
    }
    if (dragState.current.moved)
      onPositionChange({
        x: dragState.current.origX + dx,
        y: dragState.current.origY + dy,
      });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const wasDrag = dragState.current && dragState.current.moved;
    dragState.current = null;
    setIsDragging(false);
    if (wasDrag && onDelete) {
      emitEditableDrag("end");
      try {
        const trash = document.querySelector(
          '[data-aido-trash="true"]',
        ) as HTMLElement | null;
        if (trash) {
          const r = trash.getBoundingClientRect();
          const pad = 24;
          const inside =
            e.clientX >= r.left - pad &&
            e.clientX <= r.right + pad &&
            e.clientY >= r.top - pad &&
            e.clientY <= r.bottom + pad;
          if (inside) onDelete();
        }
      } catch {
        /* ignore */
      }
    }
  };

  const hasOffset = position && (position.x !== 0 || position.y !== 0);

  return (
    <div
      className={className}
      style={{
        ...style,
        transform,
        position: "relative",
        cursor: isDragging ? "grabbing" : "grab",
        outline:
          hovered || isDragging
            ? "1.5px dashed rgba(99,102,241,0.4)"
            : undefined,
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
          style={{
            position: "absolute",
            top: -20,
            right: 0,
            background: "rgba(99,102,241,0.9)",
            color: "#fff",
            borderRadius: 4,
            padding: "1px 6px",
            fontSize: 10,
            cursor: "pointer",
            userSelect: "none",
            zIndex: 300,
            lineHeight: 1.6,
          }}
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

// ---------- editable icon ----------

// Lets the editor change colour and size of a static icon (e.g. schedule
// section icons) without exposing any text or delete controls. Clicking the
// icon while editing opens a tiny popover with a colour picker and a size
// slider; values persist in customText[colourKey] / customText[sizeKey].
function EditableIcon({
  Icon,
  ctx,
  colorKey,
  sizeKey,
  defaultColor,
  defaultSizePx,
  customText,
  wrapperClassName,
  wrapperStyle,
}: {
  Icon: typeof Heart;
  ctx: EditCtx;
  colorKey: string;
  sizeKey: string;
  defaultColor: string;
  defaultSizePx: number;
  customText: Record<string, string>;
  wrapperClassName?: string;
  wrapperStyle?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const color = (customText[colorKey] || "").trim() || defaultColor;
  const sizeRaw = parseInt(customText[sizeKey] ?? "", 10);
  const size =
    Number.isFinite(sizeRaw) && sizeRaw > 0 ? sizeRaw : defaultSizePx;

  const iconEl = (
    <Icon style={{ width: size, height: size, color, pointerEvents: "none" }} />
  );

  if (!ctx.editable) {
    return (
      <div className={wrapperClassName} style={wrapperStyle}>
        {iconEl}
      </div>
    );
  }

  return (
    <div
      className={wrapperClassName}
      style={{ ...wrapperStyle, position: "relative" }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex items-center justify-center w-full h-full rounded-full transition-shadow hover:ring-2"
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: 0,
          lineHeight: 0,
        }}
        title="Change icon colour and size"
      >
        {iconEl}
      </button>
      {open && (
        <div
          className="absolute z-[400] mt-2 rounded-lg border border-border bg-popover shadow-lg p-2.5"
          style={{ top: "100%", left: 0, minWidth: 180 }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 mb-2">
            <label className="text-[11px] uppercase tracking-wide opacity-70">
              Colour
            </label>
            <input
              type="color"
              value={color}
              onChange={(e) => ctx.onTextChange(colorKey, e.target.value)}
              className="h-6 w-10 rounded cursor-pointer border border-border"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] uppercase tracking-wide opacity-70">
              Size
            </label>
            <input
              type="range"
              min={12}
              max={64}
              value={size}
              onChange={(e) => ctx.onTextChange(sizeKey, e.target.value)}
              className="flex-1"
            />
            <span className="text-[11px] tabular-nums w-8 text-right opacity-70">
              {size}px
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              ctx.onTextChange(colorKey, "");
              ctx.onTextChange(sizeKey, "");
            }}
            className="mt-2 text-[11px] underline opacity-60 hover:opacity-100"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2 ml-3 text-[11px] underline opacity-60 hover:opacity-100"
          >
            Done
          </button>
        </div>
      )}
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

function CountdownTimer({
  dateStr,
  accentColor,
  data,
  ctx,
}: {
  dateStr: string;
  accentColor: string;
  data: WebsiteRendererPayload;
  ctx: EditCtx;
}) {
  const [left, setLeft] = useState(() => calcTimeLeft(dateStr));
  useEffect(() => {
    const id = setInterval(() => setLeft(calcTimeLeft(dateStr)), 1000);
    return () => clearInterval(id);
  }, [dateStr]);
  if (!left) return null;
  const units: Array<{ key: string; label: string; value: number }> = [
    { key: "_countdownLabelDays", label: "Days", value: left.days },
    { key: "_countdownLabelHours", label: "Hours", value: left.hours },
    { key: "_countdownLabelMinutes", label: "Mins", value: left.minutes },
    { key: "_countdownLabelSeconds", label: "Secs", value: left.seconds },
  ];
  return (
    <div className="flex items-center justify-center gap-4 sm:gap-8 mt-8">
      {units.map(({ key, label, value }) => (
        <div key={label} className="flex flex-col items-center">
          <span
            className="text-3xl sm:text-5xl font-bold tabular-nums leading-none"
            style={{ color: accentColor }}
          >
            {String(value).padStart(2, "0")}
          </span>
          <EditableText
            as="span"
            editable={ctx.editable}
            value={label}
            defaultValue={label}
            readOnlyText
            aiEnabled={false}
            textStyle={data.textStyles?.[key]}
            onStyleChange={
              ctx.onStyleChange ? (s) => ctx.onStyleChange!(key, s) : undefined
            }
            className="text-[10px] sm:text-xs uppercase tracking-widest mt-2 opacity-70"
          />
        </div>
      ))}
    </div>
  );
}

// ---------- registry links ----------

export interface RegistryLink {
  name: string;
  url: string;
}

export function parseRegistryLinks(raw: string | undefined): RegistryLink[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l): l is RegistryLink =>
        l && typeof l.name === "string" && typeof l.url === "string",
    );
  } catch {
    return [];
  }
}

// ---------- add to calendar ----------

function buildIcs(
  couple: string,
  dateStr: string,
  ceremonyTime: string,
  venue: string,
  location: string,
): string {
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
  const couple = `${data.couple.partner2Name} & ${data.couple.partner1Name}`;

  function downloadIcs() {
    const ics = buildIcs(
      couple,
      data.couple.weddingDate,
      data.couple.ceremonyTime,
      data.couple.venue,
      data.couple.location,
    );
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wedding.ics";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  const [y, m, d] = data.couple.weddingDate.split("-").map(Number);
  const [h = 16, min = 0] = (data.couple.ceremonyTime || "16:00")
    .split(":")
    .map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const isoStart = `${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}:00`;
  const isoEnd = `${y}-${pad(m)}-${pad(d)}T${pad(h + 4)}:${pad(min)}:00`;
  const locStr = [data.couple.venue, data.couple.location]
    .filter(Boolean)
    .join(", ");
  const title = encodeURIComponent(`${couple}'s Wedding`);
  const desc = encodeURIComponent(
    `Join us to celebrate the wedding of ${couple}!`,
  );
  const loc = encodeURIComponent(locStr);

  const gcalDt = `${y}${pad(m)}${pad(d)}T${pad(h)}${pad(min)}00`;
  const gcalEndDt = `${y}${pad(m)}${pad(d)}T${pad(h + 4)}${pad(min)}00`;
  const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${gcalDt}/${gcalEndDt}&location=${loc}&details=${desc}`;
  const outlook = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${encodeURIComponent(isoStart)}&enddt=${encodeURIComponent(isoEnd)}&location=${loc}&body=${desc}&path=/calendar/action/compose&rru=addevent`;

  const btnStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.15)",
    border: "1px solid rgba(255,255,255,0.4)",
    color:
      data.heroImage || (data.heroImages?.length ?? 0) > 0
        ? "#fff"
        : data.colorPalette.text,
    backdropFilter: "blur(4px)",
  };

  const itemClass =
    "block w-full text-left px-4 py-2 text-sm hover:bg-black/5 transition-colors";

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
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            className="absolute top-full mt-2 z-50 rounded-lg shadow-xl border overflow-hidden min-w-[180px]"
            style={{
              background: "#fff",
              color: "#222",
              borderColor: "rgba(0,0,0,0.1)",
            }}
          >
            <button
              type="button"
              className={itemClass}
              onClick={() => {
                downloadIcs();
                setOpen(false);
              }}
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

function websiteHotelAddressLine(hotel: NonNullable<WebsiteRendererPayload["hotelOptions"]>[number]) {
  return [
    hotel.address,
    [hotel.city, hotel.state].filter(Boolean).join(", "),
    hotel.zip,
  ].filter(Boolean).join(" ");
}

function websiteHotelCutoffDate(value: string | null | undefined) {
  if (!value) return "";
  const [yy, mm, dd] = value.split("-").map(Number);
  const date = yy && mm && dd ? new Date(yy, mm - 1, dd) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function RsvpSection({
  data,
  ctx,
}: {
  data: WebsiteRendererPayload;
  ctx: EditCtx;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [attending, setAttending] = useState<"yes" | "no" | "maybe">("yes");
  const [plusOne, setPlusOne] = useState(0);
  const [dietary, setDietary] = useState("");
  const [message, setMessage] = useState("");
  const [hotelNeeded, setHotelNeeded] = useState(false);
  const [hotelBlockId, setHotelBlockId] = useState("");
  const [hotelRoomCount, setHotelRoomCount] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const labelColor = sectionTextColor(data, "rsvp");
  const preferredHotelId = data.customText._rsvpHotelBlockId && data.customText._rsvpHotelBlockId !== "all"
    ? data.customText._rsvpHotelBlockId
    : "";
  const hotelOptions = preferredHotelId
    ? [...(data.hotelOptions ?? [])].sort((a, b) => (String(a.id) === preferredHotelId ? -1 : String(b.id) === preferredHotelId ? 1 : 0))
    : (data.hotelOptions ?? []);
  const showHotelQuestion = hotelOptions.length > 0;
  const effectiveHotelNeeded = ctx.editable && showHotelQuestion ? true : hotelNeeded;
  const selectedHotelId = hotelBlockId || preferredHotelId || (ctx.editable ? String(hotelOptions[0]?.id ?? "") : "");
  const selectedHotel = hotelOptions.find((hotel) => String(hotel.id) === selectedHotelId) ?? null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (ctx.editable) return;
    if (!name.trim()) {
      setErr("Please enter your name.");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const slug = data.slug ?? "";
      const res = await apiFetch(
        `/api/website/rsvp/${encodeURIComponent(slug)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim() || undefined,
            attending,
            plusOneCount: plusOne,
            dietaryRestrictions: dietary.trim() || undefined,
            message: message.trim() || undefined,
          }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Submission failed");
      }
      setDone(true);
    } catch (e) {
      setErr(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
      );
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
    color: labelColor,
    fontSize: "0.9rem",
    outline: "none",
    fontFamily: "inherit",
  };

  return (
    <SectionShell
      id="rsvp"
      titleKey="rsvp_title"
      defaultTitle="RSVP"
      icon={<Heart className="h-4 w-4" />}
      data={data}
      ctx={ctx}
    >
      <EditableText
        as="div"
        editable={ctx.editable}
        value={data.customText.rsvp_subtitle ?? ""}
        defaultValue="We'd love to know if you can make it"
        onCommit={(v) => ctx.onTextChange("rsvp_subtitle", v)}
        className="block text-center text-3xl sm:text-4xl mb-10"
        style={{ fontFamily: fontStack(headingFont(data)), color: labelColor }}
        {...withBaseColor(tsp(ctx, "rsvp_subtitle"), labelColor)}
      />
      {(ctx.editable || data.customText.rsvp_deadline) && (
        <p
          className="text-center text-sm mb-8 opacity-70"
          style={{ color: labelColor }}
        >
          Please RSVP by{" "}
          <EditableText
            as="span"
            editable={ctx.editable}
            value={data.customText.rsvp_deadline ?? ""}
            defaultValue="(tap to add a date)"
            onCommit={(v) => ctx.onTextChange("rsvp_deadline", v)}
            className="font-semibold"
            style={{ color: labelColor }}
            {...withBaseColor(tsp(ctx, "rsvp_deadline"), labelColor)}
          />
        </p>
      )}
      {done ? (
        <div className="flex flex-col items-center gap-4 py-10">
          <CheckCircle2
            className="h-12 w-12"
            style={{ color: data.colorPalette.primary }}
          />
          <p
            className="text-xl font-medium text-center"
            style={{
              color: labelColor,
              fontFamily: fontStack(headingFont(data)),
            }}
          >
            {attending === "no"
              ? "We're sorry you can't make it 💙"
              : "Thank you! We can't wait to celebrate with you!"}
          </p>
          <EditableText
            as="p"
            editable={false}
            value={
              data.customText.rsvp_thankyou ??
              "We'll send you more details closer to the day."
            }
            defaultValue="We'll send you more details closer to the day."
            onCommit={() => {}}
            className="text-sm text-center max-w-sm"
            style={{ color: labelColor, opacity: 0.75 }}
          />
        </div>
      ) : (
        <form onSubmit={submit} className="max-w-lg mx-auto space-y-4">
          {ctx.editable && (
            <p className="rounded-md border px-3 py-2 text-center text-xs opacity-70" style={{ color: labelColor, borderColor: `${data.colorPalette.primary}33` }}>
              Editor preview only. Guests can use this form on the published site.
            </p>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label
                className="block text-xs font-medium mb-1.5 opacity-70"
                style={{ color: labelColor }}
              >
                Name *
              </label>
              <input
                style={inputStyle}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                required
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1.5 opacity-70"
                style={{ color: labelColor }}
              >
                Email
              </label>
              <input
                style={inputStyle}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label
              className="block text-xs font-medium mb-2 opacity-70"
              style={{ color: labelColor }}
            >
              Will you attend?
            </label>
            <div className="flex gap-2">
              {(["yes", "no", "maybe"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setAttending(opt)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize"
                  style={{
                    border: `1.5px solid ${data.colorPalette.primary}`,
                    background:
                      attending === opt
                        ? data.colorPalette.primary
                        : "transparent",
                    color:
                      attending === opt ? "#fff" : data.colorPalette.primary,
                  }}
                >
                  {opt === "yes"
                    ? "Joyfully accepts"
                    : opt === "no"
                      ? "Regretfully declines"
                      : "Maybe"}
                </button>
              ))}
            </div>
          </div>

          {attending !== "no" && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label
                  className="block text-xs font-medium mb-1.5 opacity-70"
                  style={{ color: labelColor }}
                >
                  Additional guests
                </label>
                <select
                  style={inputStyle}
                  value={plusOne}
                  onChange={(e) => setPlusOne(Number(e.target.value))}
                >
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? "Just me" : `+${n} guest${n > 1 ? "s" : ""}`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  className="block text-xs font-medium mb-1.5 opacity-70"
                  style={{ color: labelColor }}
                >
                  Dietary restrictions
                </label>
                <input
                  style={inputStyle}
                  value={dietary}
                  onChange={(e) => setDietary(e.target.value)}
                  placeholder="Vegetarian, gluten-free…"
                />
              </div>
            </div>
          )}

          {attending !== "no" && showHotelQuestion && (
            <div className="rounded-lg border p-4 space-y-3" style={{ borderColor: `${data.colorPalette.primary}44`, background: `${data.colorPalette.primary}0d` }}>
              <div>
                <label className="block text-xs font-medium mb-1.5 opacity-70" style={{ color: labelColor }}>
                  Will you need a hotel room?
                </label>
                <select
                  style={inputStyle}
                  value={effectiveHotelNeeded ? "yes" : "no"}
                  onChange={(e) => {
                    const needsHotel = e.target.value === "yes";
                    setHotelNeeded(needsHotel);
                    if (!needsHotel) setHotelBlockId("");
                    else if (preferredHotelId && !hotelBlockId) setHotelBlockId(preferredHotelId);
                  }}
                  disabled={ctx.editable}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>

              {effectiveHotelNeeded && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium mb-1.5 opacity-70" style={{ color: labelColor }}>
                    Hotel block
                  </label>
                  <select
                    style={inputStyle}
                    value={selectedHotelId}
                    onChange={(e) => setHotelBlockId(e.target.value)}
                    disabled={ctx.editable}
                  >
                    <option value="">I will decide later</option>
                    {hotelOptions.map((hotel) => (
                      <option key={hotel.id} value={hotel.id}>
                        {hotel.hotelName || "Hotel block"}
                      </option>
                    ))}
                  </select>

                  <label className="block text-xs font-medium mb-1.5 opacity-70" style={{ color: labelColor }}>
                    How many rooms?
                  </label>
                  <select
                    style={inputStyle}
                    value={hotelRoomCount}
                    onChange={(e) => setHotelRoomCount(e.target.value)}
                    disabled={ctx.editable}
                  >
                    <option value="1">1 room</option>
                    <option value="2">2 rooms</option>
                  </select>

                  {selectedHotel && (
                    <div className="rounded-lg border p-3 text-sm" style={{ color: labelColor, borderColor: `${data.colorPalette.primary}33`, background: `${data.colorPalette.background}cc` }}>
                      <p className="font-semibold">{selectedHotel.hotelName || "Hotel block"}</p>
                      {websiteHotelAddressLine(selectedHotel) && (
                        <p className="mt-1 text-xs opacity-75">{websiteHotelAddressLine(selectedHotel)}</p>
                      )}
                      {selectedHotel.groupName && (
                        <p className="mt-2 text-xs opacity-85"><span className="font-semibold">Wedding block:</span> {selectedHotel.groupName}</p>
                      )}
                      {selectedHotel.discountCode && (
                        <p className="mt-1 text-xs opacity-85"><span className="font-semibold">Group code:</span> <span className="font-mono font-semibold">{selectedHotel.discountCode}</span></p>
                      )}
                      {selectedHotel.cutoffDate && (
                        <p className="mt-1 text-xs opacity-85"><span className="font-semibold">Book by:</span> {websiteHotelCutoffDate(selectedHotel.cutoffDate)}</p>
                      )}
                      <p className="mt-1 text-xs opacity-85"><span className="font-semibold">Rooms:</span> {hotelRoomCount === "2" ? "2 rooms" : "1 room"}</p>
                      {selectedHotel.bookingLink && (
                        <div className="mt-3 rounded-md px-3 py-2 text-center text-xs font-semibold text-white" style={{ background: data.colorPalette.primary }}>
                          Open booking link
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label
              className="block text-xs font-medium mb-1.5 opacity-70"
              style={{ color: labelColor }}
            >
              Message to the couple (optional)
            </label>
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
            disabled={submitting || ctx.editable}
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

function AnnouncementBanner({
  data,
  ctx,
}: {
  data: WebsiteRendererPayload;
  ctx: EditCtx;
}) {
  const text = data.customText._announcement ?? "";
  const trimmed = text.trim();
  const marqueeEnabled = data.customText._announcementMarquee !== "false";
  const [dismissed, setDismissed] = useState(false);

  // Hide when the user has toggled the announcement off via Home Elements.
  if (isEditableHiddenMarker(data.customText._announcementHidden) || dismissed)
    return null;
  // Public site: hide entirely when empty. Editor: keep the slot visible so
  // the user has somewhere to click and start typing.
  if (!trimmed && !ctx.editable) return null;

  return (
    <div
      className="relative flex items-center justify-center px-5 py-3 text-sm"
      style={{
        background: `${data.colorPalette.primary}18`,
        borderBottom: `2px solid ${data.colorPalette.primary}55`,
      }}
    >
      <div className="w-full overflow-hidden whitespace-nowrap text-center">
        {ctx.editable ? (
          <div
            className={
              marqueeEnabled
                ? "wsa-announcement-marquee"
                : "flex w-full items-center justify-center whitespace-normal text-center"
            }
            style={{ color: data.colorPalette.text }}
            aria-label={trimmed}
          >
            <EditableText
              as="span"
              editable={ctx.editable}
              value={text}
              defaultValue={
                ctx.editable ? "Click to add an announcement..." : ""
              }
              onCommit={(v) => ctx.onTextChange("_announcement", v)}
              className={marqueeEnabled ? undefined : "inline-block max-w-full text-center"}
              style={{ color: data.colorPalette.text }}
              {...tspNoDelete(ctx, "_announcement", true)}
            />
          </div>
        ) : (
          <div
            className={
              marqueeEnabled
                ? "wsa-announcement-marquee"
                : "w-full whitespace-normal text-center"
            }
            aria-label={trimmed}
          >
            <span
              className={marqueeEnabled ? undefined : "inline-block max-w-full"}
              style={{ color: data.colorPalette.text }}
            >
              {trimmed}
            </span>
          </div>
        )}
      </div>

      {!ctx.editable && (
        <button
          onClick={() => setDismissed(true)}
          className="absolute right-5 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition-opacity"
          aria-label="Dismiss"
          style={{ color: data.colorPalette.text }}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ---------- hero ----------

// CSS filter presets used by the Hero background and the Gallery thumbnails.
// Reused on both surfaces so a chosen "look" stays consistent across the site.
const PHOTO_FILTERS: Record<string, string> = {
  none: "none",
  bw: "grayscale(1) contrast(1.05)",
  sepia: "sepia(0.7) saturate(1.1)",
  vintage: "sepia(0.35) contrast(0.95) saturate(0.85) brightness(0.95)",
  soft: "contrast(0.92) brightness(1.05) saturate(0.9) blur(0.4px)",
  cool: "hue-rotate(-12deg) saturate(1.1) brightness(0.97)",
  warm: "hue-rotate(8deg) saturate(1.15) brightness(1.04)",
  dramatic: "contrast(1.25) saturate(1.2) brightness(0.92)",
  noir: "grayscale(1) contrast(1.35) brightness(0.85)",
};

function photoFilterCss(key: string | undefined | null): string {
  return PHOTO_FILTERS[(key || "none") as keyof typeof PHOTO_FILTERS] ?? "none";
}

// Single slide/tile that resolves auth for its background URL via a hook.
function AuthBgSlide({
  url,
  className,
  style,
}: {
  url: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const blobUrl = useAuthBlobUrl(url);
  return (
    <div
      className={className}
      style={{
        ...style,
        backgroundImage: blobUrl
          ? `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.55)), url('${blobUrl}')`
          : style?.backgroundImage,
      }}
    />
  );
}

// Per-URL focal points the user picks via HeroPhotoPositionDialog. Stored
// as a JSON map under customText._heroFocals so a single key covers every
// hero photo. Falls back to "center" when missing or malformed.
function heroFocalFor(data: WebsiteRendererPayload, url: string): string {
  const raw = data.customText._heroFocals;
  if (!raw) return "center";
  try {
    const parsed = JSON.parse(raw);
    const value =
      parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)[url]
        : undefined;
    return typeof value === "string" && value.trim() ? value : "center";
  } catch {
    return "center";
  }
}

// Per-URL zoom levels (1.0 = native cover, 4.0 = max). Same JSON-map shape
// as _heroFocals. Returns 1 when missing/malformed so non-zoomed photos
// don't get a redundant transform.
function heroZoomFor(data: WebsiteRendererPayload, url: string): number {
  const raw = data.customText._heroZooms;
  if (!raw) return 1;
  try {
    const parsed = JSON.parse(raw);
    const value =
      parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)[url]
        : undefined;
    if (typeof value !== "number" || !Number.isFinite(value)) return 1;
    return Math.max(1, Math.min(4, value));
  } catch {
    return 1;
  }
}

function HeroBackground({ data }: { data: WebsiteRendererPayload }) {
  const mode = (data.customText._heroAnimation || "static") as
    | "static"
    | "slideshow"
    | "kenburns"
    | "pan-lr"
    | "marquee";
  const speed = (data.customText._heroAnimationSpeed || "medium") as
    | "slow"
    | "medium"
    | "fast";
  const intervalMs = speed === "slow" ? 7000 : speed === "fast" ? 3000 : 5000;
  const animDuration =
    speed === "slow" ? "30s" : speed === "fast" ? "12s" : "20s";
  const marqueeDuration =
    speed === "slow" ? "60s" : speed === "fast" ? "25s" : "40s";
  const photoFilter = photoFilterCss(data.customText._photoFilter);
  // "contain" lets the user see the whole cropped photo (with a colored
  // backdrop filling the extra space). Default "cover" keeps the existing
  // bleed-edge look for sites that don't opt in.
  const fit = (data.customText._heroFit === "contain" ? "contain" : "cover") as
    | "cover"
    | "contain";
  // When letterboxing in contain mode, fall back to the palette background
  // so the bars match the rest of the site instead of showing black.
  const backdrop = fit === "contain" ? data.colorPalette.background : undefined;

  const heroAndGallery: string[] = [
    ...(data.heroImage ? [data.heroImage] : []),
    ...(data.heroImages ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((g) => g.url),
  ];

  // ---- Marquee: continuously scrolls a strip of photos left-to-right ----
  if (mode === "marquee" && heroAndGallery.length > 0) {
    // Duplicate the list so the loop is seamless when translateX hits -50%
    const strip = [...heroAndGallery, ...heroAndGallery];
    return (
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          background:
            backdrop ??
            `linear-gradient(135deg, ${data.colorPalette.primary}22, ${data.colorPalette.secondary}22)`,
        }}
      >
        <div
          className="flex h-full"
          style={{
            width: "max-content",
            animation: `wsa-marquee ${marqueeDuration} linear infinite`,
            willChange: "transform",
          }}
        >
          {strip.map((url, i) => {
            const focal = heroFocalFor(data, url);
            const zoom = heroZoomFor(data, url);
            const slide = (
              <AuthBgSlide
                url={url}
                className="h-full w-full"
                style={{
                  backgroundPosition: focal,
                  backgroundSize: fit,
                  backgroundRepeat: "no-repeat",
                  filter: photoFilter,
                }}
              />
            );
            return (
              <div
                key={url + i}
                className="h-full flex-shrink-0 overflow-hidden relative"
                style={{
                  width: "60vw",
                  // Wrapping the slide in a scale wrapper layers the user's
                  // zoom on top of the marquee's translateX animation without
                  // them clobbering each other on the same transform property.
                  transform: zoom === 1 ? undefined : `scale(${zoom})`,
                  transformOrigin: focal,
                }}
              >
                {slide}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const slideshowImages =
    mode === "slideshow"
      ? heroAndGallery
      : heroAndGallery.length > 0
        ? [heroAndGallery[0]]
        : [];

  const [activeIdx, setActiveIdx] = useState(0);
  useEffect(() => {
    if (mode !== "slideshow" || slideshowImages.length < 2) return;
    const id = setInterval(
      () => setActiveIdx((i) => (i + 1) % slideshowImages.length),
      intervalMs,
    );
    return () => clearInterval(id);
  }, [mode, slideshowImages.length, intervalMs]);

  if (slideshowImages.length === 0) {
    return (
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${data.colorPalette.primary}22, ${data.colorPalette.secondary}22)`,
        }}
      />
    );
  }

  const animationStyle: React.CSSProperties =
    mode === "kenburns"
      ? { animation: `wsa-kenburns ${animDuration} ease-in-out infinite` }
      : mode === "pan-lr"
        ? { animation: `wsa-pan-lr ${animDuration} ease-in-out infinite` }
        : {};

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={backdrop ? { background: backdrop } : undefined}
    >
      {slideshowImages.map((url, i) => {
        const focal = heroFocalFor(data, url);
        const zoom = heroZoomFor(data, url);
        const slide = (
          <AuthBgSlide
            url={url}
            className="absolute inset-0"
            style={{
              backgroundPosition: focal,
              backgroundSize: fit,
              backgroundRepeat: "no-repeat",
              opacity: mode === "slideshow" ? (i === activeIdx ? 1 : 0) : 1,
              transition:
                mode === "slideshow" ? "opacity 1s ease-in-out" : undefined,
              filter: photoFilter,
              ...animationStyle,
            }}
          />
        );
        // Static / slideshow can take the user's zoom directly on the slide.
        // Kenburns / pan-lr already use `transform` for their CSS animation —
        // wrap them so the user's scale layers without clobbering the keyframes.
        if (zoom === 1)
          return (
            <div key={url + i} className="absolute inset-0">
              {slide}
            </div>
          );
        const animated = mode === "kenburns" || mode === "pan-lr";
        return (
          <div
            key={url + i}
            className="absolute inset-0"
            style={
              animated
                ? { transform: `scale(${zoom})`, transformOrigin: focal }
                : undefined
            }
          >
            {animated ? (
              slide
            ) : (
              <AuthBgSlide
                url={url}
                className="absolute inset-0"
                style={{
                  backgroundPosition: focal,
                  backgroundSize: fit,
                  backgroundRepeat: "no-repeat",
                  opacity: mode === "slideshow" ? (i === activeIdx ? 1 : 0) : 1,
                  transition:
                    mode === "slideshow" ? "opacity 1s ease-in-out" : undefined,
                  filter: photoFilter,
                  transform: `scale(${zoom})`,
                  transformOrigin: focal,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Hero({ data, ctx }: { data: WebsiteRendererPayload; ctx: EditCtx }) {
  const couple = `${data.couple.partner2Name} & ${data.couple.partner1Name}`;
  const dateStr = formatWeddingDate(data.couple.weddingDate);
  return (
    <section
      id="home"
      className="relative min-h-[80vh] flex items-center justify-center text-center px-4 sm:px-6 py-20 sm:py-24 overflow-hidden"
      style={{
        color:
          data.heroImage || (data.heroImages?.length ?? 0) > 0
            ? "#fff"
            : data.colorPalette.text,
      }}
    >
      <HeroBackground data={data} />
      <div className="relative max-w-3xl min-w-0">
        {!isEditableHiddenMarker(data.customText._heroTaglineHidden) && (
          <EditableText
            as="div"
            editable={ctx.editable}
            value={data.customText._heroTagline ?? ""}
            defaultValue="We're getting married"
            onCommit={(v) => ctx.onTextChange("_heroTagline", v)}
            className="uppercase tracking-[0.3em] text-xs sm:text-sm mb-6 opacity-80"
            style={{
              color:
                data.heroImage || (data.heroImages?.length ?? 0) > 0
                  ? "#fff"
                  : data.colorPalette.primary,
              fontFamily: elementFont(data, "_heroTagline")
                ? bodyFontStack(elementFont(data, "_heroTagline")!)
                : undefined,
            }}
            {...tspNoDelete(ctx, "_heroTagline", true)}
          />
        )}
        <EditableText
          as="div"
          editable={ctx.editable}
          value={data.customText._coupleName ?? ""}
          defaultValue={couple}
          onCommit={(v) => ctx.onTextChange("_coupleName", v)}
          className="text-4xl sm:text-6xl md:text-8xl mb-6 leading-tight break-words [overflow-wrap:anywhere]"
          style={{
            fontFamily: fontStack(headingFont(data)),
            color:
              data.heroImage || (data.heroImages?.length ?? 0) > 0
                ? "#fff"
                : data.colorPalette.text,
          }}
          {...tspNoDelete(ctx, "_coupleName")}
        />
        {!isEditableHiddenMarker(data.customText._heroDateRow) && (
          <DraggableRow
            editable={ctx.editable}
            className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-base sm:text-lg opacity-90"
          >
            {!isEditableHiddenMarker(data.customText._heroDateIcon) && (
              <Calendar
                className="h-5 w-5 flex-shrink-0"
                style={{ pointerEvents: "none" }}
              />
            )}
            <EditableText
              editable={ctx.editable}
              value={data.customText._heroDate ?? ""}
              defaultValue={dateStr}
              onCommit={(v) => ctx.onTextChange("_heroDate", v)}
              style={{ color: "inherit" }}
              aiEnabled={false}
              readOnlyText
              {...tspStyle(ctx, "_heroDate")}
            />
          </DraggableRow>
        )}
        {data.couple.venue &&
          !isEditableHiddenMarker(data.customText._heroVenueRow) && (
            <DraggableRow
              editable={ctx.editable}
              className="flex flex-wrap items-center justify-center gap-2 mt-3 text-sm sm:text-base opacity-80"
            >
              {!isEditableHiddenMarker(data.customText._heroVenueIcon) && (
                <MapPin
                  className="h-4 w-4 flex-shrink-0"
                  style={{ pointerEvents: "none" }}
                />
              )}
              <EditableText
                editable={ctx.editable}
                value={data.customText._heroVenue ?? ""}
                defaultValue={[
                  data.couple.venue,
                  data.couple.venueCity,
                  data.couple.venueState,
                ]
                  .filter(Boolean)
                  .join(", ")}
                onCommit={(v) => ctx.onTextChange("_heroVenue", v)}
                style={{ color: "inherit" }}
                aiEnabled={false}
                readOnlyText
                {...tspStyle(ctx, "_heroVenue")}
              />
            </DraggableRow>
          )}
        {data.couple.weddingDate &&
          !isEditableHiddenMarker(data.customText._countdown) && (
            <DraggableRow editable={ctx.editable}>
              <CountdownTimer
                dateStr={data.couple.weddingDate}
                accentColor={
                  data.heroImage || (data.heroImages?.length ?? 0) > 0
                    ? "rgba(255,255,255,0.9)"
                    : data.colorPalette.primary
                }
                data={data}
                ctx={ctx}
              />
            </DraggableRow>
          )}
        {!isEditableHiddenMarker(data.customText._addToCalendarRow) && (
          <DraggableRow editable={ctx.editable}>
            <AddToCalendarButton data={data} />
          </DraggableRow>
        )}
      </div>
    </section>
  );
}

// Custom floating text boxes — rendered at the page level (not inside any
// one section) so the user can drag them anywhere on the website and they
// stay visible regardless of which section is currently scrolled to. The
// outer wrapper is marked position:relative so absolute positioning here
// is anchored to the whole page.
// Custom text-box keys are `_custom_<section>__<timestamp>`. Legacy keys
// (`_custom_<timestamp>`, no section) are treated as belonging to "home".
function sectionForCustomKey(key: string): string {
  const m = key.match(/^_custom_([a-zA-Z]+)__\d+$/);
  return m ? m[1] : "home";
}

function CustomTextBoxes({
  data,
  ctx,
  currentSection,
  showAll,
}: {
  data: WebsiteRendererPayload;
  ctx: EditCtx;
  currentSection: string;
  showAll: boolean;
}) {
  return (
    <>
      {Object.entries(data.customText)
        .filter(([k, v]) => {
          if (!k.startsWith("_custom_")) return false;
          // Only show this textbox on the page it was added to (or always
          // when the renderer is in show-all mode for full-site preview).
          if (!showAll) {
            const scope = sectionForCustomKey(k);
            if (scope !== "global" && scope !== currentSection) return false;
          }
          if (!ctx.editable)
            return !!v?.trim() && v.trim() !== "New text — click to edit";
          return true;
        })
        .map(([key, val], idx) => (
          <div
            key={key}
            className="pointer-events-auto"
            style={{
              position: "absolute",
              top: 120 + idx * 56,
              left: 24,
              zIndex: 20,
            }}
          >
            <EditableText
              as="div"
              editable={ctx.editable}
              value={val}
              defaultValue="New text — click to edit"
              onCommit={(v) =>
                ctx.onTextChange(key, v || "New text — click to edit")
              }
              style={{
                display: "inline-block",
                background: "transparent",
                color: sectionTextColor(data, currentSection),
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: 18,
                minWidth: 80,
              }}
              {...tsp(ctx, key, true)}
            />
          </div>
        ))}
    </>
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
  tall = false,
}: {
  id: string;
  titleKey: string;
  defaultTitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  data: WebsiteRendererPayload;
  ctx: EditCtx;
  tall?: boolean;
}) {
  return (
    <section
      id={id}
      className={`py-20 px-6 overflow-x-clip${tall ? " min-h-screen" : ""}`}
      style={{
        // Welcome has its own _welcomeBg picker; everything else shares
        // _sectionsBg so the user can recolour all non-welcome sections at
        // once. Falls back to the theme's neutral colour when neither is set.
        background:
          (id === "welcome"
            ? data.customText._welcomeBg
            : data.customText._sectionsBg) ||
          backgroundWithOpacity(data, data.colorPalette.neutral),
      }}
    >
      <div className="max-w-4xl mx-auto w-full">
        {(() => {
          const headerColor =
            ctx.textStyles?.[titleKey]?.color || data.colorPalette.secondary;
          const headerFontSize = ctx.textStyles?.[titleKey]?.fontSize;
          // When the user resizes the section label via the inline toolbar,
          // scale the icon to match. Strip the original h-4 w-4 sizing and
          // apply the chosen font size as both width and height so SVG
          // renders proportionally. With no override, keep the default size.
          const sizedIcon =
            headerFontSize && isValidElement(icon)
              ? cloneElement(
                  icon as React.ReactElement<{
                    className?: string;
                    style?: React.CSSProperties;
                  }>,
                  {
                    className: "shrink-0",
                    style: { width: headerFontSize, height: headerFontSize },
                  },
                )
              : icon;
          return (
            <div
              className="flex items-center justify-center gap-2 mb-3"
              style={{ color: headerColor }}
            >
              {sizedIcon}
              <EditableText
                editable={ctx.editable}
                value={data.customText[titleKey] ?? ""}
                defaultValue={defaultTitle}
                onCommit={(v) => ctx.onTextChange(titleKey, v)}
                className="uppercase tracking-[0.25em] text-xs"
                {...tspStyle(ctx, titleKey)}
              />
            </div>
          );
        })()}
        <div
          className="w-12 h-px mx-auto mb-12"
          style={{
            background:
              ctx.textStyles?.[titleKey]?.color || data.colorPalette.secondary,
          }}
        />
        {children}
      </div>
    </section>
  );
}

function Welcome({
  data,
  ctx,
}: {
  data: WebsiteRendererPayload;
  ctx: EditCtx;
}) {
  const text = data.customText.welcome ?? "";
  const heroTagline = (data.customText._heroTagline ?? "").trim().toLowerCase();
  const welcomeText = text.trim().toLowerCase();
  const duplicatesHeroTagline = !!welcomeText && welcomeText === heroTagline;
  // In edit mode, always render so the user has somewhere to type. In the
  // editor's Preview popup, also render so the user can verify the layout.
  // On the published site, hide an empty section from guests.
  if ((!text || duplicatesHeroTagline) && !ctx.editable && !ctx.previewMode)
    return null;
  const labelColor = sectionTextColor(data, "welcome");
  return (
    <SectionShell
      id="welcome"
      titleKey="welcome_title"
      defaultTitle="Welcome"
      icon={<Heart className="h-4 w-4" />}
      data={data}
      ctx={ctx}
    >
      <EditableText
        as="div"
        multiline
        editable={ctx.editable}
        value={text}
        defaultValue={
          ctx.editable || ctx.previewMode
            ? "Click to write a warm welcome for your guests..."
            : ""
        }
        onCommit={(v) => ctx.onTextChange("welcome", v)}
        className="text-center text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto whitespace-pre-line"
        style={{
          color: data.customText._welcomeColor || labelColor,
          fontFamily: bodyFontStack(bodyFont(data)),
        }}
        {...withBaseColor(tsp(ctx, "welcome"), labelColor)}
      />
    </SectionShell>
  );
}

function Story({ data, ctx }: { data: WebsiteRendererPayload; ctx: EditCtx }) {
  const text = data.customText.story ?? "";
  // The section is gated by sectionsEnabled.story upstream; if the user
  // enabled it, render it everywhere — editor, preview, and published —
  // so the layout is consistent even before the body has been filled in.
  const labelColor = sectionTextColor(data, "story");
  return (
    <SectionShell
      id="story"
      titleKey="story_title"
      defaultTitle="Our Story"
      icon={<Heart className="h-4 w-4" />}
      data={data}
      ctx={ctx}
      tall
    >
      <EditableText
        as="div"
        editable={ctx.editable}
        value={data.customText.story_subtitle ?? ""}
        defaultValue="How we got here"
        onCommit={(v) => ctx.onTextChange("story_subtitle", v)}
        className="block text-center text-3xl sm:text-4xl mb-8"
        style={{
          fontFamily: elementFontStack(
            data,
            "story_subtitle",
            headingFont(data),
            "heading",
          ),
          color: labelColor,
        }}
        {...withBaseColor(tsp(ctx, "story_subtitle"), labelColor)}
      />
      <EditableText
        as="div"
        multiline
        editable={ctx.editable}
        value={text}
        defaultValue={
          ctx.editable || ctx.previewMode
            ? "Tell guests how you two met, your story, your journey..."
            : ""
        }
        onCommit={(v) => ctx.onTextChange("story", v)}
        className="text-center text-base sm:text-lg leading-relaxed max-w-3xl mx-auto px-4 whitespace-pre-line break-words"
        style={{
          color: labelColor,
          fontFamily: bodyFontStack(bodyFont(data)),
          textAlign: "center",
          marginLeft: "auto",
          marginRight: "auto",
        }}
        {...withBaseColor(tsp(ctx, "story"), labelColor)}
      />
    </SectionShell>
  );
}

function Schedule({
  data,
  ctx,
}: {
  data: WebsiteRendererPayload;
  ctx: EditCtx;
}) {
  const customSchedule = data.customText.schedule ?? "";
  const ceremonyTime =
    (data.customText._scheduleCeremonyTime ?? "").trim() ||
    data.couple.ceremonyTime ||
    "";
  const cocktailTime = (data.customText._scheduleCocktailTime ?? "").trim();
  const receptionTime =
    (data.customText._scheduleReceptionTime ?? "").trim() ||
    data.couple.receptionTime ||
    "";
  const allItems: Array<{
    key: string;
    labelKey: string;
    defaultLabel: string;
    Icon: typeof Heart;
    time: string;
    hiddenKey: string;
  }> = [
    {
      key: "_scheduleCeremonyTime",
      labelKey: "_scheduleCeremonyLabel",
      defaultLabel: "Ceremony",
      Icon: Heart,
      time: ceremonyTime,
      hiddenKey: "_scheduleCeremonyHidden",
    },
    {
      key: "_scheduleCocktailTime",
      labelKey: "_scheduleCocktailLabel",
      defaultLabel: "Cocktail Hour",
      Icon: Wine,
      time: cocktailTime,
      hiddenKey: "_scheduleCocktailHidden",
    },
    {
      key: "_scheduleReceptionTime",
      labelKey: "_scheduleReceptionLabel",
      defaultLabel: "Reception",
      Icon: UtensilsCrossed,
      time: receptionTime,
      hiddenKey: "_scheduleReceptionHidden",
    },
  ];
  const items = allItems.filter(
    (i) => !isEditableHiddenMarker(data.customText[i.hiddenKey]),
  );
  const visibleItems = ctx.editable ? items : items.filter((i) => i.time);
  if (!ctx.editable && visibleItems.length === 0 && !customSchedule)
    return null;
  const labelColor = sectionTextColor(data, "schedule");
  return (
    <SectionShell
      id="schedule"
      titleKey="schedule_title"
      defaultTitle="Schedule"
      icon={<Clock className="h-4 w-4" />}
      data={data}
      ctx={ctx}
    >
      <div className="max-w-2xl mx-auto">
        <div className="space-y-3 mb-8">
          {visibleItems.map((it, idx) => {
            const hasTime = !!it.time;
            return (
              <div
                key={it.key}
                className="flex gap-4 items-center py-3"
                style={{
                  borderBottom:
                    idx < visibleItems.length - 1
                      ? `1px solid ${data.colorPalette.primary}22`
                      : "none",
                }}
              >
                <EditableIcon
                  Icon={it.Icon}
                  ctx={ctx}
                  customText={data.customText}
                  colorKey={`${it.key}_iconColor`}
                  sizeKey={`${it.key}_iconSize`}
                  defaultColor={data.colorPalette.primary}
                  defaultSizePx={16}
                  wrapperClassName="flex items-center justify-center w-9 h-9 rounded-full flex-shrink-0"
                  wrapperStyle={{
                    background: `${data.colorPalette.primary}15`,
                  }}
                />
                <div
                  className="w-28 text-sm font-medium px-3 py-1.5 rounded-md"
                  style={{
                    color: data.colorPalette.primary,
                    border:
                      ctx.editable && !hasTime
                        ? `1px dashed ${data.colorPalette.primary}66`
                        : "none",
                    background:
                      ctx.editable && !hasTime
                        ? `${data.colorPalette.primary}08`
                        : "transparent",
                  }}
                >
                  <EditableText
                    editable={ctx.editable}
                    value={formatTime12h(data.customText[it.key] ?? "")}
                    defaultValue={
                      ctx.editable ? "Add Time" : formatTime12h(it.time || "")
                    }
                    onCommit={(v) => ctx.onTextChange(it.key, v)}
                    {...withBaseColor(
                      tspStyle(ctx, it.key),
                      data.colorPalette.primary,
                    )}
                  />
                </div>
                <div className="flex-1 text-base" style={{ color: labelColor }}>
                  <EditableText
                    editable={ctx.editable}
                    value={data.customText[it.labelKey] ?? ""}
                    defaultValue={it.defaultLabel}
                    onCommit={(v) => ctx.onTextChange(it.labelKey, v)}
                    {...withBaseColor(tspStyle(ctx, it.labelKey), labelColor)}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {/* Optional free-form notes below the schedule */}
        <EditableText
          as="div"
          multiline
          editable={ctx.editable}
          value={customSchedule}
          defaultValue={
            ctx.editable
              ? "Add any extra schedule notes — dress code, parking, after-party, etc."
              : ""
          }
          onCommit={(v) => ctx.onTextChange("schedule", v)}
          className="text-center text-base sm:text-lg leading-relaxed whitespace-pre-line"
          style={{
            color: labelColor,
            fontFamily: bodyFontStack(bodyFont(data)),
          }}
          {...withBaseColor(tsp(ctx, "schedule"), labelColor)}
        />
      </div>
    </SectionShell>
  );
}

function Travel({ data, ctx }: { data: WebsiteRendererPayload; ctx: EditCtx }) {
  const text = data.customText.travel ?? "";
  const hotelName = (data.customText._hotelName ?? "").trim();
  const hotelAddress = (data.customText._hotelAddress ?? "").trim();
  const hasHotel = !!hotelName;
  if (!text && !data.couple.venue && !hasHotel && !ctx.editable) return null;
  const labelColor = sectionTextColor(data, "travel");

  const venueQuery = encodeURIComponent(
    [
      data.couple.venue,
      data.couple.venueCity,
      data.couple.venueState,
      data.couple.location,
    ]
      .filter(Boolean)
      .join(", "),
  );
  const hotelQuery = encodeURIComponent(
    [hotelName, hotelAddress].filter(Boolean).join(", "),
  );

  const cardStyle: React.CSSProperties = {
    border: `1px solid ${data.colorPalette.primary}22`,
    borderRadius: 12,
    padding: "18px 20px",
  };
  const iconWrap: React.CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: 999,
    background: `${data.colorPalette.primary}15`,
    color: data.colorPalette.primary,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };

  return (
    <SectionShell
      id="travel"
      titleKey="travel_title"
      defaultTitle="Travel & Venue"
      icon={<MapPin className="h-4 w-4" />}
      data={data}
      ctx={ctx}
    >
      <EditableText
        as="div"
        editable={ctx.editable}
        value={data.customText.travel_subtitle ?? ""}
        defaultValue="Where & how to get there"
        onCommit={(v) => ctx.onTextChange("travel_subtitle", v)}
        className="block text-center text-3xl sm:text-4xl mb-8"
        style={{
          fontFamily: elementFontStack(
            data,
            "travel_subtitle",
            headingFont(data),
            "heading",
          ),
          color: labelColor,
        }}
        {...withBaseColor(tsp(ctx, "travel_subtitle"), labelColor)}
      />

      <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto mb-6">
        {/* Venue */}
        {data.couple.venue &&
          !isEditableHiddenMarker(data.customText._travelVenueHidden) && (
            <div style={cardStyle}>
              <div className="flex items-start gap-3 mb-3">
                <div style={iconWrap}>
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <EditableText
                    as="div"
                    editable={ctx.editable}
                    value="Venue"
                    defaultValue="Venue"
                    readOnlyText
                    aiEnabled={false}
                    textStyle={data.textStyles?._travelVenueLabel}
                    onStyleChange={
                      ctx.onStyleChange
                        ? (s) => ctx.onStyleChange!("_travelVenueLabel", s)
                        : undefined
                    }
                    className="text-[11px] uppercase tracking-wider opacity-70"
                    style={{ color: labelColor }}
                  />
                  <div
                    className="text-base sm:text-lg font-medium"
                    style={{ color: labelColor }}
                  >
                    {data.couple.venue}
                  </div>
                  {data.couple.location && (
                    <div
                      className="text-sm opacity-75"
                      style={{ color: labelColor }}
                    >
                      {data.couple.location}
                    </div>
                  )}
                </div>
              </div>
              <a
                href={`https://www.google.com/maps/search/${venueQuery}`}
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

        {/* Hotel */}
        {(hasHotel || ctx.editable) &&
          !isEditableHiddenMarker(data.customText._travelHotelHidden) && (
            <div style={cardStyle}>
              <div className="flex items-start gap-3 mb-3">
                <div style={iconWrap}>
                  <Bed className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <EditableText
                    as="div"
                    editable={ctx.editable}
                    value="Hotel"
                    defaultValue="Hotel"
                    readOnlyText
                    aiEnabled={false}
                    textStyle={data.textStyles?._travelHotelLabel}
                    onStyleChange={
                      ctx.onStyleChange
                        ? (s) => ctx.onStyleChange!("_travelHotelLabel", s)
                        : undefined
                    }
                    className="text-[11px] uppercase tracking-wider opacity-70"
                    style={{ color: labelColor }}
                  />
                  <EditableText
                    as="div"
                    editable={ctx.editable}
                    value={data.customText._hotelName ?? ""}
                    defaultValue={ctx.editable ? "Hotel name" : ""}
                    onCommit={(v) => ctx.onTextChange("_hotelName", v)}
                    className="text-base sm:text-lg font-medium"
                    style={{ color: labelColor }}
                    {...withBaseColor(tsp(ctx, "_hotelName"), labelColor)}
                  />
                  <EditableText
                    as="div"
                    editable={ctx.editable}
                    value={data.customText._hotelAddress ?? ""}
                    defaultValue={
                      ctx.editable ? "Address (street, city, state)" : ""
                    }
                    onCommit={(v) => ctx.onTextChange("_hotelAddress", v)}
                    className="text-sm opacity-75"
                    style={{ color: labelColor }}
                    {...withBaseColor(tsp(ctx, "_hotelAddress"), labelColor)}
                  />
                </div>
              </div>
              {hasHotel && (
                <a
                  href={`https://www.google.com/maps/search/${hotelQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-70"
                  style={{ color: data.colorPalette.primary }}
                >
                  <Navigation className="h-3.5 w-3.5" />
                  Open in Google Maps
                </a>
              )}
            </div>
          )}
      </div>

      {!isEditableHiddenMarker(data.customText._travelNotesHidden) && (
        <EditableText
          as="div"
          multiline
          editable={ctx.editable}
          value={text}
          defaultValue={
            ctx.editable
              ? "Add parking info, directions, or other travel notes…"
              : ""
          }
          onCommit={(v) => ctx.onTextChange("travel", v)}
          className="text-center text-base sm:text-lg leading-relaxed max-w-2xl mx-auto whitespace-pre-line"
          style={{
            color: labelColor,
            fontFamily: bodyFontStack(bodyFont(data)),
          }}
          {...withBaseColor(tsp(ctx, "travel"), labelColor)}
        />
      )}
    </SectionShell>
  );
}

function Registry({
  data,
  ctx,
}: {
  data: WebsiteRendererPayload;
  ctx: EditCtx;
}) {
  const labelColor = sectionTextColor(data, "registry");
  const text = data.customText.registry ?? "";
  const links = parseRegistryLinks(data.customText._registryLinks);
  if (!text && links.length === 0 && !ctx.editable) return null;
  return (
    <SectionShell
      id="registry"
      titleKey="registry_title"
      defaultTitle="Registry"
      icon={<Gift className="h-4 w-4" />}
      data={data}
      ctx={ctx}
    >
      <EditableText
        as="div"
        editable={ctx.editable}
        value={data.customText.registry_subtitle ?? ""}
        defaultValue="With love"
        onCommit={(v) => ctx.onTextChange("registry_subtitle", v)}
        className="block text-center text-3xl sm:text-4xl mb-8"
        style={{
          fontFamily: elementFontStack(
            data,
            "registry_subtitle",
            headingFont(data),
            "heading",
          ),
          color: labelColor,
        }}
        {...withBaseColor(tsp(ctx, "registry_subtitle"), labelColor)}
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
          defaultValue={
            ctx.editable
              ? "Add a note about your registry or gift preferences..."
              : ""
          }
          onCommit={(v) => ctx.onTextChange("registry", v)}
          className="text-center text-base sm:text-lg leading-relaxed max-w-2xl mx-auto whitespace-pre-line"
          style={{
            color: labelColor,
            fontFamily: bodyFontStack(bodyFont(data)),
          }}
          {...withBaseColor(tsp(ctx, "registry"), labelColor)}
        />
      )}
    </SectionShell>
  );
}

function Faq({ data, ctx }: { data: WebsiteRendererPayload; ctx: EditCtx }) {
  type FaqItem = { question: string; answer: string };
  let items: FaqItem[] = [];
  try {
    const labelColor = sectionTextColor(data, "faq");
    const raw = data.customText.faq_items_json;
    if (raw) {
      const parsed = JSON.parse(raw) as FaqItem[];
      if (Array.isArray(parsed)) {
        items = parsed.filter(
          (it) => it && (it.question?.trim() || it.answer?.trim()),
        );
      }
    }
  } catch {
    /* ignore */
  }

  // Legacy single-string fallback used before the structured editor existed.
  const legacyText = data.customText.faq ?? "";
  const hasLegacyOnly = items.length === 0 && legacyText.trim().length > 0;

  if (items.length === 0 && !legacyText && !ctx.editable) return null;

  return (
    <SectionShell
      id="faq"
      titleKey="faq_title"
      defaultTitle="FAQ"
      icon={<HelpCircle className="h-4 w-4" />}
      data={data}
      ctx={ctx}
    >
      <EditableText
        as="div"
        editable={ctx.editable}
        value={data.customText.faq_subtitle ?? ""}
        defaultValue="Good to know"
        onCommit={(v) => ctx.onTextChange("faq_subtitle", v)}
        className="block text-center text-3xl sm:text-4xl mb-8"
        style={{
          fontFamily: elementFontStack(
            data,
            "faq_subtitle",
            headingFont(data),
            "heading",
          ),
          color: labelColor,
        }}
        {...withBaseColor(tsp(ctx, "faq_subtitle"), labelColor)}
      />

      {items.length > 0 && (
        <div className="max-w-2xl mx-auto space-y-5">
          {items.map((it, i) => {
            const qColor =
              data.customText._faqQuestionColor || data.colorPalette.primary;
            const qFamily = data.customText._faqQuestionFont
              ? bodyFontStack(data.customText._faqQuestionFont)
              : bodyFontStack(bodyFont(data));
            const qSize = data.customText._faqQuestionSize
              ? `${data.customText._faqQuestionSize}px`
              : undefined;
            const qWeight =
              data.customText._faqQuestionBold === "true" ? "700" : "600";
            const qStyle =
              data.customText._faqQuestionItalic === "true"
                ? "italic"
                : "normal";
            const aColor = data.customText._faqAnswerColor || labelColor;
            const aFamily = data.customText._faqAnswerFont
              ? bodyFontStack(data.customText._faqAnswerFont)
              : bodyFontStack(bodyFont(data));
            const aSize = data.customText._faqAnswerSize
              ? `${data.customText._faqAnswerSize}px`
              : undefined;
            const aWeight =
              data.customText._faqAnswerBold === "true" ? "700" : "400";
            const aStyle =
              data.customText._faqAnswerItalic === "true" ? "italic" : "normal";
            return (
              <div
                key={i}
                className="text-left rounded-xl px-5 py-5 sm:px-6 sm:py-6"
                style={{
                  background: `${data.colorPalette.primary}08`,
                  border: `1px solid ${data.colorPalette.primary}1f`,
                }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-full text-xs font-semibold tabular-nums"
                    style={{
                      background: data.colorPalette.primary,
                      color: "#fff",
                      fontFamily: bodyFontStack(bodyFont(data)),
                    }}
                    aria-hidden
                  >
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3
                    className="leading-snug pt-1"
                    style={{
                      color: qColor,
                      fontFamily: qFamily,
                      fontSize: qSize,
                      fontWeight: qWeight,
                      fontStyle: qStyle,
                    }}
                  >
                    {it.question}
                  </h3>
                </div>
                {it.answer && (
                  <p
                    className="leading-relaxed whitespace-pre-line pl-11"
                    style={{
                      color: aColor,
                      fontFamily: aFamily,
                      fontSize: aSize,
                      fontWeight: aWeight,
                      fontStyle: aStyle,
                      opacity: 0.85,
                    }}
                  >
                    {it.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {hasLegacyOnly && (
        <EditableText
          as="div"
          multiline
          editable={ctx.editable}
          value={legacyText}
          defaultValue=""
          onCommit={(v) => ctx.onTextChange("faq", v)}
          className="text-center text-base sm:text-lg leading-relaxed max-w-2xl mx-auto whitespace-pre-line"
          style={{
            color: labelColor,
            fontFamily: bodyFontStack(bodyFont(data)),
          }}
          {...withBaseColor(tsp(ctx, "faq"), labelColor)}
        />
      )}

      {items.length === 0 && !legacyText && ctx.editable && (
        <p className="text-center text-sm text-muted-foreground max-w-2xl mx-auto">
          Add FAQ questions in the sidebar (Pages tab → FAQ Questions).
        </p>
      )}
    </SectionShell>
  );
}

function Gallery({
  data,
  ctx,
}: {
  data: WebsiteRendererPayload;
  ctx: EditCtx;
}) {
  const labelColor = sectionTextColor(data, "gallery");
  const images = (data.galleryImages ?? [])
    .slice()
    .sort((a, b) => a.order - b.order);
  const photoFilter = photoFilterCss(data.customText._photoFilter);
  const animation = data.customText._galleryAnimation ?? "grid";
  const speed = data.customText._galleryAnimationSpeed ?? "medium";
  const slideshowIntervalMs =
    speed === "slow" ? 6000 : speed === "fast" ? 2500 : 4000;
  const marqueeDuration =
    speed === "slow" ? "60s" : speed === "fast" ? "20s" : "40s";
  // Grid mode always uses the puzzle fade entrance — ignore _galleryEntrance
  const entrance: "none" | "fade-in" | "slide-up" | "zoom-in" | "puzzle" =
    animation === "grid" ? "puzzle" : "none";
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Slideshow auto-advance. Hooks must run unconditionally — bail out inside.
  const [activeIdx, setActiveIdx] = useState(0);
  useEffect(() => {
    if (animation !== "slideshow" || images.length < 2) return;
    const id = setInterval(
      () => setActiveIdx((i) => (i + 1) % images.length),
      slideshowIntervalMs,
    );
    return () => clearInterval(id);
  }, [animation, images.length, slideshowIntervalMs]);
  useEffect(() => {
    if (activeIdx >= images.length) setActiveIdx(0);
  }, [images.length, activeIdx]);

  // Per-item scroll observers for fade/slide/zoom entrance modes.
  const [visibleItems, setVisibleItems] = useState<Set<number>>(new Set());
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    if (entrance === "none" || entrance === "puzzle") {
      setVisibleItems(new Set());
      return;
    }
    const observers = itemRefs.current.map((el, i) => {
      if (!el) return null;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setVisibleItems((prev) => new Set([...prev, i]));
            obs.disconnect();
          }
        },
        { threshold: 0.1 },
      );
      obs.observe(el);
      return obs;
    });
    return () => {
      observers.forEach((obs) => obs?.disconnect());
    };
  }, [entrance, images.length]);

  // Grid-level observer for puzzle mode: fires once when the grid enters view,
  // then CSS handles the sequential snap-in via animation-delay per item.
  const [puzzleReady, setPuzzleReady] = useState(false);
  const gridRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (entrance !== "puzzle") {
      setPuzzleReady(false);
      return;
    }
    const el = gridRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPuzzleReady(true);
          obs.disconnect();
        }
      },
      { threshold: 0.05 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [entrance]);

  if (images.length === 0 && !ctx.editable) return null;

  const renderHoverIcon = () => (
    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
      <ImageIcon className="h-6 w-6 text-white opacity-0 group-hover:opacity-80 transition-opacity" />
    </div>
  );
  // Captions use a shared style key so the user picks color/font/size once
  // in the inline toolbar and every gallery caption follows. Per-image text
  // commits flow through onGalleryCaptionChange so edits persist into the
  // gallery_images record.
  const captionStyle = ctx.textStyles?.gallery_caption ?? {};
  const renderCaption = (
    caption: string | undefined,
    imageUrl: string,
    index: number,
  ) => {
    const hasText = !!(caption && caption.trim());
    if (!ctx.editable && !hasText) return null;
    const styleKey = `_galleryCaption_${index}`;
    return (
      <EditableText
        as="div"
        editable={ctx.editable}
        value={caption ?? ""}
        defaultValue={ctx.editable ? "Add a caption…" : ""}
        onCommit={(v) => ctx.onGalleryCaptionChange?.(imageUrl, v)}
        aiEnabled={false}
        textStyle={data.textStyles?.[styleKey]}
        onStyleChange={
          ctx.onStyleChange ? (s) => ctx.onStyleChange!(styleKey, s) : undefined
        }
        className="text-sm text-center px-1"
        style={{ color: captionStyle.color ?? labelColor, opacity: 0.75 }}
      />
    );
  };

  return (
    <SectionShell
      id="gallery"
      titleKey="gallery_title"
      defaultTitle="Gallery"
      icon={<ImageIcon className="h-4 w-4" />}
      data={data}
      ctx={ctx}
    >
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
        style={{
          fontFamily: elementFontStack(
            data,
            "gallery_subtitle",
            headingFont(data),
            "heading",
          ),
          color: labelColor,
        }}
        {...withBaseColor(tsp(ctx, "gallery_subtitle"), labelColor)}
      />
      {animation === "marquee" && images.length > 0 ? (
        <div
          className="relative overflow-hidden rounded-lg"
          style={{ ["--tw-ring-color" as string]: data.colorPalette.primary }}
        >
          <div
            className="flex"
            style={{
              width: "max-content",
              animation: `wsa-marquee ${marqueeDuration} linear infinite`,
              willChange: "transform",
            }}
          >
            {[...images, ...images].map((img, i) => (
              <div
                key={`${img.url}-${i}`}
                className="flex flex-col gap-1.5 mx-2"
              >
                <button
                  type="button"
                  onClick={() => setLightboxIndex(i % images.length)}
                  className="relative h-64 sm:h-80 w-64 sm:w-80 flex-shrink-0 overflow-hidden rounded-lg group focus:outline-none focus-visible:ring-2"
                  aria-label={img.caption ?? `Photo ${(i % images.length) + 1}`}
                >
                  <AuthMediaImage
                    src={img.url}
                    alt={img.caption ?? ""}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    style={{ filter: photoFilter }}
                  />
                  {renderHoverIcon()}
                </button>
                {renderCaption(img.caption, img.url, i % images.length)}
              </div>
            ))}
          </div>
        </div>
      ) : animation === "slideshow" && images.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div
            className="relative w-full max-w-3xl mx-auto aspect-[4/3] overflow-hidden rounded-lg"
            style={{ ["--tw-ring-color" as string]: data.colorPalette.primary }}
          >
            {images.map((img, i) => (
              <button
                key={`${img.url}-${i}`}
                type="button"
                onClick={() => setLightboxIndex(i)}
                className="absolute inset-0 group focus:outline-none focus-visible:ring-2"
                style={{
                  opacity: i === activeIdx ? 1 : 0,
                  transition: "opacity 1s ease-in-out",
                  pointerEvents: i === activeIdx ? "auto" : "none",
                }}
                aria-label={img.caption ?? `Photo ${i + 1}`}
                aria-hidden={i !== activeIdx}
                tabIndex={i === activeIdx ? 0 : -1}
              >
                <AuthMediaImage
                  src={img.url}
                  alt={img.caption ?? ""}
                  className="w-full h-full object-cover"
                  loading={i === 0 ? "eager" : "lazy"}
                  style={{ filter: photoFilter }}
                />
                {renderHoverIcon()}
              </button>
            ))}
            {images.length > 1 && (
              <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveIdx(i);
                    }}
                    className="h-2 w-2 rounded-full transition-all"
                    style={{
                      background:
                        i === activeIdx
                          ? data.colorPalette.primary
                          : "rgba(255,255,255,0.6)",
                      transform: i === activeIdx ? "scale(1.3)" : "scale(1)",
                    }}
                    aria-label={`Go to photo ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
          {renderCaption(
            images[activeIdx]?.caption,
            images[activeIdx]?.url ?? "",
            activeIdx,
          )}
        </div>
      ) : (
        <div
          ref={gridRef}
          className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4${puzzleReady ? " wsg-grid-ready" : ""}`}
          data-gallery-anim={entrance !== "none" ? entrance : undefined}
        >
          {images.map((img, i) => (
            <div
              key={i}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              className={`wsg-item flex flex-col gap-1.5${visibleItems.has(i) ? " wsg-visible" : ""}`}
              style={
                entrance !== "none"
                  ? {
                      ["--stagger" as string]:
                        entrance === "puzzle" ? `${i * 4000}ms` : `${i * 80}ms`,
                    }
                  : undefined
              }
            >
              <div>
                <button
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  className="relative aspect-square overflow-hidden rounded-lg group focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 w-full"
                  style={{
                    ["--tw-ring-color" as string]: data.colorPalette.primary,
                  }}
                  aria-label={img.caption ?? `Photo ${i + 1}`}
                >
                  <AuthMediaImage
                    src={img.url}
                    alt={img.caption ?? ""}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                    style={{ filter: photoFilter }}
                  />
                  {renderHoverIcon()}
                </button>
              </div>
              {renderCaption(img.caption, img.url, i)}
            </div>
          ))}
        </div>
      )}
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

export function parseWeddingPartyMembers(
  raw: string | undefined,
): WeddingPartyMember[] {
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
        side:
          m.side === "groom" || m.side === "bride" || m.side === "family"
            ? m.side
            : undefined,
        photoX:
          typeof m.photoX === "number"
            ? Math.max(0, Math.min(100, m.photoX))
            : undefined,
        photoY:
          typeof m.photoY === "number"
            ? Math.max(0, Math.min(100, m.photoY))
            : undefined,
      }));
  } catch {
    return [];
  }
}

function PartyMemberCard({
  data,
  member,
  labelColor,
}: {
  data: WebsiteRendererPayload;
  member: WeddingPartyMember;
  labelColor: string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div
        className="w-32 h-32 sm:w-36 sm:h-36 rounded-full overflow-hidden mb-4 flex items-center justify-center"
        style={{
          background: `${data.colorPalette.primary}15`,
          border: `1px solid ${data.colorPalette.primary}33`,
        }}
      >
        {member.photo ? (
          <AuthMediaImage
            src={member.photo}
            alt={member.name}
            className="w-full h-full object-cover"
            style={{
              objectPosition: `${member.photoX ?? 50}% ${member.photoY ?? 50}%`,
            }}
            loading="lazy"
          />
        ) : (
          <Heart
            className="h-8 w-8 opacity-30"
            style={{ color: data.colorPalette.primary }}
          />
        )}
      </div>
      <div
        className="text-2xl sm:text-3xl mb-1"
        style={{
          fontFamily: fontStack(headingFont(data)),
          color: data.colorPalette.primary,
        }}
      >
        {member.name || "Name"}
      </div>
      <div
        className="text-sm opacity-80"
        style={{ color: labelColor, fontFamily: bodyFontStack(bodyFont(data)) }}
      >
        {member.role || "Role"}
      </div>
    </div>
  );
}

function WeddingParty({
  data,
  ctx,
}: {
  data: WebsiteRendererPayload;
  ctx: EditCtx;
}) {
  // Portal party members take precedence over manually-entered ones

  const labelColor = sectionTextColor(data, "weddingParty");
  const usesPortalParty = !!(data.portalParty && data.portalParty.length > 0);
  const rawMembers: WeddingPartyMember[] =
    usesPortalParty
      ? data.portalParty.map((m) => ({
          photo: m.photoUrl ?? "",
          name: m.name,
          role: m.role,
          side:
            m.side === "groom" || m.side === "bride" || m.side === "family"
              ? (m.side as WeddingPartySide)
              : undefined,
        }))
      : parseWeddingPartyMembers(data.customText._weddingPartyMembers);

  // Only show people the user actually filled in. Anyone with a blank
  // name is treated as an empty slot and skipped on the published site.
  // (Editor still renders them so the user can finish setting them up.)
  const members = ctx.editable
    ? rawMembers
    : rawMembers.filter((m) => m.name?.trim());

  if (members.length === 0 && !ctx.editable) return null;

  // Sort each side so the principal roles always come first: Groom + Best
  // Man on the groom side, Bride + Maid of Honor on the bride side. Then
  // groomsmen / bridesmaids in the order they were added, then everyone
  // else last.
  const groomRolePriority = (role: string): number => {
    const r = role?.toLowerCase().trim() ?? "";
    if (r === "groom") return 0;
    if (r === "best man") return 1;
    if (r.includes("groomsman") || r.includes("groomsmen")) return 2;
    if (r.includes("ring bearer")) return 3;
    return 99;
  };
  const brideRolePriority = (role: string): number => {
    const r = role?.toLowerCase().trim() ?? "";
    if (r === "bride") return 0;
    if (r === "maid of honor" || r === "matron of honor") return 1;
    if (r.includes("bridesmaid")) return 2;
    if (r.includes("flower girl")) return 3;
    return 99;
  };
  const stableSort = <T,>(arr: T[], priority: (item: T) => number): T[] =>
    arr
      .map((item, index) => ({ item, index, p: priority(item) }))
      .sort((a, b) => a.p - b.p || a.index - b.index)
      .map((x) => x.item);

  const groomMembers = members.filter((m) => m.side === "groom");
  const brideMembers = members.filter((m) => m.side === "bride");
  const groomSide = usesPortalParty
    ? groomMembers
    : stableSort(groomMembers, (m) => groomRolePriority(m.role));
  const brideSide = usesPortalParty
    ? brideMembers
    : stableSort(brideMembers, (m) => brideRolePriority(m.role));
  const familySide = members.filter((m) => m.side === "family" || !m.side);

  // When a side has an odd number of members, the trailing card spans
  // both columns and centers itself so it doesn't sit alone. Done in
  // pure CSS via an arbitrary :last-child:nth-child(odd) selector so
  // we don't need a wrapper div around each PartyMemberCard (which was
  // breaking the photo-vs-name alignment under each card).
  const oddLastGridClass =
    "[&>:last-child:nth-child(odd)]:sm:col-span-2 [&>:last-child:nth-child(odd)]:sm:justify-self-center [&>:last-child:nth-child(odd)]:sm:max-w-[220px]";

  return (
    <SectionShell
      id="weddingParty"
      titleKey="weddingParty_title"
      defaultTitle="Wedding Party"
      icon={<Heart className="h-4 w-4" />}
      data={data}
      ctx={ctx}
    >
      <EditableText
        as="div"
        editable={ctx.editable}
        value={data.customText.weddingParty_subtitle ?? ""}
        defaultValue="Meet our family & friends standing with us"
        onCommit={(v) => ctx.onTextChange("weddingParty_subtitle", v)}
        className="block text-center text-base sm:text-lg max-w-2xl mx-auto mb-12 opacity-80"
        style={{
          color: labelColor,
          fontFamily: elementFontStack(
            data,
            "weddingParty_subtitle",
            bodyFont(data),
            "body",
          ),
        }}
        {...withBaseColor(tsp(ctx, "weddingParty_subtitle"), labelColor)}
      />
      {members.length === 0 ? (
        <p
          className="text-center text-sm opacity-60"
          style={{ color: labelColor }}
        >
          No wedding party members yet — add some from the sidebar.
        </p>
      ) : (
        <div className="space-y-16">
          {(groomSide.length > 0 || brideSide.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-0 max-w-5xl mx-auto relative">
              {/* Bride's side */}
              <div
                className="md:pr-12 md:border-r"
                style={{ borderColor: `${data.colorPalette.primary}33` }}
              >
                <h3
                  className="text-center text-2xl sm:text-3xl mb-10"
                  style={{
                    fontFamily: fontStack(headingFont(data)),
                    color: labelColor,
                  }}
                >
                  <EditableText
                    editable={ctx.editable}
                    value={data.customText.weddingParty_brideLabel ?? ""}
                    defaultValue="Bride's Party"
                    onCommit={(v) =>
                      ctx.onTextChange("weddingParty_brideLabel", v)
                    }
                  />
                </h3>
                {brideSide.length === 0 ? (
                  <p
                    className="text-center text-xs opacity-50"
                    style={{ color: labelColor }}
                  >
                    {ctx.editable
                      ? "Add members from the sidebar with side set to Bride"
                      : ""}
                  </p>
                ) : (
                  <div
                    className={`grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-10 ${oddLastGridClass}`}
                  >
                    {brideSide.map((m, i) => (
                      <PartyMemberCard
                        key={`b-${i}`}
                        data={data}
                        member={m}
                        labelColor={labelColor}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Groom's side */}
              <div className="md:pl-12">
                <h3
                  className="text-center text-2xl sm:text-3xl mb-10"
                  style={{
                    fontFamily: fontStack(headingFont(data)),
                    color: labelColor,
                  }}
                >
                  <EditableText
                    editable={ctx.editable}
                    value={data.customText.weddingParty_groomLabel ?? ""}
                    defaultValue="Groom's Party"
                    onCommit={(v) =>
                      ctx.onTextChange("weddingParty_groomLabel", v)
                    }
                  />
                </h3>
                {groomSide.length === 0 ? (
                  <p
                    className="text-center text-xs opacity-50"
                    style={{ color: labelColor }}
                  >
                    {ctx.editable
                      ? "Add members from the sidebar with side set to Groom"
                      : ""}
                  </p>
                ) : (
                  <div
                    className={`grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-10 ${oddLastGridClass}`}
                  >
                    {groomSide.map((m, i) => (
                      <PartyMemberCard
                        key={`g-${i}`}
                        data={data}
                        member={m}
                        labelColor={labelColor}
                      />
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
                style={{
                  fontFamily: fontStack(headingFont(data)),
                  color: labelColor,
                }}
              >
                <EditableText
                  editable={ctx.editable}
                  value={data.customText.weddingParty_familyLabel ?? ""}
                  defaultValue="Family & Friends"
                  onCommit={(v) =>
                    ctx.onTextChange("weddingParty_familyLabel", v)
                  }
                />
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-10">
                {familySide.map((m, i) => (
                  <PartyMemberCard
                    key={`f-${i}`}
                    data={data}
                    member={m}
                    labelColor={labelColor}
                  />
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
  const couple = `${data.couple.partner2Name} & ${data.couple.partner1Name}`;
  const dateStr = formatWeddingDate(data.couple.weddingDate);
  return (
    <>
      <footer
        className="py-12 px-6 text-center"
        style={{
          background: data.customText._footerColor || data.colorPalette.primary,
          color: "#fff",
        }}
      >
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
  const year = new Date().getFullYear();
  return (
    <div className="py-8 px-6 text-center bg-[#5B0F2A] text-[#F7E7D6]/85 space-y-4">
      <a
        href="https://aidowedding.net?utm_source=wedding_website&utm_medium=footer"
        target="_blank"
        rel="noopener"
        className="inline-flex items-center gap-2.5 text-sm hover:text-white transition-colors group"
      >
        <span className="opacity-70">Built with</span>
        <img src="/logo.png" alt="A.IDO" className="h-10 w-auto object-contain" />
        <span
          className="font-semibold tracking-wide text-base"
          style={{ color: "#F3C6D3" }}
        >
          A.IDO
        </span>
        <span className="opacity-50 group-hover:opacity-80 transition-opacity">
          — Plan your wedding too →
        </span>
      </a>
      <nav className="flex items-center justify-center flex-wrap gap-x-4 gap-y-1 text-xs">
        <a
          href="https://aidowedding.net/privacy"
          target="_blank"
          rel="noopener"
          className="hover:text-white transition-colors"
        >
          Privacy
        </a>
        <span className="opacity-40">·</span>
        <a
          href="https://aidowedding.net/terms"
          target="_blank"
          rel="noopener"
          className="hover:text-white transition-colors"
        >
          Terms &amp; Conditions
        </a>
        <span className="opacity-40">·</span>
        <a
          href="https://aidowedding.net/security"
          target="_blank"
          rel="noopener"
          className="hover:text-white transition-colors"
        >
          Security
        </a>
        <span className="opacity-40">·</span>
        <a
          href="https://aidowedding.net/data-handling"
          target="_blank"
          rel="noopener"
          className="hover:text-white transition-colors"
        >
          Data Handling
        </a>
      </nav>
      <p className="text-[11px] opacity-60 max-w-2xl mx-auto leading-relaxed">
        © {year} A.IDO. All rights reserved. A.IDO is the platform that hosts
        this wedding website. Photos, names, schedules, and other content shown
        here are provided by the wedding couple and are their sole
        responsibility. By visiting this site you agree to A.IDO&rsquo;s Terms
        &amp; Conditions and Privacy Policy.
      </p>
    </div>
  );
}

function ShareButton({ accent, text }: { accent: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const onClick = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const title = typeof document !== "undefined" ? document.title : "";
    try {
      // Prefer the native Share Sheet on mobile if available (gives guests
      // text / WhatsApp / iMessage / etc.), fall back to clipboard.
      if (
        typeof navigator !== "undefined" &&
        (
          navigator as Navigator & {
            share?: (data: ShareData) => Promise<void>;
          }
        ).share
      ) {
        await (
          navigator as Navigator & { share: (data: ShareData) => Promise<void> }
        ).share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* user cancelled or clipboard blocked */
    }
  };
  return (
    <button
      onClick={onClick}
      className="absolute right-3 top-3 z-40 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:opacity-90"
      style={{
        background: `${accent}15`,
        color: text,
        border: `1px solid ${accent}33`,
      }}
      title={copied ? "Link copied!" : "Share this page"}
      aria-label={copied ? "Link copied" : "Share"}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Share2 className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">{copied ? "Copied" : "Share"}</span>
    </button>
  );
}

function TopNav({
  data,
  scrollContainer,
  pageMode,
  slug,
  currentSection,
  onSectionChange,
}: {
  data: WebsiteRendererPayload;
  scrollContainer?: HTMLElement | null;
  pageMode: boolean;
  slug?: string;
  currentSection: string;
  // When provided, nav buttons call this instead of scrolling or routing.
  // Used by the editor's Guest Preview to drive page-per-section navigation
  // through React state without changing the actual URL.
  onSectionChange?: (id: string) => void;
}) {
  const couple = `${data.couple.partner2Name} & ${data.couple.partner1Name}`;
  const [scrollActive, setScrollActive] = useState<string>("home");

  // Build the ordered list of nav items only for sections that are enabled.
  const items: Array<{ id: string; label: string }> = [
    { id: "home", label: "Home" },
  ];
  if (data.sectionsEnabled.story)
    items.push({ id: "story", label: "Our Story" });
  if (data.sectionsEnabled.schedule)
    items.push({ id: "schedule", label: "Schedule" });
  if (data.sectionsEnabled.travel)
    items.push({ id: "travel", label: "Travel" });
  if (data.sectionsEnabled.registry)
    items.push({ id: "registry", label: "Registry" });
  if (data.sectionsEnabled.weddingParty)
    items.push({ id: "weddingParty", label: "Wedding Party" });
  if (data.sectionsEnabled.gallery)
    items.push({ id: "gallery", label: "Gallery" });
  if (data.sectionsEnabled.faq) items.push({ id: "faq", label: "FAQ" });
  if (data.sectionsEnabled.rsvp !== false)
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
      {
        root,
        rootMargin: "-30% 0px -50% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );
    items.forEach((it) => {
      const el = scrollContainer
        ? (scrollContainer.querySelector(
            `#${CSS.escape(it.id)}`,
          ) as HTMLElement | null)
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
      ? (scrollContainer.querySelector(
          `#${CSS.escape(id)}`,
        ) as HTMLElement | null)
      : document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setScrollActive(id);
  };

  const active = pageMode ? currentSection : scrollActive;

  const renderItem = (it: { id: string; label: string }) => {
    const className = `relative pb-1 font-semibold transition-colors hover:opacity-80 ${active === it.id ? "" : "opacity-70"}`;
    const style = {
      color: data.customText._navLinkColor || data.colorPalette.text,
      borderBottom:
        active === it.id
          ? `2px solid ${data.colorPalette.primary}`
          : "2px solid transparent",
      fontFamily: fontStack(headingFont(data)),
      fontWeight: 600,
    };
    if (onSectionChange) {
      return (
        <button
          key={it.id}
          onClick={() => {
            onSectionChange(it.id);
            scrollContainer?.scrollTo({ top: 0, behavior: "auto" });
          }}
          className={className}
          style={style}
        >
          {it.label}
        </button>
      );
    }
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
      <button
        key={it.id}
        onClick={() => scrollTo(it.id)}
        className={className}
        style={style}
      >
        {it.label}
      </button>
    );
  };

  const homeHref = slug && !onSectionChange ? `/w/${slug}` : undefined;
  // Show the Share button only on the real public site (not editor preview / live preview)
  const showShare = !!slug && !onSectionChange;

  return (
    <nav
      className="sticky top-0 z-30 backdrop-blur-md border-b"
      style={{
        background: `${data.colorPalette.background}ee`,
        borderColor: `${data.colorPalette.primary}22`,
      }}
    >
      {showShare && (
        <ShareButton
          accent={data.colorPalette.primary}
          text={data.colorPalette.text}
        />
      )}
      <div className="max-w-5xl mx-auto px-4 py-3 sm:py-4 flex flex-col items-center gap-2">
        {homeHref ? (
          <Link
            href={homeHref}
            className="text-2xl sm:text-3xl leading-tight transition-colors hover:opacity-80"
            style={{
              fontFamily: fontStack(headingFont(data)),
              color:
                data.customText._navCoupleColor || data.colorPalette.primary,
            }}
          >
            {couple}
          </Link>
        ) : (
          <button
            onClick={() => {
              if (onSectionChange) {
                onSectionChange("home");
                scrollContainer?.scrollTo({ top: 0, behavior: "auto" });
              } else {
                scrollTo("home");
              }
            }}
            className="text-2xl sm:text-3xl leading-tight transition-colors hover:opacity-80"
            style={{
              fontFamily: fontStack(headingFont(data)),
              color:
                data.customText._navCoupleColor || data.colorPalette.primary,
            }}
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
  onGalleryCaptionChange,
  currentSection,
  onSectionChange,
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
  // Per-image gallery caption editor: takes the image URL (stable id) and
  // the new caption string. Wired up by the website editor so inline caption
  // edits flow back to record.galleryImages.
  onGalleryCaptionChange?: (imageUrl: string, caption: string) => void;
  currentSection?: string;
  // When provided alongside currentSection, the TopNav drives navigation
  // through this callback instead of routing or scrolling — used by the
  // editor's Guest Preview to render one section at a time without changing
  // the URL.
  onSectionChange?: (id: string) => void;
  slug?: string;
  password?: string | null;
  // Force scroll-based nav even when slug is provided (used by editor guest preview)
  previewMode?: boolean;
}) {
  const ctx: EditCtx =
    editable && onTextChange
      ? {
          editable: true,
          previewMode,
          onTextChange,
          textStyles: data.textStyles,
          onStyleChange,
          textPositions: data.textPositions,
          onPositionChange,
          onDeleteElement,
          onGalleryCaptionChange,
        }
      : {
          editable: false,
          previewMode,
          onTextChange: () => {},
          textStyles: data.textStyles,
          textPositions: data.textPositions,
        };

  // Dynamically load the chosen heading + body Google Fonts so that fonts not
  // preloaded in index.html (e.g. Tangerine, Great Vibes, Allura) actually render.
  const headingFontName = headingFont(data);
  const bodyFontName = bodyFont(data);
  const faqQuestionFont = data.customText._faqQuestionFont ?? "";
  const faqAnswerFont = data.customText._faqAnswerFont ?? "";
  useEffect(() => {
    const families = Array.from(
      new Set(
        [headingFontName, bodyFontName, faqQuestionFont, faqAnswerFont].filter(
          Boolean,
        ),
      ),
    );
    families.forEach((family) => {
      const id = `aido-font-${family.replace(/\s+/g, "-").toLowerCase()}`;
      if (document.getElementById(id)) return;
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@400;500;600;700&display=swap`;
      document.head.appendChild(link);
    });
  }, [headingFontName, bodyFontName, faqQuestionFont, faqAnswerFont]);

  const pageMode = !!currentSection;
  const showAll = !pageMode;
  const show = (id: string, enabled: boolean) =>
    enabled && (showAll || currentSection === id);
  // In previewMode, force scroll-based nav so TopNav buttons don't navigate away
  const navSlug = previewMode ? undefined : slug;

  return (
    <div
      style={{
        background: data.colorPalette.background,
        color: data.colorPalette.text,
        fontFamily: "system-ui, -apple-system, sans-serif",
        position: "relative",
      }}
    >
      <AnnouncementBanner data={data} ctx={ctx} />
      <TopNav
        data={data}
        scrollContainer={scrollContainer}
        pageMode={pageMode}
        slug={navSlug}
        currentSection={currentSection ?? "home"}
        onSectionChange={onSectionChange}
      />
      {(showAll || currentSection === "home") && <Hero data={data} ctx={ctx} />}
      {data.sectionsEnabled.welcome &&
        (showAll ||
          currentSection === "home" ||
          currentSection === "welcome") && <Welcome data={data} ctx={ctx} />}
      {show("story", data.sectionsEnabled.story) && (
        <Story data={data} ctx={ctx} />
      )}
      {show("schedule", data.sectionsEnabled.schedule) && (
        <Schedule data={data} ctx={ctx} />
      )}
      {show("travel", data.sectionsEnabled.travel) && (
        <Travel data={data} ctx={ctx} />
      )}
      {show("registry", data.sectionsEnabled.registry) && (
        <Registry data={data} ctx={ctx} />
      )}
      {show("weddingParty", data.sectionsEnabled.weddingParty) && (
        <WeddingParty data={data} ctx={ctx} />
      )}
      {show("faq", data.sectionsEnabled.faq) && <Faq data={data} ctx={ctx} />}
      {show("gallery", data.sectionsEnabled.gallery) && (
        <Gallery data={data} ctx={ctx} />
      )}
      {show("rsvp", data.sectionsEnabled.rsvp !== false) &&
        (slug ? (
          <RsvpFlow
            data={data}
            slug={slug}
            password={password ?? undefined}
            previewMode={previewMode}
          />
        ) : (
          <RsvpSection data={data} ctx={ctx} />
        ))}
      <Footer data={data} ctx={ctx} />
      <CustomTextBoxes
        data={data}
        ctx={ctx}
        currentSection={currentSection ?? "home"}
        showAll={showAll}
      />
    </div>
  );
}
