import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 2000),
      setTimeout(() => setPhase(4), 3200),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.2, ease: "easeInOut" }}
    >
      {/* Radial glow */}
      <motion.div
        className="absolute rounded-full"
        style={{ width: "50vw", height: "50vw", background: "radial-gradient(circle, rgba(212,160,23,0.18) 0%, rgba(233,30,140,0.08) 40%, transparent 70%)" }}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={phase >= 1 ? { scale: 1, opacity: 1 } : { scale: 0.5, opacity: 0 }}
        transition={{ duration: 2, ease: "easeOut" }}
      />

      {/* Stars */}
      <motion.div
        className="flex items-center gap-2 z-10 mb-4"
        initial={{ opacity: 0, y: 16 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.span
            key={i}
            style={{ color: "#F5C842", fontSize: "2vw", filter: "drop-shadow(0 0 8px rgba(245,200,66,0.8))" }}
            initial={{ opacity: 0, scale: 0 }}
            animate={phase >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
            transition={{ duration: 0.4, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
          >
            ★
          </motion.span>
        ))}
      </motion.div>

      <motion.p
        className="text-[1vw] tracking-[0.3em] uppercase text-white/40 mb-8 z-10"
        initial={{ opacity: 0 }}
        animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.8, delay: 0.3 }}
      >
        5.0 Rated by Couples
      </motion.p>

      {/* Logo */}
      <motion.img
        src={`${import.meta.env.BASE_URL}logo.png`}
        alt="A.IDO"
        className="z-10"
        style={{ width: "12vw", height: "12vw", objectFit: "contain", filter: "drop-shadow(0 0 32px rgba(212,160,23,0.45))" }}
        initial={{ opacity: 0, scale: 0.7 }}
        animate={phase >= 2 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.7 }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Brand name */}
      <motion.h1
        className="font-serif font-bold z-10 mt-4"
        style={{ fontSize: "6vw", lineHeight: 1, background: "linear-gradient(135deg, #D4A017 0%, #F5C842 50%, #D4A017 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 1, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      >
        A.IDO
      </motion.h1>

      {/* Tagline */}
      <motion.p
        className="font-serif italic z-10 mt-4"
        style={{ fontSize: "2.2vw", background: "linear-gradient(135deg, #E91E8C 0%, #7B2FBE 55%, #4F8EF7 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
        initial={{ opacity: 0, y: 16 }}
        animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      >
        Plan smarter. Love every moment.
      </motion.p>

      {/* CTA */}
      <motion.div
        className="mt-8 z-10 px-8 py-3 rounded-full text-[1.1vw] font-semibold text-white"
        style={{ background: "linear-gradient(135deg, #B8860B 0%, #D4A017 50%, #F5C842 100%)", boxShadow: "0 0 30px rgba(212,160,23,0.4)" }}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={phase >= 4 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        Start Planning Free — aido.app
      </motion.div>
    </motion.div>
  );
}
