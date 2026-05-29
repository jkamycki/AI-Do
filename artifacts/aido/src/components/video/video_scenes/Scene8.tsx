import { motion } from "framer-motion";
import { Camera, CheckCircle2, Download, ImagePlus, QrCode, Smartphone, UploadCloud } from "lucide-react";
import { burgundyGradientText, videoBadgeStyle, videoCardStyle, videoSmallCardStyle } from "../videoPalette";

const QR_GRID_SIZE = 21;

function isFinderCell(x: number, y: number, originX: number, originY: number) {
  const localX = x - originX;
  const localY = y - originY;
  if (localX < 0 || localY < 0 || localX > 6 || localY > 6) return null;
  const isOuter = localX === 0 || localX === 6 || localY === 0 || localY === 6;
  const isCenter = localX >= 2 && localX <= 4 && localY >= 2 && localY <= 4;
  return isOuter || isCenter;
}

function isQrCellDark(index: number) {
  const x = index % QR_GRID_SIZE;
  const y = Math.floor(index / QR_GRID_SIZE);
  const finder =
    isFinderCell(x, y, 0, 0) ??
    isFinderCell(x, y, QR_GRID_SIZE - 7, 0) ??
    isFinderCell(x, y, 0, QR_GRID_SIZE - 7);
  if (finder !== null) return finder;

  const isSeparator =
    (x <= 7 && y <= 7) ||
    (x >= QR_GRID_SIZE - 8 && y <= 7) ||
    (x <= 7 && y >= QR_GRID_SIZE - 8);
  if (isSeparator) return false;

  return (
    (x * 3 + y * 5) % 7 === 0 ||
    (x + y * 2) % 5 === 0 ||
    (x > 9 && y > 9 && (x * y) % 11 < 4)
  );
}

const PHOTO_STEPS = [
  { icon: QrCode, label: "Scan the QR code" },
  { icon: Camera, label: "Take or choose photos" },
  { icon: CheckCircle2, label: "Approve in your portal" },
  { icon: Download, label: "View and download" },
];

function MiniQrCode() {
  return (
    <div
      className="grid h-32 w-32 gap-[2px] rounded-2xl border border-[#E6A6B7]/45 bg-white p-3 shadow-[0_16px_34px_rgba(141,41,77,0.14)] sm:h-36 sm:w-36"
      style={{ gridTemplateColumns: `repeat(${QR_GRID_SIZE}, minmax(0, 1fr))` }}
      aria-label="Sample guest photo QR code"
    >
      {Array.from({ length: QR_GRID_SIZE * QR_GRID_SIZE }, (_, i) => (
        <span
          key={i}
          className={`rounded-[1px] ${isQrCellDark(i) ? "bg-[#5B0F2A]" : "bg-white"}`}
        />
      ))}
    </div>
  );
}

