import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Heart, MapPin, Download, Hotel } from "lucide-react";
import type { ColorPalette } from "@/types/invitations";
import { AuthMediaImage } from "@/components/AuthMediaImage";
import { resolveMediaUrl } from "@/lib/mediaUrl";

export interface WeddingInfo {
  partner1Name?: string | null;
  partner2Name?: string | null;
  weddingDate?: string | null;
  venue?: string | null;
  venueAddress?: string | null;
  venueCity?: string | null;
  venueState?: string | null;
  venueZip?: string | null;
  ceremonyTime?: string | null;
  receptionTime?: string | null;
  saveTheDateMessage?: string | null;
  invitationMessage?: string | null;
  websiteUrl?: string | null;
  websiteLinkPendingMessage?: string | null;
  guestName?: string | null;
  // Couple-set RSVP deadline as YYYY-MM-DD; rendered as "RSVP By: <date>" on
  // the digital invitation preview (and matching email + public RSVP page).
  rsvpByDate?: string | null;
}

export interface PhotoPosition { x: number; y: number }

export interface SaveTheDateHotelInfo {
  id: number;
  hotelName: string;
  bookingLink?: string | null;
  discountCode?: string | null;
  groupName?: string | null;
  cutoffDate?: string | null;
  checkInDate?: string | null;
  checkOutDate?: string | null;
  pricePerNight?: number | null;
  distanceFromVenue?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

export const MIN_PHOTO_ZOOM = 0.5;
export const MAX_PHOTO_ZOOM = 2.5;
export const DEFAULT_PHOTO_ZOOM = 1;
export const DEFAULT_PHOTO_POSITION: PhotoPosition = { x: 50, y: 58 };

export type PhotoEffect = "none" | "bw" | "sepia" | "vintage" | "soft" | "warm" | "dramatic" | "noir";

export const PHOTO_EFFECT_OPTIONS: Array<{ id: PhotoEffect; label: string }> = [
  { id: "none", label: "Original" },
  { id: "bw", label: "Black & white" },
  { id: "sepia", label: "Sepia" },
  { id: "vintage", label: "Vintage" },
  { id: "soft", label: "Soft" },
  { id: "warm", label: "Warm" },
  { id: "dramatic", label: "Dramatic" },
  { id: "noir", label: "Noir" },
];

const PHOTO_EFFECT_FILTERS: Record<PhotoEffect, string> = {
  none: "none",
  bw: "grayscale(1) contrast(1.05)",
  sepia: "sepia(0.7) saturate(1.1)",
  vintage: "sepia(0.35) contrast(0.95) saturate(0.85) brightness(0.95)",
  soft: "contrast(0.96) brightness(1.04) saturate(0.94)",
  warm: "hue-rotate(8deg) saturate(1.15) brightness(1.04)",
  dramatic: "contrast(1.25) saturate(1.2) brightness(0.92)",
  noir: "grayscale(1) contrast(1.35) brightness(0.85)",
};

export function photoEffectToFilter(effect?: string | null): string {
  return PHOTO_EFFECT_FILTERS[(effect || "none") as PhotoEffect] ?? "none";
}

// ── A.IDO brand palette — matches the RSVP Page preview exactly ───────────────
const BG       = "#FFF7F2";
const GOLD     = "#8D294D";
const WHITE    = "#3B1C2B";
const MUTED    = "#6F3E54";
const CARD_BDR = "rgba(230,166,183,0.55)";
const DOT_PAT  = `radial-gradient(${GOLD}22 1px, transparent 1px)`;

const cormorant = "'Cormorant Garamond', 'Playfair Display', Georgia, serif";
const jakarta   = "'Plus Jakarta Sans', system-ui, sans-serif";

function formatTime(t: string | null | undefined): string | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return t;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function formatDate(dateStr: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string | null {
  if (!dateStr) return null;
  const [y, mo, d] = dateStr.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("en-US", opts ?? {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

export function isPhotoComplete(url: string | null | undefined): boolean {
  return !!(url && !url.startsWith("blob:"));
}

function isLightHex(hex: string): boolean {
  const c = (hex || "").replace("#", "");
  if (c.length !== 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 160;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

export function clampPhotoZoom(value: number | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_PHOTO_ZOOM;
  return Math.max(MIN_PHOTO_ZOOM, Math.min(MAX_PHOTO_ZOOM, parsed));
}

function dragDeltaToPercent(e: React.PointerEvent<HTMLElement>, dx: number, dy: number) {
  const rect = e.currentTarget.getBoundingClientRect();
  return {
    x: rect.width > 0 ? (dx / rect.width) * 100 : 0,
    y: rect.height > 0 ? (dy / rect.height) * 100 : 0,
  };
}

function firstName(value?: string | null) {
  return String(value || "").trim().split(/\s+/)[0] || "";
}

function hotelAddressLine(hotel: SaveTheDateHotelInfo) {
  return [
    hotel.address,
    [hotel.city, hotel.state].filter(Boolean).join(", "),
    hotel.zip,
  ].filter(Boolean).join(" ");
}

function formatHotelDate(value: string | null | undefined) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatHotelDateRange(checkIn?: string | null, checkOut?: string | null) {
  const start = formatHotelDate(checkIn);
  const end = formatHotelDate(checkOut);
  if (start && end) return `${start} - ${end}`;
  return start || end;
}

function formatHotelMoney(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export interface CustomColors {
  bg: string;
  accent: string;
  text: string;
  muted: string;
  cardBdr: string;
  font?: string;
  fontSize?: string;
}

// ── Badge circle ──────────────────────────────────────────────────────────────
function Badge({ children, accent = GOLD }: { children: ReactNode; accent?: string }) {
  return (
    <div style={{
      width: 52, height: 52, borderRadius: "50%", margin: "0 auto",
      background: `${accent}22`, boxShadow: `0 0 0 1px ${accent}44`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {children}
    </div>
  );
}

// ── Shared card shell: dark bg + dots + logo + optional photo ─────────────────
function InvitationMarketingFooter({ customColors, compact = false }: { customColors?: CustomColors; compact?: boolean }) {
  const accent = customColors?.accent ?? GOLD;
  const muted = customColors?.muted ?? MUTED;
  const labelFont = customColors?.font ? `'${customColors.font}', ${cormorant}` : jakarta;
  return (
    <div
      style={{
        marginTop: compact ? 10 : 18,
        paddingTop: compact ? 10 : 14,
        borderTop: `1px solid ${customColors?.cardBdr ?? CARD_BDR}`,
        textAlign: "center",
      }}
    >
      <img
        src="/logo.png"
        alt="A.IDO"
        style={{
          display: "block",
          height: compact ? 24 : 30,
          width: "auto",
          objectFit: "contain",
          margin: "0 auto 6px",
        }}
      />
      <p style={{ margin: 0, fontFamily: labelFont, fontSize: compact ? 8.5 : 9.5, color: muted, lineHeight: 1.45 }}>
        Planning your own wedding?{" "}
        <a href="https://aidowedding.net?theme=light" style={{ color: accent, fontWeight: 800, textDecoration: "none" }}>
          Try A.IDO
        </a>
      </p>
      <p style={{ margin: "2px 0 0", fontFamily: labelFont, fontSize: compact ? 8 : 9, color: muted, lineHeight: 1.35 }}>
        aidowedding.net
      </p>
    </div>
  );
}

function CardShell({
  topContent,
  children,
  photoUrl,
  photoPosition = DEFAULT_PHOTO_POSITION,
  photoZoom = DEFAULT_PHOTO_ZOOM,
  onPhotoPositionChange,
  customColors,
  photoEffect = "none",
}: {
  topContent?: ReactNode;
  children: ReactNode;
  photoUrl?: string | null;
  photoPosition?: PhotoPosition;
  photoZoom?: number;
  onPhotoPositionChange?: (pos: PhotoPosition) => void;
  customColors?: CustomColors;
  photoEffect?: string | null;
}) {
  const bg      = customColors?.bg      ?? BG;
  const accent  = customColors?.accent  ?? GOLD;
  const cardBdr = customColors?.cardBdr ?? CARD_BDR;
  const dotPat  = `radial-gradient(${accent}22 1px, transparent 1px)`;

  const panRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const handleDown = (e: React.PointerEvent) => {
    if (!onPhotoPositionChange) return;
    e.preventDefault();
    e.stopPropagation();
    panRef.current = { sx: e.clientX, sy: e.clientY, ox: photoPosition.x, oy: photoPosition.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const handleMove = (e: React.PointerEvent) => {
    if (!panRef.current || !onPhotoPositionChange) return;
    const dx = e.clientX - panRef.current.sx;
    const dy = e.clientY - panRef.current.sy;
    const delta = dragDeltaToPercent(e, dx, dy);
    onPhotoPositionChange({
      x: clampPercent(panRef.current.ox - delta.x),
      y: clampPercent(panRef.current.oy - delta.y),
    });
  };
  const handleUp = (e: React.PointerEvent) => {
    panRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch { /* noop */ }
  };

  const resolvedPhotoUrl = resolveMediaUrl(photoUrl);
  const hasPhoto = isPhotoComplete(resolvedPhotoUrl);
  const zoom = clampPhotoZoom(photoZoom);
  const fitWholePhoto = zoom < 1;
  return (
    <div style={{
      // Outer wrapper sits outside the rounded card. Keep it on the warm
      // A.IDO ivory page color so previews match the public links and email.
      backgroundColor: BG,
      borderRadius: 16, padding: "16px 12px",
    }}>
    <div
      className="w-full rounded-xl overflow-hidden shadow-2xl mx-auto border"
      style={{ maxWidth: 420, background: bg, borderColor: cardBdr }}
    >
      {topContent && (
        <div style={{
          backgroundImage: dotPat, backgroundSize: "22px 22px",
          backgroundColor: bg, padding: "24px 24px 16px", textAlign: "center",
        }}>
          {topContent}
        </div>
      )}

      {/* Optional photo */}
      {hasPhoto && (
        <div
          style={{
            padding: 0,
            backgroundColor: bg, backgroundImage: dotPat, backgroundSize: "22px 22px",
            cursor: onPhotoPositionChange ? "grab" : undefined,
            touchAction: onPhotoPositionChange ? "none" : undefined,
            userSelect: "none",
          }}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
        >
          <div
            style={{
              position: "relative",
              aspectRatio: "16 / 9",
              maxHeight: 236,
              overflow: "hidden",
              borderRadius: 0,
              boxShadow: "none",
              backgroundColor: `${accent}12`,
            }}
          >
            <AuthMediaImage
              src={photoUrl!}
              alt="Wedding photo"
              draggable={false}
              style={{
                width: "100%",
                height: "100%",
                objectFit: fitWholePhoto ? "contain" : "cover",
                display: "block",
                objectPosition: `${photoPosition.x}% ${photoPosition.y}%`,
                transform: `scale(${fitWholePhoto ? 1 : zoom})`,
                transformOrigin: `${photoPosition.x}% ${photoPosition.y}%`,
                filter: photoEffectToFilter(photoEffect),
                pointerEvents: "none",
                userSelect: "none",
              }}
            />
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, rgba(59,28,43,0.02) 0%, rgba(59,28,43,0.08) 72%, rgba(59,28,43,0.18) 100%)",
                pointerEvents: "none",
              }}
            />
          </div>
        </div>
      )}

      {/* Main content */}
      <div style={{
        backgroundImage: dotPat, backgroundSize: "22px 22px",
        backgroundColor: bg, padding: "16px 24px 28px", textAlign: "center",
      }}>
        {children}
        <InvitationMarketingFooter customColors={customColors} />
      </div>
    </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Save the Date — AI preview
// ─────────────────────────────────────────────────────────────────────────────
export function AiSaveDatePreview({
  profile,
  palette: _palette,
  photoUrl,
  photoPosition,
  photoZoom,
  onPhotoPositionChange,
  customColors,
  fullPhoto = false,
  photoEffect = "none",
  hotelOptions = [],
}: {
  profile: WeddingInfo;
  palette: ColorPalette;
  photoUrl?: string | null;
  photoPosition?: PhotoPosition;
  photoZoom?: number;
  onPhotoPositionChange?: (pos: PhotoPosition) => void;
  customColors?: CustomColors;
  fullPhoto?: boolean;
  photoEffect?: string | null;
  hotelOptions?: SaveTheDateHotelInfo[];
}) {
  if (fullPhoto) {
    return (
      <FullPhotoSaveDatePreview
        profile={profile}
        photoUrl={photoUrl}
        photoPosition={photoPosition}
        photoZoom={photoZoom}
        onPhotoPositionChange={onPhotoPositionChange}
        customColors={customColors}
        photoEffect={photoEffect}
        hotelOptions={hotelOptions}
      />
    );
  }

  const accent      = customColors?.accent  ?? GOLD;
  const text        = customColors?.text    ?? WHITE;
  const muted       = customColors?.muted   ?? MUTED;
  const cardBdr     = customColors?.cardBdr ?? CARD_BDR;
  const displayFont = customColors?.font
    ? `'${customColors.font}', ${cormorant}`
    : cormorant;
  // Scale all font sizes proportionally when a custom base size is set.
  const parsedBaseFs = customColors?.fontSize ? parseFloat(customColors.fontSize) : 16;
  const baseFs = Number.isFinite(parsedBaseFs) && parsedBaseFs > 0 ? parsedBaseFs : 16;
  const sc = customColors ? baseFs / 16 : 1;
  // In custom mode apply the user's font everywhere, including labels.
  const labelFont = customColors ? displayFont : jakarta;

  const couple    = [profile.partner2Name, profile.partner1Name].filter(Boolean).join(" & ") || "The Couple";
  const dateStr   = formatDate(profile.weddingDate, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const cityLine  = [profile.venueCity, profile.venueState].filter(Boolean).join(", ");
  const renderHotelDetails = (hotel: SaveTheDateHotelInfo) => {
    const dateRange = formatHotelDateRange(hotel.checkInDate, hotel.checkOutDate);
    const rate = formatHotelMoney(hotel.pricePerNight);
    return (
      <div
        key={hotel.id}
        style={{
          marginTop: 10,
          padding: "10px 11px",
          borderRadius: 9,
          border: `1px solid ${cardBdr}`,
          background: "rgba(255,255,255,.62)",
          fontFamily: labelFont,
          fontSize: 10 * sc,
          lineHeight: 1.45,
          color: text,
        }}
      >
        <p style={{ margin: 0, fontWeight: 800 }}>{hotel.hotelName || "Hotel block"}</p>
        {hotelAddressLine(hotel) && <p style={{ margin: "2px 0 0", color: muted }}>{hotelAddressLine(hotel)}</p>}
        {hotel.groupName && <p style={{ margin: "6px 0 0", color: muted }}><strong>Wedding block:</strong> {hotel.groupName}</p>}
        {dateRange && <p style={{ margin: "2px 0 0", color: muted }}><strong>Book these dates:</strong> {dateRange}</p>}
        {hotel.distanceFromVenue && <p style={{ margin: "2px 0 0", color: muted }}><strong>Distance:</strong> {hotel.distanceFromVenue}</p>}
        {rate && <p style={{ margin: "2px 0 0", color: muted }}><strong>Rate:</strong> {rate}</p>}
        {hotel.discountCode && <p style={{ margin: "2px 0 0", color: muted }}><strong>Group code:</strong> {hotel.discountCode}</p>}
        {hotel.cutoffDate && <p style={{ margin: "2px 0 0", color: muted }}><strong>Cutoff Date to Book:</strong> {formatHotelDate(hotel.cutoffDate)}</p>}
        {dateRange && (
          <p style={{ margin: "6px 0 0", fontWeight: 800, color: accent }}>
            Select the check-in/check-out dates above when booking.
          </p>
        )}
        {hotel.bookingLink && (
          <a
            href={hotel.bookingLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block",
              marginTop: 8,
              padding: "8px 10px",
              borderRadius: 8,
              background: accent,
              color: isLightHex(accent) ? text : BG,
              fontWeight: 800,
              textAlign: "center",
              textDecoration: "none",
            }}
          >
            Open booking link
          </a>
        )}
      </div>
    );
  };

  return (
    <CardShell
      photoUrl={photoUrl}
      photoPosition={photoPosition}
      photoZoom={photoZoom}
      onPhotoPositionChange={onPhotoPositionChange}
      customColors={customColors}
      photoEffect={photoEffect}
      topContent={
        <p style={{ fontFamily: labelFont, fontSize: 11 * sc, fontWeight: 700,
                    letterSpacing: "0.42em", textTransform: "uppercase",
                    color: accent, margin: 0 }}>
          Save the Date
        </p>
      }
    >
      <h2 style={{ fontFamily: displayFont, fontSize: `${2.1 * sc}rem`, fontWeight: 400,
                   fontStyle: "italic", color: accent, lineHeight: 1.2, margin: "0 0 16px" }}>
        {couple}
      </h2>

      <div style={{ height: 1, background: cardBdr, margin: "0 16px 14px" }} />

      {dateStr && (
        <p style={{ fontFamily: labelFont, fontSize: 10 * sc, fontWeight: 600,
                    letterSpacing: "0.12em", textTransform: "uppercase", color: text, marginBottom: 10 }}>
          {dateStr}
        </p>
      )}

      {cityLine && (
        <p style={{ fontFamily: labelFont, fontSize: 10 * sc, color: text, margin: "1px 0 0" }}>
          {cityLine}
        </p>
      )}
      {profile.saveTheDateMessage && (
        <p style={{ fontFamily: displayFont, fontSize: `${0.95 * sc}rem`, fontStyle: "italic",
                    color: text, lineHeight: 1.7, margin: "14px 0 0" }}>
          &ldquo;{profile.saveTheDateMessage}&rdquo;
        </p>
      )}

      <p style={{ fontFamily: displayFont, fontSize: 12 * sc, fontStyle: "italic",
                  color: muted, margin: "12px 0 0" }}>
        Formal invitation to follow
      </p>

      {hotelOptions.length > 0 && (
        <div style={{
          margin: "16px auto 0",
          maxWidth: 310,
          border: `1px solid ${cardBdr}`,
          background: `${accent}10`,
          borderRadius: 10,
          padding: "12px 14px",
          textAlign: "left",
          color: text,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
            <Hotel style={{ width: 14, height: 14, color: accent, flex: "0 0 auto" }} />
            <p style={{ margin: 0, fontFamily: labelFont, fontSize: 9.5 * sc, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: accent }}>
              Hotel Accommodations
            </p>
          </div>
          <p style={{ margin: "0 0 8px", fontFamily: labelFont, fontSize: 9.5 * sc, color: muted, lineHeight: 1.45 }}>
            Hotel block details are below. Guests can use the booking link when they are ready to reserve.
          </p>
          {hotelOptions.map(renderHotelDetails)}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: `${accent}1a`, border: `1px solid ${cardBdr}`,
          color: muted, fontFamily: labelFont, fontSize: 10 * sc,
          fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase",
          padding: "8px 20px", borderRadius: 6,
        }}>
          <Download style={{ width: 11, height: 11 }} />
          View &amp; Download
        </div>
      </div>
    </CardShell>
  );
}

function FullPhotoSaveDatePreview({
  profile,
  photoUrl,
  photoPosition = DEFAULT_PHOTO_POSITION,
  photoZoom = DEFAULT_PHOTO_ZOOM,
  onPhotoPositionChange,
  customColors,
  photoEffect,
  hotelOptions = [],
}: {
  profile: WeddingInfo;
  photoUrl?: string | null;
  photoPosition?: PhotoPosition;
  photoZoom?: number;
  onPhotoPositionChange?: (pos: PhotoPosition) => void;
  customColors?: CustomColors;
  photoEffect?: string | null;
  hotelOptions?: SaveTheDateHotelInfo[];
}) {
  const displayFont = customColors?.font
    ? `'${customColors.font}', ${cormorant}`
    : cormorant;
  const labelFont = customColors ? displayFont : jakarta;
  const parsedBaseFs = customColors?.fontSize ? parseFloat(customColors.fontSize) : 16;
  const baseFs = Number.isFinite(parsedBaseFs) && parsedBaseFs > 0 ? parsedBaseFs : 16;
  const sc = customColors ? baseFs / 16 : 1;
  const accentColor = customColors?.accent ?? GOLD;
  const textColor = customColors?.text ?? "#ffffff";

  const panRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const handleDown = (e: React.PointerEvent<HTMLElement>) => {
    if (!onPhotoPositionChange) return;
    e.preventDefault();
    e.stopPropagation();
    panRef.current = { sx: e.clientX, sy: e.clientY, ox: photoPosition.x, oy: photoPosition.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handleMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!panRef.current || !onPhotoPositionChange) return;
    const dx = e.clientX - panRef.current.sx;
    const dy = e.clientY - panRef.current.sy;
    const delta = dragDeltaToPercent(e, dx, dy);
    onPhotoPositionChange({
      x: clampPercent(panRef.current.ox - delta.x),
      y: clampPercent(panRef.current.oy - delta.y),
    });
  };
  const handleUp = (e: React.PointerEvent<HTMLElement>) => {
    panRef.current = null;
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch { /* noop */ }
  };

  const resolvedPhotoUrl = resolveMediaUrl(photoUrl);
  const hasPhoto = isPhotoComplete(resolvedPhotoUrl);
  const zoom = clampPhotoZoom(photoZoom);
  const fitWholePhoto = zoom < 1;
  const groomFirst = firstName(profile.partner1Name) || "Partner";
  const brideFirst = firstName(profile.partner2Name) || "Partner";
  const dateStr = formatDate(profile.weddingDate, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const cityLine = [profile.venueCity, profile.venueState].filter(Boolean).join(", ");
  const primaryHotel = hotelOptions[0] ?? null;

  return (
    <div style={{ backgroundColor: BG, borderRadius: 28, padding: "12px" }}>
      <div
        className="mx-auto shadow-2xl"
        style={{
          width: "min(100%, 420px)",
          aspectRatio: "9 / 16",
          minHeight: 620,
          position: "relative",
          overflow: "hidden",
          borderRadius: 30,
          border: "1px solid rgba(255,255,255,.35)",
          background: "#111",
          cursor: onPhotoPositionChange ? "grab" : undefined,
          touchAction: onPhotoPositionChange ? "none" : undefined,
          userSelect: "none",
        }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
      >
        {hasPhoto ? (
          <AuthMediaImage
            src={photoUrl!}
            alt="Save the Date photo"
            draggable={false}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: fitWholePhoto ? "contain" : "cover",
              objectPosition: `${photoPosition.x}% ${photoPosition.y}%`,
              transform: `scale(${fitWholePhoto ? 1 : zoom})`,
              transformOrigin: `${photoPosition.x}% ${photoPosition.y}%`,
              filter: photoEffectToFilter(photoEffect),
              pointerEvents: "none",
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(145deg, rgba(255,255,255,.15), transparent 42%), linear-gradient(180deg, #333, #111)",
            }}
          />
        )}

        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(0,0,0,.2) 0%, rgba(0,0,0,.08) 35%, rgba(0,0,0,.65) 100%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: "34px 28px 38px", color: textColor, textAlign: "center" }}>
          <div>
            <p style={{ fontFamily: labelFont, fontSize: 12 * sc, fontWeight: 700, letterSpacing: "0.34em", textTransform: "uppercase", margin: "0 0 10px", color: accentColor }}>
              Save the Date
            </p>
            <div style={{ margin: "0 auto", width: 46, height: 28, position: "relative" }}>
              <Heart style={{ width: 24, height: 24, color: accentColor, opacity: 0.9, transform: "rotate(-14deg)" }} />
              <div style={{ position: "absolute", left: 20, right: 0, top: 18, height: 1, background: accentColor, opacity: 0.72 }} />
            </div>
          </div>

          <div style={{ marginTop: "auto", marginBottom: 20 }}>
            <div style={{ fontFamily: displayFont, textTransform: "uppercase", letterSpacing: "0.18em", lineHeight: 1.15, color: accentColor }}>
              <div style={{ fontSize: `${2.2 * sc}rem`, fontWeight: 500 }}>{brideFirst}</div>
              <div style={{ fontSize: `${1.8 * sc}rem`, fontStyle: "italic", textTransform: "none", letterSpacing: "0.08em", margin: "4px 0" }}>and</div>
              <div style={{ fontSize: `${2.2 * sc}rem`, fontWeight: 500 }}>{groomFirst}</div>
            </div>
            {dateStr && (
              <p style={{ fontFamily: labelFont, fontSize: 11 * sc, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", margin: "20px 0 0" }}>
                {dateStr}
              </p>
            )}
            {cityLine && (
              <p style={{ fontFamily: labelFont, fontSize: 12 * sc, margin: "8px 0 0", color: textColor, opacity: 0.88 }}>
                {cityLine}
              </p>
            )}
            {profile.saveTheDateMessage && (
              <p style={{ fontFamily: displayFont, fontSize: `${1 * sc}rem`, fontStyle: "italic", lineHeight: 1.55, margin: "18px 0 0", color: textColor, opacity: 0.9 }}>
                &ldquo;{profile.saveTheDateMessage}&rdquo;
              </p>
            )}
            {primaryHotel && (
              <p style={{ fontFamily: labelFont, fontSize: 10 * sc, lineHeight: 1.45, margin: "16px 0 0", color: textColor, opacity: 0.9 }}>
                Hotel block: {primaryHotel.hotelName || "Hotel block"}
                {primaryHotel.discountCode ? ` - Code ${primaryHotel.discountCode}` : ""}
              </p>
            )}
          </div>
        </div>
      </div>
      <InvitationMarketingFooter customColors={customColors} compact />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RSVP Invitation (Digital Invitation) — AI preview
// ─────────────────────────────────────────────────────────────────────────────
export function AiDigitalInvitationPreview({
  profile,
  palette: _palette,
  photoUrl,
  photoPosition,
  photoZoom,
  onPhotoPositionChange,
  customColors,
  photoEffect = "none",
  fullPhoto = false,
  onRsvpClick,
}: {
  profile: WeddingInfo;
  palette: ColorPalette;
  photoUrl?: string | null;
  photoPosition?: PhotoPosition;
  photoZoom?: number;
  onPhotoPositionChange?: (pos: PhotoPosition) => void;
  customColors?: CustomColors;
  photoEffect?: string | null;
  fullPhoto?: boolean;
  onRsvpClick?: () => void;
}) {
  const bg      = customColors?.bg      ?? BG;
  const accent  = customColors?.accent  ?? GOLD;
  const text    = customColors?.text    ?? WHITE;
  const muted   = customColors?.muted   ?? MUTED;
  const cardBdr = customColors?.cardBdr ?? CARD_BDR;
  const btnText = (accent === GOLD && !customColors) ? bg : (isLightHex(accent) ? "#1a1a1a" : "#ffffff");
  const displayFont = customColors?.font
    ? `'${customColors.font}', ${cormorant}`
    : cormorant;
  // Scale all font sizes proportionally when a custom base size is set.
  const parsedBaseFs = customColors?.fontSize ? parseFloat(customColors.fontSize) : 16;
  const baseFs = Number.isFinite(parsedBaseFs) && parsedBaseFs > 0 ? parsedBaseFs : 16;
  const sc = customColors ? baseFs / 16 : 1;
  // In custom mode apply the user's font everywhere, including labels.
  const labelFont = customColors ? displayFont : jakarta;

  const couple    = [profile.partner2Name, profile.partner1Name].filter(Boolean).join(" & ") || "The Couple";
  const guestName = profile.guestName || "Guest";
  const dateStr   = formatDate(profile.weddingDate, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const cityLine  = [profile.venueCity, [profile.venueState, profile.venueZip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const timeLines = [
    formatTime(profile.ceremonyTime)  && `Ceremony ${formatTime(profile.ceremonyTime)}`,
    formatTime(profile.receptionTime) && `Reception ${formatTime(profile.receptionTime)}`,
  ].filter((line): line is string => Boolean(line));
  const rsvpDate = formatDate(profile.rsvpByDate, { year: "numeric", month: "long", day: "numeric" });

  if (fullPhoto) {
    return (
      <FullPhotoRsvpPreview
        profile={profile}
        photoUrl={photoUrl}
        photoPosition={photoPosition}
        photoZoom={photoZoom}
        onPhotoPositionChange={onPhotoPositionChange}
        customColors={customColors}
        photoEffect={photoEffect}
        onRsvpClick={onRsvpClick}
      />
    );
  }

  return (
    <CardShell photoUrl={photoUrl} photoPosition={photoPosition} photoZoom={photoZoom} onPhotoPositionChange={onPhotoPositionChange} customColors={customColors} photoEffect={photoEffect}>
      <Badge accent={accent}><Heart style={{ width: 22, height: 22, color: accent, fill: accent }} /></Badge>

      <p style={{ fontFamily: labelFont, fontSize: 11 * sc, fontWeight: 700,
                  letterSpacing: "0.42em", textTransform: "uppercase",
                  color: accent, marginTop: 12 }}>
        Wedding RSVP
      </p>

      <h2 style={{ fontFamily: displayFont, fontSize: `${2.1 * sc}rem`, fontWeight: 400,
                   fontStyle: "italic", color: accent, lineHeight: 1.2, margin: "8px 0 0" }}>
        {couple}
      </h2>

      {dateStr && (
        <p style={{ fontFamily: labelFont, fontSize: 10 * sc, fontWeight: 600,
                    letterSpacing: "0.12em", textTransform: "uppercase", color: text, margin: "12px 0 0" }}>
          {dateStr}
        </p>
      )}

      {(profile.venue || profile.venueAddress || cityLine || timeLines.length > 0 || rsvpDate) && (
        <div
          style={{
            margin: "14px auto 0",
            padding: "12px 14px",
            maxWidth: 330,
            borderTop: `1px solid ${cardBdr}`,
            borderBottom: `1px solid ${cardBdr}`,
            background: customColors ? `${accent}0f` : "rgba(255,255,255,0.035)",
          }}
        >
          {profile.venue && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <MapPin style={{ width: 13, height: 13, color: accent, flexShrink: 0 }} />
              <p style={{ fontFamily: displayFont, fontSize: `${1.08 * sc}rem`, fontWeight: 600, color: accent, margin: 0, lineHeight: 1.25 }}>
                {profile.venue}
              </p>
            </div>
          )}

          {(profile.venueAddress || cityLine) && (
            <div style={{ marginTop: profile.venue ? 6 : 0 }}>
              {profile.venueAddress && (
                <p style={{ fontFamily: labelFont, fontSize: 9.5 * sc, color: text, margin: 0, lineHeight: 1.35 }}>
                  {profile.venueAddress}
                </p>
              )}
              {cityLine && (
                <p style={{ fontFamily: labelFont, fontSize: 9.5 * sc, color: muted, margin: "2px 0 0", lineHeight: 1.35 }}>
                  {cityLine}
                </p>
              )}
            </div>
          )}

          {timeLines.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 6, marginTop: 9 }}>
              {timeLines.map((line) => (
                <span
                  key={line}
                  style={{
                    border: `1px solid ${accent}55`,
                    borderRadius: 999,
                    padding: "4px 8px",
                    fontFamily: labelFont,
                    fontSize: 8.5 * sc,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: accent,
                    whiteSpace: "nowrap",
                  }}
                >
                  {line}
                </span>
              ))}
            </div>
          )}

          {rsvpDate && (
            <div
              style={{
                margin: "10px auto 0",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                borderRadius: 6,
                background: accent,
                color: btnText,
                padding: "6px 10px",
                fontFamily: labelFont,
                fontSize: 9 * sc,
                fontWeight: 800,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              RSVP By <span>{rsvpDate}</span>
            </div>
          )}
        </div>
      )}

      {profile.invitationMessage && (
        <p style={{ fontFamily: displayFont, fontSize: `${0.95 * sc}rem`, fontStyle: "italic",
                    color: text, lineHeight: 1.7, margin: "14px 0 0" }}>
          &ldquo;{profile.invitationMessage}&rdquo;
        </p>
      )}

      <p style={{ fontFamily: labelFont, fontSize: 11 * sc, color: muted, margin: "14px 0 0" }}>
        Dear <span style={{ color: text, fontWeight: 600 }}>{guestName}</span>, will you be joining us?
      </p>

      <div style={{ height: 1, background: cardBdr, margin: "14px 8px" }} />

      <button
        type="button"
        onClick={onRsvpClick}
        style={{ background: accent, border: 0, borderRadius: 8, padding: "12px", textAlign: "center", width: "100%", cursor: onRsvpClick ? "pointer" : "default" }}
      >
        <span style={{ fontFamily: labelFont, fontSize: 12 * sc, fontWeight: 700,
                       letterSpacing: "0.12em", textTransform: "uppercase", color: btnText }}>
          RSVP Now
        </span>
      </button>
      {profile.websiteUrl ? (
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, border: `1px solid ${cardBdr}`, background: customColors ? `${accent}12` : "rgba(255,255,255,0.035)" }}>
          <p style={{ fontFamily: labelFont, fontSize: 9 * sc, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: accent, margin: 0 }}>
            Wedding Website
          </p>
          <p style={{ fontFamily: labelFont, fontSize: 10.5 * sc, color: text, margin: "5px 0 0", lineHeight: 1.45, overflowWrap: "anywhere" }}>
            {profile.websiteUrl}
          </p>
        </div>
      ) : profile.websiteLinkPendingMessage ? (
        <p style={{ fontFamily: labelFont, fontSize: 10 * sc, color: muted, margin: "11px 0 0", lineHeight: 1.45 }}>
          {profile.websiteLinkPendingMessage}
        </p>
      ) : null}
    </CardShell>
  );
}

function FullPhotoRsvpPreview({
  profile,
  photoUrl,
  photoPosition = DEFAULT_PHOTO_POSITION,
  photoZoom = DEFAULT_PHOTO_ZOOM,
  onPhotoPositionChange,
  customColors,
  photoEffect,
  onRsvpClick,
}: {
  profile: WeddingInfo;
  photoUrl?: string | null;
  photoPosition?: PhotoPosition;
  photoZoom?: number;
  onPhotoPositionChange?: (pos: PhotoPosition) => void;
  customColors?: CustomColors;
  photoEffect?: string | null;
  onRsvpClick?: () => void;
}) {
  const accent = customColors?.accent ?? GOLD;
  const textColor = customColors?.text ?? "#ffffff";
  const displayFont = customColors?.font
    ? `'${customColors.font}', ${cormorant}`
    : cormorant;
  const labelFont = customColors ? displayFont : jakarta;
  const parsedBaseFs = customColors?.fontSize ? parseFloat(customColors.fontSize) : 16;
  const baseFs = Number.isFinite(parsedBaseFs) && parsedBaseFs > 0 ? parsedBaseFs : 16;
  const sc = customColors ? baseFs / 16 : 1;

  const panRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const handleDown = (e: React.PointerEvent<HTMLElement>) => {
    if (!onPhotoPositionChange) return;
    e.preventDefault();
    e.stopPropagation();
    panRef.current = { sx: e.clientX, sy: e.clientY, ox: photoPosition.x, oy: photoPosition.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handleMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!panRef.current || !onPhotoPositionChange) return;
    const dx = e.clientX - panRef.current.sx;
    const dy = e.clientY - panRef.current.sy;
    const delta = dragDeltaToPercent(e, dx, dy);
    onPhotoPositionChange({
      x: clampPercent(panRef.current.ox - delta.x),
      y: clampPercent(panRef.current.oy - delta.y),
    });
  };
  const handleUp = (e: React.PointerEvent<HTMLElement>) => {
    panRef.current = null;
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch { /* noop */ }
  };

  const resolvedPhotoUrl = resolveMediaUrl(photoUrl);
  const hasPhoto = isPhotoComplete(resolvedPhotoUrl);
  const zoom = clampPhotoZoom(photoZoom);
  const fitWholePhoto = zoom < 1;
  const groomFirst = firstName(profile.partner1Name) || "Partner";
  const brideFirst = firstName(profile.partner2Name) || "Partner";
  const guestName = profile.guestName || "Guest";
  const dateStr = formatDate(profile.weddingDate, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const cityLine = [profile.venueCity, [profile.venueState, profile.venueZip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const timeLines = [
    formatTime(profile.ceremonyTime) && `Ceremony ${formatTime(profile.ceremonyTime)}`,
    formatTime(profile.receptionTime) && `Reception ${formatTime(profile.receptionTime)}`,
  ].filter((line): line is string => Boolean(line));
  const rsvpDate = formatDate(profile.rsvpByDate, { year: "numeric", month: "long", day: "numeric" });

  return (
    <div style={{ backgroundColor: BG, borderRadius: 28, padding: "12px" }}>
      <div
        className="mx-auto shadow-2xl"
        style={{
          width: "min(100%, 420px)",
          aspectRatio: "9 / 16",
          minHeight: 620,
          position: "relative",
          overflow: "hidden",
          borderRadius: 30,
          border: "1px solid rgba(255,255,255,.35)",
          background: "#111",
          cursor: onPhotoPositionChange ? "grab" : undefined,
          touchAction: onPhotoPositionChange ? "none" : undefined,
          userSelect: "none",
        }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
      >
        {hasPhoto ? (
          <AuthMediaImage
            src={photoUrl!}
            alt="RSVP invitation photo"
            draggable={false}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: fitWholePhoto ? "contain" : "cover",
              objectPosition: `${photoPosition.x}% ${photoPosition.y}%`,
              transform: `scale(${fitWholePhoto ? 1 : zoom})`,
              transformOrigin: `${photoPosition.x}% ${photoPosition.y}%`,
              filter: photoEffectToFilter(photoEffect),
              pointerEvents: "none",
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(145deg, rgba(255,255,255,.15), transparent 42%), linear-gradient(180deg, #333, #111)",
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(0,0,0,.26) 0%, rgba(0,0,0,.08) 34%, rgba(0,0,0,.76) 100%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: "34px 28px 38px", color: textColor, textAlign: "center" }}>
          <div>
            <p style={{ fontFamily: labelFont, fontSize: 12 * sc, fontWeight: 700, letterSpacing: "0.34em", textTransform: "uppercase", margin: "0 0 10px", color: accent }}>
              Wedding RSVP
            </p>
            <div style={{ margin: "0 auto", width: 46, height: 28, position: "relative" }}>
              <Heart style={{ width: 24, height: 24, color: accent, opacity: 0.9, transform: "rotate(-14deg)" }} />
              <div style={{ position: "absolute", left: 20, right: 0, top: 18, height: 1, background: accent, opacity: 0.72 }} />
            </div>
            {rsvpDate && (
              <p style={{ fontFamily: labelFont, fontSize: 9.5 * sc, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", margin: "8px 0 0", color: textColor }}>
                RSVP By {rsvpDate}
              </p>
            )}
          </div>

          <div style={{ marginTop: "auto", marginBottom: 8 }}>
            <div style={{ fontFamily: displayFont, textTransform: "uppercase", letterSpacing: "0.18em", lineHeight: 1.15, color: accent }}>
              <div style={{ fontSize: `${2.2 * sc}rem`, fontWeight: 500 }}>{brideFirst}</div>
              <div style={{ fontSize: `${1.8 * sc}rem`, fontStyle: "italic", textTransform: "none", letterSpacing: "0.08em", margin: "4px 0" }}>and</div>
              <div style={{ fontSize: `${2.2 * sc}rem`, fontWeight: 500 }}>{groomFirst}</div>
            </div>
            {dateStr && (
              <p style={{ fontFamily: labelFont, fontSize: 11 * sc, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", margin: "18px 0 0", color: textColor }}>
                {dateStr}
              </p>
            )}
            {(profile.venue || cityLine || timeLines.length > 0) && (
              <div style={{ marginTop: 12, padding: "9px 12px", borderTop: `1px solid ${accent}66`, borderBottom: `1px solid ${accent}66`, background: "rgba(0,0,0,.22)" }}>
                {profile.venue && (
                  <p style={{ fontFamily: displayFont, fontSize: `${1 * sc}rem`, fontWeight: 600, color: accent, margin: 0, lineHeight: 1.25 }}>
                    {profile.venue}
                  </p>
                )}
                {cityLine && (
                  <p style={{ fontFamily: labelFont, fontSize: 10 * sc, color: textColor, margin: "4px 0 0", opacity: 0.88 }}>
                    {cityLine}
                  </p>
                )}
                {timeLines.length > 0 && (
                  <p style={{ fontFamily: labelFont, fontSize: 9 * sc, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: textColor, margin: "7px 0 0", opacity: 0.92 }}>
                    {timeLines.join("  /  ")}
                  </p>
                )}
              </div>
            )}
            {profile.invitationMessage && (
              <p style={{ fontFamily: displayFont, fontSize: `${0.95 * sc}rem`, fontStyle: "italic", color: textColor, lineHeight: 1.55, margin: "13px 0 0", opacity: 0.9 }}>
                &ldquo;{profile.invitationMessage}&rdquo;
              </p>
            )}
            <p style={{ fontFamily: labelFont, fontSize: 10.5 * sc, color: textColor, margin: "13px 0 0" }}>
              Dear <span style={{ fontWeight: 700 }}>{guestName}</span>, will you be joining us?
            </p>
            <button
              type="button"
              onClick={onRsvpClick}
              style={{ marginTop: 13, background: accent, border: 0, borderRadius: 8, padding: "11px 14px", textAlign: "center", width: "100%", cursor: onRsvpClick ? "pointer" : "default" }}
            >
              <span style={{ fontFamily: labelFont, fontSize: 11.5 * sc, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: isLightHex(accent) ? "#1a1a1a" : "#ffffff" }}>
                RSVP Now
              </span>
            </button>
            {profile.websiteUrl ? (
              <div style={{ marginTop: 10, padding: "9px 10px", borderRadius: 8, border: `1px solid ${accent}66`, background: "rgba(0,0,0,.24)" }}>
                <p style={{ fontFamily: labelFont, fontSize: 8.5 * sc, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: accent, margin: 0 }}>
                  Wedding Website
                </p>
                <p style={{ fontFamily: labelFont, fontSize: 9.5 * sc, color: textColor, margin: "4px 0 0", lineHeight: 1.35, overflowWrap: "anywhere" }}>
                  {profile.websiteUrl}
                </p>
              </div>
            ) : profile.websiteLinkPendingMessage ? (
              <p style={{ fontFamily: labelFont, fontSize: 9.5 * sc, color: textColor, margin: "10px 0 0", opacity: 0.78, lineHeight: 1.4 }}>
                {profile.websiteLinkPendingMessage}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <InvitationMarketingFooter customColors={customColors} compact />
    </div>
  );
}
