import type { ColorPalette } from "@/types/invitations";

export const LAYOUT_DESIGNS = [
  { id: "classic",   name: "Classic",   desc: "Clean & elegant" },
  { id: "floral",    name: "Floral",    desc: "Corner bouquets" },
  { id: "botanical", name: "Botanical", desc: "Eucalyptus sprigs" },
  { id: "arch",      name: "Arch",      desc: "Romantic arch frame" },
  { id: "geometric", name: "Geometric", desc: "Corner brackets" },
  { id: "romantic",  name: "Romantic",  desc: "Hearts & stars" },
  { id: "vintage",   name: "Vintage",   desc: "Ornate flourishes" },
  { id: "modern",    name: "Modern",    desc: "Bold side accent" },
];

interface DecProps {
  w: number;
  h: number;
  colors: ColorPalette;
}

// ── Reusable primitives ────────────────────────────────────────────────────

function Bloom({ cx, cy, r, fill, op = 0.55 }: { cx: number; cy: number; r: number; fill: string; op?: number }) {
  return (
    <g>
      {[0, 72, 144, 216, 288].map((a) => {
        const rad = (a * Math.PI) / 180;
        const px = cx + r * 0.54 * Math.sin(rad);
        const py = cy - r * 0.54 * Math.cos(rad);
        return (
          <ellipse key={a} cx={px} cy={py} rx={r * 0.33} ry={r * 0.5}
            fill={fill} opacity={op} transform={`rotate(${a},${px},${py})`} />
        );
      })}
      <circle cx={cx} cy={cy} r={r * 0.22} fill={fill} opacity={Math.min(1, op + 0.25)} />
    </g>
  );
}

function Leaf({ cx, cy, rx, ry, angle, fill, op = 0.5 }: {
  cx: number; cy: number; rx: number; ry: number; angle: number; fill: string; op?: number;
}) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={fill} opacity={op}
    transform={`rotate(${angle},${cx},${cy})`} />;
}

// ── Decoration: Floral ─────────────────────────────────────────────────────

function FloralDec({ w, h, colors }: DecProps) {
  const p = colors.primary;
  const leaf = "#5c8a45";
  const Corner = ({ flip }: { flip?: boolean }) => (
    <g transform={flip ? `translate(${w},${h}) rotate(180)` : undefined}>
      <Bloom cx={44} cy={44} r={32} fill={p} op={0.52} />
      <Bloom cx={82} cy={20} r={21} fill={p} op={0.42} />
      <Bloom cx={18} cy={80} r={17} fill={p} op={0.36} />
      <Leaf cx={84} cy={58} rx={6} ry={20} angle={-32} fill={leaf} />
      <Leaf cx={58} cy={86} rx={6} ry={20} angle={-68} fill={leaf} />
      <Leaf cx={7}  cy={46} rx={5} ry={14} angle={-15} fill={leaf} op={0.42} />
      <Leaf cx={96} cy={38} rx={4} ry={12} angle={-55} fill={leaf} op={0.38} />
      <Leaf cx={33} cy={100} rx={4} ry={12} angle={-78} fill={leaf} op={0.38} />
    </g>
  );
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <Corner />
      <Corner flip />
    </svg>
  );
}

// ── Decoration: Botanical ──────────────────────────────────────────────────

