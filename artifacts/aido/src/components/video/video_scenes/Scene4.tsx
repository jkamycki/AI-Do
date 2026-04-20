import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const chatMessages = [
  { from: "user", text: "Our photographer just called — they're 45 mins late. Help!" },
  { from: "aria", text: "Deep breath — here's your plan. Start cocktail hour 15 min early, adjust the portrait window to 3:45–4:15, and I'll draft a message to your coordinator right now." },
];

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 2200),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-between px-[8vw]"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05, filter: "blur(12px)" }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Left: copy */}
      <div className="w-[40%] flex flex-col gap-6">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="text-[1vw] font-bold tracking-[0.22em] uppercase mb-3" style={{ color: "#D4A017" }}>
            06 — Aria & Day-Of
          </div>
          <h2 className="font-serif text-[4vw] leading-tight text-white mb-4">
            AI support — even on
            <span
              className="block"
              style={{ background: "linear-gradient(135deg, #E91E8C 0%, #7B2FBE 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
            >
              the big day itself.
            </span>
          </h2>
          <p className="text-[1.3vw] text-white/55 leading-relaxed">
            Aria is your 24/7 AI planning partner. When something goes sideways on your wedding day, she's right there with a calm, instant plan.
          </p>
        </motion.div>

        {/* Pulse indicator */}
        <motion.div
          className="flex items-center gap-3"
          initial={{ opacity: 0 }}
          animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.8 }}
        >
          <motion.div
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: "#22c55e", boxShadow: "0 0 12px rgba(34,197,94,0.7)" }}
            animate={{ scale: [1, 1.5, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          />
          <span className="text-[1vw] text-white/50 tracking-wide">Aria is online and ready</span>
        </motion.div>
      </div>

      {/* Right: Chat window */}
      <motion.div
        className="w-[46%] rounded-2xl overflow-hidden border"
        style={{
          background: "rgba(255,255,255,0.04)",
          borderColor: "rgba(233,30,140,0.25)",
          backdropFilter: "blur(12px)",
          boxShadow: "0 0 60px rgba(233,30,140,0.12), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
        initial={{ opacity: 0, x: 50, scale: 0.9 }}
        animate={phase >= 1 ? { opacity: 1, x: 0, scale: 1 } : { opacity: 0, x: 50, scale: 0.9 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Chat header */}
        <div
          className="flex items-center gap-3 px-4 py-3 border-b"
          style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(233,30,140,0.08)" }}
        >
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="Aria"
            className="w-[2.5vw] h-[2.5vw] object-contain rounded-full"
          />
          <div>
            <div className="text-[1vw] font-semibold text-white">Aria — Planner AI</div>
            <div className="text-[0.75vw] text-green-400">● Online</div>
          </div>
        </div>

        {/* Messages */}
        <div className="p-4 flex flex-col gap-3">
          {chatMessages.map((msg, i) => (
            <motion.div
              key={i}
              className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
              initial={{ opacity: 0, y: 12 }}
              animate={phase >= i + 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <div
                className="max-w-[82%] rounded-2xl px-4 py-3 text-[0.95vw] leading-relaxed"
                style={
                  msg.from === "user"
                    ? { background: "rgba(233,30,140,0.2)", color: "rgba(255,255,255,0.9)", borderRadius: "16px 16px 4px 16px" }
                    : {
                        background: "rgba(255,255,255,0.07)",
                        color: "rgba(255,255,255,0.85)",
                        borderRadius: "16px 16px 16px 4px",
                        border: "1px solid rgba(212,160,23,0.2)",
                      }
                }
              >
                {msg.text}
              </div>
            </motion.div>
          ))}

          {/* Typing indicator */}
          {phase < 3 && (
            <motion.div className="flex justify-start" initial={{ opacity: 0 }} animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.5 }}>
              <div
                className="rounded-2xl px-4 py-3 flex items-center gap-1.5"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(212,160,23,0.2)", borderRadius: "16px 16px 16px 4px" }}
              >
                {[0, 1, 2].map((i) => (
                  <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-white/40" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.7, delay: i * 0.15, repeat: Infinity }} />
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
