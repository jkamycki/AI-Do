import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Upload,
  X,
  AlertCircle,
  Crop,
  Move,
  Crosshair,
  Loader2,
  Save,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { AuthMediaImage } from "@/components/AuthMediaImage";
import { InvitationCropDialog } from "@/components/InvitationCropDialog";
import {
  DEFAULT_PHOTO_ZOOM,
  MAX_PHOTO_ZOOM,
  MIN_PHOTO_ZOOM,
  PHOTO_EFFECT_OPTIONS,
  clampPhotoZoom,
  photoEffectToFilter,
  type PhotoPosition,
} from "@/components/InvitationCustomization/AiPreviewComponents";

interface PhotoUploadSectionProps {
  mode: "saveTheDate" | "digitalInvitation";
  onSaveTheDatePhotoChange: (file: File | null) => void;
  onDigitalInvitationPhotoChange: (file: File | null) => void;
  saveTheDatePreviewUrl: string | null;
  digitalInvitationPreviewUrl: string | null;
  isLoading?: boolean;
  isUploadingPhoto?: boolean;
  isSavingPhoto?: boolean;
  onSavePhoto?: () => void;
  /** Position props — only passed in AI generated mode */
  saveTheDatePhotoPosition?: PhotoPosition;
  onSaveTheDatePositionChange?: (pos: PhotoPosition) => void;
  saveTheDatePhotoZoom?: number;
  onSaveTheDateZoomChange?: (zoom: number) => void;
  digitalInvitationPhotoPosition?: PhotoPosition;
  onDigitalInvitationPositionChange?: (pos: PhotoPosition) => void;
  digitalInvitationPhotoZoom?: number;
  onDigitalInvitationZoomChange?: (zoom: number) => void;
  saveTheDatePhotoEffect?: string;
  onSaveTheDatePhotoEffectChange?: (effect: string) => void;
  digitalInvitationPhotoEffect?: string;
  onDigitalInvitationPhotoEffectChange?: (effect: string) => void;
}

