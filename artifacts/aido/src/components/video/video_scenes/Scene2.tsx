import { motion } from "framer-motion";
import { DollarSign, TrendingDown, PieChart } from "lucide-react";

const CATEGORIES = [
  { name: "Venue", spent: 18500, total: 22000, color: "#E91E8C" },
  { name: "Catering", spent: 12400, total: 15000, color: "#7B2FBE" },
  { name: "Photography", spent: 5200, total: 6000, color: "#D4A017" },
  { name: "Florals", spent: 2800, total: 4500, color: "#4F8EF7" },
  { name: "Music & DJ", spent: 1900, total: 3000, color: "#22C55E" },
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
      {/* Heading */}
      <motion.div
        className="text-center mb-6"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1 }}
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 mb-3">
          <PieChart className="h-4 w-4 text-amber-300" />
          <span className="text-xs uppercase tracking-[0.25em] text-amber-200">Budget Tracker</span>
        </div>
        <h2 className="text-[3.2vw] font-serif font-bold leading-tight"
          style={{ background: "linear-gradient(135deg, #fff 0%, #F5C842 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
        >
          Every dollar, perfectly tracked
        </h2>
      </motion.div>

      {/* Budget Card */}
      <motion.div
        className="w-full max-w-3xl rounded-3xl p-7 backdrop-blur-xl"
        style={{
          background: "linear-gradient(145deg, rgba(40,18,72,0.85) 0%, rgba(20,8,40,0.85) 100%)",
          border: "1.5px solid",
          borderImage: "linear-gradient(135deg, #B8860B 0%, #D4A017 50%, #F5C842 100%) 1",
          boxShadow: "0 20px 60px -10px rgba(212,160,23,0.25)",
        }}
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Total summary */}
        <div className="flex items-end justify-between mb-6 pb-5 border-b border-white/10">
          <div>
            <div className="text-xs uppercase tracking-widest text-white/50 mb-1">Total spent</div>
            <div className="flex items-baseline gap-2">
              <DollarSign className="h-6 w-6 text-amber-300" />
              <motion.span
                className="text-4xl font-bold text-white"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.5 }}
              >
                {TOTAL_SPENT.toLocaleString()}
              </motion.span>
              <span className="text-base text-white/50">/ ${TOTAL_BUDGET.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-400/10 border border-emerald-400/30">
            <TrendingDown className="h-4 w-4 text-emerald-300" />
            <span className="text-sm text-emerald-200 font-medium">${(TOTAL_BUDGET - TOTAL_SPENT).toLocaleString()} under</span>
          </div>
        </div>

        {/* Category bars */}
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
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="font-medium text-white/90">{cat.name}</span>
                  <span className="text-white/60 tabular-nums">
                    ${cat.spent.toLocaleString()} <span className="text-white/30">/ ${cat.total.toLocaleString()}</span>
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${cat.color}, ${cat.color}cc)`,
                      boxShadow: `0 0 12px ${cat.color}80`,
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

      {/* Caption */}
      <motion.p
        className="mt-5 text-white/65 text-base text-center max-w-xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 0.7 }}
      >
        Smart categories, instant alerts, real-time totals — never wonder where the money went.
      </motion.p>
    </motion.div>
  );
}
