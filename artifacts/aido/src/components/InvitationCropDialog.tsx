import { useState, useCallback, useRef } from "react";
import Cropper, { type Area, type MediaSize } from "react-easy-crop";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut, ArrowUp, AlignCenter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InvitationCropDialogProps {
  imageSrc: string;
  originalFileName: string;
  onConfirm: (file: File) => void;
  onCancel: () => void;
}

const ASPECT_OPTIONS = [
  { label: "Square",    ratio: "1:1",  value: 1 },
  { label: "Landscape", ratio: "4:3",  value: 4 / 3 },
  { label: "Wide",      ratio: "16:9", value: 16 / 9 },
  { label: "Portrait",  ratio: "3:4",  value: 3 / 4 },
  { label: "Tall",      ratio: "2:3",  value: 2 / 3 },
] as const;

/**
 * Compute an initial crop area (as percentages of the image dimensions) that
 * biases toward the top of the image when the image is taller than the crop
 * ratio — so heads and faces stay in frame rather than being cut off.
 */
function computeInitialCropArea(
  natW: number,
  natH: number,
  asp: number,
): { x: number; y: number; width: number; height: number } {
  const imageAsp = natW / natH;

  if (imageAsp >= asp) {
    const w = (asp / imageAsp) * 100;
    return { x: (100 - w) / 2, y: 0, width: w, height: 100 };
  }

  const h = (imageAsp / asp) * 100;
  const y = Math.max(0, Math.min(8, 100 - h));
  return { x: 0, y, width: 100, height: h };
}

/** Compute a centered crop area (percentages) for the given image + aspect. */
function computeCenteredCropArea(
  natW: number,
  natH: number,
  asp: number,
): { x: number; y: number; width: number; height: number } {
  const imageAsp = natW / natH;

  if (imageAsp >= asp) {
    const w = (asp / imageAsp) * 100;
    return { x: (100 - w) / 2, y: 0, width: w, height: 100 };
  }

  const h = (imageAsp / asp) * 100;
  return { x: 0, y: (100 - h) / 2, width: 100, height: h };
}

async function getCroppedFile(
  imageSrc: string,
  pixelCrop: Area,
  fileName: string,
): Promise<File> {
  const blob = await fetch(imageSrc).then(r => r.blob());
  const image = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      out => {
        if (!out) {
          reject(new Error("Could not produce cropped image"));
          return;
        }
        const baseName = fileName.replace(/\.[^.]+$/, "") || "invitation";
        resolve(new File([out], `${baseName}-cropped.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  });
}

export function InvitationCropDialog({ imageSrc, originalFileName, onConfirm, onCancel }: InvitationCropDialogProps) {
  const { toast } = useToast();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState<number>(4 / 3);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [applying, setApplying] = useState(false);

  // Key incremented to force-remount the Cropper whenever we want
  // initialCroppedAreaPercentages to take effect (on first load or aspect change).
  const [cropperKey, setCropperKey] = useState(0);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

  // Controls which initial area to use for the next remount.
  // "top" = top-biased, "center" = centered, undefined = none (free drag)
  const pendingInitMode = useRef<"top" | "center">("top");

  // Prevent the auto-position logic from triggering on every Cropper remount.
  const autoPositioned = useRef(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleMediaLoaded = useCallback((ms: MediaSize) => {
    if (autoPositioned.current) return;
    autoPositioned.current = true;
    setNaturalSize({ w: ms.naturalWidth, h: ms.naturalHeight });
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCropperKey(k => k + 1);
  }, []);

  const handleAspectChange = (next: number) => {
    setAspect(next);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    pendingInitMode.current = "top";
    setCropperKey(k => k + 1);
  };

  /** Snap crop back to the top-biased position. */
  const handleResetToTop = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    pendingInitMode.current = "top";
    setCropperKey(k => k + 1);
  };

  /** Center the crop window on the image. */
  const handleCenter = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    pendingInitMode.current = "center";
    setCropperKey(k => k + 1);
  };

  const handleApply = async () => {
    if (!croppedAreaPixels) return;
    setApplying(true);
    try {
      const file = await getCroppedFile(imageSrc, croppedAreaPixels, originalFileName);
      onConfirm(file);
    } catch (err) {
      toast({
        title: "Couldn't crop the image",
        description: err instanceof Error ? err.message : "Try again or use a different photo.",
        variant: "destructive",
      });
      setApplying(false);
    }
  };

  const initialCropArea = naturalSize
    ? pendingInitMode.current === "center"
      ? computeCenteredCropArea(naturalSize.w, naturalSize.h, aspect)
      : computeInitialCropArea(naturalSize.w, naturalSize.h, aspect)
    : undefined;

  return (
    <Dialog open onOpenChange={open => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-md p-0 overflow-hidden gap-0">
        <DialogHeader className="px-5 pt-5 pb-2">
          <DialogTitle className="font-serif text-primary text-lg">Crop photo</DialogTitle>
          <DialogDescription className="text-xs">
            Choose a shape, drag to reposition, and zoom to fill. Use Center or Top to snap the photo into position.
          </DialogDescription>
        </DialogHeader>

        {/* Aspect ratio buttons */}
        <div className="px-5 pt-3 pb-2 flex flex-wrap gap-1.5">
          {ASPECT_OPTIONS.map(opt => (
            <button
              key={opt.label}
              type="button"
              onClick={() => handleAspectChange(opt.value)}
              className={[
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-md border text-xs transition-colors",
                aspect === opt.value
                  ? "bg-primary text-primary-foreground border-primary font-semibold"
                  : "bg-background text-muted-foreground border-border hover:border-primary hover:text-foreground",
              ].join(" ")}
            >
              <span className="font-medium">{opt.label}</span>
              <span className="opacity-60 text-[10px]">{opt.ratio}</span>
            </button>
          ))}
        </div>

        {/* Crop area */}
        <div className="relative w-full bg-black" style={{ height: 300 }}>
          <Cropper
            key={cropperKey}
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape="rect"
            showGrid
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            onMediaLoaded={handleMediaLoaded}
            initialCroppedAreaPercentages={initialCropArea}
            style={{
              containerStyle: { borderRadius: 0 },
              cropAreaStyle: { border: "2px solid white", boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)" },
            }}
          />
        </div>

        {/* Zoom slider */}
        <div className="px-5 pt-3 pb-1">
          <div className="flex items-center gap-3">
            <ZoomOut className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <Slider
              min={1}
              max={3}
              step={0.01}
              value={[zoom]}
              onValueChange={([v]) => setZoom(v)}
              className="flex-1"
            />
            <ZoomIn className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          </div>
        </div>

        {/* Position shortcuts */}
        <div className="px-5 pt-1 pb-2 flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-xs h-7 px-3 gap-1 text-muted-foreground hover:text-foreground"
            onClick={handleCenter}
          >
            <AlignCenter className="h-3 w-3" />
            Center
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-xs h-7 px-3 gap-1 text-muted-foreground hover:text-foreground"
            onClick={handleResetToTop}
          >
            <ArrowUp className="h-3 w-3" />
            Top
          </Button>
        </div>

        <DialogFooter className="px-5 pb-5 pt-1 flex gap-2 sm:gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={applying}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleApply} disabled={applying || !croppedAreaPixels}>
            {applying ? "Applying…" : "Apply crop"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
