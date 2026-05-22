import { useEffect, useState, useRef } from "react";
import { apiFetch } from "@/lib/authFetch";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Heart, CheckCircle2, XCircle, AlertCircle, Loader2, User, Download, MapPin } from "lucide-react";
import { AnimatedInvitationShell } from "@/components/InvitationCustomization/AnimatedInvitationShell";
import { photoEffectToFilter } from "@/components/InvitationCustomization/AiPreviewComponents";
import { DEFAULT_RSVP_MEAL_OPTIONS, normalizeMealOptions, type MealOption } from "@/lib/mealOptions";
import { MaintenanceNotice } from "@/components/MaintenanceNotice";
import { usePublicMaintenance } from "@/hooks/usePublicMaintenance";

const schema = z.object({
  attendance: z.enum(["attending", "declined"], { required_error: "Please select Accept or Decline." }),
  mealChoice: z.string().optional(),
  plusOne: z.boolean().default(false),
  plusOneFirstName: z.string().optional(),
  plusOneLastName: z.string().optional(),
  plusOneMealChoice: z.string().optional(),
  dietaryRestrictions: z.string().optional(),
  hotelNeeded: z.boolean().default(false),
  bookedHotelBlockId: z.string().optional(),
  bookedHotelRoomCount: z.string().default("1"),
}).refine(
  (data) => {
    if (data.attendance !== "attending" || !data.plusOne) return true;
    return !!(data.plusOneFirstName?.trim() && data.plusOneLastName?.trim());
  },
  {
    message: "Please enter your guest's first and last name.",
    path: ["plusOneFirstName"],
  },
);

type FormData = z.infer<typeof schema>;
type HotelResponse = "no" | "yes" | "booked";

interface RsvpInfo {
  guestName: string;
  partner1Name: string | null;
  partner2Name: string | null;
  weddingDate: string | null;
  venue: string | null;
  venueAddress: string | null;
  venueCity: string | null;
  venueState: string | null;
  venueZip: string | null;
  ceremonyTime: string | null;
  receptionTime: string | null;
  ceremonyAtVenue: boolean;
  ceremonyVenueName: string | null;
  ceremonyAddress: string | null;
  ceremonyCity: string | null;
  ceremonyState: string | null;
  ceremonyZip: string | null;
  currentStatus: string;
  plusOneAllowed: boolean;
  hasPhoto: boolean;
  photoUrl: string | null;
  photoObjectPosition?: string | null;
  photoZoom?: number | null;
  photoEffect?: string | null;
  invitationMessage: string | null;
  websiteUrl?: string | null;
  // Couple-set RSVP deadline (YYYY-MM-DD); rendered as "RSVP By: (Date)" on
  // the invitation card so guests know when they need to respond by.
  rsvpByDate: string | null;
  colorPalette: { primary: string; secondary: string; accent: string; neutral: string } | null;
  backgroundColor: string | null;
  font: string | null;
  layout: string | null;
  // Independent per-invitation accent / font color (may differ from STD accent)
  accentColor: string | null;
  fontColor: string | null;
  askHotelOnRsvp?: boolean;
  preferredHotelBlockId?: number | null;
  mealOptions?: MealOption[];
  hotelOptions?: Array<{
    id: number;
    hotelName: string;
    bookingLink?: string | null;
    discountCode?: string | null;
    groupName?: string | null;
    cutoffDate?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  }>;
}

