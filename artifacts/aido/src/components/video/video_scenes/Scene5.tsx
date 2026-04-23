import { motion } from "framer-motion";
import { Bot, Sparkles, Send } from "lucide-react";

const ARIA_CONVERSATION = [
  { from: "you", text: "Aria, what's left on my checklist this week?" },
  { from: "aria", text: "You have 3 items: confirm the florist tasting, send seating chart to caterer, and pay the photographer's deposit ($1,800). Want me to draft any of these?" },
  { from: "you", text: "Draft the message to the caterer." },
];

export function Scene5() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center px-12"
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
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-400/10 border border-purple-400/30 mb-3">
          <Bot className="h-4 w-4 text-purple-300" />
          <span className="text-xs uppercase tracking-[0.25em] text-purple-200">Meet Aria</span>
        </div>
        <h2 className="text-[3.2vw] font-serif font-bold leading-tight"
          style={{ background: "linear-gradient(135deg, #fff 0%, #F5C842 60%, #E91E8C 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
        >
          Your AI wedding planner, on call 24/7
        </h2>
      </motion.div>

      <motion.div
        className="w-full max-w-2xl rounded-3xl p-6 backdrop-blur-xl"
        style={{
          background: "linear-gradient(145deg, rgba(40,18,72,0.9) 0%, rgba(20,8,40,0.9) 100%)",
          border: "1.5px solid",
          borderImage: "linear-gradient(135deg, #E91E8C 0%, #7B2FBE 50%, #D4A017 100%) 1",
          boxShadow: "0 20px 60px -10px rgba(233,30,140,0.35)",
        }}
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-center gap-2 pb-3 mb-4 border-b border-white/10">
          <div
            className="h-7 w-7 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #E91E8C 0%, #7B2FBE 100%)" }}
          >
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="font-serif text-base font-semibold text-white">Aria</span>
          <span className="text-xs text-emerald-300 ml-1">● online</span>
        </div>

        <div className="space-y-3 min-h-[200px]">
          {ARIA_CONVERSATION.map((msg, i) => (
            <motion.div
              key={i}
              className={`flex ${msg.from === "you" ? "justify-end" : "justify-start"}`}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.7 + i * 0.9, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <div
                className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.from === "you"
                    ? "rounded-br-sm text-white"
                    : "rounded-bl-sm bg-white/8 text-white/90"
                }`}
                style={msg.from === "you" ? { background: "linear-gradient(135deg, #7B2FBE 0%, #E91E8C 100%)" } : undefined}
              >
                {msg.text}
              </div>
            </motion.div>
          ))}

          {/* Typing indicator after last user message */}
          <motion.div
            className="flex justify-start"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 3.4, duration: 0.4 }}
          >
            <div className="px-4 py-2.5 rounded-2xl rounded-bl-sm bg-white/8 flex items-center gap-1.5">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-white/60"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </div>
          </motion.div>
        </div>

        {/* Input bar */}
        <motion.div
          className="mt-4 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <span className="text-sm text-white/40 flex-1">Ask Aria anything...</span>
          <div
            className="h-7 w-7 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #E91E8C 0%, #7B2FBE 100%)" }}
          >
            <Send className="h-3.5 w-3.5 text-white" />
          </div>
        </motion.div>
      </motion.div>

    </motion.div>
  );
}
