import { useState } from "react";
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

  const blobToDataUrl = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(blob);
    });

  const loadImageDims = (dataUrl: string): Promise<{ w: number; h: number }> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => reject(new Error("img load failed"));
      img.src = dataUrl;
    });

  const downloadPdf = async () => {
    if (!info) return;
    setDownloadingPdf(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });

      const PAGE_W = 595;
      const PAGE_H = 842;
      const MARGIN = 50;
      const CW = PAGE_W - 2 * MARGIN;

      // Palette: ivory bg, champagne accent, dark brown text, warm gray secondary
      const [BG_R, BG_G, BG_B] = [253, 249, 240];
      const [AC_R, AC_G, AC_B] = [201, 169, 110]; // champagne gold
      const [TX_R, TX_G, TX_B] = [61, 46, 34];    // dark brown
      const [MU_R, MU_G, MU_B] = [163, 140, 128]; // muted warm gray

      doc.setFillColor(BG_R, BG_G, BG_B);
      doc.rect(0, 0, PAGE_W, PAGE_H, "F");

      // Top border bar — blush
      doc.setFillColor(AC_R, AC_G, AC_B);
      doc.rect(0, 0, PAGE_W, 6, "F");

      let y = MARGIN + 16;

      // Logo
      try {
        const logoRes = await fetch("/logo.png");
        if (logoRes.ok) {
          const logoData = await blobToDataUrl(await logoRes.blob());
          const dims = await loadImageDims(logoData);
          const logoH = 70;
          const logoW = (dims.w / dims.h) * logoH;
          doc.addImage(logoData, "PNG", (PAGE_W - logoW) / 2, y, logoW, logoH);
          y += logoH + 18;
        }
      } catch { /* skip */ }

      // "SAVE THE DATE" label — spaced caps in blush
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(AC_R, AC_G, AC_B);
      doc.text("S A V E   T H E   D A T E", PAGE_W / 2, y, { align: "center" });
      y += 20;

      // Thin divider
      doc.setDrawColor(AC_R, AC_G, AC_B);
      doc.setLineWidth(0.5);
      doc.line(MARGIN + 60, y, PAGE_W - MARGIN - 60, y);
      y += 20;

      // Couple names — large, helvetica italic, dark brown
      doc.setFont("helvetica", "bolditalic");
      doc.setFontSize(30);
      doc.setTextColor(TX_R, TX_G, TX_B);
      const coupleLines = doc.splitTextToSize(couple, CW);
      doc.text(coupleLines, PAGE_W / 2, y, { align: "center" });
      y += coupleLines.length * 32 + 4;

      // Wedding date
      if (weddingDateStr) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(13);
        doc.setTextColor(TX_R, TX_G, TX_B);
        doc.text(weddingDateStr, PAGE_W / 2, y, { align: "center" });
        y += 22;
      }

      // Photo
      if (info.hasPhoto) {
        try {
          const photoRes = await fetch(`/api/save-the-date/${token}/photo`);
          if (photoRes.ok) {
            const photoData = await blobToDataUrl(await photoRes.blob());
            const dims = await loadImageDims(photoData);
            const maxW = CW;
            const maxH = 300;
            const scale = Math.min(maxW / dims.w, maxH / dims.h);
            const drawW = dims.w * scale;
            const drawH = dims.h * scale;
            y += 10;
            doc.addImage(photoData, "JPEG", (PAGE_W - drawW) / 2, y, drawW, drawH);
            y += drawH + 20;
          }
        } catch { /* skip */ }
      }

      // Ceremony / Reception times
      if (hasSeparateCeremony) {
        if (ceremonyTimeStr || info.ceremonyVenueName) {
          y += 4;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(AC_R, AC_G, AC_B);
          doc.text("CEREMONY", PAGE_W / 2, y, { align: "center", charSpace: 2 });
          y += 13;
          if (ceremonyTimeStr) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(12);
            doc.setTextColor(TX_R, TX_G, TX_B);
            doc.text(ceremonyTimeStr, PAGE_W / 2, y, { align: "center" });
            y += 15;
          }
          if (info.ceremonyVenueName) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(TX_R, TX_G, TX_B);
            doc.text(info.ceremonyVenueName, PAGE_W / 2, y, { align: "center" });
            y += 14;
          }
          if (info.ceremonyAddress) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(MU_R, MU_G, MU_B);
            doc.text(info.ceremonyAddress, PAGE_W / 2, y, { align: "center" });
            y += 13;
          }
          if (ceremonyCityStateZip) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(MU_R, MU_G, MU_B);
            doc.text(ceremonyCityStateZip, PAGE_W / 2, y, { align: "center" });
            y += 13;
          }
          y += 8;
        }
        if (receptionTimeStr || info.venue) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(AC_R, AC_G, AC_B);
          doc.text("RECEPTION", PAGE_W / 2, y, { align: "center", charSpace: 2 });
          y += 13;
          if (receptionTimeStr) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(12);
            doc.setTextColor(TX_R, TX_G, TX_B);
            doc.text(receptionTimeStr, PAGE_W / 2, y, { align: "center" });
            y += 15;
          }
          if (info.venue) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(TX_R, TX_G, TX_B);
            doc.text(info.venue, PAGE_W / 2, y, { align: "center" });
            y += 14;
          }
          if (info.venueAddress) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(MU_R, MU_G, MU_B);
            doc.text(info.venueAddress, PAGE_W / 2, y, { align: "center" });
            y += 13;
          }
          if (venueCityStateZip) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(MU_R, MU_G, MU_B);
            doc.text(venueCityStateZip, PAGE_W / 2, y, { align: "center" });
            y += 13;
          }
        }
      } else {
        // Same venue for ceremony and reception
        if (info.venue) {
          y += 4;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(12);
          doc.setTextColor(TX_R, TX_G, TX_B);
          doc.text(info.venue, PAGE_W / 2, y, { align: "center" });
          y += 16;
        }
        if (info.venueAddress) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.setTextColor(MU_R, MU_G, MU_B);
          doc.text(info.venueAddress, PAGE_W / 2, y, { align: "center" });
          y += 13;
        }
        if (venueCityStateZip) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.setTextColor(MU_R, MU_G, MU_B);
          doc.text(venueCityStateZip, PAGE_W / 2, y, { align: "center" });
          y += 13;
        }
        // Both times on same line
        const timeParts: string[] = [];
        if (ceremonyTimeStr) timeParts.push(`Ceremony  ${ceremonyTimeStr}`);
        if (receptionTimeStr) timeParts.push(`Reception  ${receptionTimeStr}`);
        if (timeParts.length) {
          y += 6;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(11);
          doc.setTextColor(TX_R, TX_G, TX_B);
          doc.text(timeParts.join("   ·   "), PAGE_W / 2, y, { align: "center" });
          y += 16;
        }
      }

      // Message
      if (info.saveTheDateMessage) {
        y += 14;
        doc.setFont("helvetica", "italic");
        doc.setFontSize(11);
        doc.setTextColor(TX_R, TX_G, TX_B);
        const msgLines = doc.splitTextToSize(`"${info.saveTheDateMessage}"`, CW - 60);
        doc.text(msgLines, PAGE_W / 2, y, { align: "center" });
        y += msgLines.length * 15;
      }

      // "Formal invitation to follow"
      y += 16;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.setTextColor(AC_R, AC_G, AC_B);
      doc.text("Formal invitation to follow", PAGE_W / 2, y, { align: "center" });
      y += 18;

      // Bottom divider
      doc.setDrawColor(AC_R, AC_G, AC_B);
      doc.setLineWidth(0.5);
      doc.line(MARGIN + 60, y, PAGE_W - MARGIN - 60, y);

      // Footer
      const footerY = PAGE_H - 30;
      doc.setFillColor(AC_R, AC_G, AC_B);
      doc.rect(0, PAGE_H - 6, PAGE_W, 6, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(MU_R, MU_G, MU_B);
      const footerText = "Created with A.IDO — aidowedding.net";
      doc.textWithLink(footerText, PAGE_W / 2, footerY, { align: "center", url: "https://aidowedding.net" });

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
        <div className="max-w-xl w-full">

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
