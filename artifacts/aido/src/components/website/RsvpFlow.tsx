import { useEffect, useState } from "react";
import { apiFetch, authFetch } from "@/lib/authFetch";
import { Loader2, Search, Check, X, Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { WebsiteRendererPayload } from "./WebsiteRenderer";

interface GuestMatch {
  id: number;
  name: string;
  rsvpStatus: string;
  plusOne: boolean;
}

interface GuestDetails {
  id: number;
  name: string;
  rsvpStatus: string;
  mealChoice: string | null;
  dietaryNotes: string | null;
  plusOne: boolean;
  plusOneName: string | null;
  plusOneMealChoice: string | null;
}

function fontStack(font: string): string {
  return `'${font}', 'Playfair Display', Georgia, serif`;
}

export function RsvpFlow({
  data,
  slug,
  password,
  previewMode = false,
}: {
  data: WebsiteRendererPayload;
  slug: string;
  password?: string | null;
  // When true (editor "Guest Preview"), use authenticated owner-scoped endpoints
  // so guests on the user's list show up even if the site isn't published yet.
  previewMode?: boolean;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState<"search" | "already-rsvped" | "form" | "self-add" | "done">("search");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<GuestMatch[]>([]);
  const [searched, setSearched] = useState(false);
  const [guest, setGuest] = useState<GuestDetails | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // form state
  const [attendance, setAttendance] = useState<"attending" | "declined">("attending");
  const [mealChoice, setMealChoice] = useState("");
  const [dietary, setDietary] = useState("");
  const [plusOne, setPlusOne] = useState(false);
  const [plusOneName, setPlusOneName] = useState("");
  const [plusOneMeal, setPlusOneMeal] = useState("");
  // Self-add (guest not on the list) form
  const [selfName, setSelfName] = useState("");
  const [selfEmail, setSelfEmail] = useState("");
  const [selfMessage, setSelfMessage] = useState("");

  const accent = data.colorPalette.primary;
  const text = data.colorPalette.text;
  const bg = data.colorPalette.background;

  const queryArgs = password ? `&password=${encodeURIComponent(password)}` : "";

  useEffect(() => {
    if (!guest) return;
    setAttendance(guest.rsvpStatus === "declined" ? "declined" : "attending");
    setMealChoice(guest.mealChoice ?? "");
    setDietary(guest.dietaryNotes ?? "");
    setPlusOne(guest.plusOne);
    setPlusOneName(guest.plusOneName ?? "");
    setPlusOneMeal(guest.plusOneMealChoice ?? "");
  }, [guest]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (query.trim().length < 2) {
      setError("Please type at least 2 letters of your name.");
      return;
    }
    setError(null);
    setSearching(true);
    setSearched(false);
    try {
      const url = previewMode
        ? `/api/website/preview/guests/search?q=${encodeURIComponent(query.trim())}`
        : `/api/website/public/${encodeURIComponent(slug)}/guests/search?q=${encodeURIComponent(query.trim())}${queryArgs}`;
      const r = previewMode ? await authFetch(url) : await apiFetch(url);
      if (!r.ok) {
        setError("Search failed. Please try again.");
        return;
      }
      const body = (await r.json()) as { matches: GuestMatch[] };
      setMatches(body.matches);
      setSearched(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const selectGuest = async (m: GuestMatch) => {
    setError(null);
    try {
      const url = previewMode
        ? `/api/website/preview/guests/${m.id}`
        : `/api/website/public/${encodeURIComponent(slug)}/guests/${m.id}${password ? `?password=${encodeURIComponent(password)}` : ""}`;
      const r = previewMode ? await authFetch(url) : await apiFetch(url);
      if (!r.ok) {
        setError("Couldn't load your details. Please try again.");
        return;
      }
      const body = (await r.json()) as GuestDetails;
      setGuest(body);
      if (body.rsvpStatus !== "pending") {
        setAttendance(body.rsvpStatus === "declined" ? "declined" : "attending");
        setStep("already-rsvped");
      } else {
        setStep("form");
      }
    } catch {
      setError("Network error. Please try again.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guest) return;
    if (previewMode) {
      setStep("done");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const r = await apiFetch(`/api/website/public/${encodeURIComponent(slug)}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestId: guest.id,
          attendance,
          mealChoice: mealChoice || undefined,
          plusOne: attendance === "attending" ? plusOne : false,
          plusOneName: plusOne ? plusOneName : undefined,
          plusOneMealChoice: plusOne ? plusOneMeal : undefined,
          dietaryRestrictions: dietary || undefined,
          ...(password ? { password } : {}),
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setError(body?.error ?? "Failed to submit RSVP. Please try again.");
        return;
      }
      setStep("done");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelfAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selfName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (previewMode) {
      // Preview mode skips the network write to avoid creating real guests.
      setStep("done");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const r = await apiFetch(`/api/website/public/${encodeURIComponent(slug)}/rsvp/self-add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selfName.trim(),
          email: selfEmail.trim() || undefined,
          attendance,
          mealChoice: mealChoice || undefined,
          plusOne: attendance === "attending" ? plusOne : false,
          plusOneName: plusOne ? plusOneName : undefined,
          plusOneMealChoice: plusOne ? plusOneMeal : undefined,
          dietaryRestrictions: dietary || undefined,
          message: selfMessage.trim() || undefined,
          ...(password ? { password } : {}),
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setError(body?.error ?? "Failed to submit RSVP. Please try again.");
        return;
      }
      setStep("done");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputBase: React.CSSProperties = {
    background: `${bg === "#FFFFFF" ? "#FFFFFF" : "rgba(255,255,255,0.85)"}`,
    color: text,
    border: `1px solid ${accent}33`,
  };

  return (
    <section
      id="rsvp"
      className="py-20 px-6 min-h-[60vh]"
      style={{ background: data.colorPalette.background }}
    >
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-center gap-2 mb-3" style={{ color: accent }}>
          <Heart className="h-4 w-4" />
          <span className="uppercase tracking-[0.25em] text-xs">{data.customText.rsvp_title || "RSVP"}</span>
        </div>
        <div className="w-12 h-px mx-auto mb-10" style={{ background: accent }} />

        {step === "search" && (
          <div>
            <h2 className="text-center text-3xl sm:text-4xl mb-3" style={{ fontFamily: fontStack(data.font), color: text }}>
              {data.customText.rsvp_subtitle || t("rsvp.subtitle_default", { defaultValue: "Will you be joining us?" })}
            </h2>
            <p className="text-center text-sm sm:text-base mb-8 opacity-75" style={{ color: text }}>
              {data.customText.rsvp_intro || t("rsvp.intro_default", { defaultValue: "Find your name on the guest list and let us know if you can make it." })}
            </p>
            <form onSubmit={handleSearch} className="flex flex-col gap-3 max-w-md mx-auto">
              <label className="text-xs uppercase tracking-wider opacity-70" style={{ color: text }}>{t("rsvp.your_name", { defaultValue: "Your name" })}</label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("rsvp.name_placeholder", { defaultValue: "First and last name" })}
                autoFocus
                className="w-full px-4 py-3 rounded-lg outline-none focus:ring-2 text-base"
                style={inputBase}
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={searching}
                className="w-full px-4 py-3 rounded-lg font-medium transition-opacity hover:opacity-90 inline-flex items-center justify-center gap-2"
                style={{ background: accent, color: "#fff" }}
              >
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {searching ? t("rsvp.searching", { defaultValue: "Searching..." }) : t("rsvp.find_me", { defaultValue: "Find me" })}
              </button>
            </form>

            {searched && matches.length > 0 && (
              <div className="mt-8 max-w-md mx-auto">
                <p className="text-sm mb-3 opacity-75" style={{ color: text }}>
                  {matches.length === 1
                    ? t("rsvp.found_one", { defaultValue: "We found you. Tap your name:" })
                    : t("rsvp.found_many", { count: matches.length, defaultValue: "We found {{count}} matches. Tap your name:" })}
                </p>
                <div className="space-y-2">
                  {matches.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => selectGuest(m)}
                      className="w-full text-left px-4 py-3 rounded-lg border transition-all hover:opacity-90"
                      style={{ borderColor: `${accent}55`, background: `${accent}08`, color: text }}
                    >
                      <div className="font-medium">{m.name}</div>
                      {m.rsvpStatus !== "pending" && (
                        <div className="text-xs opacity-60 mt-0.5">
                          {t("rsvp.already_replied", {
                            status: m.rsvpStatus === "attending"
                              ? t("rsvp.status_attending", { defaultValue: "Attending" })
                              : t("rsvp.status_declined", { defaultValue: "Declined" }),
                            defaultValue: "Already replied: {{status}} (you can change it)",
                          })}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelfName(query.trim());
                    setError(null);
                    setStep("self-add");
                  }}
                  className="mt-3 w-full text-xs underline opacity-70 hover:opacity-100 text-center"
                  style={{ color: text }}
                >
                  {t("rsvp.none_are_me", { defaultValue: "None of these are me — RSVP anyway" })}
                </button>
              </div>
            )}

            {searched && matches.length === 0 && (
              <div className="mt-8 max-w-md mx-auto px-4 py-6 rounded-lg text-center space-y-4" style={{ background: `${accent}10`, border: `1px solid ${accent}33`, color: text }}>
                <p className="text-sm">
                  {t("rsvp.not_found", { defaultValue: "We couldn't find that name on the guest list. Double-check the spelling — or, if you'd still like to RSVP, send us your details and we'll review them." })}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelfName(query.trim());
                    setError(null);
                    setStep("self-add");
                  }}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
                  style={{ background: accent, color: "#fff" }}
                >
                  {t("rsvp.rsvp_anyway", { defaultValue: "RSVP anyway" })}
                </button>
              </div>
            )}
          </div>
        )}

        {step === "already-rsvped" && guest && (
          <div className="text-center max-w-md mx-auto">
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6"
              style={{ background: `${accent}20`, color: accent }}
            >
              <Check className="h-8 w-8" />
            </div>
            <h2 className="text-3xl sm:text-4xl mb-3" style={{ fontFamily: fontStack(data.font), color: text }}>
              {t("rsvp.greeting", { name: guest.name.split(" ")[0], defaultValue: "Hi {{name}}!" })}
            </h2>
            <p className="text-base mb-2" style={{ color: text }}>
              {t("rsvp.already_replied_as", {
                status: guest.rsvpStatus === "attending"
                  ? t("rsvp.status_attending", { defaultValue: "Attending" })
                  : t("rsvp.status_declined", { defaultValue: "Declined" }),
                defaultValue: "You've already RSVPed as <0>{{status}}</0>.",
              })}
            </p>
            <p className="text-sm opacity-70 mb-8" style={{ color: text }}>
              {guest.rsvpStatus === "attending"
                ? t("rsvp.excited_to_celebrate", { defaultValue: "We're so excited to celebrate with you!" })
                : t("rsvp.sorry_you_cant", { defaultValue: "We're sorry you can't make it — you'll be missed!" })}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setStep("search");
                  setGuest(null);
                  setQuery("");
                  setMatches([]);
                  setSearched(false);
                }}
                className="w-full px-4 py-3 rounded-lg font-medium transition-opacity hover:opacity-90"
                style={{ background: accent, color: "#fff" }}
              >
                {t("rsvp.done", { defaultValue: "Done" })}
              </button>
              <button
                onClick={() => setStep("form")}
                className="w-full text-xs underline opacity-60 hover:opacity-100"
                style={{ color: text }}
              >
                {t("rsvp.update_rsvp", { defaultValue: "I need to update my RSVP" })}
              </button>
            </div>
          </div>
        )}

        {step === "form" && guest && (
          <div>
            <h2 className="text-center text-3xl sm:text-4xl mb-2" style={{ fontFamily: fontStack(data.font), color: text }}>
              {t("rsvp.greeting", { name: guest.name.split(" ")[0], defaultValue: "Hi {{name}}!" })}
            </h2>
            <p className="text-center text-sm mb-10 opacity-75" style={{ color: text }}>{t("rsvp.subtitle_default", { defaultValue: "Will you be joining us?" })}</p>

            <form onSubmit={handleSubmit} className="space-y-6 max-w-md mx-auto">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAttendance("attending")}
                  className="px-4 py-4 rounded-lg border-2 transition-all flex items-center justify-center gap-2 font-medium"
                  style={{
                    borderColor: attendance === "attending" ? accent : `${accent}33`,
                    background: attendance === "attending" ? accent : "transparent",
                    color: attendance === "attending" ? "#fff" : text,
                  }}
                >
                  <Check className="h-4 w-4" /> {t("rsvp.joyfully_accept", { defaultValue: "Joyfully accept" })}
                </button>
                <button
                  type="button"
                  onClick={() => setAttendance("declined")}
                  className="px-4 py-4 rounded-lg border-2 transition-all flex items-center justify-center gap-2 font-medium"
                  style={{
                    borderColor: attendance === "declined" ? accent : `${accent}33`,
                    background: attendance === "declined" ? accent : "transparent",
                    color: attendance === "declined" ? "#fff" : text,
                  }}
                >
                  <X className="h-4 w-4" /> {t("rsvp.regretfully_decline", { defaultValue: "Regretfully decline" })}
                </button>
              </div>

              {attendance === "attending" && (
                <>
                  <div>
                    <label className="text-xs uppercase tracking-wider opacity-70 mb-1.5 block" style={{ color: text }}>{t("rsvp.meal_choice", { defaultValue: "Meal choice (optional)" })}</label>
                    <input
                      type="text"
                      value={mealChoice}
                      onChange={(e) => setMealChoice(e.target.value)}
                      placeholder={t("rsvp.meal_placeholder", { defaultValue: "Chicken, fish, vegetarian..." })}
                      className="w-full px-4 py-3 rounded-lg outline-none focus:ring-2 text-base"
                      style={inputBase}
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={plusOne}
                        onChange={(e) => setPlusOne(e.target.checked)}
                        className="h-4 w-4"
                        style={{ accentColor: accent }}
                      />
                      <span className="text-sm" style={{ color: text }}>{t("rsvp.bringing_plus_one", { defaultValue: "I'm bringing a plus one" })}</span>
                    </label>
                  </div>

                  {plusOne && (
                    <>
                      <div>
                        <label className="text-xs uppercase tracking-wider opacity-70 mb-1.5 block" style={{ color: text }}>{t("rsvp.plus_one_name", { defaultValue: "Plus one's name" })}</label>
                        <input
                          type="text"
                          value={plusOneName}
                          onChange={(e) => setPlusOneName(e.target.value)}
                          className="w-full px-4 py-3 rounded-lg outline-none focus:ring-2 text-base"
                          style={inputBase}
                        />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-wider opacity-70 mb-1.5 block" style={{ color: text }}>{t("rsvp.plus_one_meal", { defaultValue: "Plus one's meal choice" })}</label>
                        <input
                          type="text"
                          value={plusOneMeal}
                          onChange={(e) => setPlusOneMeal(e.target.value)}
                          placeholder={t("rsvp.meal_placeholder", { defaultValue: "Chicken, fish, vegetarian..." })}
                          className="w-full px-4 py-3 rounded-lg outline-none focus:ring-2 text-base"
                          style={inputBase}
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="text-xs uppercase tracking-wider opacity-70 mb-1.5 block" style={{ color: text }}>{t("rsvp.dietary", { defaultValue: "Dietary restrictions or notes" })}</label>
                    <textarea
                      value={dietary}
                      onChange={(e) => setDietary(e.target.value)}
                      rows={2}
                      placeholder={t("rsvp.dietary_placeholder", { defaultValue: "Allergies, accommodations, anything we should know..." })}
                      className="w-full px-4 py-3 rounded-lg outline-none focus:ring-2 text-base"
                      style={inputBase}
                    />
                  </div>
                </>
              )}

              {error && <p className="text-sm text-red-600 text-center">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full px-4 py-3 rounded-lg font-medium transition-opacity hover:opacity-90 inline-flex items-center justify-center gap-2"
                style={{ background: accent, color: "#fff" }}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? t("rsvp.sending", { defaultValue: "Sending..." }) : t("rsvp.send_response", { defaultValue: "Send response" })}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep("search");
                  setGuest(null);
                  setError(null);
                }}
                className="w-full text-xs underline opacity-60 hover:opacity-100"
                style={{ color: text }}
              >
                {t("rsvp.not_me_back", { defaultValue: "That's not me — go back" })}
              </button>
            </form>
          </div>
        )}

        {step === "self-add" && (
          <div>
            <h2 className="text-center text-3xl sm:text-4xl mb-2" style={{ fontFamily: fontStack(data.font), color: text }}>
              {t("rsvp.title", { defaultValue: "RSVP" })}
            </h2>
            <p className="text-center text-sm mb-8 opacity-75" style={{ color: text }}>
              {t("rsvp.self_add_intro", {
                couple: data.couple.partner1Name?.split(" ")[0] || t("rsvp.the_couple", { defaultValue: "the couple" }),
                defaultValue: "You weren't on the list yet. Send us your details and {{couple}} can review them in their guest list.",
              })}
            </p>

            <form onSubmit={handleSelfAddSubmit} className="space-y-6 max-w-md mx-auto">
              <div>
                <label className="text-xs uppercase tracking-wider opacity-70 mb-1.5 block" style={{ color: text }}>{t("rsvp.full_name", { defaultValue: "Your full name" })}</label>
                <input
                  type="text"
                  value={selfName}
                  onChange={(e) => setSelfName(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-4 py-3 rounded-lg outline-none focus:ring-2 text-base"
                  style={inputBase}
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider opacity-70 mb-1.5 block" style={{ color: text }}>{t("rsvp.email_optional", { defaultValue: "Email (optional)" })}</label>
                <input
                  type="email"
                  value={selfEmail}
                  onChange={(e) => setSelfEmail(e.target.value)}
                  placeholder={t("rsvp.email_placeholder", { defaultValue: "you@example.com" })}
                  className="w-full px-4 py-3 rounded-lg outline-none focus:ring-2 text-base"
                  style={inputBase}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAttendance("attending")}
                  className="px-4 py-4 rounded-lg border-2 transition-all flex items-center justify-center gap-2 font-medium"
                  style={{
                    borderColor: attendance === "attending" ? accent : `${accent}33`,
                    background: attendance === "attending" ? accent : "transparent",
                    color: attendance === "attending" ? "#fff" : text,
                  }}
                >
                  <Check className="h-4 w-4" /> {t("rsvp.joyfully_accept", { defaultValue: "Joyfully accept" })}
                </button>
                <button
                  type="button"
                  onClick={() => setAttendance("declined")}
                  className="px-4 py-4 rounded-lg border-2 transition-all flex items-center justify-center gap-2 font-medium"
                  style={{
                    borderColor: attendance === "declined" ? accent : `${accent}33`,
                    background: attendance === "declined" ? accent : "transparent",
                    color: attendance === "declined" ? "#fff" : text,
                  }}
                >
                  <X className="h-4 w-4" /> {t("rsvp.regretfully_decline", { defaultValue: "Regretfully decline" })}
                </button>
              </div>

              {attendance === "attending" && (
                <>
                  <div>
                    <label className="text-xs uppercase tracking-wider opacity-70 mb-1.5 block" style={{ color: text }}>{t("rsvp.meal_choice", { defaultValue: "Meal choice (optional)" })}</label>
                    <input
                      type="text"
                      value={mealChoice}
                      onChange={(e) => setMealChoice(e.target.value)}
                      placeholder={t("rsvp.meal_placeholder", { defaultValue: "Chicken, fish, vegetarian..." })}
                      className="w-full px-4 py-3 rounded-lg outline-none focus:ring-2 text-base"
                      style={inputBase}
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={plusOne}
                        onChange={(e) => setPlusOne(e.target.checked)}
                        className="h-4 w-4"
                        style={{ accentColor: accent }}
                      />
                      <span className="text-sm" style={{ color: text }}>{t("rsvp.bringing_plus_one", { defaultValue: "I'm bringing a plus one" })}</span>
                    </label>
                  </div>

                  {plusOne && (
                    <>
                      <div>
                        <label className="text-xs uppercase tracking-wider opacity-70 mb-1.5 block" style={{ color: text }}>{t("rsvp.plus_one_name", { defaultValue: "Plus one's name" })}</label>
                        <input
                          type="text"
                          value={plusOneName}
                          onChange={(e) => setPlusOneName(e.target.value)}
                          className="w-full px-4 py-3 rounded-lg outline-none focus:ring-2 text-base"
                          style={inputBase}
                        />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-wider opacity-70 mb-1.5 block" style={{ color: text }}>{t("rsvp.plus_one_meal", { defaultValue: "Plus one's meal choice" })}</label>
                        <input
                          type="text"
                          value={plusOneMeal}
                          onChange={(e) => setPlusOneMeal(e.target.value)}
                          placeholder={t("rsvp.meal_placeholder", { defaultValue: "Chicken, fish, vegetarian..." })}
                          className="w-full px-4 py-3 rounded-lg outline-none focus:ring-2 text-base"
                          style={inputBase}
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="text-xs uppercase tracking-wider opacity-70 mb-1.5 block" style={{ color: text }}>{t("rsvp.dietary", { defaultValue: "Dietary restrictions or notes" })}</label>
                    <textarea
                      value={dietary}
                      onChange={(e) => setDietary(e.target.value)}
                      rows={2}
                      placeholder={t("rsvp.dietary_placeholder", { defaultValue: "Allergies, accommodations, anything we should know..." })}
                      className="w-full px-4 py-3 rounded-lg outline-none focus:ring-2 text-base"
                      style={inputBase}
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-xs uppercase tracking-wider opacity-70 mb-1.5 block" style={{ color: text }}>{t("rsvp.message_to_couple", { defaultValue: "Message to the couple (optional)" })}</label>
                <textarea
                  value={selfMessage}
                  onChange={(e) => setSelfMessage(e.target.value)}
                  rows={2}
                  placeholder={t("rsvp.message_placeholder", { defaultValue: "A note for the couple — relation, RSVP context, etc." })}
                  className="w-full px-4 py-3 rounded-lg outline-none focus:ring-2 text-base"
                  style={inputBase}
                />
              </div>

              {error && <p className="text-sm text-red-600 text-center">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full px-4 py-3 rounded-lg font-medium transition-opacity hover:opacity-90 inline-flex items-center justify-center gap-2"
                style={{ background: accent, color: "#fff" }}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? t("rsvp.sending", { defaultValue: "Sending..." }) : t("rsvp.send_response", { defaultValue: "Send response" })}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep("search");
                  setError(null);
                }}
                className="w-full text-xs underline opacity-60 hover:opacity-100"
                style={{ color: text }}
              >
                {t("rsvp.back_to_search", { defaultValue: "← Back to search" })}
              </button>
            </form>
          </div>
        )}

        {step === "done" && (() => {
          // After self-add the user has no `guest` row from the lookup, so use
          // their typed name; for the regular flow, use the matched guest.
          const replyName = guest?.name?.split(" ")[0] || selfName.split(" ")[0] || "";
          return (
            <div className="text-center max-w-md mx-auto">
              <div
                className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6"
                style={{ background: `${accent}20`, color: accent }}
              >
                <Check className="h-8 w-8" />
              </div>
              <h2 className="text-3xl sm:text-4xl mb-3" style={{ fontFamily: fontStack(data.font), color: text }}>
                {attendance === "attending"
                  ? t("rsvp.cant_wait", { defaultValue: "We can't wait to celebrate with you!" })
                  : t("rsvp.miss_you", { defaultValue: "We'll miss you!" })}
              </h2>
              <p className="text-sm sm:text-base opacity-80 mb-8" style={{ color: text }}>
                {attendance === "attending"
                  ? (replyName
                    ? t("rsvp.confirmation_attending_named", { name: replyName, defaultValue: "Your response has been received, {{name}}. We'll be in touch with more details closer to the day." })
                    : t("rsvp.confirmation_attending", { defaultValue: "Your response has been received. We'll be in touch with more details closer to the day." }))
                  : (replyName
                    ? t("rsvp.confirmation_declined_named", { name: replyName, defaultValue: "Thank you for letting us know, {{name}}. You'll be missed." })
                    : t("rsvp.confirmation_declined", { defaultValue: "Thank you for letting us know. You'll be missed." }))}
              </p>
              <button
                onClick={() => {
                  setStep("search");
                  setGuest(null);
                  setQuery("");
                  setMatches([]);
                  setSearched(false);
                  setSelfName("");
                  setSelfEmail("");
                  setSelfMessage("");
                }}
                className="text-xs underline opacity-60 hover:opacity-100"
                style={{ color: text }}
              >
                {t("rsvp.reply_for_someone_else", { defaultValue: "Reply for someone else" })}
              </button>
            </div>
          );
        })()}
      </div>
    </section>
  );
}