function BotanicalDec({ w, h, colors }: DecProps) {
  const stem = "#5c8a45";
  const leaf = "#7aaa60";
  // Each branch segment: [ [cx,cy,rx,ry,angle], ... ]
  const topLeftLeaves = [
    [18, 55, 5, 15, -20],
    [35, 38, 5, 15, -45],
    [52, 22, 5, 15, -65],
    [28, 68, 6, 16, -10],
    [8,  72, 5, 13, 5],
    [62, 12, 4, 11, -80],
  ] as [number, number, number, number, number][];

  const CornerBranch = ({ flip }: { flip?: boolean }) => (
    <g transform={flip ? `translate(${w},${h}) rotate(180)` : undefined}>
      {/* Main curved branch */}
      <path d="M -5,95 C 20,70 55,40 95,-5"
        stroke={stem} strokeWidth="2.2" fill="none" opacity="0.65" strokeLinecap="round" />
      {/* Second thinner branch */}
      <path d="M -5,60 C 15,45 35,25 60,-5"
        stroke={stem} strokeWidth="1.4" fill="none" opacity="0.45" strokeLinecap="round" />
      {topLeftLeaves.map(([cx, cy, rx, ry, angle], i) => (
        <Leaf key={i} cx={cx} cy={cy} rx={rx} ry={ry} angle={angle} fill={leaf} op={0.55} />
      ))}
      {/* Small berry dots */}
      <circle cx={12} cy={30} r={3.5} fill={stem} opacity={0.4} />
      <circle cx={25} cy={20} r={2.5} fill={stem} opacity={0.35} />
      <circle cx={5}  cy={22} r={2.5} fill={stem} opacity={0.35} />
    </g>
  );
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <CornerBranch />
      <CornerBranch flip />
    </svg>
  );
}

// ── Decoration: Arch ───────────────────────────────────────────────────────

