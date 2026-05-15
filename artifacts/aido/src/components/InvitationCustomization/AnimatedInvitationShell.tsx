import type { CSSProperties, ReactNode } from "react";

export type InvitationAnimationLayout =
  | "classic"
  | "animated-envelope"
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
    id: "animated-owl-delivery",
    name: "Owl Delivery",
    description: "A night-flight delivery drops the envelope before it opens.",
  },
];

function isAnimatedLayout(layout?: string | null): layout is InvitationAnimationLayout {
  return layout === "animated-envelope" || layout === "animated-owl-delivery";
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
          display: flex;
          align-items: center;
          justify-content: center;
          transform-origin: 50% 58%;
          animation: aidoInviteCardIn 1260ms cubic-bezier(.2,.84,.18,1) 1080ms both;
        }
        .aido-invite-anim-card > * {
          flex: 0 1 auto;
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
            0 34px 80px rgba(11, 9, 18, .38),
            inset 0 1px 0 rgba(255,255,255,.18),
            inset 0 -22px 46px rgba(0,0,0,.16);
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
            linear-gradient(135deg, rgba(255,255,255,.22), transparent 30%),
            linear-gradient(45deg, rgba(0,0,0,.24), transparent 49%),
            radial-gradient(circle at 30% 24%, rgba(255,255,255,.16), transparent 28%),
            repeating-linear-gradient(100deg, rgba(255,255,255,.06) 0 1px, transparent 1px 9px),
            repeating-linear-gradient(12deg, rgba(0,0,0,.035) 0 1px, transparent 1px 7px),
            var(--invite-paper);
        }
        .aido-envelope-panel::after {
          content: "";
          position: absolute;
          inset: 0;
          opacity: .26;
          background-image:
            linear-gradient(120deg, rgba(255,255,255,.14) 0 1px, transparent 1px 18px),
            radial-gradient(circle at 20% 30%, rgba(0,0,0,.18) 0 1px, transparent 1.4px);
          background-size: 24px 24px, 34px 34px;
        }
        .aido-envelope-bottom {
          left: 0;
          right: 0;
          bottom: 0;
          height: 52%;
          z-index: 1;
          clip-path: polygon(0 100%, 50% 0, 100% 100%);
          background:
            linear-gradient(180deg, rgba(255,255,255,.16), rgba(0,0,0,.18)),
            linear-gradient(36deg, transparent 49.4%, rgba(255,255,255,.14) 49.8%, rgba(0,0,0,.18) 50.8%, transparent 51.2%),
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
          filter: drop-shadow(0 -12px 22px rgba(0,0,0,.22));
          animation: aidoPocketRelease 980ms cubic-bezier(.28,.76,.18,1) 1320ms forwards;
        }
        .aido-envelope-pocket-face::before {
          content: "";
          inset: 0;
          clip-path: polygon(0 100%, 50% 0, 100% 100%);
          background:
            linear-gradient(180deg, rgba(255,255,255,.2), rgba(0,0,0,.2)),
            linear-gradient(36deg, transparent 49.3%, rgba(255,255,255,.18) 49.7%, rgba(0,0,0,.2) 50.7%, transparent 51.2%),
            repeating-linear-gradient(108deg, rgba(255,255,255,.055) 0 1px, transparent 1px 10px),
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
            radial-gradient(circle at 34% 26%, rgba(255,255,255,.5), transparent 17%),
            radial-gradient(circle at 50% 52%, #e4bd54, #a67825 68%, #785016 100%);
          box-shadow:
            0 14px 28px rgba(0,0,0,.34),
            inset 0 0 0 4px rgba(255,255,255,.16),
            inset 0 0 0 8px rgba(83,54,13,.22),
            inset 0 -10px 16px rgba(79,50,10,.2);
          opacity: .92;
          animation: aidoSealLift 980ms cubic-bezier(.2,.82,.18,1) 520ms forwards;
        }
        .aido-envelope-monogram {
          width: ${compact ? "64px" : "80px"};
          height: ${compact ? "64px" : "80px"};
          left: calc(50% - ${compact ? "32px" : "40px"});
          top: 4%;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255,255,255,.82);
          font-family: Georgia, 'Times New Roman', serif;
          font-size: ${compact ? "18px" : "22px"};
          font-weight: 700;
          letter-spacing: .08em;
          text-shadow: 0 1px 2px rgba(0,0,0,.28);
          animation: aidoSealLift 980ms cubic-bezier(.2,.82,.18,1) 520ms forwards;
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
            linear-gradient(160deg, rgba(255,255,255,.18), transparent 42%),
            linear-gradient(140deg, transparent 49.6%, rgba(255,255,255,.16) 49.9%, rgba(0,0,0,.24) 50.8%, transparent 51.2%),
            repeating-linear-gradient(105deg, rgba(255,255,255,.055) 0 1px, transparent 1px 10px),
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
            linear-gradient(40deg, rgba(255,255,255,.18) 0 49%, rgba(0,0,0,.22) 50%, transparent 51%),
            repeating-linear-gradient(100deg, rgba(255,255,255,.045) 0 1px, transparent 1px 10px),
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
            linear-gradient(145deg, rgba(255,255,255,.12), transparent 42%),
            linear-gradient(38deg, transparent 49.5%, rgba(255,255,255,.08) 50%, rgba(0,0,0,.24) 51%, transparent 51.4%),
            repeating-linear-gradient(100deg, rgba(255,255,255,.035) 0 1px, transparent 1px 10px),
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
          animation: aidoOwlInviteCardIn 1450ms cubic-bezier(.2,.84,.18,1) 2700ms both;
        }
        .aido-invite-anim-animated-owl-delivery .aido-envelope-layer {
          opacity: 0;
          width: min(calc(100% - ${compact ? "72px" : "100px"}), ${compact ? "390px" : "460px"});
          aspect-ratio: 1.55;
          transform: translate(-50%, -86%) scale(.46) rotate(-16deg);
          animation:
            aidoOwlEnvelopeDrop 1020ms cubic-bezier(.17,.78,.18,1) 1160ms forwards,
            aidoLayerGone 1ms linear 4300ms forwards;
        }
        .aido-invite-anim-animated-owl-delivery .aido-envelope-flap {
          animation-delay: 2320ms;
        }
        .aido-invite-anim-animated-owl-delivery .aido-wax-seal {
          animation-delay: 2340ms;
        }
        .aido-invite-anim-animated-owl-delivery .aido-envelope-side.left {
          animation-delay: 2920ms;
        }
        .aido-invite-anim-animated-owl-delivery .aido-envelope-side.right {
          animation-delay: 2970ms;
        }
        .aido-invite-anim-animated-owl-delivery .aido-envelope-bottom {
          animation-delay: 3080ms;
        }
        .aido-invite-anim-animated-owl-delivery .aido-envelope-pocket {
          opacity: 0;
          width: min(calc(100% - ${compact ? "72px" : "100px"}), ${compact ? "390px" : "460px"});
          aspect-ratio: 1.55;
          transform: translate(-50%, -82%) scale(.48) rotate(-16deg);
          animation: aidoOwlEnvelopeDrop 1020ms cubic-bezier(.17,.78,.18,1) 1160ms forwards;
        }
        .aido-invite-anim-animated-owl-delivery .aido-envelope-pocket-face {
          animation-delay: 3080ms;
        }
        .aido-invite-anim-animated-owl-delivery .aido-envelope-pocket-face::after {
          animation-delay: 2340ms;
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
          0% { opacity: 0; transform: translate(-50%, -82%) scale(.48) rotate(-16deg); }
          15% { opacity: 1; }
          54% { opacity: 1; transform: translate(-50%, -42%) scale(.78) rotate(12deg); }
          82% { opacity: 1; transform: translate(-50%, -50%) scale(.96) rotate(-2deg); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); }
        }
        @keyframes aidoOwlInviteCardIn {
          0% { opacity: 0; transform: translateY(18%) scale(.56) rotate(90deg); filter: blur(2px); }
          20% { opacity: .78; transform: translateY(8%) scale(.66) rotate(90deg); filter: blur(.8px); }
          48% { opacity: .95; transform: translateY(-2%) scale(.8) rotate(90deg); filter: blur(0); }
          72% { opacity: 1; transform: translateY(-1%) scale(.92) rotate(28deg); }
          100% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); filter: blur(0); }
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
              <text
                x="170"
                y="169"
                textAnchor="middle"
                fontFamily="Georgia, serif"
                fontSize="6"
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
