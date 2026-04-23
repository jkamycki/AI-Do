import { motion } from "framer-motion";
import { Mail, Send, Sparkles, MessageCircle } from "lucide-react";

const COMPOSED_LINES = [
  "Hi Bella Vista Estate,",
  "We're getting married on June 14, 2026 and",
  "loved your venue. Could you share availability,",
  "pricing for 120 guests, and any seasonal packages?",
  "Thank you! — Sarah & Michael",
];

const CONVERSATION = [
  { from: "you", text: "We're booking for 120 guests on June 14.", time: "10:14" },
  { from: "vendor", text: "Perfect — we have that date open. Saturday packages start at $14k.", time: "10:21" },
  { from: "you", text: "Could we tour next Tuesday at 2pm?", time: "10:23" },
  { from: "vendor", text: "Tuesday 2pm works! I'll send a calendar invite.", time: "10:25" },
];

export function Scene3() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center px-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.96, filter: "blur(10px)" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        className="text-center mb-5"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1 }}
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-pink-400/10 border border-pink-400/30 mb-3">
          <Mail className="h-4 w-4 text-pink-300" />
          <span className="text-xs uppercase tracking-[0.25em] text-pink-200">Vendor Communications</span>
        </div>
        <h2 className="text-[3vw] font-serif font-bold leading-tight"
          style={{ background: "linear-gradient(135deg, #fff 0%, #F8B4DA 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
        >
          AI writes it. They reply. You stay in the loop.
        </h2>
      </motion.div>

      <div className="grid grid-cols-2 gap-6 w-full max-w-5xl">
        {/* AI Email Composer */}
        <motion.div
          className="rounded-2xl p-5 backdrop-blur-xl"
          style={{
            background: "linear-gradient(145deg, rgba(40,18,72,0.85) 0%, rgba(20,8,40,0.85) 100%)",
            border: "1.5px solid rgba(233,30,140,0.4)",
            boxShadow: "0 20px 50px -10px rgba(233,30,140,0.3)",
          }}
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-white/10">
            <Sparkles className="h-4 w-4 text-amber-300" />
            <span className="text-xs uppercase tracking-widest text-white/70">AI Composing</span>
            <motion.div
              className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            />
          </div>
          <div className="text-xs text-white/50 mb-2">To: hello@bellavista.com</div>
          <div className="text-xs text-white/50 mb-3">Subject: Wedding Inquiry — June 14, 2026</div>
          <div className="space-y-1.5 min-h-[140px]">
            {COMPOSED_LINES.map((line, i) => (
              <motion.div
                key={i}
                className="text-sm text-white/85 leading-relaxed"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + i * 0.45, duration: 0.4 }}
              >
                {line}
              </motion.div>
            ))}
          </div>
          <motion.button
            className="mt-4 w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: "linear-gradient(135deg, #E91E8C 0%, #7B2FBE 100%)" }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 3.2, duration: 0.4 }}
          >
            <Send className="h-3.5 w-3.5" />
            Send to vendor
          </motion.button>
        </motion.div>

        {/* Live conversation thread */}
        <motion.div
          className="rounded-2xl p-5 backdrop-blur-xl"
          style={{
            background: "linear-gradient(145deg, rgba(40,18,72,0.85) 0%, rgba(20,8,40,0.85) 100%)",
            border: "1.5px solid rgba(123,47,190,0.4)",
            boxShadow: "0 20px 50px -10px rgba(123,47,190,0.3)",
          }}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-white/10">
            <MessageCircle className="h-4 w-4 text-purple-300" />
            <span className="text-xs uppercase tracking-widest text-white/70">Bella Vista Estate</span>
          </div>
          <div className="space-y-2.5">
            {CONVERSATION.map((msg, i) => (
              <motion.div
                key={i}
                className={`flex ${msg.from === "you" ? "justify-end" : "justify-start"}`}
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 1.2 + i * 0.5, duration: 0.4 }}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${
                    msg.from === "you"
                      ? "rounded-br-sm text-white"
                      : "rounded-bl-sm bg-white/8 text-white/90"
                  }`}
                  style={msg.from === "you" ? { background: "linear-gradient(135deg, #7B2FBE 0%, #E91E8C 100%)" } : undefined}
                >
                  {msg.text}
                  <div className={`text-[10px] mt-1 ${msg.from === "you" ? "text-white/60" : "text-white/40"}`}>{msg.time}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      <motion.p
        className="mt-5 text-white/65 text-base text-center max-w-2xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 4, duration: 0.7 }}
      >
        Compose, send, and chat with every vendor — all from one inbox.
      </motion.p>
    </motion.div>
  );
}
