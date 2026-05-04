import { CheckCircle2, XCircle, Heart, MapPin } from "lucide-react";
import type { ColorPalette } from "@/types/invitations";

interface RsvpPagePreviewProps {
  colors: ColorPalette;
  font: string;
  backgroundColor: string | null;
  partner1Name: string;
  partner2Name: string;
  weddingDate: string;
  venue: string;
  photoUrl: string | null;
  guestName?: string;
  /** Render scale — 1.28 fills ~500 px (matches Digital Invitation width). */
  scale?: number;
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

const PREVIEW_W = 390;
const PREVIEW_H = 780;

export function RsvpPagePreview({
  colors,
  font,
  backgroundColor,
  partner1Name,
  partner2Name,
  weddingDate,
  venue,
  photoUrl,
  guestName = "Guest Name",
  scale = 1.28,
}: RsvpPagePreviewProps) {
  const bg = backgroundColor || "#1E1A2E";
  const accent = colors.primary || "#D4A017";
  const isLight = isLightColor(bg);
  const textColor = isLight ? "#1a1a1a" : "#ffffff";
  const textMuted = isLight ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)";
  const textFaint = isLight ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.35)";
  const cardBg = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const cardBorder = isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)";
  const accentText = isLightColor(accent) ? "#1a1a1a" : "#ffffff";
  const couple = [partner1Name, partner2Name].filter(Boolean).join(" & ") || "The Couple";
  const dateStr = weddingDate ? formatDate(weddingDate) : "Wedding Day";
  const jakarta = "'Plus Jakarta Sans', system-ui, sans-serif";

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
          overflowY: "hidden",
          position: "relative",
        }}
      >
        {/* Top invitation card */}
        <div style={{ padding: "28px 28px 16px" }}>
          {/* Photo */}
          {photoUrl && (
            <div style={{ marginBottom: 14 }}>
              <img
                src={photoUrl}
                alt="Wedding"
                style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 10 }}
              />
            </div>
          )}

          {/* Heart icon */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: `${accent}22`, border: `1px solid ${accent}44`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Heart style={{ width: 22, height: 22, color: accent, fill: accent }} />
            </div>
          </div>

          {/* Label */}
          <p style={{
            fontFamily: jakarta, fontSize: 8, fontWeight: 700,
            letterSpacing: "0.4em", textTransform: "uppercase",
            color: accent, textAlign: "center", marginBottom: 6,
          }}>Wedding RSVP</p>

          {/* Couple names */}
          <h1 style={{
            fontFamily: `'${font}', Georgia, serif`,
            fontSize: 28, fontWeight: 400, fontStyle: "italic",
            color: textColor, textAlign: "center", lineHeight: 1.15,
            letterSpacing: "0.02em", marginBottom: 4,
          }}>{couple}</h1>

          {/* Date */}
          <p style={{
            fontFamily: jakarta, fontSize: 9, letterSpacing: "0.1em",
            textTransform: "uppercase", color: textMuted,
            textAlign: "center", marginBottom: 4,
          }}>{dateStr}</p>

          {/* Venue */}
          {venue && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 4, marginBottom: 2 }}>
              <MapPin style={{ width: 10, height: 10, color: accent }} />
              <p style={{ fontFamily: `'${font}', Georgia, serif`, fontSize: 13, color: textMuted }}>{venue}</p>
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ margin: "0 28px 14px", height: 1, background: cardBorder }} />

        {/* RSVP form card */}
        <div style={{ margin: "0 20px", background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 12, padding: "16px 18px" }}>
          {/* Accent bar */}
          <div style={{ height: 3, background: accent, borderRadius: "8px 8px 0 0", margin: "-16px -18px 14px" }} />

          <p style={{ fontFamily: jakarta, fontSize: 11, color: textMuted, textAlign: "center", marginBottom: 14 }}>
            Dear <span style={{ color: textColor, fontWeight: 600 }}>{guestName}</span>, will you be joining us?
          </p>

          {/* Accept / Decline buttons */}
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

          {/* Submit button */}
          <div style={{
            background: accent, borderRadius: 8, padding: "10px",
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