export function Scene8() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center px-5 py-5 sm:px-12 sm:py-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.96, filter: "blur(10px)" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div className="mb-4 text-center sm:mb-5" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1.5 sm:mb-3 sm:px-4" style={videoBadgeStyle}>
          <Camera className="h-3.5 w-3.5 text-[#B16C8E] sm:h-4 sm:w-4" />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] sm:text-xs sm:tracking-[0.25em]">Wedding Day Photo QR</span>
        </div>
        <h2 className="mx-auto max-w-xs font-serif text-[2rem] font-bold leading-[1.02] sm:max-w-none sm:text-[3vw] sm:leading-tight" style={burgundyGradientText}>
          Guests scan, snap, and share
        </h2>
      </motion.div>

      <motion.div
        className="w-full max-w-[340px] rounded-3xl p-4 backdrop-blur-xl sm:max-w-5xl sm:p-6"
        style={videoCardStyle}
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.15fr] sm:gap-5">
          <div className="rounded-2xl p-4" style={videoSmallCardStyle}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#B16C8E] sm:text-xs">Photo drop is on</div>
                <div className="mt-1 text-xs text-[#6F3E54] sm:text-sm">Print this on signs, tables, or invitations.</div>
              </div>
              <span className="rounded-full border border-[#C39B70]/45 bg-[#F2E2C6]/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#8D294D] sm:text-xs">
                Live
              </span>
            </div>

            <div className="flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.82, rotate: -4 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ delay: 0.55, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              >
                <MiniQrCode />
              </motion.div>
            </div>

            <div className="mt-4 space-y-2">
              {PHOTO_STEPS.map(({ icon: Icon, label }, i) => (
                <motion.div
                  key={label}
                  className="flex items-center gap-2 rounded-xl bg-white/62 px-3 py-2 text-xs font-semibold text-[#3B1C2B] sm:text-sm"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.85 + i * 0.15, duration: 0.45 }}
                >
                  <Icon className="h-4 w-4 shrink-0 text-[#C39B70]" />
                  {label}
                </motion.div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[220px_1fr] sm:gap-4">
            <motion.div
              className="mx-auto w-full max-w-[210px] rounded-[2rem] border-[5px] border-[#3B1C2B] bg-[#FFFDFB] p-3 shadow-[0_24px_52px_rgba(59,28,43,0.22)]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
            >
              <div className="mb-3 flex items-center justify-between">
                <img src={`${import.meta.env.BASE_URL}logo.png`} alt="A.I Do" className="h-8 w-auto object-contain" />
                <Smartphone className="h-4 w-4 text-[#B16C8E]" />
              </div>
              <div className="rounded-2xl bg-[#F7DDE2]/55 p-3 text-center">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#D46F71] text-white">
                  <Camera className="h-5 w-5" />
                </div>
                <div className="font-serif text-xl font-bold text-[#5B0F2A]">Mia & Noah</div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-[#8D294D]">Guest Photo Drop</div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-[#E6A6B7]/45 bg-white px-2 py-3 text-center text-[10px] font-bold text-[#5B0F2A]">
                  <Camera className="mx-auto mb-1 h-4 w-4 text-[#8D294D]" />
                  Take Photo
                </div>
                <div className="rounded-xl border border-[#E6A6B7]/45 bg-white px-2 py-3 text-center text-[10px] font-bold text-[#5B0F2A]">
                  <ImagePlus className="mx-auto mb-1 h-4 w-4 text-[#C39B70]" />
                  Choose
                </div>
              </div>
              <motion.div
                className="mt-3 rounded-xl border border-[#E6A6B7]/45 bg-[#FFF7F2] px-3 py-2 text-center text-[10px] font-bold text-[#8D294D]"
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ delay: 1.8, duration: 1.4, repeat: Infinity, repeatDelay: 1.2 }}
              >
                3 of 5 photos left
              </motion.div>
            </motion.div>

            <div className="flex flex-col gap-3">
              <motion.div
                className="rounded-2xl border border-[#E6A6B7]/40 bg-white/62 p-3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.85, duration: 0.65 }}
              >
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#8D294D]">
                  <UploadCloud className="h-4 w-4 text-[#C39B70]" />
                  New guest uploads
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {["Dance floor", "Cake moment", "Family toast"].map((label, i) => (
                    <motion.div
                      key={label}
                      className="aspect-square rounded-xl bg-[linear-gradient(135deg,#F7DDE2,#FFF7F2,#F2E2C6)] p-2 shadow-inner"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1.1 + i * 0.18, duration: 0.45 }}
                    >
                      <div className="h-full rounded-lg border border-white/70 bg-white/35" />
                      <div className="mt-1 truncate text-[9px] text-[#6F3E54]">{label}</div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              <motion.div
                className="rounded-2xl border border-[#C39B70]/40 bg-[#F2E2C6]/45 p-3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.55, duration: 0.65 }}
              >
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#8D294D]">
                  <CheckCircle2 className="h-4 w-4 text-[#8D294D]" />
                  Approved gallery
                </div>
                <p className="text-xs leading-relaxed text-[#6F3E54] sm:text-sm">
                  Approved photos flow into the couple&apos;s portal and wedding website, ready for guests to view or download.
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.p className="mt-4 max-w-[320px] text-center text-sm leading-relaxed text-[#6F3E54] sm:mt-5 sm:max-w-2xl sm:text-base" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2, duration: 0.7 }}>
        No apps, no hashtags, no lost memories.
      </motion.p>
    </motion.div>
  );
}