export function PhotoUploadSection({
  mode,
  onSaveTheDatePhotoChange,
  onDigitalInvitationPhotoChange,
  saveTheDatePreviewUrl,
  digitalInvitationPreviewUrl,
  isLoading = false,
  isUploadingPhoto = false,
  isSavingPhoto = false,
  onSavePhoto,
  saveTheDatePhotoPosition,
  onSaveTheDatePositionChange,
  saveTheDatePhotoZoom = DEFAULT_PHOTO_ZOOM,
  onSaveTheDateZoomChange,
  digitalInvitationPhotoPosition,
  onDigitalInvitationPositionChange,
  digitalInvitationPhotoZoom = DEFAULT_PHOTO_ZOOM,
  onDigitalInvitationZoomChange,
  saveTheDatePhotoEffect = "none",
  onSaveTheDatePhotoEffectChange,
  digitalInvitationPhotoEffect = "none",
  onDigitalInvitationPhotoEffectChange,
}: PhotoUploadSectionProps) {
  const [saveTheDateError, setSaveTheDateError] = useState<string | null>(null);
  const [digitalInvitationError, setDigitalInvitationError] = useState<
    string | null
  >(null);

  const [cropOpen, setCropOpen] = useState(false);
  const [cropType, setCropType] = useState<
    "save-the-date" | "digital-invitation" | null
  >(null);
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
  const position = isSaveTheDate
    ? saveTheDatePhotoPosition
    : digitalInvitationPhotoPosition;
  const onPositionChange = isSaveTheDate
    ? onSaveTheDatePositionChange
    : onDigitalInvitationPositionChange;
  const photoZoom = clampPhotoZoom(isSaveTheDate ? saveTheDatePhotoZoom : digitalInvitationPhotoZoom);
  const onZoomChange = isSaveTheDate ? onSaveTheDateZoomChange : onDigitalInvitationZoomChange;
  const hasReposition = !!(position && onPositionChange);
  const photoEffect = isSaveTheDate ? saveTheDatePhotoEffect : digitalInvitationPhotoEffect;
  const onPhotoEffectChange = isSaveTheDate ? onSaveTheDatePhotoEffectChange : onDigitalInvitationPhotoEffectChange;
  const posRef = useRef<PhotoPosition>({ x: 50, y: 50 });
  const onChangeRef = useRef<((p: PhotoPosition) => void) | undefined>(
    undefined,
  );
  if (position) posRef.current = position;
  onChangeRef.current = onPositionChange;

  const label = isSaveTheDate ? "Save the Date" : "RSVP Invitation";
  const previewUrl = isSaveTheDate
    ? saveTheDatePreviewUrl
    : digitalInvitationPreviewUrl;
  const error = isSaveTheDate ? saveTheDateError : digitalInvitationError;
  const handleChange = isSaveTheDate
    ? handleSaveTheDateChange
    : handleDigitalInvitationChange;
  const testId = isSaveTheDate
    ? "save-the-date-photo-input"
    : "digital-invitation-photo-input";
  const isBlobPreview = previewUrl?.startsWith("blob:") ?? false;
  const isSaveDisabled =
    isLoading || isUploadingPhoto || isSavingPhoto || isBlobPreview;

  const validateFile = (file: File): string | null => {
    const allowedMimes = ["image/png", "image/jpeg", "image/webp"];
    if (!allowedMimes.includes(file.type))
      return "Only PNG, JPG, and WebP images are supported";
    if (file.size > 5 * 1024 * 1024) return "Image must be smaller than 5MB";
    return null;
  };

  const openCrop = (
    file: File,
    type: "save-the-date" | "digital-invitation",
  ) => {
    const url = URL.createObjectURL(file);
    setCropImageUrl(url);
    setCropFileName(file.name);
    setCropType(type);
    setCropOpen(true);
  };

  function handleSaveTheDateChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      onSaveTheDatePhotoChange(null);
      setSaveTheDateError(null);
      return;
    }
    const err = validateFile(file);
    if (err) {
      setSaveTheDateError(err);
      onSaveTheDatePhotoChange(null);
      return;
    }
    setSaveTheDateError(null);
    openCrop(file, "save-the-date");
  }

  function handleDigitalInvitationChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) {
      onDigitalInvitationPhotoChange(null);
      setDigitalInvitationError(null);
      return;
    }
    const err = validateFile(file);
    if (err) {
      setDigitalInvitationError(err);
      onDigitalInvitationPhotoChange(null);
      return;
    }
    setDigitalInvitationError(null);
    openCrop(file, "digital-invitation");
  }

  const closeCrop = () => {
    setCropOpen(false);
    if (cropImageUrl) URL.revokeObjectURL(cropImageUrl);
    setCropImageUrl(null);
    setCropType(null);
    setInputKey((k) => k + 1);
  };

  const handleCropConfirm = (croppedFile: File) => {
    if (cropType === "save-the-date") onSaveTheDatePhotoChange(croppedFile);
    else if (cropType === "digital-invitation")
      onDigitalInvitationPhotoChange(croppedFile);
    setCropOpen(false);
    if (cropImageUrl) URL.revokeObjectURL(cropImageUrl);
    setCropImageUrl(null);
    setCropType(null);
    setInputKey((k) => k + 1);
  };

  const handleRemove = () => {
    if (isSaveTheDate) {
      onSaveTheDatePhotoChange(null);
      setSaveTheDateError(null);
    } else {
      onDigitalInvitationPhotoChange(null);
      setDigitalInvitationError(null);
    }
    setInputKey((k) => k + 1);
  };

  // ── Drag-to-reposition handlers ────────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch { /* noop */ }
    dragging.current = true;
    setIsDragging(true);
    lastXY.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || !lastXY.current || !onChangeRef.current) return;
    const dx = e.clientX - lastXY.current.x;
    const dy = e.clientY - lastXY.current.y;
    lastXY.current = { x: e.clientX, y: e.clientY };
    const rect = e.currentTarget.getBoundingClientRect();
    const deltaX = rect.width > 0 ? (dx / rect.width) * 100 : 0;
    const deltaY = rect.height > 0 ? (dy / rect.height) * 100 : 0;
    const next: PhotoPosition = {
      x: Math.max(0, Math.min(100, posRef.current.x - deltaX)),
      y: Math.max(0, Math.min(100, posRef.current.y - deltaY)),
    };
    posRef.current = next;
    onChangeRef.current(next);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch { /* noop */ }
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

  const updateZoom = (nextZoom: number) => {
    onZoomChange?.(clampPhotoZoom(nextZoom));
  };

  const resetPhotoFraming = () => {
    const centered: PhotoPosition = { x: 50, y: 50 };
    posRef.current = centered;
    onChangeRef.current?.(centered);
    updateZoom(DEFAULT_PHOTO_ZOOM);
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
                style={
                  hasReposition
                    ? { cursor: isDragging ? "grabbing" : "grab" }
                    : {}
                }
                onPointerDown={hasReposition ? handlePointerDown : undefined}
                onPointerMove={hasReposition ? handlePointerMove : undefined}
                onPointerUp={hasReposition ? handlePointerUp : undefined}
                onPointerCancel={hasReposition ? handlePointerUp : undefined}
              >
                <AuthMediaImage
                  src={previewUrl}
                  alt={`${label} preview`}
                  className="w-full h-40 object-cover border rounded"
                  style={
                    hasReposition && position
                      ? {
                          objectPosition: `${position.x}% ${position.y}%`,
                          transform: `scale(${photoZoom})`,
                          transformOrigin: `${position.x}% ${position.y}%`,
                          filter: photoEffectToFilter(photoEffect),
                          userSelect: "none",
                          pointerEvents: "none",
                        }
                      : { pointerEvents: "none", filter: photoEffectToFilter(photoEffect) }
                  }
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
                <div
                  className="absolute top-2 right-2 flex gap-1"
                  onPointerDown={(e) => e.stopPropagation()}
                >
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
                      setCropFileName(
                        isSaveTheDate ? "save-the-date" : "invitation",
                      );
                      setCropType(
                        isSaveTheDate ? "save-the-date" : "digital-invitation",
                      );
                      setCropOpen(true);
                    }}
                    className="p-1 bg-black/60 text-white rounded-full hover:bg-black/80"
                    title="Re-crop photo"
                  >
                    <Crop className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="p-1 bg-black/60 text-white rounded-full hover:bg-black/80"
                    title="Change photo"
                    disabled={isLoading}
                  >
                    <Upload className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove();
                    }}
                    className="p-1 bg-destructive text-white rounded-full hover:bg-destructive/90"
                    title="Remove photo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {hasReposition && (
                <div className="space-y-2 rounded-md border bg-muted/20 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-muted-foreground">Photo zoom</span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">{Math.round(photoZoom * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-7 w-7 shrink-0"
                      onClick={() => updateZoom(photoZoom - 0.1)}
                      disabled={!onZoomChange || photoZoom <= MIN_PHOTO_ZOOM}
                      title="Zoom out"
                    >
                      <ZoomOut className="h-3.5 w-3.5" />
                    </Button>
                    <input
                      type="range"
                      min={MIN_PHOTO_ZOOM}
                      max={MAX_PHOTO_ZOOM}
                      step={0.05}
                      value={photoZoom}
                      disabled={!onZoomChange}
                      onChange={(event) => updateZoom(Number(event.target.value))}
                      className="w-full accent-primary"
                      aria-label={`${label} photo zoom`}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-7 w-7 shrink-0"
                      onClick={() => updateZoom(photoZoom + 0.1)}
                      disabled={!onZoomChange || photoZoom >= MAX_PHOTO_ZOOM}
                      title="Zoom in"
                    >
                      <ZoomIn className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground text-center">
                    Drag to reposition, or{" "}
                    <button
                      type="button"
                      className="underline hover:text-foreground transition-colors"
                      onClick={resetPhotoFraming}
                    >
                      reset framing
                    </button>
                  </p>
                </div>
              )}

              {/* Reposition hint text */}
              {hasReposition && (
                <p className="text-[11px] text-muted-foreground text-center">
                  Drag to reposition ·{" "}
                  <button
                    type="button"
                    className="underline hover:text-foreground transition-colors"
                    onClick={() => {
                      const c = { x: 50, y: 50 };
                      posRef.current = c;
                      onChangeRef.current?.(c);
                    }}
                  >
                    Center
                  </button>{" "}
                  ·{" "}
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
                  </button>{" "}
                  ·{" "}
                  <button
                    type="button"
                    className="underline hover:text-foreground transition-colors text-destructive/70 hover:text-destructive"
                    onClick={handleRemove}
                  >
                    Remove
                  </button>
                </p>
              )}

              {onPhotoEffectChange && (
                <div className="space-y-1.5 rounded-md border bg-muted/20 p-2">
                  <label className="text-[11px] font-medium text-muted-foreground">Photo effect</label>
                  <select
                    value={photoEffect}
                    onChange={(event) => onPhotoEffectChange(event.target.value)}
                    className="block h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                  >
                    {PHOTO_EFFECT_OPTIONS.map((effect) => (
                      <option key={effect.id} value={effect.id}>{effect.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {onSavePhoto && (
                <Button
                  type="button"
                  size="sm"
                  className="w-full gap-2"
                  onClick={onSavePhoto}
                  disabled={isSaveDisabled}
                >
                  {isUploadingPhoto || isSavingPhoto ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  {isUploadingPhoto
                    ? "Uploading..."
                    : isSavingPhoto
                      ? "Saving..."
                      : "Save Photo"}
                </Button>
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
                <p className="text-xs text-muted-foreground">
                  PNG, JPG, or WebP • Max 5MB
                </p>
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
