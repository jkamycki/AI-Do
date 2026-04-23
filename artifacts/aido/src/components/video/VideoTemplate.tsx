import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState, useCallback } from "react";
import { Scene1 } from "./video_scenes/Scene1";
import { Scene2 } from "./video_scenes/Scene2";
import { Scene3 } from "./video_scenes/Scene3";
import { Scene4 } from "./video_scenes/Scene4";
import { Scene5 } from "./video_scenes/Scene5";
import { Scene6 } from "./video_scenes/Scene6";
import { Scene7 } from "./video_scenes/Scene7";
import { Volume2, VolumeX } from "lucide-react";

const SCENE_COUNT = 7;

// Fallback durations used only when narration audio is muted or fails to load.
// When narration plays, scenes advance the instant the voice finishes.
const FALLBACK_DURATIONS = [5500, 9000, 9500, 9300, 9300, 9200, 11000];

// Tiny breath between voice lines (ms).
const POST_NARRATION_GAP = 350;

const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  x: `${Math.random() * 100}%`,
  y: `${Math.random() * 100}%`,
  size: Math.random() * 3 + 1,
  delay: Math.random() * 4,
  duration: Math.random() * 3 + 2,
}));

function useAudioDrivenPlayer(audioEnabled: boolean) {
  const [currentScene, setCurrentScene] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sceneRef = useRef(0);

  // Keep a ref of the current scene so callbacks always see the latest value
  // without needing to re-bind.
  useEffect(() => { sceneRef.current = currentScene; }, [currentScene]);

  const advance = useCallback(() => {
    setCurrentScene((s) => (s + 1) % SCENE_COUNT);
  }, []);

  const scheduleFallback = useCallback((scene: number) => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = setTimeout(() => {
      if (sceneRef.current === scene) advance();
    }, FALLBACK_DURATIONS[scene] ?? 9000);
  }, [advance]);

  // Build / tear down the audio element when narration is toggled.
  useEffect(() => {
    if (!audioEnabled) {
      if (audioRef.current) {
        try { audioRef.current.pause(); audioRef.current.src = ""; } catch {}
        audioRef.current = null;
      }
      return;
    }
    const audio = new Audio();
    audio.preload = "auto";
    audio.volume = 0.95;
    audioRef.current = audio;

    // Pre-warm cache for every scene so playback is instant.
    Array.from({ length: SCENE_COUNT }).forEach((_, i) => {
      fetch(`/api/tts/narration/${i}`).catch(() => {});
    });

    return () => {
      try { audio.pause(); audio.src = ""; } catch {}
      audioRef.current = null;
    };
  }, [audioEnabled]);

  // Whenever the scene changes, play matching narration and schedule the next
  // scene to fire as soon as the voice ends (with a tiny breath gap).
  useEffect(() => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);

    if (!audioEnabled || !audioRef.current) {
      // No audio — use fallback timer only.
      scheduleFallback(currentScene);
      return;
    }

    const audio = audioRef.current;
    audio.onended = null;

    const onEnded = () => {
      if (sceneRef.current !== currentScene) return;
      // Brief breath, then advance.
      setTimeout(() => {
        if (sceneRef.current === currentScene) advance();
      }, POST_NARRATION_GAP);
    };

    audio.onended = onEnded;
    audio.pause();
    audio.currentTime = 0;
    audio.src = `/api/tts/narration/${currentScene}`;

    // Fallback in case audio fails to play (e.g. autoplay blocked).
    scheduleFallback(currentScene);

    audio.play().catch(() => {
      // Autoplay blocked; the fallback timer will still advance the scene.
    });

    return () => {
      audio.onended = null;
    };
  }, [currentScene, audioEnabled, advance, scheduleFallback]);

  // Cleanup any pending timers on unmount.
  useEffect(() => () => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
  }, []);

  return { currentScene };
}

export default function VideoTemplate() {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const { currentScene } = useAudioDrivenPlayer(audioEnabled);

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
        <AnimatePresence mode="popLayout">
          {currentScene === 0 && <Scene1 key="scene1" />}
          {currentScene === 1 && <Scene2 key="scene2" />}
          {currentScene === 2 && <Scene3 key="scene3" />}
          {currentScene === 3 && <Scene4 key="scene4" />}
          {currentScene === 4 && <Scene6 key="scene6" />}
          {currentScene === 5 && <Scene7 key="scene7" />}
          {currentScene === 6 && <Scene5 key="scene5" />}
        </AnimatePresence>
      </div>

      {/* Sound toggle */}
      <button
        onClick={() => setAudioEnabled(v => !v)}
        className="absolute bottom-4 right-4 z-30 flex items-center gap-2 px-3 py-2 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md border border-white/10 transition-all text-white/90 text-xs font-medium"
        aria-label={audioEnabled ? "Mute soundtrack" : "Play soundtrack"}
      >
        {audioEnabled ? <Volume2 className="h-4 w-4 text-amber-300" /> : <VolumeX className="h-4 w-4" />}
        <span>{audioEnabled ? "Sound on" : "Tap for sound"}</span>
      </button>
    </div>
  );
}
