import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const features = [
  {
    icon: "✉",
    color: "#E91E8C",
    glow: "rgba(233,30,140,0.3)",
    label: "03 — Vendor Emails",
    title: "Professional emails, drafted in seconds.",
    desc: "AI writes the perfect message to every florist, caterer, and photographer — in your tone, instantly.",
  },
  {
    icon: "✓",
    color: "#D4A017",
    glow: "rgba(212,160,23,0.3)",
    label: "04 — Smart Checklist",
    title: "Month-by-month tasks, tailored to you.",
    desc: "Never miss a deadline. Your checklist auto-builds around your wedding date and guest count.",
  },
  {
    icon: "📄",
    color: "#4F8EF7",
    glow: "rgba(79,142,247,0.3)",
    label: "05 — Contract Analyzer",
    title: "AI flags the risks before you sign.",
    desc: "Upload any vendor contract and get a plain-English summary of every clause that matters.",
  },
];

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 900),
      setTimeout(() => setPhase(3), 1700),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center px-[8vw]"
      initial={{ opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -60, filter: "blur(10px)" }}
      transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Header */}
      <motion.div
        className="text-center mb-[3vw]"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      >
        <h2
          className="font-serif text-[4vw] font-bold leading-tight"
          style={{ background: "linear-gradient(135deg, #E91E8C 0%, #7B2FBE 55%, #4F8EF7 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
        >
          Handle every vendor. Effortlessly.
        </h2>
      </motion.div>

      {/* Feature cards */}
      <div className="flex gap-[1.5vw] w-full">
        {features.map((feat, i) => (
          <motion.div
            key={feat.label}
            className="flex-1 rounded-2xl p-[1.6vw] border flex flex-col gap-3"
            style={{
              background: "rgba(255,255,255,0.03)",
              borderColor: `rgba(${feat.color === "#E91E8C" ? "233,30,140" : feat.color === "#D4A017" ? "212,160,23" : "79,142,247"},0.2)`,
              backdropFilter: "blur(12px)",
              boxShadow: `0 0 40px ${feat.glow}, inset 0 1px 0 rgba(255,255,255,0.06)`,
            }}
            initial={{ opacity: 0, y: 40, scale: 0.92 }}
            animate={phase >= i + 1 ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 40, scale: 0.92 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            <div
              className="w-[3.5vw] h-[3.5vw] rounded-xl flex items-center justify-center text-[1.6vw]"
              style={{ background: `${feat.glow}`, border: `1px solid ${feat.color}40` }}
            >
              {feat.icon}
            </div>
            <div className="text-[0.9vw] font-bold tracking-[0.18em] uppercase" style={{ color: feat.color }}>
              {feat.label}
            </div>
            <div className="font-serif text-[1.5vw] leading-snug text-white">
              {feat.title}
            </div>
            <div className="text-[1vw] leading-relaxed text-white/50">
              {feat.desc}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
