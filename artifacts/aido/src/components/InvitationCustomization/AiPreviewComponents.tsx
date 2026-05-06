import type { ReactNode } from "react";
import { Heart, Mail, MapPin, Download } from "lucide-react";
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

export interface CustomColors {
  bg: string;
  accent: string;
  text: string;
  muted: string;
  cardBdr: string;
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
  children,
  photoUrl,
  photoPosition = { x: 50, y: 50 },
  customColors,
}: {
  children: ReactNode;
  photoUrl?: string | null;
  photoPosition?: PhotoPosition;
  customColors?: CustomColors;
}) {
  const bg      = customColors?.bg      ?? BG;
  const accent  = customColors?.accent  ?? GOLD;
  const cardBdr = customColors?.cardBdr ?? CARD_BDR;
  const dotPat  = `radial-gradient(${accent}22 1px, transparent 1px)`;

  const resolvedPhotoUrl = resolveMediaUrl(photoUrl);
  const hasPhoto = isPhotoComplete(resolvedPhotoUrl);
  return (
    <div
      className="rounded-xl overflow-hidden shadow-2xl max-w-sm mx-auto border"
      style={{ background: bg, borderColor: cardBdr }}
    >
      {/* A.IDO logo */}
      <div style={{
        display: "flex", justifyContent: "center",
        paddingTop: 20, paddingBottom: 4,
        backgroundImage: dotPat, backgroundSize: "22px 22px",
      }}>
        <img src="/logo.png" alt="A.IDO" style={{ height: 48, width: "auto", objectFit: "contain" }} />
      </div>

      {/* Optional photo */}
      {hasPhoto && (
        <div style={{ padding: "0 20px 10px", backgroundImage: dotPat, backgroundSize: "22px 22px" }}>
          <AuthMediaImage
            src={photoUrl!}
            alt="Wedding photo"
            style={{
              width: "100%", height: 130, objectFit: "cover", borderRadius: 8,
              display: "block", boxShadow: "0 6px 30px rgba(0,0,0,0.5)",
              objectPosition: `${photoPosition.x}% ${photoPosition.y}%`,
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
  customColors,
}: {
  profile: WeddingInfo;
  palette: ColorPalette;
  photoUrl?: string | null;
  photoPosition?: PhotoPosition;
  customColors?: CustomColors;
}) {
  const accent  = customColors?.accent  ?? GOLD;
  const text    = customColors?.text    ?? WHITE;
  const muted   = customColors?.muted   ?? MUTED;
  const cardBdr = customColors?.cardBdr ?? CARD_BDR;

  const couple    = [profile.partner1Name, profile.partner2Name].filter(Boolean).join(" & ") || "The Couple";
  const dateStr   = formatDate(profile.weddingDate, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const cityLine  = [profile.venueCity, [profile.venueState, profile.venueZip].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  return (
    <CardShell photoUrl={photoUrl} photoPosition={photoPosition} customColors={customColors}>
      <Badge accent={accent}><Mail style={{ width: 22, height: 22, color: accent }} /></Badge>

      <p style={{ fontFamily: jakarta, fontSize: 11, fontWeight: 700,
                  letterSpacing: "0.42em", textTransform: "uppercase",
                  color: accent, marginTop: 12 }}>
        Save the Date
      </p>

      <h2 style={{ fontFamily: cormorant, fontSize: "2.1rem", fontWeight: 400,
                   fontStyle: "italic", color: accent, lineHeight: 1.2, margin: "8px 0 0" }}>
        {couple}
      </h2>

      <div style={{ height: 1, background: cardBdr, margin: "14px 16px" }} />

      {dateStr && (
        <p style={{ fontFamily: jakarta, fontSize: 10, fontWeight: 600,
                    letterSpacing: "0.12em", textTransform: "uppercase", color: text, marginBottom: 10 }}>
          {dateStr}
        </p>
      )}

      {!customColors && profile.venue && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 4 }}>
          <MapPin style={{ width: 12, height: 12, color: accent, flexShrink: 0 }} />
          <p style={{ fontFamily: cormorant, fontSize: "1rem", fontWeight: 500, color: accent, margin: 0 }}>
            {profile.venue}
          </p>
        </div>
      )}

      {!customColors && profile.venueAddress && (
        <p style={{ fontFamily: jakarta, fontSize: 10, color: text, margin: "2px 0 0" }}>
          {profile.venueAddress}
        </p>
      )}
      {!customColors && cityLine && (
        <p style={{ fontFamily: jakarta, fontSize: 10, color: text, margin: "1px 0 0" }}>
          {cityLine}
        </p>
      )}
      {profile.saveTheDateMessage && (
        <p style={{ fontFamily: cormorant, fontSize: "0.95rem", fontStyle: "italic",
                    color: text, lineHeight: 1.7, margin: "14px 0 0" }}>
          &ldquo;{profile.saveTheDateMessage}&rdquo;
        </p>
      )}

      <p style={{ fontFamily: cormorant, fontSize: 12, fontStyle: "italic",
                  color: muted, margin: "12px 0 0" }}>
        Formal invitation to follow
      </p>

      <div style={{ marginTop: 16 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: `${accent}1a`, border: `1px solid ${cardBdr}`,
          color: muted, fontFamily: jakarta, fontSize: 10,
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
  customColors,
}: {
  profile: WeddingInfo;
  palette: ColorPalette;
  photoUrl?: string | null;
  photoPosition?: PhotoPosition;
  customColors?: CustomColors;
}) {
  const bg      = customColors?.bg      ?? BG;
  const accent  = customColors?.accent  ?? GOLD;
  const text    = customColors?.text    ?? WHITE;
  const muted   = customColors?.muted   ?? MUTED;
  const cardBdr = customColors?.cardBdr ?? CARD_BDR;
  const btnText = (accent === GOLD && !customColors) ? bg : (isLightHex(accent) ? "#1a1a1a" : "#ffffff");

  const couple    = [profile.partner1Name, profile.partner2Name].filter(Boolean).join(" & ") || "The Couple";
  const dateStr   = formatDate(profile.weddingDate, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const cityLine  = [profile.venueCity, [profile.venueState, profile.venueZip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const timesLine = [
    formatTime(profile.ceremonyTime)  && `Ceremony ${formatTime(profile.ceremonyTime)}`,
    formatTime(profile.receptionTime) && `Reception ${formatTime(profile.receptionTime)}`,
  ].filter(Boolean).join(" · ");

  return (
    <CardShell photoUrl={photoUrl} photoPosition={photoPosition} customColors={customColors}>
      <Badge accent={accent}><Heart style={{ width: 22, height: 22, color: accent, fill: accent }} /></Badge>

      <p style={{ fontFamily: jakarta, fontSize: 11, fontWeight: 700,
                  letterSpacing: "0.42em", textTransform: "uppercase",
                  color: accent, marginTop: 12 }}>
        Wedding RSVP
      </p>

      <h2 style={{ fontFamily: cormorant, fontSize: "2.1rem", fontWeight: 400,
                   fontStyle: "italic", color: accent, lineHeight: 1.2, margin: "8px 0 0" }}>
        {couple}
      </h2>

      {dateStr && (
        <p style={{ fontFamily: jakarta, fontSize: 10, fontWeight: 600,
                    letterSpacing: "0.12em", textTransform: "uppercase", color: text, margin: "12px 0 0" }}>
          {dateStr}
        </p>
      )}

      {profile.venue && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 10 }}>
          <MapPin style={{ width: 12, height: 12, color: accent, flexShrink: 0 }} />
          <p style={{ fontFamily: cormorant, fontSize: "1rem", fontWeight: 500, color: accent, margin: 0 }}>
            {profile.venue}
          </p>
        </div>
      )}

      {profile.venueAddress && (
        <p style={{ fontFamily: jakarta, fontSize: 10, color: text, margin: "4px 0 0" }}>
          {profile.venueAddress}
        </p>
      )}
      {cityLine && (
        <p style={{ fontFamily: jakarta, fontSize: 10, color: text, margin: "2px 0 0" }}>
          {cityLine}
        </p>
      )}
      {timesLine && (
        <p style={{ fontFamily: jakarta, fontSize: 10, color: accent, margin: "6px 0 0" }}>
          {timesLine}
        </p>
      )}

      {profile.invitationMessage && (
        <p style={{ fontFamily: cormorant, fontSize: "0.95rem", fontStyle: "italic",
                    color: text, lineHeight: 1.7, margin: "14px 0 0" }}>
          &ldquo;{profile.invitationMessage}&rdquo;
        </p>
      )}

      <p style={{ fontFamily: jakarta, fontSize: 11, color: muted, margin: "14px 0 0" }}>
        Dear <span style={{ color: text, fontWeight: 600 }}>Guest</span>, will you be joining us?
      </p>

      <div style={{ height: 1, background: cardBdr, margin: "14px 8px" }} />

      <div style={{ background: accent, borderRadius: 8, padding: "12px", textAlign: "center" }}>
        <span style={{ fontFamily: jakarta, fontSize: 12, fontWeight: 700,
                       letterSpacing: "0.12em", textTransform: "uppercase", color: btnText }}>
          RSVP Now
        </span>
      </div>
    </CardShell>
  );
}
