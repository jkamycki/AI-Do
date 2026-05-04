import { Heart, Mail, MapPin, Download } from "lucide-react";
import type { ColorPalette } from "@/types/invitations";

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

// ── A.IDO brand palette — matches the RSVP Page preview exactly ───────────────
const BG        = "#1E1A2E";
const GOLD      = "#D4A017";
const WHITE     = "#ffffff";
const MUTED     = "rgba(255,255,255,0.58)";
const FAINT     = "rgba(255,255,255,0.32)";
const CARD_BG   = "rgba(255,255,255,0.06)";
const CARD_BDR  = "rgba(255,255,255,0.12)";
const DOT_PAT   = `radial-gradient(${GOLD}22 1px, transparent 1px)`;

const cormorant = "'Cormorant Garamond', 'Playfair Display', Georgia, serif";
const jakarta   = "'Plus Jakarta Sans', system-ui, sans-serif";

function formatTime(t: string | null | undefined): string | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return t;
  const ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ap}`;
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

// ── Shared badge circle (matches RSVP page heart circle) ─────────────────────
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      width: 52, height: 52, borderRadius: "50%", margin: "0 auto",
      background: `${GOLD}22`, boxShadow: `0 0 0 1px ${GOLD}44`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {children}
    </div>
  );
}

// ── Shared wrapper: dark bg + dots + logo ─────────────────────────────────────
function CardShell({ children, photoUrl }: { children: React.ReactNode; photoUrl?: string | null }) {
  const hasPhoto = isPhotoComplete(photoUrl);
  return (
    <div
      className="rounded-xl overflow-hidden shadow-2xl max-w-sm mx-auto border"
      style={{ background: BG, borderColor: CARD_BDR }}
    >
      {/* A.IDO logo */}
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 20, paddingBottom: 4,
                    backgroundImage: DOT_PAT, backgroundSize: "22px 22px" }}>
        <img src="/logo.png" alt="A.IDO" style={{ height: 48, width: "auto", objectFit: "contain" }} />
      </div>

      {/* Optional photo */}
      {hasPhoto && (
        <div style={{ padding: "0 20px 10px", backgroundImage: DOT_PAT, backgroundSize: "22px 22px" }}>
          <img
            src={photoUrl!}
            alt="Wedding photo"
            style={{ width: "100%", height: 130, objectFit: "cover", borderRadius: 8,
                     display: "block", boxShadow: "0 6px 30px rgba(0,0,0,0.5)" }}
          />
        </div>
      )}

      {/* Main content area */}
      <div style={{
        backgroundImage: DOT_PAT,
        backgroundSize: "22px 22px",
        backgroundColor: BG,
        padding: "16px 24px 28px",
        textAlign: "center",
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
}: {
  profile: WeddingInfo;
  palette: ColorPalette;
  photoUrl?: string | null;
}) {
  const couple   = [profile.partner1Name, profile.partner2Name].filter(Boolean).join(" & ") || "The Couple";
  const dateStr  = formatDate(profile.weddingDate, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const cityLine = [
    profile.venueCity,
    [profile.venueState, profile.venueZip].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ");
  const timesLine = [
    formatTime(profile.ceremonyTime)  && `Ceremony ${formatTime(profile.ceremonyTime)}`,
    formatTime(profile.receptionTime) && `Reception ${formatTime(profile.receptionTime)}`,
  ].filter(Boolean).join(" · ");

  return (
    <CardShell photoUrl={photoUrl}>
      {/* Mail badge */}
      <Badge><Mail style={{ width: 22, height: 22, color: GOLD }} /></Badge>

      {/* Label */}
      <p style={{ fontFamily: jakarta, fontSize: 11, fontWeight: 700,
                  letterSpacing: "0.42em", textTransform: "uppercase",
                  color: GOLD, marginTop: 12, marginBottom: 0 }}>
        Save the Date
      </p>

      {/* Couple names — gold italic serif */}
      <h2 style={{ fontFamily: cormorant, fontSize: "2.1rem", fontWeight: 400,
                   fontStyle: "italic", color: GOLD, lineHeight: 1.2,
                   margin: "8px 0 0", letterSpacing: "0.02em" }}>
        {couple}
      </h2>

      {/* Divider */}
      <div style={{ height: 1, background: CARD_BDR, margin: "14px 16px" }} />

      {/* Date — white uppercase */}
      {dateStr && (
        <p style={{ fontFamily: jakarta, fontSize: 10, fontWeight: 600,
                    letterSpacing: "0.12em", textTransform: "uppercase",
                    color: WHITE, marginBottom: 10 }}>
          {dateStr}
        </p>
      )}

      {/* Venue — gold with pin */}
      {profile.venue && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 4 }}>
          <MapPin style={{ width: 12, height: 12, color: GOLD, flexShrink: 0 }} />
          <p style={{ fontFamily: cormorant, fontSize: "1rem", fontWeight: 500, color: GOLD, margin: 0 }}>
            {profile.venue}
          </p>
        </div>
      )}

      {/* Address — white */}
      {profile.venueAddress && (
        <p style={{ fontFamily: jakarta, fontSize: 10, color: WHITE, margin: "2px 0 0" }}>
          {profile.venueAddress}
        </p>
      )}
      {cityLine && (
        <p style={{ fontFamily: jakarta, fontSize: 10, color: WHITE, margin: "1px 0 0" }}>
          {cityLine}
        </p>
      )}

      {/* Times — gold */}
      {timesLine && (
        <p style={{ fontFamily: jakarta, fontSize: 10, color: GOLD, margin: "6px 0 0" }}>
          {timesLine}
        </p>
      )}

      {/* Message — white italic */}
      {profile.saveTheDateMessage && (
        <p style={{ fontFamily: cormorant, fontSize: "0.95rem", fontStyle: "italic",
                    color: WHITE, lineHeight: 1.7, margin: "14px 0 0" }}>
          &ldquo;{profile.saveTheDateMessage}&rdquo;
        </p>
      )}

      {/* "Formal invitation to follow" */}
      <p style={{ fontFamily: cormorant, fontSize: 12, fontStyle: "italic",
                  color: MUTED, margin: "12px 0 0", letterSpacing: "0.3px" }}>
        Formal invitation to follow
      </p>

      {/* Download CTA */}
      <div style={{ marginTop: 16 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: CARD_BG, border: `1px solid ${CARD_BDR}`,
          color: MUTED, fontFamily: jakarta, fontSize: 10,
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
}: {
  profile: WeddingInfo;
  palette: ColorPalette;
  photoUrl?: string | null;
}) {
  const couple   = [profile.partner1Name, profile.partner2Name].filter(Boolean).join(" & ") || "The Couple";
  const dateStr  = formatDate(profile.weddingDate, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const cityLine = [
    profile.venueCity,
    [profile.venueState, profile.venueZip].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ");
  const timesLine = [
    formatTime(profile.ceremonyTime)  && `Ceremony ${formatTime(profile.ceremonyTime)}`,
    formatTime(profile.receptionTime) && `Reception ${formatTime(profile.receptionTime)}`,
  ].filter(Boolean).join(" · ");

  return (
    <CardShell photoUrl={photoUrl}>
      {/* Heart badge — matches RSVP page exactly */}
      <Badge><Heart style={{ width: 22, height: 22, color: GOLD, fill: GOLD }} /></Badge>

      {/* Label */}
      <p style={{ fontFamily: jakarta, fontSize: 11, fontWeight: 700,
                  letterSpacing: "0.42em", textTransform: "uppercase",
                  color: GOLD, marginTop: 12, marginBottom: 0 }}>
        Wedding RSVP
      </p>

      {/* Couple names — gold italic serif */}
      <h2 style={{ fontFamily: cormorant, fontSize: "2.1rem", fontWeight: 400,
                   fontStyle: "italic", color: GOLD, lineHeight: 1.2,
                   margin: "8px 0 0", letterSpacing: "0.02em" }}>
        {couple}
      </h2>

      {/* Date — white uppercase */}
      {dateStr && (
        <p style={{ fontFamily: jakarta, fontSize: 10, fontWeight: 600,
                    letterSpacing: "0.12em", textTransform: "uppercase",
                    color: WHITE, margin: "12px 0 0" }}>
          {dateStr}
        </p>
      )}

      {/* Venue — gold with pin */}
      {profile.venue && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 10 }}>
          <MapPin style={{ width: 12, height: 12, color: GOLD, flexShrink: 0 }} />
          <p style={{ fontFamily: cormorant, fontSize: "1rem", fontWeight: 500, color: GOLD, margin: 0 }}>
            {profile.venue}
          </p>
        </div>
      )}

      {/* Address — white */}
      {profile.venueAddress && (
        <p style={{ fontFamily: jakarta, fontSize: 10, color: WHITE, margin: "4px 0 0" }}>
          {profile.venueAddress}
        </p>
      )}
      {cityLine && (
        <p style={{ fontFamily: jakarta, fontSize: 10, color: WHITE, margin: "2px 0 0" }}>
          {cityLine}
        </p>
      )}

      {/* Times — gold */}
      {timesLine && (
        <p style={{ fontFamily: jakarta, fontSize: 10, color: GOLD, margin: "6px 0 0" }}>
          {timesLine}
        </p>
      )}

      {/* Message — white italic */}
      {profile.invitationMessage && (
        <p style={{ fontFamily: cormorant, fontSize: "0.95rem", fontStyle: "italic",
                    color: WHITE, lineHeight: 1.7, margin: "14px 0 0" }}>
          &ldquo;{profile.invitationMessage}&rdquo;
        </p>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: CARD_BDR, margin: "16px 8px" }} />

      {/* RSVP Now button — gold, full width */}
      <div style={{
        background: GOLD, borderRadius: 8, padding: "12px",
        textAlign: "center",
      }}>
        <span style={{ fontFamily: jakarta, fontSize: 12, fontWeight: 700,
                       letterSpacing: "0.12em", textTransform: "uppercase", color: "#1E1A2E" }}>
          RSVP Now
        </span>
      </div>
    </CardShell>
  );
}
