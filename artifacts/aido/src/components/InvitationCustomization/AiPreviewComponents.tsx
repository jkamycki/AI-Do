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

const cormorant = "'Cormorant Garamond', 'Playfair Display', Georgia, serif";
const jakarta = "'Plus Jakarta Sans', system-ui, sans-serif";

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

export function AiSaveDatePreview({
  profile,
  palette,
  photoUrl,
}: {
  profile: WeddingInfo;
  palette: ColorPalette;
  photoUrl?: string | null;
}) {
  const couple = [profile.partner1Name, profile.partner2Name].filter(Boolean).join(" & ") || "The Couple";
  const weddingDateStr = formatWeddingDate(profile.weddingDate, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const locationLine = [
    profile.venue,
    profile.venueCity,
    [profile.venueState, profile.venueZip].filter(Boolean).join(" "),
  ].filter(Boolean).join(" · ");
  const ceremonyTimeStr = formatTime(profile.ceremonyTime);
  const receptionTimeStr = formatTime(profile.receptionTime);
  const hasPhoto = isPhotoComplete(photoUrl);

  return (
    <div className="rounded-lg overflow-hidden border border-border shadow-xl max-w-md mx-auto" style={{ background: "#faf8f5" }}>
      <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${palette.primary}, ${palette.secondary}, ${palette.accent})` }} />
      {hasPhoto && (
        <div style={{ height: 200, overflow: "hidden" }}>
          <img src={photoUrl!} alt="Wedding photo" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-8 text-center space-y-5">
        <p style={{ fontFamily: jakarta, fontSize: "11px", fontWeight: 600, letterSpacing: "0.4em", textTransform: "uppercase", color: palette.secondary }}>
          Save the Date
        </p>
        <div>
          <h2 style={{ fontFamily: cormorant, fontSize: "2.5rem", fontWeight: 300, color: palette.primary, lineHeight: 1.2, letterSpacing: "0.5px" }}>
            {couple}
          </h2>
          <div className="mt-3 mx-8 h-px" style={{ background: palette.accent, opacity: 0.6 }} />
        </div>
        {weddingDateStr && (
          <p style={{ fontFamily: cormorant, fontSize: "1.15rem", color: palette.primary, fontWeight: 400 }}>
            {weddingDateStr}
          </p>
        )}
        {locationLine && (
          <p style={{ fontFamily: jakarta, fontSize: "12px", letterSpacing: "0.5px", color: "#9a8a7e" }}>
            {locationLine}
          </p>
        )}
        {(ceremonyTimeStr || receptionTimeStr) && (
          <p style={{ fontFamily: jakarta, fontSize: "11px", color: "#b0a09a", letterSpacing: "0.5px" }}>
            {[ceremonyTimeStr && `Ceremony at ${ceremonyTimeStr}`, receptionTimeStr && `Reception at ${receptionTimeStr}`].filter(Boolean).join(" • ")}
          </p>
        )}
        {profile.saveTheDateMessage && (
          <p style={{ fontFamily: cormorant, fontSize: "1.05rem", fontStyle: "italic", color: "#7a6a5a", lineHeight: 1.7, fontWeight: 300 }}>
            &ldquo;{profile.saveTheDateMessage}&rdquo;
          </p>
        )}
        <p style={{ fontFamily: cormorant, fontSize: "13px", fontStyle: "italic", letterSpacing: "1px", color: palette.secondary, fontWeight: 300 }}>
          Formal invitation to follow
        </p>
        <div className="pt-1">
          <span
            style={{ display: "inline-block", background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`, color: "white", fontFamily: jakarta, fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", padding: "10px 28px", borderRadius: "4px", fontWeight: 600 }}
          >
            View &amp; Download
          </span>
        </div>
      </div>
      <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${palette.primary}, ${palette.secondary}, ${palette.accent})`, opacity: 0.6 }} />
    </div>
  );
}

export function AiDigitalInvitationPreview({
  profile,
  palette,
  photoUrl,
}: {
  profile: WeddingInfo;
  palette: ColorPalette;
  photoUrl?: string | null;
}) {
  const couple = [profile.partner1Name, profile.partner2Name].filter(Boolean).join(" & ") || "The Couple";
  const weddingDateStr = formatWeddingDate(profile.weddingDate, { year: "numeric", month: "long", day: "numeric" });
  const ceremonyTimeStr = formatTime(profile.ceremonyTime);
  const receptionTimeStr = formatTime(profile.receptionTime);
  const cityStateZip = [
    profile.venueCity,
    [profile.venueState, profile.venueZip].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ");
  const timesLine = [
    ceremonyTimeStr && `Ceremony ${ceremonyTimeStr}`,
    receptionTimeStr && `Reception ${receptionTimeStr}`,
  ].filter(Boolean).join("  •  ");
  const hasPhoto = isPhotoComplete(photoUrl);

  const BG = "#2c2622";
  const TEXT = "#e8dcc7";
  const MUTED = "#b6a890";
  const ACCENT = "#c9a97e";
  const BTN_BG = "#8a6a4f";

  return (
    <div className="rounded-lg overflow-hidden border border-border shadow-xl max-w-md mx-auto" style={{ background: BG }}>
      {hasPhoto && (
        <div style={{ height: 200, overflow: "hidden" }}>
          <img src={photoUrl!} alt="Wedding photo" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-8 text-center space-y-4">
        <div className="text-center" style={{ color: ACCENT, fontSize: "12px", letterSpacing: "14px" }}>◆ ◆ ◆</div>
        <p style={{ fontFamily: jakarta, fontSize: "11px", letterSpacing: "4px", textTransform: "uppercase", color: MUTED, fontWeight: 500 }}>
          You are cordially invited to
        </p>
        <h2 style={{ fontFamily: cormorant, fontSize: "2.1rem", fontWeight: 400, color: TEXT, lineHeight: 1.25, letterSpacing: "0.3px" }}>
          {couple}&rsquo;s Wedding
        </h2>
        <div className="mx-10 h-px" style={{ borderTop: `1px solid ${MUTED}`, opacity: 0.55 }} />
        <div className="space-y-1.5">
          {weddingDateStr && (
            <p style={{ fontFamily: cormorant, fontSize: "1.05rem", color: TEXT, fontWeight: 400 }}>{weddingDateStr}</p>
          )}
          {profile.venue && (
            <p style={{ fontFamily: cormorant, fontSize: "0.9rem", color: TEXT, fontWeight: 400 }}>{profile.venue}</p>
          )}
          {profile.venueAddress && (
            <p style={{ fontFamily: jakarta, fontSize: "11px", color: MUTED }}>{profile.venueAddress}</p>
          )}
          {cityStateZip && (
            <p style={{ fontFamily: jakarta, fontSize: "11px", color: MUTED }}>{cityStateZip}</p>
          )}
          {timesLine && (
            <p style={{ fontFamily: jakarta, fontSize: "11px", color: MUTED, marginTop: "4px" }}>{timesLine}</p>
          )}
        </div>
        {profile.invitationMessage && (
          <p style={{ fontFamily: cormorant, fontSize: "0.95rem", fontStyle: "italic", color: MUTED, lineHeight: 1.7 }}>
            &ldquo;{profile.invitationMessage}&rdquo;
          </p>
        )}
        <div className="pt-1">
          <span
            style={{ display: "inline-block", background: BTN_BG, color: "#fff", fontFamily: jakarta, fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", padding: "10px 28px", borderRadius: "4px", fontWeight: 600 }}
          >
            RSVP Now
          </span>
        </div>
      </div>
    </div>
  );
}
