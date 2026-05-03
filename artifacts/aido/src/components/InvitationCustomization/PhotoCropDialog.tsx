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
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });

  const PREVIEW_SIZE = 300;

  useEffect(() => {
    if (!open) return;

    const img = imgRef.current;
    if (!img) return;

    const handleImageLoad = () => {
      redrawCanvas();
    };

    img.addEventListener("load", handleImageLoad);
    img.src = imageUrl;

    return () => {
      img.removeEventListener("load", handleImageLoad);
    };
  }, [open, imageUrl]);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;

    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = PREVIEW_SIZE;
    canvas.height = PREVIEW_SIZE;

    // Clear canvas
    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);

    // Calculate scaled dimensions
    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;

    let drawWidth = PREVIEW_SIZE * zoom;
    let drawHeight = (imgHeight / imgWidth) * drawWidth;

    if (drawHeight < PREVIEW_SIZE) {
      drawHeight = PREVIEW_SIZE * zoom;
      drawWidth = (imgWidth / imgHeight) * drawHeight;
    }

    // Draw the image
    ctx.drawImage(
      img,
      offsetX,
      offsetY,
      drawWidth,
      drawHeight
    );

    // Draw crop border
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
  };

  useEffect(() => {
    if (open) {
      redrawCanvas();
    }
  }, [zoom, offsetX, offsetY, open]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStartPos({
      x: e.clientX - offsetX,
      y: e.clientY - offsetY,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;

    const img = imgRef.current;
    if (!img) return;

    const newOffsetX = e.clientX - dragStartPos.x;
    const newOffsetY = e.clientY - dragStartPos.y;

    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;

    let maxDrawWidth = PREVIEW_SIZE * zoom;
    let maxDrawHeight = (imgHeight / imgWidth) * maxDrawWidth;

    if (maxDrawHeight < PREVIEW_SIZE) {
      maxDrawHeight = PREVIEW_SIZE * zoom;
      maxDrawWidth = (imgWidth / imgHeight) * maxDrawHeight;
    }

    const maxOffsetX = Math.max(0, maxDrawWidth - PREVIEW_SIZE);
    const maxOffsetY = Math.max(0, maxDrawHeight - PREVIEW_SIZE);

    setOffsetX(Math.max(-maxOffsetX, Math.min(0, newOffsetX)));
    setOffsetY(Math.max(-maxOffsetY, Math.min(0, newOffsetY)));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCropClick = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], "cropped-photo.jpg", {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
          onCropComplete(file);
          // Reset state
          setZoom(1);
          setOffsetX(0);
          setOffsetY(0);
        }
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
            crossOrigin="anonymous"
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
