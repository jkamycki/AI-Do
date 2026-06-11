import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Scene1 } from "./video_scenes/Scene1";
import { Scene2 } from "./video_scenes/Scene2";
import { Scene3 } from "./video_scenes/Scene3";
import { Scene4 } from "./video_scenes/Scene4";
import { Scene5 } from "./video_scenes/Scene5";
import { Scene6 } from "./video_scenes/Scene6";
import { Scene7 } from "./video_scenes/Scene7";
import { Scene8 } from "./video_scenes/Scene8";

const SCENE_COUNT = 8;
const SCENE_DURATIONS = [5500, 9000, 9500, 9300, 9300, 9200, 9600, 11000];

const PARTICLES = Array.from({ length: 30 }, (_, i) => ({
  id: i,
  x: `${6 + ((i * 19) % 88)}%`,
  y: `${8 + ((i * 29) % 84)}%`,
  size: (i % 3) + 2,
  delay: (i % 8) * 0.35,
  duration: 3.4 + (i % 5) * 0.3,
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

export default function VideoTemplate({ embedded = false }: { embedded?: boolean }) {
  const currentScene = useTimerPlayer();
  const rootClass = `relative ${embedded ? "h-full" : "h-screen"} w-full overflow-hidden bg-[#FFF7F2] text-[#3B1C2B]`;
  const sceneClass = embedded
    ? "absolute inset-0 origin-center scale-[0.56] sm:scale-[0.62] lg:scale-[0.68] xl:scale-[0.72]"
    : "absolute inset-0";

  return (
    <div className={rootClass} data-video-template={embedded ? "embedded" : "full"}>
      <div className="absolute inset-0 z-0">
        <motion.div
          className={`absolute inset-0 bg-[url('/images/bokeh-bg-optimized.jpg')] bg-cover bg-center ${embedded ? "opacity-20" : "opacity-35"}`}
          animate={{ scale: [1.02, 1.06, 1.02] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className={embedded ? "absolute inset-0 bg-[linear-gradient(180deg,rgba(255,247,242,0.68)_0%,rgba(255,247,242,0.5)_48%,rgba(242,226,198,0.32)_100%)]" : "absolute inset-0 bg-[linear-gradient(180deg,rgba(255,247,242,0.84)_0%,rgba(255,247,242,0.72)_48%,rgba(242,226,198,0.48)_100%)]"} />
        <div className={`absolute inset-x-0 top-0 h-[46%] bg-[url('/images/floral-bg-optimized.jpg')] bg-cover bg-center mix-blend-multiply ${embedded ? "opacity-[0.12]" : "opacity-20"}`} />
        <div className={embedded ? "absolute inset-0 bg-[radial-gradient(ellipse_80%_62%_at_50%_43%,rgba(255,255,255,0.5)_0%,rgba(255,247,242,0.2)_48%,rgba(230,166,183,0.1)_100%)]" : "absolute inset-0 bg-[radial-gradient(ellipse_80%_62%_at_50%_43%,rgba(255,255,255,0.74)_0%,rgba(255,247,242,0.32)_48%,rgba(230,166,183,0.18)_100%)]"} />
      </div>

      <div className="absolute inset-0 z-0 pointer-events-none">
        {PARTICLES.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-[#E6A6B7]"
            style={{ left: p.x, top: p.y, width: p.size, height: p.size }}
            animate={{ opacity: [0, 0.75, 0], y: [0, -16, 0], scale: [0.7, 1.15, 0.7] }}
            transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>

      <div className="relative z-10 h-full w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentScene}
            className={sceneClass}
            data-video-scene={currentScene + 1}
            initial={embedded ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0, y: 18, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={embedded ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0, y: -16, filter: "blur(8px)" }}
            transition={{ duration: embedded ? 0.12 : 0.82, ease: [0.16, 1, 0.3, 1] }}
          >
            {currentScene === 0 && <Scene1 />}
            {currentScene === 1 && <Scene2 />}
            {currentScene === 2 && <Scene3 />}
            {currentScene === 3 && <Scene4 />}
            {currentScene === 4 && <Scene6 />}
            {currentScene === 5 && <Scene7 />}
            {currentScene === 6 && <Scene8 />}
            {currentScene === 7 && <Scene5 />}
          </motion.div>
        </AnimatePresence>
      </div>

      {!embedded && <AnimatePresence>
        <motion.div
          key={`sweep-${currentScene}`}
          className="pointer-events-none absolute inset-0 z-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 1, times: [0, 0.45, 1], ease: "easeOut" }}
        >
          <motion.div
            className="absolute top-0 bottom-0 w-[58%]"
            style={{
              background:
                "linear-gradient(115deg, transparent 0%, rgba(242,226,198,0.1) 35%, rgba(230,166,183,0.22) 50%, rgba(177,108,142,0.12) 65%, transparent 100%)",
              filter: "blur(22px)",
              mixBlendMode: "multiply",
            }}
            initial={{ x: "-80%", skewX: -12 }}
            animate={{ x: "180%", skewX: -12 }}
            transition={{ duration: 1, ease: [0.65, 0, 0.35, 1] }}
          />
        </motion.div>
      </AnimatePresence>}
    </div>
  );
}
