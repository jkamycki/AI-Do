import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-[#fdf6ee]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.5, ease: "easeInOut" }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={phase >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center"
      >
        <div className="flex space-x-2 text-[#c9956b] text-[3vw] mb-6">
          <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
        </div>
        <h2 className="text-[2vw] font-sans font-medium tracking-widest text-[#3C2A32]/80 uppercase mb-12">
          5.0 Rated by Couples
        </h2>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center"
      >
        <h1 className="text-[8vw] font-serif font-bold text-[#7c3f5e] leading-none mb-6">
          A.IDO
        </h1>
        <p className="text-[2.5vw] font-serif italic text-[#3C2A32]">
          Plan smarter. Love every moment.
        </p>
      </motion.div>
    </motion.div>
  );
}