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
// Cinematic in-browser instrumental for the A.IDO promo.
// Style: warm felt-piano arpeggios + lush pad + soft sub-bass + a slow
// emotive melody that enters on the second 8-bar phrase. No drums.
// 76 BPM, I–V–vi–IV in C major (C – G – Am – F), the classic emotional arc.
// One full 16-bar loop is ~50s and repeats seamlessly under the video.
// ────────────────────────────────────────────────────────────────────────────
const BPM = 76;
const BEAT_SEC = 60 / BPM;          // ~0.789s
const BAR_SEC = BEAT_SEC * 4;       // ~3.16s
const LOOP_BARS = 16;

// One chord per bar; 4-bar cell repeats 4× across the loop.
const CHORDS: { bass: number; voicing: number[] }[] = [
  { bass: 36, voicing: [60, 64, 67, 72] }, // C   (C2 / C4 E4 G4 C5)
  { bass: 43, voicing: [59, 62, 67, 71] }, // G   (G2 / B3 D4 G4 B4)
  { bass: 33, voicing: [57, 60, 64, 69] }, // Am  (A1 / A3 C4 E4 A4)
  { bass: 41, voicing: [57, 60, 65, 69] }, // F   (F2 / A3 C4 F4 A4)
];

// 16-bar melody — only enters on bars 8–15 (second half) so the first half
// breathes. Each entry = [barIndex, beatInBar, midi, durationBeats, velocity].
type MelNote = [number, number, number, number, number];
const MELODY: MelNote[] = [
  // Phrase A — bars 8-11, climbing question
  [ 8, 0, 72, 1.5, 0.55],   // C5
  [ 8, 1.5, 76, 1.0, 0.6],  // E5
  [ 8, 2.5, 79, 1.5, 0.7],  // G5 (peak entry)
  [ 9, 0, 79, 0.75, 0.5],   // G5 hold
  [ 9, 1, 76, 1.0, 0.55],   // E5
  [ 9, 2, 74, 2.0, 0.55],   // D5 long
  [10, 0, 72, 1.5, 0.6],    // C5
  [10, 1.5, 76, 1.0, 0.55], // E5
  [10, 2.5, 81, 1.5, 0.7],  // A5 (lift)
  [11, 0, 79, 1.0, 0.55],   // G5
  [11, 1, 77, 1.0, 0.5],    // F5
  [11, 2, 74, 2.0, 0.55],   // D5 long resolve

  // Phrase B — bars 12-15, descending answer
  [12, 0, 84, 1.0, 0.7],    // C6 (high arrival)
  [12, 1, 81, 1.0, 0.6],    // A5
  [12, 2, 79, 2.0, 0.55],   // G5
  [13, 0, 77, 1.5, 0.5],    // F5
  [13, 1.5, 76, 2.5, 0.5],  // E5
  [14, 0, 74, 1.0, 0.5],    // D5
  [14, 1, 72, 1.0, 0.55],   // C5
  [14, 2, 76, 2.0, 0.55],   // E5
  [15, 0, 72, 4.0, 0.6],    // C5 final whole note
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
    master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 1.2);

    const warmth = ctx.createBiquadFilter();
    warmth.type = "lowpass";
    warmth.frequency.value = 5500;
    warmth.Q.value = 0.4;
    warmth.connect(master);
    master.connect(ctx.destination);

    // Lush stereo reverb-ish: two cross-fed delays
    const reverbSend = ctx.createGain();
    reverbSend.gain.value = 0.35;
    const dL = ctx.createDelay(2.5); dL.delayTime.value = 0.27;
    const dR = ctx.createDelay(2.5); dR.delayTime.value = 0.41;
    const fbL = ctx.createGain(); fbL.gain.value = 0.5;
    const fbR = ctx.createGain(); fbR.gain.value = 0.5;
    const verbLP = ctx.createBiquadFilter();
    verbLP.type = "lowpass"; verbLP.frequency.value = 3500;
    const merger = ctx.createChannelMerger(2);
    reverbSend.connect(dL); reverbSend.connect(dR);
    dL.connect(fbL).connect(dR);
    dR.connect(fbR).connect(dL);
    dL.connect(merger, 0, 0); dR.connect(merger, 0, 1);
    merger.connect(verbLP).connect(warmth);

    // ── Voices ────────────────────────────────────────────────────

    // Felt-piano voice: additive harmonics with quick attack & soft exp decay,
    // plus a tiny inharmonic shimmer for warmth. Sounds far less "synthy"
    // than triangle/square waves.
    const playPiano = (midi: number, t: number, durSec: number, vel: number) => {
      const f = midiToFreq(midi);
      const out = ctx.createGain();
      const peak = 0.18 * vel;
      // Piano-style envelope: instant attack, two-stage exp decay
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(peak, t + 0.006);
      out.gain.exponentialRampToValueAtTime(peak * 0.55, t + 0.18);
      out.gain.exponentialRampToValueAtTime(peak * 0.18, t + Math.min(durSec, 1.2));
      out.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(durSec, 0.4) + 0.4);

      // Per-note lowpass that closes as the note decays (mimics felt damping)
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(4500, t);
      lp.frequency.exponentialRampToValueAtTime(900, t + Math.max(durSec, 0.4) + 0.4);
      lp.Q.value = 0.3;
      out.connect(lp).connect(warmth);
      out.connect(reverbSend);

      // Harmonic stack (additive synthesis)
      const partials: [number, number, OscillatorType][] = [
        [1.0, 1.0, "sine"],
        [2.0, 0.42, "sine"],
        [3.0, 0.22, "sine"],
        [4.0, 0.12, "sine"],
        [2.01, 0.08, "sine"], // slight inharmonic shimmer
      ];
      const end = t + Math.max(durSec, 0.4) + 0.5;
      partials.forEach(([ratio, amp, type]) => {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f * ratio;
        const g = ctx.createGain();
        g.gain.value = amp;
        o.connect(g).connect(out);
        o.start(t);
        o.stop(end);
      });
    };

    // Sub-bass: clean sine an octave low-ish, slow swell in/out per bar
    const playBass = (midi: number, t: number, durSec: number, vel = 0.6) => {
      const f = midiToFreq(midi);
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
      const o2 = ctx.createOscillator(); o2.type = "triangle"; o2.frequency.value = f;
      const o2g = ctx.createGain(); o2g.gain.value = 0.12;
      const g = ctx.createGain();
      const peak = 0.28 * vel;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.5);
      g.gain.setValueAtTime(peak, t + durSec - 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + durSec);
      o.connect(g); o2.connect(o2g).connect(g);
      g.connect(warmth);
      o.start(t); o2.start(t);
      o.stop(t + durSec + 0.1); o2.stop(t + durSec + 0.1);
    };

    // String-style pad: detuned triangles with slow swell
    const playPad = (notes: number[], t: number, durSec: number) => {
      notes.forEach((midi, i) => {
        const f = midiToFreq(midi);
        [-7, 0, 7].forEach((det) => {
          const o = ctx.createOscillator();
          o.type = "triangle"; o.frequency.value = f; o.detune.value = det;
          const g = ctx.createGain();
          const peak = 0.022;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(peak, t + 0.7 + i * 0.05);
          g.gain.setValueAtTime(peak, t + durSec - 0.5);
          g.gain.exponentialRampToValueAtTime(0.0001, t + durSec);
          o.connect(g).connect(warmth);
          o.start(t); o.stop(t + durSec + 0.05);
        });
      });
    };

    // ── Schedule one full 16-bar loop starting at time `t0` ────────
    const scheduleLoop = (t0: number) => {
      for (let bar = 0; bar < LOOP_BARS; bar++) {
        const chord = CHORDS[bar % 4];
        const barStart = t0 + bar * BAR_SEC;

        // Pad bed for the whole bar (slightly overlapping into next)
        playPad(chord.voicing, barStart, BAR_SEC + 0.5);

        // Sustained sub-bass note
        playBass(chord.bass, barStart, BAR_SEC, 0.65);

        // Piano arpeggio: 8 eighth-notes ascending then descending across
        // the chord's voicing. Velocity dips at the apex for a "breath".
        const arp = [
          chord.voicing[0],
          chord.voicing[1],
          chord.voicing[2],
          chord.voicing[3],
          chord.voicing[2] + 12,
          chord.voicing[3],
          chord.voicing[2],
          chord.voicing[1],
        ];
        arp.forEach((midi, i) => {
          const t = barStart + i * (BEAT_SEC / 2);
          // Slight humanization: tiny timing & velocity wiggle
          const jitter = (Math.random() - 0.5) * 0.012;
          const vel = 0.32 + (i === 0 ? 0.1 : 0) + (Math.random() - 0.5) * 0.05;
          playPiano(midi, t + jitter, BEAT_SEC * 0.9, vel);
        });
      }

      // Layer the lead melody on top of bars 8-15 of this loop
      MELODY.forEach(([bar, beat, midi, durBeats, vel]) => {
        const t = t0 + bar * BAR_SEC + beat * BEAT_SEC;
        playPiano(midi, t, durBeats * BEAT_SEC, vel);
      });
    };

    const loopSec = LOOP_BARS * BAR_SEC;
    let nextLoopAt = ctx.currentTime + 0.15;
    scheduleLoop(nextLoopAt);
    nextLoopAt += loopSec;
    const interval = window.setInterval(() => {
      while (nextLoopAt < ctx.currentTime + loopSec) {
        scheduleLoop(nextLoopAt);
        nextLoopAt += loopSec;
      }
    }, 2000);

    stopRef.current = () => {
      clearInterval(interval);
      try {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
      } catch {}
      window.setTimeout(() => { try { ctx.close(); } catch {} }, 700);
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
