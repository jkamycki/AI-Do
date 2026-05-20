import { forwardRef } from "react";
import { Calendar, Heart, MapPin, QrCode } from "lucide-react";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import type { InvitationDesignDocument } from "@/lib/invitationDesignModel";
import { qrSvgDataUrl } from "@/lib/localQr";

export type PrintInvitationSize = "5x7" | "4x6";
export type PrintInvitationSide = "front" | "back";

const PRINT_SIZES: Record<PrintInvitationSize, { label: string; width: number; height: number }> = {
  "5x7": { label: "5 x 7 in", width: 500, height: 700 },
  "4x6": { label: "4 x 6 in", width: 420, height: 630 },
};

function formatDate(date: string | null): string {
  if (!date) return "Wedding date";
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(date: string | null): string {
  if (!date) return "";
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(value: string | null): string {
  if (!value) return "";
  const [hourRaw, minuteRaw = "0"] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function locationLines(design: InvitationDesignDocument): string[] {
  return [
    design.fields.venue,
    design.fields.venueAddress,
    [design.fields.venueCity, [design.fields.venueState, design.fields.venueZip].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", "),
  ].filter(Boolean);
}

function RealQrCode({ url, accent }: { url: string; accent: string }) {
  return (
    <div
      aria-label="RSVP QR code"
      style={{
        width: 126,
        height: 126,
        padding: 8,
        background: "#fff",
        border: `1px solid ${accent}55`,
      }}
    >
      <img
        src={qrSvgDataUrl(url)}
        alt="Scan to RSVP"
        style={{ display: "block", width: "100%", height: "100%" }}
      />
    </div>
  );
}

function PrintMarketingFooter({ accent, text }: { accent: string; text: string }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 42,
        right: 42,
        bottom: 22,
        zIndex: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingTop: 6,
        borderTop: `1px solid ${accent}33`,
        fontFamily: "'Plus Jakarta Sans', Arial, sans-serif",
        fontSize: 8.5,
        lineHeight: 1.2,
        color: text,
        background: "transparent",
      }}
    >
      <img src="/logo.png" alt="A.IDO" style={{ height: 18, width: "auto", objectFit: "contain", display: "block" }} />
      <span>
        Planning your own wedding? <strong style={{ color: accent }}>Try A.IDO</strong> | aidowedding.net
      </span>
    </div>
  );
}

interface PrintInvitationPreviewProps {
  design: InvitationDesignDocument;
  size: PrintInvitationSize;
  side: PrintInvitationSide;
  includeQr: boolean;
  websiteUrl: string | null;
}

