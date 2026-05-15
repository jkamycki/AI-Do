import type { CSSProperties, ReactNode } from "react";

export type InvitationAnimationLayout =
  | "classic"
  | "animated-envelope"
  | "animated-owl-delivery"
  | "animated-full-photo-save-date";

export const INVITATION_ANIMATION_TEMPLATES: Array<{
  id: InvitationAnimationLayout;
  name: string;
  description: string;
}> = [
  {
    id: "classic",
    name: "Still Card",
    description: "No animation. Best for the simplest digital delivery.",
  },
  {
    id: "animated-envelope",
    name: "Envelope Open",
    description: "A sealed envelope opens to reveal the invitation.",
  },
  {
    id: "animated-owl-delivery",
    name: "Owl Delivery",
    description: "A night-flight delivery drops the envelope before it opens.",
  },
  {
    id: "animated-full-photo-save-date",
    name: "Full Photo Reveal",
    description: "Envelope opens into a full-photo invitation reveal.",
  },
];

function isAnimatedLayout(layout?: string | null): layout is InvitationAnimationLayout {
  return layout === "animated-envelope" || layout === "animated-owl-delivery" || layout === "animated-full-photo-save-date";
}

function normalizeAnimationLayout(layout?: string | null): InvitationAnimationLayout | null {
  if (isAnimatedLayout(layout)) return layout;
  if (layout === "animated-photo-peel" || layout === "animated-seal-reveal") return "animated-envelope";
  return null;
}

