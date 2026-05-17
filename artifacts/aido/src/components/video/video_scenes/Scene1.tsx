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
      className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center sm:px-8"
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
          className="absolute -inset-5 rounded-full border border-[#E6A6B7]/40 sm:-inset-8"
          animate={{ opacity: [0.35, 0.75, 0.35], scale: [0.96, 1.03, 0.96] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <img
          src={`${import.meta.env.BASE_URL}logo.png`}
          alt="A.IDO"
          className="relative z-10 h-36 w-auto object-contain drop-shadow-[0_22px_38px_rgba(141,41,77,0.16)] sm:h-[27vw] sm:max-h-72 sm:min-h-36"
        />
      </motion.div>

      <motion.div
        className="mt-5 sm:mt-7"
        initial={{ opacity: 0, y: 24 }}
        animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
        transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
      >
        <h1 className="font-serif text-5xl font-bold leading-none sm:text-[7vw]" style={burgundyGradientText}>
          A.IDO
        </h1>
      </motion.div>

      <motion.div
        className="mt-4 flex w-full max-w-[320px] items-center justify-center gap-2 sm:mt-5 sm:max-w-none sm:gap-4"
        initial={{ opacity: 0, y: 16 }}
        animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="h-px w-8 bg-[linear-gradient(90deg,transparent,#C39B70)] sm:w-16" />
        <p className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8D294D] sm:gap-2 sm:text-[1.5vw] sm:tracking-[0.25em]">
          <Sparkles className="h-4 w-4 shrink-0 text-[#E6A6B7] sm:h-[1.4vw] sm:w-[1.4vw] sm:min-h-4 sm:min-w-4" />
          <span className="leading-tight">AI Wedding Planner Assistant</span>
          <Heart className="h-4 w-4 shrink-0 fill-[#E6A6B7] text-[#E6A6B7] sm:h-[1.4vw] sm:w-[1.4vw] sm:min-h-4 sm:min-w-4" />
        </p>
        <div className="h-px w-8 bg-[linear-gradient(90deg,#C39B70,transparent)] sm:w-16" />
      </motion.div>

      <motion.p
        className="mt-5 max-w-xs text-base leading-relaxed sm:mt-7 sm:max-w-2xl sm:text-[1.6vw]"
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
