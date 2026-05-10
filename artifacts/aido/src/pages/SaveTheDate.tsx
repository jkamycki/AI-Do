import { useState, useRef } from "react";
import { apiFetch } from "@/lib/authFetch";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Download, AlertCircle, Mail } from "lucide-react";

interface SaveTheDateInfo {
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
  saveTheDateMessage: string | null;
  hasPhoto: boolean;
  photoVersion: string;
  useGeneratedInvitation: boolean;
  customBackgroundColor: string | null;
  customAccentColor: string | null;
  customFontFamily: string | null;
  customFontColor: string | null;
  customFontSize: string | null;
  customTextOverrides: Record<string, Record<string, unknown>>;
  photoObjectPosition: string;
  customColorPalette: Record<string, string> | null;
  customLayout: string | null;
}

const AI_BG    = "#1E1A2E";
const AI_GOLD  = "#D4A017";
const AI_WHITE = "#ffffff";
const AI_MUTED = "rgba(255,255,255,0.58)";
const AI_CARD_BDR = "rgba(255,255,255,0.12)";
const AI_DOT_PAT = `radial-gradient(${AI_GOLD}22 1px, transparent 1px)`;
const cormorant = "'Cormorant Garamond', 'Playfair Display', Georgia, serif";
const jakarta   = "'Plus Jakarta Sans', system-ui, sans-serif";

function isLightHex(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length !== 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 160;
}

