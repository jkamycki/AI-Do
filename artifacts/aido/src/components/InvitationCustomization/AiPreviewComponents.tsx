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

// ── A.IDO brand palette (fixed for all AI-generated previews) ─────────────────
const BRAND_BG      = "#100b1e";   // deep purple-black (matches app background)
const BRAND_GOLD    = "#D4A017";   // gold accent (matches app CTA / brand)
const BRAND_GOLD_DIM = "rgba(212,160,23,0.55)"; // dimmed gold for dividers
const BRAND_WHITE   = "#ffffff";
const BRAND_MUTED   = "rgba(255,255,255,0.62)";
const BRAND_FAINT   = "rgba(255,255,255,0.35)";
const BRAND_CARD_BG = "rgba(255,255,255,0.05)";
const BRAND_BORDER  = "rgba(255,255,255,0.10)";

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
  const couple         = [profile.partner1Name, profile.partner2Name].filter(Boolean).join(" & ") || "The Couple";
  const weddingDateStr = formatWeddingDate(profile.weddingDate, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const locationLine   = [
    profile.venue,
    profile.venueCity,
    [profile.venueState, profile.venueZip].filter(Boolean).join(" "),
  ].filter(Boolean).join(" · ");
  const ceremonyTimeStr   = formatTime(profile.ceremonyTime);
  const receptionTimeStr  = formatTime(profile.receptionTime);
  const hasPhoto          = isPhotoComplete(photoUrl);

  return (
    <div
      className="rounded-lg overflow-hidden border shadow-xl max-w-md mx-auto"
      style={{ background: BRAND_BG, borderColor: BRAND_BORDER }}
    >
      {/* Gold top bar */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${BRAND_GOLD}, #f0c842, ${BRAND_GOLD})` }} />

      {hasPhoto && (
        <div style={{ height: 200, overflow: "hidden" }}>
          <img src={photoUrl!} alt="Wedding photo" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="p-8 text-center space-y-5">
        {/* "SAVE THE DATE" label */}
        <p style={{ fontFamily: jakarta, fontSize: "11px", fontWeight: 700, letterSpacing: "0.45em", textTransform: "uppercase", color: BRAND_WHITE }}>
          Save the Date
        </p>

        {/* Couple names — gold */}
        <div>
          <h2 style={{ fontFamily: cormorant, fontSize: "2.5rem", fontWeight: 300, color: BRAND_GOLD, lineHeight: 1.2, letterSpacing: "0.5px" }}>
            {couple}
          </h2>
          <div className="mt-3 mx-8 h-px" style={{ background: BRAND_GOLD_DIM }} />
        </div>

        {/* Date — white */}
        {weddingDateStr && (
          <p style={{ fontFamily: cormorant, fontSize: "1.15rem", color: BRAND_WHITE, fontWeight: 400 }}>
            {weddingDateStr}
          </p>
        )}

        {/* Location */}
        {locationLine && (
          <p style={{ fontFamily: jakarta, fontSize: "12px", letterSpacing: "0.5px", color: BRAND_MUTED }}>
            {locationLine}
          </p>
        )}

        {/* Times */}
        {(ceremonyTimeStr || receptionTimeStr) && (
          <p style={{ fontFamily: jakarta, fontSize: "11px", color: BRAND_FAINT, letterSpacing: "0.5px" }}>
            {[ceremonyTimeStr && `Ceremony at ${ceremonyTimeStr}`, receptionTimeStr && `Reception at ${receptionTimeStr}`].filter(Boolean).join(" • ")}
          </p>
        )}

        {/* Personal message */}
        {profile.saveTheDateMessage && (
          <p style={{ fontFamily: cormorant, fontSize: "1.05rem", fontStyle: "italic", color: BRAND_MUTED, lineHeight: 1.7, fontWeight: 300 }}>
            &ldquo;{profile.saveTheDateMessage}&rdquo;
          </p>
        )}

        {/* "Formal invitation to follow" — gold italic */}
        <p style={{ fontFamily: cormorant, fontSize: "13px", fontStyle: "italic", letterSpacing: "1px", color: BRAND_GOLD, fontWeight: 300 }}>
          Formal invitation to follow
        </p>

        {/* CTA button */}
        <div className="pt-1">
          <span style={{
            display: "inline-block",
            background: BRAND_GOLD,
            color: "#0f0b1e",
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

      {/* Gold bottom bar */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${BRAND_GOLD}, #f0c842, ${BRAND_GOLD})`, opacity: 0.6 }} />
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
  const weddingDateStr = formatWeddingDate(profile.weddingDate, { year: "numeric", month: "long", day: "numeric" });
  const ceremonyTimeStr   = formatTime(profile.ceremonyTime);
  const receptionTimeStr  = formatTime(profile.receptionTime);
  const cityStateZip = [
    profile.venueCity,
    [profile.venueState, profile.venueZip].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ");
  const timesLine = [
    ceremonyTimeStr && `Ceremony ${ceremonyTimeStr}`,
    receptionTimeStr && `Reception ${receptionTimeStr}`,
  ].filter(Boolean).join("  •  ");
  const hasPhoto = isPhotoComplete(photoUrl);

  return (
    <div
      className="rounded-lg overflow-hidden border shadow-xl max-w-md mx-auto"
      style={{ background: BRAND_BG, borderColor: BRAND_BORDER }}
    >
      {hasPhoto && (
        <div style={{ height: 200, overflow: "hidden" }}>
          <img src={photoUrl!} alt="Wedding photo" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="p-8 text-center space-y-4">
        {/* Gold diamond ornament */}
        <div style={{ color: BRAND_GOLD, fontSize: "12px", letterSpacing: "14px" }}>◆ ◆ ◆</div>

        {/* "You are cordially invited" — white */}
        <p style={{ fontFamily: jakarta, fontSize: "11px", letterSpacing: "4px", textTransform: "uppercase", color: BRAND_MUTED, fontWeight: 500 }}>
          You are cordially invited to
        </p>

        {/* Couple names — gold */}
        <h2 style={{ fontFamily: cormorant, fontSize: "2.1rem", fontWeight: 400, color: BRAND_GOLD, lineHeight: 1.25, letterSpacing: "0.3px" }}>
          {couple}&rsquo;s Wedding
        </h2>

        {/* Divider */}
        <div className="mx-10 h-px" style={{ borderTop: `1px solid ${BRAND_BORDER}` }} />

        {/* Details — white */}
        <div className="space-y-1.5">
          {weddingDateStr && (
            <p style={{ fontFamily: cormorant, fontSize: "1.05rem", color: BRAND_WHITE, fontWeight: 400 }}>{weddingDateStr}</p>
          )}
          {profile.venue && (
            <p style={{ fontFamily: cormorant, fontSize: "0.9rem", color: BRAND_WHITE, fontWeight: 400 }}>{profile.venue}</p>
          )}
          {profile.venueAddress && (
            <p style={{ fontFamily: jakarta, fontSize: "11px", color: BRAND_MUTED }}>{profile.venueAddress}</p>
          )}
          {cityStateZip && (
            <p style={{ fontFamily: jakarta, fontSize: "11px", color: BRAND_MUTED }}>{cityStateZip}</p>
          )}
          {timesLine && (
            <p style={{ fontFamily: jakarta, fontSize: "11px", color: BRAND_MUTED, marginTop: "4px" }}>{timesLine}</p>
          )}
        </div>

        {/* Personal message */}
        {profile.invitationMessage && (
          <p style={{ fontFamily: cormorant, fontSize: "0.95rem", fontStyle: "italic", color: BRAND_MUTED, lineHeight: 1.7 }}>
            &ldquo;{profile.invitationMessage}&rdquo;
          </p>
        )}

        {/* RSVP button — gold */}
        <div className="pt-1">
          <span style={{
            display: "inline-block",
            background: BRAND_GOLD,
            color: "#0f0b1e",
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

        {/* Gold diamond ornament (footer) */}
        <div style={{ color: BRAND_GOLD_DIM, fontSize: "10px", letterSpacing: "14px" }}>◆ ◆ ◆</div>
      </div>
    </div>
  );
}
