import { useState, useRef, useEffect } from "react";
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

interface PhotoCropDialogProps {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
  onCropComplete: (croppedFile: File) => void;
}

export function PhotoCropDialog({
  open,
  onClose,
  imageUrl,
  onCropComplete,
}: PhotoCropDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });

  const PREVIEW_SIZE = 300;

  const computeDrawSize = (zoomLevel: number) => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight) {
      return { drawWidth: PREVIEW_SIZE * zoomLevel, drawHeight: PREVIEW_SIZE * zoomLevel };
    }
    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;
    let drawWidth = PREVIEW_SIZE * zoomLevel;
    let drawHeight = (imgHeight / imgWidth) * drawWidth;
    if (drawHeight < PREVIEW_SIZE * zoomLevel) {
      drawHeight = PREVIEW_SIZE * zoomLevel;
      drawWidth = (imgWidth / imgHeight) * drawHeight;
    }
    return { drawWidth, drawHeight };
  };

  // Reset state whenever a new image is provided
  useEffect(() => {
    setImageLoaded(false);
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
  }, [imageUrl]);

  useEffect(() => {
    if (!open) return;

    const img = imgRef.current;
    if (!img) return;

    const handleImageLoad = () => {
      const { drawWidth, drawHeight } = computeDrawSize(1);
      // Center the image inside the crop box
      setOffsetX(-(drawWidth - PREVIEW_SIZE) / 2);
      setOffsetY(-(drawHeight - PREVIEW_SIZE) / 2);
      setImageLoaded(true);
    };

    img.addEventListener("load", handleImageLoad);

    // The <img> in JSX may already have src set; if it's already loaded the
    // load event won't fire again, so trigger the handler manually.
    if (img.complete && img.naturalWidth > 0) {
      handleImageLoad();
    } else if (img.src !== imageUrl) {
      img.src = imageUrl;
    }

    return () => {
      img.removeEventListener("load", handleImageLoad);
    };
  }, [open, imageUrl]);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;

    if (!canvas || !img) return;
    if (!img.complete || !img.naturalWidth) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = PREVIEW_SIZE;
    canvas.height = PREVIEW_SIZE;

    // Clear canvas
    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);

    const { drawWidth, drawHeight } = computeDrawSize(zoom);

    // Draw the image
    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

    // Draw crop border
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
  };

  // Clamp offsets within bounds whenever zoom changes so the image stays inside the frame.
  useEffect(() => {
    if (!imageLoaded) return;
    const { drawWidth, drawHeight } = computeDrawSize(zoom);
    const maxOffsetX = Math.max(0, drawWidth - PREVIEW_SIZE);
    const maxOffsetY = Math.max(0, drawHeight - PREVIEW_SIZE);
    setOffsetX((prev) => Math.max(-maxOffsetX, Math.min(0, prev)));
    setOffsetY((prev) => Math.max(-maxOffsetY, Math.min(0, prev)));
  }, [zoom, imageLoaded]);

  useEffect(() => {
    if (open && imageLoaded) {
      redrawCanvas();
    }
  }, [zoom, offsetX, offsetY, open, imageLoaded]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStartPos({
      x: e.clientX - offsetX,
      y: e.clientY - offsetY,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    if (!imageLoaded) return;

    const newOffsetX = e.clientX - dragStartPos.x;
    const newOffsetY = e.clientY - dragStartPos.y;

    const { drawWidth, drawHeight } = computeDrawSize(zoom);
    const maxOffsetX = Math.max(0, drawWidth - PREVIEW_SIZE);
    const maxOffsetY = Math.max(0, drawHeight - PREVIEW_SIZE);

    setOffsetX(Math.max(-maxOffsetX, Math.min(0, newOffsetX)));
    setOffsetY(Math.max(-maxOffsetY, Math.min(0, newOffsetY)));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCropClick = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageLoaded) return;

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], "cropped-photo.jpg", {
          type: "image/jpeg",
          lastModified: Date.now(),
        });
        onCropComplete(file);
        // Reset state
        setZoom(1);
        setOffsetX(0);
        setOffsetY(0);
        setImageLoaded(false);
      },
      "image/jpeg",
      0.95
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Crop Photo</DialogTitle>
          <DialogDescription>
            Drag to reposition, use zoom slider to scale
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border-2 border-border rounded-lg overflow-hidden bg-muted flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={PREVIEW_SIZE}
              height={PREVIEW_SIZE}
              className="cursor-move bg-white"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{ userSelect: "none" }}
            />
          </div>

          <img
            ref={imgRef}
            src={imageUrl}
            alt="crop"
            className="hidden"
          />

          <div className="space-y-2">
            <label className="text-sm font-medium">Zoom</label>
            <Slider
              value={[zoom]}
              onValueChange={(value) => setZoom(value[0])}
              min={1}
              max={3}
              step={0.1}
              className="w-full"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCropClick}>Crop & Use</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
