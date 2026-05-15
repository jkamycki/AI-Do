import { useRef, type ReactNode } from "react";
import { Heart, MapPin, Download } from "lucide-react";
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
  guestName?: string | null;
  // Couple-set RSVP deadline as YYYY-MM-DD; rendered as "RSVP By: <date>" on
  // the digital invitation preview (and matching email + public RSVP page).
  rsvpByDate?: string | null;
}

export interface PhotoPosition { x: number; y: number }

// ── A.IDO brand palette — matches the RSVP Page preview exactly ───────────────
const BG       = "#1E1A2E";
const GOLD     = "#D4A017";
const WHITE    = "#ffffff";
const MUTED    = "rgba(255,255,255,0.58)";
const CARD_BDR = "rgba(255,255,255,0.12)";
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

function dragDeltaToPercent(e: React.PointerEvent<HTMLElement>, dx: number, dy: number) {
  const rect = e.currentTarget.getBoundingClientRect();
  return {
    x: rect.width > 0 ? (dx / rect.width) * 100 : 0,
    y: rect.height > 0 ? (dy / rect.height) * 100 : 0,
  };
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
function CardShell({
  topContent,
  children,
  photoUrl,
  photoPosition = { x: 50, y: 50 },
  onPhotoPositionChange,
  customColors,
}: {
  topContent?: ReactNode;
  children: ReactNode;
  photoUrl?: string | null;
  photoPosition?: PhotoPosition;
  onPhotoPositionChange?: (pos: PhotoPosition) => void;
  customColors?: CustomColors;
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
  return (
    <div style={{
      // Outer wrapper sits *outside* the rounded card. Light grey so the
      // chosen card colour stops at the rounded edge — matches the public
      // link + email behaviour (everything outside the card is light grey).
      backgroundColor: "#f3f4f6",
      borderRadius: 16, padding: "16px 12px",
    }}>
    <div
      className="w-full rounded-xl overflow-hidden shadow-2xl mx-auto border"
      style={{ maxWidth: 420, background: bg, borderColor: cardBdr }}
    >
      {/* A.IDO logo */}
      <div style={{
        display: "flex", justifyContent: "center",
        paddingTop: 20, paddingBottom: 4,
        backgroundColor: bg, backgroundImage: dotPat, backgroundSize: "22px 22px",
      }}>
        <img src="/logo.png" alt="A.IDO" style={{ height: 48, width: "auto", objectFit: "contain", opacity: 0.85 }} />
      </div>

      {topContent && (
        <div style={{
          backgroundImage: dotPat, backgroundSize: "22px 22px",
          backgroundColor: bg, padding: "10px 24px 16px", textAlign: "center",
        }}>
          {topContent}
        </div>
      )}

      {/* Optional photo */}
      {hasPhoto && (
        <div
          style={{
            padding: "0 20px 10px",
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
          <AuthMediaImage
            src={photoUrl!}
            alt="Wedding photo"
            draggable={false}
            style={{
              width: "100%", height: 200, objectFit: "cover", borderRadius: 8,
              display: "block", boxShadow: "0 6px 30px rgba(0,0,0,0.5)",
              objectPosition: `${photoPosition.x}% ${photoPosition.y}%`,
              pointerEvents: "none", userSelect: "none",
            }}
          />
        </div>
      )}

      {/* Main content */}
      <div style={{
        backgroundImage: dotPat, backgroundSize: "22px 22px",
        backgroundColor: bg, padding: "16px 24px 28px", textAlign: "center",
      }}>
        {children}
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
  onPhotoPositionChange,
  customColors,
}: {
  profile: WeddingInfo;
  palette: ColorPalette;
  photoUrl?: string | null;
  photoPosition?: PhotoPosition;
  onPhotoPositionChange?: (pos: PhotoPosition) => void;
  customColors?: CustomColors;
}) {
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

  const couple    = [profile.partner1Name, profile.partner2Name].filter(Boolean).join(" & ") || "The Couple";
  const dateStr   = formatDate(profile.weddingDate, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const cityLine  = [profile.venueCity, profile.venueState].filter(Boolean).join(", ");

  return (
    <CardShell
      photoUrl={photoUrl}
      photoPosition={photoPosition}
      onPhotoPositionChange={onPhotoPositionChange}
      customColors={customColors}
      topContent={
        <>
      <p style={{ fontFamily: labelFont, fontSize: 11 * sc, fontWeight: 700,
                  letterSpacing: "0.42em", textTransform: "uppercase",
                  color: accent, margin: 0 }}>
        Save the Date
      </p>

      <h2 style={{ fontFamily: displayFont, fontSize: `${2.1 * sc}rem`, fontWeight: 400,
                   fontStyle: "italic", color: accent, lineHeight: 1.2, margin: "8px 0 0" }}>
        {couple}
      </h2>
        </>
      }
    >
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

// ─────────────────────────────────────────────────────────────────────────────
// RSVP Invitation (Digital Invitation) — AI preview
// ─────────────────────────────────────────────────────────────────────────────
export function AiDigitalInvitationPreview({
  profile,
  palette: _palette,
  photoUrl,
  photoPosition,
  onPhotoPositionChange,
  customColors,
}: {
  profile: WeddingInfo;
  palette: ColorPalette;
  photoUrl?: string | null;
  photoPosition?: PhotoPosition;
  onPhotoPositionChange?: (pos: PhotoPosition) => void;
  customColors?: CustomColors;
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

  const couple    = [profile.partner1Name, profile.partner2Name].filter(Boolean).join(" & ") || "The Couple";
  const guestName = profile.guestName || "Guest";
  const dateStr   = formatDate(profile.weddingDate, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const cityLine  = [profile.venueCity, [profile.venueState, profile.venueZip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const timesLine = [
    formatTime(profile.ceremonyTime)  && `Ceremony ${formatTime(profile.ceremonyTime)}`,
    formatTime(profile.receptionTime) && `Reception ${formatTime(profile.receptionTime)}`,
  ].filter(Boolean).join(" · ");

  return (
    <CardShell photoUrl={photoUrl} photoPosition={photoPosition} onPhotoPositionChange={onPhotoPositionChange} customColors={customColors}>
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

      {profile.venue && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 10 }}>
          <MapPin style={{ width: 12, height: 12, color: accent, flexShrink: 0 }} />
          <p style={{ fontFamily: displayFont, fontSize: `${1 * sc}rem`, fontWeight: 500, color: accent, margin: 0 }}>
            {profile.venue}
          </p>
        </div>
      )}

      {profile.venueAddress && (
        <p style={{ fontFamily: labelFont, fontSize: 10 * sc, color: text, margin: "4px 0 0" }}>
          {profile.venueAddress}
        </p>
      )}
      {cityLine && (
        <p style={{ fontFamily: labelFont, fontSize: 10 * sc, color: text, margin: "2px 0 0" }}>
          {cityLine}
        </p>
      )}
      {timesLine && (
        <p style={{ fontFamily: labelFont, fontSize: 10 * sc, color: accent, margin: "6px 0 0" }}>
          {timesLine}
        </p>
      )}

      {formatDate(profile.rsvpByDate, { year: "numeric", month: "long", day: "numeric" }) && (
        <p style={{ fontFamily: labelFont, fontSize: 10 * sc, fontWeight: 600,
                    letterSpacing: "0.12em", textTransform: "uppercase",
                    color: accent, margin: "10px 0 0" }}>
          RSVP By: <span style={{ color: text, fontWeight: 600 }}>
            {formatDate(profile.rsvpByDate, { year: "numeric", month: "long", day: "numeric" })}
          </span>
        </p>
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

      <div style={{ background: accent, borderRadius: 8, padding: "12px", textAlign: "center" }}>
        <span style={{ fontFamily: labelFont, fontSize: 12 * sc, fontWeight: 700,
                       letterSpacing: "0.12em", textTransform: "uppercase", color: btnText }}>
          RSVP Now
        </span>
      </div>
    </CardShell>
  );
}
