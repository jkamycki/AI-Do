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
  const imageRef = useRef<HTMLImageElement>(null);
  const [zoom, setZoom] = useState(1);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleCrop = async () => {
    if (!canvasRef.current || !imageRef.current) return;

    const canvas = canvasRef.current;
    const image = imageRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = Math.min(canvas.width, canvas.height);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      image,
      crop.x / zoom,
      crop.y / zoom,
      size / zoom,
      size / zoom,
      0,
      0,
      size,
      size
    );

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "cropped-photo.jpg", {
          type: "image/jpeg",
        });
        onCropComplete(file);
        onClose();
      }
    }, "image/jpeg");
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - crop.x, y: e.clientY - crop.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;

    const newCrop = {
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    };

    const canvas = canvasRef.current;
    if (!canvas) return;

    const size = Math.min(canvas.width, canvas.height);
    const maxX = (canvas.width - size) / zoom;
    const maxY = (canvas.height - size) / zoom;

    setCrop({
      x: Math.max(Math.min(newCrop.x, 0), -maxX * zoom),
      y: Math.max(Math.min(newCrop.y, 0), -maxY * zoom),
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (!open || !imageRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const image = imageRef.current;
    const size = 300;

    canvas.width = size;
    canvas.height = size;

    image.onload = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, size, size);

      const scale = Math.max(size / image.width, size / image.height) * zoom;
      const x = (size - image.width * scale) / 2 + crop.x;
      const y = (size - image.height * scale) / 2 + crop.y;

      ctx.drawImage(image, x, y, image.width * scale, image.height * scale);

      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, size, size);
    };

    image.src = imageUrl;
  }, [open, imageUrl, crop, zoom]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Crop Photo</DialogTitle>
          <DialogDescription>
            Drag to move the image and use the slider to zoom
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border-2 border-border rounded-lg overflow-hidden bg-muted">
            <canvas
              ref={canvasRef}
              className="w-full cursor-move"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>

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
          <Button onClick={handleCrop}>Crop & Use</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