export default function SaveTheDate() {
  const [, params] = useRoute("/save-the-date/:token");
  const token = params?.token ?? "";
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const { data: info, isLoading, isError } = useQuery({
    queryKey: ["save-the-date", token],
    queryFn: async () => {
      const res = await apiFetch(`/api/save-the-date/${token}`);
      if (!res.ok) throw new Error("Not found");
      return res.json() as Promise<SaveTheDateInfo>;
    },
    enabled: !!token,
    retry: false,
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

  const venueCityStateZip = [
    info?.venueCity,
    [info?.venueState, info?.venueZip].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ");

  // Derive theme from custom design or fall back to AI dark theme
  const useCustom = info && !info.useGeneratedInvitation && !!info.customBackgroundColor;
  const BG       = useCustom ? (info.customBackgroundColor!) : AI_BG;
  const GOLD     = useCustom ? (info.customAccentColor ?? AI_GOLD) : AI_GOLD;
  const isLight  = useCustom ? isLightHex(BG) : false;
  // In custom mode use the saved font color if available; otherwise derive from bg.
  const WHITE    = (useCustom && info?.customFontColor)
    ? info.customFontColor
    : (isLight ? "#1a1a1a" : AI_WHITE);
  const MUTED    = (useCustom && info?.customFontColor)
    ? info.customFontColor + "99"
    : (isLight ? "rgba(0,0,0,0.58)" : AI_MUTED);
  const CARD_BDR = isLight ? "rgba(0,0,0,0.12)" : AI_CARD_BDR;
  // The page sits *behind* the card in every mode. Always paint it light
  // grey so the card colour stops at the rounded edge — no bleed past the
  // card outline.
  const PAGE_BG  = "#f3f4f6";
  const DOT_PAT  = `radial-gradient(${GOLD}22 1px, transparent 1px)`;
  // Dot pattern was an AI-theme decoration on the dark page — drop it now
  // that the page is light, since gold dots on light grey read as noise.
  const PAGE_BG_PATTERN: string | undefined = undefined;
  const SERIF    = info?.customFontFamily
    ? `'${info.customFontFamily}', ${cormorant}`
    : cormorant;
  // In custom mode all text uses the custom font (matches AiSaveDatePreview.labelFont = displayFont).
  const LABEL_FONT = useCustom ? SERIF : jakarta;
  // Font size scaling: proportional to the custom base size, defaulting to 1 (no scaling).
  const sc = (useCustom && info?.customFontSize) ? parseFloat(info.customFontSize) / 16 : 1;

  // Respect any text overrides from the custom canvas design
  const overrides = info?.customTextOverrides ?? {};
  const coupleText = (overrides["std:couple"]?.text as string | undefined) || couple;
  const dateText   = (overrides["std:date"]?.text as string | undefined) || weddingDateStr || "";
  const defaultMsg = couple ? `Mark your calendar! ${couple} are getting married and we'd love to celebrate with you.` : null;
  const msgText    = (overrides["std:message"]?.text as string | undefined) || info?.saveTheDateMessage || defaultMsg;
  const photoPos   = info?.photoObjectPosition ?? "50% 50%";

  const downloadPdf = async () => {
    if (!info || !cardRef.current) return;
    setDownloadingPdf(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
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
      doc.save(`${safeCouple}_save_the_date.pdf`);
    } catch (err) {
      console.error("PDF generation failed", err);
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: AI_BG }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: AI_GOLD }} />
      </div>
    );
  }

  if (isError || !info) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: AI_BG, backgroundImage: AI_DOT_PAT, backgroundSize: "22px 22px" }}>
        <div className="max-w-md w-full text-center rounded-2xl p-10 space-y-4" style={{ border: `1px solid ${AI_CARD_BDR}`, background: AI_BG }}>
          <AlertCircle className="h-12 w-12 mx-auto" style={{ color: AI_GOLD }} />
          <h2 className="text-xl font-semibold" style={{ fontFamily: cormorant, color: AI_WHITE }}>This link is no longer valid</h2>
          <p className="text-sm" style={{ fontFamily: jakarta, color: AI_MUTED }}>Please contact the couple directly.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-4" style={{ background: PAGE_BG, backgroundImage: PAGE_BG_PATTERN, backgroundSize: PAGE_BG_PATTERN ? "22px 22px" : undefined }}>

      {/* Card — this is what gets captured for the PDF */}
      <div
        ref={cardRef}
        className="w-full rounded-2xl overflow-hidden shadow-2xl"
        style={{
          maxWidth: 420,
          background: BG,
          border: `1px solid ${CARD_BDR}`,
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 24, paddingBottom: 6, backgroundImage: DOT_PAT, backgroundSize: "22px 22px" }}>
          <img src="/logo.png" alt="A.IDO" style={{ height: 48, width: "auto", objectFit: "contain", opacity: 0.85 }} />
        </div>

        {/* Photo — rendered as background-image so html2canvas captures it correctly
            (html2canvas does not support object-fit/object-position on <img>) */}
        {info.hasPhoto && (
          <div style={{ padding: "0 20px 12px", backgroundImage: DOT_PAT, backgroundSize: "22px 22px" }}>
            <div
              style={{
                width: "100%", height: 200,
                backgroundImage: `url('/api/save-the-date/${token}/photo?v=${info.photoVersion}')`,
                backgroundSize: "cover",
                backgroundPosition: photoPos,
                borderRadius: 8,
                boxShadow: "0 6px 30px rgba(0,0,0,0.5)",
              }}
            />
          </div>
        )}

        {/* Content */}
        <div style={{ backgroundImage: DOT_PAT, backgroundSize: "22px 22px", backgroundColor: BG, padding: "16px 24px 28px", textAlign: "center" }}>

          {/* Badge */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <div style={{
              width: 52, height: 52, borderRadius: "50%",
              background: `${GOLD}22`, boxShadow: `0 0 0 1px ${GOLD}44`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Mail style={{ width: 22, height: 22, color: GOLD }} />
            </div>
          </div>

          {/* "Save the Date" label */}
          <p style={{ fontFamily: LABEL_FONT, fontSize: 11 * sc, fontWeight: 700, letterSpacing: "0.42em", textTransform: "uppercase", color: GOLD, margin: "0 0 10px" }}>
            Save the Date
          </p>

          {/* Couple name */}
          <h1 style={{ fontFamily: SERIF, fontSize: `${2.1 * sc}rem`, fontWeight: 400, fontStyle: "italic", color: GOLD, lineHeight: 1.2, margin: "0 0 16px" }}>
            {coupleText}
          </h1>

          {/* Divider */}
          <div style={{ height: 1, background: CARD_BDR, margin: "0 20px 16px" }} />

          {/* Date */}
          {dateText && (
            <p style={{ fontFamily: LABEL_FONT, fontSize: 11 * sc, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: WHITE, margin: "0 0 10px" }}>
              {dateText}
            </p>
          )}

          {venueCityStateZip && (
            <p style={{ fontFamily: LABEL_FONT, fontSize: 11 * sc, color: WHITE, margin: "3px 0 0" }}>{venueCityStateZip}</p>
          )}

          {/* Message */}
          {msgText && (
            <p style={{ fontFamily: SERIF, fontSize: `${1 * sc}rem`, fontStyle: "italic", color: WHITE, lineHeight: 1.7, margin: "16px 0 0" }}>
              &ldquo;{msgText}&rdquo;
            </p>
          )}

          {/* Formal invitation to follow */}
          <p style={{ fontFamily: SERIF, fontSize: 13 * sc, fontStyle: "italic", color: MUTED, margin: "14px 0 0" }}>
            Formal invitation to follow
          </p>

          {/* Download button — styled to match the preview's "View & Download" button */}
          <div style={{ marginTop: 16 }}>
            <button
              onClick={downloadPdf}
              disabled={downloadingPdf}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: `${GOLD}1a`, border: `1px solid ${CARD_BDR}`,
                color: MUTED, fontFamily: LABEL_FONT, fontSize: 10 * sc, fontWeight: 600,
                letterSpacing: "0.18em", textTransform: "uppercase",
                padding: "8px 20px", borderRadius: 6, cursor: "pointer",
                opacity: downloadingPdf ? 0.5 : 1,
              }}
            >
              {downloadingPdf ? (
                <><Loader2 style={{ width: Math.round(11 * sc), height: Math.round(11 * sc) }} className="animate-spin" /> Generating PDF…</>
              ) : (
                <><Download style={{ width: Math.round(11 * sc), height: Math.round(11 * sc) }} /> Download as PDF</>
              )}
            </button>
          </div>

        </div>

        {/* Footer — matches email card footer */}
        <div style={{ backgroundColor: BG, padding: "16px 24px", textAlign: "center", borderTop: `1px solid ${CARD_BDR}` }}>
          <p style={{ margin: "0 0 4px", fontFamily: jakarta, fontSize: 10, color: MUTED, letterSpacing: "0.5px" }}>Planning your own wedding?</p>
          <p style={{ margin: 0, fontFamily: jakarta, fontSize: 10, color: MUTED }}>
            <a href="https://aidowedding.net" style={{ color: GOLD, textDecoration: "none", fontWeight: 600 }}>Try A.IDO free</a> — AI-powered wedding planning
          </p>
        </div>

      </div>

    </div>
  );
}
