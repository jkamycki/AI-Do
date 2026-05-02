import { useState, useCallback, useEffect, useRef } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2, RotateCcw, Square, Image as ImageIcon, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CropQueueItem {
  file: File;
  index: number;
  total: number;
}

interface Props {
  item: CropQueueItem | null;
  onComplete: (croppedFile: File) => void;
  onSkip: () => void;
  onCancelAll: () => void;
}

type AspectChoice = "free" | "square" | "wide";
const ASPECT_VALUE: Record<AspectChoice, number | undefined> = {
  free: undefined,
  square: 1,
  wide: 10 / 7,
};

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Could not read file"));
    r.readAsDataURL(file);
  });
}

async function getCroppedFile(
  src: string,
  area: Area,
  rotation: number,
  originalName: string,
): Promise<File> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });

  const rad = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const rotW = img.width * cos + img.height * sin;
  const rotH = img.width * sin + img.height * cos;

  const rotCanvas = document.createElement("canvas");
  rotCanvas.width = Math.round(rotW);
  rotCanvas.height = Math.round(rotH);
  const rotCtx = rotCanvas.getContext("2d");
  if (!rotCtx) throw new Error("Canvas unavailable");
  rotCtx.translate(rotW / 2, rotH / 2);
  rotCtx.rotate(rad);
  rotCtx.drawImage(img, -img.width / 2, -img.height / 2);

  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(area.width));
  out.height = Math.max(1, Math.round(area.height));
  const outCtx = out.getContext("2d");
  if (!outCtx) throw new Error("Canvas unavailable");
  outCtx.drawImage(
    rotCanvas,
    Math.round(area.x), Math.round(area.y),
    Math.round(area.width), Math.round(area.height),
    0, 0,
    out.width, out.height,
  );

  const blob: Blob = await new Promise((resolve, reject) => {
    out.toBlob(b => (b ? resolve(b) : reject(new Error("Blob failed"))), "image/jpeg", 0.92);
  });
  const baseName = originalName.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}-cropped.jpg`, { type: "image/jpeg" });
}

export function ImageCropDialog({ item, onComplete, onSkip, onCancelAll }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState<AspectChoice>("square");
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const lastFileRef = useRef<File | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!item) {
      setSrc(null);
      return;
    }
    setBusy(false);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setAspect("square");
    setCroppedAreaPixels(null);
    lastFileRef.current = item.file;
    fileToDataUrl(item.file).then(url => {
      if (!cancelled && lastFileRef.current === item.file) setSrc(url);
    }).catch(() => { if (!cancelled) setSrc(null); });
    return () => { cancelled = true; };
  }, [item]);

  const handleCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleApply = async () => {
    if (!item || !src || !croppedAreaPixels) return;
    setBusy(true);
    try {
      const file = await getCroppedFile(src, croppedAreaPixels, rotation, item.file.name);
      onComplete(file);
    } catch {
      onComplete(item.file);
    } finally {
      setBusy(false);
    }
  };

  const handleSkip = () => {
    if (!item) return;
    onSkip();
  };

  const open = !!item;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancelAll(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Crop your photo</DialogTitle>
          <DialogDescription>
            {item
              ? <>Adjust the frame so your favorite part stays in view. Image {item.index + 1} of {item.total}.</>
              : null}
          </DialogDescription>
        </DialogHeader>

        <div className="relative bg-black/90 rounded-lg overflow-hidden h-[360px]">
          {src ? (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={ASPECT_VALUE[aspect]}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={handleCropComplete}
              objectFit="contain"
              showGrid
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white/60">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
        </div>

        {/* Aspect presets */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground mr-1">Shape:</span>
          {([
            { id: "square" as const, label: "Square", icon: Square },
            { id: "wide" as const, label: "Card", icon: ImageIcon },
            { id: "free" as const, label: "Freeform", icon: ImageIcon },
          ]).map(opt => {
            const Icon = opt.icon;
            const active = aspect === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAspect(opt.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground",
                )}
              >
                <Icon className="h-3 w-3" />
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Zoom + rotate */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
            <Slider
              value={[zoom]}
              min={1}
              max={4}
              step={0.05}
              onValueChange={(v) => setZoom(v[0] ?? 1)}
              className="flex-1"
            />
            <span className="text-[11px] text-muted-foreground w-10 text-right tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
          </div>
          <div className="flex items-center gap-3">
            <RotateCcw className="h-4 w-4 text-muted-foreground shrink-0" />
            <Slider
              value={[rotation]}
              min={-180}
              max={180}
              step={1}
              onValueChange={(v) => setRotation(v[0] ?? 0)}
              className="flex-1"
            />
            <span className="text-[11px] text-muted-foreground w-10 text-right tabular-nums">
              {rotation}°
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onCancelAll} disabled={busy}>
            Cancel all
          </Button>
          <Button variant="outline" onClick={handleSkip} disabled={busy}>
            Use original
          </Button>
          <Button onClick={handleApply} disabled={!croppedAreaPixels || busy}>
            {busy ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Cropping…</> : "Apply crop"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
