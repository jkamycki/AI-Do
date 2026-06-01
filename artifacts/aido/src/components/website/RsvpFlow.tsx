import { useEffect, useState } from "react";
import { apiFetch, authFetch } from "@/lib/authFetch";
import { Loader2, Search, Check, X, Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { WebsiteRendererPayload } from "./WebsiteRenderer";
import { DEFAULT_RSVP_MEAL_OPTIONS, normalizeMealOptions } from "@/lib/mealOptions";

interface GuestMatch {
  id: number;
  name: string;
  rsvpStatus?: string | null;
}

interface GuestDetails {
  id: number;
  name: string;
  rsvpStatus: string;
  mealChoice: string | null;
  dietaryNotes: string | null;
  plusOne: boolean;
  plusOneStatus?: "none" | "named" | "name_tbd" | "unsure" | null;
  plusOneName: string | null;
  plusOneMealChoice: string | null;
  needsHotel?: boolean;
  bookedHotelBlockId?: number | null;
  bookedHotelRoomCount?: number | null;
}

type HotelResponse = "no" | "yes" | "booked";

function normalizedRsvpStatus(status: string | null | undefined) {
  return status === "attending" || status === "declined" ? status : "pending";
}

function fontStack(font: string): string {
  return `'${font}', 'Playfair Display', Georgia, serif`;
}

function hotelAddressLine(hotel: NonNullable<WebsiteRendererPayload["hotelOptions"]>[number]) {
  return [
    hotel.address,
    [hotel.city, hotel.state].filter(Boolean).join(", "),
    hotel.zip,
  ].filter(Boolean).join(" ");
}

function formatHotelCutoffDate(value: string | null | undefined) {
  if (!value) return "";
  const [yy, mm, dd] = value.split("-").map(Number);
  const date = yy && mm && dd ? new Date(yy, mm - 1, dd) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function RsvpFlow({
  data,
  slug,
  password,
  previewMode = false,
  sharedToken,
}: {
  data: WebsiteRendererPayload;
  slug: string;
  password?: string | null;
  // When true (editor "Guest Preview"), use authenticated owner-scoped endpoints
  // so guests on the user's list show up even if the site isn't published yet.
  previewMode?: boolean;
  sharedToken?: string;
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
  const [plusOneStatus, setPlusOneStatus] = useState<"none" | "named" | "name_tbd" | "unsure">("none");
  const [plusOneName, setPlusOneName] = useState("");
  const [plusOneMeal, setPlusOneMeal] = useState("");
  const [hotelNeeded, setHotelNeeded] = useState(false);
  const [hotelResponse, setHotelResponse] = useState<HotelResponse>("no");
  const [hotelBlockId, setHotelBlockId] = useState("");
  const [hotelRoomCount, setHotelRoomCount] = useState("1");
  // Self-add (guest not on the list) form
  const [selfName, setSelfName] = useState("");
  const [selfEmail, setSelfEmail] = useState("");
  const [selfMessage, setSelfMessage] = useState("");

  const accent = data.colorPalette.primary;
  const text = data.colorPalette.text;
  const bg = data.colorPalette.background;
  const preferredHotelId = data.customText._rsvpHotelBlockId && data.customText._rsvpHotelBlockId !== "all"
    ? data.customText._rsvpHotelBlockId
    : "";
  const allHotelOptions = data.hotelOptions ?? [];
  const mealOptions = normalizeMealOptions(data.mealOptions ?? DEFAULT_RSVP_MEAL_OPTIONS);
  const hotelOptions = preferredHotelId
    ? [...allHotelOptions].sort((a, b) => (String(a.id) === preferredHotelId ? -1 : String(b.id) === preferredHotelId ? 1 : 0))
    : allHotelOptions;
  const showHotelQuestion = false;
  const selectedHotel = hotelOptions.find((hotel) => String(hotel.id) === hotelBlockId) ?? null;
  const handlePlusOneStatusChange = (value: "none" | "named" | "name_tbd" | "unsure") => {
    setPlusOneStatus(value);
    setPlusOne(value === "named" || value === "name_tbd");
    if (value !== "named") setPlusOneName("");
    if (value === "none" || value === "unsure") setPlusOneMeal("");
  };
  const renderHotelDetails = () => selectedHotel ? (
    <div className="rounded-lg p-3 space-y-2 text-sm" style={{ border: `1px solid ${accent}33`, background: `${accent}10`, color: text }}>
      <div>
        <p className="font-semibold">{selectedHotel.hotelName || "Hotel block"}</p>
        {hotelAddressLine(selectedHotel) && (
          <p className="text-xs font-medium mt-0.5">{hotelAddressLine(selectedHotel)}</p>
        )}
        {selectedHotel.groupName && (
          <p className="text-xs mt-2 opacity-85">
            <span className="font-semibold">{t("rsvp.hotel_block_name", { defaultValue: "Wedding block" })}:</span> {selectedHotel.groupName}
          </p>
        )}
        {selectedHotel.discountCode && (
          <p className="text-xs mt-1 opacity-85">
            <span className="font-semibold">{t("rsvp.hotel_group_code", { defaultValue: "Group code" })}:</span>{" "}
            <span className="font-mono font-semibold tracking-wide">{selectedHotel.discountCode}</span>
          </p>
        )}
        {selectedHotel.cutoffDate && (
          <p className="text-xs mt-1 opacity-85">
            <span className="font-semibold">{t("rsvp.hotel_cutoff_date", { defaultValue: "Cutoff Date to Book" })}:</span> {formatHotelCutoffDate(selectedHotel.cutoffDate)}
          </p>
        )}
        <p className="text-xs mt-1 opacity-85">
          <span className="font-semibold">{t("rsvp.hotel_rooms", { defaultValue: "Rooms" })}:</span> {hotelRoomCount === "2" ? "2 rooms" : "1 room"}
        </p>
      </div>
      {selectedHotel.bookingLink && (
        <a
          href={selectedHotel.bookingLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
          style={{ background: accent, color: "#fff" }}
        >
          {t("rsvp.open_booking_link", { defaultValue: "Open booking link" })}
        </a>
      )}
    </div>
  ) : null;

  const passwordHeader: Record<string, string> = password ? { "X-Site-Password": password } : {};

  useEffect(() => {
    if (!guest) return;
    const status = normalizedRsvpStatus(guest.rsvpStatus);
    setAttendance(status === "declined" ? "declined" : "attending");
    setMealChoice(guest.mealChoice ?? "");
    setDietary(guest.dietaryNotes ?? "");
    const nextPlusOneStatus = guest.plusOneStatus ?? (guest.plusOne ? (guest.plusOneName ? "named" : "name_tbd") : "none");
    setPlusOneStatus(nextPlusOneStatus);
    setPlusOne(nextPlusOneStatus === "named" || nextPlusOneStatus === "name_tbd");
    setPlusOneName(guest.plusOneName ?? "");
    setPlusOneMeal(guest.plusOneMealChoice ?? "");
    setHotelNeeded(!!guest.needsHotel);
    setHotelResponse(guest.needsHotel ? "yes" : "no");
    setHotelBlockId(guest.bookedHotelBlockId ? String(guest.bookedHotelBlockId) : preferredHotelId);
    setHotelRoomCount(guest.bookedHotelRoomCount === 2 ? "2" : "1");
  }, [guest, preferredHotelId]);

  useEffect(() => {
    if (hotelResponse !== "yes" || !showHotelQuestion || !preferredHotelId || hotelBlockId) return;
    setHotelBlockId(preferredHotelId);
  }, [hotelBlockId, hotelResponse, preferredHotelId, showHotelQuestion]);

  const handleHotelResponseChange = (value: HotelResponse) => {
    const needsHotel = value !== "no";
    setHotelResponse(value);
    setHotelNeeded(needsHotel);
    if (!needsHotel) {
      setHotelBlockId("");
      return;
    }
    if (value === "booked") {
      setHotelBlockId("");
      return;
    }
    if (value === "yes" && preferredHotelId && !hotelBlockId) {
      setHotelBlockId(preferredHotelId);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (query.trim().length < 2) {
      setError(t("rsvp.error_min_name_letters", { defaultValue: "Please type at least 2 letters of your name." }));
      return;
    }
    setError(null);
    setSearching(true);
    setSearched(false);
    try {
      const url = sharedToken
        ? `/api/invitation-shares/${encodeURIComponent(sharedToken)}/guests/search?q=${encodeURIComponent(query.trim())}`
        : previewMode
        ? `/api/website/preview/guests/search?q=${encodeURIComponent(query.trim())}`
        : `/api/website/public/${encodeURIComponent(slug)}/guests/search?q=${encodeURIComponent(query.trim())}`;
      const r = previewMode ? await authFetch(url) : await apiFetch(url, { headers: sharedToken ? undefined : passwordHeader });
      if (!r.ok) {
        // Treat a failed lookup as "no match found" so the guest can still
        // self-add via "RSVP anyway" — same fallback path the editor preview
        // exposes when nothing matches the typed name.
        setMatches([]);
        setSearched(true);
        setError(t("rsvp.error_search_unavailable", { defaultValue: "We couldn't search the guest list right now. You can still RSVP using your details below." }));
        return;
      }
      const body = (await r.json()) as { matches: GuestMatch[] };
      setMatches(body.matches);
      setSearched(true);
    } catch {
      setMatches([]);
      setSearched(true);
      setError(t("rsvp.error_guest_list_unreachable", { defaultValue: "We couldn't reach the guest list. You can still RSVP using your details below." }));
    } finally {
      setSearching(false);
    }
  };

  const selectGuest = async (m: GuestMatch) => {
    setError(null);
    try {
      const url = sharedToken
        ? `/api/invitation-shares/${encodeURIComponent(sharedToken)}/guests/${m.id}?name=${encodeURIComponent(m.name)}`
        : previewMode
        ? `/api/website/preview/guests/${m.id}`
        : `/api/website/public/${encodeURIComponent(slug)}/guests/${m.id}?name=${encodeURIComponent(m.name)}`;
      const r = previewMode ? await authFetch(url) : await apiFetch(url, { headers: sharedToken ? undefined : passwordHeader });
      if (!r.ok) {
        setError(t("rsvp.error_load_details", { defaultValue: "Couldn't load your details. Please try again." }));
        return;
      }
      const body = (await r.json()) as GuestDetails;
      const status = normalizedRsvpStatus(body.rsvpStatus);
      const normalizedGuest = { ...body, rsvpStatus: status };
      setGuest(normalizedGuest);
      if (status !== "pending") {
        setAttendance(status === "declined" ? "declined" : "attending");
        setStep("already-rsvped");
      } else {
        setStep("form");
      }
    } catch {
      setError(t("common.network_error", { defaultValue: "Network error. Please try again." }));
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
      const r = await apiFetch(sharedToken
        ? `/api/invitation-shares/${encodeURIComponent(sharedToken)}/rsvp`
        : `/api/website/public/${encodeURIComponent(slug)}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestId: guest.id,
          guestName: guest.name,
          attendance,
          mealChoice: mealChoice || undefined,
          plusOne: attendance === "attending" ? plusOne : false,
          plusOneStatus: attendance === "attending" ? plusOneStatus : "none",
          plusOneName: plusOneStatus === "named" ? plusOneName : undefined,
          plusOneMealChoice: plusOne ? plusOneMeal : undefined,
          dietaryRestrictions: dietary || undefined,
          hotelNeeded: false,
          bookedHotelBlockId: null,
          bookedHotelRoomCount: null,
          message: selfMessage.trim() || undefined,
          ...(password ? { password } : {}),
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setError(body?.error ?? t("rsvp.error_submit_failed", { defaultValue: "Failed to submit RSVP. Please try again." }));
        return;
      }
      setStep("done");
    } catch {
      setError(t("common.network_error", { defaultValue: "Network error. Please try again." }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelfAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selfName.trim()) {
      setError(t("rsvp.error_full_name_required", { defaultValue: "Please enter your full name." }));
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
      const r = await apiFetch(sharedToken
        ? `/api/invitation-shares/${encodeURIComponent(sharedToken)}/rsvp/self-add`
        : `/api/website/public/${encodeURIComponent(slug)}/rsvp/self-add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selfName.trim(),
          email: selfEmail.trim() || undefined,
          attendance,
          mealChoice: mealChoice || undefined,
          plusOne: attendance === "attending" ? plusOne : false,
          plusOneStatus: attendance === "attending" ? plusOneStatus : "none",
          plusOneName: plusOneStatus === "named" ? plusOneName : undefined,
          plusOneMealChoice: plusOne ? plusOneMeal : undefined,
          dietaryRestrictions: dietary || undefined,
          hotelNeeded: false,
          bookedHotelBlockId: null,
          bookedHotelRoomCount: null,
          message: selfMessage.trim() || undefined,
          ...(password ? { password } : {}),
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setError(body?.error ?? t("rsvp.error_submit_failed", { defaultValue: "Failed to submit RSVP. Please try again." }));
        return;
      }
      setStep("done");
    } catch {
      setError(t("common.network_error", { defaultValue: "Network error. Please try again." }));
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
      style={{ background: data.customText._rsvpBg || data.colorPalette.background }}
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
            <p className="text-center text-sm sm:text-base font-medium mb-8" style={{ color: text }}>
              {data.customText.rsvp_intro || t("rsvp.intro_default", { defaultValue: "Find your name on the guest list. Your response will be saved for the couple to review." })}
            </p>
            <form onSubmit={handleSearch} className="flex flex-col gap-3 max-w-md mx-auto">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: text }}>{t("rsvp.your_name", { defaultValue: "Your name" })}</label>
              <p className="-mt-2 text-xs leading-relaxed opacity-80" style={{ color: text }}>
                {t("rsvp.exact_name_note", { defaultValue: "Enter your name exactly as it appears on your invitation." })}
              </p>
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
                <p className="text-sm font-medium mb-3" style={{ color: text }}>
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
                      {normalizedRsvpStatus(m.rsvpStatus) !== "pending" && (
                        <div className="text-xs font-medium mt-0.5">
                          {t("rsvp.already_replied", {
                            status: normalizedRsvpStatus(m.rsvpStatus) === "attending"
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
                  className="mt-3 w-full text-xs font-medium underline opacity-90 hover:opacity-100 text-center"
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
              {t("rsvp.already_rsvped_as", {
                status: guest.rsvpStatus === "attending"
                  ? t("rsvp.status_attending", { defaultValue: "Attending" })
                  : t("rsvp.status_declined", { defaultValue: "Declined" }),
                defaultValue: "You've already RSVPed as {{status}}.",
              })}
            </p>
            <p className="text-sm font-medium mb-8" style={{ color: text }}>
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
                className="w-full text-xs font-medium underline opacity-90 hover:opacity-100"
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
            <p className="text-center text-sm font-medium mb-3" style={{ color: text }}>{t("rsvp.subtitle_default", { defaultValue: "Will you be joining us?" })}</p>
            <p className="text-center text-xs font-medium opacity-80 mb-10" style={{ color: text }}>
              {t("rsvp.response_saved_note", { defaultValue: "When you send this, the couple will see it in their A.IDO guest list." })}
            </p>

            <form onSubmit={handleSubmit} className="space-y-6 max-w-md mx-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: text }}>{t("rsvp.meal_choice", { defaultValue: "Meal choice (optional)" })}</label>
                    <select
                      value={mealChoice}
                      onChange={(e) => setMealChoice(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg outline-none focus:ring-2 text-base"
                      style={inputBase}
                    >
                      <option value="">{t("rsvp.meal_select_placeholder", { defaultValue: "-- choose a meal --" })}</option>
                      {mealOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: text }}>
                      {t("rsvp.bringing_plus_one", { defaultValue: "Are you bringing a plus one?" })}
                    </label>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {[
                        { value: "none", label: "No" },
                        { value: "named", label: "Yes, I know their name" },
                        { value: "name_tbd", label: "Yes, name coming later" },
                        { value: "unsure", label: "Not sure yet" },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handlePlusOneStatusChange(option.value as "none" | "named" | "name_tbd" | "unsure")}
                          className="rounded-lg border px-4 py-2 text-left text-sm font-medium transition-colors"
                          style={plusOneStatus === option.value
                            ? { background: accent, borderColor: accent, color: "#fff" }
                            : { ...inputBase, background: "transparent" }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {plusOne && (
                    <>
                      {plusOneStatus === "named" && (
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: text }}>{t("rsvp.plus_one_name", { defaultValue: "Plus one's name" })}</label>
                        <input
                          type="text"
                          value={plusOneName}
                          onChange={(e) => setPlusOneName(e.target.value)}
                          className="w-full px-4 py-3 rounded-lg outline-none focus:ring-2 text-base"
                          style={inputBase}
                        />
                      </div>
                      )}
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: text }}>{t("rsvp.plus_one_meal", { defaultValue: "Plus one's meal choice" })}</label>
                        <select
                          value={plusOneMeal}
                          onChange={(e) => setPlusOneMeal(e.target.value)}
                          className="w-full px-4 py-3 rounded-lg outline-none focus:ring-2 text-base"
                          style={inputBase}
                        >
                          <option value="">{t("rsvp.meal_select_placeholder", { defaultValue: "-- choose a meal --" })}</option>
                          {mealOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  {showHotelQuestion && (
                    <div className="space-y-3 rounded-lg border p-4" style={{ borderColor: `${accent}33`, background: `${accent}08` }}>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: text }}>
                          {t("rsvp.need_hotel_question", { defaultValue: "Will you need a hotel room?" })}
                        </label>
                        <select
                          value={hotelResponse}
                          onChange={(e) => handleHotelResponseChange(e.target.value as HotelResponse)}
                          className="w-full px-4 py-3 rounded-lg outline-none focus:ring-2 text-base"
                          style={inputBase}
                        >
                          <option value="no">{t("common.no", { defaultValue: "No" })}</option>
                          <option value="yes">{t("common.yes", { defaultValue: "Yes" })}</option>
                          <option value="booked">{t("rsvp.hotel_already_booked", { defaultValue: "I've already booked" })}</option>
                        </select>
                      </div>
                      {hotelNeeded && (
                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: text }}>
                            {hotelResponse === "booked"
                              ? t("rsvp.hotel_block_booked", { defaultValue: "Which hotel did you book?" })
                              : t("rsvp.hotel_block", { defaultValue: "Hotel block" })}
                          </label>
                          <select
                            value={hotelBlockId || ""}
                            onChange={(e) => setHotelBlockId(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg outline-none focus:ring-2 text-base"
                            style={inputBase}
                          >
                            <option value="">
                              {hotelResponse === "booked"
                                ? t("rsvp.hotel_not_listed", { defaultValue: "I booked outside this block / not listed" })
                                : t("rsvp.hotel_decide_later", { defaultValue: "I will decide later" })}
                            </option>
                            {hotelOptions.map((hotel) => (
                              <option key={hotel.id} value={hotel.id}>
                                {hotel.hotelName || "Hotel block"}
                              </option>
                            ))}
                          </select>
                          <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: text }}>
                            {hotelResponse === "booked"
                              ? t("rsvp.hotel_rooms_booked", { defaultValue: "How many rooms did you book?" })
                              : t("rsvp.hotel_room_count", { defaultValue: "How many rooms?" })}
                          </label>
                          <select
                            value={hotelRoomCount}
                            onChange={(e) => setHotelRoomCount(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg outline-none focus:ring-2 text-base"
                            style={inputBase}
                          >
                            <option value="1">1 room</option>
                            <option value="2">2 rooms</option>
                          </select>
                          {renderHotelDetails()}
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: text }}>{t("rsvp.dietary", { defaultValue: "Dietary restrictions or notes" })}</label>
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
                <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: text }}>{t("rsvp.message_to_couple", { defaultValue: "Message to the couple (optional)" })}</label>
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
                {submitting ? t("rsvp.sending", { defaultValue: "Sending..." }) : t("rsvp.send_response", { defaultValue: "Send response to couple" })}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep("search");
                  setGuest(null);
                  setError(null);
                }}
                className="w-full text-xs font-medium underline opacity-90 hover:opacity-100"
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
            <p className="text-center text-sm font-medium mb-8" style={{ color: text }}>
              {t("rsvp.self_add_intro", {
                couple: data.couple.partner1Name?.split(" ")[0] || t("rsvp.the_couple", { defaultValue: "the couple" }),
                defaultValue: "You weren't on the list yet. Send us your details and {{couple}} can review them in their guest list.",
              })}
            </p>

            <form onSubmit={handleSelfAddSubmit} className="space-y-6 max-w-md mx-auto">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: text }}>{t("rsvp.full_name", { defaultValue: "Your full name" })}</label>
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
                <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: text }}>{t("rsvp.email_optional", { defaultValue: "Email (optional)" })}</label>
                <input
                  type="email"
                  value={selfEmail}
                  onChange={(e) => setSelfEmail(e.target.value)}
                  placeholder={t("rsvp.email_placeholder", { defaultValue: "you@example.com" })}
                  className="w-full px-4 py-3 rounded-lg outline-none focus:ring-2 text-base"
                  style={inputBase}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: text }}>{t("rsvp.meal_choice", { defaultValue: "Meal choice (optional)" })}</label>
                    <select
                      value={mealChoice}
                      onChange={(e) => setMealChoice(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg outline-none focus:ring-2 text-base"
                      style={inputBase}
                    >
                      <option value="">{t("rsvp.meal_select_placeholder", { defaultValue: "-- choose a meal --" })}</option>
                      {mealOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: text }}>
                      {t("rsvp.bringing_plus_one", { defaultValue: "Are you bringing a plus one?" })}
                    </label>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {[
                        { value: "none", label: "No" },
                        { value: "named", label: "Yes, I know their name" },
                        { value: "name_tbd", label: "Yes, name coming later" },
                        { value: "unsure", label: "Not sure yet" },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handlePlusOneStatusChange(option.value as "none" | "named" | "name_tbd" | "unsure")}
                          className="rounded-lg border px-4 py-2 text-left text-sm font-medium transition-colors"
                          style={plusOneStatus === option.value
                            ? { background: accent, borderColor: accent, color: "#fff" }
                            : { ...inputBase, background: "transparent" }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {plusOne && (
                    <>
                      {plusOneStatus === "named" && (
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: text }}>{t("rsvp.plus_one_name", { defaultValue: "Plus one's name" })}</label>
                        <input
                          type="text"
                          value={plusOneName}
                          onChange={(e) => setPlusOneName(e.target.value)}
                          className="w-full px-4 py-3 rounded-lg outline-none focus:ring-2 text-base"
                          style={inputBase}
                        />
                      </div>
                      )}
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: text }}>{t("rsvp.plus_one_meal", { defaultValue: "Plus one's meal choice" })}</label>
                        <select
                          value={plusOneMeal}
                          onChange={(e) => setPlusOneMeal(e.target.value)}
                          className="w-full px-4 py-3 rounded-lg outline-none focus:ring-2 text-base"
                          style={inputBase}
                        >
                          <option value="">{t("rsvp.meal_select_placeholder", { defaultValue: "-- choose a meal --" })}</option>
                          {mealOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  {showHotelQuestion && (
                    <div className="space-y-3 rounded-lg border p-4" style={{ borderColor: `${accent}33`, background: `${accent}08` }}>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: text }}>
                          {t("rsvp.need_hotel_question", { defaultValue: "Will you need a hotel room?" })}
                        </label>
                        <select
                          value={hotelResponse}
                          onChange={(e) => handleHotelResponseChange(e.target.value as HotelResponse)}
                          className="w-full px-4 py-3 rounded-lg outline-none focus:ring-2 text-base"
                          style={inputBase}
                        >
                          <option value="no">{t("common.no", { defaultValue: "No" })}</option>
                          <option value="yes">{t("common.yes", { defaultValue: "Yes" })}</option>
                          <option value="booked">{t("rsvp.hotel_already_booked", { defaultValue: "I've already booked" })}</option>
                        </select>
                      </div>
                      {hotelNeeded && (
                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: text }}>
                            {hotelResponse === "booked"
                              ? t("rsvp.hotel_block_booked", { defaultValue: "Which hotel did you book?" })
                              : t("rsvp.hotel_block", { defaultValue: "Hotel block" })}
                          </label>
                          <select
                            value={hotelBlockId || ""}
                            onChange={(e) => setHotelBlockId(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg outline-none focus:ring-2 text-base"
                            style={inputBase}
                          >
                            <option value="">
                              {hotelResponse === "booked"
                                ? t("rsvp.hotel_not_listed", { defaultValue: "I booked outside this block / not listed" })
                                : t("rsvp.hotel_decide_later", { defaultValue: "I will decide later" })}
                            </option>
                            {hotelOptions.map((hotel) => (
                              <option key={hotel.id} value={hotel.id}>
                                {hotel.hotelName || "Hotel block"}
                              </option>
                            ))}
                          </select>
                          <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: text }}>
                            {hotelResponse === "booked"
                              ? t("rsvp.hotel_rooms_booked", { defaultValue: "How many rooms did you book?" })
                              : t("rsvp.hotel_room_count", { defaultValue: "How many rooms?" })}
                          </label>
                          <select
                            value={hotelRoomCount}
                            onChange={(e) => setHotelRoomCount(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg outline-none focus:ring-2 text-base"
                            style={inputBase}
                          >
                            <option value="1">1 room</option>
                            <option value="2">2 rooms</option>
                          </select>
                          {renderHotelDetails()}
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: text }}>{t("rsvp.dietary", { defaultValue: "Dietary restrictions or notes" })}</label>
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
                <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: text }}>{t("rsvp.message_to_couple", { defaultValue: "Message to the couple (optional)" })}</label>
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
                {submitting ? t("rsvp.sending", { defaultValue: "Sending..." }) : t("rsvp.send_response", { defaultValue: "Send response to couple" })}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep("search");
                  setError(null);
                }}
                className="w-full text-xs font-medium underline opacity-90 hover:opacity-100"
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
                    ? t("rsvp.confirmation_attending_named", { name: replyName, defaultValue: "Your response has been received, {{name}}. The couple can now see it in their guest list." })
                    : t("rsvp.confirmation_attending", { defaultValue: "Your response has been received. The couple can now see it in their guest list." }))
                  : (replyName
                    ? t("rsvp.confirmation_declined_named", { name: replyName, defaultValue: "Thank you for letting us know, {{name}}. The couple can now see it in their guest list." })
                    : t("rsvp.confirmation_declined", { defaultValue: "Thank you for letting us know. The couple can now see it in their guest list." }))}
              </p>
              {!previewMode && data.publicWebsiteUrl && (
                <a
                  href={data.publicWebsiteUrl}
                  className="mb-4 inline-flex w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
                  style={{ background: accent, color: "#fff" }}
                >
                  {t("rsvp.view_wedding_website", { defaultValue: "View wedding website" })}
                </a>
              )}
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
                  setHotelNeeded(false);
                  setHotelBlockId(preferredHotelId);
                }}
                className="text-xs font-medium underline opacity-90 hover:opacity-100"
                style={{ color: text }}
              >
                {t("rsvp.reply_for_someone_else", { defaultValue: "Reply for someone else" })}
              </button>
            </div>
          );
        })()}
        <div className="mx-auto mt-12 max-w-md border-t pt-6 text-center" style={{ borderColor: `${accent}33` }}>
          <img
            src="/logo-optimized.jpg"
            alt="A.IDO"
            className="mx-auto mb-2 h-8 w-auto object-contain"
          />
          <p className="text-xs leading-relaxed" style={{ color: text }}>
            Planning your own wedding?{" "}
            <a href="https://aidowedding.net?theme=light" className="font-bold no-underline" style={{ color: accent }}>
              Try A.IDO
            </a>
          </p>
          <a href="https://aidowedding.net?theme=light" className="text-xs underline" style={{ color: text }}>
            aidowedding.net
          </a>
        </div>
      </div>
    </section>
  );
}
