import { motion } from "framer-motion";
import { CalendarCheck2, CheckSquare2, Clock3 } from "lucide-react";

const TIMELINE = [
  { title: "Finalize venue contract", due: "This week", done: true },
  { title: "Mail digital invitations", due: "In 5 days", done: false },
  { title: "Confirm florist mockup", due: "In 10 days", done: false },
  { title: "Upload ceremony timeline", due: "In 2 weeks", done: false },
];

const CHECKLIST = [
  { label: "Photographer deposit paid", done: true },
  { label: "Guest RSVP reminder sent", done: true },
  { label: "Seating chart first draft", done: false },
  { label: "Day-of emergency kit", done: false },
];

export function Scene3() {
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center px-12"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.96, filter: "blur(10px)" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
      <motion.div className="text-center mb-5" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-400/10 border border-cyan-400/30 mb-3">
          <CalendarCheck2 className="h-4 w-4 text-cyan-300" />
          <span className="text-xs uppercase tracking-[0.25em] text-cyan-200">Timeline + Checklist</span>
        </div>
        <h2 className="text-[3vw] font-serif font-bold leading-tight"
          style={{ background: "linear-gradient(135deg, #fff 0%, #A0CBF0 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
          Know what's next — and what’s done
        </h2>
      </motion.div>

      <div className="grid grid-cols-2 gap-6 w-full max-w-5xl">
        <motion.div className="rounded-2xl p-5 backdrop-blur-xl"
          style={{ background: "linear-gradient(145deg, rgba(40,18,72,0.85) 0%, rgba(20,8,40,0.85) 100%)", border: "1.5px solid rgba(79,142,247,0.4)" }}
          initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.25 }}>
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-white/10">
            <Clock3 className="h-4 w-4 text-cyan-300" />
            <span className="text-xs uppercase tracking-widest text-white/70">Wedding Timeline</span>
          </div>
          <div className="space-y-2.5">
            {TIMELINE.map((item, i) => (
              <motion.div key={item.title} className="flex items-center justify-between rounded-lg px-3 py-2 bg-white/[0.04]"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.2 }}>
                <span className="text-sm text-white/90">{item.title}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${item.done ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}>{item.done ? "Done" : item.due}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div className="rounded-2xl p-5 backdrop-blur-xl"
          style={{ background: "linear-gradient(145deg, rgba(40,18,72,0.85) 0%, rgba(20,8,40,0.85) 100%)", border: "1.5px solid rgba(34,197,94,0.35)" }}
          initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.35 }}>
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-white/10">
            <CheckSquare2 className="h-4 w-4 text-emerald-300" />
            <span className="text-xs uppercase tracking-widest text-white/70">Checklist Progress</span>
          </div>
          <div className="space-y-2.5">
            {CHECKLIST.map((item, i) => (
              <motion.div key={item.label} className="flex items-center gap-2 text-sm"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 + i * 0.18 }}>
                <div className={`h-4 w-4 rounded border ${item.done ? "bg-emerald-500/25 border-emerald-400/70" : "bg-white/5 border-white/20"}`} />
                <span className={item.done ? "text-white/90" : "text-white/65"}>{item.label}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
