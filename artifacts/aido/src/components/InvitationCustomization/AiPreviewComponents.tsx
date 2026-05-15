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
  soft: "contrast(0.92) brightness(1.05) saturate(0.9) blur(0.4px)",
  warm: "hue-rotate(8deg) saturate(1.15) brightness(1.04)",
  dramatic: "contrast(1.25) saturate(1.2) brightness(0.92)",
  noir: "grayscale(1) contrast(1.35) brightness(0.85)",
};

export function photoEffectToFilter(effect?: string | null): string {
  return PHOTO_EFFECT_FILTERS[(effect || "none") as PhotoEffect] ?? "none";
}

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

function firstName(value?: string | null) {
  return String(value || "").trim().split(/\s+/)[0] || "";
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
  photoEffect = "none",
}: {
  topContent?: ReactNode;
  children: ReactNode;
  photoUrl?: string | null;
  photoPosition?: PhotoPosition;
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
              filter: photoEffectToFilter(photoEffect),
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
  fullPhoto = false,
  photoEffect = "none",
}: {
  profile: WeddingInfo;
  palette: ColorPalette;
  photoUrl?: string | null;
  photoPosition?: PhotoPosition;
  onPhotoPositionChange?: (pos: PhotoPosition) => void;
  customColors?: CustomColors;
  fullPhoto?: boolean;
  photoEffect?: string | null;
}) {
  if (fullPhoto) {
    return (
      <FullPhotoSaveDatePreview
        profile={profile}
        photoUrl={photoUrl}
        photoPosition={photoPosition}
        onPhotoPositionChange={onPhotoPositionChange}
        customColors={customColors}
        photoEffect={photoEffect}
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

  const couple    = [profile.partner1Name, profile.partner2Name].filter(Boolean).join(" & ") || "The Couple";
  const dateStr   = formatDate(profile.weddingDate, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const cityLine  = [profile.venueCity, profile.venueState].filter(Boolean).join(", ");

  return (
    <CardShell
      photoUrl={photoUrl}
      photoPosition={photoPosition}
      onPhotoPositionChange={onPhotoPositionChange}
      customColors={customColors}
      photoEffect={photoEffect}
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

function FullPhotoSaveDatePreview({
  profile,
  photoUrl,
  photoPosition = { x: 50, y: 50 },
  onPhotoPositionChange,
  customColors,
  photoEffect,
}: {
  profile: WeddingInfo;
  photoUrl?: string | null;
  photoPosition?: PhotoPosition;
  onPhotoPositionChange?: (pos: PhotoPosition) => void;
  customColors?: CustomColors;
  photoEffect?: string | null;
}) {
  const displayFont = customColors?.font
    ? `'${customColors.font}', ${cormorant}`
    : cormorant;
  const labelFont = customColors ? displayFont : jakarta;
  const parsedBaseFs = customColors?.fontSize ? parseFloat(customColors.fontSize) : 16;
  const baseFs = Number.isFinite(parsedBaseFs) && parsedBaseFs > 0 ? parsedBaseFs : 16;
  const sc = customColors ? baseFs / 16 : 1;
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
  const partner1 = firstName(profile.partner1Name) || "Partner";
  const partner2 = firstName(profile.partner2Name) || "Partner";
  const dateStr = formatDate(profile.weddingDate, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const cityLine = [profile.venueCity, profile.venueState].filter(Boolean).join(", ");

  return (
    <div style={{ backgroundColor: "#f3f4f6", borderRadius: 28, padding: "12px" }}>
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
              objectFit: "cover",
              objectPosition: `${photoPosition.x}% ${photoPosition.y}%`,
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
            <p style={{ fontFamily: labelFont, fontSize: 12 * sc, fontWeight: 700, letterSpacing: "0.34em", textTransform: "uppercase", margin: "0 0 10px", color: textColor }}>
              Save the Date
            </p>
            <div style={{ margin: "0 auto", width: 46, height: 28, position: "relative" }}>
              <Heart style={{ width: 24, height: 24, color: textColor, opacity: 0.9, transform: "rotate(-14deg)" }} />
              <div style={{ position: "absolute", left: 20, right: 0, top: 18, height: 1, background: textColor, opacity: 0.72 }} />
            </div>
          </div>

          <div style={{ marginTop: "auto", marginBottom: 20 }}>
            <div style={{ fontFamily: displayFont, textTransform: "uppercase", letterSpacing: "0.18em", lineHeight: 1.15 }}>
              <div style={{ fontSize: `${2.2 * sc}rem`, fontWeight: 500 }}>{partner1}</div>
              <div style={{ fontSize: `${1.8 * sc}rem`, fontStyle: "italic", textTransform: "none", letterSpacing: "0.08em", margin: "4px 0" }}>and</div>
              <div style={{ fontSize: `${2.2 * sc}rem`, fontWeight: 500 }}>{partner2}</div>
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
          </div>
        </div>
      </div>
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
  onPhotoPositionChange,
  customColors,
  photoEffect = "none",
}: {
  profile: WeddingInfo;
  palette: ColorPalette;
  photoUrl?: string | null;
  photoPosition?: PhotoPosition;
  onPhotoPositionChange?: (pos: PhotoPosition) => void;
  customColors?: CustomColors;
  photoEffect?: string | null;
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
  const timeLines = [
    formatTime(profile.ceremonyTime)  && `Ceremony ${formatTime(profile.ceremonyTime)}`,
    formatTime(profile.receptionTime) && `Reception ${formatTime(profile.receptionTime)}`,
  ].filter((line): line is string => Boolean(line));
  const rsvpDate = formatDate(profile.rsvpByDate, { year: "numeric", month: "long", day: "numeric" });

  return (
    <CardShell photoUrl={photoUrl} photoPosition={photoPosition} onPhotoPositionChange={onPhotoPositionChange} customColors={customColors} photoEffect={photoEffect}>
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

      <div style={{ background: accent, borderRadius: 8, padding: "12px", textAlign: "center" }}>
        <span style={{ fontFamily: labelFont, fontSize: 12 * sc, fontWeight: 700,
                       letterSpacing: "0.12em", textTransform: "uppercase", color: btnText }}>
          RSVP Now
        </span>
      </div>
    </CardShell>
  );
}
