import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useVideoPlayer } from "@/lib/video/hooks";
import { Scene1 } from "./video_scenes/Scene1";
import { Scene2 } from "./video_scenes/Scene2";
import { Scene3 } from "./video_scenes/Scene3";
import { Scene4 } from "./video_scenes/Scene4";
import { Scene5 } from "./video_scenes/Scene5";
import { Volume2, VolumeX } from "lucide-react";

const SCENE_DURATIONS = {
  hero: 4500,
  planning: 5000,
  vendors: 5000,
  bigDay: 4500,
  outro: 5000,
};

const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  x: `${Math.random() * 100}%`,
  y: `${Math.random() * 100}%`,
  size: Math.random() * 3 + 1,
  delay: Math.random() * 4,
  duration: Math.random() * 3 + 2,
}));

// Narration uses real AI text-to-speech (warm, natural voice) served from
// /api/tts/narration/:scene. The server caches the MP3 per scene so playback
// is instant on subsequent loads.
const SCENE_COUNT = 5;

function useNarration(currentScene: number, enabled: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSceneRef = useRef<number>(-1);

  // Create / tear down the audio element when narration is toggled.
  useEffect(() => {
    if (!enabled) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
      lastSceneRef.current = -1;
      return;
    }
    const audio = new Audio();
    audio.preload = "auto";
    audio.volume = 0.95;
    audioRef.current = audio;

    // Pre-warm the cache by fetching all scenes in the background once
    // narration is enabled (browsers cache the response for instant playback).
    Array.from({ length: SCENE_COUNT }).forEach((_, i) => {
      fetch(`/api/tts/narration/${i}`).catch(() => {});
    });

    return () => {
      try {
        audio.pause();
        audio.src = "";
      } catch {}
      audioRef.current = null;
    };
  }, [enabled]);

  // Play the matching narration whenever the scene changes.
  useEffect(() => {
    if (!enabled) return;
    const audio = audioRef.current;
    if (!audio) return;
    if (lastSceneRef.current === currentScene) return;
    lastSceneRef.current = currentScene;

    audio.pause();
    audio.currentTime = 0;
    audio.src = `/api/tts/narration/${currentScene}`;
    audio.play().catch(() => {
      // Likely blocked by autoplay policy until first user interaction —
      // the wake-up listener will retry once the user clicks anywhere.
    });
  }, [currentScene, enabled]);
}

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({ durations: SCENE_DURATIONS });
  const [audioEnabled, setAudioEnabled] = useState(true);
  useNarration(currentScene, audioEnabled);

  // Browsers block speech until the user has interacted with the page.
  // The video lives in an iframe on the landing page, so we listen for the
  // very first interaction anywhere in this document and "wake up" the
  // speech engine so the narration starts on its own from then on.
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    let woken = false;
    const wake = () => {
      if (woken) return;
      woken = true;
      try {
        const u = new SpeechSynthesisUtterance(" ");
        u.volume = 0;
        window.speechSynthesis.speak(u);
      } catch {}
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
      window.removeEventListener("touchstart", wake);
    };
    window.addEventListener("pointerdown", wake, { once: true });
    window.addEventListener("keydown", wake, { once: true });
    window.addEventListener("touchstart", wake, { once: true });
    return () => {
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
      window.removeEventListener("touchstart", wake);
    };
  }, []);

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
          {currentScene === 4 && <Scene5 key="scene5" />}
        </AnimatePresence>
      </div>

      {/* Sound toggle — sits in the bottom-right of the video */}
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
