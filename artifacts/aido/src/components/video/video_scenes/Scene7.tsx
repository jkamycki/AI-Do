import { motion } from "framer-motion";
import { Armchair, Sparkles, Wand2 } from "lucide-react";

type Seat = { id: string; name: string; tag?: string };
type Table = { id: string; label: string; cx: number; cy: number; r: number; seats: Seat[] };

const TABLES: Table[] = [
  {
    id: "head",
    label: "Head Table",
    cx: 50,
    cy: 24,
    r: 7,
    seats: [
      { id: "h1", name: "Sarah", tag: "Bride" },
      { id: "h2", name: "Michael", tag: "Groom" },
      { id: "h3", name: "Emma", tag: "MOH" },
      { id: "h4", name: "James", tag: "Best Man" },
    ],
  },
  {
    id: "t1",
    label: "Table 1 · Family",
    cx: 20,
    cy: 62,
    r: 6.5,
    seats: [
      { id: "t1-1", name: "Mom" },
      { id: "t1-2", name: "Dad" },
      { id: "t1-3", name: "Aunt Lily" },
      { id: "t1-4", name: "Uncle Joe" },
      { id: "t1-5", name: "Cousin Mia" },
      { id: "t1-6", name: "Cousin Leo" },
    ],
  },
  {
    id: "t2",
    label: "Table 2 · College",
    cx: 50,
    cy: 62,
    r: 6.5,
    seats: [
      { id: "t2-1", name: "David" },
      { id: "t2-2", name: "Priya" },
      { id: "t2-3", name: "Arjun" },
      { id: "t2-4", name: "Olivia" },
      { id: "t2-5", name: "Lily" },
      { id: "t2-6", name: "Marcus" },
    ],
  },
  {
    id: "t3",
    label: "Table 3 · Work",
    cx: 80,
    cy: 62,
    r: 6.5,
    seats: [
      { id: "t3-1", name: "Anna" },
      { id: "t3-2", name: "Ben" },
      { id: "t3-3", name: "Chloe" },
      { id: "t3-4", name: "Daniel" },
      { id: "t3-5", name: "Eve" },
      { id: "t3-6", name: "Felix" },
    ],
  },
];

function TableNode({ table, baseDelay }: { table: Table; baseDelay: number }) {
  return (
    <motion.div
      className="absolute"
      style={{
        left: `${table.cx}%`,
        top: `${table.cy}%`,
        transform: "translate(-50%, -50%)",
      }}
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: baseDelay, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Table circle */}
      <div
        className="rounded-full flex items-center justify-center relative"
        style={{
          width: `${table.r * 2}vw`,
          height: `${table.r * 2}vw`,
          background: "radial-gradient(circle at 35% 30%, rgba(245,200,66,0.25) 0%, rgba(123,47,190,0.18) 70%)",
          border: "1.5px solid rgba(245,200,66,0.45)",
          boxShadow: "0 0 30px rgba(212,160,23,0.25), inset 0 0 20px rgba(0,0,0,0.4)",
        }}
      >
        <div className="text-center pointer-events-none">
          <div className="text-[0.85vw] font-semibold text-amber-200/90">{table.label.split(" · ")[0]}</div>
          {table.label.includes("·") && (
            <div className="text-[0.65vw] text-white/50 mt-0.5">{table.label.split(" · ")[1]}</div>
          )}
        </div>

        {/* Seats around the circle */}
        {table.seats.map((seat, i) => {
          const angle = (i / table.seats.length) * Math.PI * 2 - Math.PI / 2;
          const seatR = table.r * 1.18;
          const sx = Math.cos(angle) * seatR;
          const sy = Math.sin(angle) * seatR;
          return (
            <motion.div
              key={seat.id}
              className="absolute flex items-center justify-center"
              style={{
                left: "50%",
                top: "50%",
                width: "2vw",
                height: "2vw",
                transform: `translate(calc(-50% + ${sx}vw), calc(-50% + ${sy}vw))`,
              }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: baseDelay + 0.4 + i * 0.06, duration: 0.4 }}
            >
              <div
                className="w-full h-full rounded-full flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, #E91E8C 0%, #7B2FBE 100%)",
                  boxShadow: "0 0 8px rgba(233,30,140,0.5)",
                }}
              >
                <span className="text-[0.55vw] font-semibold text-white px-1 leading-none text-center">
                  {seat.name}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

export function Scene7() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center px-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.96, filter: "blur(10px)" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        className="text-center mb-3"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1 }}
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 mb-3">
          <Wand2 className="h-4 w-4 text-amber-300" />
          <span className="text-xs uppercase tracking-[0.25em] text-amber-200">AI Seating Chart</span>
        </div>
        <h2 className="text-[3vw] font-serif font-bold leading-tight"
          style={{ background: "linear-gradient(135deg, #fff 0%, #F5C842 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
        >
          Drag, drop — or let Aria seat them for you
        </h2>
      </motion.div>

      {/* Seating board */}
      <motion.div
        className="relative w-full max-w-5xl rounded-3xl backdrop-blur-xl overflow-hidden"
        style={{
          aspectRatio: "16 / 8",
          background: "linear-gradient(145deg, rgba(40,18,72,0.85) 0%, rgba(20,8,40,0.85) 100%)",
          border: "1.5px solid",
          borderImage: "linear-gradient(135deg, #B8860B 0%, #D4A017 50%, #F5C842 100%) 1",
          boxShadow: "0 20px 60px -10px rgba(212,160,23,0.3)",
        }}
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Floor grid */}
        <div className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "linear-gradient(rgba(245,200,66,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(245,200,66,0.15) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* "Dance Floor" label center-bottom */}
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[0.7vw] uppercase tracking-widest text-amber-200/80 border border-amber-400/30 bg-amber-400/5"
          style={{ bottom: "6%" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
        >
          Dance Floor
        </motion.div>

        {/* Aria suggestion badge */}
        <motion.div
          className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.75vw] font-medium text-white"
          style={{ background: "linear-gradient(135deg, #E91E8C 0%, #7B2FBE 100%)", boxShadow: "0 8px 20px rgba(233,30,140,0.4)" }}
          initial={{ opacity: 0, scale: 0.8, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 3.8, duration: 0.5 }}
        >
          <Sparkles className="h-3 w-3" />
          Aria optimized 24 seats
        </motion.div>

        {/* Tables */}
        {TABLES.map((t, i) => (
          <TableNode key={t.id} table={t} baseDelay={0.6 + i * 0.35} />
        ))}
      </motion.div>

      <motion.p
        className="mt-4 text-white/65 text-sm text-center max-w-2xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 4.2, duration: 0.7 }}
      >
        Visual table layouts that respect families, friends, and that one feud.
      </motion.p>
    </motion.div>
  );
}
