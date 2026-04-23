import { motion } from "framer-motion";
import { FileText, AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";

const CONTRACT_LINES = [
  { text: "1. Booking deposit of $4,500 due upon signing.", flag: "ok" },
  { text: "2. Cancellation: 100% forfeit if cancelled within 90 days.", flag: "warn", note: "Industry standard is 60 days." },
  { text: "3. Final headcount due 14 days before event.", flag: "ok" },
  { text: "4. Vendor not liable for weather-related delays exceeding 4 hours.", flag: "warn", note: "Consider weather contingency clause." },
  { text: "5. All gratuities included in final invoice.", flag: "ok" },
  { text: "6. Auto-renewal for additional services without notice.", flag: "alert", note: "Hidden auto-renewal — request removal." },
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
      <motion.div
        className="text-center mb-5"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1 }}
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-400/10 border border-purple-400/30 mb-3">
          <ShieldCheck className="h-4 w-4 text-purple-300" />
          <span className="text-xs uppercase tracking-[0.25em] text-purple-200">Contract Analyzer</span>
        </div>
        <h2 className="text-[3vw] font-serif font-bold leading-tight"
          style={{ background: "linear-gradient(135deg, #fff 0%, #C7A0F0 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
        >
          AI reads every clause — so you don't have to
        </h2>
      </motion.div>

      <motion.div
        className="w-full max-w-3xl rounded-3xl p-7 backdrop-blur-xl relative"
        style={{
          background: "linear-gradient(145deg, rgba(40,18,72,0.9) 0%, rgba(20,8,40,0.9) 100%)",
          border: "1.5px solid rgba(123,47,190,0.45)",
          boxShadow: "0 20px 60px -10px rgba(123,47,190,0.35)",
        }}
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-center gap-2 pb-4 mb-4 border-b border-white/10">
          <FileText className="h-4 w-4 text-amber-300" />
          <span className="text-sm font-medium text-white/85">Bella_Vista_Wedding_Contract.pdf</span>
          <motion.span
            className="ml-auto text-xs text-emerald-300 flex items-center gap-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.6, duration: 0.5 }}
          >
            <CheckCircle2 className="h-3 w-3" />
            Analysis complete
          </motion.span>
        </div>

        <div className="space-y-2.5">
          {CONTRACT_LINES.map((line, i) => {
            const color = line.flag === "ok" ? "#22C55E" : line.flag === "warn" ? "#F5C842" : "#EF4444";
            const Icon = line.flag === "ok" ? CheckCircle2 : AlertTriangle;
            return (
              <motion.div
                key={i}
                className="flex gap-3 items-start"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + i * 0.28, duration: 0.4 }}
              >
                <div
                  className="mt-0.5 h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}20`, border: `1px solid ${color}60` }}
                >
                  <Icon className="h-3 w-3" style={{ color }} />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-white/85">{line.text}</div>
                  {line.note && (
                    <motion.div
                      className="mt-1 text-xs italic"
                      style={{ color }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.9 + i * 0.28, duration: 0.4 }}
                    >
                      AI flag: {line.note}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Summary chips */}
        <motion.div
          className="mt-5 pt-4 border-t border-white/10 flex items-center gap-3 flex-wrap"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 3.2, duration: 0.5 }}
        >
          <span className="text-xs uppercase tracking-widest text-white/40">Summary:</span>
          <span className="text-xs px-2 py-1 rounded-full bg-emerald-400/10 text-emerald-200 border border-emerald-400/30">3 standard</span>
          <span className="text-xs px-2 py-1 rounded-full bg-amber-400/10 text-amber-200 border border-amber-400/30">2 to negotiate</span>
          <span className="text-xs px-2 py-1 rounded-full bg-red-400/10 text-red-200 border border-red-400/30">1 red flag</span>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
