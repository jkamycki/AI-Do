import { useState, useRef } from "react";
import { apiFetch } from "@/lib/authFetch";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Download, AlertCircle, Heart } from "lucide-react";
import { AnimatedInvitationShell } from "@/components/InvitationCustomization/AnimatedInvitationShell";
import { photoEffectToFilter } from "@/components/InvitationCustomization/AiPreviewComponents";

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
  photoZoom?: number | null;
  photoEffect?: string | null;
  customColorPalette: Record<string, string> | null;
  customLayout: string | null;
}

const AI_BG    = "#FFF7F2";
const AI_GOLD  = "#8D294D";
const AI_WHITE = "#3B1C2B";
const AI_MUTED = "#6F3E54";
const AI_CARD_BDR = "rgba(230,166,183,0.55)";
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

  const couple = [info?.partner2Name, info?.partner1Name].filter(Boolean).join(" & ") || "The Couple";

  const weddingDateStr = info?.weddingDate
    ? (() => {
        const [y, m, d] = info.weddingDate.split("-").map(Number);
        return new Date(y, m - 1, d).toLocaleDateString("en-US", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
        });
      })()
    : null;

  const venueCityState = [
    info?.venueCity,
    info?.venueState,
  ].filter(Boolean).join(", ");

  // Derive theme from custom design or fall back to the AI brand theme
  const useCustom = info && !info.useGeneratedInvitation && !!info.customBackgroundColor;
  const BG       = useCustom ? (info.customBackgroundColor!) : AI_BG;
  const GOLD     = useCustom ? (info.customAccentColor ?? AI_GOLD) : AI_GOLD;
  const isLight  = isLightHex(BG);
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
  const PAGE_BG  = "#FFF7F2";
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
  const photoZoom  = Math.max(1, Math.min(2.5, Number(info?.photoZoom ?? 1) || 1));
  const photoBgSize = photoZoom === 1 ? "cover" : `${100 * photoZoom}%`;
  const photoFilter = photoEffectToFilter(info?.photoEffect);
  const isFullPhotoLayout = false;
  const groomFirst = String(info?.partner1Name || "").trim().split(/\s+/)[0] || "Partner";
  const brideFirst = String(info?.partner2Name || "").trim().split(/\s+/)[0] || "Partner";

  const downloadPdf = async () => {
    if (!info || !cardRef.current) return;
    setDownloadingPdf(true);
    const pdfTarget = cloneCardForPdf(cardRef.current);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(pdfTarget.element, {
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
      pdfTarget.cleanup();
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
      <AnimatedInvitationShell
        layout="classic"
        accent={GOLD}
        paper={useCustom ? BG : undefined}
        darkPanel={useCustom ? GOLD : undefined}
        monogram={`${info.partner2Name || ""} ${info.partner1Name || ""}`}
      >
      {isFullPhotoLayout ? (
      <div
        ref={cardRef}
        className="w-full overflow-hidden shadow-2xl"
        style={{
          maxWidth: 420,
          aspectRatio: "9 / 16",
          minHeight: 620,
          position: "relative",
          borderRadius: 30,
          border: "1px solid rgba(255,255,255,.35)",
          background: "#111",
        }}
      >
        {info.hasPhoto ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url('/api/save-the-date/${token}/photo?v=${info.photoVersion}')`,
              backgroundSize: photoBgSize,
              backgroundPosition: photoPos,
              filter: photoFilter,
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
            background: "linear-gradient(180deg, rgba(0,0,0,.2) 0%, rgba(0,0,0,.08) 35%, rgba(0,0,0,.65) 100%)",
          }}
        />
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: "34px 28px 38px", color: WHITE, textAlign: "center" }}>
          <div>
            <p style={{ fontFamily: LABEL_FONT, fontSize: 12 * sc, fontWeight: 700, letterSpacing: "0.34em", textTransform: "uppercase", margin: "0 0 10px", color: GOLD }}>
              Save the Date
            </p>
            <div style={{ margin: "0 auto", width: 46, height: 28, position: "relative" }}>
              <Heart style={{ width: 24, height: 24, color: GOLD, opacity: 0.9, transform: "rotate(-14deg)" }} />
              <span style={{ position: "absolute", left: 20, right: 0, top: 18, height: 1, background: GOLD, opacity: 0.72 }} />
            </div>
          </div>

          <div style={{ marginTop: "auto", marginBottom: 20 }}>
            <div style={{ fontFamily: SERIF, textTransform: "uppercase", letterSpacing: "0.18em", lineHeight: 1.15, color: GOLD }}>
              <div style={{ fontSize: `${2.2 * sc}rem`, fontWeight: 500 }}>{brideFirst}</div>
              <div style={{ fontSize: `${1.8 * sc}rem`, fontStyle: "italic", textTransform: "none", letterSpacing: "0.08em", margin: "4px 0" }}>and</div>
              <div style={{ fontSize: `${2.2 * sc}rem`, fontWeight: 500 }}>{groomFirst}</div>
            </div>
            {dateText && (
              <p style={{ fontFamily: LABEL_FONT, fontSize: 11 * sc, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", margin: "20px 0 0" }}>
                {dateText}
              </p>
            )}
            {venueCityState && (
              <p style={{ fontFamily: LABEL_FONT, fontSize: 12 * sc, margin: "8px 0 0", color: WHITE, opacity: 0.88 }}>{venueCityState}</p>
            )}
            {msgText && (
              <p style={{ fontFamily: SERIF, fontSize: `${1 * sc}rem`, fontStyle: "italic", color: WHITE, opacity: 0.9, lineHeight: 1.55, margin: "18px 0 0" }}>
                &ldquo;{msgText}&rdquo;
              </p>
            )}
            <div style={{ marginTop: 18 }}>
              <button
                onClick={downloadPdf}
                disabled={downloadingPdf}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.28)",
                  color: "rgba(255,255,255,.86)", fontFamily: LABEL_FONT, fontSize: 10 * sc, fontWeight: 700,
                  letterSpacing: "0.16em", textTransform: "uppercase",
                  padding: "8px 18px", borderRadius: 6, cursor: "pointer",
                  opacity: downloadingPdf ? 0.5 : 1,
                }}
              >
                {downloadingPdf ? (
                  <><Loader2 style={{ width: Math.round(11 * sc), height: Math.round(11 * sc) }} className="animate-spin" /> Generating PDF...</>
                ) : (
                  <><Download style={{ width: Math.round(11 * sc), height: Math.round(11 * sc) }} /> Download as PDF</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      ) : (
      <div
        ref={cardRef}
        className="w-full rounded-2xl overflow-hidden shadow-2xl"
        style={{
          maxWidth: 420,
          background: BG,
          border: `1px solid ${CARD_BDR}`,
        }}
      >
        {/* Photo — rendered as background-image so html2canvas captures it correctly
            (html2canvas does not support object-fit/object-position on <img>) */}
        {/* Content */}
        <div style={{ backgroundImage: DOT_PAT, backgroundSize: "22px 22px", backgroundColor: BG, padding: "24px 24px 28px", textAlign: "center" }}>

          {/* "Save the Date" label */}
          <p style={{ fontFamily: LABEL_FONT, fontSize: 11 * sc, fontWeight: 700, letterSpacing: "0.42em", textTransform: "uppercase", color: GOLD, margin: "0 0 10px" }}>
            Save the Date
          </p>

          {/* Couple name */}
          <h1 style={{ fontFamily: SERIF, fontSize: `${2.1 * sc}rem`, fontWeight: 400, fontStyle: "italic", color: GOLD, lineHeight: 1.2, margin: "0 0 16px" }}>
            {coupleText}
          </h1>

          {/* Photo rendered as background-image so html2canvas captures it correctly. */}
          {info.hasPhoto && (
            <div style={{ margin: "0 0 18px" }}>
              <div
                style={{
                  width: "100%", height: 200,
                  backgroundImage: `url('/api/save-the-date/${token}/photo?v=${info.photoVersion}')`,
                  backgroundSize: photoBgSize,
                  backgroundPosition: photoPos,
                  filter: photoFilter,
                  borderRadius: 8,
                  boxShadow: "0 6px 30px rgba(0,0,0,0.5)",
                }}
              />
            </div>
          )}

          {/* Divider */}
          <div style={{ height: 1, background: CARD_BDR, margin: "0 20px 16px" }} />

          {/* Date */}
          {dateText && (
            <p style={{ fontFamily: LABEL_FONT, fontSize: 11 * sc, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: WHITE, margin: "0 0 10px" }}>
              {dateText}
            </p>
          )}

          {venueCityState && (
            <p style={{ fontFamily: LABEL_FONT, fontSize: 11 * sc, color: WHITE, margin: "3px 0 0" }}>{venueCityState}</p>
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
            <a href="https://aidowedding.net" style={{ color: GOLD, textDecoration: "none", fontWeight: 600 }}>Try A.IDO free</a> - AI-powered wedding planning
          </p>
        </div>

      </div>
      )}
      </AnimatedInvitationShell>

    </div>
  );
}
