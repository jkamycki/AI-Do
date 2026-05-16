import { motion } from "framer-motion";
import { Check, Clock, Users, UtensilsCrossed, X } from "lucide-react";
import { burgundyGradientText, videoBadgeStyle, videoCardStyle } from "../videoPalette";

const GUESTS = [
  { name: "Emma & James Carter", side: "Bride", count: 2, rsvp: "yes", meal: "Vegetarian" },
  { name: "David Chen +1", side: "Groom", count: 2, rsvp: "yes", meal: "Standard" },
  { name: "Priya & Arjun Patel", side: "Bride", count: 2, rsvp: "pending", meal: "-" },
  { name: "The Rodriguez Family", side: "Groom", count: 4, rsvp: "yes", meal: "2 kids meals" },
  { name: "Olivia Bennett", side: "Bride", count: 1, rsvp: "no", meal: "-" },
  { name: "Marcus & Lily Wong", side: "Groom", count: 2, rsvp: "yes", meal: "Gluten-free" },
];

const STATS = [
  { label: "Invited", value: 142, color: "#3B1C2B" },
  { label: "Confirmed", value: 98, color: "#8D294D" },
  { label: "Pending", value: 31, color: "#C39B70" },
  { label: "Declined", value: 13, color: "#B63A58" },
];

export function Scene6() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center px-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.96, filter: "blur(10px)" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div className="mb-5 text-center" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5" style={videoBadgeStyle}>
          <Users className="h-4 w-4 text-[#B16C8E]" />
          <span className="text-xs font-bold uppercase tracking-[0.25em]">Guest List</span>
        </div>
        <h2 className="font-serif text-[3vw] font-bold leading-tight" style={burgundyGradientText}>
          Every RSVP, meal, and plus-one handled
        </h2>
      </motion.div>

      <motion.div
        className="w-full max-w-4xl rounded-3xl p-6 backdrop-blur-xl"
        style={videoCardStyle}
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mb-4 grid grid-cols-4 gap-3 border-b border-[#E6A6B7]/40 pb-4">
          {STATS.map((stat, i) => (
            <motion.div key={stat.label} className="text-center" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 + i * 0.1, duration: 0.5 }}>
              <div className="text-2xl font-bold tabular-nums" style={{ color: stat.color }}>{stat.value}</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-widest text-[#B16C8E]">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        <div className="space-y-1.5">
          {GUESTS.map((g, i) => {
            const rsvpStyle =
              g.rsvp === "yes"
                ? { bg: "bg-[#F2E2C6]/60", border: "border-[#C39B70]/45", text: "text-[#8D294D]", Icon: Check }
                : g.rsvp === "pending"
                ? { bg: "bg-[#E6A6B7]/28", border: "border-[#E6A6B7]/45", text: "text-[#8D294D]", Icon: Clock }
                : { bg: "bg-[#B63A58]/12", border: "border-[#B63A58]/35", text: "text-[#B63A58]", Icon: X };
            const Icon = rsvpStyle.Icon;
            return (
              <motion.div
                key={g.name}
                className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 rounded-xl bg-white/55 px-3 py-2"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.0 + i * 0.13, duration: 0.4 }}
              >
                <span className="truncate text-sm font-semibold text-[#3B1C2B]">{g.name}</span>
                <span className="rounded-full bg-[#F2E2C6]/55 px-2 py-0.5 text-xs text-[#6F3E54]">{g.side}</span>
                <span className="w-5 text-center text-xs tabular-nums text-[#6F3E54]">x{g.count}</span>
                <div className="flex min-w-[110px] items-center gap-1 text-xs text-[#6F3E54]">
                  <UtensilsCrossed className="h-3 w-3 text-[#B16C8E]" />
                  <span className="truncate">{g.meal}</span>
                </div>
                <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${rsvpStyle.bg} ${rsvpStyle.border} ${rsvpStyle.text}`}>
                  <Icon className="h-3 w-3" />
                  {g.rsvp}
                </span>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      <motion.p className="mt-5 max-w-2xl text-center text-base text-[#6F3E54]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2, duration: 0.7 }}>
        Track invites, meals, and dietary needs, then send digital RSVPs in seconds.
      </motion.p>
    </motion.div>
  );
}
