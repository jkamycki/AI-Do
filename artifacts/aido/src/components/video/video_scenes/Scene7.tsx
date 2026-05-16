import { motion } from "framer-motion";
import { Globe, Image as ImageIcon, Sparkles, Type, Wand2 } from "lucide-react";
import { burgundyGradientText, videoBadgeStyle, videoCardStyle, videoSmallCardStyle } from "../videoPalette";

const SITE_SECTIONS = ["Our Story", "Wedding Party", "Travel", "Registry", "RSVP"];

export function Scene7() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center px-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.96, filter: "blur(10px)" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div className="mb-5 text-center" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5" style={videoBadgeStyle}>
          <Globe className="h-4 w-4 text-[#B16C8E]" />
          <span className="text-xs font-bold uppercase tracking-[0.25em]">Website Builder</span>
        </div>
        <h2 className="font-serif text-[3vw] font-bold leading-tight" style={burgundyGradientText}>
          Launch your wedding website in minutes
        </h2>
      </motion.div>

      <motion.div
        className="w-full max-w-5xl rounded-3xl p-6 backdrop-blur-xl"
        style={videoCardStyle}
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, delay: 0.25 }}
      >
        <div className="grid grid-cols-[280px_1fr] gap-4">
          <div className="rounded-2xl p-4" style={videoSmallCardStyle}>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#8D294D]">
              <Wand2 className="h-4 w-4 text-[#C39B70]" />
              Customize
            </div>
            <div className="space-y-2">
              {SITE_SECTIONS.map((section, i) => (
                <motion.div
                  key={section}
                  className="rounded-lg bg-white/60 px-3 py-2 text-sm font-medium text-[#6F3E54]"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.45 + i * 0.12 }}
                >
                  {section}
                </motion.div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1 rounded-lg border border-[#E6A6B7]/35 bg-white/58 px-2 py-2 text-[#6F3E54]"><Type className="h-3 w-3" /> Fonts</div>
              <div className="flex items-center gap-1 rounded-lg border border-[#E6A6B7]/35 bg-white/58 px-2 py-2 text-[#6F3E54]"><ImageIcon className="h-3 w-3" /> Gallery</div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#E6A6B7]/38 bg-white/58">
            <div className="border-b border-[#E6A6B7]/35 px-3 py-2 text-xs text-[#B16C8E]">aidowedding.net/w/mia-noah</div>
            <div className="p-4">
              <div className="mb-3 flex h-28 items-center justify-center rounded-xl bg-[linear-gradient(120deg,#FFF7F2,#F2E2C6,#E6A6B7)] font-serif text-xl text-[#8D294D] shadow-inner">
                Mia & Noah
              </div>
              <p className="mb-2 text-sm font-medium text-[#6F3E54]">October 12, 2027 - Willow Creek Estate</p>
              <div className="grid grid-cols-3 gap-2">
                {["Our Story", "Registry", "RSVP"].map((pill) => (
                  <span key={pill} className="rounded-full bg-[#F2E2C6]/65 py-1 text-center text-xs font-semibold text-[#8D294D]">{pill}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <motion.div
          className="mt-4 flex items-center justify-between rounded-xl border border-[#E6A6B7]/45 bg-white/58 px-4 py-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4 }}
        >
          <span className="text-sm font-semibold text-[#8D294D]">Website published and RSVP-ready</span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[#6F3E54]"><Sparkles className="h-3 w-3 text-[#C39B70]" /> Live now</span>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
