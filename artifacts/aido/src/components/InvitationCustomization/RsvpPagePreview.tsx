import { useRef } from "react";
import { CheckCircle2, XCircle, Heart, MapPin, Download } from "lucide-react";
import { AuthMediaImage } from "@/components/AuthMediaImage";
import type { ColorPalette } from "@/types/invitations";
import type { PhotoPosition } from "@/components/InvitationCustomization/AiPreviewComponents";

interface RsvpPagePreviewProps {
  colors: ColorPalette;
  font: string | null;
  backgroundColor: string | null;
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
  const bg = backgroundColor || "#2D1B5E";
  const accent = colors.accent || colors.primary || "#D4A017";
  const isLight = isLightColor(bg);
  const textColor = isLight ? "#1a1a1a" : "#ffffff";
  const textMuted = isLight ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)";
  const textFaint = isLight ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.35)";
  const cardBg = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const cardBorder = isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)";
  const accentText = isLightColor(accent) ? "#1a1a1a" : "#ffffff";
  const couple = [partner1Name, partner2Name].filter(Boolean).join(" & ") || "The Couple";
  const dateStr = weddingDate ? formatDate(weddingDate) : "Wedding Day";
  const coupleFont = font
    ? `'${font}', 'Cormorant Garamond', Georgia, serif`
    : "'Cormorant Garamond', 'Playfair Display', Georgia, serif";

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
    panRef.current = { sx: e.clientX, sy: e.clientY, ox: photoPosition.x, oy: photoPosition.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePhotoPanMove = (e: React.PointerEvent) => {
    if (!panRef.current || !onPhotoPositionChange) return;
    const dx = e.clientX - panRef.current.sx;
    const dy = e.clientY - panRef.current.sy;
    onPhotoPositionChange({
      x: Math.max(0, Math.min(100, panRef.current.ox - dx * 0.35)),
      y: Math.max(0, Math.min(100, panRef.current.oy - dy * 0.35)),
    });
  };

  const handlePhotoPanUp = () => { panRef.current = null; };

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
            style={{ padding: "0 20px 12px", cursor: onPhotoPositionChange ? "grab" : undefined }}
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
            fontFamily: jakarta, fontSize: 9, fontWeight: 600,
            letterSpacing: "0.4em", textTransform: "uppercase",
            color: accent, marginBottom: 10,
          }}>Wedding RSVP</p>

          {/* Couple names — gold */}
          <h1 style={{
            fontFamily: coupleFont,
            fontSize: 34, fontWeight: 400, fontStyle: "italic",
            color: accent, lineHeight: 1.15, letterSpacing: "0.02em",
            marginBottom: 8,
          }}>{couple}</h1>

          {/* Date — white */}
          <p style={{
            fontFamily: jakarta, fontSize: 10, letterSpacing: "0.1em",
            textTransform: "uppercase", color: textColor, marginBottom: 8,
          }}>{dateStr}</p>

          {/* Venue — gold; address — white; times — gold */}
          {(venue || venueAddress || cityStateZip || timesLine) && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              {venue && (
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <MapPin style={{ width: 12, height: 12, color: accent }} />
                  <p style={{ fontFamily: coupleFont, fontSize: 16, fontWeight: 500, color: accent }}>{venue}</p>
                </div>
              )}
              {venueAddress && (
                <p style={{ fontFamily: jakarta, fontSize: 10, color: textColor }}>{venueAddress}</p>
              )}
              {cityStateZip && (
                <p style={{ fontFamily: jakarta, fontSize: 10, color: textColor }}>{cityStateZip}</p>
              )}
              {timesLine && (
                <p style={{ fontFamily: jakarta, fontSize: 10, color: accent, marginTop: 3 }}>{timesLine}</p>
              )}
            </div>
          )}

          {/* Invitation message — white */}
          {invitationMessage && (
            <p style={{
              fontFamily: coupleFont, fontSize: 15, fontStyle: "italic",
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
              fontFamily: jakarta, fontSize: 10, fontWeight: 600,
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
            fontFamily: jakarta, fontSize: 11, color: textMuted,
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
              <span style={{ fontFamily: jakarta, fontSize: 10, fontWeight: 600, color: accent }}>
                Joyfully Accepts
              </span>
            </div>
            <div style={{
              borderRadius: 10, border: `2px solid ${cardBorder}`,
              background: cardBg, padding: "14px 8px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            }}>
              <XCircle style={{ width: 22, height: 22, color: textFaint }} />
              <span style={{ fontFamily: jakarta, fontSize: 10, fontWeight: 600, color: textMuted }}>
                Declines with Regrets
              </span>
            </div>
          </div>

          {/* Meal select placeholder */}
          <div style={{
            background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 8,
            padding: "10px 14px", marginBottom: 10,
          }}>
            <p style={{ fontFamily: jakarta, fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: textFaint, marginBottom: 4 }}>Meal Preference</p>
            <p style={{ fontFamily: jakarta, fontSize: 11, color: textMuted }}>Select an option…</p>
          </div>

          {/* Submit button */}
          <div style={{
            background: accent, borderRadius: 8, padding: "12px",
            textAlign: "center",
          }}>
            <span style={{ fontFamily: jakarta, fontSize: 11, fontWeight: 700, color: accentText }}>
              Submit RSVP
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
