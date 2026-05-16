import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Heart, Sparkles } from "lucide-react";
import { burgundyGradientText, VIDEO_PALETTE } from "../videoPalette";

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 900),
      setTimeout(() => setPhase(3), 1700),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.96, filter: "blur(10px)" }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        className="relative"
        initial={{ scale: 0.84, opacity: 0, y: 20 }}
        animate={phase >= 1 ? { scale: 1, opacity: 1, y: 0 } : { scale: 0.84, opacity: 0, y: 20 }}
        transition={{ duration: 1.15, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          className="absolute -inset-8 rounded-full border border-[#E6A6B7]/40"
          animate={{ opacity: [0.35, 0.75, 0.35], scale: [0.96, 1.03, 0.96] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <img
          src={`${import.meta.env.BASE_URL}logo.png`}
          alt="A.IDO"
          className="relative z-10 h-[27vw] max-h-72 min-h-36 w-auto object-contain drop-shadow-[0_22px_38px_rgba(141,41,77,0.16)]"
        />
      </motion.div>

      <motion.div
        className="mt-7"
        initial={{ opacity: 0, y: 24 }}
        animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
        transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
      >
        <h1 className="font-serif text-[7vw] font-bold leading-none" style={burgundyGradientText}>
          A.IDO
        </h1>
      </motion.div>

      <motion.div
        className="mt-5 flex items-center gap-4"
        initial={{ opacity: 0, y: 16 }}
        animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="h-px w-16 bg-[linear-gradient(90deg,transparent,#C39B70)]" />
        <p className="flex items-center gap-2 text-[1.5vw] font-semibold uppercase tracking-[0.25em] text-[#8D294D]">
          <Sparkles className="h-[1.4vw] w-[1.4vw] min-h-4 min-w-4 text-[#E6A6B7]" />
          AI Wedding Planner Assistant
          <Heart className="h-[1.4vw] w-[1.4vw] min-h-4 min-w-4 fill-[#E6A6B7] text-[#E6A6B7]" />
        </p>
        <div className="h-px w-16 bg-[linear-gradient(90deg,#C39B70,transparent)]" />
      </motion.div>

      <motion.p
        className="mt-7 max-w-2xl text-[1.6vw] leading-relaxed"
        style={{ color: VIDEO_PALETTE.softText }}
        initial={{ opacity: 0 }}
        animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: 0.35, duration: 0.9 }}
      >
        Plan your perfect day, effortlessly.
      </motion.p>
    </motion.div>
  );
}
