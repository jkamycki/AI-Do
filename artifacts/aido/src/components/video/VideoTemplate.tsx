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

// Soft chord progression (one chord per scene) — gentle, romantic, ambient pad.
// Frequencies in Hz. Each chord = root + third + fifth + soft octave color tone.
const SCENE_CHORDS: number[][] = [
  [130.81, 164.81, 196.00, 261.63], // Scene 1 — C major (warm welcome)
  [110.00, 130.81, 164.81, 220.00], // Scene 2 — A minor (planning, contemplative)
  [174.61, 220.00, 261.63, 349.23], // Scene 3 — F major (uplift, features)
  [146.83, 196.00, 246.94, 293.66], // Scene 4 — G major (Aria — bright)
  [130.81, 164.81, 196.00, 392.00], // Scene 5 — C major (resolution, with high color)
];

function useAmbientSoundtrack(currentScene: number, enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const voicesRef = useRef<{ osc: OscillatorNode; gain: GainNode }[]>([]);

  // Initialize / teardown the audio graph when toggled.
  useEffect(() => {
    if (!enabled) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    // Fade in master volume to a gentle level
    master.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 1.5);

    // Start 4 sine voices (one per chord tone) + 1 soft sub for warmth.
    const voices = Array.from({ length: 4 }).map(() => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      const gain = ctx.createGain();
      gain.gain.value = 0.22;
      osc.connect(gain).connect(master);
      osc.start();
      return { osc, gain };
    });

    // Add a slow, breathing tremolo on master for organic motion
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.18;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.04;
    lfo.connect(lfoGain).connect(master.gain);
    lfo.start();

    ctxRef.current = ctx;
    masterGainRef.current = master;
    voicesRef.current = voices;

    return () => {
      try {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
        setTimeout(() => {
          voices.forEach(v => { try { v.osc.stop(); } catch {} });
          try { lfo.stop(); } catch {}
          try { ctx.close(); } catch {}
        }, 700);
      } catch {}
      ctxRef.current = null;
      masterGainRef.current = null;
      voicesRef.current = [];
    };
  }, [enabled]);

  // Smoothly transition voice frequencies whenever the scene changes.
  useEffect(() => {
    const ctx = ctxRef.current;
    const voices = voicesRef.current;
    if (!ctx || voices.length === 0) return;
    const chord = SCENE_CHORDS[currentScene] ?? SCENE_CHORDS[0];
    const now = ctx.currentTime;
    voices.forEach((v, i) => {
      const target = chord[i] ?? chord[chord.length - 1];
      v.osc.frequency.cancelScheduledValues(now);
      v.osc.frequency.setValueAtTime(v.osc.frequency.value, now);
      v.osc.frequency.exponentialRampToValueAtTime(target, now + 1.8);
    });
  }, [currentScene]);
}

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({ durations: SCENE_DURATIONS });
  const [audioEnabled, setAudioEnabled] = useState(false);
  useAmbientSoundtrack(currentScene, audioEnabled);

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
