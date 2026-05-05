import { useState, useRef } from "react";
import { apiFetch } from "@/lib/authFetch";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Download, AlertCircle, MapPin, Mail } from "lucide-react";

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
  useGeneratedInvitation: boolean;
  customBackgroundColor: string | null;
  customAccentColor: string | null;
  customFontFamily: string | null;
  customTextOverrides: Record<string, Record<string, unknown>>;
  photoObjectPosition: string;
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
  const WHITE    = isLight ? "#1a1a1a" : AI_WHITE;
  const MUTED    = isLight ? "rgba(0,0,0,0.58)" : AI_MUTED;
  const CARD_BDR = isLight ? "rgba(0,0,0,0.12)" : AI_CARD_BDR;
  const PAGE_BG  = BG;
  const DOT_PAT  = `radial-gradient(${GOLD}22 1px, transparent 1px)`;
  const SERIF    = info?.customFontFamily
    ? `'${info.customFontFamily}', ${cormorant}`
    : cormorant;

  // Respect any text overrides from the custom canvas design
  const overrides = info?.customTextOverrides ?? {};
  const coupleText = (overrides["std:couple"]?.text as string | undefined) || couple;
  const dateText   = (overrides["std:date"]?.text as string | undefined) || weddingDateStr || "";
  const msgText    = (overrides["std:message"]?.text as string | undefined) || info?.saveTheDateMessage || null;
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
    <div className="min-h-screen flex flex-col items-center py-10 px-4" style={{ background: PAGE_BG, backgroundImage: DOT_PAT, backgroundSize: "22px 22px" }}>

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

        {/* Photo */}
        {info.hasPhoto && (
          <div style={{ padding: "0 20px 12px", backgroundImage: DOT_PAT, backgroundSize: "22px 22px" }}>
            <img
              src={`/api/save-the-date/${token}/photo`}
              alt={couple}
              crossOrigin="anonymous"
              style={{
                width: "100%", height: 200, objectFit: "cover",
                objectPosition: photoPos,
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
              <Mail style={{ width: 22, height: 22, color: GOLD }} />
            </div>
          </div>

          {/* "Save the Date" label */}
          <p style={{ fontFamily: jakarta, fontSize: 11, fontWeight: 700, letterSpacing: "0.42em", textTransform: "uppercase", color: GOLD, margin: "0 0 10px" }}>
            Save the Date
          </p>

          {/* Couple name */}
          <h1 style={{ fontFamily: SERIF, fontSize: "2.3rem", fontWeight: 400, fontStyle: "italic", color: GOLD, lineHeight: 1.2, margin: "0 0 16px" }}>
            {coupleText}
          </h1>

          {/* Divider */}
          <div style={{ height: 1, background: CARD_BDR, margin: "0 20px 16px" }} />

          {/* Date */}
          {dateText && (
            <p style={{ fontFamily: jakarta, fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: WHITE, margin: "0 0 10px" }}>
              {dateText}
            </p>
          )}

          {/* Venue */}
          {info.venue && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, margin: "0 0 4px" }}>
              <MapPin style={{ width: 13, height: 13, color: GOLD, flexShrink: 0 }} />
              <p style={{ fontFamily: SERIF, fontSize: "1.1rem", fontWeight: 500, color: GOLD, margin: 0 }}>
                {info.venue}
              </p>
            </div>
          )}

          {venueCityStateZip && (
            <p style={{ fontFamily: jakarta, fontSize: 11, color: WHITE, margin: "3px 0 0" }}>{venueCityStateZip}</p>
          )}

          {/* Message */}
          {msgText && (
            <p style={{ fontFamily: SERIF, fontSize: "1rem", fontStyle: "italic", color: WHITE, lineHeight: 1.7, margin: "16px 0 0" }}>
              &ldquo;{msgText}&rdquo;
            </p>
          )}

          {/* Formal invitation to follow */}
          <p style={{ fontFamily: SERIF, fontSize: 13, fontStyle: "italic", color: MUTED, margin: "14px 0 0" }}>
            Formal invitation to follow
          </p>

        </div>
      </div>

      {/* Download button — outside the captured card */}
      <div style={{ marginTop: 28 }}>
        <button
          onClick={downloadPdf}
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
            <><Download style={{ width: 14, height: 14 }} /> Download as PDF</>
          )}
        </button>
      </div>

      {/* Footer */}
      <p style={{ fontFamily: jakarta, fontSize: 11, color: MUTED, marginTop: 28, textAlign: "center" }}>
        Planning your own wedding?{" "}
        <a href="https://aidowedding.net" style={{ color: GOLD, textDecoration: "none", fontWeight: 600 }}>
          Try A.IDO free
        </a>
      </p>

    </div>
  );
}
