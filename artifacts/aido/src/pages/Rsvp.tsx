import { useState, useRef } from "react";
import { apiFetch } from "@/lib/authFetch";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  neutral: string;
}

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
  invitationMessage: string | null;
  // Custom design theming (optional — falls back to defaults)
  colorPalette: ColorPalette | null;
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

const DEFAULT_BG = "#1E1A2E";
const DEFAULT_ACCENT = "#D4A017";

function isLightColor(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length !== 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 160;
}

const jakarta = "'Plus Jakarta Sans', system-ui, sans-serif";

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

  const receptionCityStateZip = [
    info?.venueCity,
    [info?.venueState, info?.venueZip].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ");
  const receptionAddressLine1 = info?.venueAddress ?? "";

  const ceremonyCityStateZip = [
    info?.ceremonyCity,
    [info?.ceremonyState, info?.ceremonyZip].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ");
  const ceremonyAddressLine1 = info?.ceremonyAddress ?? "";

  const ceremonyTimeStr = formatTime(info?.ceremonyTime);
  const receptionTimeStr = formatTime(info?.receptionTime);

  const hasSeparateCeremony = !!(
    info && !info.ceremonyAtVenue &&
    (info.ceremonyVenueName || info.ceremonyAddress || info.ceremonyCity)
  );

  // ── Custom design theming ─────────────────────────────────────────────────
  const bg = info?.backgroundColor || DEFAULT_BG;
  const accent = info?.colorPalette?.primary || DEFAULT_ACCENT;
  const coupleFont = info?.font
    ? `'${info.font}', 'Cormorant Garamond', Georgia, serif`
    : "'Cormorant Garamond', 'Playfair Display', Georgia, serif";
  const light = isLightColor(bg);
  const textColor = light ? "#1a1a1a" : "#ffffff";
  const textMuted = light ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)";
  const textFaint = light ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.35)";
  const cardBg = light ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const cardBorder = light ? "rgba(0,0,0,0.14)" : "rgba(255,255,255,0.10)";
  const accentText = isLightColor(accent) ? "#1a1a1a" : "#ffffff";

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
        backgroundColor: "#1a141f",
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
      <div className="dark min-h-screen flex items-center justify-center bg-[hsl(270,20%,10%)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !info) {
    return (
      <div className="dark min-h-screen flex flex-col items-center justify-center p-4 bg-[hsl(270,20%,10%)]">
        <Card className="max-w-md w-full text-center shadow-xl border-white/10 bg-white/5">
          <CardContent className="pt-10 pb-8 space-y-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-semibold text-white">This RSVP link is no longer valid</h2>
            <p className="text-white/60 text-sm">The link may have expired or already been used. Please contact the couple directly.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    const accepted = finalStatus === "attending";
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4"
        style={{ backgroundColor: bg, backgroundImage: `radial-gradient(${accent}11 1px, transparent 1px)`, backgroundSize: "22px 22px" }}>
        <div className="max-w-md w-full text-center shadow-2xl overflow-hidden rounded-xl" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
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
              <h2 style={{ fontFamily: coupleFont, fontStyle: "italic", fontWeight: 400, fontSize: "2rem", color: textColor, marginBottom: "0.5rem" }}>
                {accepted ? "See you there!" : "We'll miss you!"}
              </h2>
              <p style={{ color: textMuted, fontSize: "0.875rem", lineHeight: 1.6 }}>
                {accepted
                  ? <><span>Thanks, </span><span style={{ color: textColor, fontWeight: 600 }}>{info.guestName}</span><span>! Your attendance has been confirmed for </span><span style={{ color: textColor, fontWeight: 600 }}>{couple}'s</span><span> wedding.</span></>
                  : <><span>Thanks for letting us know, </span><span style={{ color: textColor, fontWeight: 600 }}>{info.guestName}</span><span>. </span><span style={{ color: textColor, fontWeight: 600 }}>{couple}</span><span> appreciate you responding.</span></>
                }
              </p>
              {accepted && weddingDateStr && (
                <p style={{ color: textFaint, fontSize: "0.75rem", marginTop: "0.75rem" }}>{weddingDateStr}{info.venue ? ` · ${info.venue}` : ""}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col"
      style={{ backgroundColor: bg, backgroundImage: `radial-gradient(${accent}11 1px, transparent 1px)`, backgroundSize: "22px 22px" }}>

      <div className="flex-1 flex flex-col items-center py-10 px-4">
        <div className="max-w-lg w-full space-y-6">

          {/* Invitation card — captured by html2canvas for PDF */}
          <div ref={cardRef} style={{ backgroundColor: bg }}>

            <div className="w-full flex justify-center pt-6 px-4">
              <img
                src="/logo.png"
                alt="A.IDO"
                className="h-28 sm:h-36 w-auto object-contain"
              />
            </div>

            {info.hasPhoto && (
              <div className="w-full flex justify-center pt-6 px-4">
                <img
                  src={`/api/rsvp/${token}/photo`}
                  alt={`${couple}'s wedding`}
                  crossOrigin="anonymous"
                  className="w-full max-w-md h-auto block rounded-lg"
                  style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}
                />
              </div>
            )}

            <div className="text-center space-y-4 py-4 px-4">
              <div className="flex justify-center mb-2">
                <div className="h-16 w-16 rounded-full flex items-center justify-center shadow-md"
                  style={{ background: `${accent}22`, boxShadow: `0 0 0 1px ${accent}44` }}>
                  <Heart className="h-8 w-8" style={{ color: accent, fill: accent }} />
                </div>
              </div>
              <div>
                <p style={{ fontFamily: jakarta, fontSize: "10px", fontWeight: 600, letterSpacing: "0.4em", textTransform: "uppercase", color: accent, marginBottom: "0.75rem" }}>
                  Wedding RSVP
                </p>
                <h1 style={{ fontFamily: coupleFont, fontSize: "clamp(2.2rem,7vw,3.2rem)", fontWeight: 400, fontStyle: "italic", color: textColor, lineHeight: 1.15, letterSpacing: "0.02em" }}>
                  {couple}
                </h1>
                {weddingDateStr && (
                  <p style={{ fontFamily: jakarta, fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase", color: textMuted, marginTop: "0.5rem" }}>{weddingDateStr}</p>
                )}
                {hasSeparateCeremony ? (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
                    <div className="rounded-lg p-3 text-center" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                      <p style={{ fontFamily: jakarta, fontSize: "9px", fontWeight: 700, letterSpacing: "0.35em", textTransform: "uppercase", color: accent, marginBottom: "6px" }}>Ceremony</p>
                      {ceremonyTimeStr && (
                        <p style={{ fontFamily: jakarta, fontSize: "14px", fontWeight: 600, color: textColor }}>{ceremonyTimeStr}</p>
                      )}
                      {info.ceremonyVenueName && (
                        <div className="mt-1 flex items-center justify-center gap-1">
                          <MapPin className="h-3 w-3" style={{ color: accent }} />
                          <p style={{ fontFamily: coupleFont, fontSize: "15px", fontWeight: 500, color: textMuted }}>{info.ceremonyVenueName}</p>
                        </div>
                      )}
                      {ceremonyAddressLine1 && (
                        <p style={{ fontFamily: jakarta, fontSize: "11px", color: textFaint, marginTop: "2px" }}>{ceremonyAddressLine1}</p>
                      )}
                      {ceremonyCityStateZip && (
                        <p style={{ fontFamily: jakarta, fontSize: "11px", color: textFaint }}>{ceremonyCityStateZip}</p>
                      )}
                    </div>
                    <div className="rounded-lg p-3 text-center" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                      <p style={{ fontFamily: jakarta, fontSize: "9px", fontWeight: 700, letterSpacing: "0.35em", textTransform: "uppercase", color: accent, marginBottom: "6px" }}>Reception</p>
                      {receptionTimeStr && (
                        <p style={{ fontFamily: jakarta, fontSize: "14px", fontWeight: 600, color: textColor }}>{receptionTimeStr}</p>
                      )}
                      {info.venue && (
                        <div className="mt-1 flex items-center justify-center gap-1">
                          <MapPin className="h-3 w-3" style={{ color: accent }} />
                          <p style={{ fontFamily: coupleFont, fontSize: "15px", fontWeight: 500, color: textMuted }}>{info.venue}</p>
                        </div>
                      )}
                      {receptionAddressLine1 && (
                        <p style={{ fontFamily: jakarta, fontSize: "11px", color: textFaint, marginTop: "2px" }}>{receptionAddressLine1}</p>
                      )}
                      {receptionCityStateZip && (
                        <p style={{ fontFamily: jakarta, fontSize: "11px", color: textFaint }}>{receptionCityStateZip}</p>
                      )}
                    </div>
                  </div>
                ) : info.venue && (
                  <div className="mt-2 flex flex-col items-center gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" style={{ color: accent }} />
                      <p style={{ fontFamily: coupleFont, fontSize: "18px", fontWeight: 500, color: textMuted }}>{info.venue}</p>
                    </div>
                    {receptionAddressLine1 && (
                      <p style={{ fontFamily: jakarta, fontSize: "12px", color: textFaint }}>{receptionAddressLine1}</p>
                    )}
                    {receptionCityStateZip && (
                      <p style={{ fontFamily: jakarta, fontSize: "12px", color: textFaint }}>{receptionCityStateZip}</p>
                    )}
                    {(ceremonyTimeStr || receptionTimeStr) && (
                      <p style={{ fontFamily: jakarta, fontSize: "12px", color: textMuted, marginTop: "4px" }}>
                        {[
                          ceremonyTimeStr && `Ceremony ${ceremonyTimeStr}`,
                          receptionTimeStr && `Reception ${receptionTimeStr}`,
                        ].filter(Boolean).join("  ·  ")}
                      </p>
                    )}
                  </div>
                )}
                {info.invitationMessage && (
                  <p style={{ fontFamily: coupleFont, fontSize: "18px", fontStyle: "italic", lineHeight: 1.7, color: textMuted, marginTop: "1rem", maxWidth: "28rem", margin: "1rem auto 0" }}>
                    &ldquo;{info.invitationMessage}&rdquo;
                  </p>
                )}
                <div className="pt-3 flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={downloadInvitationPdf}
                    disabled={downloadingPdf}
                    className="flex items-center gap-2 transition-opacity hover:opacity-80 disabled:opacity-50"
                    style={{ background: cardBg, color: textMuted, fontFamily: jakarta, fontSize: "11px", fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", padding: "0.6rem 1.5rem", borderRadius: "6px", border: `1px solid ${cardBorder}`, cursor: "pointer" }}
                  >
                    {downloadingPdf ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating PDF&hellip;</>
                    ) : (
                      <><Download className="h-3.5 w-3.5" /> Download Invitation (PDF)</>
                    )}
                  </button>
                  {pdfError && (
                    <p style={{ fontFamily: jakarta, fontSize: "11px", color: "#f87171" }}>
                      PDF generation failed — please try refreshing the page.
                    </p>
                  )}
                </div>
              </div>
            </div>

          </div>{/* end cardRef */}

          {/* Divider */}
          <div style={{ height: 1, background: cardBorder, margin: "0 1rem" }} />

          {/* RSVP form card */}
          <div className="shadow-2xl overflow-hidden rounded-xl" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
            <div className="h-1.5 w-full" style={{ background: accent }} />
            <div className="pt-7 pb-8 px-6 sm:px-8 space-y-6">

              <p className="text-sm text-center" style={{ color: textMuted }}>
                Dear <span style={{ color: textColor, fontWeight: 600 }}>{info.guestName}</span>, will you be joining us?
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
                              : { borderColor: cardBorder, background: cardBg, color: textMuted }
                            }
                          >
                            <CheckCircle2 className="h-7 w-7" style={{ color: field.value === "attending" ? "#4ade80" : textFaint }} />
                            <span className="font-semibold text-sm">Joyfully Accepts</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => field.onChange("declined")}
                            className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all"
                            style={field.value === "declined"
                              ? { borderColor: "#ef4444", background: "rgba(239,68,68,0.12)", color: "#fca5a5" }
                              : { borderColor: cardBorder, background: cardBg, color: textMuted }
                            }
                          >
                            <XCircle className="h-7 w-7" style={{ color: field.value === "declined" ? "#f87171" : textFaint }} />
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
                            <FormLabel className="flex items-center gap-2" style={{ color: textMuted }}>
                              <User className="h-3.5 w-3.5" style={{ color: textFaint }} />
                              Your Meal Selection
                            </FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger style={{ background: cardBg, borderColor: cardBorder, color: textColor }}>
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

                      {(
                      <div className="rounded-xl p-4 space-y-4" style={{ border: `1px solid ${accent}33`, background: `${accent}0d` }}>
                        <FormField
                          control={form.control}
                          name="plusOne"
                          render={({ field }) => (
                            <FormItem className="space-y-3">
                              <div>
                                <FormLabel className="text-base" style={{ color: textColor }}>Are you bringing a plus one?</FormLabel>
                                <p className="text-xs mt-0.5" style={{ color: textFaint }}>You're welcome to bring a guest with you.</p>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => field.onChange(true)}
                                  className="px-4 py-2 rounded-lg border transition-colors text-sm font-medium"
                                  style={field.value
                                    ? { background: accent, borderColor: accent, color: accentText }
                                    : { background: cardBg, borderColor: cardBorder, color: textMuted }
                                  }
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  onClick={() => field.onChange(false)}
                                  className="px-4 py-2 rounded-lg border transition-colors text-sm font-medium"
                                  style={!field.value
                                    ? { background: accent, borderColor: accent, color: accentText }
                                    : { background: cardBg, borderColor: cardBorder, color: textMuted }
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
                                    <FormLabel style={{ color: textMuted }}>Guest first name</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="First name"
                                        style={{ background: cardBg, borderColor: cardBorder, color: textColor }}
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
                                    <FormLabel style={{ color: textMuted }}>Guest last name</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="Last name"
                                        style={{ background: cardBg, borderColor: cardBorder, color: textColor }}
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
                                  <FormLabel className="flex items-center gap-2" style={{ color: textMuted }}>
                                    <User className="h-3.5 w-3.5" style={{ color: textFaint }} />
                                    Plus-one Meal Selection
                                  </FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger style={{ background: cardBg, borderColor: cardBorder, color: textColor }}>
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
                      )}

                      <FormField
                        control={form.control}
                        name="dietaryRestrictions"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel style={{ color: textMuted }}>
                              Dietary Restrictions / Additional Notes
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="e.g. vegetarian, gluten-free, nut allergy — leave blank if none"
                                style={{ background: cardBg, borderColor: cardBorder, color: textColor }}
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
                    <p className="text-sm text-red-400 text-center">
                      {submit.error instanceof Error ? submit.error.message : "Something went wrong."}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submit.isPending || !attendance}
                    className="w-full flex items-center justify-center gap-2 font-semibold py-4 rounded-xl transition-opacity disabled:opacity-50"
                    style={{ background: accent, color: accentText, fontSize: "1rem" }}
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
      </div>

      <AlertDialog open={!!pendingData} onOpenChange={(open) => { if (!open) setPendingData(null); }}>
        <AlertDialogContent className="max-w-sm" style={{ backgroundColor: bg, borderColor: cardBorder, color: textColor }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ fontFamily: coupleFont, fontStyle: "italic", fontWeight: 400, fontSize: "1.4rem", color: textColor, textAlign: "center" }}>
              Confirm Your RSVP
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-center" style={{ color: textMuted }}>
                <p>
                  Please review your details before sending your RSVP to{" "}
                  <span style={{ color: textColor, fontWeight: 600 }}>{couple}</span>.
                </p>
                {pendingData && (
                  <div className="rounded-lg p-3 text-left space-y-1.5 text-xs" style={{ border: `1px solid ${cardBorder}`, background: cardBg }}>
                    <div className="flex justify-between">
                      <span style={{ color: textFaint }}>Guest</span>
                      <span style={{ color: textColor, fontWeight: 500 }}>{info?.guestName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: textFaint }}>Response</span>
                      <span style={{ fontWeight: 500, color: pendingData.attendance === "attending" ? "#4ade80" : "#f87171" }}>
                        {pendingData.attendance === "attending" ? "Joyfully Accepts" : "Declines with Regrets"}
                      </span>
                    </div>
                    {pendingData.attendance === "attending" && pendingData.mealChoice && (
                      <div className="flex justify-between">
                        <span style={{ color: textFaint }}>Your Meal</span>
                        <span style={{ color: textColor, fontWeight: 500 }}>{mealLabel(pendingData.mealChoice)}</span>
                      </div>
                    )}
                    {pendingData.plusOne && (pendingData.plusOneFirstName || pendingData.plusOneLastName) && (
                      <div className="flex justify-between">
                        <span style={{ color: textFaint }}>Plus-one</span>
                        <span style={{ color: textColor, fontWeight: 500 }}>{[pendingData.plusOneFirstName, pendingData.plusOneLastName].filter(Boolean).join(" ")}</span>
                      </div>
                    )}
                    {pendingData.plusOne && pendingData.plusOneMealChoice && (
                      <div className="flex justify-between">
                        <span style={{ color: textFaint }}>Their Meal</span>
                        <span style={{ color: textColor, fontWeight: 500 }}>{mealLabel(pendingData.plusOneMealChoice)}</span>
                      </div>
                    )}
                    {pendingData.dietaryRestrictions && (
                      <div className="flex flex-col gap-0.5 pt-1 border-t mt-1" style={{ borderColor: cardBorder }}>
                        <span style={{ color: textFaint }}>Dietary / Notes</span>
                        <span style={{ color: textColor, fontWeight: 500 }}>{pendingData.dietaryRestrictions}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel
              style={{ borderColor: cardBorder, background: cardBg, color: textMuted }}
              onClick={() => setPendingData(null)}
            >
              Go Back
            </AlertDialogCancel>
            <AlertDialogAction
              style={{ background: accent, color: accentText }}
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
