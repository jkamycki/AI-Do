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

// ── Color palette matching the RSVP Page preview card (light / elegant) ───────
const CARD_BG      = "#ffffff";
const CARD_DOTS    = "radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)";
const GOLD         = "#D4A017";
const GOLD_LIGHT   = "#f5e6b0";
const DARK         = "#1a1425";           // couple names — deep dark
const BODY         = "#3a3350";           // venue, body text
const MUTED        = "#8b82a0";           // secondary / date
const DIVIDER      = "rgba(0,0,0,0.08)";

const cormorant = "'Cormorant Garamond', 'Playfair Display', Georgia, serif";
const jakarta   = "'Plus Jakarta Sans', system-ui, sans-serif";

function formatTime(timeStr: string | null | undefined): string | null {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return timeStr;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatWeddingDate(dateStr: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string | null {
  if (!dateStr) return null;
  const [y, mo, d] = dateStr.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("en-US", opts ?? {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

export function isPhotoComplete(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.startsWith("blob:")) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared gold heart badge (matches RSVP page preview icon)
// ─────────────────────────────────────────────────────────────────────────────
function GoldBadge({ icon }: { icon: string }) {
  return (
    <div style={{
      width: 56, height: 56, borderRadius: "50%", margin: "0 auto",
      background: GOLD_LIGHT, display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 22,
    }}>
      {icon}
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
  const couple        = [profile.partner1Name, profile.partner2Name].filter(Boolean).join(" & ") || "The Couple";
  const weddingDateFull = formatWeddingDate(profile.weddingDate, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const weddingDateShort = formatWeddingDate(profile.weddingDate, { year: "numeric", month: "long", day: "numeric" });
  const cityStateZip  = [
    profile.venueCity,
    [profile.venueState, profile.venueZip].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ");
  const ceremonyTimeStr  = formatTime(profile.ceremonyTime);
  const receptionTimeStr = formatTime(profile.receptionTime);
  const timesLine = [
    ceremonyTimeStr  && `Ceremony ${ceremonyTimeStr}`,
    receptionTimeStr && `Reception ${receptionTimeStr}`,
  ].filter(Boolean).join(" · ");
  const hasPhoto = isPhotoComplete(photoUrl);

  return (
    <div
      className="rounded-xl overflow-hidden shadow-lg max-w-md mx-auto border"
      style={{ background: CARD_BG, borderColor: DIVIDER }}
    >
      {/* Gold top accent bar */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${GOLD}, #f0c842, ${GOLD})` }} />

      {hasPhoto && (
        <div style={{ height: 180, overflow: "hidden" }}>
          <img src={photoUrl!} alt="Wedding photo" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Card body — dot pattern background matching RSVP page */}
      <div style={{
        background: `${CARD_DOTS} 0 0 / 16px 16px, ${CARD_BG}`,
        padding: "32px 32px 28px",
        textAlign: "center",
      }}>
        {/* Badge */}
        <GoldBadge icon="💌" />

        {/* "SAVE THE DATE" label — gold, uppercase spaced */}
        <p style={{
          fontFamily: jakarta,
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.45em",
          textTransform: "uppercase",
          color: GOLD,
          marginTop: 16,
        }}>
          Save the Date
        </p>

        {/* Couple names — dark, large serif italic */}
        <h2 style={{
          fontFamily: cormorant,
          fontSize: "2.4rem",
          fontWeight: 400,
          fontStyle: "italic",
          color: DARK,
          lineHeight: 1.2,
          margin: "10px 0 0",
        }}>
          {couple}
        </h2>

        {/* Divider */}
        <div style={{ height: 1, background: DIVIDER, margin: "16px 24px" }} />

        {/* Date — muted uppercase */}
        {(weddingDateFull || weddingDateShort) && (
          <p style={{
            fontFamily: jakarta,
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: MUTED,
          }}>
            {weddingDateFull ?? weddingDateShort}
          </p>
        )}

        {/* Venue */}
        {profile.venue && (
          <p style={{ fontFamily: cormorant, fontSize: "1.1rem", color: BODY, marginTop: 10, fontWeight: 500 }}>
            <span style={{ color: GOLD, marginRight: 4 }}>📍</span>
            {profile.venue}
          </p>
        )}

        {/* City / State */}
        {cityStateZip && (
          <p style={{ fontFamily: jakarta, fontSize: "11px", color: MUTED, marginTop: 2 }}>
            {cityStateZip}
          </p>
        )}

        {/* Times */}
        {timesLine && (
          <p style={{ fontFamily: jakarta, fontSize: "11px", color: MUTED, marginTop: 4 }}>
            {timesLine}
          </p>
        )}

        {/* Message */}
        {profile.saveTheDateMessage && (
          <p style={{
            fontFamily: cormorant,
            fontSize: "1.05rem",
            fontStyle: "italic",
            color: BODY,
            lineHeight: 1.7,
            marginTop: 14,
          }}>
            &ldquo;{profile.saveTheDateMessage}&rdquo;
          </p>
        )}

        {/* "Formal invitation to follow" */}
        <p style={{
          fontFamily: cormorant,
          fontSize: "13px",
          fontStyle: "italic",
          letterSpacing: "0.5px",
          color: MUTED,
          marginTop: 14,
        }}>
          Formal invitation to follow
        </p>

        {/* CTA */}
        <div style={{ marginTop: 20 }}>
          <span style={{
            display: "inline-block",
            background: GOLD,
            color: "#fff",
            fontFamily: jakarta,
            fontSize: "11px",
            letterSpacing: "2px",
            textTransform: "uppercase",
            padding: "10px 28px",
            borderRadius: "4px",
            fontWeight: 700,
          }}>
            View &amp; Download
          </span>
        </div>
      </div>

      {/* Gold bottom accent */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${GOLD}, #f0c842, ${GOLD})`, opacity: 0.5 }} />
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
}: {
  profile: WeddingInfo;
  palette: ColorPalette;
  photoUrl?: string | null;
}) {
  const couple         = [profile.partner1Name, profile.partner2Name].filter(Boolean).join(" & ") || "The Couple";
  const weddingDateFull = formatWeddingDate(profile.weddingDate, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const cityStateZip   = [
    profile.venueCity,
    [profile.venueState, profile.venueZip].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ");
  const ceremonyTimeStr  = formatTime(profile.ceremonyTime);
  const receptionTimeStr = formatTime(profile.receptionTime);
  const timesLine = [
    ceremonyTimeStr  && `Ceremony ${ceremonyTimeStr}`,
    receptionTimeStr && `Reception ${receptionTimeStr}`,
  ].filter(Boolean).join(" · ");
  const hasPhoto = isPhotoComplete(photoUrl);

  return (
    <div
      className="rounded-xl overflow-hidden shadow-lg max-w-md mx-auto border"
      style={{ background: CARD_BG, borderColor: DIVIDER }}
    >
      {hasPhoto && (
        <div style={{ height: 180, overflow: "hidden" }}>
          <img src={photoUrl!} alt="Wedding photo" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Card body — dot pattern background matching RSVP page */}
      <div style={{
        background: `${CARD_DOTS} 0 0 / 16px 16px, ${CARD_BG}`,
        padding: "32px 32px 28px",
        textAlign: "center",
      }}>
        {/* Badge */}
        <GoldBadge icon="💛" />

        {/* "WEDDING RSVP" label — gold, uppercase (matching RSVP page exactly) */}
        <p style={{
          fontFamily: jakarta,
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.45em",
          textTransform: "uppercase",
          color: GOLD,
          marginTop: 16,
        }}>
          Wedding RSVP
        </p>

        {/* Couple names — dark, large serif italic */}
        <h2 style={{
          fontFamily: cormorant,
          fontSize: "2.4rem",
          fontWeight: 400,
          fontStyle: "italic",
          color: DARK,
          lineHeight: 1.2,
          margin: "10px 0 0",
        }}>
          {couple}
        </h2>

        {/* Divider */}
        <div style={{ height: 1, background: DIVIDER, margin: "16px 24px" }} />

        {/* Date */}
        {weddingDateFull && (
          <p style={{
            fontFamily: jakarta,
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: MUTED,
          }}>
            {weddingDateFull}
          </p>
        )}

        {/* Venue */}
        {profile.venue && (
          <p style={{ fontFamily: cormorant, fontSize: "1.1rem", color: BODY, marginTop: 10, fontWeight: 500 }}>
            <span style={{ color: GOLD, marginRight: 4 }}>📍</span>
            {profile.venue}
          </p>
        )}

        {/* Address */}
        {profile.venueAddress && (
          <p style={{ fontFamily: jakarta, fontSize: "11px", color: MUTED, marginTop: 2 }}>
            {profile.venueAddress}
          </p>
        )}

        {/* City / State */}
        {cityStateZip && (
          <p style={{ fontFamily: jakarta, fontSize: "11px", color: MUTED, marginTop: 1 }}>
            {cityStateZip}
          </p>
        )}

        {/* Times */}
        {timesLine && (
          <p style={{ fontFamily: jakarta, fontSize: "11px", color: MUTED, marginTop: 4 }}>
            {timesLine}
          </p>
        )}

        {/* Message */}
        {profile.invitationMessage && (
          <p style={{
            fontFamily: cormorant,
            fontSize: "1.05rem",
            fontStyle: "italic",
            color: BODY,
            lineHeight: 1.7,
            marginTop: 14,
          }}>
            &ldquo;{profile.invitationMessage}&rdquo;
          </p>
        )}

        {/* RSVP button — gold */}
        <div style={{ marginTop: 20 }}>
          <span style={{
            display: "inline-block",
            background: GOLD,
            color: "#fff",
            fontFamily: jakarta,
            fontSize: "11px",
            letterSpacing: "2px",
            textTransform: "uppercase",
            padding: "10px 28px",
            borderRadius: "4px",
            fontWeight: 700,
          }}>
            RSVP Now
          </span>
        </div>
      </div>
    </div>
  );
}