function monogramFromNames(value?: string | null) {
  const letters = String(value || "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .filter(Boolean);
  return letters.length > 1 ? `${letters[0]} ${letters[1]}` : letters[0] || "A";
}

export function AnimatedInvitationShell({
  layout,
  accent = "#D4A017",
  paper = "#59634f",
  darkPanel = "#313a2f",
  children,
  compact = false,
  replayKey,
  monogram,
}: {
  layout?: string | null;
  accent?: string;
  paper?: string;
  darkPanel?: string;
  children: ReactNode;
  compact?: boolean;
  replayKey?: string | number;
  monogram?: string | null;
}) {
  const normalizedLayout = normalizeAnimationLayout(layout);
  if (!normalizedLayout) return <>{children}</>;

  const seed = normalizedLayout.replace(/[^a-z0-9-]/gi, "");
  const replay = replayKey ?? `${seed}-${accent}-${paper}-${darkPanel}-${compact ? "compact" : "full"}`;
  const svgIdSeed = String(replay).replace(/[^a-z0-9-]/gi, "-");
  const showOwlDelivery = normalizedLayout === "animated-owl-delivery";
  const sealMonogram = monogramFromNames(monogram);

  return (
    <div
      className={`aido-invite-anim aido-invite-anim-${seed} ${compact ? "aido-invite-anim-compact" : ""}`}
      style={
        {
          "--invite-accent": accent,
          "--invite-paper": paper,
          "--invite-dark": darkPanel,
        } as CSSProperties
      }
    >
      <style>{`
        .aido-invite-anim {
          position: relative;
          width: 100%;
          min-height: ${compact ? "420px" : "min(720px, 100svh)"};
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border-radius: ${compact ? "18px" : "30px"};
          padding: ${compact ? "14px" : "28px 14px"};
          isolation: isolate;
          background:
            linear-gradient(100deg, rgba(255,255,255,.82), rgba(255,255,255,.28) 22%, transparent 42%),
            linear-gradient(16deg, rgba(0,0,0,.045) 0 1px, transparent 1px 36px),
            linear-gradient(104deg, transparent 0 22%, rgba(180,170,150,.16) 23%, transparent 28% 100%),
            linear-gradient(145deg, #f7f4ef, #e9e3d8);
        }
        .aido-invite-anim::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          opacity: .34;
          background-image:
            radial-gradient(ellipse at 28% 12%, rgba(160,150,135,.18), transparent 18%),
            radial-gradient(ellipse at 72% 80%, rgba(120,110,95,.12), transparent 20%),
            linear-gradient(92deg, rgba(255,255,255,.45) 0 1px, transparent 1px 34px);
          background-size: 100% 100%, 100% 100%, 46px 46px;
        }
        .aido-invite-anim-card {
          position: relative;
          z-index: 5;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          transform-origin: 50% 58%;
          backface-visibility: hidden;
          transform-style: preserve-3d;
          will-change: transform, opacity, filter;
          animation: aidoInviteCardIn 1880ms cubic-bezier(.16,.84,.18,1) 2060ms both;
        }
        .aido-invite-anim-card > * {
          flex: 0 1 auto;
        }
        .aido-envelope-layer {
          position: absolute;
          left: 50%;
          top: 50%;
          width: min(calc(100% - ${compact ? "20px" : "34px"}), ${compact ? "440px" : "490px"});
          aspect-ratio: 1.55;
          transform: translate(-50%, -50%);
          z-index: 2;
          pointer-events: none;
          border-radius: ${compact ? "10px" : "14px"};
          overflow: hidden;
          box-shadow:
            0 38px 82px rgba(11, 9, 18, .34),
            0 12px 28px rgba(11, 9, 18, .18),
            inset 0 1px 0 rgba(255,255,255,.32),
            inset 0 -24px 48px rgba(0,0,0,.12);
          will-change: transform, opacity, visibility;
          transform-style: preserve-3d;
          opacity: 0;
          animation: aidoBackEnvelopeIn 760ms cubic-bezier(.18,.78,.18,1) 680ms both;
        }
        .aido-envelope-layer::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 5;
          pointer-events: none;
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,.2),
            inset 0 0 0 2px rgba(0,0,0,.035);
          border-radius: inherit;
        }
        .aido-envelope-flap,
        .aido-envelope-panel,
        .aido-envelope-front,
        .aido-envelope-front-stamp,
        .aido-envelope-front-postmark,
        .aido-envelope-front-script,
        .aido-envelope-side,
        .aido-envelope-bottom,
        .aido-envelope-pocket,
        .aido-envelope-pocket-face,
        .aido-envelope-pocket-face::before,
        .aido-envelope-pocket-face::after,
        .aido-envelope-monogram,
        .aido-wax-seal,
        .aido-castle-backdrop,
        .aido-castle-backdrop *,
        .aido-owl-delivery,
        .aido-owl-delivery::before,
        .aido-owl-delivery::after {
          position: absolute;
          pointer-events: none;
        }
        .aido-envelope-panel {
          inset: 0;
          z-index: 0;
          background:
            linear-gradient(145deg, rgba(255,255,255,.26), rgba(255,255,255,.04) 38%, rgba(0,0,0,.08) 100%),
            radial-gradient(circle at 34% 20%, rgba(255,255,255,.18), transparent 28%),
            repeating-linear-gradient(96deg, rgba(255,255,255,.035) 0 1px, transparent 1px 7px),
            repeating-linear-gradient(6deg, rgba(0,0,0,.022) 0 1px, transparent 1px 8px),
            var(--invite-paper);
        }
        .aido-envelope-panel::before {
          content: "";
          position: absolute;
          inset: 0;
          opacity: .68;
          background:
            linear-gradient(146deg, transparent 49.45%, rgba(255,255,255,.3) 49.8%, rgba(0,0,0,.16) 50.15%, transparent 50.55%),
            linear-gradient(34deg, transparent 49.45%, rgba(255,255,255,.24) 49.8%, rgba(0,0,0,.14) 50.15%, transparent 50.55%),
            linear-gradient(180deg, rgba(255,255,255,.18), transparent 24%, rgba(0,0,0,.06));
        }
        .aido-envelope-panel::after {
          content: "";
          position: absolute;
          inset: 0;
          opacity: .3;
          background-image:
            radial-gradient(circle at 18% 24%, rgba(255,255,255,.26) 0 1px, transparent 1.4px),
            radial-gradient(circle at 68% 72%, rgba(0,0,0,.12) 0 1px, transparent 1.5px),
            linear-gradient(90deg, rgba(255,255,255,.06) 0 1px, transparent 1px 16px);
          background-size: 36px 36px, 42px 42px, 28px 28px;
        }
        .aido-envelope-front {
          border-radius: inherit;
          overflow: hidden;
          transform-origin: 50% 50%;
          backface-visibility: hidden;
          will-change: transform, opacity, filter;
          background:
            linear-gradient(135deg, rgba(255,255,255,.32), rgba(255,255,255,.04) 42%, rgba(0,0,0,.07)),
            radial-gradient(circle at 18% 18%, rgba(255,255,255,.18), transparent 28%),
            repeating-linear-gradient(96deg, rgba(255,255,255,.036) 0 1px, transparent 1px 7px),
            repeating-linear-gradient(7deg, rgba(0,0,0,.022) 0 1px, transparent 1px 8px),
            var(--invite-paper);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.38),
            inset 0 -22px 42px rgba(0,0,0,.08);
          animation: aidoMailerFrontTurn 1520ms cubic-bezier(.18,.76,.18,1) 120ms forwards;
        }
        .aido-envelope-front-stage {
          left: 50%;
          top: 50%;
          width: min(calc(100% - ${compact ? "20px" : "34px"}), ${compact ? "440px" : "490px"});
          aspect-ratio: 1.55;
          z-index: 8;
          border-radius: ${compact ? "10px" : "14px"};
          box-shadow:
            0 38px 82px rgba(11, 9, 18, .34),
            0 12px 28px rgba(11, 9, 18, .18);
          transform: translate(-50%, -50%);
          will-change: transform, opacity, filter;
        }
        .aido-envelope-layer .aido-envelope-front {
          display: none;
        }
        .aido-envelope-front::before {
          content: "";
          position: absolute;
          inset: 0;
          opacity: .32;
          background:
            linear-gradient(90deg, rgba(255,255,255,.18), transparent 24%, rgba(0,0,0,.04)),
            radial-gradient(circle at 76% 24%, rgba(255,255,255,.2), transparent 18%);
        }
        .aido-envelope-front-stamp {
          right: 7%;
          top: 9%;
          width: ${compact ? "54px" : "68px"};
          height: ${compact ? "38px" : "48px"};
          border: 3px solid rgba(255,255,255,.85);
          background:
            linear-gradient(135deg, rgba(245,198,190,.9), rgba(202,222,210,.9) 38%, rgba(238,222,175,.88) 68%, rgba(175,188,204,.9)),
            repeating-linear-gradient(45deg, rgba(255,255,255,.4) 0 2px, transparent 2px 6px);
          box-shadow: 0 2px 8px rgba(0,0,0,.18);
          clip-path: polygon(0 6%, 4% 6%, 4% 0, 10% 0, 10% 6%, 16% 6%, 16% 0, 22% 0, 22% 6%, 28% 6%, 28% 0, 34% 0, 34% 6%, 40% 6%, 40% 0, 46% 0, 46% 6%, 52% 6%, 52% 0, 58% 0, 58% 6%, 64% 6%, 64% 0, 70% 0, 70% 6%, 76% 6%, 76% 0, 82% 0, 82% 6%, 88% 6%, 88% 0, 94% 0, 94% 6%, 100% 6%, 100% 94%, 94% 94%, 94% 100%, 88% 100%, 88% 94%, 82% 94%, 82% 100%, 76% 100%, 76% 94%, 70% 94%, 70% 100%, 64% 100%, 64% 94%, 58% 94%, 58% 100%, 52% 100%, 52% 94%, 46% 94%, 46% 100%, 40% 100%, 40% 94%, 34% 94%, 34% 100%, 28% 100%, 28% 94%, 22% 94%, 22% 100%, 16% 100%, 16% 94%, 10% 94%, 10% 100%, 4% 100%, 4% 94%, 0 94%);
        }
        .aido-envelope-front-postmark {
          right: calc(7% + ${compact ? "58px" : "72px"});
          top: 10%;
          width: ${compact ? "74px" : "92px"};
          height: ${compact ? "42px" : "52px"};
          opacity: .36;
          border: 2px solid rgba(35,55,48,.62);
          border-radius: 999px;
        }
        .aido-envelope-front-postmark::before,
        .aido-envelope-front-postmark::after {
          content: "";
          position: absolute;
          left: 64%;
          width: 80px;
          height: 1px;
          background: rgba(35,55,48,.5);
          box-shadow: 0 7px 0 rgba(35,55,48,.42), 0 14px 0 rgba(35,55,48,.34);
        }
        .aido-envelope-front-postmark::before { top: 13px; }
        .aido-envelope-front-postmark::after { top: 20px; transform: translateX(8px); }
        .aido-envelope-front-script {
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          color: rgba(255,255,255,.82);
          font-family: "Brush Script MT", "Segoe Script", "Snell Roundhand", cursive;
          font-size: ${compact ? "18px" : "25px"};
          letter-spacing: .08em;
          text-shadow: 0 1px 3px rgba(0,0,0,.14);
          white-space: nowrap;
        }
        .aido-envelope-bottom {
          left: 0;
          right: 0;
          bottom: 0;
          height: 52%;
          z-index: 1;
          clip-path: polygon(0 100%, 50% 0, 100% 100%);
          background:
            linear-gradient(180deg, rgba(255,255,255,.18), rgba(0,0,0,.12)),
            linear-gradient(36deg, transparent 49.35%, rgba(255,255,255,.26) 49.75%, rgba(0,0,0,.16) 50.25%, transparent 50.75%),
            repeating-linear-gradient(104deg, rgba(255,255,255,.035) 0 1px, transparent 1px 8px),
            var(--invite-paper);
          filter: drop-shadow(0 -10px 18px rgba(0,0,0,.12));
          animation: aidoBottomDrop 880ms cubic-bezier(.28,.76,.18,1) 2320ms forwards;
        }
        .aido-envelope-pocket {
          left: 50%;
          top: 50%;
          width: min(calc(100% - ${compact ? "20px" : "34px"}), ${compact ? "440px" : "490px"});
          aspect-ratio: 1.55;
          transform: translate(-50%, -50%);
          z-index: 4;
          pointer-events: none;
          will-change: transform, opacity;
          opacity: 0;
          animation: aidoBackEnvelopeIn 760ms cubic-bezier(.18,.78,.18,1) 680ms both;
        }
        .aido-envelope-pocket-face {
          left: 0;
          right: 0;
          bottom: 0;
          height: 58%;
          filter: drop-shadow(0 -12px 22px rgba(0,0,0,.22));
          transform-origin: 50% 100%;
          will-change: transform, opacity;
          animation: aidoPocketRelease 1080ms cubic-bezier(.2,.82,.18,1) 2480ms forwards;
        }
        .aido-envelope-pocket-face::before {
          content: "";
          inset: 0;
          clip-path: polygon(0 100%, 50% 0, 100% 100%);
          background:
            linear-gradient(180deg, rgba(255,255,255,.24), rgba(0,0,0,.13)),
            linear-gradient(36deg, transparent 49.35%, rgba(255,255,255,.3) 49.75%, rgba(0,0,0,.18) 50.25%, transparent 50.75%),
            repeating-linear-gradient(108deg, rgba(255,255,255,.04) 0 1px, transparent 1px 8px),
            repeating-linear-gradient(8deg, rgba(0,0,0,.02) 0 1px, transparent 1px 9px),
            var(--invite-paper);
        }
        .aido-envelope-pocket-face::after {
          content: "";
          width: ${compact ? "64px" : "80px"};
          height: ${compact ? "64px" : "80px"};
          left: calc(50% - ${compact ? "32px" : "40px"});
          top: 4%;
          border-radius: 999px;
          background:
            radial-gradient(circle at 34% 24%, rgba(255,255,255,.62), transparent 16%),
            radial-gradient(circle at 58% 62%, rgba(70,43,10,.28), transparent 48%),
            radial-gradient(circle at 50% 52%, #e8c467, #af7d2a 66%, #735018 100%);
          box-shadow:
            0 14px 28px rgba(0,0,0,.3),
            inset 0 0 0 3px rgba(255,255,255,.16),
            inset 0 0 0 7px rgba(78,52,15,.18),
            inset 0 12px 14px rgba(255,255,255,.14),
            inset 0 -12px 18px rgba(70,43,10,.28);
          opacity: .96;
          z-index: 1;
          animation: aidoSealLift 980ms cubic-bezier(.2,.82,.18,1) 520ms forwards;
        }
        .aido-envelope-monogram {
          width: ${compact ? "64px" : "80px"};
          height: ${compact ? "64px" : "80px"};
          left: calc(50% - ${compact ? "32px" : "40px"});
          top: 4%;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255,255,255,.82);
          font-family: Georgia, 'Times New Roman', serif;
          font-size: ${compact ? "18px" : "22px"};
          font-weight: 700;
          letter-spacing: .08em;
          text-shadow: 0 1px 2px rgba(0,0,0,.28);
          pointer-events: none;
          animation: aidoSealLift 1080ms cubic-bezier(.2,.82,.18,1) 1340ms forwards;
        }
        .aido-envelope-monogram::before {
          content: "";
          position: absolute;
          width: 1px;
          height: 46%;
          left: 50%;
          top: 27%;
          background: rgba(85,55,14,.55);
          box-shadow: 1px 0 0 rgba(255,255,255,.16);
        }
        .aido-envelope-flap {
          inset: 0;
          z-index: 4;
          background:
            linear-gradient(160deg, rgba(255,255,255,.26), transparent 42%),
            linear-gradient(180deg, rgba(255,255,255,.1), rgba(0,0,0,.08)),
            linear-gradient(140deg, transparent 49.55%, rgba(255,255,255,.32) 49.88%, rgba(0,0,0,.18) 50.22%, transparent 50.62%),
            repeating-linear-gradient(104deg, rgba(255,255,255,.04) 0 1px, transparent 1px 8px),
            repeating-linear-gradient(8deg, rgba(0,0,0,.018) 0 1px, transparent 1px 9px),
            var(--invite-paper);
          clip-path: polygon(0 0, 100% 0, 50% 60%);
          transform-origin: top center;
          will-change: transform, opacity;
          animation: aidoFlapOpen 1540ms cubic-bezier(.16,.84,.18,1) 1220ms forwards;
        }
        .aido-envelope-flap::after {
          content: "";
          position: absolute;
          inset: 8% 10% 18%;
          opacity: .56;
          clip-path: polygon(4% 0, 96% 0, 50% 78%);
          background:
            linear-gradient(128deg, rgba(232,232,226,.82), rgba(255,255,255,.42) 34%, rgba(172,166,154,.34) 100%),
            repeating-linear-gradient(102deg, rgba(255,255,255,.2) 0 1px, transparent 1px 7px),
            radial-gradient(circle at 30% 18%, rgba(255,255,255,.42), transparent 26%);
          filter: drop-shadow(0 4px 7px rgba(0,0,0,.12));
        }
        .aido-envelope-side.left {
          left: 0;
          top: 0;
          bottom: 0;
          z-index: 2;
          width: 58%;
          background:
            linear-gradient(40deg, rgba(255,255,255,.22) 0 49.4%, rgba(0,0,0,.14) 50.15%, transparent 50.8%),
            linear-gradient(90deg, rgba(255,255,255,.12), transparent 55%, rgba(0,0,0,.08)),
            repeating-linear-gradient(100deg, rgba(255,255,255,.035) 0 1px, transparent 1px 8px),
            var(--invite-paper);
          clip-path: polygon(0 0, 100% 50%, 0 100%);
          will-change: transform, opacity;
          animation: aidoPanelLeft 980ms cubic-bezier(.22,.78,.18,1) 2200ms forwards;
        }
        .aido-envelope-side.right {
          right: 0;
          top: 0;
          bottom: 0;
          z-index: 2;
          width: 58%;
          background:
            linear-gradient(145deg, rgba(255,255,255,.12), transparent 42%),
            linear-gradient(38deg, transparent 49.45%, rgba(255,255,255,.16) 49.85%, rgba(0,0,0,.16) 50.25%, transparent 50.75%),
            repeating-linear-gradient(100deg, rgba(255,255,255,.032) 0 1px, transparent 1px 8px),
            var(--invite-dark);
          clip-path: polygon(100% 0, 0 50%, 100% 100%);
          will-change: transform, opacity;
          animation: aidoPanelRight 980ms cubic-bezier(.22,.78,.18,1) 2260ms forwards;
        }
        .aido-wax-seal {
          display: none;
          width: ${compact ? "70px" : "88px"};
          height: ${compact ? "70px" : "88px"};
          z-index: 6;
          border-radius: 999px;
          left: calc(50% - ${compact ? "35px" : "44px"});
          top: calc(50% - ${compact ? "35px" : "44px"});
          background:
            radial-gradient(circle at 34% 28%, rgba(255,255,255,.44), transparent 18%),
            radial-gradient(circle at 50% 52%, var(--invite-accent), #8a6320 74%);
          box-shadow:
            0 14px 34px rgba(0,0,0,.38),
            inset 0 0 0 5px rgba(255,255,255,.14),
            inset 0 0 0 11px rgba(0,0,0,.1);
          animation: aidoSealLift 1180ms cubic-bezier(.2,.82,.18,1) 560ms forwards;
        }
        .aido-wax-seal::before,
        .aido-wax-seal::after {
          content: "";
          position: absolute;
          border: 2px solid rgba(255,255,255,.68);
          border-radius: 999px;
        }
        .aido-wax-seal::before {
          width: 34%;
          height: 27%;
          left: 26%;
          top: 39%;
        }
        .aido-wax-seal::after {
          width: 34%;
          height: 27%;
          right: 26%;
          top: 39%;
        }
        .aido-invite-anim-animated-owl-delivery {
          background:
            radial-gradient(circle at 72% 14%, rgba(255,255,255,.56) 0 3%, transparent 4%),
            radial-gradient(circle at 80% 20%, rgba(255,255,255,.34) 0 1px, transparent 2px),
            radial-gradient(circle at 22% 28%, rgba(255,255,255,.28) 0 1px, transparent 2px),
            radial-gradient(circle at 52% 16%, rgba(255,255,255,.22) 0 1px, transparent 2px),
            radial-gradient(circle at 46% 34%, rgba(114,129,255,.42), transparent 32%),
            radial-gradient(circle at 18% 12%, rgba(255,255,255,.2), transparent 26%),
            linear-gradient(150deg, #10162b 0%, #1f2f72 48%, #6b5b8f 100%);
        }
        .aido-castle-backdrop {
          left: 50%;
          bottom: -2%;
          z-index: 0;
          width: min(84%, 620px);
          height: ${compact ? "190px" : "250px"};
          transform: translateX(-50%);
          opacity: .44;
          filter: drop-shadow(0 -18px 36px rgba(167,185,255,.14));
        }
        .aido-castle-backdrop::before {
          content: "";
          position: absolute;
          left: 50%;
          bottom: -20%;
          width: 118%;
          height: 42%;
          transform: translateX(-50%);
          border-radius: 999px;
          background: radial-gradient(ellipse at center, rgba(255,255,255,.22), transparent 68%);
          filter: blur(12px);
        }
        .aido-castle-keep {
          left: 26%;
          right: 26%;
          bottom: 0;
          height: 55%;
          border-radius: 12px 12px 0 0;
          background:
            radial-gradient(circle at 26% 34%, rgba(245,222,151,.42) 0 2px, transparent 3px),
            radial-gradient(circle at 74% 34%, rgba(245,222,151,.34) 0 2px, transparent 3px),
            linear-gradient(180deg, rgba(20,26,58,.86), rgba(8,13,32,.94));
        }
        .aido-castle-keep::before {
          content: "";
          position: absolute;
          left: 8%;
          right: 8%;
          top: -16px;
          height: 16px;
          background:
            linear-gradient(90deg, rgba(12,18,42,.92) 0 12%, transparent 12% 22%, rgba(12,18,42,.92) 22% 34%, transparent 34% 44%, rgba(12,18,42,.92) 44% 56%, transparent 56% 66%, rgba(12,18,42,.92) 66% 78%, transparent 78% 88%, rgba(12,18,42,.92) 88% 100%);
        }
        .aido-castle-tower {
          bottom: 0;
          width: 18%;
          height: 68%;
          border-radius: 10px 10px 0 0;
          background:
            radial-gradient(circle at 50% 34%, rgba(245,222,151,.44) 0 2px, transparent 3px),
            linear-gradient(180deg, rgba(18,24,55,.9), rgba(7,12,31,.96));
        }
        .aido-castle-tower::before {
          content: "";
          position: absolute;
          left: 50%;
          top: -34px;
          width: 84%;
          height: 38px;
          transform: translateX(-50%);
          clip-path: polygon(50% 0, 100% 100%, 0 100%);
          background: linear-gradient(180deg, rgba(33,43,90,.9), rgba(8,13,32,.96));
        }
        .aido-castle-tower.left {
          left: 8%;
          height: 58%;
        }
        .aido-castle-tower.center-left {
          left: 31%;
          width: 15%;
          height: 82%;
        }
        .aido-castle-tower.center-right {
          right: 31%;
          width: 15%;
          height: 78%;
        }
        .aido-castle-tower.right {
          right: 8%;
          height: 62%;
        }
        .aido-castle-bridge {
          left: 11%;
          right: 11%;
          bottom: 0;
          height: 22%;
          border-radius: 18px 18px 0 0;
          background: linear-gradient(180deg, rgba(11,17,42,.76), rgba(6,10,28,.92));
        }
        .aido-invite-anim-animated-owl-delivery .aido-invite-anim-card {
          animation: aidoOwlInviteCardIn 1840ms cubic-bezier(.16,.82,.2,1) 2660ms both;
        }
        .aido-invite-anim-animated-owl-delivery .aido-envelope-front-stage {
          opacity: 0;
          transform: translate(-50%, -82%) scale(.48) rotate(-8deg);
          animation: aidoOwlMailerFrontDelivery 2780ms cubic-bezier(.18,.82,.18,1) 940ms forwards;
        }
        .aido-invite-anim-animated-owl-delivery .aido-envelope-layer {
          opacity: 0;
          width: min(calc(100% - ${compact ? "72px" : "100px"}), ${compact ? "390px" : "460px"});
          aspect-ratio: 1.55;
          transform: translate(-50%, -86%) scale(.46) rotate(-8deg);
          will-change: transform, opacity, visibility;
          animation: aidoOwlEnvelopeDrop 1240ms cubic-bezier(.18,.82,.18,1) 940ms forwards;
        }
        .aido-invite-anim-animated-owl-delivery .aido-envelope-flap {
          animation-delay: 2080ms;
        }
        .aido-invite-anim-animated-owl-delivery .aido-wax-seal {
          animation-delay: 2140ms;
        }
        .aido-invite-anim-animated-owl-delivery .aido-envelope-side.left {
          animation-delay: 2840ms;
        }
        .aido-invite-anim-animated-owl-delivery .aido-envelope-side.right {
          animation-delay: 2890ms;
        }
        .aido-invite-anim-animated-owl-delivery .aido-envelope-bottom {
          animation-delay: 3000ms;
        }
        .aido-invite-anim-animated-owl-delivery .aido-envelope-pocket {
          opacity: 0;
          width: min(calc(100% - ${compact ? "72px" : "100px"}), ${compact ? "390px" : "460px"});
          aspect-ratio: 1.55;
          transform: translate(-50%, -82%) scale(.48) rotate(-8deg);
          will-change: transform, opacity;
          animation: aidoOwlEnvelopeDrop 1240ms cubic-bezier(.18,.82,.18,1) 940ms forwards;
        }
        .aido-invite-anim-animated-owl-delivery .aido-envelope-pocket-face {
          animation-delay: 3000ms;
        }
        .aido-invite-anim-animated-owl-delivery .aido-envelope-pocket-face::after {
          animation-delay: 2140ms;
        }
        .aido-invite-anim-animated-owl-delivery .aido-envelope-monogram {
          animation-delay: 2140ms;
        }
        .aido-owl-delivery {
          left: 50%;
          top: 6%;
          z-index: 7;
          width: ${compact ? "268px" : "340px"};
          height: ${compact ? "154px" : "196px"};
          transform-origin: 50% 42%;
          filter: drop-shadow(0 22px 28px rgba(0,0,0,.34));
          will-change: transform, opacity, filter;
          backface-visibility: hidden;
          animation: aidoOwlFlyToward 2240ms cubic-bezier(.18,.74,.16,1) 40ms both;
        }
        .aido-owl-delivery::before {
          content: "";
          left: -12%;
          top: 6%;
          width: 42%;
          height: 34%;
          border-radius: 999px;
          background:
            radial-gradient(circle, rgba(255,255,255,.9) 0 2px, transparent 3px),
            linear-gradient(90deg, transparent, rgba(255,255,255,.5), transparent);
          filter: blur(.5px);
          opacity: .7;
          animation: aidoOwlTrail 1320ms ease-out 80ms both;
        }
        .aido-owl-delivery::after {
          content: "";
          left: 35%;
          top: 18%;
          width: 30%;
          height: 42%;
          border-radius: 999px;
          background: rgba(255,255,255,.24);
          filter: blur(16px);
        }
        .aido-owl-svg {
          inset: 0;
          width: 100%;
          height: 100%;
          overflow: visible;
          position: absolute;
        }
        .aido-owl-wing-svg {
          transform-box: fill-box;
          transform-origin: 88% 58%;
          will-change: transform;
          animation: aidoOwlWingToward 460ms ease-in-out infinite alternate;
        }
        .aido-owl-wing-svg.right {
          transform-origin: 12% 58%;
          animation-name: aidoOwlWingTowardRight;
        }
        .aido-owl-envelope-svg {
          transform-box: fill-box;
          transform-origin: 50% 50%;
          filter: drop-shadow(0 4px 5px rgba(0,0,0,.22));
          will-change: transform, opacity;
          animation: aidoOwlTinyEnvelopeDrop 920ms cubic-bezier(.22,.76,.2,1) 900ms forwards;
        }
        @keyframes aidoInviteCardIn {
          0% {
            opacity: 0;
            transform: translateY(34%) scale(.72);
            filter: blur(1.2px);
          }
          18% {
            opacity: .98;
            transform: translateY(26%) scale(.78);
            filter: blur(.5px);
          }
          48% {
            opacity: 1;
            transform: translateY(5%) scale(.9);
            filter: blur(0);
          }
          72% {
            opacity: 1;
            transform: translateY(-7%) scale(.965);
          }
          100% {
            opacity: 1;
            transform: translateY(-8%) scale(.985);
            filter: blur(0);
          }
        }
        @keyframes aidoLayerGone { to { visibility: hidden; } }
        @keyframes aidoBackEnvelopeIn {
          0% {
            opacity: 0;
            transform: translate(-50%, -48%) scale(.985);
            filter: blur(.5px);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
            filter: blur(0);
          }
        }
        @keyframes aidoMailerFrontTurn {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) perspective(1100px) rotateY(0deg) rotate(0deg) scale(1);
            filter: blur(0);
          }
          28% {
            opacity: 1;
            transform: translate(-50%, -50%) perspective(1100px) rotateY(-5deg) rotate(.2deg) scale(1.006);
            filter: blur(0);
          }
          62% {
            opacity: .7;
            transform: translate(-53%, -50%) perspective(1100px) rotateY(-36deg) rotate(-1.6deg) scale(.994);
            filter: blur(.2px);
          }
          100% {
            opacity: 0;
            transform: translate(-61%, -50%) perspective(1100px) rotateY(-78deg) rotate(-3deg) scale(.986);
            filter: blur(.45px);
            visibility: hidden;
          }
        }
        @keyframes aidoOwlMailerFrontDelivery {
          0% {
            opacity: 0;
            transform: translate(-50%, -82%) scale(.48) rotate(-8deg);
            filter: blur(.5px);
          }
          6% {
            opacity: 1;
          }
          34% {
            opacity: 1;
            transform: translate(-50%, -56%) scale(.76) rotate(3deg);
            filter: blur(.1px);
          }
          52% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1) rotate(0deg);
            filter: blur(0);
          }
          66% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1) rotate(0deg);
          }
          84% {
            opacity: .42;
            transform: translate(-54%, -50%) perspective(1100px) rotateY(-36deg) rotate(-2deg) scale(.99);
            filter: blur(.25px);
          }
          100% {
            opacity: 0;
            transform: translate(-62%, -50%) perspective(1100px) rotateY(-78deg) rotate(-4deg) scale(.985);
            filter: blur(.45px);
            visibility: hidden;
          }
        }
        @keyframes aidoFlapOpen {
          0% { transform: perspective(960px) rotateX(0deg); opacity: 1; }
          42% { transform: perspective(960px) rotateX(82deg) translateY(-3px); opacity: 1; }
          70% { transform: perspective(960px) rotateX(138deg) translateY(-12px); opacity: .98; }
          100% { transform: perspective(960px) rotateX(164deg) translateY(-20px); opacity: .96; }
        }
        @keyframes aidoBottomDrop {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          68% { transform: translateY(1.6%) scale(1); opacity: 1; }
          100% { transform: translateY(2.8%) scale(.998); opacity: .98; }
        }
        @keyframes aidoPocketRelease {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          48% { transform: translateY(2.5%) scale(1); opacity: 1; }
          100% { transform: translateY(5%) scale(.998); opacity: .32; }
        }
        @keyframes aidoPanelLeft {
          0% { transform: translateX(0) rotate(0); opacity: 1; }
          100% { transform: translateX(-1.8%) rotate(-.6deg); opacity: .98; }
        }
        @keyframes aidoPanelRight {
          0% { transform: translateX(0) rotate(0); opacity: 1; }
          100% { transform: translateX(1.8%) rotate(.6deg); opacity: .98; }
        }
        @keyframes aidoSealLift {
          0% { transform: scale(.96); opacity: 0; }
          18% { transform: scale(1); opacity: 1; }
          42% { transform: translateY(-2px) scale(1.08); opacity: 1; }
          100% { transform: translateY(-64px) scale(.66); opacity: 0; }
        }
        @keyframes aidoOwlFlyToward {
          0% {
            opacity: 0;
            transform: translate(-50%, -54px) scale(.18) rotate(-1.5deg);
            filter: blur(1.4px) drop-shadow(0 8px 10px rgba(0,0,0,.18));
          }
          12% {
            opacity: 1;
          }
          36% {
            opacity: 1;
            transform: translate(-50%, 28px) scale(.52) rotate(.35deg);
            filter: blur(.4px) drop-shadow(0 18px 22px rgba(0,0,0,.28));
          }
          62% {
            opacity: 1;
            transform: translate(-50%, 70px) scale(.98) rotate(0deg);
            filter: blur(0) drop-shadow(0 28px 34px rgba(0,0,0,.38));
          }
          80% {
            opacity: .98;
            transform: translate(-50%, 54px) scale(1.14) rotate(.45deg);
            filter: blur(.15px) drop-shadow(0 32px 38px rgba(0,0,0,.34));
          }
          100% {
            opacity: 0;
            transform: translate(-50%, 14px) scale(1.28) rotate(.8deg);
            filter: blur(.8px) drop-shadow(0 38px 42px rgba(0,0,0,.28));
          }
        }
        @keyframes aidoOwlWingToward {
          from { transform: rotate(9deg) translateY(0) scaleY(.96); }
          to { transform: rotate(-8deg) translateY(-10px) scaleY(1.05); }
        }
        @keyframes aidoOwlWingTowardRight {
          from { transform: rotate(-9deg) translateY(0) scaleY(.96); }
          to { transform: rotate(8deg) translateY(-10px) scaleY(1.05); }
        }
        @keyframes aidoOwlTrail {
          0% { opacity: 0; transform: translate(42px, 26px) scale(.5); }
          38% { opacity: .82; }
          100% { opacity: 0; transform: translate(-34px, -8px) scale(1.15); }
        }
        @keyframes aidoOwlTinyEnvelopeDrop {
          0% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
          42% { opacity: 1; transform: translateY(42px) scale(1.08) rotate(0deg); }
          78% { opacity: .82; transform: translateY(88px) scale(1.22) rotate(0deg); }
          100% { opacity: 0; transform: translateY(112px) scale(1.32) rotate(0deg); }
        }
        @keyframes aidoOwlEnvelopeDrop {
          0% { opacity: 0; transform: translate(-50%, -82%) scale(.48) rotate(-8deg); }
          12% { opacity: 1; }
          42% { opacity: 1; transform: translate(-50%, -56%) scale(.76) rotate(3deg); }
          70% { opacity: 1; transform: translate(-50%, -48.5%) scale(.95) rotate(-.7deg); }
          88% { opacity: 1; transform: translate(-50%, -50%) scale(1.008) rotate(.2deg); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); }
        }
        @keyframes aidoOwlInviteCardIn {
          0% { opacity: 0; transform: translateY(28%) scale(.68) rotate(84deg); filter: blur(1.4px); }
          20% { opacity: .72; transform: translateY(18%) scale(.76) rotate(70deg); filter: blur(.6px); }
          52% { opacity: .96; transform: translateY(5%) scale(.89) rotate(34deg); filter: blur(0); }
          80% { opacity: 1; transform: translateY(-5%) scale(.96) rotate(6deg); }
          100% { opacity: 1; transform: translateY(-8%) scale(.985) rotate(0deg); filter: blur(0); }
        }
        @media (max-width: 640px) {
          .aido-invite-anim {
            min-height: ${compact ? "390px" : "100svh"};
            padding: ${compact ? "10px" : "18px 8px"};
          }
          .aido-owl-delivery {
            width: ${compact ? "236px" : "290px"};
            height: ${compact ? "136px" : "168px"};
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .aido-invite-anim-card, .aido-envelope-layer, .aido-envelope-front, .aido-envelope-flap,
          .aido-envelope-side, .aido-envelope-bottom, .aido-envelope-pocket,
          .aido-envelope-pocket-face, .aido-envelope-pocket-face::after, .aido-envelope-monogram, .aido-wax-seal,
          .aido-owl-delivery, .aido-owl-wing-svg, .aido-owl-envelope-svg {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>
      <div key={`card-${replay}`} className="aido-invite-anim-card">
        {children}
      </div>
      <div key={`front-${replay}`} className="aido-envelope-front aido-envelope-front-stage" aria-hidden="true">
        <span className="aido-envelope-front-postmark" />
        <span className="aido-envelope-front-stamp" />
        <span className="aido-envelope-front-script">You are Invited</span>
      </div>
      <div key={`pocket-${replay}`} className="aido-envelope-pocket" aria-hidden="true">
        <div className="aido-envelope-pocket-face">
          <span className="aido-envelope-monogram">{sealMonogram}</span>
        </div>
      </div>
      {showOwlDelivery && (
        <div key={`castle-${replay}`} className="aido-castle-backdrop" aria-hidden="true">
          <div className="aido-castle-tower left" />
          <div className="aido-castle-tower center-left" />
          <div className="aido-castle-keep" />
          <div className="aido-castle-tower center-right" />
          <div className="aido-castle-tower right" />
          <div className="aido-castle-bridge" />
        </div>
      )}
      {showOwlDelivery && (
        <div key={`owl-${replay}`} className="aido-owl-delivery" aria-hidden="true">
          <svg className="aido-owl-svg" viewBox="0 0 340 196" role="presentation" focusable="false">
            <defs>
              <linearGradient id={`owl-feather-${svgIdSeed}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="58%" stopColor="#f2eee2" />
                <stop offset="100%" stopColor="#cfc4ad" />
              </linearGradient>
              <linearGradient id={`owl-shadow-${svgIdSeed}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#b6aa93" />
              </linearGradient>
              <radialGradient id={`owl-face-${svgIdSeed}`} cx="50%" cy="42%" r="62%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="72%" stopColor="#f4efe2" />
                <stop offset="100%" stopColor="#cfc5ad" />
              </radialGradient>
            </defs>
            <path
              className="aido-owl-wing-svg left"
              d="M167 84 C128 18 60 10 9 58 C44 55 78 66 110 90 C76 91 42 104 14 126 C74 130 128 117 167 96 Z"
              fill={`url(#owl-feather-${svgIdSeed})`}
              stroke="#d8d0bd"
              strokeWidth="2"
            />
            <path
              className="aido-owl-wing-svg right"
              d="M173 84 C212 18 280 10 331 58 C296 55 262 66 230 90 C264 91 298 104 326 126 C266 130 212 117 173 96 Z"
              fill={`url(#owl-feather-${svgIdSeed})`}
              stroke="#d8d0bd"
              strokeWidth="2"
            />
            {[24, 43, 62, 81, 100, 119, 138].map((x) => (
              <path
                key={`left-feather-${x}`}
                d={`M${x} 62 C${x + 28} 71 ${x + 54} 84 166 90`}
                fill="none"
                stroke="#bdb39e"
                strokeWidth="1.25"
                opacity="0.68"
              />
            ))}
            {[316, 297, 278, 259, 240, 221, 202].map((x) => (
              <path
                key={`right-feather-${x}`}
                d={`M${x} 62 C${x - 28} 71 ${x - 54} 84 174 90`}
                fill="none"
                stroke="#bdb39e"
                strokeWidth="1.25"
                opacity="0.68"
              />
            ))}
            {[42, 61, 80, 99, 118].map((x) => (
              <path
                key={`left-tip-${x}`}
                d={`M${x} 103 C${x + 12} 119 ${x + 24} 128 ${x + 40} 134`}
                fill="none"
                stroke="#d4ccba"
                strokeWidth="1"
                opacity="0.55"
              />
            ))}
            {[298, 279, 260, 241, 222].map((x) => (
              <path
                key={`right-tip-${x}`}
                d={`M${x} 103 C${x - 12} 119 ${x - 24} 128 ${x - 40} 134`}
                fill="none"
                stroke="#d4ccba"
                strokeWidth="1"
                opacity="0.55"
              />
            ))}
            <ellipse cx="170" cy="106" rx="42" ry="62" fill={`url(#owl-shadow-${svgIdSeed})`} stroke="#d8d0bd" strokeWidth="2" />
            <path d="M137 91 C151 76 189 76 203 91 C197 123 188 150 170 160 C152 150 143 123 137 91 Z" fill="#f8f6ef" opacity="0.86" />
            {[150, 160, 170, 180, 190].map((x, index) => (
              <path
                key={`chest-${x}`}
                d={`M${x} ${112 + index * 3} C${x + 5} ${120 + index * 3} ${x + 9} ${120 + index * 3} ${x + 14} ${112 + index * 3}`}
                fill="none"
                stroke="#b8ad98"
                strokeWidth="1.4"
                opacity="0.52"
              />
            ))}
            <path
              d="M134 75 C138 42 158 31 170 49 C182 31 202 42 206 75 C197 60 182 58 170 68 C158 58 143 60 134 75 Z"
              fill={`url(#owl-face-${svgIdSeed})`}
              stroke="#d8d0bd"
              strokeWidth="2"
            />
            <path d="M143 72 C149 62 160 61 167 70 C160 68 153 70 147 76 Z" fill="#e5dfcf" opacity="0.75" />
            <path d="M197 72 C191 62 180 61 173 70 C180 68 187 70 193 76 Z" fill="#e5dfcf" opacity="0.75" />
            <ellipse cx="154" cy="79" rx="13" ry="12" fill="#f3cf59" stroke="#7c5c19" strokeWidth="2" />
            <ellipse cx="186" cy="79" rx="13" ry="12" fill="#f3cf59" stroke="#7c5c19" strokeWidth="2" />
            <circle cx="154" cy="79" r="5" fill="#17131b" />
            <circle cx="186" cy="79" r="5" fill="#17131b" />
            <circle cx="152" cy="77" r="1.5" fill="#ffffff" opacity="0.9" />
            <circle cx="184" cy="77" r="1.5" fill="#ffffff" opacity="0.9" />
            <path d="M170 88 L161 99 H179 Z" fill="#4d3624" />
            <path d="M163 103 C167 107 173 107 177 103" fill="none" stroke="#8d806d" strokeWidth="1.4" opacity="0.55" />
            <path d="M145 116 C156 126 184 126 195 116" fill="none" stroke="#b4a68d" strokeWidth="2" opacity="0.7" />
            <path d="M151 134 C160 144 180 144 189 134" fill="none" stroke="#b4a68d" strokeWidth="2" opacity="0.5" />
            <path d="M151 157 C154 166 160 168 166 157" fill="none" stroke="#7b6040" strokeWidth="3" strokeLinecap="round" />
            <path d="M174 157 C180 168 186 166 189 157" fill="none" stroke="#7b6040" strokeWidth="3" strokeLinecap="round" />
            <path d="M146 160 L139 166 M160 161 L157 170 M181 161 L184 170 M194 160 L201 166" stroke="#7b6040" strokeWidth="2" strokeLinecap="round" opacity="0.75" />
            <g className="aido-owl-envelope-svg">
              <rect x="116" y="150" width="108" height="34" rx="4" fill={paper} stroke="rgba(255,255,255,.42)" strokeWidth="1.4" />
              <path d="M116 150 L170 174 L224 150" fill="none" stroke="rgba(0,0,0,.28)" strokeWidth="2" />
              <path d="M116 184 L156 164 M224 184 L184 164" fill="none" stroke="rgba(0,0,0,.24)" strokeWidth="1.7" />
              <circle cx="170" cy="167" r="8" fill={accent} opacity="0.96" stroke="rgba(255,255,255,.38)" strokeWidth="1.2" />
              <text
                x="170"
                y="170"
                textAnchor="middle"
                fontFamily="Georgia, serif"
                fontSize="7"
                fontWeight="700"
                fill="#ffffff"
              >
                {sealMonogram}
              </text>
            </g>
          </svg>
        </div>
      )}
      <div key={`layer-${replay}`} className="aido-envelope-layer" aria-hidden="true">
        <div className="aido-envelope-panel" />
        <div className="aido-envelope-flap" />
        <div className="aido-envelope-side left" />
        <div className="aido-envelope-side right" />
        <div className="aido-envelope-bottom" />
        <div className="aido-wax-seal" />
      </div>
    </div>
  );
}
