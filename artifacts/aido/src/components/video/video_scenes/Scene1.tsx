import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300), // Tagline
      setTimeout(() => setPhase(2), 2500), // Exit start
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const title = "A.IDO";

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Title */}
      <div className="flex space-x-2">
        {title.split("").map((char, index) => (
          <motion.h1
            key={index}
            className="text-[12vw] font-serif font-bold text-[#7c3f5e] leading-none"
            initial={{ opacity: 0, y: 50, rotateX: 45 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{
              duration: 1,
              delay: index * 0.1,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {char}
          </motion.h1>
        ))}
      </div>

      {/* Tagline */}
      <motion.div
        className="mt-6 flex items-center space-x-4"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="h-[1px] w-16 bg-[#c9956b]"></div>
        <p className="text-[2vw] font-sans tracking-widest text-[#3C2A32]/80 uppercase">
          Your AI Wedding Planner
        </p>
        <div className="h-[1px] w-16 bg-[#c9956b]"></div>
      </motion.div>
    </motion.div>
  );
}