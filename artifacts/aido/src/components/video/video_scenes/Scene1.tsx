import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 900),
      setTimeout(() => setPhase(3), 1800),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95, filter: "blur(12px)" }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Glow ring behind logo */}
      <motion.div
        className="absolute rounded-full"
        style={{ width: "22vw", height: "22vw", background: "radial-gradient(circle, rgba(212,160,23,0.25) 0%, transparent 70%)" }}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={phase >= 1 ? { scale: 1.4, opacity: 1 } : { scale: 0.6, opacity: 0 }}
        transition={{ duration: 2.5, ease: "easeOut" }}
      />

      {/* Logo */}
      <motion.img
        src={`${import.meta.env.BASE_URL}logo.png`}
        alt="A.IDO"
        className="relative z-10"
        style={{ width: "16vw", height: "16vw", objectFit: "contain", filter: "drop-shadow(0 0 40px rgba(212,160,23,0.5))" }}
        initial={{ scale: 0.5, opacity: 0, y: 20 }}
        animate={phase >= 1 ? { scale: 1, opacity: 1, y: 0 } : { scale: 0.5, opacity: 0, y: 20 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Brand name */}
      <motion.div
        className="mt-6 z-10"
        initial={{ opacity: 0, y: 24 }}
        animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      >
        <h1
          className="font-serif text-[7vw] font-bold leading-none"
          style={{ background: "linear-gradient(135deg, #D4A017 0%, #F5C842 50%, #D4A017 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
        >
          A.IDO
        </h1>
      </motion.div>

      {/* Tagline */}
      <motion.div
        className="mt-4 flex items-center gap-4 z-10"
        initial={{ opacity: 0, y: 16 }}
        animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="h-px w-14" style={{ background: "linear-gradient(90deg, transparent, #D4A017)" }} />
        <p
          className="text-[1.6vw] font-medium tracking-[0.25em] uppercase"
          style={{ background: "linear-gradient(135deg, #E91E8C 0%, #7B2FBE 55%, #4F8EF7 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
        >
          AI Wedding Planning OS
        </p>
        <div className="h-px w-14" style={{ background: "linear-gradient(90deg, #D4A017, transparent)" }} />
      </motion.div>
    </motion.div>
  );
}
