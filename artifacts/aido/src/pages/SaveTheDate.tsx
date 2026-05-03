import { useState, useRef } from "react";
import { apiFetch } from "@/lib/authFetch";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Download, AlertCircle, MapPin, Clock } from "lucide-react";

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
}

function formatTime(timeStr: string | null | undefined) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return timeStr;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
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

  const ceremonyTimeStr = formatTime(info?.ceremonyTime);
  const receptionTimeStr = formatTime(info?.receptionTime);

  const venueCityStateZip = [
    info?.venueCity,
    [info?.venueState, info?.venueZip].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ");

  const ceremonyCityStateZip = [
    info?.ceremonyCity,
    [info?.ceremonyState, info?.ceremonyZip].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ");

  const hasSeparateCeremony = !!(
    info && !info.ceremonyAtVenue &&
    (info.ceremonyVenueName || info.ceremonyAddress || info.ceremonyCity)
  );

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
        backgroundColor: "#fdf9f0",
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#fdf9f0" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#c9a96e" }} />
      </div>
    );
  }

  if (isError || !info) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: "#fdf9f0" }}>
        <div className="max-w-md w-full text-center rounded-2xl border p-10 space-y-4 shadow-sm" style={{ borderColor: "#e8dcc8", background: "#fff" }}>
          <AlertCircle className="h-12 w-12 mx-auto" style={{ color: "#c9a96e" }} />
          <h2 className="text-xl font-semibold" style={{ color: "#3d2e22" }}>This link is no longer valid</h2>
          <p className="text-sm" style={{ color: "#a38c80" }}>Please contact the couple directly.</p>
        </div>
      </div>
    );
  }

  const cormorant = "'Cormorant Garamond', Georgia, serif";
  const jakarta = "'Plus Jakarta Sans', system-ui, sans-serif";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#fdf9f0" }}>
      {/* Top accent bar */}
      <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #c9a96e, #e8c99a, #c9a96e)" }} />

      {/* Logo */}
      <div className="w-full flex justify-center pt-10 px-4">
        <img src="/logo.png" alt="A.IDO" className="h-16 sm:h-20 w-auto object-contain opacity-80" />
      </div>

      {/* Photo */}
      {info.hasPhoto && (
        <div className="w-full flex justify-center pt-8 px-4">
          <img
            src={`/api/save-the-date/${token}/photo`}
            alt={couple}
            className="w-full max-w-xl h-auto block"
            style={{ borderRadius: "4px", boxShadow: "0 12px 48px rgba(61,46,34,0.14)" }}
          />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center py-12 px-4">
        <div ref={cardRef} className="max-w-xl w-full">

          {/* Header block */}
          <div className="text-center" style={{ marginBottom: "2.5rem" }}>
            <p style={{ fontFamily: jakarta, fontSize: "10px", fontWeight: 600, letterSpacing: "0.45em", textTransform: "uppercase", color: "#c9a96e", marginBottom: "1rem" }}>
              Please
            </p>
            <h1 style={{ fontFamily: cormorant, fontSize: "clamp(3.5rem,10vw,5.5rem)", fontWeight: 300, fontStyle: "italic", color: "#3d2e22", lineHeight: 1.1, letterSpacing: "0.02em", marginBottom: "1.25rem" }}>
              Save the Date
            </h1>
            <div className="flex items-center justify-center gap-3" style={{ marginBottom: "1.25rem" }}>
              <div style={{ height: "1px", width: "48px", background: "linear-gradient(to right, transparent, #c9a96e)" }} />
              <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#c9a96e" }} />
              <div style={{ height: "1px", width: "48px", background: "linear-gradient(to left, transparent, #c9a96e)" }} />
            </div>
            <h2 style={{ fontFamily: cormorant, fontSize: "clamp(1.6rem,5vw,2.4rem)", fontWeight: 400, color: "#3d2e22", letterSpacing: "0.04em", marginBottom: "0.6rem" }}>
              {couple}
            </h2>
            {weddingDateStr && (
              <p style={{ fontFamily: jakarta, fontSize: "13px", fontWeight: 400, letterSpacing: "0.12em", color: "#8a7560", textTransform: "uppercase" }}>
                {weddingDateStr}
              </p>
            )}
          </div>

          {/* Times + venue card */}
          <div style={{ border: "1px solid #e8dcc8", borderRadius: "4px", background: "#fffdf8", padding: "1.75rem 2rem", marginBottom: "2rem" }}>
            {hasSeparateCeremony ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="text-center space-y-2">
                  <p style={{ fontFamily: jakarta, fontSize: "9px", fontWeight: 700, letterSpacing: "0.35em", textTransform: "uppercase", color: "#c9a96e" }}>Ceremony</p>
                  {ceremonyTimeStr && (
                    <div className="flex items-center justify-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" style={{ color: "#c9a96e" }} />
                      <span style={{ fontFamily: jakarta, fontSize: "14px", fontWeight: 500, color: "#3d2e22" }}>{ceremonyTimeStr}</span>
                    </div>
                  )}
                  {info.ceremonyVenueName && (
                    <div className="flex items-center justify-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: "#c9a96e" }} />
                      <span style={{ fontFamily: cormorant, fontSize: "16px", fontWeight: 500, color: "#3d2e22" }}>{info.ceremonyVenueName}</span>
                    </div>
                  )}
                  {info.ceremonyAddress && <p style={{ fontFamily: jakarta, fontSize: "12px", color: "#a38c80" }}>{info.ceremonyAddress}</p>}
                  {ceremonyCityStateZip && <p style={{ fontFamily: jakarta, fontSize: "12px", color: "#a38c80" }}>{ceremonyCityStateZip}</p>}
                </div>
                <div className="text-center space-y-2">
                  <p style={{ fontFamily: jakarta, fontSize: "9px", fontWeight: 700, letterSpacing: "0.35em", textTransform: "uppercase", color: "#c9a96e" }}>Reception</p>
                  {receptionTimeStr && (
                    <div className="flex items-center justify-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" style={{ color: "#c9a96e" }} />
                      <span style={{ fontFamily: jakarta, fontSize: "14px", fontWeight: 500, color: "#3d2e22" }}>{receptionTimeStr}</span>
                    </div>
                  )}
                  {info.venue && (
                    <div className="flex items-center justify-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: "#c9a96e" }} />
                      <span style={{ fontFamily: cormorant, fontSize: "16px", fontWeight: 500, color: "#3d2e22" }}>{info.venue}</span>
                    </div>
                  )}
                  {info.venueAddress && <p style={{ fontFamily: jakarta, fontSize: "12px", color: "#a38c80" }}>{info.venueAddress}</p>}
                  {venueCityStateZip && <p style={{ fontFamily: jakarta, fontSize: "12px", color: "#a38c80" }}>{venueCityStateZip}</p>}
                </div>
              </div>
            ) : (
              <div className="text-center space-y-2">
                {info.venue && (
                  <div className="flex items-center justify-center gap-1.5">
                    <MapPin className="h-4 w-4 shrink-0" style={{ color: "#c9a96e" }} />
                    <span style={{ fontFamily: cormorant, fontSize: "20px", fontWeight: 500, color: "#3d2e22" }}>{info.venue}</span>
                  </div>
                )}
                {info.venueAddress && <p style={{ fontFamily: jakarta, fontSize: "12px", color: "#a38c80" }}>{info.venueAddress}</p>}
                {venueCityStateZip && <p style={{ fontFamily: jakarta, fontSize: "12px", color: "#a38c80" }}>{venueCityStateZip}</p>}
                {(ceremonyTimeStr || receptionTimeStr) && (
                  <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
                    {ceremonyTimeStr && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" style={{ color: "#c9a96e" }} />
                        <span style={{ fontFamily: jakarta, fontSize: "13px", color: "#3d2e22" }}>Ceremony {ceremonyTimeStr}</span>
                      </div>
                    )}
                    {ceremonyTimeStr && receptionTimeStr && (
                      <span style={{ color: "#c9a96e", fontSize: "16px" }}>·</span>
                    )}
                    {receptionTimeStr && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" style={{ color: "#c9a96e" }} />
                        <span style={{ fontFamily: jakarta, fontSize: "13px", color: "#3d2e22" }}>Reception {receptionTimeStr}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Message */}
          {info.saveTheDateMessage && (
            <div className="text-center" style={{ marginBottom: "2rem", padding: "0 1.5rem" }}>
              <p style={{ fontFamily: cormorant, fontSize: "20px", fontWeight: 400, fontStyle: "italic", lineHeight: 1.7, color: "#7a6a5a" }}>
                &ldquo;{info.saveTheDateMessage}&rdquo;
              </p>
            </div>
          )}

          {/* Formal invitation to follow */}
          <div className="text-center" style={{ marginBottom: "2.5rem" }}>
            <p style={{ fontFamily: cormorant, fontSize: "18px", fontStyle: "italic", letterSpacing: "0.04em", color: "#c9a96e" }}>
              Formal invitation to follow
            </p>
          </div>

          {/* Download PDF */}
          <div className="flex justify-center" style={{ marginBottom: "3rem" }}>
            <button
              onClick={downloadPdf}
              disabled={downloadingPdf}
              className="flex items-center gap-2 transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: "#3d2e22", color: "#c9a96e", fontFamily: jakarta, fontSize: "11px", fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", padding: "0.85rem 2rem", borderRadius: "2px" }}
            >
              {downloadingPdf ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating PDF&hellip;</>
              ) : (
                <><Download className="h-4 w-4" /> Download as PDF</>
              )}
            </button>
          </div>

          {/* Footer */}
          <div className="text-center pb-8">
            <p style={{ fontFamily: jakarta, fontSize: "11px", color: "#c4b8ac" }}>
              Planning your own wedding?{" "}
              <a href="https://aidowedding.net" className="hover:underline" style={{ color: "#c9a96e" }}>
                Try A.IDO free
              </a>
            </p>
          </div>

        </div>
      </div>

      {/* Bottom accent bar */}
      <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #c9a96e, #e8c99a, #c9a96e)" }} />
    </div>
  );
}
