import { useState, useRef } from "react";
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

const schema = z.object({
  attendance: z.enum(["attending", "declined"], { required_error: "Please select Accept or Decline." }),
  mealChoice: z.string().optional(),
  plusOne: z.boolean().default(false),
  plusOneFirstName: z.string().optional(),
  plusOneLastName: z.string().optional(),
  plusOneMealChoice: z.string().optional(),
  dietaryRestrictions: z.string().optional(),
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

const MEAL_OPTIONS = [
  { value: "chicken", label: "Chicken" },
  { value: "steak", label: "Steak" },
  { value: "fish", label: "Fish" },
  { value: "none", label: "None / No preference" },
];

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
  invitationMessage: string | null;
  colorPalette: { primary: string; secondary: string; accent: string; neutral: string } | null;
  backgroundColor: string | null;
  font: string | null;
  layout: string | null;
}

function formatTime(timeStr: string | null | undefined) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return timeStr;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

const DEFAULT_BG   = "#1E1A2E";
const DEFAULT_GOLD = "#D4A017";
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

export default function Rsvp() {
  const [, params] = useRoute("/rsvp/:token");
  const token = params?.token ?? "";
  const [submitted, setSubmitted] = useState(false);
  const [finalStatus, setFinalStatus] = useState<"attending" | "declined" | null>(null);
  const [pendingData, setPendingData] = useState<FormData | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

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
    },
  });

  const attendance = form.watch("attendance");
  const plusOne = form.watch("plusOne");

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
  const BG = info?.backgroundColor || DEFAULT_BG;
  const GOLD = info?.colorPalette?.primary || DEFAULT_GOLD;
  const _bgIsLight = isLightHex(BG);
  const WHITE = _bgIsLight ? "#1a1a1a" : "#ffffff";
  const MUTED = _bgIsLight ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)";
  const CARD_BDR = _bgIsLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)";
  const DOT_PAT = `radial-gradient(${GOLD}22 1px, transparent 1px)`;

  const couple = [info?.partner1Name, info?.partner2Name].filter(Boolean).join(" & ") || "The Couple";

  const weddingDateStr = info?.weddingDate
    ? (() => {
        const [y, m, d] = info.weddingDate.split("-").map(Number);
        return new Date(y, m - 1, d).toLocaleDateString("en-US", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
        });
      })()
    : null;

  const mealLabel = (val?: string) => MEAL_OPTIONS.find(o => o.value === val)?.label ?? val ?? "—";

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

  const downloadInvitationPdf = async () => {
    if (!info || !cardRef.current) return;
    setDownloadingPdf(true);
    setPdfError(false);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: BG,
        logging: false,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const PAGE_W = 595;
      const imgW = PAGE_W;
      const imgH = (canvas.height / canvas.width) * imgW;

      const doc = new jsPDF({ orientation: "p", unit: "pt", format: [PAGE_W, imgH + 1] });
      doc.addImage(imgData, "JPEG", 0, 0, imgW, imgH);

      const safeCouple = couple.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_") || "wedding";
      doc.save(`${safeCouple}_invitation.pdf`);
    } catch (err) {
      console.error("PDF generation failed", err);
      setPdfError(true);
    } finally {
      setDownloadingPdf(false);
    }
  };

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
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-4"
      style={{ background: BG, backgroundImage: DOT_PAT, backgroundSize: "22px 22px" }}>

      <div className="w-full space-y-6" style={{ maxWidth: 420 }}>

        {/* Invitation card — captured by html2canvas for PDF */}
        <div
          ref={cardRef}
          className="w-full rounded-2xl overflow-hidden shadow-2xl"
          style={{ background: BG, border: `1px solid ${CARD_BDR}` }}
        >
          {/* Logo */}
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 24, paddingBottom: 6, backgroundImage: DOT_PAT, backgroundSize: "22px 22px" }}>
            <img src="/logo.png" alt="A.IDO" style={{ height: 48, width: "auto", objectFit: "contain", opacity: 0.85 }} />
          </div>

          {/* Photo */}
          {info.photoUrl && (
            <div style={{ padding: "0 20px 12px", backgroundImage: DOT_PAT, backgroundSize: "22px 22px" }}>
              <img
                src={info.photoUrl}
                alt={couple}
                crossOrigin="anonymous"
                style={{
                  width: "100%", height: 200, objectFit: "cover",
                  objectPosition: info.photoObjectPosition ?? "50% 50%",
                  borderRadius: 8, display: "block",
                  boxShadow: "0 6px 30px rgba(0,0,0,0.5)",
                }}
              />
            </div>
          )}

          {/* Content */}
          <div style={{ backgroundImage: DOT_PAT, backgroundSize: "22px 22px", backgroundColor: BG, padding: "16px 28px 32px", textAlign: "center" }}>

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
            <h1 style={{ fontFamily: cormorant, fontSize: "2.3rem", fontWeight: 400, fontStyle: "italic", color: GOLD, lineHeight: 1.2, margin: "0 0 16px" }}>
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

            {/* Invitation message */}
            {info.invitationMessage && (
              <p style={{ fontFamily: cormorant, fontSize: "1rem", fontStyle: "italic", color: WHITE, lineHeight: 1.7, margin: "16px 0 0" }}>
                &ldquo;{info.invitationMessage}&rdquo;
              </p>
            )}

          </div>
        </div>{/* end cardRef */}

        {/* Download button */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={downloadInvitationPdf}
            disabled={downloadingPdf}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "rgba(255,255,255,0.06)", border: `1px solid ${CARD_BDR}`,
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

        {/* Divider */}
        <div style={{ height: 1, background: CARD_BDR }} />

        {/* RSVP form card */}
        <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${CARD_BDR}` }}>
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
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => field.onChange("attending")}
                          className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all"
                          style={field.value === "attending"
                            ? { borderColor: "#22c55e", background: "rgba(34,197,94,0.12)", color: "#86efac" }
                            : { borderColor: CARD_BDR, background: "rgba(255,255,255,0.04)", color: MUTED }
                          }
                        >
                          <CheckCircle2 className="h-7 w-7" style={{ color: field.value === "attending" ? "#4ade80" : "rgba(255,255,255,0.3)" }} />
                          <span className="font-semibold text-sm">Joyfully Accepts</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => field.onChange("declined")}
                          className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all"
                          style={field.value === "declined"
                            ? { borderColor: "#ef4444", background: "rgba(239,68,68,0.12)", color: "#fca5a5" }
                            : { borderColor: CARD_BDR, background: "rgba(255,255,255,0.04)", color: MUTED }
                          }
                        >
                          <XCircle className="h-7 w-7" style={{ color: field.value === "declined" ? "#f87171" : "rgba(255,255,255,0.3)" }} />
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
                            <User className="h-3.5 w-3.5" style={{ color: "rgba(255,255,255,0.3)" }} />
                            Your Meal Selection
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger style={{ background: "rgba(255,255,255,0.05)", borderColor: CARD_BDR, color: WHITE, fontFamily: jakarta }}>
                                <SelectValue placeholder="Select a meal" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {MEAL_OPTIONS.map(o => (
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
                            <div className="grid grid-cols-2 gap-2">
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
                                  <User className="h-3.5 w-3.5" style={{ color: "rgba(255,255,255,0.3)" }} />
                                  Plus-one Meal Selection
                                </FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger style={{ background: "rgba(255,255,255,0.05)", borderColor: CARD_BDR, color: WHITE, fontFamily: jakarta }}>
                                      <SelectValue placeholder="Select a meal for your guest" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {MEAL_OPTIONS.map(o => (
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

      {/* Footer */}
      <p style={{ fontFamily: jakarta, fontSize: 11, color: MUTED, marginTop: 28, textAlign: "center" }}>
        Planning your own wedding?{" "}
        <a href="https://aidowedding.net" style={{ color: GOLD, textDecoration: "none", fontWeight: 600 }}>
          Try A.IDO free
        </a>
      </p>

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
