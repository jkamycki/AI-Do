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

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#fdf9f0" }}>
      {/* Top accent bar */}
      <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #c9a96e, #e8c99a, #c9a96e)" }} />

      {/* Logo */}
      <div className="w-full flex justify-center pt-8 px-4">
        <img src="/logo.png" alt="A.IDO" className="h-20 sm:h-24 w-auto object-contain" />
      </div>

      {/* Photo */}
      {info.hasPhoto && (
        <div className="w-full flex justify-center pt-6 px-4">
          <img
            src={`/api/save-the-date/${token}/photo`}
            alt={`${couple}`}
            className="w-full max-w-lg h-auto block rounded-2xl"
            style={{ boxShadow: "0 8px 32px rgba(200,116,145,0.18)" }}
          />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center py-10 px-4">
        <div className="max-w-lg w-full space-y-8">

          {/* Header block */}
          <div className="text-center space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "#c9a96e" }}>
              Please
            </p>
            <h1 className="text-5xl sm:text-6xl font-bold italic" style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: "#3d2e22", letterSpacing: "1px" }}>
              Save the Date
            </h1>
            <div className="flex justify-center py-1">
              <div className="h-px w-24" style={{ background: "#c9a96e" }} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-medium" style={{ fontFamily: "Georgia, serif", color: "#3d2e22" }}>
              {couple}
            </h2>
            {weddingDateStr && (
              <p className="text-base" style={{ color: "#7a6a5a", fontFamily: "Georgia, serif" }}>
                {weddingDateStr}
              </p>
            )}
          </div>

          {/* Times + venue */}
          <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: "#e8dcc8", background: "#fff" }}>
            {hasSeparateCeremony ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="text-center space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#c9a96e" }}>Ceremony</p>
                  {ceremonyTimeStr && (
                    <div className="flex items-center justify-center gap-1.5" style={{ color: "#3d2e22" }}>
                      <Clock className="h-3.5 w-3.5" style={{ color: "#c9a96e" }} />
                      <span className="text-sm font-semibold">{ceremonyTimeStr}</span>
                    </div>
                  )}
                  {info.ceremonyVenueName && (
                    <div className="flex items-center justify-center gap-1" style={{ color: "#3d2e22" }}>
                      <MapPin className="h-3.5 w-3.5" style={{ color: "#c9a96e" }} />
                      <p className="text-sm font-medium">{info.ceremonyVenueName}</p>
                    </div>
                  )}
                  {info.ceremonyAddress && <p className="text-xs" style={{ color: "#a38c80" }}>{info.ceremonyAddress}</p>}
                  {ceremonyCityStateZip && <p className="text-xs" style={{ color: "#a38c80" }}>{ceremonyCityStateZip}</p>}
                </div>
                <div className="text-center space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#c9a96e" }}>Reception</p>
                  {receptionTimeStr && (
                    <div className="flex items-center justify-center gap-1.5" style={{ color: "#3d2e22" }}>
                      <Clock className="h-3.5 w-3.5" style={{ color: "#c9a96e" }} />
                      <span className="text-sm font-semibold">{receptionTimeStr}</span>
                    </div>
                  )}
                  {info.venue && (
                    <div className="flex items-center justify-center gap-1" style={{ color: "#3d2e22" }}>
                      <MapPin className="h-3.5 w-3.5" style={{ color: "#c9a96e" }} />
                      <p className="text-sm font-medium">{info.venue}</p>
                    </div>
                  )}
                  {info.venueAddress && <p className="text-xs" style={{ color: "#a38c80" }}>{info.venueAddress}</p>}
                  {venueCityStateZip && <p className="text-xs" style={{ color: "#a38c80" }}>{venueCityStateZip}</p>}
                </div>
              </div>
            ) : (
              <div className="text-center space-y-2">
                {info.venue && (
                  <div className="flex items-center justify-center gap-1.5">
                    <MapPin className="h-4 w-4" style={{ color: "#c9a96e" }} />
                    <p className="font-semibold" style={{ color: "#3d2e22" }}>{info.venue}</p>
                  </div>
                )}
                {info.venueAddress && <p className="text-sm" style={{ color: "#a38c80" }}>{info.venueAddress}</p>}
                {venueCityStateZip && <p className="text-sm" style={{ color: "#a38c80" }}>{venueCityStateZip}</p>}
                {(ceremonyTimeStr || receptionTimeStr) && (
                  <div className="flex items-center justify-center gap-3 pt-1 flex-wrap">
                    {ceremonyTimeStr && (
                      <div className="flex items-center gap-1.5" style={{ color: "#3d2e22" }}>
                        <Clock className="h-3.5 w-3.5" style={{ color: "#c9a96e" }} />
                        <span className="text-sm">Ceremony {ceremonyTimeStr}</span>
                      </div>
                    )}
                    {ceremonyTimeStr && receptionTimeStr && (
                      <span className="text-sm" style={{ color: "#c9a96e" }}>·</span>
                    )}
                    {receptionTimeStr && (
                      <div className="flex items-center gap-1.5" style={{ color: "#3d2e22" }}>
                        <Clock className="h-3.5 w-3.5" style={{ color: "#c9a96e" }} />
                        <span className="text-sm">Reception {receptionTimeStr}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Message */}
          {info.saveTheDateMessage && (
            <div className="text-center px-4">
              <p className="text-base italic leading-relaxed" style={{ fontFamily: "Georgia, serif", color: "#7a6a5a" }}>
                &ldquo;{info.saveTheDateMessage}&rdquo;
              </p>
            </div>
          )}

          {/* Formal invitation to follow */}
          <div className="text-center">
            <p className="text-sm italic tracking-wide" style={{ color: "#c9a96e", fontFamily: "Georgia, serif" }}>
              Formal invitation to follow
            </p>
          </div>

          {/* Download PDF */}
          <div className="flex justify-center pt-2">
            <button
              onClick={downloadPdf}
              disabled={downloadingPdf}
              className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: "#c9a96e", color: "#fff" }}
            >
              {downloadingPdf ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating PDF&hellip;</>
              ) : (
                <><Download className="h-4 w-4" /> Download as PDF</>
              )}
            </button>
          </div>

          {/* Footer */}
          <div className="text-center pt-4 pb-8">
            <p className="text-xs" style={{ color: "#c4b8ac" }}>
              Planning your own wedding?{" "}
              <a href="https://aidowedding.net" className="hover:underline" style={{ color: "#c9a96e" }}>
                Try A.IDO free
              </a>
            </p>
          </div>

        </div>
      </div>

      {/* Bottom accent bar */}
      <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #c9a96e, #e8c99a, #c9a96e)" }} />
    </div>
  );
}
