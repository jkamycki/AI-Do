import { useRef } from "react";
import { CheckCircle2, XCircle, Heart, MapPin, Download } from "lucide-react";
import { AuthMediaImage } from "@/components/AuthMediaImage";
import type { ColorPalette } from "@/types/invitations";
import type { PhotoPosition } from "@/components/InvitationCustomization/AiPreviewComponents";

interface RsvpPagePreviewProps {
  colors: ColorPalette;
  font: string | null;
  backgroundColor: string | null;
  fontColor?: string | null;
  fontSize?: string | null;
  coupleColor?: string;
  partner1Name: string;
  partner2Name: string;
  weddingDate: string;
  venue: string;
  photoUrl: string | null;
  photoPosition?: PhotoPosition;
  onPhotoPositionChange?: (pos: PhotoPosition) => void;
  guestName?: string;
  scale?: number;
  venueAddress?: string | null;
  venueCity?: string | null;
  venueState?: string | null;
  venueZip?: string | null;
  ceremonyTime?: string | null;
  receptionTime?: string | null;
  invitationMessage?: string | null;
}

function isLightColor(hex: string): boolean {
  const c = hex.replace("#", "");
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

function formatDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr: string | null | undefined): string | null {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return timeStr;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

const PREVIEW_W = 390;
const PREVIEW_H = 820;

const jakarta = "'Plus Jakarta Sans', system-ui, sans-serif";

export function RsvpPagePreview({
  colors,
  font,
  backgroundColor,
  fontColor,
  fontSize,
  coupleColor,
  partner1Name,
  partner2Name,
  weddingDate,
  venue,
  photoUrl,
  photoPosition = { x: 50, y: 50 },
  onPhotoPositionChange,
  guestName = "Guest Name",
  scale = 1.0,
  venueAddress,
  venueCity,
  venueState,
  venueZip,
  ceremonyTime,
  receptionTime,
  invitationMessage,
}: RsvpPagePreviewProps) {
  const bg = backgroundColor || "#FFF7F2";
  const accent = colors.accent || colors.primary || "#8D294D";
  // coupleColor is explicitly passed as A.IDO burgundy in AI mode and omitted in
  // custom mode so it falls back to the user's accent.
  const coupleNameColor = coupleColor ?? accent;
  const isLight = isLightColor(bg);
  // Use custom font color when provided (custom mode), otherwise derive from background.
  const textColor = fontColor || (isLight ? "#1a1a1a" : "#ffffff");
  const textMuted = fontColor ? fontColor + "99" : (isLight ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)");
  const textFaint = fontColor ? fontColor + "55" : (isLight ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.35)");
  const cardBg = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const cardBorder = isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)";
  const accentText = isLightColor(accent) ? "#1a1a1a" : "#ffffff";
  const couple = [partner1Name, partner2Name].filter(Boolean).join(" & ") || "The Couple";
  const dateStr = weddingDate ? formatDate(weddingDate) : "Wedding Day";
  // Apply custom font family to all text when set; falls back to defaults.
  const serifStack = font
    ? `'${font}', 'Cormorant Garamond', Georgia, serif`
    : "'Cormorant Garamond', 'Playfair Display', Georgia, serif";
  const coupleFont = serifStack;
  const bodyFont = font ? serifStack : jakarta;
  // Scale font sizes when a custom base size is provided (default 16px).
  const parsedBaseFs = fontSize ? parseFloat(fontSize) : 16;
  const baseFs = Number.isFinite(parsedBaseFs) && parsedBaseFs > 0 ? parsedBaseFs : 16;
  const sc = fontSize ? baseFs / 16 : 1;

  const cityStateZip = [
    venueCity,
    [venueState, venueZip].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ");

  const ceremonyTimeStr = formatTime(ceremonyTime);
  const receptionTimeStr = formatTime(receptionTime);
  const timesLine = [
    ceremonyTimeStr && `Ceremony ${ceremonyTimeStr}`,
    receptionTimeStr && `Reception ${receptionTimeStr}`,
  ].filter(Boolean).join("  ·  ");

  const panRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  const handlePhotoPanDown = (e: React.PointerEvent) => {
    if (!onPhotoPositionChange) return;
    e.preventDefault();
    e.stopPropagation();
    panRef.current = { sx: e.clientX, sy: e.clientY, ox: photoPosition.x, oy: photoPosition.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePhotoPanMove = (e: React.PointerEvent) => {
    if (!panRef.current || !onPhotoPositionChange) return;
    const dx = e.clientX - panRef.current.sx;
    const dy = e.clientY - panRef.current.sy;
    const delta = dragDeltaToPercent(e, dx, dy);
    onPhotoPositionChange({
      x: clampPercent(panRef.current.ox - delta.x),
      y: clampPercent(panRef.current.oy - delta.y),
    });
  };

  const handlePhotoPanUp = (e: React.PointerEvent) => {
    panRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch { /* noop */ }
  };

  return (
    <div
      className="relative mx-auto overflow-hidden rounded-xl shadow-2xl border"
      style={{
        width: PREVIEW_W * scale,
        height: PREVIEW_H * scale,
        borderColor: cardBorder,
      }}
    >
      <div
        style={{
          width: PREVIEW_W,
          height: PREVIEW_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          backgroundColor: bg,
          backgroundImage: `radial-gradient(${accent}22 1px, transparent 1px)`,
          backgroundSize: "22px 22px",
          overflowY: "hidden",
          position: "relative",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 20, paddingBottom: 4 }}>
          <img
            src="/logo.png"
            alt="A.IDO"
            style={{ height: 64, width: "auto", objectFit: "contain" }}
          />
        </div>

        {/* Photo */}
        {photoUrl && (
          <div
            style={{
              padding: "0 20px 12px",
              cursor: onPhotoPositionChange ? "grab" : undefined,
              touchAction: onPhotoPositionChange ? "none" : undefined,
              userSelect: "none",
            }}
            onPointerDown={handlePhotoPanDown}
            onPointerMove={handlePhotoPanMove}
            onPointerUp={handlePhotoPanUp}
            onPointerCancel={handlePhotoPanUp}
          >
            <AuthMediaImage
              src={photoUrl}
              alt={`${couple}'s wedding`}
              style={{
                width: "100%", height: 140, objectFit: "cover",
                borderRadius: 10, display: "block",
                boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
                objectPosition: `${photoPosition.x}% ${photoPosition.y}%`,
                pointerEvents: "none",
                userSelect: "none",
              }}
              draggable={false}
            />
          </div>
        )}

        {/* Invitation card section */}
        <div style={{ textAlign: "center", padding: "8px 20px 12px" }}>
          {/* Heart */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <div style={{
              width: 52, height: 52, borderRadius: "50%",
              background: `${accent}22`, boxShadow: `0 0 0 1px ${accent}44`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Heart style={{ width: 26, height: 26, color: accent, fill: accent }} />
            </div>
          </div>

          {/* "Wedding RSVP" label */}
          <p style={{
            fontFamily: bodyFont, fontSize: 9 * sc, fontWeight: 600,
            letterSpacing: "0.4em", textTransform: "uppercase",
            color: accent, marginBottom: 10,
          }}>Wedding RSVP</p>

          {/* Couple names */}
          <h1 style={{
            fontFamily: coupleFont,
            fontSize: 34 * sc, fontWeight: 400, fontStyle: "italic",
            color: coupleNameColor, lineHeight: 1.15, letterSpacing: "0.02em",
            marginBottom: 8,
          }}>{couple}</h1>

          {/* Date */}
          <p style={{
            fontFamily: bodyFont, fontSize: 10 * sc, letterSpacing: "0.1em",
            textTransform: "uppercase", color: textColor, marginBottom: 8,
          }}>{dateStr}</p>

          {/* Venue and times use the invitation accent; address uses body text. */}
          {(venue || venueAddress || cityStateZip || timesLine) && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              {venue && (
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <MapPin style={{ width: 12, height: 12, color: accent }} />
                  <p style={{ fontFamily: coupleFont, fontSize: 16 * sc, fontWeight: 500, color: accent }}>{venue}</p>
                </div>
              )}
              {venueAddress && (
                <p style={{ fontFamily: bodyFont, fontSize: 10 * sc, color: textColor }}>{venueAddress}</p>
              )}
              {cityStateZip && (
                <p style={{ fontFamily: bodyFont, fontSize: 10 * sc, color: textColor }}>{cityStateZip}</p>
              )}
              {timesLine && (
                <p style={{ fontFamily: bodyFont, fontSize: 10 * sc, color: accent, marginTop: 3 }}>{timesLine}</p>
              )}
            </div>
          )}

          {/* Invitation message */}
          {invitationMessage && (
            <p style={{
              fontFamily: coupleFont, fontSize: 15 * sc, fontStyle: "italic",
              lineHeight: 1.7, color: textColor,
              margin: "14px auto 0", maxWidth: 300,
            }}>
              &ldquo;{invitationMessage}&rdquo;
            </p>
          )}

          {/* Download PDF button */}
          <div style={{ paddingTop: 14, display: "flex", justifyContent: "center" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              background: cardBg, color: textMuted,
              fontFamily: bodyFont, fontSize: 10 * sc, fontWeight: 600,
              letterSpacing: "0.18em", textTransform: "uppercase",
              padding: "8px 20px", borderRadius: 6,
              border: `1px solid ${cardBorder}`,
            }}>
              <Download style={{ width: 12, height: 12 }} />
              Download Invitation (PDF)
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: cardBorder, margin: "0 20px 14px" }} />

        {/* RSVP form card */}
        <div style={{
          margin: "0 16px 20px",
          background: cardBg, border: `1px solid ${cardBorder}`,
          borderRadius: 12, padding: "16px 18px", overflow: "hidden",
        }}>
          {/* Accent top bar */}
          <div style={{
            height: 4, background: accent,
            margin: "-16px -18px 14px",
          }} />

          <p style={{
            fontFamily: bodyFont, fontSize: 11 * sc, color: textMuted,
            textAlign: "center", marginBottom: 14,
          }}>
            Dear <span style={{ color: textColor, fontWeight: 600 }}>{guestName}</span>, will you be joining us?
          </p>

          {/* Accept / Decline */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div style={{
              borderRadius: 10, border: `2px solid ${accent}`,
              background: `${accent}22`, padding: "14px 8px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            }}>
              <CheckCircle2 style={{ width: 22, height: 22, color: accent }} />
              <span style={{ fontFamily: bodyFont, fontSize: 10 * sc, fontWeight: 600, color: accent }}>
                Joyfully Accepts
              </span>
            </div>
            <div style={{
              borderRadius: 10, border: `2px solid ${cardBorder}`,
              background: cardBg, padding: "14px 8px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            }}>
              <XCircle style={{ width: 22, height: 22, color: textFaint }} />
              <span style={{ fontFamily: bodyFont, fontSize: 10 * sc, fontWeight: 600, color: textMuted }}>
                Declines with Regrets
              </span>
            </div>
          </div>

          {/* Meal select placeholder */}
          <div style={{
            background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 8,
            padding: "10px 14px", marginBottom: 10,
          }}>
            <p style={{ fontFamily: bodyFont, fontSize: 9 * sc, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: textFaint, marginBottom: 4 }}>Meal Preference</p>
            <p style={{ fontFamily: bodyFont, fontSize: 11 * sc, color: textMuted }}>Select an option…</p>
          </div>

          {/* Submit button */}
          <div style={{
            background: accent, borderRadius: 8, padding: "12px",
            textAlign: "center",
          }}>
            <span style={{ fontFamily: bodyFont, fontSize: 11 * sc, fontWeight: 700, color: accentText }}>
              Submit RSVP
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
