import { useState, useCallback } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut } from "lucide-react";

interface InvitationCropDialogProps {
  imageSrc: string;
  originalFileName: string;
  onConfirm: (file: File) => void;
  onCancel: () => void;
}

const ASPECT_OPTIONS = [
  { label: "4:3", value: 4 / 3 },
  { label: "16:9", value: 16 / 9 },
  { label: "1:1", value: 1 },
  { label: "3:4", value: 3 / 4 },
] as const;

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
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState<number>(4 / 3);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [applying, setApplying] = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleApply = async () => {
    if (!croppedAreaPixels) return;
    setApplying(true);
    try {
      const file = await getCroppedFile(imageSrc, croppedAreaPixels, originalFileName);
      onConfirm(file);
    } catch {
      setApplying(false);
    }
  };

  const handleAspectChange = (next: number) => {
    setAspect(next);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-md p-0 overflow-hidden gap-0">
        <DialogHeader className="px-5 pt-5 pb-2">
          <DialogTitle className="font-serif text-primary text-lg">Crop invitation photo</DialogTitle>
          <DialogDescription className="text-xs">
            Drag to reposition. Use the slider to zoom. Pick the shape that suits your photo.
          </DialogDescription>
        </DialogHeader>

        <div className="relative w-full bg-black" style={{ height: 320 }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape="rect"
            showGrid
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            style={{
              containerStyle: { borderRadius: 0 },
              cropAreaStyle: { border: "2px solid white", boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)" },
            }}
          />
        </div>

        <div className="px-5 pt-3 pb-1 flex flex-wrap gap-1.5 justify-center">
          {ASPECT_OPTIONS.map(opt => (
            <Button
              key={opt.label}
              type="button"
              size="sm"
              variant={aspect === opt.value ? "default" : "outline"}
              className="text-xs h-7 px-3"
              onClick={() => handleAspectChange(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>

        <div className="px-5 pt-3 pb-2">
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

        <DialogFooter className="px-5 pb-5 pt-2 flex gap-2 sm:gap-2">
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
