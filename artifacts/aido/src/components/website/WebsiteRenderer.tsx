import {
  cloneElement,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
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
  UploadCloud,
  Camera,
  Download,
  Phone,
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
import { downloadMediaFile, guestPhotoDownloadName } from "@/lib/mediaDownload";
import { getGuestPhotoDeviceId } from "@/lib/guestPhotoDevice";
import { publishedWebsiteUrl } from "@/lib/publicUrls";
import { coupleFirstNames, displayFirstName } from "@/lib/coupleNames";
import { AuthMediaImage } from "@/components/AuthMediaImage";

// camelCase section id <-> kebab-case URL slug
const SECTION_TO_URL: Record<string, string> = {
  home: "home",
  welcome: "welcome",
  story: "story",
  schedule: "schedule",
  travel: "travel",
  registry: "registry",
  weddingParty: "wedding-party",
  gallery: "gallery",
  photoDrop: "guest-photo-drop",
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

function splitDisplayName(name: string) {
  return { first: displayFirstName(name), last: "" };
}

function coupleHeaderParts(data: WebsiteRendererPayload) {
  const partner2 = splitDisplayName(data.couple.partner2Name);
  const partner1 = splitDisplayName(data.couple.partner1Name);
  const firstLine = [partner2.first, partner1.first].filter(Boolean).join(" & ");
  return {
    firstLine: firstLine || coupleFirstNames(data.couple.partner2Name, data.couple.partner1Name),
    lastLine: "",
  };
}

function hasInlineHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function stackedCoupleName(value: string) {
  if (hasInlineHtml(value)) {
    return value.replace(
      /\s*(?:&amp;|&)\s*/gi,
      '<br><span style="display: block; width: 100%; text-align: center">&amp;</span><br>',
    );
  }
  return value.replace(/\s+&\s+/g, "\n&\n");
}

function stackedFooterCoupleName(value: string, data: WebsiteRendererPayload) {
  const { lastLine } = coupleHeaderParts(data);
  if (!lastLine || hasInlineHtml(value) || value.includes("\n")) return value;
  const pattern = new RegExp(`\\s+${lastLine.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  return pattern.test(value) ? value.replace(pattern, `\n${lastLine}`) : value;
}

function firstInitial(name: string) {
  const match = name.trim().match(/[\p{L}0-9]/u);
  return match?.[0]?.toUpperCase() ?? "";
}

function coupleInitials(data: WebsiteRendererPayload) {
  const brideInitial = firstInitial(data.couple.partner2Name);
  const groomInitial = firstInitial(data.couple.partner1Name);
  return [brideInitial, groomInitial].filter(Boolean).join(" & ") || "G & J";
}

function defaultFooterCoupleName(data: WebsiteRendererPayload) {
  return coupleInitials(data);
}

function fullCoupleName(data: WebsiteRendererPayload) {
  return [data.couple.partner2Name, data.couple.partner1Name].filter(Boolean).join(" & ");
}

function displayCoupleName(data: WebsiteRendererPayload) {
  return coupleFirstNames(data.couple.partner2Name, data.couple.partner1Name);
}

function coupleTextValue(value: string, data: WebsiteRendererPayload) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const firstNames = displayCoupleName(data);
  const oldFullName = fullCoupleName(data);
  if (trimmed.replace(/\s+/g, " ") === oldFullName.replace(/\s+/g, " ")) return firstNames;
  return trimmed;
}

function footerCoupleValue(value: string, data: WebsiteRendererPayload) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const { firstLine, lastLine } = coupleHeaderParts(data);
  const oldFullName = lastLine ? `${firstLine}\n${lastLine}` : firstLine;
  const oldStackedName = stackedFooterCoupleName(trimmed, data);
  if (
    trimmed === oldFullName ||
    trimmed === oldStackedName ||
    trimmed.replace(/\s+/g, " ") === oldFullName.replace(/\s+/g, " ")
  ) {
    return coupleInitials(data);
  }

  return trimmed;
}

export interface WebsiteRendererPayload {
  slug?: string;
  publicWebsiteUrl?: string | null;
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
      underline?: boolean;
      strikethrough?: boolean;
      textAlign?: "left" | "center" | "right";
      animation?: string;
      width?: string;
      height?: string;
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
    checkInDate?: string | null;
    checkOutDate?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    distanceFromVenue?: string | null;
  }>;
  mealOptions?: Array<{ value: string; label: string }>;
  galleryImages: Array<{ url: string; caption?: string; order: number }>;
  guestPhotoDrop?: {
    enabled: boolean;
    galleryEnabled: boolean;
    displayMode?: "portal" | "website" | "both";
    approvalRequired: boolean;
    maxUploads: number;
    uploadLimitMb: number;
    title: string;
    instructions: string;
    photos: Array<{
      id: number;
      guestName: string;
      note?: string | null;
      caption?: string | null;
      imageUrl: string;
      publicImageUrl?: string;
      status: string;
      uploadedAt: string;
    }>;
  };
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
    venueZip?: string | null;
  };
  // timeline removed - wedding website schedule is entered directly by the couple
}

export type WebsiteRenderDevice = "desktop" | "mobile";
export const WEBSITE_DEVICE_OVERRIDES_KEY = "_deviceOverrides";

function detectWebsiteRenderDevice(): WebsiteRenderDevice {
  if (typeof window === "undefined") return "desktop";

  const viewportWidth = Math.min(
    window.innerWidth || Number.POSITIVE_INFINITY,
    window.visualViewport?.width || Number.POSITIVE_INFINITY,
    document.documentElement?.clientWidth || Number.POSITIVE_INFINITY,
  );
  const ua = navigator.userAgent || "";
  const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|CriOS|FxiOS/i.test(ua);
  const hasCoarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const isNarrowViewport = viewportWidth <= 900;

  return isNarrowViewport || isMobileUserAgent || (hasCoarsePointer && viewportWidth <= 1180) ? "mobile" : "desktop";
}

export type WebsiteDeviceOverride = Partial<
  Pick<
    WebsiteRendererPayload,
    | "theme"
    | "layoutStyle"
    | "font"
    | "accentColor"
    | "colorPalette"
    | "sectionsEnabled"
    | "customText"
    | "textStyles"
    | "textPositions"
    | "galleryImages"
    | "heroImages"
    | "heroImage"
  >
>;

export type WebsiteDeviceOverrides = Partial<Record<WebsiteRenderDevice, WebsiteDeviceOverride>>;

export function parseWebsiteDeviceOverrides(customText?: Record<string, string>): WebsiteDeviceOverrides {
  const raw = customText?.[WEBSITE_DEVICE_OVERRIDES_KEY];
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as WebsiteDeviceOverrides) : {};
  } catch {
    return {};
  }
}

function stripDeviceOverrideMarker(customText: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!customText || !(WEBSITE_DEVICE_OVERRIDES_KEY in customText)) return customText;
  const { [WEBSITE_DEVICE_OVERRIDES_KEY]: _marker, ...rest } = customText;
  void _marker;
  return rest;
}

function layoutOnlyTextStyles(styles: WebsiteDeviceOverride["textStyles"]) {
  if (!styles) return {};
  return Object.fromEntries(
    Object.entries(styles).map(([key, style]) => {
      if (!style || typeof style !== "object") return [key, style];
      const {
        fontFamily: _fontFamily,
        color: _color,
        bold: _bold,
        italic: _italic,
        underline: _underline,
        strikethrough: _strikethrough,
        ...layoutStyle
      } = style as TextStyle;
      void _fontFamily;
      void _color;
      void _bold;
      void _italic;
      void _underline;
      void _strikethrough;
      return [key, layoutStyle];
    }),
  );
}

function layoutOnlyCustomText(customText: WebsiteDeviceOverride["customText"]) {
  const text = stripDeviceOverrideMarker(customText);
  if (!text) return text;
  return Object.fromEntries(
    Object.entries(text).filter(([key]) => {
      if (!key.startsWith("_")) return false;
      if (key === "_headingFont" || key === "_bodyFont") return false;
      if (key === "_faqQuestionFont" || key === "_faqAnswerFont") return false;
      return !key.endsWith("_font");
    }),
  );
}

function typographyOnlyCustomText(customText: WebsiteDeviceOverride["customText"]) {
  const text = stripDeviceOverrideMarker(customText);
  if (!text) return {};
  return Object.fromEntries(
    Object.entries(text).filter(([key, value]) => {
      if (typeof value !== "string" || !value.trim()) return false;
      return (
        key === "_headingFont" ||
        key === "_bodyFont" ||
        key === "_faqQuestionFont" ||
        key === "_faqAnswerFont" ||
        key.endsWith("_font")
      );
    }),
  );
}

function typographyOnlyTextStyles(styles: WebsiteDeviceOverride["textStyles"]) {
  if (!styles) return {};
  const entries = Object.entries(styles).flatMap(([key, style]) => {
      if (!style || typeof style !== "object") return [];
      const source = style as TextStyle;
      const typography: TextStyle = {};
      if (source.fontFamily) typography.fontFamily = source.fontFamily;
      if (source.color) typography.color = source.color;
      if (source.bold !== undefined) typography.bold = source.bold;
      if (source.italic !== undefined) typography.italic = source.italic;
      if (source.underline !== undefined) typography.underline = source.underline;
      if (source.strikethrough !== undefined) typography.strikethrough = source.strikethrough;
      return Object.keys(typography).length ? [[key, typography]] : [];
    });
  return Object.fromEntries(entries);
}

function mergeTextStyleRecords(
  ...records: Array<Record<string, TextStyle> | undefined>
) {
  const merged: Record<string, TextStyle> = {};
  records.forEach((record) => {
    Object.entries(record ?? {}).forEach(([key, style]) => {
      if (!style || typeof style !== "object") return;
      merged[key] = { ...(merged[key] ?? {}), ...style };
    });
  });
  return merged;
}

export function applyWebsiteDeviceOverrides<T extends WebsiteRendererPayload>(
  data: T,
  device: WebsiteRenderDevice,
): T {
  const overrides = parseWebsiteDeviceOverrides(data.customText);
  const desktopTypography =
    device === "mobile" ? overrides.desktop : undefined;
  const sharedTypographyData = desktopTypography
    ? ({
        ...data,
        customText: {
          ...stripDeviceOverrideMarker(data.customText),
          ...typographyOnlyCustomText(desktopTypography.customText),
        },
        textStyles: {
          ...mergeTextStyleRecords(
            data.textStyles,
            typographyOnlyTextStyles(desktopTypography.textStyles),
          ),
        },
      } as T)
    : ({
        ...data,
        customText: stripDeviceOverrideMarker(data.customText) ?? data.customText,
      } as T);
  const override = overrides[device];
  if (!override) {
    return sharedTypographyData;
  }

  if (device === "desktop") {
    return {
      ...data,
      ...override,
      colorPalette: override.colorPalette
        ? { ...data.colorPalette, ...override.colorPalette }
        : data.colorPalette,
      sectionsEnabled: override.sectionsEnabled
        ? { ...data.sectionsEnabled, ...override.sectionsEnabled }
        : data.sectionsEnabled,
      customText: {
        ...stripDeviceOverrideMarker(data.customText),
        ...stripDeviceOverrideMarker(override.customText),
      },
      textStyles: {
        ...mergeTextStyleRecords(data.textStyles, override.textStyles),
      },
      textPositions: {
        ...(data.textPositions ?? {}),
        ...(override.textPositions ?? {}),
      },
    };
  }

  return {
    ...sharedTypographyData,
    sectionsEnabled: override.sectionsEnabled
      ? { ...sharedTypographyData.sectionsEnabled, ...override.sectionsEnabled }
      : sharedTypographyData.sectionsEnabled,
    customText: {
      ...stripDeviceOverrideMarker(sharedTypographyData.customText),
      ...layoutOnlyCustomText(override.customText),
    },
    textStyles: {
      ...mergeTextStyleRecords(
        sharedTypographyData.textStyles,
        layoutOnlyTextStyles(override.textStyles),
      ),
    },
    textPositions: {
      ...(sharedTypographyData.textPositions ?? {}),
      ...(override.textPositions ?? {}),
    },
  };
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

function formatWeddingDateWithoutWeekday(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
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
  underline?: boolean;
  strikethrough?: boolean;
  textAlign?: "left" | "center" | "right";
  animation?: string;
  width?: string;
  height?: string;
};

// Edit mode props passed to every section (and its EditableText spans).
interface EditCtx {
  editable: boolean;
  renderDevice?: WebsiteRenderDevice;
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

// Style-only, no delete, no drag - for hero elements that must stay
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

function objectMediaTail(rawSrc: string | null | undefined): string | null {
  if (!rawSrc || /^(blob:|data:)/i.test(rawSrc)) return null;
  const objectPrefix = "/objects/";
  const storagePrefix = "/storage/objects/";
  const apiStoragePrefix = "/api/storage/objects/";
  const websiteMediaPrefix = "/api/website/media/";
  const pathFrom = (value: string) => {
    try {
      return new URL(value).pathname;
    } catch {
      return value;
    }
  };
  const path = pathFrom(rawSrc);
  if (path.startsWith(apiStoragePrefix)) return path.slice(apiStoragePrefix.length).split(/[?#]/)[0] || null;
  if (path.startsWith(storagePrefix)) return path.slice(storagePrefix.length).split(/[?#]/)[0] || null;
  if (path.startsWith(websiteMediaPrefix)) return path.slice(websiteMediaPrefix.length).split(/[?#]/)[0] || null;
  if (path.startsWith(objectPrefix)) return path.slice(objectPrefix.length).split(/[?#]/)[0] || null;
  const publicMediaMatch = path.match(/\/api\/website\/public\/[^/]+\/media\/(.+)$/);
  if (publicMediaMatch) return publicMediaMatch[1].split(/[?#]/)[0] || null;
  return null;
}

function encodeMediaTail(tail: string): string {
  return tail
    .split("/")
    .filter(Boolean)
    .map((part) => {
      try {
        return encodeURIComponent(decodeURIComponent(part));
      } catch {
        return encodeURIComponent(part);
      }
    })
    .join("/");
}

function authBackgroundCandidates(rawSrc: string | null | undefined, resolvedSrc: string): string[] {
  const candidates: string[] = [];
  const rawPath = rawSrc
    ? (() => {
        try {
          return new URL(rawSrc).pathname;
        } catch {
          return rawSrc;
        }
      })()
    : "";
  const resolvedPath = (() => {
    try {
      return new URL(resolvedSrc).pathname;
    } catch {
      return resolvedSrc;
    }
  })();
  if (
    /^\/api\/website\/public\/[^/]+\/media\//.test(rawPath) ||
    /^\/api\/website\/public\/[^/]+\/media\//.test(resolvedPath)
  ) {
    candidates.push(resolvedSrc);
    return candidates;
  }
  const tail = objectMediaTail(rawSrc) ?? objectMediaTail(resolvedSrc);
  if (tail) {
    const websiteMedia = resolveMediaUrl(`/api/website/media/${encodeMediaTail(tail)}`);
    if (websiteMedia && !candidates.includes(websiteMedia)) candidates.push(websiteMedia);
  }
  if (!isMediaAuthRequired(resolvedSrc) && !candidates.includes(resolvedSrc)) candidates.push(resolvedSrc);
  return candidates;
}

const authBackgroundBlobCache = new Map<string, string>();
const authBackgroundBlobInflight = new Map<string, Promise<string | null>>();

// Fetches a protected media URL as a blob so CSS background-image can use it.
// For protected URLs, avoid applying the raw URL directly. CSS backgrounds
// cannot attach auth headers, so using the raw URL creates noisy 403s and a
// broken image before the authenticated blob fetch has a chance to resolve.
function useAuthBlobUrl(url: string | null | undefined): string | null {
  const resolved = resolveMediaUrl(url);
  const requiresAuth = isMediaAuthRequired(url) || isMediaAuthRequired(resolved);
  const [blobSrc, setBlobSrc] = useState<string | null>(null);
  const blobRef = useRef<string | null>(null);

  useEffect(() => {
    if (blobRef.current && !authBackgroundBlobCache.has(resolved ?? "")) {
      URL.revokeObjectURL(blobRef.current);
      blobRef.current = null;
    }
    if (!resolved || !requiresAuth) {
      setBlobSrc(null);
      return;
    }
    const cacheKeys = [resolved, ...authBackgroundCandidates(url, resolved)];
    const cached = cacheKeys.map((key) => authBackgroundBlobCache.get(key)).find(Boolean);
    if (cached) {
      blobRef.current = cached;
      setBlobSrc(cached);
      return;
    }
    setBlobSrc(null);
    let cancelled = false;
    const candidates = authBackgroundCandidates(url, resolved);
    const cacheKey = candidates[0] ?? resolved;
    let loadPromise = authBackgroundBlobInflight.get(cacheKey);
    if (!loadPromise) {
      loadPromise = (async () => {
      for (const candidate of candidates) {
        try {
          const res = await authFetch(candidate);
          if (!res.ok) continue;
          const blob = await res.blob();
          const next = URL.createObjectURL(blob);
          authBackgroundBlobCache.set(resolved, next);
          for (const cacheCandidate of candidates) {
            authBackgroundBlobCache.set(cacheCandidate, next);
          }
          return next;
        } catch {
          /* try the next candidate */
        }
      }
      return null;
      })().finally(() => {
        authBackgroundBlobInflight.delete(cacheKey);
      });
      authBackgroundBlobInflight.set(cacheKey, loadPromise);
    }
    loadPromise.then((next) => {
      if (!next || cancelled) return;
      blobRef.current = next;
      setBlobSrc(next);
    });
    return () => {
      cancelled = true;
      if (blobRef.current && !authBackgroundBlobCache.has(resolved)) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
    };
  }, [resolved, requiresAuth, url]);

  if (!resolved) return null;
  return requiresAuth ? blobSrc : resolved;
}

function publicWebsiteMediaUrl(slug: string | null | undefined, url: string): string {
  try {
    if (/^\/api\/website\/public\/[^/]+\/media\//.test(new URL(url, "https://aidowedding.net").pathname)) {
      return url;
    }
  } catch {
    if (/^\/api\/website\/public\/[^/]+\/media\//.test(url)) return url;
  }
  const tail = objectMediaTail(url);
  if (!slug || !tail) return url;
  return `/api/website/public/${encodeURIComponent(slug)}/media/${encodeMediaTail(tail)}`;
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
  images: Array<{ url: string; caption?: string; downloadName?: string }>;
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
      {img.downloadName && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            void downloadMediaFile(img.url, img.downloadName!, { authenticated: false });
          }}
          className="absolute right-16 top-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/25"
          aria-label="Download photo"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Download</span>
        </button>
      )}
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
    // don't hijack the pointer - let the inner element get focus and open
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
          &times;
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
            <label className="text-[11px] font-semibold uppercase tracking-wide">
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
            <label className="text-[11px] font-semibold uppercase tracking-wide">
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
            <span className="text-[11px] font-medium tabular-nums w-8 text-right">
              {size}px
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              ctx.onTextChange(colorKey, "");
              ctx.onTextChange(sizeKey, "");
            }}
            className="mt-2 text-[11px] font-medium underline opacity-90 hover:opacity-100"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2 ml-3 text-[11px] font-medium underline opacity-90 hover:opacity-100"
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
      {units.map(({ key, label, value }) => {
        const displayLabel = data.customText[key] || label;
        return (
          <div key={key} className="flex flex-col items-center">
            <span
              className="text-3xl sm:text-5xl font-bold tabular-nums leading-none"
              style={{ color: accentColor }}
            >
              {String(value).padStart(2, "0")}
            </span>
            <EditableText
              as="span"
              editable={ctx.editable}
              value={displayLabel}
              defaultValue={label}
              readOnlyText
              aiEnabled={false}
              textStyle={data.textStyles?.[key]}
              onStyleChange={
                ctx.onStyleChange ? (s) => ctx.onStyleChange!(key, s) : undefined
              }
              className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest mt-2"
            />
          </div>
        );
      })}
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
  const couple = displayCoupleName(data);

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
    "block w-full rounded-lg px-4 py-3 text-left text-sm font-semibold hover:bg-black/5 transition-colors";

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
            role="dialog"
            aria-label="Choose calendar"
            className="fixed inset-x-4 bottom-4 z-50 rounded-2xl border p-3 shadow-2xl sm:absolute sm:inset-auto sm:left-1/2 sm:top-full sm:mt-2 sm:w-56 sm:-translate-x-1/2 sm:rounded-lg sm:p-2"
            style={{
              background: "#fff",
              color: "#222",
              borderColor: "rgba(0,0,0,0.1)",
            }}
          >
            <div className="px-2 pb-2 text-left text-xs font-semibold uppercase tracking-[0.16em] text-[#8D294D]">
              Choose calendar
            </div>
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

function websiteHotelAddressLines(hotel: NonNullable<WebsiteRendererPayload["hotelOptions"]>[number]) {
  const cityStateZip = [
    [hotel.city, hotel.state].filter(Boolean).join(", "),
    hotel.zip,
  ].filter(Boolean).join(" ");
  return [
    hotel.address,
    cityStateZip,
  ].filter(Boolean);
}

function websiteHotelCutoffDate(value: string | null | undefined) {
  if (!value) return "";
  const [yy, mm, dd] = value.split("-").map(Number);
  const date = yy && mm && dd ? new Date(yy, mm - 1, dd) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function websiteHotelDateRange(checkIn: string | null | undefined, checkOut: string | null | undefined) {
  return [websiteHotelCutoffDate(checkIn), websiteHotelCutoffDate(checkOut)].filter(Boolean).join(" to ");
}

function RsvpSection({
  data,
  ctx,
}: {
  data: WebsiteRendererPayload;
  ctx: EditCtx;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [attending, setAttending] = useState<"yes" | "no" | "maybe">("yes");
  const [plusOne, setPlusOne] = useState(0);
  const [dietary, setDietary] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const labelColor = sectionTextColor(data, "rsvp");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (ctx.editable) return;
    if (!name.trim()) {
      setErr(t("rsvp.error_name_required", { defaultValue: "Please enter your name." }));
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
            hotelNeeded: false,
            bookedHotelBlockId: null,
            bookedHotelRoomCount: null,
          }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? t("rsvp.submission_failed", { defaultValue: "Submission failed" }));
      }
      setDone(true);
    } catch (e) {
      setErr(
        e instanceof Error
          ? e.message
          : t("common.try_again_error", { defaultValue: "Something went wrong. Please try again." }),
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
        editable={false}
        value=""
        defaultValue={t("rsvp.generic_subtitle", { defaultValue: "Please let us know if you can celebrate with us." })}
        onCommit={() => {}}
        className="block text-center text-3xl sm:text-4xl mb-10"
        style={{ fontFamily: fontStack(headingFont(data)), color: labelColor }}
        {...withBaseColor(tsp(ctx, "rsvp_subtitle"), labelColor)}
      />
      {(ctx.editable || data.customText.rsvp_deadline) && (
        <p
          className="text-center text-sm font-medium mb-8"
          style={{ color: labelColor }}
        >
          {t("rsvp.please_rsvp_by", { defaultValue: "Please RSVP by" })}{" "}
          <EditableText
            as="span"
            editable={ctx.editable}
            value={data.customText.rsvp_deadline ?? ""}
            defaultValue={t("rsvp.tap_to_add_date", { defaultValue: "(tap to add a date)" })}
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
              ? t("rsvp.sorry_you_cant", { defaultValue: "We're sorry you can't make it." })
              : t("rsvp.thank_you_celebrate", { defaultValue: "Thank you! We can't wait to celebrate with you!" })}
          </p>
          <EditableText
            as="p"
            editable={false}
            value={t("rsvp.more_details_later", { defaultValue: "We'll send you more details closer to the day." })}
            defaultValue={t("rsvp.more_details_later", { defaultValue: "We'll send you more details closer to the day." })}
            onCommit={() => {}}
            className="text-sm font-medium text-center max-w-sm"
            style={{ color: labelColor }}
          />
        </div>
      ) : (
        <form onSubmit={submit} className="max-w-lg mx-auto space-y-4">
          {ctx.editable && (
            <p className="rounded-md border px-3 py-2 text-center text-xs font-medium" style={{ color: labelColor, borderColor: `${data.colorPalette.primary}33` }}>
              {t("rsvp.editor_preview_only", { defaultValue: "Editor preview only. Guests can use this form on the published site." })}
            </p>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{ color: labelColor }}
              >
                {t("rsvp.name_required", { defaultValue: "Name *" })}
              </label>
              <input
                style={inputStyle}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("rsvp.full_name", { defaultValue: "Your full name" })}
                required
              />
            </div>
            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{ color: labelColor }}
              >
                {t("rsvp.email", { defaultValue: "Email" })}
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
              className="block text-xs font-semibold mb-2"
              style={{ color: labelColor }}
            >
              {t("rsvp.will_you_attend", { defaultValue: "Will you attend?" })}
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
                    ? t("rsvp.joyfully_accepts", { defaultValue: "Joyfully accepts" })
                    : opt === "no"
                      ? t("rsvp.regretfully_declines", { defaultValue: "Regretfully declines" })
                      : t("rsvp.maybe", { defaultValue: "Maybe" })}
                </button>
              ))}
            </div>
          </div>

          {attending !== "no" && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label
                  className="block text-xs font-semibold mb-1.5"
                  style={{ color: labelColor }}
                >
                  {t("rsvp.additional_guests", { defaultValue: "Additional guests" })}
                </label>
                <select
                  style={inputStyle}
                  value={plusOne}
                  onChange={(e) => setPlusOne(Number(e.target.value))}
                >
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n === 0
                        ? t("rsvp.just_me", { defaultValue: "Just me" })
                        : t("rsvp.guest_count_option", { count: n, defaultValue: "+{{count}} guest" })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  className="block text-xs font-semibold mb-1.5"
                  style={{ color: labelColor }}
                >
                  {t("rsvp.dietary_restrictions", { defaultValue: "Dietary restrictions" })}
                </label>
                <input
                  style={inputStyle}
                  value={dietary}
                  onChange={(e) => setDietary(e.target.value)}
                  placeholder="Vegetarian, gluten-free..."
                />
              </div>
            </div>
          )}

          <div>
            <label
              className="block text-xs font-semibold mb-1.5"
              style={{ color: labelColor }}
            >
              {t("rsvp.message_to_couple", { defaultValue: "Message to the couple (optional)" })}
            </label>
            <textarea
              style={{ ...inputStyle, resize: "vertical", minHeight: "80px" }}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("rsvp.message_placeholder_short", { defaultValue: "Share a wish or note..." })}
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
            {submitting ? t("rsvp.sending", { defaultValue: "Sending..." }) : t("rsvp.send_rsvp", { defaultValue: "Send RSVP" })}
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
  const marqueeSpeed = (data.customText._announcementMarqueeSpeed || "medium") as "slow" | "medium" | "fast";
  const marqueeDuration = marqueeSpeed === "slow" ? "22s" : marqueeSpeed === "fast" ? "9s" : "14s";
  const [dismissed, setDismissed] = useState(false);

  // Hide when the user has toggled the announcement off via Home Elements.
  if (isEditableHiddenMarker(data.customText._announcementHidden) || dismissed)
    return null;
  // Public site: hide entirely when empty. Editor: keep the slot visible so
  // the user has somewhere to click and start typing.
  if (!trimmed && !ctx.editable) return null;

  return (
    <div
      className="relative flex items-center justify-center px-5 py-3 pr-12 text-sm sm:pr-5"
      style={{
        background: `${data.colorPalette.primary}18`,
        borderBottom: `2px solid ${data.colorPalette.primary}55`,
      }}
    >
      <div className="w-full min-w-0 overflow-hidden whitespace-nowrap text-center">
        {ctx.editable ? (
          <div
            className={
              marqueeEnabled
                ? "wsa-announcement-marquee motion-reduce:animate-none motion-reduce:whitespace-normal"
                : "flex w-full items-center justify-center whitespace-normal text-center"
            }
            style={{
              color: data.colorPalette.text,
              "--announcement-marquee-duration": marqueeDuration,
            } as React.CSSProperties}
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
                ? "wsa-announcement-marquee motion-reduce:animate-none motion-reduce:whitespace-normal"
                : "w-full whitespace-normal text-center"
            }
            style={{
              "--announcement-marquee-duration": marqueeDuration,
            } as React.CSSProperties}
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
  soft: "contrast(0.96) brightness(1.04) saturate(0.94)",
  cool: "hue-rotate(-12deg) saturate(1.1) brightness(0.97)",
  warm: "hue-rotate(8deg) saturate(1.15) brightness(1.04)",
  dramatic: "contrast(1.25) saturate(1.2) brightness(0.92)",
  noir: "grayscale(1) contrast(1.35) brightness(0.85)",
};

function photoFilterCss(key: string | undefined | null): string {
  return PHOTO_FILTERS[(key || "none") as keyof typeof PHOTO_FILTERS] ?? "none";
}

const DEFAULT_WEBSITE_HERO_IMAGE = "/images/default-wedding-couple.jpg";

function isDefaultWebsiteHeroImage(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return new URL(url).pathname === DEFAULT_WEBSITE_HERO_IMAGE;
  } catch {
    return url === DEFAULT_WEBSITE_HERO_IMAGE;
  }
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
  const resolved = resolveMediaUrl(url);
  const requiresAuth = isMediaAuthRequired(url) || isMediaAuthRequired(resolved);
  const usableUrl = blobUrl && (!requiresAuth || blobUrl !== resolved) ? blobUrl : null;
  return (
    <div
      className={className}
      style={{
        ...style,
        backgroundImage: usableUrl
          ? `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.55)), url('${usableUrl}')`
          : style?.backgroundImage,
      }}
    />
  );
}

function heroImageLookupKeys(url: string): string[] {
  const keys = new Set<string>();
  const add = (value: string | null | undefined) => {
    const clean = value?.trim();
    if (!clean) return;
    keys.add(clean);
    try {
      keys.add(decodeURIComponent(clean));
    } catch {
      // Keep the original value when malformed encoding is present.
    }
  };

  add(url);
  try {
    const parsed = new URL(url, typeof window !== "undefined" ? window.location.origin : "https://aidowedding.net");
    add(parsed.pathname);
    const marker = "/media/";
    const mediaIndex = parsed.pathname.indexOf(marker);
    if (mediaIndex >= 0) {
      const mediaPath = parsed.pathname.slice(mediaIndex + marker.length);
      add(mediaPath);
      add(mediaPath.replace(/^\/+/, ""));
    }
  } catch {
    const [pathOnly] = url.split("?");
    add(pathOnly);
  }

  return Array.from(keys);
}

function lookupHeroImageSetting<T>(
  raw: string | undefined,
  url: string,
  validate: (value: unknown) => T | null,
): T | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const map = parsed as Record<string, unknown>;
    for (const key of heroImageLookupKeys(url)) {
      const value = validate(map[key]);
      if (value !== null) return value;
    }
    return null;
  } catch {
    return null;
  }
}

// Per-URL focal points the user picks via HeroPhotoPositionDialog. Stored
// as a JSON map under customText._heroFocals so a single key covers every
// hero photo. Falls back to "center" when missing or malformed.
function heroFocalFor(data: WebsiteRendererPayload, url: string): string {
  return lookupHeroImageSetting(data.customText._heroFocals, url, (value) =>
    typeof value === "string" && value.trim() ? value : null,
  ) ?? "center";
}

// Per-URL zoom levels (1.0 = native cover, 4.0 = max). Same JSON-map shape
// as _heroFocals. Returns 1 when missing/malformed so non-zoomed photos
// don't get a redundant transform.
function heroZoomFor(data: WebsiteRendererPayload, url: string): number {
  const zoom = lookupHeroImageSetting(data.customText._heroZooms, url, (value) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    return Math.max(1, Math.min(4, value));
  });
  return zoom ?? 1;
}

function HeroBackground({
  data,
  renderDevice,
}: {
  data: WebsiteRendererPayload;
  renderDevice?: WebsiteRenderDevice;
}) {
  const isMobileRender = renderDevice === "mobile";
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
  const heroFitValue = data.customText._heroFit;
  const fit = (heroFitValue === "cover" ? "cover" : "contain") as
    | "cover"
    | "contain";
  // On real/mobile previews, couples expect the hero to fill the phone frame.
  // Keep desktop's "show whole photo" option, but avoid flat letterbox bands
  // on phones by using the same edge-to-edge crop the preview frame implies.
  const effectiveFit = isMobileRender ? "cover" : fit;
  // When letterboxing in contain mode, fall back to the palette background
  // so the bars match the rest of the site instead of showing black.
  const backdrop = effectiveFit === "contain" ? data.colorPalette.background : undefined;

  const sortedHeroImages = (data.heroImages ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((g) => g.url);
  const shouldUseDefaultHero =
    !isDefaultWebsiteHeroImage(data.heroImage) || sortedHeroImages.length === 0;
  const heroAndGallery: string[] = [
    ...(shouldUseDefaultHero && data.heroImage ? [data.heroImage] : []),
    ...sortedHeroImages,
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
            const zoom = effectiveFit === "contain" ? 1 : heroZoomFor(data, url);
            const slide = (
              <AuthBgSlide
                url={url}
                className="h-full w-full"
                style={{
                  backgroundPosition: effectiveFit === "contain" ? "center" : focal,
                  backgroundSize: effectiveFit,
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
                  width: isMobileRender ? "100vw" : "60vw",
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
        const zoom = effectiveFit === "contain" ? 1 : heroZoomFor(data, url);
        const opacity = mode === "slideshow" ? (i === activeIdx ? 1 : 0) : 1;
        const transition =
          mode === "slideshow" ? "opacity 1s ease-in-out" : undefined;
        if (effectiveFit === "contain") {
          return (
            <div
              key={url + i}
              className="absolute inset-0 overflow-hidden"
              style={{ opacity, transition }}
            >
              <AuthBgSlide
                url={url}
                className="absolute inset-0"
                style={{
                  backgroundPosition: focal,
                  backgroundSize: "cover",
                  backgroundRepeat: "no-repeat",
                  filter: `${photoFilter} blur(18px)`,
                  transform: "scale(1.08)",
                  opacity: 0.72,
                }}
              />
              <AuthBgSlide
                url={url}
                className="absolute inset-0"
                style={{
                  backgroundPosition: "center",
                  backgroundSize: "contain",
                  backgroundRepeat: "no-repeat",
                  filter: photoFilter,
                  ...animationStyle,
                }}
              />
            </div>
          );
        }
        const slide = (
          <AuthBgSlide
            url={url}
            className="absolute inset-0"
            style={{
              backgroundPosition: focal,
              backgroundSize: effectiveFit,
              backgroundRepeat: "no-repeat",
              opacity,
              transition,
              filter: photoFilter,
              ...animationStyle,
            }}
          />
        );
        // Static / slideshow can take the user's zoom directly on the slide.
        // Kenburns / pan-lr already use `transform` for their CSS animation -
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
                  backgroundSize: effectiveFit,
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
  const couple = displayCoupleName(data);
  const dateStr = formatWeddingDate(data.couple.weddingDate);
  const isMobileRender = ctx.renderDevice === "mobile";
  return (
    <section
      id="home"
      className={`relative flex items-center justify-center overflow-hidden text-center ${
        isMobileRender
          ? "min-h-[72vh] px-5 py-14"
          : "min-h-[80vh] px-4 py-20 sm:px-6 sm:py-24"
      }`}
      style={{
        color:
          data.heroImage || (data.heroImages?.length ?? 0) > 0
            ? "#fff"
            : data.colorPalette.text,
      }}
    >
      <HeroBackground data={data} renderDevice={ctx.renderDevice} />
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
          value={stackedCoupleName(coupleTextValue(data.customText._coupleName ?? "", data))}
          defaultValue={stackedCoupleName(couple)}
          onCommit={(v) => ctx.onTextChange("_coupleName", v)}
          className="text-4xl sm:text-6xl md:text-8xl mb-6 leading-tight whitespace-pre-line break-words [overflow-wrap:anywhere]"
          style={{
            fontFamily: fontStack(headingFont(data)),
            textAlign: "center",
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

// Custom floating text boxes - rendered at the page level (not inside any
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
            return !!v?.trim() && v.trim() !== "New text - click to edit";
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
              defaultValue="New text - click to edit"
              onCommit={(v) =>
                ctx.onTextChange(key, v || "New text - click to edit")
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
  const isMobileRender = ctx.renderDevice === "mobile";
  // The section is gated by sectionsEnabled.story upstream; if the user
  // enabled it, render it everywhere - editor, preview, and published -
  // so the layout is consistent even before the body has been filled in.
  const labelColor = sectionTextColor(data, "story");
  const storySubtitleProps = withBaseColor(tsp(ctx, "story_subtitle"), labelColor);
  const storyBodyProps = withBaseColor(tsp(ctx, "story"), labelColor);
  if (isMobileRender) {
    storySubtitleProps.textStyle = {
      ...(storySubtitleProps.textStyle ?? {}),
      textAlign: "center",
      width: "100%",
    };
    storyBodyProps.textStyle = {
      ...(storyBodyProps.textStyle ?? {}),
      textAlign: "center",
      width: "100%",
    };
  }
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
        className="block w-full text-center text-3xl sm:text-4xl mb-8"
        style={{
          fontFamily: elementFontStack(
            data,
            "story_subtitle",
            headingFont(data),
            "heading",
          ),
          color: labelColor,
          maxWidth: isMobileRender ? "100%" : undefined,
        }}
        {...storySubtitleProps}
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
        className="block w-full text-center text-base sm:text-lg leading-relaxed max-w-3xl mx-auto px-4 whitespace-pre-line break-words"
        style={{
          color: labelColor,
          fontFamily: bodyFontStack(bodyFont(data)),
          textAlign: "center",
          marginLeft: "auto",
          marginRight: "auto",
          maxWidth: isMobileRender ? "100%" : undefined,
        }}
        {...storyBodyProps}
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
      <EditableText
        as="div"
        multiline
        editable={ctx.editable}
        value={data.customText.schedule_subtitle ?? ""}
        defaultValue="The day of"
        onCommit={(v) => ctx.onTextChange("schedule_subtitle", v)}
        className="mx-auto mb-8 block max-w-2xl whitespace-pre-line text-center text-base font-medium leading-relaxed sm:text-lg"
        style={{
          color: labelColor,
          fontFamily: bodyFontStack(bodyFont(data)),
        }}
        {...withBaseColor(tsp(ctx, "schedule_subtitle"), labelColor)}
      />
      <div className="max-w-2xl mx-auto">
        <div className="mx-auto mb-8 max-w-md space-y-3">
          {visibleItems.map((it, idx) => {
            const hasTime = !!it.time;
            return (
              <div
                key={it.key}
                className="grid grid-cols-[2.25rem_5.5rem_minmax(8rem,1fr)] items-center gap-3 py-3 sm:grid-cols-[2.25rem_6rem_minmax(10rem,1fr)] sm:gap-4"
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
                  wrapperClassName="flex items-center justify-center w-9 h-9 rounded-full"
                  wrapperStyle={{
                    background: `${data.colorPalette.primary}15`,
                  }}
                />
                <div
                  className="w-full text-sm font-medium px-3 py-1.5 rounded-md"
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
                <div className="min-w-0 text-left text-base" style={{ color: labelColor }}>
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
              ? "Add any extra schedule notes - dress code, parking, after-party, etc."
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
  const isMobileRender = ctx.renderDevice === "mobile";
  const venueCityStateZip = [
    [data.couple.venueCity, data.couple.venueState].filter(Boolean).join(", "),
    data.couple.venueZip,
  ].filter(Boolean).join(" ");
  const venueAddressLines = [
    data.couple.location,
    venueCityStateZip,
  ].filter(Boolean);
  const selectedHotelBlockId =
    (data.customText._travelHotelBlockId && data.customText._travelHotelBlockId !== "all"
      ? data.customText._travelHotelBlockId
      : data.customText._rsvpHotelBlockId && data.customText._rsvpHotelBlockId !== "all"
        ? data.customText._rsvpHotelBlockId
        : "")
      .trim();
  const syncedHotel =
    (selectedHotelBlockId
      ? data.hotelOptions?.find((hotel) => String(hotel.id) === selectedHotelBlockId)
      : data.hotelOptions?.[0]) ?? null;
  const syncedHotelAddress = syncedHotel ? websiteHotelAddressLine(syncedHotel) : "";
  const syncedHotelAddressLines = syncedHotel ? websiteHotelAddressLines(syncedHotel) : [];
  const hotelName = (syncedHotel?.hotelName || data.customText._hotelName || "").trim();
  const hotelAddress = (syncedHotelAddress || data.customText._hotelAddress || "").trim();
  const hotelAddressLines = syncedHotelAddressLines.length
    ? syncedHotelAddressLines
    : hotelAddress
      ? [hotelAddress]
      : [];
  const hotelBookingLink = (syncedHotel?.bookingLink || data.customText._hotelBookingLink || "").trim();
  const hotelBookingLabel = (data.customText._hotelBookingLinkLabel || "Book hotel room").trim();
  const hotelPhone = (syncedHotel?.phone || data.customText._hotelPhone || "").trim();
  const hasHotel = !!hotelName;
  if (!text && !data.couple.venue && !hasHotel && !ctx.editable) return null;
  const labelColor = sectionTextColor(data, "travel");

  const safeHotelBookingLink =
    hotelBookingLink && /^https?:\/\//i.test(hotelBookingLink)
      ? hotelBookingLink
      : "";
  const hotelPhoneHref = hotelPhone ? `tel:${hotelPhone.replace(/[^\d+]/g, "")}` : "";

  const venueQuery = encodeURIComponent(
    [
      data.couple.venue,
      data.couple.location,
      venueCityStateZip,
    ]
      .filter(Boolean)
      .join(", "),
  );
  const hotelQuery = encodeURIComponent(
    [hotelName, ...hotelAddressLines].filter(Boolean).join(", "),
  );
  const venueDescription = data.customText._travelVenueDescription ?? "";
  const hotelDescription = data.customText._travelHotelDescription ?? "";
  const venuePhoto = (data.customText._travelVenuePhoto || "").trim();
  const hotelPhoto = (data.customText._travelHotelPhoto || "").trim();
  const shouldUsePublicTravelMedia = !ctx.editable && !ctx.previewMode;
  const venuePhotoSrc = venuePhoto && shouldUsePublicTravelMedia ? publicWebsiteMediaUrl(data.slug, venuePhoto) : venuePhoto;
  const hotelPhotoSrc = hotelPhoto && shouldUsePublicTravelMedia ? publicWebsiteMediaUrl(data.slug, hotelPhoto) : hotelPhoto;

  const cardStyle: React.CSSProperties = {
    border: isMobileRender ? `1px solid ${data.colorPalette.primary}22` : undefined,
    borderRadius: isMobileRender ? 12 : 0,
    padding: isMobileRender ? "16px" : "4px 22px 8px",
    overflowWrap: "break-word",
    textAlign: isMobileRender ? "center" : undefined,
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

      <div
        className={`${isMobileRender ? "grid grid-cols-1 justify-items-center gap-4" : "relative grid sm:grid-cols-2 gap-0"} max-w-3xl mx-auto mb-6`}
      >
        {!isMobileRender && (
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-1 bottom-1 w-px -translate-x-1/2"
            style={{ background: `${data.colorPalette.primary}2E` }}
          />
        )}
        {/* Venue */}
        {data.couple.venue &&
          !isEditableHiddenMarker(data.customText._travelVenueHidden) && (
            <div className={isMobileRender ? "w-full max-w-[18rem]" : undefined} style={cardStyle}>
              {venuePhotoSrc && (
                <div className="mb-4 overflow-hidden rounded-lg" style={{ border: `1px solid ${data.colorPalette.primary}22` }}>
                  <AuthMediaImage
                    src={venuePhotoSrc}
                    alt={`${data.couple.venue} venue`}
                    className="h-36 w-full object-cover sm:h-40"
                    loading="lazy"
                  />
                </div>
              )}
              <div className={isMobileRender ? "flex flex-col items-center gap-3 mb-4" : "flex items-start gap-3 mb-3"}>
                <div style={iconWrap}>
                  <MapPin className="h-4 w-4" />
                </div>
                <div className={isMobileRender ? "w-full text-center" : undefined}>
                  <EditableText
                    as="div"
                    editable={ctx.editable}
                    value={data.customText._travelVenueLabel ?? ""}
                    defaultValue="Venue"
                    onCommit={(v) => ctx.onTextChange("_travelVenueLabel", v)}
                    readOnlyText
                    aiEnabled={false}
                    textStyle={data.textStyles?._travelVenueLabel}
                    onStyleChange={
                      ctx.onStyleChange
                        ? (s) => ctx.onStyleChange!("_travelVenueLabel", s)
                        : undefined
                    }
                    className="text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: labelColor }}
                  />
                  <div
                    className={`${isMobileRender ? "text-lg" : "text-base sm:text-lg"} font-medium`}
                    style={{ color: labelColor }}
                  >
                    {data.couple.venue}
                  </div>
                  {venueAddressLines.map((line) => (
                    <div
                      key={line}
                      className="text-sm font-medium"
                      style={{ color: labelColor }}
                    >
                      {line}
                    </div>
                  ))}
                  <a
                    href={`https://www.google.com/maps/search/${venueQuery}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`mt-1 inline-flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-70 ${isMobileRender ? "justify-center" : ""}`}
                    style={{ color: data.colorPalette.primary }}
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    {data.customText._openInGoogleMaps || "Open in Google Maps"}
                  </a>
                </div>
              </div>
              {(venueDescription.trim() || ctx.editable) && (
                <EditableText
                  as="div"
                  multiline
                  editable={ctx.editable}
                  value={venueDescription}
                  defaultValue={
                    ctx.editable
                      ? "Add venue details, parking notes, entrance instructions, or ceremony arrival info..."
                      : ""
                  }
                  onCommit={(v) => ctx.onTextChange("_travelVenueDescription", v)}
                  className="mb-4 whitespace-pre-line text-sm leading-relaxed"
                  style={{
                    color: labelColor,
                    fontFamily: bodyFontStack(bodyFont(data)),
                  }}
                  {...withBaseColor(tsp(ctx, "_travelVenueDescription"), labelColor)}
                />
              )}
            </div>
          )}

        {/* Hotel */}
        {(hasHotel || ctx.editable) &&
          !isEditableHiddenMarker(data.customText._travelHotelHidden) && (
            <div className={isMobileRender ? "w-full max-w-[18rem]" : undefined} style={cardStyle}>
              {hotelPhotoSrc && (
                <div className="mb-4 overflow-hidden rounded-lg" style={{ border: `1px solid ${data.colorPalette.primary}22` }}>
                  <AuthMediaImage
                    src={hotelPhotoSrc}
                    alt={`${hotelName || "Hotel"} exterior`}
                    className="h-36 w-full object-cover sm:h-40"
                    loading="lazy"
                  />
                </div>
              )}
              <div className={isMobileRender ? "flex flex-col items-center gap-3 mb-4" : "flex items-start gap-3 mb-3"}>
                <div style={iconWrap}>
                  <Bed className="h-4 w-4" />
                </div>
                <div className={`flex-1 min-w-0 ${isMobileRender ? "w-full text-center" : ""}`}>
                  <EditableText
                    as="div"
                    editable={ctx.editable}
                    value={data.customText._travelHotelLabel ?? ""}
                    defaultValue="Hotel"
                    onCommit={(v) => ctx.onTextChange("_travelHotelLabel", v)}
                    readOnlyText
                    aiEnabled={false}
                    textStyle={data.textStyles?._travelHotelLabel}
                    onStyleChange={
                      ctx.onStyleChange
                        ? (s) => ctx.onStyleChange!("_travelHotelLabel", s)
                        : undefined
                    }
                    className="text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: labelColor }}
                  />
                  <div
                    className={`${isMobileRender ? "text-lg" : "text-base sm:text-lg"} font-medium`}
                    style={{ color: labelColor }}
                  >
                    {hotelName || (ctx.editable ? "Hotel name" : "")}
                  </div>
                  {hotelAddressLines.map((line) => (
                    <div
                      key={line}
                      className="text-sm font-medium"
                      style={{ color: labelColor }}
                    >
                      {line}
                    </div>
                  ))}
                  {hotelPhone && (
                    <a
                      href={hotelPhoneHref}
                      className={`mt-1 inline-flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-70 ${isMobileRender ? "justify-center" : ""}`}
                      style={{ color: data.colorPalette.primary }}
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {hotelPhone}
                    </a>
                  )}
                  {hasHotel && (
                    <a
                      href={`https://www.google.com/maps/search/${hotelQuery}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`mt-1 inline-flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-70 ${isMobileRender ? "justify-center" : ""}`}
                      style={{ color: data.colorPalette.primary }}
                    >
                      <Navigation className="h-3.5 w-3.5" />
                      {data.customText._openInGoogleMaps || "Open in Google Maps"}
                    </a>
                  )}
                  {!hotelAddressLines.length && ctx.editable && (
                    <div
                      className="text-sm font-medium"
                      style={{ color: labelColor }}
                    >
                      Address (street, city, state)
                    </div>
                  )}
                </div>
              </div>
              {(hotelDescription.trim() || ctx.editable) && (
                <EditableText
                  as="div"
                  multiline
                  editable={ctx.editable}
                  value={hotelDescription}
                  defaultValue={
                    ctx.editable
                      ? "Add hotel notes, shuttle details, booking instructions, or room block reminders..."
                      : ""
                  }
                  onCommit={(v) => ctx.onTextChange("_travelHotelDescription", v)}
                  className="mb-4 whitespace-pre-line text-sm leading-relaxed"
                  style={{
                    color: labelColor,
                    fontFamily: bodyFontStack(bodyFont(data)),
                  }}
                  {...withBaseColor(tsp(ctx, "_travelHotelDescription"), labelColor)}
                />
              )}
              <div className={isMobileRender ? "flex flex-col items-center gap-2" : "flex flex-wrap items-center gap-x-4 gap-y-2"}>
                {safeHotelBookingLink && (
                  <a
                    href={safeHotelBookingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-85"
                    style={{ background: data.colorPalette.primary }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {hotelBookingLabel}
                  </a>
                )}
              </div>
              {(syncedHotel?.groupName || syncedHotel?.discountCode || syncedHotel?.cutoffDate || syncedHotel?.checkInDate || syncedHotel?.checkOutDate) && (
                <div className="mt-3 space-y-1 rounded-lg px-3 py-2 text-xs" style={{ background: `${data.colorPalette.primary}10`, color: labelColor, textAlign: isMobileRender ? "center" : undefined }}>
                  {(syncedHotel.checkInDate || syncedHotel.checkOutDate) && <p><span className="font-semibold">Block dates:</span> {websiteHotelDateRange(syncedHotel.checkInDate, syncedHotel.checkOutDate)}</p>}
                  {syncedHotel.groupName && <p><span className="font-semibold">Wedding block:</span> {syncedHotel.groupName}</p>}
                  {syncedHotel.discountCode && <p><span className="font-semibold">Group code:</span> <span className="font-mono font-semibold">{syncedHotel.discountCode}</span></p>}
                  {syncedHotel.cutoffDate && <p><span className="font-semibold">Book by:</span> {websiteHotelCutoffDate(syncedHotel.cutoffDate)}</p>}
                </div>
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
              ? "Add parking info, directions, or other travel notes..."
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
  const labelColor = sectionTextColor(data, "faq");

  try {
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
          Add FAQ questions in the sidebar (Pages tab &gt; FAQ Questions).
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
  const guestUploads = data.guestPhotoDrop?.galleryEnabled
    ? (data.guestPhotoDrop.photos ?? [])
      .map((photo) => ({
        id: photo.id,
        url: photo.publicImageUrl || photo.imageUrl,
        caption: photo.caption || photo.note || `Photo from ${photo.guestName}`,
        guestName: photo.guestName,
        downloadName: guestPhotoDownloadName({
          guestName: photo.guestName,
          id: photo.id,
          imageUrl: photo.publicImageUrl || photo.imageUrl,
        }),
      }))
      .filter((photo) => photo.url)
    : [];
  const photoFilter = photoFilterCss(data.customText._photoFilter);
  const animation = data.customText._galleryAnimation ?? "grid";
  const speed = data.customText._galleryAnimationSpeed ?? "medium";
  const slideshowIntervalMs =
    speed === "slow" ? 6000 : speed === "fast" ? 2500 : 4000;
  const marqueeDuration =
    speed === "slow" ? "60s" : speed === "fast" ? "20s" : "40s";
  const puzzleDuration = speed === "slow" ? "2.2s" : speed === "fast" ? "0.75s" : "1.5s";
  const puzzleStaggerMs = speed === "slow" ? 150 : speed === "fast" ? 35 : 80;
  // Grid mode is the "Puzzle" option: photos fade in one by one. Let the
  // editor preview run it too so the selected animation is visible while
  // customizing the Gallery page.
  const entrance: "none" | "fade-in" | "slide-up" | "zoom-in" | "puzzle" =
    animation === "grid" ? "puzzle" : "none";
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [guestLightboxIndex, setGuestLightboxIndex] = useState<number | null>(null);

  // Slideshow auto-advance. Hooks must run unconditionally - bail out inside.
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
    if (entrance === "none") {
      setVisibleItems(new Set());
      return;
    }
    if (entrance === "puzzle") {
      setVisibleItems(new Set());
      const timers = images.map((_, i) =>
        window.setTimeout(() => {
          setVisibleItems((prev) => new Set([...prev, i]));
        }, i * puzzleStaggerMs),
      );
      return () => timers.forEach((timer) => window.clearTimeout(timer));
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
  }, [entrance, images.length, puzzleStaggerMs]);

  // Grid-level observer for puzzle mode: fires once when the grid enters view,
  // then CSS handles the sequential snap-in via animation-delay per item.
  const [puzzleReady, setPuzzleReady] = useState(false);
  const gridRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (entrance !== "puzzle") {
      setPuzzleReady(false);
      return;
    }
    if (ctx.editable || ctx.previewMode) {
      setPuzzleReady(false);
      const frame = requestAnimationFrame(() => setPuzzleReady(true));
      return () => cancelAnimationFrame(frame);
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
  }, [ctx.editable, ctx.previewMode, entrance, images.length, speed]);

  if (images.length === 0 && guestUploads.length === 0 && !ctx.editable) return null;

  const renderHoverIcon = () => (
    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
      <ImageIcon className="h-6 w-6 text-white opacity-0 group-hover:opacity-80 transition-opacity" />
    </div>
  );
  const downloadGuestUpload = (photo: (typeof guestUploads)[number]) => {
    void downloadMediaFile(photo.url, photo.downloadName, { authenticated: false });
  };
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
        defaultValue={ctx.editable ? "Add a caption..." : ""}
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
      {guestLightboxIndex !== null && guestUploads.length > 0 && (
        <Lightbox
          images={guestUploads}
          startIndex={guestLightboxIndex}
          onClose={() => setGuestLightboxIndex(null)}
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
          style={
            entrance === "puzzle"
              ? { ["--puzzle-duration" as string]: puzzleDuration }
              : undefined
          }
        >
          {images.map((img, i) => (
            <div
              key={`${img.url}-${img.order}`}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              className={`wsg-item flex flex-col gap-1.5${visibleItems.has(i) ? " wsg-visible" : ""}`}
              style={
                entrance !== "none"
                  ? {
                      ["--stagger" as string]: `${i * puzzleStaggerMs}ms`,
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
      {guestUploads.length > 0 && (
        <section
          aria-labelledby="guest-uploads-heading"
          className="mt-14 rounded-[2rem] border bg-white/70 p-4 shadow-[0_18px_55px_rgba(91,15,42,0.10)] sm:p-6"
          style={{ borderColor: `${data.colorPalette.primary}22` }}
        >
          <div className="mb-6 flex flex-col gap-2 text-center sm:text-left">
            <p
              className="text-xs font-bold uppercase tracking-[0.22em]"
              style={{ color: data.colorPalette.accent }}
            >
              Shared by guests
            </p>
            <h3
              id="guest-uploads-heading"
              className="text-3xl sm:text-4xl"
              style={{ fontFamily: fontStack(headingFont(data)), color: data.colorPalette.primary }}
            >
              Guest Uploads
            </h3>
            <p
              className="max-w-2xl text-sm leading-6"
              style={{ color: labelColor, fontFamily: bodyFontStack(bodyFont(data)) }}
            >
              Candid moments collected through the couple's wedding day QR code.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {guestUploads.map((photo, index) => (
              <div
                key={photo.id}
                className="group relative aspect-square overflow-hidden rounded-2xl border bg-white shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  borderColor: `${data.colorPalette.primary}22`,
                  ["--tw-ring-color" as string]: data.colorPalette.primary,
                }}
              >
                <button
                  type="button"
                  onClick={() => setGuestLightboxIndex(index)}
                  className="absolute inset-0 text-left focus:outline-none"
                  aria-label={photo.caption}
                >
                  <AuthMediaImage
                    src={photo.url}
                    alt={photo.caption}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-10 text-left text-white">
                    <span className="block text-xs font-semibold leading-4">{photo.caption}</span>
                    {photo.caption !== `Photo from ${photo.guestName}` && (
                      <span className="block text-[10px] leading-4 opacity-80">From {photo.guestName}</span>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    downloadGuestUpload(photo);
                  }}
                  className="absolute right-2 top-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/92 text-[#5B0F2A] shadow-md transition hover:scale-105 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{ ["--tw-ring-color" as string]: data.colorPalette.primary }}
                  aria-label={`Download ${photo.caption}`}
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </SectionShell>
  );
}

type GuestPhotoUsage = {
  limit: number;
  uploadedCount: number;
  remaining: number;
  maxPerUpload: number;
};

function GuestPhotoDropSection({
  data,
  slug,
  password,
}: {
  data: WebsiteRendererPayload;
  slug?: string;
  password?: string | null;
}) {
  const drop = data.guestPhotoDrop;
  const labelColor = sectionTextColor(data, "gallery");
  const photos = drop?.photos ?? [];
  const [guestName, setGuestName] = useState("");
  const [caption, setCaption] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [deviceId, setDeviceId] = useState("");
  const [usage, setUsage] = useState<GuestPhotoUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const maxUploads = drop?.maxUploads ?? 5;
  const limitMb = drop?.uploadLimitMb ?? 5;
  const totalPhotoLimit = usage?.limit ?? 5;
  const photosLeft = usage?.remaining ?? totalPhotoLimit;
  const maxSelectable = Math.max(0, Math.min(maxUploads, photosLeft));
  const photosLeftAfterSelection = Math.max(0, photosLeft - files.length);
  const weddingGalleryUrl = slug ? publishedWebsiteUrl(slug, "gallery") : "";

  useEffect(() => {
    if (!slug) return;
    setDeviceId(getGuestPhotoDeviceId(slug));
  }, [slug]);

  useEffect(() => {
    if (!slug || !deviceId || !drop?.enabled) return;
    let cancelled = false;
    setUsageLoading(true);
    apiFetch(`/api/website/public/${encodeURIComponent(slug)}/photo-drop/usage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(password ? { "X-Site-Password": password } : {}),
      },
      body: JSON.stringify({ deviceId }),
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error((body as { error?: string })?.error || "Could not check upload limit.");
        if (!cancelled) setUsage(body as GuestPhotoUsage);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not check upload limit.");
      })
      .finally(() => {
        if (!cancelled) setUsageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, deviceId, drop?.enabled, password]);

  if (!drop?.enabled) return null;

  const submitPhotos = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!slug) {
      setError("Photo sharing is available from the published wedding website.");
      return;
    }
    if (!guestName.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (files.length === 0) {
      setError("Please choose at least one photo.");
      return;
    }
    if (files.length > maxUploads) {
      setError(`Please choose no more than ${maxUploads} photos.`);
      return;
    }
    if (photosLeft <= 0) {
      setError(`This phone has already uploaded ${totalPhotoLimit} photos for this wedding.`);
      return;
    }
    if (files.length > photosLeft) {
      setError(`This phone only has ${photosLeft} photo${photosLeft === 1 ? "" : "s"} left to upload.`);
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);
    const form = new FormData();
    form.append("guestName", guestName.trim());
    if (caption.trim()) form.append("caption", caption.trim());
    if (deviceId) form.append("deviceId", deviceId);
    files.forEach((file) => form.append("photos", file));
    try {
      const response = await apiFetch(`/api/website/public/${encodeURIComponent(slug)}/photo-drop`, {
        method: "POST",
        headers: password ? { "X-Site-Password": password } : undefined,
        body: form,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((body as { error?: string })?.error || "Upload failed.");
      setMessage((body as { message?: string })?.message || "Thanks! Your photos were uploaded.");
      if ((body as { usage?: GuestPhotoUsage }).usage) setUsage((body as { usage: GuestPhotoUsage }).usage);
      setFiles([]);
      setCaption("");
      const input = document.getElementById("guest-photo-upload") as HTMLInputElement | null;
      if (input) input.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const downloadSharedMoment = (photo: (typeof photos)[number]) => {
    const imageUrl = photo.publicImageUrl || photo.imageUrl;
    void downloadMediaFile(
      imageUrl,
      guestPhotoDownloadName({
        guestName: photo.guestName,
        id: photo.id,
        imageUrl,
      }),
      { authenticated: false },
    );
  };

  return (
    <SectionShell
      id="photoDrop"
      titleKey="guest_photos_title"
      defaultTitle="Guest Photos"
      icon={<Camera className="h-4 w-4" />}
      data={data}
      ctx={NOOP_CTX}
    >
      {lightboxIndex !== null && photos.length > 0 && (
        <Lightbox
          images={photos.map((photo) => ({
            url: photo.publicImageUrl || photo.imageUrl,
            caption: photo.caption || photo.note || `Photo from ${photo.guestName}`,
            downloadName: guestPhotoDownloadName({
              guestName: photo.guestName,
              id: photo.id,
              imageUrl: photo.publicImageUrl || photo.imageUrl,
            }),
          }))}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
      <div className="mx-auto max-w-2xl text-center">
        <h2
          className="text-4xl sm:text-5xl leading-tight"
          style={{ fontFamily: fontStack(headingFont(data)), color: data.colorPalette.primary }}
        >
          {drop.title}
        </h2>
        <p
          className="mt-4 text-base leading-7"
          style={{ color: labelColor, fontFamily: bodyFontStack(bodyFont(data)) }}
        >
          {drop.instructions}
        </p>
      </div>

      <form
        onSubmit={submitPhotos}
        className="mx-auto mt-10 grid max-w-2xl gap-4 rounded-3xl border bg-white/80 p-5 shadow-[0_22px_60px_rgba(91,15,42,0.12)] sm:p-7"
        style={{ borderColor: `${data.colorPalette.primary}26` }}
      >
        <div className="grid gap-3">
          <label className="grid gap-1.5 text-sm font-semibold" style={{ color: data.colorPalette.text }}>
            Your name
            <input
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
              maxLength={120}
              className="h-12 rounded-2xl border bg-white px-4 text-base outline-none focus:ring-2"
              style={{ borderColor: `${data.colorPalette.primary}30`, ["--tw-ring-color" as string]: data.colorPalette.secondary }}
              placeholder="Jane Smith"
            />
          </label>
        </div>
        <label className="grid gap-1.5 text-sm font-semibold" style={{ color: data.colorPalette.text }}>
          Add a caption
          <textarea
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            maxLength={500}
            rows={3}
            className="rounded-2xl border bg-white px-4 py-3 text-base outline-none focus:ring-2"
            style={{ borderColor: `${data.colorPalette.primary}30`, ["--tw-ring-color" as string]: data.colorPalette.secondary }}
            placeholder="A tiny caption or memory from the day"
          />
        </label>
        <label
          htmlFor="guest-photo-upload"
          className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed bg-white/70 px-4 py-8 text-center transition hover:bg-white"
          style={{ borderColor: `${data.colorPalette.primary}35`, color: labelColor }}
        >
          <UploadCloud className="mb-3 h-9 w-9" style={{ color: data.colorPalette.primary }} />
          <span className="text-sm font-bold" style={{ color: data.colorPalette.text }}>
            {photosLeft <= 0 ? "Upload limit reached" : `Choose up to ${maxSelectable} photos`}
          </span>
          <span className="mt-1 text-xs">
            {usageLoading
              ? "Checking your upload limit..."
              : `${photosLeft} of ${totalPhotoLimit} photo${totalPhotoLimit === 1 ? "" : "s"} left on this phone. ${limitMb} MB max each.`}
          </span>
          <input
            id="guest-photo-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple
            disabled={usageLoading || photosLeft <= 0}
            className="sr-only"
            onChange={(event) => {
              const incoming = Array.from(event.target.files ?? []);
              const next = incoming.slice(0, maxSelectable);
              if (incoming.length > maxSelectable) {
                setError(`This phone has room for ${maxSelectable} photo${maxSelectable === 1 ? "" : "s"} right now.`);
              } else {
                setError(null);
              }
              setFiles(next);
            }}
          />
        </label>
        {files.length > 0 && (
          <div className="space-y-1 rounded-2xl bg-[#FFF7F2] px-4 py-3 text-sm" style={{ color: data.colorPalette.text }}>
            <p>{files.map((file) => file.name).join(", ")}</p>
            <p className="text-xs font-semibold" style={{ color: data.colorPalette.primary }}>
              After this upload: {photosLeftAfterSelection} photo{photosLeftAfterSelection === 1 ? "" : "s"} left.
            </p>
          </div>
        )}
        {error && (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {message && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <p className="font-bold">{message}</p>
            <p className="mt-1 leading-6">
              {drop.approvalRequired
                ? "Once the couple approves your photos, they will appear in the Gallery section on this wedding website."
                : "Your approved photos will appear in the Gallery section on this wedding website."}
            </p>
            {photosLeft <= 0 && weddingGalleryUrl && (
              <a
                href={weddingGalleryUrl}
                className="mt-3 inline-flex min-h-10 items-center justify-center rounded-full px-4 text-sm font-bold text-white"
                style={{ background: data.colorPalette.primary }}
              >
                View the wedding gallery
              </a>
            )}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting || usageLoading || photosLeft <= 0}
          className="inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: data.colorPalette.primary }}
        >
          {photosLeft <= 0 ? "Upload Limit Reached" : submitting ? "Uploading..." : "Upload Photos"}
        </button>
      </form>

      {drop.galleryEnabled && photos.length > 0 && (
        <div className="mt-14">
          <h3
            className="mb-6 text-center text-3xl"
            style={{ fontFamily: fontStack(headingFont(data)), color: data.colorPalette.primary }}
          >
            Shared Moments
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {photos.map((photo, index) => (
              <div
                key={photo.id}
                className="group relative aspect-square overflow-hidden rounded-2xl border bg-white shadow-sm"
                style={{ borderColor: `${data.colorPalette.primary}22` }}
              >
                <button
                  type="button"
                  onClick={() => setLightboxIndex(index)}
                  className="absolute inset-0 text-left focus:outline-none"
                  aria-label={photo.caption || photo.note || `Photo from ${photo.guestName}`}
                >
                  <AuthMediaImage
                    src={photo.publicImageUrl || photo.imageUrl}
                    alt={photo.caption || photo.note || `Photo from ${photo.guestName}`}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-10 text-left text-white">
                    <span className="block text-xs font-semibold leading-4">
                      {photo.caption || photo.note || `Photo from ${photo.guestName}`}
                    </span>
                    {(photo.caption || photo.note) && (
                      <span className="block text-[10px] leading-4 opacity-80">From {photo.guestName}</span>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    downloadSharedMoment(photo);
                  }}
                  className="absolute right-2 top-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/92 text-[#5B0F2A] shadow-md transition hover:scale-105 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{ ["--tw-ring-color" as string]: data.colorPalette.primary }}
                  aria-label={`Download ${photo.caption || photo.note || `photo from ${photo.guestName}`}`}
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
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
  // Photo focal point as percentages 0-100. Defaults to 50/50 (centered).
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
  compact = false,
}: {
  data: WebsiteRendererPayload;
  member: WeddingPartyMember;
  labelColor: string;
  compact?: boolean;
}) {
  return (
    <div className={`flex min-w-0 flex-col items-center text-center ${compact ? "px-1" : "px-3"}`}>
      <div
        className={`${compact ? "h-24 w-24" : "h-32 w-32 sm:h-36 sm:w-36"} mb-4 flex items-center justify-center overflow-hidden rounded-full`}
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
        className={`${compact ? "text-lg" : "text-xl sm:text-2xl"} mb-1 w-full leading-tight`}
        style={{
          fontFamily: fontStack(headingFont(data)),
          color: data.colorPalette.primary,
          maxWidth: compact ? "9.5rem" : "14rem",
          overflowWrap: "normal",
          wordBreak: "normal",
          hyphens: "manual",
          textWrap: "balance",
        }}
      >
        {member.name || "Name"}
      </div>
      <div
        className={`${compact ? "text-xs" : "text-sm"} opacity-80`}
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

  const isMobileRender = ctx.renderDevice === "mobile";
  const labelColor = sectionTextColor(data, "weddingParty");
  const portalParty = data.portalParty ?? [];
  const usesPortalParty = portalParty.length > 0;
  const rawMembers: WeddingPartyMember[] =
    usesPortalParty
      ? portalParty.map((m) => ({
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
        className="mx-auto mb-10 block max-w-2xl text-center text-base font-medium sm:mb-12 sm:text-lg"
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
          className="text-center text-sm font-medium"
          style={{ color: labelColor }}
        >
          No wedding party members yet - add some from the sidebar.
        </p>
      ) : (
        <div className="space-y-16">
          {(groomSide.length > 0 || brideSide.length > 0) && (
            <div className={isMobileRender
              ? "relative mx-auto grid max-w-sm grid-cols-1 gap-16"
              : "relative mx-auto grid max-w-5xl grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-0"}
            >
              {/* Bride's side */}
              <div
                className={isMobileRender ? "" : "lg:border-r lg:pr-12"}
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
                    className="text-center text-xs font-medium"
                    style={{ color: labelColor }}
                  >
                    {ctx.editable
                      ? "Add members from the sidebar with side set to Bride"
                      : ""}
                  </p>
                ) : (
                  <div
                    className={isMobileRender
                      ? "mx-auto grid w-full max-w-[22rem] grid-cols-2 gap-x-4 gap-y-12"
                      : `grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 ${oddLastGridClass}`}
                  >
                    {brideSide.map((m, i) => (
                      <PartyMemberCard
                        key={`b-${i}`}
                        data={data}
                        member={m}
                        labelColor={labelColor}
                        compact={isMobileRender}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Groom's side */}
              <div className={isMobileRender ? "" : "lg:pl-12"}>
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
                    className="text-center text-xs font-medium"
                    style={{ color: labelColor }}
                  >
                    {ctx.editable
                      ? "Add members from the sidebar with side set to Groom"
                      : ""}
                  </p>
                ) : (
                  <div
                    className={isMobileRender
                      ? "mx-auto grid w-full max-w-[22rem] grid-cols-2 gap-x-4 gap-y-12"
                      : `grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 ${oddLastGridClass}`}
                  >
                    {groomSide.map((m, i) => (
                      <PartyMemberCard
                        key={`g-${i}`}
                        data={data}
                        member={m}
                        labelColor={labelColor}
                        compact={isMobileRender}
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
              <div className={isMobileRender
                ? "mx-auto grid w-full max-w-[22rem] grid-cols-2 gap-x-4 gap-y-12"
                : "grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 md:grid-cols-3"}
              >
                {familySide.map((m, i) => (
                  <PartyMemberCard
                    key={`f-${i}`}
                    data={data}
                    member={m}
                    labelColor={labelColor}
                    compact={isMobileRender}
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
  const footerCouple = defaultFooterCoupleName(data);
  const dateStr = formatWeddingDateWithoutWeekday(data.couple.weddingDate);
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
          value={footerCoupleValue(data.customText._footerCoupleName ?? "", data)}
          defaultValue={footerCouple}
          onCommit={(v) => ctx.onTextChange("_footerCoupleName", v)}
          className="text-2xl mb-2 whitespace-pre-line leading-tight"
          style={{ fontFamily: fontStack(headingFont(data)), color: "#fff", textAlign: "center" }}
          {...tsp(ctx, "_footerCoupleName")}
        />
        <EditableText
          as="div"
          editable={ctx.editable}
          value={data.customText._footerText ?? ""}
          defaultValue={dateStr}
          onCommit={(v) => ctx.onTextChange("_footerText", v)}
          className="text-sm font-medium whitespace-pre-line"
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
    <div className="py-8 px-5 text-center bg-[#5B0F2A] text-[#F7E7D6]/85 space-y-5 sm:px-6">
      <a
        href="https://aidowedding.net?utm_source=wedding_website&utm_medium=footer"
        target="_blank"
        rel="noopener"
        className="mx-auto flex max-w-[18rem] flex-col items-center justify-center gap-1.5 text-sm hover:text-white transition-colors group sm:max-w-none sm:flex-row sm:gap-2.5"
      >
        <span className="text-xs font-medium uppercase tracking-[0.18em] sm:normal-case sm:tracking-normal">Built with</span>
        <span className="inline-flex items-center justify-center gap-2.5">
          <img src="/logo.png" alt="A.IDO" className="h-10 w-auto object-contain" />
          <span
            className="font-semibold tracking-wide text-base"
            style={{ color: "#F3C6D3" }}
          >
            A.IDO
          </span>
        </span>
        <span className="max-w-[13rem] text-xs font-medium leading-snug opacity-90 transition-opacity group-hover:opacity-100 sm:max-w-none sm:text-sm">
          Plan your wedding too &rarr;
        </span>
      </a>
      <nav className="mx-auto grid max-w-xs grid-cols-2 gap-x-3 gap-y-2 text-xs sm:flex sm:max-w-none sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-4 sm:gap-y-1">
        <a
          href="https://aidowedding.net/privacy"
          target="_blank"
          rel="noopener"
          className="hover:text-white transition-colors"
        >
          Privacy
        </a>
        <span className="hidden opacity-40 sm:inline">&middot;</span>
        <a
          href="https://aidowedding.net/terms"
          target="_blank"
          rel="noopener"
          className="hover:text-white transition-colors"
        >
          Terms &amp; Conditions
        </a>
        <span className="hidden opacity-40 sm:inline">&middot;</span>
        <a
          href="https://aidowedding.net/security"
          target="_blank"
          rel="noopener"
          className="hover:text-white transition-colors"
        >
          Security
        </a>
        <span className="hidden opacity-40 sm:inline">&middot;</span>
        <a
          href="https://aidowedding.net/data-handling"
          target="_blank"
          rel="noopener"
          className="hover:text-white transition-colors"
        >
          Data Handling
        </a>
        <span className="hidden opacity-40 sm:inline">&middot;</span>
        <a
          href="https://aidowedding.net/for-vendors/apply"
          target="_blank"
          rel="noopener"
          className="hover:text-white transition-colors"
        >
          Vendors
        </a>
      </nav>
      <p className="mx-auto max-w-[18rem] text-[10.5px] leading-relaxed opacity-85 sm:max-w-2xl sm:text-[11px]">
        &copy; {year} A.IDO. All rights reserved. A.IDO is the platform that hosts
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
  renderDevice,
}: {
  data: WebsiteRendererPayload;
  scrollContainer?: HTMLElement | null;
  pageMode: boolean;
  slug?: string;
  currentSection: string;
  renderDevice?: WebsiteRenderDevice;
  // When provided, nav buttons call this instead of scrolling or routing.
  // Used by the editor's Guest Preview to drive page-per-section navigation
  // through React state without changing the actual URL.
  onSectionChange?: (id: string) => void;
}) {
  const [scrollActive, setScrollActive] = useState<string>("home");
  const isMobileRender = renderDevice === "mobile";
  const navLabel = (key: string, fallback: string) => {
    const value = data.customText?.[key];
    return typeof value === "string" ? value.trim() || fallback : fallback;
  };

  // Build the ordered list of nav items only for sections that are enabled.
  const items: Array<{ id: string; label: string }> = [
    { id: "home", label: navLabel("_navHome", "Home") },
  ];
  if (data.sectionsEnabled.story)
    items.push({ id: "story", label: navLabel("_navStory", "Our Story") });
  if (data.sectionsEnabled.schedule)
    items.push({ id: "schedule", label: navLabel("_navSchedule", "Schedule") });
  if (data.sectionsEnabled.travel)
    items.push({ id: "travel", label: navLabel("_navTravel", "Travel") });
  if (data.sectionsEnabled.registry)
    items.push({ id: "registry", label: navLabel("_navRegistry", "Registry") });
  if (data.sectionsEnabled.weddingParty)
    items.push({ id: "weddingParty", label: navLabel("_navWeddingParty", "Wedding Party") });
  if (data.sectionsEnabled.gallery)
    items.push({ id: "gallery", label: navLabel("_navGallery", "Gallery") });
  if (data.sectionsEnabled.faq) items.push({ id: "faq", label: navLabel("_navFaq", "FAQ") });
  if (data.sectionsEnabled.rsvp !== false)
    items.push({ id: "rsvp", label: navLabel("_navRsvp", "RSVP") });

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
    const className = `relative inline-flex min-h-9 items-center px-1 pb-1 pt-2 font-semibold transition-colors hover:opacity-100 ${active === it.id ? "" : "opacity-90"}`;
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
      const href = seg ? `/${slug}/${seg}` : `/${slug}`;
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

  const homeHref = slug && !onSectionChange ? `/${slug}` : undefined;
  // Show the Share button only on the real public site (not editor preview / live preview)
  const showShare = !!slug && !onSectionChange;
  const headerParts = coupleHeaderParts(data);
  const titleClassName = `${
    isMobileRender ? "text-xl" : "text-2xl sm:text-3xl"
  } max-w-full leading-tight text-center transition-colors hover:opacity-80`;
  const titleStyle: React.CSSProperties = {
    fontFamily: fontStack(headingFont(data)),
    color: data.customText._navCoupleColor || data.colorPalette.primary,
  };
  const titleContent = (
    <span className="block max-w-full text-center">
      <span className="block max-w-full truncate">{headerParts.firstLine}</span>
      {headerParts.lastLine && (
        <span className="block max-w-full truncate">{headerParts.lastLine}</span>
      )}
    </span>
  );

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
      <div className={`mx-auto flex max-w-5xl flex-col items-center gap-2 px-4 ${isMobileRender ? "py-2" : "py-3 sm:py-4"}`}>
        {homeHref ? (
          <Link
            href={homeHref}
            className={titleClassName}
            style={titleStyle}
          >
            {titleContent}
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
            className={titleClassName}
            style={titleStyle}
          >
            {titleContent}
          </button>
        )}
        <div
          className={isMobileRender
            ? "flex w-full max-w-full items-center justify-start gap-x-5 overflow-x-auto whitespace-nowrap px-1 pb-1 text-xs [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            : "flex w-full max-w-full items-center justify-start gap-x-5 overflow-x-auto whitespace-nowrap px-1 pb-1 text-xs [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:justify-center sm:gap-x-7 sm:gap-y-1 sm:overflow-visible sm:whitespace-normal sm:px-0 sm:text-sm [&::-webkit-scrollbar]:hidden"}
        >
          {items.map(renderItem)}
        </div>
      </div>
    </nav>
  );
}

export function WebsiteRenderer({
  data: rawData,
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
  renderDevice,
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
  // through this callback instead of routing or scrolling - used by the
  // editor's Guest Preview to render one section at a time without changing
  // the URL.
  onSectionChange?: (id: string) => void;
  slug?: string;
  password?: string | null;
  // Force scroll-based nav even when slug is provided (used by editor guest preview)
  previewMode?: boolean;
  renderDevice?: WebsiteRenderDevice;
}) {
  const [detectedDevice, setDetectedDevice] = useState<WebsiteRenderDevice>(() => detectWebsiteRenderDevice());
  useEffect(() => {
    if (renderDevice || typeof window === "undefined") return;
    const mediaQueries = [
      window.matchMedia("(max-width: 900px)"),
      window.matchMedia("(pointer: coarse)"),
    ];
    const updateDevice = () => setDetectedDevice(detectWebsiteRenderDevice());
    updateDevice();
    window.addEventListener("resize", updateDevice);
    window.addEventListener("orientationchange", updateDevice);
    window.visualViewport?.addEventListener("resize", updateDevice);
    mediaQueries.forEach((media) => media.addEventListener?.("change", updateDevice));
    return () => {
      window.removeEventListener("resize", updateDevice);
      window.removeEventListener("orientationchange", updateDevice);
      window.visualViewport?.removeEventListener("resize", updateDevice);
      mediaQueries.forEach((media) => media.removeEventListener?.("change", updateDevice));
    };
  }, [renderDevice]);

  const activeRenderDevice = renderDevice ?? detectedDevice;
  const data = applyWebsiteDeviceOverrides(rawData, activeRenderDevice);
  const ctx: EditCtx =
    editable && onTextChange
      ? {
          editable: true,
          renderDevice: activeRenderDevice,
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
          renderDevice: activeRenderDevice,
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
  const customElementFonts = useMemo(() => {
    const fonts = new Set<string>();
    Object.entries(data.customText).forEach(([key, value]) => {
      if (key.endsWith("_font") && typeof value === "string" && value.trim()) {
        fonts.add(value.trim());
      }
    });
    Object.values(data.textStyles ?? {}).forEach((style) => {
      const fontFamily = style?.fontFamily?.trim();
      if (fontFamily) fonts.add(fontFamily);
    });
    return Array.from(fonts);
  }, [data.customText, data.textStyles]);
  const customElementFontKey = customElementFonts.join("\n");
  useEffect(() => {
    const families = Array.from(
      new Set(
        [headingFontName, bodyFontName, faqQuestionFont, faqAnswerFont, ...customElementFonts].filter(
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
  }, [headingFontName, bodyFontName, faqQuestionFont, faqAnswerFont, customElementFontKey]);

  const pageMode = !!currentSection;
  const showAll = !pageMode;
  const show = (id: string, enabled: boolean) =>
    enabled && (showAll || currentSection === id);
  // In previewMode, force scroll-based nav so TopNav buttons don't navigate away
  const navSlug = previewMode ? undefined : slug;
  const handlePreviewNavigation = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!previewMode || !onSectionChange) return;
    const target = event.target instanceof Element ? event.target : null;
    const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
    if (!anchor) return;

    const rawHref = anchor.getAttribute("href") ?? "";
    if (!rawHref) return;

    let nextSection: string | null = null;
    if (rawHref.startsWith("#")) {
      nextSection = rawHref.slice(1) || "home";
    } else {
      let url: URL;
      try {
        url = new URL(rawHref, window.location.origin);
      } catch {
        return;
      }
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "w") {
        nextSection = sectionFromUrlSegment(parts[2] ?? "");
      }
    }

    if (!nextSection) return;
    event.preventDefault();
    event.stopPropagation();
    onSectionChange(nextSection);
    scrollContainer?.scrollTo({ top: 0, behavior: "auto" });
  };

  return (
    <div
      onClickCapture={handlePreviewNavigation}
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
        renderDevice={activeRenderDevice}
      />
      {showAll ? (
        <Hero data={data} ctx={ctx} />
      ) : previewMode ? (
        <div
          style={
            currentSection === "home"
              ? undefined
              : {
                  position: "absolute",
                  width: 1,
                  height: 1,
                  overflow: "hidden",
                  opacity: 0,
                  pointerEvents: "none",
                }
          }
        >
          <Hero data={data} ctx={ctx} />
        </div>
      ) : (
        currentSection === "home" && <Hero data={data} ctx={ctx} />
      )}
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
      {show("photoDrop", data.guestPhotoDrop?.enabled === true) && (
        <GuestPhotoDropSection
          data={data}
          slug={slug}
          password={password}
        />
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
