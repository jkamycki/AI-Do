import { motion } from "framer-motion";
import { CalendarCheck2, CheckSquare2, Clock3 } from "lucide-react";
import { burgundyGradientText, videoBadgeStyle, videoCardStyle, videoSmallCardStyle } from "../videoPalette";

const TIMELINE = [
  { title: "Finalize venue contract", due: "Done", done: true },
  { title: "Mail digital invitations", due: "In 5 days", done: false },
  { title: "Confirm floral design", due: "In 10 days", done: false },
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
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center px-5 py-5 sm:px-12 sm:py-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.96, filter: "blur(10px)" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div className="mb-4 text-center sm:mb-5" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1.5 sm:mb-3 sm:px-4" style={videoBadgeStyle}>
          <CalendarCheck2 className="h-3.5 w-3.5 text-[#B16C8E] sm:h-4 sm:w-4" />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] sm:text-xs sm:tracking-[0.25em]">Timeline + Checklist</span>
        </div>
        <h2 className="mx-auto max-w-xs font-serif text-[2rem] font-bold leading-[1.02] sm:max-w-none sm:text-[3vw] sm:leading-tight" style={burgundyGradientText}>
          Know what's next and what's done
        </h2>
      </motion.div>

      <div className="grid w-full max-w-[340px] grid-cols-1 gap-3 sm:max-w-5xl sm:grid-cols-2 sm:gap-6">
        <motion.div
          className="rounded-3xl p-4 backdrop-blur-xl sm:p-5"
          style={videoCardStyle}
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.25 }}
        >
          <div className="mb-2 flex items-center gap-2 border-b border-[#E6A6B7]/40 pb-2 sm:mb-3 sm:pb-3">
            <Clock3 className="h-4 w-4 text-[#C39B70]" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#8D294D] sm:text-xs">Wedding Timeline</span>
          </div>
          <div className="space-y-2 sm:space-y-2.5">
            {TIMELINE.map((item, i) => (
              <motion.div
                key={item.title}
                className="flex items-center justify-between gap-2 rounded-xl px-3 py-2"
                style={videoSmallCardStyle}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.2 }}
              >
                <span className="min-w-0 text-xs font-medium text-[#3B1C2B] sm:text-sm">{item.title}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold sm:text-[11px] ${item.done ? "bg-[#F2E2C6] text-[#8D294D]" : "bg-[#E6A6B7]/[0.35] text-[#8D294D]"}`}>
                  {item.due}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="rounded-3xl p-4 backdrop-blur-xl sm:p-5"
          style={videoCardStyle}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.35 }}
        >
          <div className="mb-2 flex items-center gap-2 border-b border-[#E6A6B7]/40 pb-2 sm:mb-3 sm:pb-3">
            <CheckSquare2 className="h-4 w-4 text-[#C39B70]" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#8D294D] sm:text-xs">Checklist Progress</span>
          </div>
          <div className="space-y-2.5 sm:space-y-3">
            {CHECKLIST.map((item, i) => (
              <motion.div
                key={item.label}
                className="flex items-center gap-2.5 text-xs sm:gap-3 sm:text-sm"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + i * 0.18 }}
              >
                <div className={`h-3.5 w-3.5 shrink-0 rounded border sm:h-4 sm:w-4 ${item.done ? "border-[#8D294D] bg-[#E6A6B7]" : "border-[#E6A6B7] bg-white/[0.65]"}`} />
                <span className={item.done ? "font-medium text-[#3B1C2B]" : "text-[#6F3E54]"}>{item.label}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
