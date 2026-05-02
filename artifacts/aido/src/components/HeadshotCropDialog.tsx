import { useState, useCallback, useRef } from "react";
import Cropper, { type Area, type MediaSize } from "react-easy-crop";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface HeadshotCropDialogProps {
  imageSrc: string;
  originalFileName: string;
  onConfirm: (file: File) => void;
  onCancel: () => void;
}

/**
 * For a square (1:1) crop, bias the initial crop toward the upper-middle
 * portion of the image so faces/heads stay in frame.
 *
 * If the image is portrait (taller than wide): fill width, start ~10 % from top.
 * If the image is landscape (wider than tall): fill height, center horizontally,
 *   but also shift 10 % up from center so the top half is preferred.
 */
function computeInitialCropArea(natW: number, natH: number) {
  const imageAsp = natW / natH;

  if (imageAsp >= 1) {
    // Landscape: crop fills full height, centered horizontally
    const w = (1 / imageAsp) * 100;
    return { x: (100 - w) / 2, y: 0, width: w, height: 100 };
  }

  // Portrait: crop fills full width, start near top for faces
  const h = imageAsp * 100; // same as (1/1) * imageAsp * 100
  const y = Math.max(0, Math.min(10, 100 - h));
  return { x: 0, y, width: 100, height: h };
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
        const baseName = fileName.replace(/\.[^.]+$/, "") || "headshot";
        resolve(new File([out], `${baseName}-headshot.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  });
}

export function HeadshotCropDialog({ imageSrc, originalFileName, onConfirm, onCancel }: HeadshotCropDialogProps) {
  const { toast } = useToast();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [applying, setApplying] = useState(false);
  const [cropperKey, setCropperKey] = useState(0);
  const [initialCropArea, setInitialCropArea] = useState<{ x: number; y: number; width: number; height: number } | undefined>(undefined);
  const autoPositioned = useRef(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleMediaLoaded = useCallback((ms: MediaSize) => {
    if (autoPositioned.current) return;
    autoPositioned.current = true;
    setInitialCropArea(computeInitialCropArea(ms.naturalWidth, ms.naturalHeight));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCropperKey(k => k + 1);
  }, []);

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

  return (
    <Dialog open onOpenChange={open => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden gap-0">
        <DialogHeader className="px-5 pt-5 pb-2">
          <DialogTitle className="font-serif text-primary text-lg">Crop headshot</DialogTitle>
          <DialogDescription className="text-xs">
            Drag to center on the face · Zoom to fill the frame
          </DialogDescription>
        </DialogHeader>

        <div className="relative w-full bg-black" style={{ height: 300 }}>
          <Cropper
            key={cropperKey}
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            onMediaLoaded={handleMediaLoaded}
            initialCroppedAreaPercentages={initialCropArea}
            style={{
              containerStyle: { borderRadius: 0 },
              cropAreaStyle: { border: "2px solid white", boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)" },
            }}
          />
        </div>

        <div className="px-5 pt-3 pb-2">
          <div className="flex items-center gap-3">
            <ZoomOut className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <Slider
              min={1}
              max={4}
              step={0.01}
              value={[zoom]}
              onValueChange={([v]) => setZoom(v)}
              className="flex-1"
            />
            <ZoomIn className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          </div>
        </div>

        <DialogFooter className="px-5 pb-5 pt-1 flex gap-2 sm:gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={applying}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleApply} disabled={applying || !croppedAreaPixels}>
            {applying ? "Saving…" : "Use photo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
