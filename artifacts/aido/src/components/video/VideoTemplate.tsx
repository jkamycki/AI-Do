import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Scene1 } from "./video_scenes/Scene1";
import { Scene2 } from "./video_scenes/Scene2";
import { Scene3 } from "./video_scenes/Scene3";
import { Scene4 } from "./video_scenes/Scene4";
import { Scene5 } from "./video_scenes/Scene5";
import { Scene6 } from "./video_scenes/Scene6";
import { Scene7 } from "./video_scenes/Scene7";
import { Volume2, VolumeX } from "lucide-react";

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

// Warm, cinematic ambient progression in C major.
// Each chord is held for CHORD_BEATS * BEAT_MS (= 8s by default) so one loop
// is roughly 64s — matches the total video length without obvious looping.
const BEAT_MS = 1000;
const CHORD_BEATS = 8;

// MIDI note numbers
const PROGRESSION: number[][] = [
  [60, 64, 67, 71, 74], // Cmaj9
  [57, 60, 64, 67, 71], // Am9
  [53, 57, 60, 64, 67], // Fmaj9
  [55, 59, 62, 65, 69], // G13
  [52, 55, 59, 62, 65], // Em11
  [57, 60, 64, 67, 71], // Am9
  [50, 53, 57, 60, 64], // Dm9
  [55, 59, 62, 65, 69], // G13 → resolves back to Cmaj9
];

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function useAmbientMusic(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (stopRef.current) {
        stopRef.current();
        stopRef.current = null;
      }
      return;
    }

    const AC: typeof AudioContext =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    ctxRef.current = ctx;

    // Master + gentle compressor + lowpass for warmth
    const master = ctx.createGain();
    master.gain.value = 0;
    master.gain.linearRampToValueAtTime(0.42, ctx.currentTime + 1.2);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 2400;
    lowpass.Q.value = 0.4;

    // Lush stereo delay for ambience
    const delayL = ctx.createDelay(1.5);
    const delayR = ctx.createDelay(1.5);
    delayL.delayTime.value = 0.43;
    delayR.delayTime.value = 0.61;
    const fbL = ctx.createGain();
    const fbR = ctx.createGain();
    fbL.gain.value = 0.32;
    fbR.gain.value = 0.32;
    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.35;
    const merger = ctx.createChannelMerger(2);

    delayL.connect(fbL).connect(delayR);
    delayR.connect(fbR).connect(delayL);
    delayL.connect(merger, 0, 0);
    delayR.connect(merger, 0, 1);
    merger.connect(wetGain).connect(master);

    lowpass.connect(master);
    lowpass.connect(delayL);
    master.connect(ctx.destination);
    masterRef.current = master;

    const sources: { stop: (t: number) => void }[] = [];

    // Schedule one chord at time `t` (seconds, AudioContext time).
    const playChord = (notes: number[], t: number, durationSec: number) => {
      const attack = 1.6;
      const release = 2.4;
      const sustain = Math.max(0.5, durationSec - attack - release);

      // Soft sub-bass: root one octave down on a sine
      const bassFreq = midiToFreq(notes[0] - 12);
      const bassOsc = ctx.createOscillator();
      bassOsc.type = "sine";
      bassOsc.frequency.value = bassFreq;
      const bassGain = ctx.createGain();
      bassGain.gain.setValueAtTime(0.0001, t);
      bassGain.gain.exponentialRampToValueAtTime(0.18, t + attack);
      bassGain.gain.setValueAtTime(0.18, t + attack + sustain);
      bassGain.gain.exponentialRampToValueAtTime(0.0001, t + attack + sustain + release);
      bassOsc.connect(bassGain).connect(lowpass);
      bassOsc.start(t);
      bassOsc.stop(t + attack + sustain + release + 0.1);
      sources.push({ stop: (s) => { try { bassOsc.stop(s); } catch {} } });

      // Pad voices: triangle + detuned sine pair per note for chorus
      notes.forEach((midi, i) => {
        const freq = midiToFreq(midi);
        const detunes = [0, 6, -6];
        const types: OscillatorType[] = ["triangle", "sine", "sine"];
        detunes.forEach((det, k) => {
          const osc = ctx.createOscillator();
          osc.type = types[k];
          osc.frequency.value = freq;
          osc.detune.value = det;

          const g = ctx.createGain();
          const peak = (k === 0 ? 0.07 : 0.045) / Math.max(1, notes.length / 4);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(peak, t + attack + i * 0.08);
          g.gain.setValueAtTime(peak, t + attack + sustain);
          g.gain.exponentialRampToValueAtTime(0.0001, t + attack + sustain + release);

          osc.connect(g).connect(lowpass);
          osc.start(t);
          osc.stop(t + attack + sustain + release + 0.1);
          sources.push({ stop: (s) => { try { osc.stop(s); } catch {} } });
        });
      });

      // Sparkle: top note an octave up, plucked-ish, very quiet
      const sparkleFreq = midiToFreq(notes[notes.length - 1] + 12);
      const spOsc = ctx.createOscillator();
      spOsc.type = "sine";
      spOsc.frequency.value = sparkleFreq;
      const spGain = ctx.createGain();
      const spStart = t + 0.6;
      spGain.gain.setValueAtTime(0.0001, spStart);
      spGain.gain.exponentialRampToValueAtTime(0.04, spStart + 0.05);
      spGain.gain.exponentialRampToValueAtTime(0.0001, spStart + 2.2);
      spOsc.connect(spGain).connect(lowpass);
      spOsc.start(spStart);
      spOsc.stop(spStart + 2.4);
      sources.push({ stop: (s) => { try { spOsc.stop(s); } catch {} } });
    };

    // Schedule the entire progression and loop indefinitely.
    const chordSec = (CHORD_BEATS * BEAT_MS) / 1000;
    let scheduled = 0;
    const scheduleAhead = () => {
      const ahead = ctx.currentTime + 4; // schedule ~4s ahead
      while (scheduled < ahead) {
        const idx = Math.round(scheduled / chordSec) % PROGRESSION.length;
        playChord(PROGRESSION[idx], ctx.currentTime + (scheduled - ctx.currentTime), chordSec);
        scheduled += chordSec;
      }
    };
    // Start a bit ahead of "now" so the first chord doesn't click in.
    scheduled = ctx.currentTime + 0.05;
    scheduleAhead();
    const interval = window.setInterval(scheduleAhead, 1000);

    stopRef.current = () => {
      clearInterval(interval);
      try {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
      } catch {}
      window.setTimeout(() => {
        sources.forEach((s) => s.stop(ctx.currentTime));
        try { ctx.close(); } catch {}
      }, 700);
    };

    return () => {
      if (stopRef.current) {
        stopRef.current();
        stopRef.current = null;
      }
    };
  }, [enabled]);
}

export default function VideoTemplate() {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const currentScene = useTimerPlayer();
  useAmbientMusic(audioEnabled);

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

      {/* Music toggle */}
      <button
        onClick={() => setAudioEnabled(v => !v)}
        className="absolute bottom-4 right-4 z-30 flex items-center gap-2 px-3 py-2 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md border border-white/10 transition-all text-white/90 text-xs font-medium"
        aria-label={audioEnabled ? "Mute music" : "Play music"}
      >
        {audioEnabled ? <Volume2 className="h-4 w-4 text-amber-300" /> : <VolumeX className="h-4 w-4" />}
        <span>{audioEnabled ? "Music on" : "Tap for music"}</span>
      </button>
    </div>
  );
}