function formatTime(timeStr: string | null | undefined) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return timeStr;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function hotelAddressLine(hotel: NonNullable<RsvpInfo["hotelOptions"]>[number]) {
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

const DEFAULT_BG   = "#FFF7F2";
const DEFAULT_GOLD = "#8D294D";
const cormorant = "'Cormorant Garamond', 'Playfair Display', Georgia, serif";
const jakarta   = "'Plus Jakarta Sans', system-ui, sans-serif";

function isLightHex(hex: string): boolean {
  const c = (hex || "").replace("#", "");
  if (c.length !== 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 160;
}

function cloneCardForPdf(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.position = "fixed";
  clone.style.left = "-10000px";
  clone.style.top = "0";
  clone.style.width = `${rect.width || element.offsetWidth}px`;
  clone.style.margin = "0";
  clone.style.transform = "none";
  clone.style.animation = "none";
  clone.style.zIndex = "-1";
  document.body.appendChild(clone);
  return {
    element: clone,
    cleanup: () => clone.remove(),
  };
}

export default function Rsvp() {
  const [, params] = useRoute("/rsvp/:token");
  const token = params?.token ?? "";
  const [submitted, setSubmitted] = useState(false);
  const [finalStatus, setFinalStatus] = useState<"attending" | "declined" | null>(null);
  const [pendingData, setPendingData] = useState<FormData | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [allowRsvpUpdate, setAllowRsvpUpdate] = useState(false);
  const [hotelResponse, setHotelResponse] = useState<HotelResponse>("no");
  const cardRef = useRef<HTMLDivElement>(null);
  const maintenance = usePublicMaintenance("rsvp");

  const { data: info, isLoading, isError } = useQuery({
    queryKey: ["rsvp", token],
    queryFn: async () => {
      const res = await apiFetch(`/api/rsvp/${token}`);
      if (!res.ok) throw new Error("Invalid link");
      return res.json() as Promise<RsvpInfo>;
    },
    enabled: !!token,
    retry: false,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      attendance: undefined,
      mealChoice: "",
      plusOne: false,
      plusOneFirstName: "",
      plusOneLastName: "",
      plusOneMealChoice: "",
      dietaryRestrictions: "",
      hotelNeeded: false,
      bookedHotelBlockId: "",
      bookedHotelRoomCount: "1",
    },
  });

  const attendance = form.watch("attendance");
  const plusOne = form.watch("plusOne");
  const hotelNeeded = form.watch("hotelNeeded");
  const selectedHotelBlockId = form.watch("bookedHotelBlockId");
  const selectedHotelRoomCount = form.watch("bookedHotelRoomCount");
  const selectedHotel = info?.hotelOptions?.find((hotel) => String(hotel.id) === selectedHotelBlockId) ?? null;
  const showHotelQuestion = false;
  const mealOptions = normalizeMealOptions(info?.mealOptions ?? DEFAULT_RSVP_MEAL_OPTIONS);

  useEffect(() => {
    if (hotelResponse !== "yes" || !showHotelQuestion || !info?.preferredHotelBlockId) return;
    form.setValue("bookedHotelBlockId", String(info.preferredHotelBlockId));
  }, [form, hotelResponse, info?.preferredHotelBlockId, showHotelQuestion]);

  const handleHotelResponseChange = (value: HotelResponse) => {
    const needsHotel = value !== "no";
    setHotelResponse(value);
    form.setValue("hotelNeeded", needsHotel, { shouldDirty: true, shouldValidate: true });
    if (!needsHotel) {
      form.setValue("bookedHotelBlockId", "", { shouldDirty: true });
      return;
    }
    if (value === "booked") {
      form.setValue("bookedHotelBlockId", "", { shouldDirty: true });
      return;
    }
    if (value === "yes" && info?.preferredHotelBlockId && !form.getValues("bookedHotelBlockId")) {
      form.setValue("bookedHotelBlockId", String(info.preferredHotelBlockId), { shouldDirty: true });
    }
  };

  const submit = useMutation({
    mutationFn: async (data: FormData) => {
      const plusOneName = data.plusOne
        ? [data.plusOneFirstName?.trim(), data.plusOneLastName?.trim()]
            .filter(Boolean)
            .join(" ")
        : "";
      const payload = {
        attendance: data.attendance,
        mealChoice: data.mealChoice,
        plusOne: data.plusOne,
        plusOneName,
        plusOneFirstName: data.plusOneFirstName?.trim() || "",
        plusOneLastName: data.plusOneLastName?.trim() || "",
        plusOneMealChoice: data.plusOneMealChoice,
        dietaryRestrictions: data.dietaryRestrictions,
        hotelNeeded: false,
        bookedHotelBlockId: null,
        bookedHotelRoomCount: null,
      };
      const res = await apiFetch(`/api/rsvp/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Something went wrong. Please try again.");
      }
      return res.json() as Promise<{ success: boolean; status: string }>;
    },
    onSuccess: (data) => {
      setFinalStatus(data.status as "attending" | "declined");
      setSubmitted(true);
      setPendingData(null);
    },
  });

  // Pull the planner's custom design colours through to the public RSVP page —
  // background and accent come from the saved customization; text/muted/border
  // are derived from background lightness so contrast is correct on light or dark.
  const isCustomMode = !!(info?.backgroundColor);
  const BG = info?.backgroundColor || DEFAULT_BG;
  // Use the invitation's own accent color when set; fall back to palette accent,
  // then the A.IDO burgundy brand accent. This mirrors the send modal preview.
  const GOLD = isCustomMode
    ? (info?.accentColor || info?.colorPalette?.accent || DEFAULT_GOLD)
    : DEFAULT_GOLD;
  const COUPLE_COLOR = GOLD;
  const _bgIsLight = isLightHex(BG);
  // In custom mode use the saved font color when available, otherwise derive from bg.
  const WHITE = (isCustomMode && info?.fontColor)
    ? info.fontColor
    : (_bgIsLight ? "#1a1a1a" : "#ffffff");
  const MUTED = (isCustomMode && info?.fontColor)
    ? info.fontColor + "99"
    : (_bgIsLight ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)");
  const CARD_BDR = _bgIsLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)";
  const DOT_PAT = `radial-gradient(${GOLD}22 1px, transparent 1px)`;
  const SERIF = isCustomMode && info?.font
    ? `'${info.font}', ${cormorant}`
    : cormorant;
  const LABEL_FONT = isCustomMode && info?.font ? SERIF : jakarta;
  // Page sits *behind* the card. Always light grey so the card colour
  // stops at the rounded edge — no bleed into the surrounding viewport.
  const PAGE_BG = "#FFF7F2";
  const PAGE_BG_PATTERN: string | undefined = undefined;
  const photoZoom = Math.max(0.5, Math.min(2.5, Number(info?.photoZoom ?? 1) || 1));
  const fitWholePhoto = photoZoom < 1;
  const photoObjectPosition = info?.photoObjectPosition ?? "50% 58%";

  const couple = [info?.partner2Name, info?.partner1Name].filter(Boolean).join(" & ") || "The Couple";
  const groomFirst = String(info?.partner1Name || "").trim().split(/\s+/)[0] || "Partner";
  const brideFirst = String(info?.partner2Name || "").trim().split(/\s+/)[0] || "Partner";

  const weddingDateStr = info?.weddingDate
    ? (() => {
        const [y, m, d] = info.weddingDate.split("-").map(Number);
        return new Date(y, m - 1, d).toLocaleDateString("en-US", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
        });
      })()
    : null;

  const rsvpByDateStr = info?.rsvpByDate
    ? (() => {
        const [y, m, d] = info.rsvpByDate.split("-").map(Number);
        if (!y || !m || !d) return null;
        return new Date(y, m - 1, d).toLocaleDateString("en-US", {
          year: "numeric", month: "long", day: "numeric",
        });
      })()
    : null;

  const mealLabel = (val?: string) => mealOptions.find(o => o.value === val)?.label ?? val ?? "—";

  const venueCityStateZip = [
    info?.venueCity,
    [info?.venueState, info?.venueZip].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ");

  const ceremonyCityStateZip = [
    info?.ceremonyCity,
    [info?.ceremonyState, info?.ceremonyZip].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ");

  const ceremonyTimeStr = formatTime(info?.ceremonyTime);
  const receptionTimeStr = formatTime(info?.receptionTime);

  const timesLine = [
    ceremonyTimeStr && `Ceremony ${ceremonyTimeStr}`,
    receptionTimeStr && `Reception ${receptionTimeStr}`,
  ].filter(Boolean).join("  ·  ");

  const hasSeparateCeremony = !!(
    info && !info.ceremonyAtVenue &&
    (info.ceremonyVenueName || info.ceremonyAddress || info.ceremonyCity)
  );
  const isFullPhotoLayout = false;
  const existingRsvpStatus =
    info?.currentStatus === "attending" || info?.currentStatus === "declined"
      ? info.currentStatus
      : null;

  const downloadInvitationPdf = async () => {
    if (!info || !cardRef.current) return;
    setDownloadingPdf(true);
    setPdfError(false);
    const pdfTarget = cloneCardForPdf(cardRef.current);
    try {
      const { exportElementToPdf } = await import("@/lib/pdfExport");
      const safeCouple = couple.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_") || "wedding";
      await exportElementToPdf({
        element: pdfTarget.element,
        backgroundColor: BG,
        filename: `${safeCouple}_invitation.pdf`,
        allowTaint: true,
      });
    } catch (err) {
      console.error("PDF generation failed", err);
      setPdfError(true);
    } finally {
      pdfTarget.cleanup();
      setDownloadingPdf(false);
    }
  };

  if (maintenance.data?.active) {
    return <MaintenanceNotice message={maintenance.data.message} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }

  if (isError || !info) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: BG, backgroundImage: DOT_PAT, backgroundSize: "22px 22px" }}>
        <div className="max-w-md w-full text-center rounded-2xl p-10 space-y-4" style={{ border: `1px solid ${CARD_BDR}`, background: BG }}>
          <AlertCircle className="h-12 w-12 mx-auto" style={{ color: GOLD }} />
          <h2 className="text-xl font-semibold" style={{ fontFamily: cormorant, color: WHITE }}>This RSVP link is no longer valid</h2>
          <p className="text-sm" style={{ fontFamily: jakarta, color: MUTED }}>The link may have expired or already been used. Please contact the couple directly.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    const accepted = finalStatus === "attending";
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4"
        style={{ background: BG, backgroundImage: DOT_PAT, backgroundSize: "22px 22px" }}>
        <div className="max-w-md w-full text-center rounded-2xl overflow-hidden shadow-2xl" style={{ border: `1px solid ${CARD_BDR}`, background: BG }}>
          <div className="h-1.5 w-full" style={{ background: accepted ? "linear-gradient(90deg,#22c55e,#16a34a)" : "linear-gradient(90deg,#ef4444,#dc2626)" }} />
          <div className="pt-10 pb-10 space-y-5 px-8">
            <div className="flex justify-center">
              <div className={`h-20 w-20 rounded-full flex items-center justify-center ring-1 ${accepted ? "bg-emerald-500/15 ring-emerald-500/30" : "bg-red-500/15 ring-red-500/30"}`}>
                {accepted
                  ? <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                  : <XCircle className="h-10 w-10 text-red-400" />
                }
              </div>
            </div>
            <div>
              <h2 style={{ fontFamily: cormorant, fontStyle: "italic", fontWeight: 400, fontSize: "2rem", color: WHITE, marginBottom: "0.5rem" }}>
                {accepted ? "See you there!" : "We'll miss you!"}
              </h2>
              <p style={{ fontFamily: jakarta, color: MUTED, fontSize: "0.875rem", lineHeight: 1.6 }}>
                {accepted
                  ? <><span>Thanks, </span><span style={{ color: WHITE, fontWeight: 600 }}>{info.guestName}</span><span>! Your attendance has been confirmed for </span><span style={{ color: WHITE, fontWeight: 600 }}>{couple}'s</span><span> wedding.</span></>
                  : <><span>Thanks for letting us know, </span><span style={{ color: WHITE, fontWeight: 600 }}>{info.guestName}</span><span>. </span><span style={{ color: WHITE, fontWeight: 600 }}>{couple}</span><span> appreciate you responding.</span></>
                }
              </p>
              {accepted && weddingDateStr && (
                <p style={{ fontFamily: jakarta, color: MUTED, fontSize: "0.75rem", marginTop: "0.75rem" }}>{weddingDateStr}{info.venue ? ` · ${info.venue}` : ""}</p>
              )}
            </div>
            <div style={{ borderTop: `1px solid ${CARD_BDR}`, paddingTop: "1.25rem" }}>
              <img
                src="/logo.png"
                alt="A.IDO"
                style={{ height: 34, width: "auto", objectFit: "contain", margin: "0 auto 0.75rem" }}
              />
              {info.websiteUrl && (
                <>
                  <p style={{ fontFamily: jakarta, color: MUTED, fontSize: "0.75rem", lineHeight: 1.5, marginBottom: "0.85rem" }}>
                    Visit the wedding website for details, directions, travel notes, and updates.
                  </p>
                  <a
                    href={info.websiteUrl}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0.75rem 1rem",
                      borderRadius: 8,
                      background: GOLD,
                      color: isLightHex(GOLD) ? "#1a1a1a" : "#ffffff",
                      fontFamily: jakarta,
                      fontSize: "0.75rem",
                      fontWeight: 800,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      textDecoration: "none",
                    }}
                  >
                    View Wedding Website
                  </a>
                </>
              )}
              <p style={{ fontFamily: jakarta, color: MUTED, fontSize: "0.68rem", lineHeight: 1.5, marginTop: info.websiteUrl ? "1rem" : "0.5rem" }}>
                Planning your own wedding?{" "}
                <a href="https://aidowedding.net?theme=light" style={{ color: GOLD, textDecoration: "none", fontWeight: 700 }}>
                  Try A.IDO
                </a>
              </p>
              <p style={{ fontFamily: jakarta, color: MUTED, fontSize: "0.68rem", lineHeight: 1.5, marginTop: "0.15rem" }}>
                <a href="https://aidowedding.net?theme=light" style={{ color: MUTED, textDecoration: "underline" }}>
                  aidowedding.net
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (existingRsvpStatus && !allowRsvpUpdate) {
    const accepted = existingRsvpStatus === "attending";
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-4"
        style={{ background: BG, backgroundImage: DOT_PAT, backgroundSize: "22px 22px" }}
      >
        <div
          className="max-w-md w-full text-center rounded-2xl overflow-hidden shadow-2xl"
          style={{ border: `1px solid ${CARD_BDR}`, background: BG }}
        >
          <div className="h-1.5 w-full" style={{ background: GOLD }} />
          <div className="px-8 py-10 space-y-5">
            <div className="flex justify-center">
              <div
                className={`h-20 w-20 rounded-full flex items-center justify-center ring-1 ${
                  accepted
                    ? "bg-emerald-500/15 ring-emerald-500/30"
                    : "bg-red-500/15 ring-red-500/30"
                }`}
              >
                {accepted ? (
                  <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                ) : (
                  <XCircle className="h-10 w-10 text-red-400" />
                )}
              </div>
            </div>
            <div>
              <h2
                style={{
                  fontFamily: cormorant,
                  fontStyle: "italic",
                  fontWeight: 400,
                  fontSize: "2rem",
                  color: WHITE,
                  marginBottom: "0.5rem",
                }}
              >
                You've already RSVPed
              </h2>
              <p
                style={{
                  fontFamily: jakarta,
                  color: MUTED,
                  fontSize: "0.875rem",
                  lineHeight: 1.6,
                }}
              >
                <span>Thanks, </span>
                <span style={{ color: WHITE, fontWeight: 600 }}>{info.guestName}</span>
                <span>. Your response is already saved as </span>
                <span style={{ color: WHITE, fontWeight: 700 }}>
                  {accepted ? "attending" : "not attending"}
                </span>
                <span> for </span>
                <span style={{ color: WHITE, fontWeight: 600 }}>{couple}'s</span>
                <span> wedding.</span>
              </p>
              {accepted && weddingDateStr && (
                <p style={{ fontFamily: jakarta, color: MUTED, fontSize: "0.75rem", marginTop: "0.75rem" }}>
                  {weddingDateStr}
                  {info.venue ? ` · ${info.venue}` : ""}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setAllowRsvpUpdate(true)}
              style={{
                width: "100%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 8,
                border: `1px solid ${GOLD}66`,
                background: GOLD,
                color: isLightHex(GOLD) ? "#1a1a1a" : "#ffffff",
                fontFamily: jakarta,
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.12em",
                padding: "0.85rem 1rem",
                textTransform: "uppercase",
              }}
            >
              Update my RSVP
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-4"
      style={{ background: PAGE_BG, backgroundImage: PAGE_BG_PATTERN, backgroundSize: PAGE_BG_PATTERN ? "22px 22px" : undefined }}>

      <div className="w-full space-y-6" style={{ maxWidth: 420 }}>

        {/* Invitation card — captured by html2canvas for PDF */}
        <AnimatedInvitationShell
          layout="classic"
          accent={GOLD}
          paper={isCustomMode ? BG : undefined}
          darkPanel={isCustomMode ? GOLD : undefined}
          monogram={`${info.partner2Name || ""} ${info.partner1Name || ""}`}
        >
        {isFullPhotoLayout ? (
        <div
          ref={cardRef}
          className="w-full overflow-hidden shadow-2xl"
          style={{
            aspectRatio: "9 / 16",
            minHeight: 620,
            position: "relative",
            borderRadius: 30,
            border: "1px solid rgba(255,255,255,.35)",
            background: "#111",
          }}
        >
          {info.photoUrl ? (
            <img
              src={info.photoUrl}
              alt={couple}
              crossOrigin="anonymous"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: fitWholePhoto ? "contain" : "cover",
                objectPosition: photoObjectPosition,
                transform: `scale(${fitWholePhoto ? 1 : photoZoom})`,
                transformOrigin: photoObjectPosition,
                filter: photoEffectToFilter(info.photoEffect),
              }}
            />
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(145deg, rgba(255,255,255,.16), transparent 42%), linear-gradient(180deg, #333, #111)",
              }}
            />
          )}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, rgba(0,0,0,.26) 0%, rgba(0,0,0,.08) 34%, rgba(0,0,0,.76) 100%)",
            }}
          />
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: "34px 28px 38px", color: WHITE, textAlign: "center" }}>
            <div>
              <p style={{ fontFamily: LABEL_FONT, fontSize: 12, fontWeight: 700, letterSpacing: "0.34em", textTransform: "uppercase", margin: "0 0 10px", color: GOLD }}>
                Wedding RSVP
              </p>
              <div style={{ margin: "0 auto", width: 46, height: 28, position: "relative" }}>
                <Heart style={{ width: 24, height: 24, color: GOLD, opacity: 0.9, transform: "rotate(-14deg)" }} />
                <span style={{ position: "absolute", left: 20, right: 0, top: 18, height: 1, background: GOLD, opacity: 0.72 }} />
              </div>
              {rsvpByDateStr && (
                <p style={{ fontFamily: LABEL_FONT, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", margin: "8px 0 0", color: WHITE }}>
                  RSVP By {rsvpByDateStr}
                </p>
              )}
            </div>

            <div style={{ marginTop: "auto", marginBottom: 8 }}>
              <div style={{ fontFamily: SERIF, textTransform: "uppercase", letterSpacing: "0.18em", lineHeight: 1.15, color: GOLD }}>
                <div style={{ fontSize: "2.2rem", fontWeight: 500 }}>{brideFirst}</div>
                <div style={{ fontSize: "1.8rem", fontStyle: "italic", textTransform: "none", letterSpacing: "0.08em", margin: "4px 0" }}>and</div>
                <div style={{ fontSize: "2.2rem", fontWeight: 500 }}>{groomFirst}</div>
              </div>
              {weddingDateStr && (
                <p style={{ fontFamily: LABEL_FONT, fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: WHITE, margin: "18px 0 0" }}>
                  {weddingDateStr}
                </p>
              )}
              {(info.venue || venueCityStateZip || timesLine) && (
                <div style={{ marginTop: 12, padding: "9px 12px", borderTop: `1px solid ${GOLD}66`, borderBottom: `1px solid ${GOLD}66`, background: "rgba(0,0,0,.22)" }}>
                  {info.venue && (
                    <p style={{ fontFamily: SERIF, fontSize: "1rem", fontWeight: 600, color: GOLD, margin: 0, lineHeight: 1.25 }}>
                      {info.venue}
                    </p>
                  )}
                  {venueCityStateZip && (
                    <p style={{ fontFamily: LABEL_FONT, fontSize: 10, color: WHITE, margin: "4px 0 0", opacity: 0.88 }}>{venueCityStateZip}</p>
                  )}
                  {timesLine && (
                    <p style={{ fontFamily: LABEL_FONT, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: WHITE, margin: "7px 0 0", opacity: 0.92 }}>
                      {timesLine}
                    </p>
                  )}
                </div>
              )}
              {info.invitationMessage && (
                <p style={{ fontFamily: SERIF, fontSize: "0.95rem", fontStyle: "italic", color: WHITE, opacity: 0.9, lineHeight: 1.55, margin: "13px 0 0" }}>
                  &ldquo;{info.invitationMessage}&rdquo;
                </p>
              )}
              <p style={{ fontFamily: LABEL_FONT, fontSize: 10.5, color: WHITE, margin: "13px 0 0" }}>
                Dear <span style={{ fontWeight: 700 }}>{info.guestName}</span>, will you be joining us?
              </p>
              <div style={{ marginTop: 13, background: GOLD, borderRadius: 8, padding: "11px 14px", textAlign: "center" }}>
                <span style={{ fontFamily: LABEL_FONT, fontSize: 11.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: isLightHex(GOLD) ? "#1a1a1a" : "#ffffff" }}>
                  RSVP Now
                </span>
              </div>
              {info.websiteUrl && (
                <a
                  href={info.websiteUrl}
                  style={{
                    display: "block",
                    marginTop: 10,
                    fontFamily: LABEL_FONT,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: GOLD,
                    textDecoration: "underline",
                    overflowWrap: "anywhere",
                  }}
                >
                  Wedding Website
                </a>
              )}
            </div>
          </div>
        </div>
        ) : (
        <div
          ref={cardRef}
          className="w-full rounded-2xl overflow-hidden shadow-2xl"
          style={{ background: BG, border: `1px solid ${CARD_BDR}` }}
        >
          {/* Photo */}
          {info.photoUrl && (
            <div style={{ padding: "20px 20px 12px", backgroundImage: DOT_PAT, backgroundSize: "22px 22px" }}>
              <div style={{ height: 200, borderRadius: 8, overflow: "hidden", boxShadow: "0 6px 30px rgba(0,0,0,0.5)" }}>
              <img
                src={info.photoUrl}
                alt={couple}
                crossOrigin="anonymous"
                style={{
                  width: "100%", height: "100%", objectFit: fitWholePhoto ? "contain" : "cover",
                  objectPosition: photoObjectPosition,
                  transform: `scale(${fitWholePhoto ? 1 : photoZoom})`,
                  transformOrigin: photoObjectPosition,
                  filter: photoEffectToFilter(info.photoEffect),
                  display: "block",
                }}
              />
              </div>
            </div>
          )}

          {/* Content */}
          <div style={{ backgroundImage: DOT_PAT, backgroundSize: "22px 22px", backgroundColor: BG, padding: info.photoUrl ? "16px 28px 32px" : "24px 28px 32px", textAlign: "center" }}>

            {/* Badge */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
              <div style={{
                width: 52, height: 52, borderRadius: "50%",
                background: `${GOLD}22`, boxShadow: `0 0 0 1px ${GOLD}44`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Heart style={{ width: 22, height: 22, color: GOLD, fill: GOLD }} />
              </div>
            </div>

            {/* "Wedding RSVP" label */}
            <p style={{ fontFamily: jakarta, fontSize: 11, fontWeight: 700, letterSpacing: "0.42em", textTransform: "uppercase", color: GOLD, margin: "0 0 10px" }}>
              Wedding RSVP
            </p>

            {/* Couple name */}
            <h1 style={{ fontFamily: cormorant, fontSize: "2.3rem", fontWeight: 400, fontStyle: "italic", color: COUPLE_COLOR, lineHeight: 1.2, margin: "0 0 16px" }}>
              {couple}
            </h1>

            {/* Divider */}
            <div style={{ height: 1, background: CARD_BDR, margin: "0 20px 16px" }} />

            {/* Date */}
            {weddingDateStr && (
              <p style={{ fontFamily: jakarta, fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: WHITE, margin: "0 0 10px" }}>
                {weddingDateStr}
              </p>
            )}

            {/* Venue / Ceremony layout */}
            {hasSeparateCeremony ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "0 0 8px" }}>
                <div style={{ borderRadius: 8, padding: "10px 8px", textAlign: "center", background: "rgba(255,255,255,0.04)", border: `1px solid ${CARD_BDR}` }}>
                  <p style={{ fontFamily: jakarta, fontSize: 9, fontWeight: 700, letterSpacing: "0.35em", textTransform: "uppercase", color: GOLD, marginBottom: 6 }}>Ceremony</p>
                  {ceremonyTimeStr && <p style={{ fontFamily: jakarta, fontSize: 13, fontWeight: 600, color: WHITE }}>{ceremonyTimeStr}</p>}
                  {info.ceremonyVenueName && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, marginTop: 4 }}>
                      <MapPin style={{ width: 11, height: 11, color: GOLD, flexShrink: 0 }} />
                      <p style={{ fontFamily: cormorant, fontSize: "0.95rem", fontWeight: 500, color: GOLD, margin: 0 }}>{info.ceremonyVenueName}</p>
                    </div>
                  )}
                  {info.ceremonyAddress && <p style={{ fontFamily: jakarta, fontSize: 10, color: WHITE, marginTop: 2 }}>{info.ceremonyAddress}</p>}
                  {ceremonyCityStateZip && <p style={{ fontFamily: jakarta, fontSize: 10, color: WHITE }}>{ceremonyCityStateZip}</p>}
                </div>
                <div style={{ borderRadius: 8, padding: "10px 8px", textAlign: "center", background: "rgba(255,255,255,0.04)", border: `1px solid ${CARD_BDR}` }}>
                  <p style={{ fontFamily: jakarta, fontSize: 9, fontWeight: 700, letterSpacing: "0.35em", textTransform: "uppercase", color: GOLD, marginBottom: 6 }}>Reception</p>
                  {receptionTimeStr && <p style={{ fontFamily: jakarta, fontSize: 13, fontWeight: 600, color: WHITE }}>{receptionTimeStr}</p>}
                  {info.venue && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, marginTop: 4 }}>
                      <MapPin style={{ width: 11, height: 11, color: GOLD, flexShrink: 0 }} />
                      <p style={{ fontFamily: cormorant, fontSize: "0.95rem", fontWeight: 500, color: GOLD, margin: 0 }}>{info.venue}</p>
                    </div>
                  )}
                  {info.venueAddress && <p style={{ fontFamily: jakarta, fontSize: 10, color: WHITE, marginTop: 2 }}>{info.venueAddress}</p>}
                  {venueCityStateZip && <p style={{ fontFamily: jakarta, fontSize: 10, color: WHITE }}>{venueCityStateZip}</p>}
                </div>
              </div>
            ) : info.venue && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, margin: "0 0 4px" }}>
                  <MapPin style={{ width: 13, height: 13, color: GOLD, flexShrink: 0 }} />
                  <p style={{ fontFamily: cormorant, fontSize: "1.1rem", fontWeight: 500, color: GOLD, margin: 0 }}>{info.venue}</p>
                </div>
                {info.venueAddress && <p style={{ fontFamily: jakarta, fontSize: 11, color: WHITE, margin: "3px 0 0" }}>{info.venueAddress}</p>}
                {venueCityStateZip && <p style={{ fontFamily: jakarta, fontSize: 11, color: WHITE, margin: "2px 0 0" }}>{venueCityStateZip}</p>}
              </>
            )}

            {/* Times */}
            {timesLine && !hasSeparateCeremony && (
              <p style={{ fontFamily: jakarta, fontSize: 11, color: GOLD, margin: "8px 0 0" }}>{timesLine}</p>
            )}

            {/* RSVP By date — couple-set deadline so guests know when to reply. */}
            {rsvpByDateStr && (
              <p style={{ fontFamily: jakarta, fontSize: 11, fontWeight: 600,
                          letterSpacing: "0.12em", textTransform: "uppercase",
                          color: GOLD, margin: "10px 0 0" }}>
                RSVP By: <span style={{ color: WHITE, fontWeight: 600 }}>{rsvpByDateStr}</span>
              </p>
            )}

            {/* Invitation message */}
            {info.invitationMessage && (
              <p style={{ fontFamily: cormorant, fontSize: "1rem", fontStyle: "italic", color: WHITE, lineHeight: 1.7, margin: "16px 0 0" }}>
                &ldquo;{info.invitationMessage}&rdquo;
              </p>
            )}
            {info.websiteUrl && (
              <a
                href={info.websiteUrl}
                style={{
                  display: "block",
                  margin: "14px 0 0",
                  fontFamily: jakarta,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: GOLD,
                  textDecoration: "underline",
                  overflowWrap: "anywhere",
                }}
              >
                Wedding Website
              </a>
            )}
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${CARD_BDR}`, textAlign: "center" }}>
              <img
                src="/logo.png"
                alt="A.IDO"
                style={{ display: "block", height: 30, width: "auto", objectFit: "contain", margin: "0 auto 8px" }}
              />
              <p style={{ margin: 0, fontFamily: jakarta, fontSize: 10, color: MUTED, lineHeight: 1.45 }}>
                Planning your own wedding?{" "}
                <a href="https://aidowedding.net?theme=light" style={{ color: GOLD, fontWeight: 800, textDecoration: "none" }}>
                  Try A.IDO
                </a>
              </p>
              <p style={{ margin: "3px 0 0", fontFamily: jakarta, fontSize: 10, color: MUTED, lineHeight: 1.35 }}>
                <a href="https://aidowedding.net?theme=light" style={{ color: MUTED, textDecoration: "underline" }}>
                  aidowedding.net
                </a>
              </p>
            </div>

          </div>
        </div>
        )}
        </AnimatedInvitationShell>

        {/* Download button — dark pill so the white label reads on a white page. */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={downloadInvitationPdf}
            disabled={downloadingPdf}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: BG, border: `1px solid ${GOLD}55`,
              color: WHITE, fontFamily: jakarta, fontSize: 11, fontWeight: 600,
              letterSpacing: "0.18em", textTransform: "uppercase",
              padding: "12px 28px", borderRadius: 8, cursor: "pointer",
              opacity: downloadingPdf ? 0.5 : 1,
            }}
          >
            {downloadingPdf ? (
              <><Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> Generating PDF…</>
            ) : (
              <><Download style={{ width: 14, height: 14 }} /> Download Invitation (PDF)</>
            )}
          </button>
          {pdfError && (
            <p style={{ fontFamily: jakarta, fontSize: 11, color: "#f87171" }}>
              PDF generation failed — please try refreshing the page.
            </p>
          )}
        </div>

        {/* RSVP form card — uses the same dark/themed BG as the invitation card
            above so the white text + gold accents inside stay readable. The
            page outside is white; the card's dark fill stops at the rounded
            edge. */}
        <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ background: BG, border: `1px solid ${GOLD}33` }}>
          <div className="h-1.5 w-full" style={{ background: GOLD }} />
          <div className="pt-7 pb-8 px-6 sm:px-8 space-y-6">

            <p className="text-sm text-center" style={{ fontFamily: jakarta, color: MUTED }}>
              Dear <span style={{ color: WHITE, fontWeight: 600 }}>{info.guestName}</span>, will you be joining us?
            </p>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((d) => setPendingData(d))}
                className="space-y-6"
              >

                <FormField
                  control={form.control}
                  name="attendance"
                  render={({ field }) => (
                    <FormItem>
                      <FormMessage className="text-center" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => field.onChange("attending")}
                          className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all"
                          style={field.value === "attending"
                            ? { borderColor: "#22c55e", background: "rgba(34,197,94,0.12)", color: "#22c55e" }
                            : { borderColor: CARD_BDR, background: _bgIsLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.08)", color: MUTED }
                          }
                        >
                          <CheckCircle2 className="h-7 w-7" style={{ color: field.value === "attending" ? "#4ade80" : MUTED }} />
                          <span className="font-semibold text-sm">Joyfully Accepts</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => field.onChange("declined")}
                          className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all"
                          style={field.value === "declined"
                            ? { borderColor: "#ef4444", background: "rgba(239,68,68,0.12)", color: "#ef4444" }
                            : { borderColor: CARD_BDR, background: _bgIsLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.08)", color: MUTED }
                          }
                        >
                          <XCircle className="h-7 w-7" style={{ color: field.value === "declined" ? "#f87171" : MUTED }} />
                          <span className="font-semibold text-sm">Declines with Regrets</span>
                        </button>
                      </div>
                    </FormItem>
                  )}
                />

                {attendance === "attending" && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">

                    <FormField
                      control={form.control}
                      name="mealChoice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2" style={{ color: MUTED, fontFamily: jakarta }}>
                            <User className="h-3.5 w-3.5" style={{ color: MUTED }} />
                            Your Meal Selection
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger style={{ background: "rgba(255,255,255,0.05)", borderColor: CARD_BDR, color: WHITE, fontFamily: jakarta }}>
                                <SelectValue placeholder="Select a meal" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {mealOptions.map(o => (
                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="rounded-xl p-4 space-y-4" style={{ border: `1px solid ${GOLD}33`, background: `${GOLD}0d` }}>
                      <FormField
                        control={form.control}
                        name="plusOne"
                        render={({ field }) => (
                          <FormItem className="space-y-3">
                            <div>
                              <FormLabel className="text-base" style={{ color: WHITE, fontFamily: jakarta }}>Are you bringing a plus one?</FormLabel>
                              <p className="text-xs mt-0.5" style={{ color: MUTED, fontFamily: jakarta }}>You're welcome to bring a guest with you.</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => field.onChange(true)}
                                className="px-4 py-2 rounded-lg border transition-colors text-sm font-medium"
                                style={field.value
                                  ? { background: GOLD, borderColor: GOLD, color: BG, fontFamily: jakarta }
                                  : { background: "rgba(255,255,255,0.05)", borderColor: CARD_BDR, color: MUTED, fontFamily: jakarta }
                                }
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                onClick={() => field.onChange(false)}
                                className="px-4 py-2 rounded-lg border transition-colors text-sm font-medium"
                                style={!field.value
                                  ? { background: GOLD, borderColor: GOLD, color: BG, fontFamily: jakarta }
                                  : { background: "rgba(255,255,255,0.05)", borderColor: CARD_BDR, color: MUTED, fontFamily: jakarta }
                                }
                              >
                                No
                              </button>
                            </div>
                          </FormItem>
                        )}
                      />

                      {plusOne && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-150">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <FormField
                              control={form.control}
                              name="plusOneFirstName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel style={{ color: MUTED, fontFamily: jakarta }}>Guest first name</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="First name"
                                      style={{ background: "rgba(255,255,255,0.05)", borderColor: CARD_BDR, color: WHITE, fontFamily: jakarta }}
                                      className="placeholder:opacity-40"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="plusOneLastName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel style={{ color: MUTED, fontFamily: jakarta }}>Guest last name</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="Last name"
                                      style={{ background: "rgba(255,255,255,0.05)", borderColor: CARD_BDR, color: WHITE, fontFamily: jakarta }}
                                      className="placeholder:opacity-40"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={form.control}
                            name="plusOneMealChoice"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-2" style={{ color: MUTED, fontFamily: jakarta }}>
                                  <User className="h-3.5 w-3.5" style={{ color: MUTED }} />
                                  Plus-one Meal Selection
                                </FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger style={{ background: "rgba(255,255,255,0.05)", borderColor: CARD_BDR, color: WHITE, fontFamily: jakarta }}>
                                      <SelectValue placeholder="Select a meal for your guest" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {mealOptions.map(o => (
                                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                    </div>

                    {showHotelQuestion && (
                      <div className="rounded-xl p-4 space-y-4" style={{ border: `1px solid ${GOLD}33`, background: `${GOLD}0d` }}>
                        <FormField
                          control={form.control}
                          name="hotelNeeded"
                          render={({ field }) => (
                            <FormItem>
                              <div>
                                <FormLabel className="text-base" style={{ color: WHITE, fontFamily: jakarta }}>
                                  Will you need a hotel room?
                                </FormLabel>
                                <p className="text-xs mt-0.5" style={{ color: MUTED, fontFamily: jakarta }}>
                                  Let the couple know if you plan to book through their hotel block.
                                </p>
                              </div>
                              <Select
                                value={hotelResponse}
                                onValueChange={(value) => {
                                  field.onChange(value !== "no");
                                  handleHotelResponseChange(value as HotelResponse);
                                }}
                              >
                                <FormControl>
                                  <SelectTrigger style={{ background: "rgba(255,255,255,0.05)", borderColor: CARD_BDR, color: WHITE, fontFamily: jakarta }}>
                                    <SelectValue placeholder="Choose yes or no" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="no">No</SelectItem>
                                  <SelectItem value="yes">Yes</SelectItem>
                                  <SelectItem value="booked">I've already booked</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />

                        {hotelNeeded && (
                          <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
                            <FormField
                              control={form.control}
                              name="bookedHotelBlockId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel style={{ color: MUTED, fontFamily: jakarta }}>
                                    {hotelResponse === "booked" ? "Which hotel did you book?" : "Which hotel block will you book?"}
                                  </FormLabel>
                                  <Select
                                    value={field.value || "pending"}
                                    onValueChange={(value) => field.onChange(value === "pending" ? "" : value)}
                                  >
                                    <FormControl>
                                      <SelectTrigger style={{ background: "rgba(255,255,255,0.05)", borderColor: CARD_BDR, color: WHITE, fontFamily: jakarta }}>
                                        <SelectValue placeholder="Select a hotel block" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="pending">
                                        {hotelResponse === "booked" ? "I booked outside this block / not listed" : "I will decide later"}
                                      </SelectItem>
                                      {info.hotelOptions?.map((hotel) => (
                                        <SelectItem key={hotel.id} value={String(hotel.id)}>
                                          {hotel.hotelName || "Hotel block"}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="bookedHotelRoomCount"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel style={{ color: MUTED, fontFamily: jakarta }}>
                                    {hotelResponse === "booked" ? "How many rooms did you book?" : "How many rooms will you need?"}
                                  </FormLabel>
                                  <Select value={field.value || "1"} onValueChange={field.onChange}>
                                    <FormControl>
                                      <SelectTrigger style={{ background: "rgba(255,255,255,0.05)", borderColor: CARD_BDR, color: WHITE, fontFamily: jakarta }}>
                                        <SelectValue placeholder="Select room count" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="1">1 room</SelectItem>
                                      <SelectItem value="2">2 rooms</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {selectedHotel && (
                              <div
                                className="rounded-lg p-3 space-y-2 text-sm"
                                style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${CARD_BDR}`, color: WHITE, fontFamily: jakarta }}
                              >
                                <div>
                                  <p className="font-semibold">{selectedHotel.hotelName || "Hotel block"}</p>
                                  {hotelAddressLine(selectedHotel) && (
                                    <p className="text-xs mt-0.5" style={{ color: MUTED }}>
                                      {hotelAddressLine(selectedHotel)}
                                    </p>
                                  )}
                                  {selectedHotel.groupName && (
                                    <p className="text-xs mt-2" style={{ color: MUTED }}>
                                      <span className="font-semibold" style={{ color: WHITE }}>Wedding block:</span> {selectedHotel.groupName}
                                    </p>
                                  )}
                                  {selectedHotel.discountCode && (
                                    <p className="text-xs mt-1" style={{ color: MUTED }}>
                                      <span className="font-semibold" style={{ color: WHITE }}>Group code:</span>{" "}
                                      <span className="font-mono font-semibold tracking-wide" style={{ color: WHITE }}>{selectedHotel.discountCode}</span>
                                    </p>
                                  )}
                                  {selectedHotel.cutoffDate && (
                                    <p className="text-xs mt-1" style={{ color: MUTED }}>
                                      <span className="font-semibold" style={{ color: WHITE }}>Cutoff Date to Book:</span> {formatHotelCutoffDate(selectedHotel.cutoffDate)}
                                    </p>
                                  )}
                                  <p className="text-xs mt-1" style={{ color: MUTED }}>
                                    <span className="font-semibold" style={{ color: WHITE }}>Rooms:</span> {selectedHotelRoomCount === "2" ? "2 rooms" : "1 room"}
                                  </p>
                                </div>
                                {selectedHotel.bookingLink && (
                                  <a
                                    href={selectedHotel.bookingLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block text-center rounded-lg px-4 py-2 text-sm font-semibold"
                                    style={{ background: GOLD, color: BG }}
                                  >
                                    Open booking link
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <FormField
                      control={form.control}
                      name="dietaryRestrictions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel style={{ color: MUTED, fontFamily: jakarta }}>
                            Dietary Restrictions / Additional Notes
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="e.g. vegetarian, gluten-free, nut allergy — leave blank if none"
                              style={{ background: "rgba(255,255,255,0.05)", borderColor: CARD_BDR, color: WHITE, fontFamily: jakarta }}
                              className="placeholder:opacity-40 resize-none min-h-[80px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                  </div>
                )}

                {submit.isError && (
                  <p className="text-sm text-red-400 text-center" style={{ fontFamily: jakarta }}>
                    {submit.error instanceof Error ? submit.error.message : "Something went wrong."}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submit.isPending || !attendance}
                  className="w-full flex items-center justify-center gap-2 font-semibold py-4 rounded-xl transition-opacity disabled:opacity-50"
                  style={{ background: GOLD, color: BG, fontSize: "1rem", fontFamily: jakarta, cursor: "pointer" }}
                >
                  {submit.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>
                  ) : (
                    <><Heart className="h-4 w-4 mr-2 fill-current" /> Submit RSVP</>
                  )}
                </button>
              </form>
            </Form>
          </div>
        </div>

      </div>

      {/* Footer — page is white, so use a dark muted colour instead of the
          dark-card MUTED (white@55%) which would be invisible on white. */}
      <div style={{ marginTop: 28, textAlign: "center" }}>
        <img
          src="/logo.png"
          alt="A.IDO"
          style={{ display: "block", height: 30, width: "auto", objectFit: "contain", margin: "0 auto 8px" }}
        />
        <p style={{ fontFamily: jakarta, fontSize: 11, color: "rgba(0,0,0,0.55)", margin: 0 }}>
          Planning your own wedding?{" "}
          <a href="https://aidowedding.net?theme=light" style={{ color: GOLD, textDecoration: "none", fontWeight: 700 }}>
            Try A.IDO
          </a>
        </p>
        <p style={{ fontFamily: jakarta, fontSize: 11, color: "rgba(0,0,0,0.55)", margin: "3px 0 0" }}>
          <a href="https://aidowedding.net?theme=light" style={{ color: "rgba(0,0,0,0.55)", textDecoration: "underline" }}>
            aidowedding.net
          </a>
        </p>
      </div>

      <AlertDialog open={!!pendingData} onOpenChange={(open) => { if (!open) setPendingData(null); }}>
        <AlertDialogContent className="max-w-sm" style={{ backgroundColor: BG, borderColor: CARD_BDR, color: WHITE }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ fontFamily: cormorant, fontStyle: "italic", fontWeight: 400, fontSize: "1.4rem", color: WHITE, textAlign: "center" }}>
              Confirm Your RSVP
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-center" style={{ color: MUTED }}>
                <p style={{ fontFamily: jakarta }}>
                  Please review your details before sending your RSVP to{" "}
                  <span style={{ color: WHITE, fontWeight: 600 }}>{couple}</span>.
                </p>
                {pendingData && (
                  <div className="rounded-lg p-3 text-left space-y-1.5 text-xs" style={{ border: `1px solid ${CARD_BDR}`, background: "rgba(255,255,255,0.04)" }}>
                    <div className="flex justify-between">
                      <span style={{ color: MUTED, fontFamily: jakarta }}>Guest</span>
                      <span style={{ color: WHITE, fontWeight: 500, fontFamily: jakarta }}>{info?.guestName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: MUTED, fontFamily: jakarta }}>Response</span>
                      <span style={{ fontWeight: 500, fontFamily: jakarta, color: pendingData.attendance === "attending" ? "#4ade80" : "#f87171" }}>
                        {pendingData.attendance === "attending" ? "Joyfully Accepts" : "Declines with Regrets"}
                      </span>
                    </div>
                    {pendingData.attendance === "attending" && pendingData.mealChoice && (
                      <div className="flex justify-between">
                        <span style={{ color: MUTED, fontFamily: jakarta }}>Your Meal</span>
                        <span style={{ color: WHITE, fontWeight: 500, fontFamily: jakarta }}>{mealLabel(pendingData.mealChoice)}</span>
                      </div>
                    )}
                    {pendingData.plusOne && (pendingData.plusOneFirstName || pendingData.plusOneLastName) && (
                      <div className="flex justify-between">
                        <span style={{ color: MUTED, fontFamily: jakarta }}>Plus-one</span>
                        <span style={{ color: WHITE, fontWeight: 500, fontFamily: jakarta }}>{[pendingData.plusOneFirstName, pendingData.plusOneLastName].filter(Boolean).join(" ")}</span>
                      </div>
                    )}
                    {pendingData.plusOne && pendingData.plusOneMealChoice && (
                      <div className="flex justify-between">
                        <span style={{ color: MUTED, fontFamily: jakarta }}>Their Meal</span>
                        <span style={{ color: WHITE, fontWeight: 500, fontFamily: jakarta }}>{mealLabel(pendingData.plusOneMealChoice)}</span>
                      </div>
                    )}
                    {pendingData.dietaryRestrictions && (
                      <div className="flex flex-col gap-0.5 pt-1 border-t mt-1" style={{ borderColor: CARD_BDR }}>
                        <span style={{ color: MUTED, fontFamily: jakarta }}>Dietary / Notes</span>
                        <span style={{ color: WHITE, fontWeight: 500, fontFamily: jakarta }}>{pendingData.dietaryRestrictions}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel
              style={{ borderColor: CARD_BDR, background: "rgba(255,255,255,0.05)", color: MUTED, fontFamily: jakarta }}
              onClick={() => setPendingData(null)}
            >
              Go Back
            </AlertDialogCancel>
            <AlertDialogAction
              style={{ background: GOLD, color: BG, fontFamily: jakarta }}
              onClick={() => { if (pendingData) submit.mutate(pendingData); }}
              disabled={submit.isPending}
            >
              {submit.isPending ? (
                <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Sending...</>
              ) : (
                <><Heart className="h-4 w-4 mr-1.5 fill-current" /> Confirm & Send</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
