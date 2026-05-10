import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn } from "lucide-react";
import { AuthMediaImage } from "@/components/AuthMediaImage";

interface Props {
  open: boolean;
  imageUrl: string | null;
  initialPosition: string | null;
  initialZoom: number | null;
  onCommit: (position: string, zoom: number) => void;
  onClose: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

function clampZoom(n: number): number {
  if (Number.isNaN(n)) return 1;
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, n));
}

// Parse "30% 70%" into {x, y}. Falls back to centered when missing/malformed.
function parsePosition(raw: string | null): { x: number; y: number } {
  if (!raw) return { x: 50, y: 50 };
  const m = raw.trim().match(/^(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!m) return { x: 50, y: 50 };
  const x = clamp(parseFloat(m[1]));
  const y = clamp(parseFloat(m[2]));
  return { x, y };
}

function clamp(n: number): number {
  if (Number.isNaN(n)) return 50;
  return Math.max(0, Math.min(100, n));
}

// The hero section uses min-h-[80vh] which is roughly 16:10 on a typical
// laptop. We render the picker at the same aspect ratio so the cropped
// preview matches what the visitor will see.
const PREVIEW_ASPECT = 16 / 10;

export function HeroPhotoPositionDialog({ open, imageUrl, initialPosition, initialZoom, onCommit, onClose }: Props) {
  const [pos, setPos] = useState(() => parsePosition(initialPosition));
  const [zoom, setZoom] = useState(() => clampZoom(initialZoom ?? 1));
  const frameRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  // Reset to the persisted position whenever the dialog re-opens for a
  // (potentially different) image — otherwise reopening leaves the marker
  // wherever the user dragged it last time.
  useEffect(() => {
    if (open) {
      setPos(parsePosition(initialPosition));
      setZoom(clampZoom(initialZoom ?? 1));
    }
  }, [open, initialPosition, initialZoom, imageUrl]);

  const moveFromEvent = (clientX: number, clientY: number) => {
    const el = frameRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = clamp(((clientX - r.left) / r.width) * 100);
    const y = clamp(((clientY - r.top) / r.height) * 100);
    setPos({ x, y });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    moveFromEvent(e.clientX, e.clientY);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    moveFromEvent(e.clientX, e.clientY);
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    draggingRef.current = false;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  const handleApply = () => {
    onCommit(`${Math.round(pos.x)}% ${Math.round(pos.y)}%`, zoom);
  };

  const handleReset = () => {
    setPos({ x: 50, y: 50 });
    setZoom(1);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Position photo in frame</DialogTitle>
          <DialogDescription>
            Drag the marker over the part of the photo that should stay centered when the home page crops to fit.
          </DialogDescription>
        </DialogHeader>

        <div
          ref={frameRef}
          className="relative w-full bg-black/90 rounded-lg overflow-hidden touch-none select-none cursor-crosshair"
          style={{ aspectRatio: `${PREVIEW_ASPECT}` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {imageUrl && (
            <AuthMediaImage
              src={imageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              style={{
                objectPosition: `${pos.x}% ${pos.y}%`,
                // Anchor the zoom at the user's chosen focal point so the
                // marker tracks the same pixel as we scale up.
                transformOrigin: `${pos.x}% ${pos.y}%`,
                transform: zoom === 1 ? undefined : `scale(${zoom})`,
              }}
            />
          )}
          {/* Crosshair marker */}
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="w-8 h-8 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,0.4)] bg-white/10" />
            <div className="absolute top-1/2 left-1/2 w-0.5 h-4 -translate-x-1/2 -translate-y-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]" />
            <div className="absolute top-1/2 left-1/2 w-4 h-0.5 -translate-x-1/2 -translate-y-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
          <Slider
            value={[zoom]}
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.05}
            onValueChange={(v) => setZoom(clampZoom(v[0] ?? 1))}
            className="flex-1"
          />
          <span className="text-[11px] text-muted-foreground w-10 text-right tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Tip: aim for faces or the most important detail, then zoom in to fill the frame. The home page background uses <code>cover</code> sizing, so areas outside the frame may be cropped on narrower screens.
        </p>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={handleReset}>Reset to center</Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleApply}>Save position</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
