import { motion } from "framer-motion";
import { DollarSign, PieChart, TrendingDown } from "lucide-react";
import { burgundyGradientText, videoBadgeStyle, videoCardStyle, VIDEO_PALETTE } from "../videoPalette";

const CATEGORIES = [
  { name: "Venue", spent: 18500, total: 22000, color: "#8D294D" },
  { name: "Catering", spent: 12400, total: 15000, color: "#B16C8E" },
  { name: "Photography", spent: 5200, total: 6000, color: "#E6A6B7" },
  { name: "Florals", spent: 2800, total: 4500, color: "#C39B70" },
  { name: "Music & DJ", spent: 1900, total: 3000, color: "#F2B8C6" },
];

const TOTAL_BUDGET = CATEGORIES.reduce((s, c) => s + c.total, 0);
const TOTAL_SPENT = CATEGORIES.reduce((s, c) => s + c.spent, 0);

export function Scene2() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center px-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.96, filter: "blur(10px)" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        className="mb-6 text-center"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1 }}
      >
        <div className="mb-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5" style={videoBadgeStyle}>
          <PieChart className="h-4 w-4 text-[#B16C8E]" />
          <span className="text-xs font-bold uppercase tracking-[0.25em]">Budget Tracker</span>
        </div>
        <h2 className="font-serif text-[3.2vw] font-bold leading-tight" style={burgundyGradientText}>
          Every dollar, beautifully tracked
        </h2>
      </motion.div>

      <motion.div
        className="w-full max-w-3xl rounded-3xl p-7 backdrop-blur-xl"
        style={videoCardStyle}
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mb-6 flex items-end justify-between border-b border-[#E6A6B7]/40 pb-5">
          <div>
            <div className="mb-1 text-xs uppercase tracking-widest text-[#B16C8E]">Total spent</div>
            <div className="flex items-baseline gap-2">
              <DollarSign className="h-6 w-6 text-[#C39B70]" />
              <motion.span
                className="text-4xl font-bold text-[#8D294D]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.5 }}
              >
                {TOTAL_SPENT.toLocaleString()}
              </motion.span>
              <span className="text-base text-[#6F3E54]/70">/ ${TOTAL_BUDGET.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-[#C39B70]/[0.45] bg-[#F2E2C6]/60 px-3 py-1.5">
            <TrendingDown className="h-4 w-4 text-[#8D294D]" />
            <span className="text-sm font-semibold text-[#8D294D]">${(TOTAL_BUDGET - TOTAL_SPENT).toLocaleString()} under</span>
          </div>
        </div>

        <div className="space-y-3.5">
          {CATEGORIES.map((cat, i) => {
            const pct = (cat.spent / cat.total) * 100;
            return (
              <motion.div
                key={cat.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.12, duration: 0.5 }}
              >
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-semibold text-[#3B1C2B]">{cat.name}</span>
                  <span className="tabular-nums text-[#6F3E54]">
                    ${cat.spent.toLocaleString()} <span className="text-[#B16C8E]/70">/ ${cat.total.toLocaleString()}</span>
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#F2E2C6]/[0.65]">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${cat.color}, ${cat.color}cc)`,
                      boxShadow: `0 0 12px ${cat.color}55`,
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ delay: 0.7 + i * 0.12, duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      <motion.p
        className="mt-5 max-w-xl text-center text-base"
        style={{ color: VIDEO_PALETTE.softText }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 0.7 }}
      >
        Smart categories, instant alerts, and clear totals for every wedding decision.
      </motion.p>
    </motion.div>
  );
}
