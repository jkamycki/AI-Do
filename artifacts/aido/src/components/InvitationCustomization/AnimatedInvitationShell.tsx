import type { CSSProperties, ReactNode } from "react";

export type InvitationAnimationLayout =
  | "classic"
  | "animated-envelope"
  | "animated-photo-peel"
  | "animated-seal-reveal"
  | "animated-owl-delivery";

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
  {
    id: "animated-owl-delivery",
    name: "Owl Delivery",
    description: "A night-flight delivery drops the envelope before it opens.",
  },
];

function isAnimatedLayout(layout?: string | null): layout is InvitationAnimationLayout {
  return (
    layout === "animated-envelope" ||
    layout === "animated-photo-peel" ||
    layout === "animated-seal-reveal" ||
    layout === "animated-owl-delivery"
  );
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
  const svgIdSeed = String(replay).replace(/[^a-z0-9-]/gi, "-");
  const showOwlDelivery = layout === "animated-owl-delivery";

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
          z-index: 3;
          width: 100%;
          transform-origin: 50% 58%;
          animation: aidoInviteCardIn 1260ms cubic-bezier(.2,.84,.18,1) 1080ms both;
        }
        .aido-envelope-layer {
          position: absolute;
          left: 50%;
          top: 50%;
          width: min(calc(100% - ${compact ? "20px" : "34px"}), ${compact ? "440px" : "490px"});
          aspect-ratio: .68;
          transform: translate(-50%, -50%);
          z-index: 2;
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
        .aido-envelope-pocket,
        .aido-envelope-pocket-face,
        .aido-envelope-pocket-face::before,
        .aido-envelope-pocket-face::after,
        .aido-wax-seal,
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
        .aido-envelope-pocket {
          left: 50%;
          top: 50%;
          width: min(calc(100% - ${compact ? "20px" : "34px"}), ${compact ? "440px" : "490px"});
          aspect-ratio: .68;
          transform: translate(-50%, -50%);
          z-index: 4;
          pointer-events: none;
        }
        .aido-envelope-pocket-face {
          left: 0;
          right: 0;
          bottom: 0;
          height: 58%;
          filter: drop-shadow(0 -10px 18px rgba(0,0,0,.12));
          animation: aidoPocketRelease 980ms cubic-bezier(.28,.76,.18,1) 1320ms forwards;
        }
        .aido-envelope-pocket-face::before {
          content: "";
          inset: 0;
          clip-path: polygon(0 100%, 50% 0, 100% 100%);
          background:
            linear-gradient(180deg, rgba(255,255,255,.32), rgba(0,0,0,.12)),
            var(--invite-paper);
        }
        .aido-envelope-pocket-face::after {
          content: "";
          width: ${compact ? "58px" : "72px"};
          height: ${compact ? "58px" : "72px"};
          left: calc(50% - ${compact ? "29px" : "36px"});
          top: 4%;
          border-radius: 999px;
          background:
            radial-gradient(circle at 34% 28%, rgba(255,255,255,.4), transparent 18%),
            radial-gradient(circle at 50% 52%, var(--invite-accent), #8a6320 74%);
          box-shadow:
            0 12px 24px rgba(0,0,0,.28),
            inset 0 0 0 5px rgba(255,255,255,.14),
            inset 0 0 0 10px rgba(0,0,0,.1);
          opacity: .92;
          animation: aidoSealLift 980ms cubic-bezier(.2,.82,.18,1) 520ms forwards;
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
        .aido-invite-anim-animated-photo-peel .aido-envelope-flap {
          clip-path: polygon(0 0, 70% 0, 28% 100%, 0 100%);
          transform-origin: left center;
          animation-name: aidoPhotoPeel;
          animation-delay: 420ms;
        }
        .aido-invite-anim-animated-photo-peel .aido-invite-anim-card {
          animation-delay: 1320ms;
        }
        .aido-invite-anim-animated-photo-peel .aido-envelope-bottom {
          animation-delay: 1120ms;
        }
        .aido-invite-anim-animated-photo-peel .aido-envelope-pocket-face {
          animation-delay: 1520ms;
        }
        .aido-invite-anim-animated-photo-peel .aido-envelope-side.right {
          animation-delay: 980ms;
        }
        .aido-invite-anim-animated-seal-reveal .aido-wax-seal {
          animation-delay: 240ms;
        }
        .aido-invite-anim-animated-seal-reveal .aido-invite-anim-card {
          animation-delay: 1580ms;
        }
        .aido-invite-anim-animated-seal-reveal .aido-envelope-side.left,
        .aido-invite-anim-animated-seal-reveal .aido-envelope-side.right,
        .aido-invite-anim-animated-seal-reveal .aido-envelope-bottom,
        .aido-invite-anim-animated-seal-reveal .aido-envelope-flap {
          animation-delay: 1020ms;
        }
        .aido-invite-anim-animated-seal-reveal .aido-envelope-pocket-face {
          animation-delay: 1760ms;
        }
        .aido-invite-anim-animated-owl-delivery {
          background:
            radial-gradient(circle at 72% 14%, rgba(255,255,255,.56) 0 3%, transparent 4%),
            radial-gradient(circle at 46% 34%, rgba(114,129,255,.42), transparent 32%),
            radial-gradient(circle at 18% 12%, rgba(255,255,255,.2), transparent 26%),
            linear-gradient(150deg, #10162b 0%, #1f2f72 48%, #6b5b8f 100%);
        }
        .aido-invite-anim-animated-owl-delivery .aido-invite-anim-card {
          animation-delay: 2520ms;
        }
        .aido-invite-anim-animated-owl-delivery .aido-envelope-layer {
          opacity: 0;
          transform: translate(-50%, -86%) scale(.46) rotate(-3deg);
          animation:
            aidoOwlEnvelopeDrop 820ms cubic-bezier(.17,.78,.18,1) 1160ms forwards,
            aidoLayerGone 1ms linear 4300ms forwards;
        }
        .aido-invite-anim-animated-owl-delivery .aido-envelope-flap {
          animation-delay: 2100ms;
        }
        .aido-invite-anim-animated-owl-delivery .aido-wax-seal {
          animation-delay: 2180ms;
        }
        .aido-invite-anim-animated-owl-delivery .aido-envelope-side.left {
          animation-delay: 2580ms;
        }
        .aido-invite-anim-animated-owl-delivery .aido-envelope-side.right {
          animation-delay: 2630ms;
        }
        .aido-invite-anim-animated-owl-delivery .aido-envelope-bottom {
          animation-delay: 2750ms;
        }
        .aido-invite-anim-animated-owl-delivery .aido-envelope-pocket {
          opacity: 0;
          transform: translate(-50%, -82%) scale(.48) rotate(-3deg);
          animation: aidoOwlEnvelopeDrop 820ms cubic-bezier(.17,.78,.18,1) 1160ms forwards;
        }
        .aido-invite-anim-animated-owl-delivery .aido-envelope-pocket-face {
          animation-delay: 2750ms;
        }
        .aido-invite-anim-animated-owl-delivery .aido-envelope-pocket-face::after {
          animation-delay: 2180ms;
        }
        .aido-owl-delivery {
          left: 50%;
          top: 6%;
          z-index: 7;
          width: ${compact ? "268px" : "340px"};
          height: ${compact ? "154px" : "196px"};
          transform-origin: 50% 42%;
          filter: drop-shadow(0 22px 28px rgba(0,0,0,.34));
          animation: aidoOwlFlyToward 1960ms cubic-bezier(.18,.72,.16,1) 120ms both;
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
          animation: aidoOwlTrail 960ms ease-out 120ms both;
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
          animation: aidoOwlWingToward 340ms ease-in-out infinite alternate;
        }
        .aido-owl-wing-svg.right {
          transform-origin: 12% 58%;
          animation-name: aidoOwlWingTowardRight;
        }
        .aido-owl-envelope-svg {
          transform-box: fill-box;
          transform-origin: 50% 50%;
          animation: aidoOwlTinyEnvelopeDrop 700ms cubic-bezier(.28,.68,.28,1) 1040ms forwards;
        }
        @keyframes aidoInviteCardIn {
          0% { opacity: 0; transform: translateY(34%) scale(.84); filter: blur(3px); }
          18% { opacity: .72; }
          56% { opacity: .92; transform: translateY(8%) scale(.97); filter: blur(.7px); }
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
        @keyframes aidoPocketRelease {
          0% { transform: translateY(0); opacity: 1; }
          78% { opacity: 1; }
          100% { transform: translateY(82%) scale(.98); opacity: 0; }
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
        @keyframes aidoOwlFlyToward {
          0% {
            opacity: 0;
            transform: translate(-50%, -42px) scale(.18) rotate(-2deg);
            filter: blur(1.6px) drop-shadow(0 8px 10px rgba(0,0,0,.18));
          }
          16% {
            opacity: 1;
          }
          48% {
            opacity: 1;
            transform: translate(-50%, 42px) scale(.56) rotate(.5deg);
            filter: blur(.4px) drop-shadow(0 18px 22px rgba(0,0,0,.28));
          }
          72% {
            opacity: 1;
            transform: translate(-50%, 76px) scale(1.05) rotate(0deg);
            filter: blur(0) drop-shadow(0 28px 34px rgba(0,0,0,.38));
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -4px) scale(1.34) rotate(1.5deg);
            filter: blur(1px) drop-shadow(0 38px 42px rgba(0,0,0,.28));
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
          0% { opacity: 1; transform: translateY(0) scale(1) rotate(0); }
          62% { opacity: 1; transform: translateY(84px) scale(1.22) rotate(4deg); }
          100% { opacity: 0; transform: translateY(116px) scale(1.42) rotate(7deg); }
        }
        @keyframes aidoOwlEnvelopeDrop {
          0% { opacity: 0; transform: translate(-50%, -82%) scale(.48) rotate(-3deg); }
          15% { opacity: 1; }
          70% { opacity: 1; transform: translate(-50%, -45%) scale(.78) rotate(1deg); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0); }
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
          .aido-invite-anim-card, .aido-envelope-layer, .aido-envelope-flap,
          .aido-envelope-side, .aido-envelope-bottom, .aido-envelope-pocket,
          .aido-envelope-pocket-face, .aido-envelope-pocket-face::after, .aido-wax-seal,
          .aido-owl-delivery, .aido-owl-wing-svg, .aido-owl-envelope-svg {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>
      <div key={`card-${replay}`} className="aido-invite-anim-card">
        {children}
      </div>
      <div key={`pocket-${replay}`} className="aido-envelope-pocket" aria-hidden="true">
        <div className="aido-envelope-pocket-face" />
      </div>
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
            </defs>
            <path
              className="aido-owl-wing-svg left"
              d="M165 83 C122 32 61 24 8 68 C48 70 77 82 104 102 C75 102 43 114 19 134 C80 132 128 120 165 94 Z"
              fill={`url(#owl-feather-${svgIdSeed})`}
              stroke="#d8d0bd"
              strokeWidth="2"
            />
            <path
              className="aido-owl-wing-svg right"
              d="M175 83 C218 32 279 24 332 68 C292 70 263 82 236 102 C265 102 297 114 321 134 C260 132 212 120 175 94 Z"
              fill={`url(#owl-feather-${svgIdSeed})`}
              stroke="#d8d0bd"
              strokeWidth="2"
            />
            {[28, 48, 68, 88, 108, 128].map((x) => (
              <path
                key={`left-feather-${x}`}
                d={`M${x} 70 C${x + 30} 76 ${x + 55} 88 165 90`}
                fill="none"
                stroke="#c8beaa"
                strokeWidth="1.4"
                opacity="0.62"
              />
            ))}
            {[312, 292, 272, 252, 232, 212].map((x) => (
              <path
                key={`right-feather-${x}`}
                d={`M${x} 70 C${x - 30} 76 ${x - 55} 88 175 90`}
                fill="none"
                stroke="#c8beaa"
                strokeWidth="1.4"
                opacity="0.62"
              />
            ))}
            <ellipse cx="170" cy="104" rx="44" ry="58" fill={`url(#owl-shadow-${svgIdSeed})`} stroke="#d8d0bd" strokeWidth="2" />
            <path
              d="M140 70 C145 40 160 31 170 49 C180 31 195 40 200 70 C192 60 181 58 170 65 C159 58 148 60 140 70 Z"
              fill="#fffdf5"
              stroke="#d8d0bd"
              strokeWidth="2"
            />
            <circle cx="154" cy="78" r="13" fill="#f3cf59" stroke="#7c5c19" strokeWidth="2" />
            <circle cx="186" cy="78" r="13" fill="#f3cf59" stroke="#7c5c19" strokeWidth="2" />
            <circle cx="154" cy="78" r="5" fill="#17131b" />
            <circle cx="186" cy="78" r="5" fill="#17131b" />
            <path d="M170 88 L161 100 H179 Z" fill="#4d3624" />
            <path d="M145 116 C156 126 184 126 195 116" fill="none" stroke="#b4a68d" strokeWidth="2" opacity="0.7" />
            <path d="M151 134 C160 144 180 144 189 134" fill="none" stroke="#b4a68d" strokeWidth="2" opacity="0.5" />
            <path d="M151 157 C156 166 162 166 166 157" fill="none" stroke="#7b6040" strokeWidth="3" strokeLinecap="round" />
            <path d="M174 157 C178 166 184 166 189 157" fill="none" stroke="#7b6040" strokeWidth="3" strokeLinecap="round" />
            <g className="aido-owl-envelope-svg">
              <rect x="126" y="154" width="88" height="26" rx="3" fill={paper} stroke="#a8946d" strokeWidth="2" />
              <path d="M126 154 L170 172 L214 154" fill="none" stroke="#9e8a66" strokeWidth="2" />
              <path d="M126 180 L159 164 M214 180 L181 164" fill="none" stroke="#9e8a66" strokeWidth="1.6" />
              <circle cx="170" cy="166" r="6" fill={accent} opacity="0.92" />
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
