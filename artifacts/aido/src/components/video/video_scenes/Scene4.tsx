import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, FileText, ShieldCheck } from "lucide-react";
import { burgundyGradientText, videoBadgeStyle, videoCardStyle } from "../videoPalette";

const CONTRACT_LINES = [
  { text: "1. Booking deposit of $4,500 due upon signing.", flag: "ok" },
  { text: "2. Cancellation: 100% forfeit if cancelled within 90 days.", flag: "warn", note: "Industry standard is 60 days." },
  { text: "3. Final headcount due 14 days before event.", flag: "ok" },
  { text: "4. Vendor not liable for weather-related delays exceeding 4 hours.", flag: "warn", note: "Consider weather contingency clause." },
  { text: "5. All gratuities included in final invoice.", flag: "ok" },
  { text: "6. Auto-renewal for additional services without notice.", flag: "alert", note: "Hidden auto-renewal - request removal." },
];

export function Scene4() {
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
          <ShieldCheck className="h-4 w-4 text-[#B16C8E]" />
          <span className="text-xs font-bold uppercase tracking-[0.25em]">Contract Analyzer</span>
        </div>
        <h2 className="font-serif text-[3vw] font-bold leading-tight" style={burgundyGradientText}>
          AI reads every clause for you
        </h2>
      </motion.div>

      <motion.div
        className="relative w-full max-w-3xl rounded-3xl p-7 backdrop-blur-xl"
        style={videoCardStyle}
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mb-4 flex items-center gap-2 border-b border-[#E6A6B7]/40 pb-4">
          <FileText className="h-4 w-4 text-[#C39B70]" />
          <span className="text-sm font-semibold text-[#3B1C2B]">Bella_Vista_Wedding_Contract.pdf</span>
          <motion.span className="ml-auto flex items-center gap-1 text-xs font-semibold text-[#8D294D]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.6, duration: 0.5 }}>
            <CheckCircle2 className="h-3 w-3" />
            Analysis complete
          </motion.span>
        </div>

        <div className="space-y-2.5">
          {CONTRACT_LINES.map((line, i) => {
            const color = line.flag === "ok" ? "#8D294D" : line.flag === "warn" ? "#C39B70" : "#B63A58";
            const Icon = line.flag === "ok" ? CheckCircle2 : AlertTriangle;
            return (
              <motion.div
                key={i}
                className="flex items-start gap-3"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + i * 0.28, duration: 0.4 }}
              >
                <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full" style={{ background: `${color}18`, border: `1px solid ${color}55` }}>
                  <Icon className="h-3 w-3" style={{ color }} />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-[#3B1C2B]">{line.text}</div>
                  {line.note && (
                    <motion.div className="mt-1 text-xs italic" style={{ color }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 + i * 0.28, duration: 0.4 }}>
                      AI flag: {line.note}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[#E6A6B7]/40 pt-4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 3.2, duration: 0.5 }}>
          <span className="text-xs font-bold uppercase tracking-widest text-[#B16C8E]">Summary:</span>
          <span className="rounded-full border border-[#E6A6B7]/45 bg-white/60 px-2 py-1 text-xs text-[#8D294D]">3 standard</span>
          <span className="rounded-full border border-[#C39B70]/45 bg-[#F2E2C6]/60 px-2 py-1 text-xs text-[#8D294D]">2 to negotiate</span>
          <span className="rounded-full border border-[#B63A58]/35 bg-[#E6A6B7]/30 px-2 py-1 text-xs text-[#8D294D]">1 red flag</span>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
