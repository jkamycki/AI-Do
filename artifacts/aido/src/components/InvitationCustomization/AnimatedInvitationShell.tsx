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
}: {
  layout?: string | null;
  accent?: string;
  paper?: string;
  darkPanel?: string;
  children: ReactNode;
  compact?: boolean;
}) {
  if (!isAnimatedLayout(layout)) return <>{children}</>;

  const seed = layout.replace(/[^a-z0-9-]/gi, "");
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
          display: flex;
          justify-content: center;
          overflow: hidden;
          border-radius: 22px;
          padding: ${compact ? "10px" : "18px 10px"};
          isolation: isolate;
        }
        .aido-invite-anim-card {
          width: 100%;
          position: relative;
          z-index: 1;
          animation: aidoInviteCardIn 1200ms cubic-bezier(.2,.7,.2,1) 520ms both;
        }
        .aido-envelope-layer {
          position: absolute;
          inset: ${compact ? "8px" : "16px"};
          z-index: 3;
          pointer-events: none;
          border-radius: 20px;
          overflow: hidden;
          animation: aidoLayerGone 1ms linear 1550ms forwards;
        }
        .aido-envelope-flap,
        .aido-envelope-panel,
        .aido-envelope-side,
        .aido-wax-seal {
          position: absolute;
          pointer-events: none;
        }
        .aido-envelope-panel {
          inset: 0;
          background:
            linear-gradient(135deg, rgba(255,255,255,.2), transparent 28%),
            radial-gradient(circle at 30% 24%, rgba(255,255,255,.22), transparent 28%),
            var(--invite-paper);
        }
        .aido-envelope-flap {
          inset: 0;
          background: linear-gradient(140deg, transparent 50%, rgba(0,0,0,.18) 50.4%), var(--invite-paper);
          clip-path: polygon(0 0, 100% 0, 50% 58%);
          transform-origin: top center;
          animation: aidoFlapOpen 1250ms cubic-bezier(.2,.72,.12,1) 220ms forwards;
        }
        .aido-envelope-side.left {
          left: 0; top: 0; bottom: 0; width: 56%;
          background: linear-gradient(45deg, var(--invite-paper) 0 49%, rgba(0,0,0,.12) 50%, transparent 51%);
          clip-path: polygon(0 0, 100% 50%, 0 100%);
          animation: aidoPanelLeft 1100ms cubic-bezier(.3,.7,.2,1) 480ms forwards;
        }
        .aido-envelope-side.right {
          right: 0; top: 0; bottom: 0; width: 56%;
          background: var(--invite-dark);
          clip-path: polygon(100% 0, 0 50%, 100% 100%);
          animation: aidoPanelRight 1100ms cubic-bezier(.3,.7,.2,1) 520ms forwards;
        }
        .aido-wax-seal {
          width: 86px; height: 86px; border-radius: 999px;
          left: calc(50% - 43px); top: calc(50% - 43px);
          background:
            radial-gradient(circle at 35% 28%, rgba(255,255,255,.35), transparent 20%),
            radial-gradient(circle, var(--invite-accent), #8a6320 75%);
          box-shadow: 0 12px 28px rgba(0,0,0,.35), inset 0 0 0 6px rgba(255,255,255,.14), inset 0 0 0 11px rgba(0,0,0,.1);
          animation: aidoSealLift 950ms cubic-bezier(.22,.8,.2,1) 430ms forwards;
        }
        .aido-wax-seal::after {
          content: "∞";
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          color: rgba(255,255,255,.72);
          font-family: Georgia, serif; font-size: 34px;
        }
        .aido-invite-anim-animated-photo-peel .aido-envelope-flap {
          clip-path: polygon(0 0, 70% 0, 24% 100%, 0 100%);
          transform-origin: left center;
          animation-name: aidoPhotoPeel;
        }
        .aido-invite-anim-animated-photo-peel .aido-envelope-side.right {
          animation-delay: 680ms;
        }
        .aido-invite-anim-animated-seal-reveal .aido-envelope-side.left,
        .aido-invite-anim-animated-seal-reveal .aido-envelope-side.right,
        .aido-invite-anim-animated-seal-reveal .aido-envelope-flap {
          animation-delay: 720ms;
        }
        @keyframes aidoInviteCardIn {
          from { opacity: .2; transform: translateY(16px) scale(.985); filter: blur(1px); }
          to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes aidoLayerGone { to { visibility: hidden; } }
        @keyframes aidoFlapOpen {
          0% { transform: perspective(900px) rotateX(0deg); opacity: 1; }
          70% { transform: perspective(900px) rotateX(128deg); opacity: .95; }
          100% { transform: perspective(900px) rotateX(148deg); opacity: 0; }
        }
        @keyframes aidoPanelLeft {
          to { transform: translateX(-78%) rotate(-5deg); opacity: 0; }
        }
        @keyframes aidoPanelRight {
          to { transform: translateX(82%) rotate(5deg); opacity: 0; }
        }
        @keyframes aidoSealLift {
          0% { transform: scale(1); opacity: 1; }
          45% { transform: scale(1.08); opacity: 1; }
          100% { transform: translateY(-42px) scale(.72); opacity: 0; }
        }
        @keyframes aidoPhotoPeel {
          to { transform: translateX(-80%) rotate(-8deg); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .aido-invite-anim-card, .aido-envelope-layer, .aido-envelope-flap,
          .aido-envelope-side, .aido-wax-seal { animation-duration: 1ms !important; animation-delay: 0ms !important; }
        }
      `}</style>
      <div className="aido-invite-anim-card">{children}</div>
      <div className="aido-envelope-layer" aria-hidden="true">
        <div className="aido-envelope-panel" />
        <div className="aido-envelope-flap" />
        <div className="aido-envelope-side left" />
        <div className="aido-envelope-side right" />
        <div className="aido-wax-seal" />
      </div>
    </div>
  );
}