function ArchDec({ w, h, colors }: DecProps) {
  const p = colors.primary;
  const m = 28;
  // Arch path: two side pillars rising to a round arch at top
  const archPath = `M ${m},${h - 20} L ${m},${h * 0.38} Q ${m},${m} ${w / 2},${m} Q ${w - m},${m} ${w - m},${h * 0.38} L ${w - m},${h - 20}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <path d={archPath} stroke={p} strokeWidth="1.8" fill="none" opacity="0.28" />
      {/* Inner thin arch - slight inset */}
      <path d={`M ${m + 10},${h - 20} L ${m + 10},${h * 0.38 + 8} Q ${m + 10},${m + 10} ${w / 2},${m + 10} Q ${w - m - 10},${m + 10} ${w - m - 10},${h * 0.38 + 8} L ${w - m - 10},${h - 20}`}
        stroke={p} strokeWidth="0.8" fill="none" opacity="0.15" />
      {/* Corner rosettes */}
      {([
        [m, h * 0.38], [w - m, h * 0.38]
      ] as [number, number][]).map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={6} fill={p} opacity={0.25} />
          <circle cx={x} cy={y} r={3} fill={p} opacity={0.45} />
        </g>
      ))}
      {/* Bottom horizontal rule */}
      <line x1={m} y1={h - 20} x2={w - m} y2={h - 20} stroke={p} strokeWidth="1" opacity="0.2" />
    </svg>
  );
}

// ── Decoration: Geometric ──────────────────────────────────────────────────

function GeometricDec({ w, h, colors }: DecProps) {
  const p = colors.primary;
  const s = 55; // bracket size
  const m = 18; // margin
  const sw = 1.8;
  const op = 0.45;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {/* TL */}
      <path d={`M ${m},${m + s} L ${m},${m} L ${m + s},${m}`}
        stroke={p} strokeWidth={sw} fill="none" opacity={op} strokeLinecap="square" />
      {/* TR */}
      <path d={`M ${w - m - s},${m} L ${w - m},${m} L ${w - m},${m + s}`}
        stroke={p} strokeWidth={sw} fill="none" opacity={op} strokeLinecap="square" />
      {/* BL */}
      <path d={`M ${m},${h - m - s} L ${m},${h - m} L ${m + s},${h - m}`}
        stroke={p} strokeWidth={sw} fill="none" opacity={op} strokeLinecap="square" />
      {/* BR */}
      <path d={`M ${w - m - s},${h - m} L ${w - m},${h - m} L ${w - m},${h - m - s}`}
        stroke={p} strokeWidth={sw} fill="none" opacity={op} strokeLinecap="square" />
      {/* Center diamond */}
      <polygon points={`${w / 2},${h / 2 - 12} ${w / 2 + 10},${h / 2} ${w / 2},${h / 2 + 12} ${w / 2 - 10},${h / 2}`}
        fill={p} opacity={0.2} />
      <polygon points={`${w / 2},${h / 2 - 6} ${w / 2 + 5},${h / 2} ${w / 2},${h / 2 + 6} ${w / 2 - 5},${h / 2}`}
        fill={p} opacity={0.38} />
      {/* Thin inner border (slightly inset) */}
      <rect x={m + 10} y={m + 10} width={w - (m + 10) * 2} height={h - (m + 10) * 2}
        stroke={p} strokeWidth={0.6} fill="none" opacity={0.12} />
    </svg>
  );
}

// ── Decoration: Romantic ───────────────────────────────────────────────────

const HEART_PATH = "M 0,-9 C -4.5,-13 -10,-9 -10,-4 C -10,1 0,10 0,10 C 0,10 10,1 10,-4 C 10,-9 4.5,-13 0,-9 Z";

function RomanticDec({ w, h, colors }: DecProps) {
  const p = colors.primary;
  const acc = colors.accent;
  const hearts: [number, number, number, number][] = [
    // [x, y, scale, opacity]
    [30, 30, 1.1, 0.5],   [w - 30, 30, 1.0, 0.45],
    [30, h - 30, 1.0, 0.45], [w - 30, h - 30, 1.1, 0.5],
    [w / 2, 22, 0.85, 0.35],  [22, h / 2, 0.75, 0.3],
    [w - 22, h / 2, 0.75, 0.3],
    [70, 55, 0.7, 0.28],  [w - 70, 55, 0.7, 0.28],
    [55, h - 70, 0.65, 0.25], [w - 55, h - 70, 0.65, 0.25],
  ];
  const dots: [number, number, number][] = [
    [w / 2 - 60, 18, 3], [w / 2 + 60, 18, 3],
    [w / 2 - 30, 14, 2], [w / 2 + 30, 14, 2],
    [w / 2, 12, 2.5],
    [14, h / 3, 2.5], [w - 14, h / 3, 2.5],
    [14, (h * 2) / 3, 2.5], [w - 14, (h * 2) / 3, 2.5],
  ];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {hearts.map(([x, y, s, op], i) => (
        <path key={i} d={HEART_PATH} fill={p} opacity={op}
          transform={`translate(${x},${y}) scale(${s})`} />
      ))}
      {dots.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={acc} opacity={0.38} />
      ))}
      {/* Top center dot garland */}
      <path d={`M ${w / 2 - 80},28 Q ${w / 2},18 ${w / 2 + 80},28`}
        stroke={p} strokeWidth="0.8" fill="none" opacity="0.2" strokeDasharray="3 5" />
    </svg>
  );
}

// ── Decoration: Vintage ────────────────────────────────────────────────────

function VintageDec({ w, h, colors }: DecProps) {
  const p = colors.primary;
  // Corner flourish: S-curve swirl
  const Flourish = ({ flip, flipV }: { flip?: boolean; flipV?: boolean }) => {
    const sx = flip ? -1 : 1;
    const sy = flipV ? -1 : 1;
    const tx = flip ? w : 0;
    const ty = flipV ? h : 0;
    return (
      <g transform={`translate(${tx},${ty}) scale(${sx},${sy})`}>
        {/* Main scroll */}
        <path d="M 15,15 C 15,50 55,10 55,50 C 55,85 25,70 35,95"
          stroke={p} strokeWidth="1.8" fill="none" opacity="0.55"
          strokeLinecap="round" strokeLinejoin="round" />
        {/* Secondary scroll */}
        <path d="M 15,15 C 45,15 35,48 55,50"
          stroke={p} strokeWidth="1.2" fill="none" opacity="0.35"
          strokeLinecap="round" />
        {/* Dot accents */}
        <circle cx="35" cy="95" r="3.5" fill={p} opacity="0.45" />
        <circle cx="15" cy="15" r="4"   fill={p} opacity="0.55" />
        <circle cx="55" cy="50" r="3"   fill={p} opacity="0.4" />
        {/* Small flourish petal at corner */}
        <path d="M 15,15 C 8,25 20,30 18,20 Z" fill={p} opacity="0.4" />
      </g>
    );
  };
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <Flourish />
      <Flourish flip />
      <Flourish flipV />
      <Flourish flip flipV />
      {/* Center ornament */}
      <g transform={`translate(${w / 2}, ${h / 2})`}>
        <path d="M -40,0 C -25,-12 -12,-5 0,0 C 12,-5 25,-12 40,0" stroke={p} strokeWidth="1.2" fill="none" opacity="0.35" />
        <path d="M -40,0 C -25,12 -12,5 0,0 C 12,5 25,12 40,0"    stroke={p} strokeWidth="1.2" fill="none" opacity="0.35" />
        <circle cx="0" cy="0" r="3.5" fill={p} opacity="0.45" />
        <circle cx="-40" cy="0" r="2.5" fill={p} opacity="0.35" />
        <circle cx="40" cy="0" r="2.5" fill={p} opacity="0.35" />
      </g>
    </svg>
  );
}

// ── Decoration: Modern ─────────────────────────────────────────────────────

function ModernDec({ w, h, colors }: DecProps) {
  const p = colors.primary;
  const a = colors.accent;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {/* Left accent bar */}
      <rect x="0" y="0" width="7" height={h} fill={p} opacity="0.75" />
      {/* Top rule */}
      <rect x="7" y="0" width={w - 7} height="3" fill={p} opacity="0.5" />
      {/* Bottom rule */}
      <rect x="7" y={h - 3} width={w - 7} height="3" fill={p} opacity="0.5" />
      {/* Secondary thin line inset from top */}
      <line x1="7" y1="12" x2={w} y2="12" stroke={a} strokeWidth="0.8" opacity="0.28" />
      {/* Secondary thin line inset from bottom */}
      <line x1="7" y1={h - 12} x2={w} y2={h - 12} stroke={a} strokeWidth="0.8" opacity="0.28" />
      {/* Corner square accent at bottom of bar */}
      <rect x="0" y={h / 2 - 18} width="7" height="36" fill="white" opacity="0.2" />
    </svg>
  );
}

// ── Thumbnail wrapper (viewBox scales to fill card) ────────────────────────

export function LayoutThumbnail({ layout, colors }: { layout: string; colors: ColorPalette }) {
  const W = 500;
  const H = 680;
  const dec = getDecoration(layout, W, H, colors);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid slice">
      <rect width={W} height={H} fill="white" />
      {dec}
      {/* Representative content lines */}
      <text x={W / 2} y={H * 0.42} textAnchor="middle" fontFamily="Georgia,serif"
        fontSize="42" fill={colors.primary} opacity="0.18" fontWeight="bold">Save the Date</text>
      <text x={W / 2} y={H * 0.54} textAnchor="middle" fontFamily="Georgia,serif"
        fontSize="30" fill={colors.primary} opacity="0.13">Name &amp; Name</text>
      <line x1={W / 2 - 70} y1={H * 0.60} x2={W / 2 + 70} y2={H * 0.60}
        stroke={colors.accent} strokeWidth="1.5" opacity="0.2" />
      <text x={W / 2} y={H * 0.66} textAnchor="middle" fontFamily="Georgia,serif"
        fontSize="20" fill={colors.neutral} opacity="0.18">June 14 · 2025</text>
    </svg>
  );
}

// ── Internal router shared by full-size and thumbnail ─────────────────────

function getDecoration(layout: string, w: number, h: number, colors: ColorPalette) {
  switch (layout) {
    case "floral":    return <FloralDec    w={w} h={h} colors={colors} />;
    case "botanical": return <BotanicalDec w={w} h={h} colors={colors} />;
    case "arch":      return <ArchDec      w={w} h={h} colors={colors} />;
    case "geometric": return <GeometricDec w={w} h={h} colors={colors} />;
    case "romantic":  return <RomanticDec  w={w} h={h} colors={colors} />;
    case "vintage":   return <VintageDec   w={w} h={h} colors={colors} />;
    case "modern":    return <ModernDec    w={w} h={h} colors={colors} />;
    default:          return null;
  }
}

// ── Full-size overlay (used inside preview canvases) ───────────────────────

interface LayoutDecorationsProps {
  layout: string;
  colors: ColorPalette;
  canvasW: number;
  canvasH: number;
}

export function LayoutDecorations({ layout, colors, canvasW, canvasH }: LayoutDecorationsProps) {
  return getDecoration(layout, canvasW, canvasH, colors);
}