export const PrintInvitationPreview = forwardRef<HTMLDivElement, PrintInvitationPreviewProps>(
  ({ design, size, side, includeQr, websiteUrl }, ref) => {
    const spec = PRINT_SIZES[size];
    const photoUrl = resolveMediaUrl(design.image.url);
    const hasPhoto = !!photoUrl;
    const photoZoom = Math.max(0.5, Math.min(2.5, design.image.zoom ?? 1));
    const photoBackgroundSize = photoZoom < 1 ? "contain" : photoZoom === 1 ? "cover" : `${100 * photoZoom}%`;
    const locLines = locationLines(design);
    const isSaveTheDate = design.kind === "saveTheDate";
    const saveTheDateLocation = [design.fields.venueCity, design.fields.venueState].filter(Boolean).join(", ");
    const bg = design.style.backgroundColor || "#f8f4ef";
    const accent = design.style.accentColor || "#8D294D";
    const text = design.style.textColor || "#1f2933";
    const font = `'${design.style.fontFamily || "Playfair Display"}', Georgia, serif`;
    const sans = "'Plus Jakarta Sans', Arial, sans-serif";
    const qrUrl = websiteUrl || "";
    const dotPattern = `radial-gradient(${accent}22 1px, transparent 1px)`;
    const aiPrint = design.designMode === "ai";
    const timeLines = [
      design.fields.ceremonyTime && `Ceremony ${formatTime(design.fields.ceremonyTime)}`,
      design.fields.receptionTime && `Reception ${formatTime(design.fields.receptionTime)}`,
    ].filter((line): line is string => Boolean(line));
    const rsvpDate = formatShortDate(design.fields.rsvpByDate);

    return (
      <div
        ref={ref}
        style={{
          width: spec.width,
          aspectRatio: `${spec.width} / ${spec.height}`,
          maxWidth: "100%",
          background: bg,
          color: text,
          border: "1px solid rgba(0,0,0,0.12)",
          boxShadow: "0 24px 70px rgba(15, 23, 42, 0.18)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 18,
            border: `1px solid ${accent}55`,
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 34,
            border: "1px dashed rgba(0,0,0,0.22)",
            pointerEvents: "none",
          }}
        />

        {side === "front" && aiPrint ? (
          <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", textAlign: "center", backgroundImage: dotPattern, backgroundSize: "22px 22px" }}>
            <div style={{ padding: "28px 34px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              {!isSaveTheDate && (
                <div style={{ width: 46, height: 46, borderRadius: "50%", margin: "0 auto 8px", background: `${accent}22`, boxShadow: `0 0 0 1px ${accent}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Heart style={{ width: 20, height: 20, color: accent, fill: accent }} />
                </div>
              )}
              <p style={{ margin: 0, fontFamily: sans, fontSize: 11, letterSpacing: "0.36em", textTransform: "uppercase", color: accent, fontWeight: 700 }}>
                {isSaveTheDate ? "Save the Date" : "Wedding RSVP"}
              </p>
              <h2 style={{ margin: "10px 0 0", fontFamily: font, fontSize: size === "5x7" ? 38 : 32, lineHeight: 1.12, fontStyle: "italic", fontWeight: 400, color: accent }}>
                {design.couple}
              </h2>
              {hasPhoto && (
                <div
                  style={{
                    height: isSaveTheDate ? "40%" : "36%",
                    margin: "16px 0 14px",
                    backgroundImage: `url("${photoUrl}")`,
                    backgroundSize: photoBackgroundSize,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: `${design.image.position.x}% ${design.image.position.y}%`,
                    borderRadius: 8,
                    boxShadow: "0 6px 30px rgba(0,0,0,0.5)",
                  }}
                />
              )}
              <div style={{ width: "82%", height: 1, background: "rgba(255,255,255,0.12)", margin: "0 auto 14px" }} />
              <p style={{ margin: 0, fontFamily: sans, fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, color: text }}>
                {formatDate(design.fields.weddingDate)}
              </p>
              {isSaveTheDate && saveTheDateLocation && (
                <p style={{ margin: "6px 0 0", fontFamily: sans, fontSize: 11, color: text }}>
                  {saveTheDateLocation}
                </p>
              )}
              {!isSaveTheDate && (locLines.length > 0 || timeLines.length > 0 || rsvpDate) && (
                <div style={{ margin: "12px auto 0", padding: "10px 12px", width: "100%", borderTop: `1px solid ${accent}55`, borderBottom: `1px solid ${accent}55`, background: "rgba(255,255,255,0.035)" }}>
                  {design.fields.venue && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <MapPin style={{ width: 13, height: 13, color: accent, flexShrink: 0 }} />
                      <p style={{ margin: 0, fontFamily: font, fontSize: 17, lineHeight: 1.2, fontWeight: 600, color: accent }}>
                        {design.fields.venue}
                      </p>
                    </div>
                  )}
                  {(design.fields.venueAddress || locLines[2]) && (
                    <div style={{ marginTop: design.fields.venue ? 6 : 0, fontFamily: sans, fontSize: 9, lineHeight: 1.35, letterSpacing: "0.04em", textTransform: "uppercase", color: text }}>
                      {design.fields.venueAddress && <p style={{ margin: 0 }}>{design.fields.venueAddress}</p>}
                      {locLines[2] && <p style={{ margin: "2px 0 0", opacity: 0.7 }}>{locLines[2]}</p>}
                    </div>
                  )}
                  {timeLines.length > 0 && (
                    <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
                      {timeLines.map((line) => (
                        <span key={line} style={{ border: `1px solid ${accent}66`, borderRadius: 999, padding: "4px 7px", fontFamily: sans, fontSize: 7.6, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: accent }}>
                          {line}
                        </span>
                      ))}
                    </div>
                  )}
                  {rsvpDate && (
                    <div style={{ marginTop: 9 }}>
                      <span style={{ display: "inline-block", background: accent, color: bg, borderRadius: 6, padding: "6px 9px", fontFamily: sans, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                        RSVP By {rsvpDate}
                      </span>
                    </div>
                  )}
                </div>
              )}
              {design.message && (
                <p style={{ margin: "14px auto 0", maxWidth: 340, fontFamily: font, fontSize: isSaveTheDate ? 15 : 13.5, lineHeight: 1.55, fontStyle: "italic", color: text }}>
                  &ldquo;{design.message}&rdquo;
                </p>
              )}
              {isSaveTheDate && (
                <p style={{ margin: "12px 0 0", fontFamily: font, fontSize: 13, fontStyle: "italic", color: "rgba(255,255,255,0.58)" }}>
                  Formal invitation to follow
                </p>
              )}
            </div>
          </div>
        ) : side === "front" ? (
          <div style={{ position: "relative", height: "100%", padding: 48, display: "flex", flexDirection: "column", textAlign: "center" }}>
            {hasPhoto && (
              <div
                style={{
                  height: isSaveTheDate ? "49%" : "48%",
                  marginBottom: isSaveTheDate ? 22 : 18,
                  backgroundImage: `url("${photoUrl}")`,
                  backgroundSize: photoBackgroundSize,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: `${design.image.position.x}% ${design.image.position.y}%`,
                  border: `1px solid ${accent}66`,
                }}
              />
            )}
            <div style={{ margin: "auto 0" }}>
              <p style={{ margin: 0, fontFamily: sans, fontSize: 12, letterSpacing: "0.28em", textTransform: "uppercase", color: accent, fontWeight: 700 }}>
                {isSaveTheDate ? "Save the Date" : "The Wedding Celebration of"}
              </p>
              <h2 style={{ margin: "18px 0 0", fontFamily: font, fontSize: size === "5x7" ? 52 : 44, lineHeight: 1.08, fontStyle: "italic", fontWeight: 400, color: accent }}>
                {design.couple}
              </h2>
              <div style={{ width: 84, height: 1, background: accent, margin: "24px auto" }} />
              <p style={{ margin: 0, fontFamily: sans, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>
                {formatDate(design.fields.weddingDate)}
              </p>
              {isSaveTheDate && saveTheDateLocation && (
                <div style={{ margin: "16px auto 0", maxWidth: 360, fontFamily: font, fontSize: 20, lineHeight: 1.4 }}>
                  <p style={{ margin: 0 }}>{saveTheDateLocation}</p>
                </div>
              )}
              {!isSaveTheDate && (locLines.length > 0 || timeLines.length > 0 || rsvpDate) && (
                <div style={{ margin: "18px auto 0", maxWidth: 360, padding: "14px 16px", borderTop: `1px solid ${accent}55`, borderBottom: `1px solid ${accent}55`, background: "rgba(255,255,255,0.42)" }}>
                  {design.fields.venue && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                      <MapPin style={{ width: 15, height: 15, color: accent, flexShrink: 0 }} />
                      <p style={{ margin: 0, fontFamily: font, fontSize: 22, lineHeight: 1.2, fontWeight: 600, color: accent }}>
                        {design.fields.venue}
                      </p>
                    </div>
                  )}
                  {(design.fields.venueAddress || locLines[2]) && (
                    <div style={{ marginTop: design.fields.venue ? 8 : 0, fontFamily: sans, fontSize: 10.5, lineHeight: 1.45, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                      {design.fields.venueAddress && <p style={{ margin: 0 }}>{design.fields.venueAddress}</p>}
                      {locLines[2] && <p style={{ margin: "2px 0 0", opacity: 0.72 }}>{locLines[2]}</p>}
                    </div>
                  )}
                  {timeLines.length > 0 && (
                    <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 7, marginTop: 11 }}>
                      {timeLines.map((line) => (
                        <span key={line} style={{ border: `1px solid ${accent}66`, borderRadius: 999, padding: "5px 9px", fontFamily: sans, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: accent }}>
                          {line}
                        </span>
                      ))}
                    </div>
                  )}
                  {rsvpDate && (
                    <div style={{ marginTop: 12 }}>
                      <span style={{ display: "inline-block", background: accent, color: "#fff", borderRadius: 6, padding: "7px 11px", fontFamily: sans, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                        RSVP By {rsvpDate}
                      </span>
                    </div>
                  )}
                </div>
              )}
              {design.message && (
                <p style={{ margin: "22px auto 0", maxWidth: 360, fontFamily: font, fontSize: 17, lineHeight: 1.55, fontStyle: "italic" }}>
                  {design.message}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div style={{ position: "relative", height: "100%", padding: 54, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            <QrCode style={{ width: 34, height: 34, color: accent }} />
            <p style={{ margin: "18px 0 0", fontFamily: sans, fontSize: 12, letterSpacing: "0.24em", textTransform: "uppercase", color: accent, fontWeight: 700 }}>
              RSVP Online
            </p>
            <h2 style={{ margin: "14px 0 0", fontFamily: font, fontSize: 38, lineHeight: 1.12, fontStyle: "italic", fontWeight: 400 }}>
              We hope to celebrate with you
            </h2>
            {includeQr && websiteUrl && (
              <div style={{ marginTop: 28 }}>
                <RealQrCode url={websiteUrl} accent={accent} />
              </div>
            )}
            {includeQr && !websiteUrl && (
              <div
                style={{
                  marginTop: 28,
                  padding: "16px 18px",
                  maxWidth: 250,
                  border: `1px dashed ${accent}66`,
                  fontFamily: sans,
                  fontSize: 11,
                  lineHeight: 1.5,
                  color: text,
                }}
              >
                Publish your wedding website to automatically add a scannable RSVP QR code.
              </div>
            )}
            <p style={{ margin: "24px auto 0", maxWidth: 330, fontFamily: sans, fontSize: 12, lineHeight: 1.6 }}>
              {websiteUrl ? "Use the link below to RSVP and see wedding details." : "Publish your wedding website to turn this into a live RSVP link."}
            </p>
            <p style={{ margin: "12px auto 0", maxWidth: 330, fontFamily: sans, fontSize: 11, lineHeight: 1.5, wordBreak: "break-word", color: accent }}>
              {qrUrl}
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 24, fontFamily: sans, fontSize: 11, color: text }}>
              <Calendar style={{ width: 13, height: 13, color: accent }} />
              <span>{formatDate(design.fields.weddingDate)}</span>
            </div>
            {locLines.length > 0 && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", justifyContent: "center", marginTop: 10, fontFamily: sans, fontSize: 11, lineHeight: 1.45, color: text }}>
                <MapPin style={{ width: 13, height: 13, color: accent }} />
                <span>
                  {locLines.map((line) => (
                    <span key={line} style={{ display: "block" }}>
                      {line}
                    </span>
                  ))}
                </span>
              </div>
            )}
          </div>
        )}
        <PrintMarketingFooter accent={accent} text={text} />
      </div>
    );
  },
);

PrintInvitationPreview.displayName = "PrintInvitationPreview";

export { PRINT_SIZES };
