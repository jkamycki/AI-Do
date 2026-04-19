import { motion, AnimatePresence } from "framer-motion";
import { useVideoPlayer } from "@/lib/video/hooks";
import { Scene1 } from "./video_scenes/Scene1";
import { Scene2 } from "./video_scenes/Scene2";
import { Scene3 } from "./video_scenes/Scene3";
import { Scene4 } from "./video_scenes/Scene4";
import { Scene5 } from "./video_scenes/Scene5";

const SCENE_DURATIONS = {
  hero: 4000,
  planning: 4500,
  dayToDay: 4500,
  bigDay: 4000,
  outro: 4000,
};

// Persistent petal/ring shapes
const persistentElements = [
  { size: "w-64 h-64", border: "border-primary/20", blur: "blur-3xl", bg: "bg-primary/10" },
  { size: "w-96 h-96", border: "border-white/10", blur: "blur-2xl", bg: "bg-white/5" },
];

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({ durations: SCENE_DURATIONS });

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#fdf6ee] text-[#3C2A32]">
      {/* Background Video Layer */}
      <div className="absolute inset-0 z-0">
        <video
          src={`${import.meta.env.BASE_URL}videos/hero-background.mp4`}
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-[#fdf6ee]/60 mix-blend-overlay"></div>
      </div>

      {/* Persistent Animated Shapes */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <motion.div
          className="absolute rounded-full border border-[#c9956b]/30 bg-[#7c3f5e]/5 blur-3xl w-[800px] h-[800px]"
          animate={{
            x: ["-20%", "40%", "-10%", "30%", "-20%"][currentScene],
            y: ["-10%", "-30%", "20%", "-10%", "-10%"][currentScene],
            scale: [1, 1.2, 0.8, 1.1, 1][currentScene],
          }}
          transition={{ duration: 3, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute rounded-full border border-[#7c3f5e]/20 blur-2xl w-[600px] h-[600px]"
          animate={{
            x: ["60%", "10%", "70%", "10%", "60%"][currentScene],
            y: ["40%", "60%", "10%", "50%", "40%"][currentScene],
            scale: [1.2, 0.9, 1.3, 0.9, 1.2][currentScene],
          }}
          transition={{ duration: 4, ease: "easeInOut" }}
        />
      </div>

      {/* Scene Content */}
      <div className="relative z-10 w-full h-full">
        <AnimatePresence mode="popLayout">
          {currentScene === 0 && <Scene1 key="scene1" />}
          {currentScene === 1 && <Scene2 key="scene2" />}
          {currentScene === 2 && <Scene3 key="scene3" />}
          {currentScene === 3 && <Scene4 key="scene4" />}
          {currentScene === 4 && <Scene5 key="scene5" />}
        </AnimatePresence>
      </div>
    </div>
  );
}