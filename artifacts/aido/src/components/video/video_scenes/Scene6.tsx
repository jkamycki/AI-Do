import { motion } from "framer-motion";
import { Users, Check, X, Clock, UtensilsCrossed } from "lucide-react";

const GUESTS = [
  { name: "Emma & James Carter", side: "Bride", count: 2, rsvp: "yes", meal: "Vegetarian" },
  { name: "David Chen +1", side: "Groom", count: 2, rsvp: "yes", meal: "Standard" },
  { name: "Priya & Arjun Patel", side: "Bride", count: 2, rsvp: "pending", meal: "—" },
  { name: "The Rodriguez Family", side: "Groom", count: 4, rsvp: "yes", meal: "2 kids meals" },
  { name: "Olivia Bennett", side: "Bride", count: 1, rsvp: "no", meal: "—" },
  { name: "Marcus & Lily Wong", side: "Groom", count: 2, rsvp: "yes", meal: "Gluten-free" },
];

const STATS = [
  { label: "Invited", value: 142, color: "#fff" },
  { label: "Confirmed", value: 98, color: "#22C55E" },
  { label: "Pending", value: 31, color: "#F5C842" },
  { label: "Declined", value: 13, color: "#EF4444" },
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
      <motion.div
        className="text-center mb-5"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1 }}
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-400/10 border border-blue-400/30 mb-3">
          <Users className="h-4 w-4 text-blue-300" />
          <span className="text-xs uppercase tracking-[0.25em] text-blue-200">Guest List</span>
        </div>
        <h2 className="text-[3vw] font-serif font-bold leading-tight"
          style={{ background: "linear-gradient(135deg, #fff 0%, #A0CBF0 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
        >
          Every RSVP, meal, and +1 — handled
        </h2>
      </motion.div>

      <motion.div
        className="w-full max-w-4xl rounded-3xl p-6 backdrop-blur-xl"
        style={{
          background: "linear-gradient(145deg, rgba(40,18,72,0.9) 0%, rgba(20,8,40,0.9) 100%)",
          border: "1.5px solid rgba(79,142,247,0.4)",
          boxShadow: "0 20px 60px -10px rgba(79,142,247,0.3)",
        }}
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 pb-4 mb-4 border-b border-white/10">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="text-center"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + i * 0.1, duration: 0.5 }}
            >
              <div className="text-2xl font-bold tabular-nums" style={{ color: stat.color }}>
                {stat.value}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-white/50 mt-0.5">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Guest rows */}
        <div className="space-y-1.5">
          {GUESTS.map((g, i) => {
            const rsvpStyle =
              g.rsvp === "yes"
                ? { bg: "bg-emerald-400/10", border: "border-emerald-400/30", text: "text-emerald-300", Icon: Check }
                : g.rsvp === "pending"
                ? { bg: "bg-amber-400/10", border: "border-amber-400/30", text: "text-amber-300", Icon: Clock }
                : { bg: "bg-red-400/10", border: "border-red-400/30", text: "text-red-300", Icon: X };
            const Icon = rsvpStyle.Icon;
            return (
              <motion.div
                key={g.name}
                className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06]"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.0 + i * 0.13, duration: 0.4 }}
              >
                <span className="text-sm text-white/90 font-medium truncate">{g.name}</span>
                <span className="text-xs text-white/45 px-2 py-0.5 rounded-full bg-white/5">{g.side}</span>
                <span className="text-xs text-white/60 tabular-nums w-5 text-center">×{g.count}</span>
                <div className="flex items-center gap-1 text-xs text-white/55 min-w-[110px]">
                  <UtensilsCrossed className="h-3 w-3 text-white/35" />
                  <span className="truncate">{g.meal}</span>
                </div>
                <span className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${rsvpStyle.bg} ${rsvpStyle.border} ${rsvpStyle.text} font-medium uppercase tracking-wider`}>
                  <Icon className="h-3 w-3" />
                  {g.rsvp}
                </span>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      <motion.p
        className="mt-5 text-white/65 text-base text-center max-w-2xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.2, duration: 0.7 }}
      >
        Track invites, meals, and dietary needs — and send digital RSVPs in seconds.
      </motion.p>
    </motion.div>
  );
}
