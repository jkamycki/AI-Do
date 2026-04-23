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
  {
    icon: "💺",
    color: "#7B2FBE",
    glow: "rgba(123,47,190,0.3)",
    label: "06 — Smart Seating",
    title: "Seating charts, solved by AI.",
    desc: "Tell us who shouldn't sit together and we'll arrange every table — diplomatically.",
  },
  {
    icon: "🎉",
    color: "#E91E8C",
    glow: "rgba(233,30,140,0.3)",
    label: "07 — Guest Collector",
    title: "RSVPs and details, on autopilot.",
    desc: "Send one link. Guests fill in dietary needs, plus-ones, and song requests — straight to your dashboard.",
  },
  {
    icon: "👥",
    color: "#D4A017",
    glow: "rgba(212,160,23,0.3)",
    label: "08 — Plan Together",
    title: "Invite your partner, planner, or family.",
    desc: "Real-time collaboration with role-based access and per-user language — everyone stays on the same page.",
  },
];

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 250),
      setTimeout(() => setPhase(2), 600),
      setTimeout(() => setPhase(3), 950),
      setTimeout(() => setPhase(4), 1300),
      setTimeout(() => setPhase(5), 1650),
      setTimeout(() => setPhase(6), 2000),
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
      <div className="grid grid-cols-3 gap-[1.2vw] w-full">
        {features.map((feat, i) => (
          <motion.div
            key={feat.label}
            className="rounded-2xl p-[1.2vw] border flex flex-col gap-2"
            style={{
              background: "rgba(255,255,255,0.03)",
              borderColor: `${feat.color}33`,
              backdropFilter: "blur(12px)",
              boxShadow: `0 0 40px ${feat.glow}, inset 0 1px 0 rgba(255,255,255,0.06)`,
            }}
            initial={{ opacity: 0, y: 40, scale: 0.92 }}
            animate={phase >= i + 1 ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 40, scale: 0.92 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <div
              className="w-[2.8vw] h-[2.8vw] rounded-xl flex items-center justify-center text-[1.3vw]"
              style={{ background: `${feat.glow}`, border: `1px solid ${feat.color}40` }}
            >
              {feat.icon}
            </div>
            <div className="text-[0.75vw] font-bold tracking-[0.18em] uppercase" style={{ color: feat.color }}>
              {feat.label}
            </div>
            <div className="font-serif text-[1.15vw] leading-snug text-white">
              {feat.title}
            </div>
            <div className="text-[0.85vw] leading-relaxed text-white/50">
              {feat.desc}
            </div>
          </motion.div>
        ))}
      </div>

      {/* "and so much more" footer */}
      <motion.div
        className="mt-[2vw] flex items-center gap-3"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 6 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      >
        <span
          className="font-serif italic text-[1.6vw]"
          style={{ background: "linear-gradient(135deg, #D4A017 0%, #F5C842 50%, #D4A017 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
        >
          …and so much more
        </span>
      </motion.div>
    </motion.div>
  );
}
