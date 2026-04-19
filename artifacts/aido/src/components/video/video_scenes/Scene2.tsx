import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 600), // Image
      setTimeout(() => setPhase(2), 1200), // Timeline text
      setTimeout(() => setPhase(3), 2000), // Budget text
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center px-[10vw]"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100, filter: "blur(10px)" }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-1/2 pr-12 z-10">
        {/* Timeline Feature */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12"
        >
          <div className="text-[#c9956b] text-[1.2vw] font-bold tracking-widest uppercase mb-2">01. AI Timeline</div>
          <h2 className="text-[4vw] font-serif leading-tight text-[#7c3f5e] mb-4">A perfect minute-by-minute schedule.</h2>
        </motion.div>

        {/* Budget Feature */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="text-[#c9956b] text-[1.2vw] font-bold tracking-widest uppercase mb-2">02. Budget Manager</div>
          <h2 className="text-[3vw] font-serif leading-tight text-[#3C2A32]/80">Track spending and predict costs with AI.</h2>
        </motion.div>
      </div>

      <div className="w-1/2 relative h-full flex items-center justify-center">
        <motion.img
          src={`${import.meta.env.BASE_URL}images/floral-bg.png`}
          className="w-[35vw] h-[35vw] object-cover rounded-full shadow-2xl shadow-[#7c3f5e]/20"
          initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
          animate={phase >= 1 ? { opacity: 1, scale: 1, rotate: 0 } : { opacity: 0, scale: 0.8, rotate: -10 }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </motion.div>
  );
}