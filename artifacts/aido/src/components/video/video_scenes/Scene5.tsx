import { motion } from "framer-motion";
import { Bot, Send, Sparkles } from "lucide-react";
import { burgundyGradientText, dustyRoseGradient, videoBadgeStyle, videoCardStyle } from "../videoPalette";

const ARIA_CONVERSATION = [
  { from: "you", text: "Aria, what's left on my checklist this week?" },
  { from: "aria", text: "You have 3 items: confirm the florist tasting, send seating chart to caterer, and pay the photographer's deposit ($1,800)." },
  { from: "you", text: "Draft the message to the caterer." },
];

export function Scene5() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center px-5 py-5 sm:px-12 sm:py-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.96, filter: "blur(10px)" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div className="mb-4 text-center sm:mb-5" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1.5 sm:mb-3 sm:px-4" style={videoBadgeStyle}>
          <Bot className="h-3.5 w-3.5 text-[#B16C8E] sm:h-4 sm:w-4" />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] sm:text-xs sm:tracking-[0.25em]">Meet Aria</span>
        </div>
        <h2 className="mx-auto max-w-xs font-serif text-[2rem] font-bold leading-[1.02] sm:max-w-none sm:text-[3.2vw] sm:leading-tight" style={burgundyGradientText}>
          Your AI wedding planner, on call
        </h2>
      </motion.div>

      <motion.div
        className="w-full max-w-[340px] rounded-3xl p-4 backdrop-blur-xl sm:max-w-2xl sm:p-6"
        style={videoCardStyle}
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mb-3 flex items-center gap-2 border-b border-[#E6A6B7]/40 pb-3 sm:mb-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: dustyRoseGradient }}>
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="font-serif text-base font-semibold text-[#8D294D]">Aria</span>
          <span className="ml-1 text-xs font-semibold text-[#B16C8E]">online</span>
        </div>

        <div className="min-h-[190px] space-y-2.5 sm:min-h-[200px] sm:space-y-3">
          {ARIA_CONVERSATION.map((msg, i) => (
            <motion.div
              key={i}
              className={`flex ${msg.from === "you" ? "justify-end" : "justify-start"}`}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.7 + i * 0.9, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <div
                className={`max-w-[86%] rounded-2xl px-3 py-2 text-xs leading-relaxed sm:max-w-[80%] sm:px-4 sm:py-2.5 sm:text-sm ${
                  msg.from === "you"
                    ? "rounded-br-sm text-white"
                    : "rounded-bl-sm border border-[#E6A6B7]/38 bg-white/68 text-[#3B1C2B]"
                }`}
                style={msg.from === "you" ? { background: dustyRoseGradient } : undefined}
              >
                {msg.text}
              </div>
            </motion.div>
          ))}

          <motion.div className="flex justify-start" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.4, duration: 0.4 }}>
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-[#E6A6B7]/38 bg-white/68 px-3 py-2 sm:px-4 sm:py-2.5">
              {[0, 1, 2].map(i => (
                <motion.div key={i} className="h-1.5 w-1.5 rounded-full bg-[#B16C8E]" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />
              ))}
            </div>
          </motion.div>
        </div>

        <motion.div className="mt-3 flex items-center gap-2 rounded-xl border border-[#E6A6B7]/38 bg-white/62 px-3 py-2 sm:mt-4 sm:py-2.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.5 }}>
          <span className="flex-1 text-xs text-[#6F3E54]/65 sm:text-sm">Ask Aria anything...</span>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: dustyRoseGradient }}>
            <Send className="h-3.5 w-3.5 text-white" />
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
