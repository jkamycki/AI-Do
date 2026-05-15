import type { CSSProperties, ReactNode } from "react";

export type InvitationAnimationLayout =
  | "classic"
  | "animated-envelope"
  | "animated-photo-peel"
  | "animated-seal-reveal";

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
    id: "animated-photo-peel",
    name: "Photo Reveal",
    description: "Paper panels peel back over the couple photo.",
  },
  {
    id: "animated-seal-reveal",
    name: "Wax Seal Reveal",
    description: "A wax seal lifts away before the card settles in.",
  },
];

function isAnimatedLayout(layout?: string | null): layout is InvitationAnimationLayout {
  return layout === "animated-envelope" || layout === "animated-photo-peel" || layout === "animated-seal-reveal";
}

export function AnimatedInvitationShell({
  layout,
  accent = "#D4A017",
  paper = "#d9c8ad",
  darkPanel = "#15131f",
  children,
  compact = false,
  replayKey,
}: {
  layout?: string | null;
  accent?: string;
  paper?: string;
  darkPanel?: string;
  children: ReactNode;
  compact?: boolean;
  replayKey?: string | number;
}) {
  if (!isAnimatedLayout(layout)) return <>{children}</>;

  const seed = layout.replace(/[^a-z0-9-]/gi, "");
  const replay = replayKey ?? `${seed}-${accent}-${paper}-${darkPanel}-${compact ? "compact" : "full"}`;

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
            radial-gradient(circle at 18% 12%, rgba(255,255,255,.42), transparent 26%),
            radial-gradient(circle at 85% 4%, color-mix(in srgb, var(--invite-accent) 20%, transparent), transparent 24%),
            linear-gradient(145deg, rgba(255,255,255,.28), rgba(0,0,0,.08));
        }
        .aido-invite-anim::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          opacity: .24;
          background-image:
            linear-gradient(115deg, rgba(255,255,255,.24) 0 1px, transparent 1px 22px),
            radial-gradient(circle, rgba(0,0,0,.12) 0 1px, transparent 1.2px);
          background-size: 34px 34px, 44px 44px;
        }
        .aido-invite-anim-card {
          position: relative;
          z-index: 1;
          width: 100%;
          transform-origin: 50% 58%;
          animation: aidoInviteCardIn 1180ms cubic-bezier(.2,.84,.18,1) 980ms both;
        }
        .aido-envelope-layer {
          position: absolute;
          left: 50%;
          top: 50%;
          width: min(calc(100% - ${compact ? "20px" : "34px"}), ${compact ? "440px" : "490px"});
          aspect-ratio: .68;
          transform: translate(-50%, -50%);
          z-index: 3;
          pointer-events: none;
          border-radius: ${compact ? "18px" : "24px"};
          overflow: hidden;
          box-shadow:
            0 34px 80px rgba(11, 9, 18, .34),
            0 2px 0 rgba(255,255,255,.22) inset;
          animation: aidoLayerGone 1ms linear 2500ms forwards;
        }
        .aido-envelope-layer::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 5;
          pointer-events: none;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.16);
          border-radius: inherit;
        }
        .aido-envelope-flap,
        .aido-envelope-panel,
        .aido-envelope-side,
        .aido-envelope-bottom,
        .aido-wax-seal {
          position: absolute;
          pointer-events: none;
        }
        .aido-envelope-panel {
          inset: 0;
          z-index: 0;
          background:
            linear-gradient(135deg, rgba(255,255,255,.42), transparent 32%),
            linear-gradient(45deg, rgba(0,0,0,.1), transparent 48%),
            radial-gradient(circle at 30% 24%, rgba(255,255,255,.2), transparent 28%),
            var(--invite-paper);
        }
        .aido-envelope-panel::after {
          content: "";
          position: absolute;
          inset: 0;
          opacity: .26;
          background-image:
            linear-gradient(120deg, rgba(255,255,255,.28) 0 1px, transparent 1px 18px),
            radial-gradient(circle at 20% 30%, rgba(0,0,0,.12) 0 1px, transparent 1.4px);
          background-size: 28px 28px, 38px 38px;
        }
        .aido-envelope-bottom {
          left: 0;
          right: 0;
          bottom: 0;
          height: 52%;
          z-index: 1;
          clip-path: polygon(0 100%, 50% 0, 100% 100%);
          background:
            linear-gradient(180deg, rgba(255,255,255,.2), rgba(0,0,0,.1)),
            var(--invite-paper);
          animation: aidoBottomDrop 1150ms cubic-bezier(.28,.76,.18,1) 1040ms forwards;
        }
        .aido-envelope-flap {
          inset: 0;
          z-index: 4;
          background:
            linear-gradient(160deg, rgba(255,255,255,.26), transparent 42%),
            linear-gradient(140deg, transparent 50%, rgba(0,0,0,.16) 50.4%),
            var(--invite-paper);
          clip-path: polygon(0 0, 100% 0, 50% 60%);
          transform-origin: top center;
          animation: aidoFlapOpen 1500ms cubic-bezier(.18,.82,.16,1) 360ms forwards;
        }
        .aido-envelope-side.left {
          left: 0;
          top: 0;
          bottom: 0;
          z-index: 2;
          width: 58%;
          background:
            linear-gradient(40deg, rgba(255,255,255,.18) 0 49%, rgba(0,0,0,.14) 50%, transparent 51%),
            var(--invite-paper);
          clip-path: polygon(0 0, 100% 50%, 0 100%);
          animation: aidoPanelLeft 1320ms cubic-bezier(.28,.76,.18,1) 820ms forwards;
        }
        .aido-envelope-side.right {
          right: 0;
          top: 0;
          bottom: 0;
          z-index: 2;
          width: 58%;
          background:
            linear-gradient(145deg, rgba(255,255,255,.1), transparent 42%),
            var(--invite-dark);
          clip-path: polygon(100% 0, 0 50%, 100% 100%);
          animation: aidoPanelRight 1320ms cubic-bezier(.28,.76,.18,1) 880ms forwards;
        }
        .aido-wax-seal {
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
        .aido-invite-anim-animated-photo-peel .aido-envelope-flap {
          clip-path: polygon(0 0, 70% 0, 28% 100%, 0 100%);
          transform-origin: left center;
          animation-name: aidoPhotoPeel;
          animation-delay: 420ms;
        }
        .aido-invite-anim-animated-photo-peel .aido-envelope-bottom {
          animation-delay: 1120ms;
        }
        .aido-invite-anim-animated-photo-peel .aido-envelope-side.right {
          animation-delay: 980ms;
        }
        .aido-invite-anim-animated-seal-reveal .aido-wax-seal {
          animation-delay: 240ms;
        }
        .aido-invite-anim-animated-seal-reveal .aido-envelope-side.left,
        .aido-invite-anim-animated-seal-reveal .aido-envelope-side.right,
        .aido-invite-anim-animated-seal-reveal .aido-envelope-bottom,
        .aido-invite-anim-animated-seal-reveal .aido-envelope-flap {
          animation-delay: 1020ms;
        }
        @keyframes aidoInviteCardIn {
          0% { opacity: 0; transform: translateY(24px) scale(.945); filter: blur(3px); }
          58% { opacity: .82; transform: translateY(7px) scale(.985); filter: blur(.6px); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes aidoLayerGone { to { visibility: hidden; } }
        @keyframes aidoFlapOpen {
          0% { transform: perspective(900px) rotateX(0deg); opacity: 1; }
          58% { transform: perspective(900px) rotateX(126deg); opacity: .98; }
          100% { transform: perspective(900px) rotateX(158deg) translateY(-18px); opacity: 0; }
        }
        @keyframes aidoBottomDrop {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(70%); opacity: 0; }
        }
        @keyframes aidoPanelLeft {
          0% { transform: translateX(0) rotate(0); opacity: 1; }
          100% { transform: translateX(-88%) rotate(-6deg); opacity: 0; }
        }
        @keyframes aidoPanelRight {
          0% { transform: translateX(0) rotate(0); opacity: 1; }
          100% { transform: translateX(90%) rotate(6deg); opacity: 0; }
        }
        @keyframes aidoSealLift {
          0% { transform: scale(.96); opacity: 0; }
          18% { transform: scale(1); opacity: 1; }
          45% { transform: scale(1.08); opacity: 1; }
          100% { transform: translateY(-58px) scale(.68); opacity: 0; }
        }
        @keyframes aidoPhotoPeel {
          0% { transform: translateX(0) rotate(0); opacity: 1; }
          100% { transform: translateX(-88%) rotate(-9deg); opacity: 0; }
        }
        @media (max-width: 640px) {
          .aido-invite-anim {
            min-height: ${compact ? "390px" : "100svh"};
            padding: ${compact ? "10px" : "18px 8px"};
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .aido-invite-anim-card, .aido-envelope-layer, .aido-envelope-flap,
          .aido-envelope-side, .aido-envelope-bottom, .aido-wax-seal {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>
      <div key={`card-${replay}`} className="aido-invite-anim-card">
        {children}
      </div>
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
