import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const timelineItems = [
  { time: "10:00 AM", label: "Ceremony Begins", dot: "#E91E8C" },
  { time: "11:15 AM", label: "Ring Exchange", dot: "#7B2FBE" },
  { time: "12:30 PM", label: "Cocktail Hour", dot: "#D4A017" },
  { time: "7:00 PM", label: "First Dance", dot: "#4F8EF7" },
];

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 800),
      setTimeout(() => setPhase(3), 1600),
      setTimeout(() => setPhase(4), 2600),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-between px-[8vw]"
      initial={{ opacity: 0, x: 80 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -80, filter: "blur(10px)" }}
      transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Left: Feature copy */}
      <div className="w-[42%] flex flex-col gap-10">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="text-[1vw] font-bold tracking-[0.22em] uppercase mb-2" style={{ color: "#D4A017" }}>
            01 — AI Timeline
          </div>
          <h2 className="font-serif text-[3.8vw] leading-tight text-white mb-3">
            Your perfect day,<br />
            <span style={{ background: "linear-gradient(135deg, #E91E8C 0%, #7B2FBE 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              planned to the minute.
            </span>
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="text-[1vw] font-bold tracking-[0.22em] uppercase mb-2" style={{ color: "#D4A017" }}>
            02 — Budget Manager
          </div>
          <h2 className="font-serif text-[2.6vw] leading-tight text-white/80">
            Track every dollar. Predict costs with AI.
          </h2>
        </motion.div>
      </div>

      {/* Right: Animated Timeline card */}
      <motion.div
        className="w-[44%] rounded-2xl p-5 border"
        style={{
          background: "rgba(255,255,255,0.04)",
          borderColor: "rgba(212,160,23,0.25)",
          backdropFilter: "blur(12px)",
          boxShadow: "0 0 60px rgba(212,160,23,0.1), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
        initial={{ opacity: 0, scale: 0.88, y: 30 }}
        animate={phase >= 1 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.88, y: 30 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="text-[0.9vw] font-semibold tracking-widest uppercase text-white/40 mb-4">Wedding Day Timeline</div>
        <div className="flex flex-col gap-0">
          {timelineItems.map((item, i) => (
            <motion.div
              key={item.time}
              className="flex items-start gap-3 py-3"
              style={{ borderBottom: i < timelineItems.length - 1 ? "1px solid rgba(255,255,255,0.07)" : "none" }}
              initial={{ opacity: 0, x: 20 }}
              animate={phase >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
              transition={{ duration: 0.6, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: item.dot, boxShadow: `0 0 8px ${item.dot}` }} />
              <div>
                <div className="text-[1vw] font-medium text-white/90">{item.label}</div>
                <div className="text-[0.8vw] text-white/40">{item.time}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Budget mini bar */}
        <motion.div
          className="mt-5 pt-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
          initial={{ opacity: 0 }}
          animate={phase >= 4 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="flex justify-between text-[0.85vw] text-white/50 mb-2">
            <span>Budget used</span>
            <span style={{ color: "#D4A017" }}>$24,800 / $35,000</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, #D4A017, #F5C842)" }}
              initial={{ width: "0%" }}
              animate={phase >= 4 ? { width: "71%" } : { width: "0%" }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
