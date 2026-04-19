import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 1800),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center text-center px-[10vw]"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="mb-16 max-w-[60vw]"
      >
        <div className="text-[#c9956b] text-[1.2vw] font-bold tracking-widest uppercase mb-4">05. Day-Of Mode</div>
        <h2 className="text-[5vw] font-serif leading-tight text-[#7c3f5e]">Emergency AI help right when you need it most.</h2>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-[50vw]"
      >
        <div className="text-[#c9956b] text-[1.2vw] font-bold tracking-widest uppercase mb-4">06. Wedding Profile</div>
        <h2 className="text-[3vw] font-serif leading-tight text-[#3C2A32]/80">Your vision, style, and details — all in one place.</h2>
      </motion.div>
    </motion.div>
  );
}