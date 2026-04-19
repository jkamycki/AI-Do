import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 600),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-row-reverse items-center px-[10vw]"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, y: -100, filter: "blur(10px)" }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-1/2 pl-12 z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12"
        >
          <div className="text-[#c9956b] text-[1.2vw] font-bold tracking-widest uppercase mb-2">03. Vendor Emails</div>
          <h2 className="text-[4vw] font-serif leading-tight text-[#7c3f5e] mb-4">Professional emails drafted in seconds.</h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="text-[#c9956b] text-[1.2vw] font-bold tracking-widest uppercase mb-2">04. Smart Checklist</div>
          <h2 className="text-[3vw] font-serif leading-tight text-[#3C2A32]/80">Month-by-month tasks tailored to you.</h2>
        </motion.div>
      </div>

      <div className="w-1/2 relative h-full flex items-center justify-center">
        <motion.img
          src={`${import.meta.env.BASE_URL}images/bokeh-bg.png`}
          className="w-[30vw] h-[40vw] object-cover rounded-2xl shadow-2xl shadow-[#7c3f5e]/20"
          initial={{ opacity: 0, scale: 0.8, rotate: 10 }}
          animate={phase >= 1 ? { opacity: 1, scale: 1, rotate: -5 } : { opacity: 0, scale: 0.8, rotate: 10 }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </motion.div>
  );
}