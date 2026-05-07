import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/authFetch";
import { Loader2, Search, Check, X, Heart } from "lucide-react";
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
}: {
  data: WebsiteRendererPayload;
  slug: string;
  password?: string | null;
}) {
  const [step, setStep] = useState<"search" | "already-rsvped" | "form" | "done">("search");
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
      const r = await apiFetch(
        `/api/website/public/${encodeURIComponent(slug)}/guests/search?q=${encodeURIComponent(query.trim())}${queryArgs}`,
      );
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
      const r = await apiFetch(
        `/api/website/public/${encodeURIComponent(slug)}/guests/${m.id}${password ? `?password=${encodeURIComponent(password)}` : ""}`,
      );
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
              {data.customText.rsvp_subtitle || "Will you be joining us?"}
            </h2>
            <p className="text-center text-sm sm:text-base mb-8 opacity-75" style={{ color: text }}>
              {data.customText.rsvp_intro || "Find your name on the guest list and let us know if you can make it."}
            </p>
            <form onSubmit={handleSearch} className="flex flex-col gap-3 max-w-md mx-auto">
              <label className="text-xs uppercase tracking-wider opacity-70" style={{ color: text }}>Your name</label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="First and last name"
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
                {searching ? "Searching..." : "Find me"}
              </button>
            </form>

            {searched && matches.length > 0 && (
              <div className="mt-8 max-w-md mx-auto">
                <p className="text-sm mb-3 opacity-75" style={{ color: text }}>
                  We found {matches.length === 1 ? "you" : `${matches.length} matches`}. Tap your name:
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
                          Already replied: {m.rsvpStatus === "attending" ? "Attending" : "Declined"} (you can change it)
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {searched && matches.length === 0 && (
              <div className="mt-8 max-w-md mx-auto px-4 py-6 rounded-lg text-center" style={{ background: `${accent}10`, border: `1px solid ${accent}33`, color: text }}>
                <p className="text-sm">
                  We couldn't find that name on the guest list. Double-check spelling, or please reach out to {data.couple.partner1Name} or {data.couple.partner2Name} directly.
                </p>
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
              Hi {guest.name.split(" ")[0]}!
            </h2>
            <p className="text-base mb-2" style={{ color: text }}>
              You've already RSVPed as{" "}
              <strong>{guest.rsvpStatus === "attending" ? "Attending" : "Declined"}</strong>.
            </p>
            <p className="text-sm opacity-70 mb-8" style={{ color: text }}>
              {guest.rsvpStatus === "attending"
                ? "We're so excited to celebrate with you!"
                : "We're sorry you can't make it — you'll be missed!"}
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
                Done
              </button>
              <button
                onClick={() => setStep("form")}
                className="w-full text-xs underline opacity-60 hover:opacity-100"
                style={{ color: text }}
              >
                I need to update my RSVP
              </button>
            </div>
          </div>
        )}

        {step === "form" && guest && (
          <div>
            <h2 className="text-center text-3xl sm:text-4xl mb-2" style={{ fontFamily: fontStack(data.font), color: text }}>
              Hi {guest.name.split(" ")[0]}!
            </h2>
            <p className="text-center text-sm mb-10 opacity-75" style={{ color: text }}>Will you be joining us?</p>

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
                  <Check className="h-4 w-4" /> Joyfully accept
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
                  <X className="h-4 w-4" /> Regretfully decline
                </button>
              </div>

              {attendance === "attending" && (
                <>
                  <div>
                    <label className="text-xs uppercase tracking-wider opacity-70 mb-1.5 block" style={{ color: text }}>Meal choice (optional)</label>
                    <input
                      type="text"
                      value={mealChoice}
                      onChange={(e) => setMealChoice(e.target.value)}
                      placeholder="Chicken, fish, vegetarian..."
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
                      <span className="text-sm" style={{ color: text }}>I'm bringing a plus one</span>
                    </label>
                  </div>

                  {plusOne && (
                    <>
                      <div>
                        <label className="text-xs uppercase tracking-wider opacity-70 mb-1.5 block" style={{ color: text }}>Plus one's name</label>
                        <input
                          type="text"
                          value={plusOneName}
                          onChange={(e) => setPlusOneName(e.target.value)}
                          className="w-full px-4 py-3 rounded-lg outline-none focus:ring-2 text-base"
                          style={inputBase}
                        />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-wider opacity-70 mb-1.5 block" style={{ color: text }}>Plus one's meal choice</label>
                        <input
                          type="text"
                          value={plusOneMeal}
                          onChange={(e) => setPlusOneMeal(e.target.value)}
                          placeholder="Chicken, fish, vegetarian..."
                          className="w-full px-4 py-3 rounded-lg outline-none focus:ring-2 text-base"
                          style={inputBase}
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="text-xs uppercase tracking-wider opacity-70 mb-1.5 block" style={{ color: text }}>Dietary restrictions or notes</label>
                    <textarea
                      value={dietary}
                      onChange={(e) => setDietary(e.target.value)}
                      rows={2}
                      placeholder="Allergies, accommodations, anything we should know..."
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
                {submitting ? "Sending..." : "Send response"}
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
                That's not me — go back
              </button>
            </form>
          </div>
        )}

        {step === "done" && guest && (
          <div className="text-center max-w-md mx-auto">
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6"
              style={{ background: `${accent}20`, color: accent }}
            >
              <Check className="h-8 w-8" />
            </div>
            <h2 className="text-3xl sm:text-4xl mb-3" style={{ fontFamily: fontStack(data.font), color: text }}>
              {attendance === "attending" ? "We can't wait to celebrate with you!" : "We'll miss you!"}
            </h2>
            <p className="text-sm sm:text-base opacity-80 mb-8" style={{ color: text }}>
              {attendance === "attending"
                ? `Your response has been received, ${guest.name.split(" ")[0]}. We'll be in touch with more details closer to the day.`
                : `Thank you for letting us know. You'll be missed, ${guest.name.split(" ")[0]}.`}
            </p>
            <button
              onClick={() => {
                setStep("search");
                setGuest(null);
                setQuery("");
                setMatches([]);
                setSearched(false);
              }}
              className="text-xs underline opacity-60 hover:opacity-100"
              style={{ color: text }}
            >
              Reply for someone else
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
