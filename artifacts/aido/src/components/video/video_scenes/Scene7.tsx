import { motion } from "framer-motion";
import { Globe, Wand2, Image as ImageIcon, Type, Sparkles } from "lucide-react";

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
      <motion.div className="text-center mb-5" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 mb-3">
          <Globe className="h-4 w-4 text-amber-300" />
          <span className="text-xs uppercase tracking-[0.25em] text-amber-200">Website Builder</span>
        </div>
        <h2 className="text-[3vw] font-serif font-bold leading-tight"
          style={{ background: "linear-gradient(135deg, #fff 0%, #F5C842 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
        >
          Launch your wedding website in minutes
        </h2>
      </motion.div>

      <motion.div className="w-full max-w-5xl rounded-3xl p-6 backdrop-blur-xl"
        style={{ background: "linear-gradient(145deg, rgba(40,18,72,0.9) 0%, rgba(20,8,40,0.9) 100%)", border: "1.5px solid rgba(245,200,66,0.45)" }}
        initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.9, delay: 0.25 }}>
        <div className="grid grid-cols-[280px_1fr] gap-4">
          <div className="rounded-2xl p-4 bg-white/[0.04] border border-white/10">
            <div className="flex items-center gap-2 mb-3 text-white/80 text-sm"><Wand2 className="h-4 w-4 text-amber-300" /> Customize</div>
            <div className="space-y-2">
              {SITE_SECTIONS.map((section, i) => (
                <motion.div key={section} className="px-3 py-2 rounded-lg bg-white/[0.04] text-sm text-white/80"
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 + i * 0.12 }}>
                  {section}
                </motion.div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg px-2 py-2 bg-white/[0.04] border border-white/10 text-white/70 flex items-center gap-1"><Type className="h-3 w-3" /> Fonts</div>
              <div className="rounded-lg px-2 py-2 bg-white/[0.04] border border-white/10 text-white/70 flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Gallery</div>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/25">
            <div className="px-3 py-2 border-b border-white/10 text-xs text-white/60">aido-wedding.com/joseph-gabriela</div>
            <div className="p-4">
              <div className="rounded-xl h-28 bg-[linear-gradient(120deg,#2b163f,#5a2e83,#9b4d6d)] mb-3 flex items-center justify-center text-white font-serif text-xl">
                Joseph & Gabriela
              </div>
              <p className="text-white/75 text-sm mb-2">April 24, 2027 · The Royal Manor</p>
              <div className="grid grid-cols-3 gap-2">
                {["Our Story", "Registry", "RSVP"].map((pill) => (
                  <span key={pill} className="text-center text-xs rounded-full py-1 bg-white/10 text-white/85">{pill}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <motion.div className="mt-4 flex items-center justify-between rounded-xl px-4 py-3 bg-emerald-500/10 border border-emerald-400/30"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 }}>
          <span className="text-emerald-200 text-sm">Website published and RSVP-ready</span>
          <span className="inline-flex items-center gap-1 text-xs text-white/85"><Sparkles className="h-3 w-3 text-amber-300" /> Live now</span>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
