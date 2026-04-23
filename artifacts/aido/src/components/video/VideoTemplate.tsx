import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Scene1 } from "./video_scenes/Scene1";
import { Scene2 } from "./video_scenes/Scene2";
import { Scene3 } from "./video_scenes/Scene3";
import { Scene4 } from "./video_scenes/Scene4";
import { Scene5 } from "./video_scenes/Scene5";
import { Scene6 } from "./video_scenes/Scene6";
import { Scene7 } from "./video_scenes/Scene7";

const SCENE_COUNT = 7;
const SCENE_DURATIONS = [5500, 9000, 9500, 9300, 9300, 9200, 11000];

const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  x: `${Math.random() * 100}%`,
  y: `${Math.random() * 100}%`,
  size: Math.random() * 3 + 1,
  delay: Math.random() * 4,
  duration: Math.random() * 3 + 2,
}));

function useTimerPlayer() {
  const [currentScene, setCurrentScene] = useState(0);
  useEffect(() => {
    const t = setTimeout(
      () => setCurrentScene((s) => (s + 1) % SCENE_COUNT),
      SCENE_DURATIONS[currentScene] ?? 9000
    );
    return () => clearTimeout(t);
  }, [currentScene]);
  return currentScene;
}

export default function VideoTemplate() {
  const currentScene = useTimerPlayer();

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#07030d] text-white">

      {/* Deep space gradient background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_60%_-20%,rgba(180,80,200,0.18)_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_20%_100%,rgba(212,160,23,0.12)_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_80%,rgba(233,30,140,0.08)_0%,transparent_60%)]" />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {PARTICLES.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-amber-300/60"
            style={{ left: p.x, top: p.y, width: p.size, height: p.size }}
            animate={{ opacity: [0, 1, 0], y: [0, -18, 0] }}
            transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>

      {/* Animated slow orbs */}
      <motion.div
        className="absolute rounded-full blur-[100px] w-[700px] h-[700px] bg-purple-600/10 pointer-events-none"
        animate={{
          x: ["-20%", "30%", "-10%", "20%", "-20%"][currentScene] ?? "-20%",
          y: ["-10%", "-30%", "25%", "-5%", "-10%"][currentScene] ?? "-10%",
          scale: [1, 1.15, 0.9, 1.1, 1][currentScene] ?? 1,
        }}
        transition={{ duration: 3.5, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute rounded-full blur-[80px] w-[500px] h-[500px] bg-amber-400/8 pointer-events-none"
        animate={{
          x: ["70%", "20%", "75%", "15%", "70%"][currentScene] ?? "70%",
          y: ["50%", "65%", "15%", "60%", "50%"][currentScene] ?? "50%",
          scale: [1.1, 0.85, 1.25, 0.9, 1.1][currentScene] ?? 1.1,
        }}
        transition={{ duration: 4, ease: "easeInOut" }}
      />

      {/* Scene Content */}
      <div className="relative z-10 w-full h-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentScene}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.04, filter: "blur(14px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.97, filter: "blur(10px)" }}
            transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
          >
            {currentScene === 0 && <Scene1 />}
            {currentScene === 1 && <Scene2 />}
            {currentScene === 2 && <Scene3 />}
            {currentScene === 3 && <Scene4 />}
            {currentScene === 4 && <Scene6 />}
            {currentScene === 5 && <Scene7 />}
            {currentScene === 6 && <Scene5 />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Cinematic transition sweep — fires on every scene change */}
      <AnimatePresence>
        <motion.div
          key={`sweep-${currentScene}`}
          className="absolute inset-0 z-20 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 1.1, times: [0, 0.45, 1], ease: "easeOut" }}
        >
          {/* Diagonal shimmer bar */}
          <motion.div
            className="absolute top-0 bottom-0 w-[60%]"
            style={{
              background:
                "linear-gradient(115deg, transparent 0%, rgba(245,200,66,0.08) 35%, rgba(233,30,140,0.18) 50%, rgba(123,47,190,0.10) 65%, transparent 100%)",
              filter: "blur(24px)",
              mixBlendMode: "screen",
            }}
            initial={{ x: "-80%", skewX: -12 }}
            animate={{ x: "180%", skewX: -12 }}
            transition={{ duration: 1.1, ease: [0.65, 0, 0.35, 1] }}
          />
          {/* Soft vignette pulse */}
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.7, 0] }}
            transition={{ duration: 0.9, times: [0, 0.4, 1], ease: "easeOut" }}
          />
        </motion.div>
      </AnimatePresence>

    </div>
  );
}
