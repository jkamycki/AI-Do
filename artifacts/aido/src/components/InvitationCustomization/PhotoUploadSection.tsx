import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, X, AlertCircle, Crop, Move, Crosshair } from "lucide-react";
import { AuthMediaImage } from "@/components/AuthMediaImage";
import { InvitationCropDialog } from "@/components/InvitationCropDialog";
import type { PhotoPosition } from "@/components/InvitationCustomization/AiPreviewComponents";

interface PhotoUploadSectionProps {
  mode: "saveTheDate" | "digitalInvitation";
  onSaveTheDatePhotoChange: (file: File | null) => void;
  onDigitalInvitationPhotoChange: (file: File | null) => void;
  saveTheDatePreviewUrl: string | null;
  digitalInvitationPreviewUrl: string | null;
  isLoading?: boolean;
  /** Position props — only passed in AI generated mode */
  saveTheDatePhotoPosition?: PhotoPosition;
  onSaveTheDatePositionChange?: (pos: PhotoPosition) => void;
  digitalInvitationPhotoPosition?: PhotoPosition;
  onDigitalInvitationPositionChange?: (pos: PhotoPosition) => void;
}

export function PhotoUploadSection({
  mode,
  onSaveTheDatePhotoChange,
  onDigitalInvitationPhotoChange,
  saveTheDatePreviewUrl,
  digitalInvitationPreviewUrl,
  isLoading = false,
  saveTheDatePhotoPosition,
  onSaveTheDatePositionChange,
  digitalInvitationPhotoPosition,
  onDigitalInvitationPositionChange,
}: PhotoUploadSectionProps) {
  const [saveTheDateError, setSaveTheDateError] = useState<string | null>(null);
  const [digitalInvitationError, setDigitalInvitationError] = useState<string | null>(null);

  const [cropOpen, setCropOpen] = useState(false);
  const [cropType, setCropType] = useState<"save-the-date" | "digital-invitation" | null>(null);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState<string>("photo");
  const [inputKey, setInputKey] = useState(0);

  // Drag-to-reposition state
  const [isDragging, setIsDragging] = useState(false);
  const dragging = useRef(false);
  const lastXY = useRef<{ x: number; y: number } | null>(null);

  // File input ref — used by "Change Photo" button when a photo is already set
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep position + onChange in refs so pointer move handler always sees latest values
  const isSaveTheDate = mode === "saveTheDate";
  const position = isSaveTheDate ? saveTheDatePhotoPosition : digitalInvitationPhotoPosition;
  const onPositionChange = isSaveTheDate ? onSaveTheDatePositionChange : onDigitalInvitationPositionChange;
  const hasReposition = !!(position && onPositionChange);
  const posRef = useRef<PhotoPosition>({ x: 50, y: 50 });
  const onChangeRef = useRef<((p: PhotoPosition) => void) | undefined>(undefined);
  if (position) posRef.current = position;
  onChangeRef.current = onPositionChange;

  const label = isSaveTheDate ? "Save the Date" : "RSVP Invitation";
  const previewUrl = isSaveTheDate ? saveTheDatePreviewUrl : digitalInvitationPreviewUrl;
  const error = isSaveTheDate ? saveTheDateError : digitalInvitationError;
  const handleChange = isSaveTheDate ? handleSaveTheDateChange : handleDigitalInvitationChange;
  const testId = isSaveTheDate ? "save-the-date-photo-input" : "digital-invitation-photo-input";

  const validateFile = (file: File): string | null => {
    const allowedMimes = ["image/png", "image/jpeg", "image/webp"];
    if (!allowedMimes.includes(file.type)) return "Only PNG, JPG, and WebP images are supported";
    if (file.size > 5 * 1024 * 1024) return "Image must be smaller than 5MB";
    return null;
  };

  const openCrop = (file: File, type: "save-the-date" | "digital-invitation") => {
    const url = URL.createObjectURL(file);
    setCropImageUrl(url);
    setCropFileName(file.name);
    setCropType(type);
    setCropOpen(true);
  };

  function handleSaveTheDateChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) { onSaveTheDatePhotoChange(null); setSaveTheDateError(null); return; }
    const err = validateFile(file);
    if (err) { setSaveTheDateError(err); onSaveTheDatePhotoChange(null); return; }
    setSaveTheDateError(null);
    openCrop(file, "save-the-date");
  }

  function handleDigitalInvitationChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) { onDigitalInvitationPhotoChange(null); setDigitalInvitationError(null); return; }
    const err = validateFile(file);
    if (err) { setDigitalInvitationError(err); onDigitalInvitationPhotoChange(null); return; }
    setDigitalInvitationError(null);
    openCrop(file, "digital-invitation");
  }

  const closeCrop = () => {
    setCropOpen(false);
    if (cropImageUrl) URL.revokeObjectURL(cropImageUrl);
    setCropImageUrl(null);
    setCropType(null);
    setInputKey(k => k + 1);
  };

  const handleCropConfirm = (croppedFile: File) => {
    if (cropType === "save-the-date") onSaveTheDatePhotoChange(croppedFile);
    else if (cropType === "digital-invitation") onDigitalInvitationPhotoChange(croppedFile);
    setCropOpen(false);
    if (cropImageUrl) URL.revokeObjectURL(cropImageUrl);
    setCropImageUrl(null);
    setCropType(null);
    setInputKey(k => k + 1);
  };

  const handleRemove = () => {
    if (isSaveTheDate) { onSaveTheDatePhotoChange(null); setSaveTheDateError(null); }
    else { onDigitalInvitationPhotoChange(null); setDigitalInvitationError(null); }
    setInputKey(k => k + 1);
  };

  // ── Drag-to-reposition handlers ────────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    setIsDragging(true);
    lastXY.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || !lastXY.current || !onChangeRef.current) return;
    const dx = e.clientX - lastXY.current.x;
    const dy = e.clientY - lastXY.current.y;
    lastXY.current = { x: e.clientX, y: e.clientY };
    const sensitivity = 0.35;
    const next: PhotoPosition = {
      x: Math.max(0, Math.min(100, posRef.current.x - dx * sensitivity)),
      y: Math.max(0, Math.min(100, posRef.current.y - dy * sensitivity)),
    };
    posRef.current = next;
    onChangeRef.current(next);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragging.current = false;
    setIsDragging(false);
    lastXY.current = null;
  };

  const handleCenter = (e: React.MouseEvent) => {
    e.stopPropagation();
    const centered: PhotoPosition = { x: 50, y: 50 };
    posRef.current = centered;
    onChangeRef.current?.(centered);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">📸 Photo</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <label className="text-sm font-medium">{label} Photo</label>

          {/* Hidden file input — triggered by upload area click or "Change Photo" button */}
          <input
            key={inputKey}
            ref={fileInputRef}
            data-testid={testId}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleChange}
            disabled={isLoading}
            className="hidden"
          />

          {previewUrl ? (
            /* ── Photo present: show thumbnail + action buttons ── */
            <div className="space-y-1.5">
              <div
                className={`relative w-full select-none group rounded overflow-hidden${hasReposition ? " touch-none" : ""}`}
                style={hasReposition ? { cursor: isDragging ? "grabbing" : "grab" } : {}}
                onPointerDown={hasReposition ? handlePointerDown : undefined}
                onPointerMove={hasReposition ? handlePointerMove : undefined}
                onPointerUp={hasReposition ? handlePointerUp : undefined}
                onPointerCancel={hasReposition ? handlePointerUp : undefined}
              >
                <AuthMediaImage
                  src={previewUrl}
                  alt={`${label} preview`}
                  className="w-full h-40 object-cover border rounded"
                  style={hasReposition && position
                    ? { objectPosition: `${position.x}% ${position.y}%`, userSelect: "none", pointerEvents: "none" }
                    : { pointerEvents: "none" }}
                  draggable={false}
                />

                {/* Drag overlay hint */}
                {hasReposition && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/25 transition-colors rounded pointer-events-none">
                    <div className="flex items-center gap-1.5 text-white text-xs font-medium bg-black/60 px-2.5 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      <Move className="h-3 w-3" />
                      Drag to reposition
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="absolute top-2 right-2 flex gap-1">
                  {hasReposition && (
                    <button
                      onClick={handleCenter}
                      className="p-1 bg-black/60 text-white rounded-full hover:bg-black/80"
                      title="Center photo"
                    >
                      <Crosshair className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCropImageUrl(previewUrl);
                      setCropFileName(isSaveTheDate ? "save-the-date" : "invitation");
                      setCropType(isSaveTheDate ? "save-the-date" : "digital-invitation");
                      setCropOpen(true);
                    }}
                    className="p-1 bg-black/60 text-white rounded-full hover:bg-black/80"
                    title="Re-crop photo"
                  >
                    <Crop className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    className="p-1 bg-black/60 text-white rounded-full hover:bg-black/80"
                    title="Change photo"
                    disabled={isLoading}
                  >
                    <Upload className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemove(); }}
                    className="p-1 bg-destructive text-white rounded-full hover:bg-destructive/90"
                    title="Remove photo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Reposition hint text */}
              {hasReposition && (
                <p className="text-[11px] text-muted-foreground text-center">
                  Drag to reposition ·{" "}
                  <button
                    type="button"
                    className="underline hover:text-foreground transition-colors"
                    onClick={() => { const c = { x: 50, y: 50 }; posRef.current = c; onChangeRef.current?.(c); }}
                  >
                    Center
                  </button>
                  {" "}·{" "}
                  <button
                    type="button"
                    className="underline hover:text-foreground transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Change photo
                  </button>
                </p>
              )}

              {/* Non-AI mode: show change/remove links below thumbnail */}
              {!hasReposition && (
                <p className="text-[11px] text-muted-foreground text-center">
                  <button
                    type="button"
                    className="underline hover:text-foreground transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Change photo
                  </button>
                  {" "}·{" "}
                  <button
                    type="button"
                    className="underline hover:text-foreground transition-colors text-destructive/70 hover:text-destructive"
                    onClick={handleRemove}
                  >
                    Remove
                  </button>
                </p>
              )}
            </div>
          ) : (
            /* ── No photo: show dashed upload area ── */
            <div className="border-2 border-dashed border-border rounded-lg p-6 space-y-3">
              <div className="flex justify-center">
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
              <div
                className="cursor-pointer text-center"
                onClick={() => fileInputRef.current?.click()}
              >
                <p className="text-sm font-medium">Click to upload</p>
                <p className="text-xs text-muted-foreground">PNG, JPG, or WebP • Max 5MB</p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>

      {cropOpen && cropImageUrl && (
        <InvitationCropDialog
          imageSrc={cropImageUrl}
          originalFileName={cropFileName}
          onConfirm={handleCropConfirm}
          onCancel={closeCrop}
        />
      )}
    </Card>
  );
}
