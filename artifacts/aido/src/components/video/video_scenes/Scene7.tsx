import { motion } from "framer-motion";
import { Globe, Image as ImageIcon, Sparkles, Type, Wand2 } from "lucide-react";
import { burgundyGradientText, videoBadgeStyle, videoCardStyle, videoSmallCardStyle } from "../videoPalette";

const SITE_SECTIONS = ["Our Story", "Wedding Party", "Travel", "Registry", "RSVP"];

export function Scene7() {
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
          <Globe className="h-3.5 w-3.5 text-[#B16C8E] sm:h-4 sm:w-4" />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] sm:text-xs sm:tracking-[0.25em]">Website Builder</span>
        </div>
        <h2 className="mx-auto max-w-xs font-serif text-[2rem] font-bold leading-[1.02] sm:max-w-none sm:text-[3vw] sm:leading-tight" style={burgundyGradientText}>
          Launch your wedding website in minutes
        </h2>
      </motion.div>

      <motion.div
        className="w-full max-w-[340px] rounded-3xl p-4 backdrop-blur-xl sm:max-w-5xl sm:p-6"
        style={videoCardStyle}
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, delay: 0.25 }}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[280px_1fr] sm:gap-4">
          <div className="rounded-2xl p-3 sm:p-4" style={videoSmallCardStyle}>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#8D294D] sm:mb-3 sm:text-sm">
              <Wand2 className="h-4 w-4 text-[#C39B70]" />
              Customize
            </div>
            <div className="grid grid-cols-2 gap-2 sm:block sm:space-y-2">
              {SITE_SECTIONS.map((section, i) => (
                <motion.div
                  key={section}
                  className="rounded-lg bg-white/60 px-2 py-1.5 text-center text-xs font-medium text-[#6F3E54] sm:px-3 sm:py-2 sm:text-left sm:text-sm"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.45 + i * 0.12 }}
                >
                  {section}
                </motion.div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:mt-4">
              <div className="flex items-center gap-1 rounded-lg border border-[#E6A6B7]/35 bg-white/58 px-2 py-2 text-[#6F3E54]"><Type className="h-3 w-3" /> Fonts</div>
              <div className="flex items-center gap-1 rounded-lg border border-[#E6A6B7]/35 bg-white/58 px-2 py-2 text-[#6F3E54]"><ImageIcon className="h-3 w-3" /> Gallery</div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#E6A6B7]/38 bg-white/58">
            <div className="truncate border-b border-[#E6A6B7]/35 px-3 py-2 text-xs text-[#B16C8E]">aidowedding.net/your-wedding</div>
            <div className="p-3 sm:p-4">
              <div className="mb-3 flex h-20 items-center justify-center rounded-xl bg-[linear-gradient(120deg,#FFF7F2,#F2E2C6,#E6A6B7)] font-serif text-lg text-[#8D294D] shadow-inner sm:h-28 sm:text-xl">
                Your Wedding
              </div>
              <p className="mb-2 text-xs font-medium text-[#6F3E54] sm:text-sm">October 12, 2027 - Willow Creek Estate</p>
              <div className="grid grid-cols-3 gap-2">
                {["Our Story", "Registry", "RSVP"].map((pill) => (
                  <span key={pill} className="rounded-full bg-[#F2E2C6]/65 py-1 text-center text-[10px] font-semibold text-[#8D294D] sm:text-xs">{pill}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <motion.div
          className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[#E6A6B7]/45 bg-white/58 px-3 py-2.5 sm:mt-4 sm:px-4 sm:py-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4 }}
        >
          <span className="text-xs font-semibold text-[#8D294D] sm:text-sm">Website published and RSVP-ready</span>
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-[#6F3E54] sm:text-xs"><Sparkles className="h-3 w-3 text-[#C39B70]" /> Live now</span>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
