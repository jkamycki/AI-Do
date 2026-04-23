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

// ────────────────────────────────────────────────────────────────────────────
// Catchy in-browser instrumental: piano + bass + soft beat over Am–F–C–G.
// 110 BPM, 16-bar loop (~35s) repeats seamlessly under the video.
// ────────────────────────────────────────────────────────────────────────────
const BPM = 110;
const BEAT_SEC = 60 / BPM;          // 0.545s
const STEP_SEC = BEAT_SEC / 4;      // 16th note = 0.136s
const BAR_STEPS = 16;
const LOOP_BARS = 16;

// One chord per bar, 4-bar progression repeats 4× across the loop.
const CHORDS: { root: number; voicing: number[] }[] = [
  { root: 45, voicing: [57, 60, 64, 67] }, // Am  (A2 bass, A3 C4 E4 G4)
  { root: 41, voicing: [53, 57, 60, 64] }, // F
  { root: 36, voicing: [52, 55, 60, 64] }, // C   (C2 bass, E3 G3 C4 E4)
  { root: 43, voicing: [55, 59, 62, 65] }, // G7
];

// 4-bar melody hook in 16th-note grid. [stepInBar, midi, durationSteps, vel]
type MelStep = [number, number, number, number];
const HOOK: MelStep[][] = [
  // Bar 1 — Am
  [
    [0, 72, 2, 0.55], [2, 76, 2, 0.55], [4, 79, 3, 0.7],
    [8, 77, 2, 0.5], [10, 76, 2, 0.55], [12, 72, 4, 0.55],
  ],
  // Bar 2 — F
  [
    [0, 72, 2, 0.55], [2, 77, 2, 0.6], [4, 81, 4, 0.7],
    [10, 79, 2, 0.55], [12, 77, 4, 0.55],
  ],
  // Bar 3 — C
  [
    [0, 79, 2, 0.6], [2, 76, 2, 0.55], [4, 72, 3, 0.55],
    [8, 76, 2, 0.55], [10, 79, 2, 0.6], [12, 84, 4, 0.75],
  ],
  // Bar 4 — G (descending resolve)
  [
    [0, 81, 2, 0.6], [2, 79, 2, 0.55], [4, 77, 2, 0.5],
    [6, 76, 2, 0.5], [8, 74, 2, 0.5], [10, 72, 6, 0.55],
  ],
];

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function useCatchyMusic(enabled: boolean) {
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (stopRef.current) { stopRef.current(); stopRef.current = null; }
      return;
    }

    const AC: typeof AudioContext =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();

    // ── Master chain ──────────────────────────────────────────────
    const master = ctx.createGain();
    master.gain.value = 0;
    master.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 0.6);

    const masterLP = ctx.createBiquadFilter();
    masterLP.type = "lowpass";
    masterLP.frequency.value = 7000;
    masterLP.Q.value = 0.3;
    masterLP.connect(master);
    master.connect(ctx.destination);

    // Stereo delay send for sparkle
    const delaySend = ctx.createGain();
    delaySend.gain.value = 0.18;
    const delayL = ctx.createDelay(1);
    const delayR = ctx.createDelay(1);
    delayL.delayTime.value = BEAT_SEC * 0.75;
    delayR.delayTime.value = BEAT_SEC * 1.5;
    const fb = ctx.createGain();
    fb.gain.value = 0.25;
    const merger = ctx.createChannelMerger(2);
    delaySend.connect(delayL); delaySend.connect(delayR);
    delayL.connect(fb); fb.connect(delayR); delayR.connect(delayL);
    delayL.connect(merger, 0, 0); delayR.connect(merger, 0, 1);
    merger.connect(masterLP);

    // ── Voices ────────────────────────────────────────────────────
    // Piano-ish pluck (triangle + sine, fast attack, exp decay)
    const playPiano = (midi: number, t: number, durSec: number, vel: number, sendDelay = false) => {
      const f = midiToFreq(midi);
      const g = ctx.createGain();
      const peak = 0.16 * vel;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
      g.gain.exponentialRampToValueAtTime(peak * 0.45, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.15, durSec));
      const o1 = ctx.createOscillator(); o1.type = "triangle"; o1.frequency.value = f;
      const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = f * 2;
      const o2g = ctx.createGain(); o2g.gain.value = 0.25;
      o1.connect(g); o2.connect(o2g).connect(g);
      g.connect(masterLP);
      if (sendDelay) g.connect(delaySend);
      const end = t + durSec + 0.05;
      o1.start(t); o2.start(t); o1.stop(end); o2.stop(end);
    };

    // Soft round bass (sine + saturated harmonic)
    const playBass = (midi: number, t: number, durSec: number, vel = 0.7) => {
      const f = midiToFreq(midi);
      const g = ctx.createGain();
      const peak = 0.32 * vel;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.015);
      g.gain.exponentialRampToValueAtTime(peak * 0.6, t + durSec * 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + durSec);
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
      const o2 = ctx.createOscillator(); o2.type = "triangle"; o2.frequency.value = f;
      const o2g = ctx.createGain(); o2g.gain.value = 0.18;
      o.connect(g); o2.connect(o2g).connect(g);
      g.connect(masterLP);
      o.start(t); o2.start(t); o.stop(t + durSec + 0.05); o2.stop(t + durSec + 0.05);
    };

    // Sustained chord pad (very quiet bed)
    const playPad = (notes: number[], t: number, durSec: number) => {
      notes.forEach((midi) => {
        const f = midiToFreq(midi);
        const g = ctx.createGain();
        const peak = 0.025;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(peak, t + 0.4);
        g.gain.setValueAtTime(peak, t + durSec - 0.3);
        g.gain.exponentialRampToValueAtTime(0.0001, t + durSec);
        const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = f;
        o.detune.value = (Math.random() - 0.5) * 8;
        o.connect(g).connect(masterLP);
        o.start(t); o.stop(t + durSec + 0.05);
      });
    };

    // Soft kick (low sine thump)
    const playKick = (t: number, vel = 0.7) => {
      const o = ctx.createOscillator(); o.type = "sine";
      const g = ctx.createGain();
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.55 * vel, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g).connect(masterLP);
      o.start(t); o.stop(t + 0.25);
    };

    // Hi-hat / shaker (filtered noise burst)
    const noiseBuffer = (() => {
      const b = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return b;
    })();
    const playHat = (t: number, vel = 0.4, length = 0.05) => {
      const src = ctx.createBufferSource(); src.buffer = noiseBuffer;
      const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 7000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.07 * vel, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + length);
      src.connect(hp).connect(g).connect(masterLP);
      src.start(t); src.stop(t + length + 0.02);
    };

    // ── Schedule one full 16-bar loop starting at time `t0` ────────
    const scheduleLoop = (t0: number) => {
      const barSec = BAR_STEPS * STEP_SEC;
      for (let bar = 0; bar < LOOP_BARS; bar++) {
        const chord = CHORDS[bar % 4];
        const barStart = t0 + bar * barSec;

        // Pad bed (whole bar)
        playPad(chord.voicing, barStart, barSec);

        // Bass: root on beat 1, 5th on beat 3 (root +7), root again on offbeat 4
        playBass(chord.root, barStart + 0 * BEAT_SEC, BEAT_SEC * 1.8, 0.75);
        playBass(chord.root + 7, barStart + 2 * BEAT_SEC, BEAT_SEC * 1.5, 0.6);
        playBass(chord.root, barStart + 3.5 * BEAT_SEC, BEAT_SEC * 0.5, 0.5);

        // Drums: kick on 1 & 3, hat on every offbeat 8th
        playKick(barStart + 0 * BEAT_SEC, 0.8);
        playKick(barStart + 2 * BEAT_SEC, 0.7);
        for (let i = 0; i < 8; i++) {
          const t = barStart + i * BEAT_SEC * 0.5;
          playHat(t, i % 2 === 0 ? 0.35 : 0.55);
        }

        // Piano chord stab on beats 2 & 4 (off-beat groove)
        [1, 3].forEach((beat) => {
          chord.voicing.forEach((n) => {
            playPiano(n, barStart + beat * BEAT_SEC, 0.35, 0.4);
          });
        });

        // Melody — main hook on bars 0-3, 8-11; variation (octave down) on 4-7, 12-15
        const hookBar = bar % 4;
        const transposeOctave = (bar >= 4 && bar < 8) || (bar >= 12) ? -12 : 0;
        const velScale = transposeOctave ? 0.7 : 1;
        HOOK[hookBar].forEach(([step, midi, durSteps, vel]) => {
          const t = barStart + step * STEP_SEC;
          playPiano(midi + transposeOctave, t, durSteps * STEP_SEC, vel * velScale, true);
        });
      }
    };

    // Start scheduling slightly ahead, then re-schedule each loop cycle
    const loopSec = LOOP_BARS * BAR_STEPS * STEP_SEC;
    let nextLoopAt = ctx.currentTime + 0.1;
    scheduleLoop(nextLoopAt);
    nextLoopAt += loopSec;
    const interval = window.setInterval(() => {
      // Stay 2 loops ahead of currentTime so we never run dry
      while (nextLoopAt < ctx.currentTime + loopSec) {
        scheduleLoop(nextLoopAt);
        nextLoopAt += loopSec;
      }
    }, 2000);

    stopRef.current = () => {
      clearInterval(interval);
      try {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
      } catch {}
      window.setTimeout(() => { try { ctx.close(); } catch {} }, 600);
    };

    return () => {
      if (stopRef.current) { stopRef.current(); stopRef.current = null; }
    };
  }, [enabled]);
}

export default function VideoTemplate() {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const currentScene = useTimerPlayer();
  useCatchyMusic(audioEnabled);

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
