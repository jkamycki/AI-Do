import { useCallback, useRef, useState } from "react";
import Cropper, { type Area, type MediaSize } from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Maximize2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface HeadshotCropDialogProps {
  imageSrc: string;
  originalFileName: string;
  onConfirm: (file: File) => void;
  onCancel: () => void;
}

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 4;

function clampZoom(value: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

function computeInitialCropArea(natW: number, natH: number) {
  const imageAsp = natW / natH;

  if (imageAsp >= 1) {
    const w = (1 / imageAsp) * 100;
    return { x: (100 - w) / 2, y: 0, width: w, height: 100 };
  }

  const h = imageAsp * 100;
  const y = Math.max(0, Math.min(10, 100 - h));
  return { x: 0, y, width: 100, height: h };
}

async function getCroppedFile(
  imageSrc: string,
  pixelCrop: Area,
  fileName: string,
): Promise<File> {
  const blob = await fetch(imageSrc).then((r) => r.blob());
  const image = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(pixelCrop.width));
  canvas.height = Math.max(1, Math.round(pixelCrop.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.fillStyle = "#FFF7F2";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cropX = Math.round(pixelCrop.x);
  const cropY = Math.round(pixelCrop.y);
  const cropW = Math.round(pixelCrop.width);
  const cropH = Math.round(pixelCrop.height);
  const sourceX = Math.max(0, cropX);
  const sourceY = Math.max(0, cropY);
  const sourceRight = Math.min(image.width, cropX + cropW);
  const sourceBottom = Math.min(image.height, cropY + cropH);
  const sourceW = Math.max(0, sourceRight - sourceX);
  const sourceH = Math.max(0, sourceBottom - sourceY);

  if (sourceW > 0 && sourceH > 0) {
    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      sourceW,
      sourceH,
      sourceX - cropX,
      sourceY - cropY,
      sourceW,
      sourceH,
    );
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (out) => {
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

export function HeadshotCropDialog({
  imageSrc,
  originalFileName,
  onConfirm,
  onCancel,
}: HeadshotCropDialogProps) {
  const { toast } = useToast();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [applying, setApplying] = useState(false);
  const [cropperKey, setCropperKey] = useState(0);
  const [initialCropArea, setInitialCropArea] = useState<
    { x: number; y: number; width: number; height: number } | undefined
  >(undefined);
  const [mediaSize, setMediaSize] = useState<MediaSize | null>(null);
  const autoPositioned = useRef(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleMediaLoaded = useCallback((ms: MediaSize) => {
    setMediaSize(ms);
    if (autoPositioned.current) return;
    autoPositioned.current = true;
    setInitialCropArea(computeInitialCropArea(ms.naturalWidth, ms.naturalHeight));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCropperKey((k) => k + 1);
  }, []);

  const fitWholePhoto = () => {
    if (!mediaSize) return;
    setCrop({ x: 0, y: 0 });
    const shortestSide = Math.min(mediaSize.width, mediaSize.height);
    const longestSide = Math.max(mediaSize.width, mediaSize.height);
    setZoom(clampZoom(shortestSide / longestSide));
  };

  const resetFraming = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
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

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-sm overflow-hidden gap-0 p-0">
        <DialogHeader className="px-5 pb-2 pt-5">
          <DialogTitle className="font-serif text-lg text-primary">Crop headshot</DialogTitle>
          <DialogDescription className="text-xs">
            Drag to reposition. Zoom out to fit the whole photo or zoom in to crop closer.
          </DialogDescription>
        </DialogHeader>

        <div className="relative w-full bg-[#24171D]" style={{ height: 320 }}>
          <Cropper
            key={cropperKey}
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            aspect={1}
            cropShape="round"
            restrictPosition={false}
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={(value) => setZoom(clampZoom(value))}
            onCropComplete={onCropComplete}
            onMediaLoaded={handleMediaLoaded}
            initialCroppedAreaPercentages={initialCropArea}
            style={{
              containerStyle: { borderRadius: 0 },
              cropAreaStyle: {
                border: "2px solid white",
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.58)",
              },
            }}
          />
        </div>

        <div className="space-y-3 px-5 pb-2 pt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {zoom < 1 ? "Fit mode" : `${Math.round(zoom * 100)}% zoom`}
            </span>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={fitWholePhoto}>
                <Maximize2 className="h-3.5 w-3.5" />
                Fit
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-8 gap-1.5" onClick={resetFraming}>
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ZoomOut className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            <Slider
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={[zoom]}
              onValueChange={([v]) => setZoom(clampZoom(v))}
              className="flex-1"
            />
            <ZoomIn className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          </div>
        </div>

        <DialogFooter className="flex gap-2 px-5 pb-5 pt-1 sm:gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={applying}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleApply} disabled={applying || !croppedAreaPixels}>
            {applying ? "Saving..." : "Use photo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
