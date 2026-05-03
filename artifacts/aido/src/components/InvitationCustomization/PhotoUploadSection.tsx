import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, X, AlertCircle, Crop } from "lucide-react";
import { PhotoCropDialog } from "./PhotoCropDialog";

interface PhotoUploadSectionProps {
  onSaveTheDatePhotoChange: (file: File | null) => void;
  onDigitalInvitationPhotoChange: (file: File | null) => void;
  saveTheDatePreviewUrl: string | null;
  digitalInvitationPreviewUrl: string | null;
  isLoading?: boolean;
}

export function PhotoUploadSection({
  onSaveTheDatePhotoChange,
  onDigitalInvitationPhotoChange,
  saveTheDatePreviewUrl,
  digitalInvitationPreviewUrl,
  isLoading = false,
}: PhotoUploadSectionProps) {
  const [saveTheDateError, setSaveTheDateError] = useState<string | null>(null);
  const [digitalInvitationError, setDigitalInvitationError] = useState<
    string | null
  >(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropType, setCropType] = useState<"save-the-date" | "digital-invitation" | null>(null);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);

  const validateFile = (file: File): string | null => {
    const allowedMimes = ["image/png", "image/jpeg", "image/webp"];
    if (!allowedMimes.includes(file.type)) {
      return "Only PNG, JPG, and WebP images are supported";
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return "Image must be smaller than 5MB";
    }

    return null;
  };

  const handleSaveTheDateChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      onSaveTheDatePhotoChange(null);
      setSaveTheDateError(null);
      return;
    }

    const error = validateFile(file);
    if (error) {
      setSaveTheDateError(error);
      onSaveTheDatePhotoChange(null);
      return;
    }

    setSaveTheDateError(null);
    const url = URL.createObjectURL(file);
    setCropImageUrl(url);
    setCropType("save-the-date");
    setCropOpen(true);
  };

  const handleDigitalInvitationChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      onDigitalInvitationPhotoChange(null);
      setDigitalInvitationError(null);
      return;
    }

    const error = validateFile(file);
    if (error) {
      setDigitalInvitationError(error);
      onDigitalInvitationPhotoChange(null);
      return;
    }

    setDigitalInvitationError(null);
    const url = URL.createObjectURL(file);
    setCropImageUrl(url);
    setCropType("digital-invitation");
    setCropOpen(true);
  };

  const handleCropComplete = (croppedFile: File) => {
    if (cropType === "save-the-date") {
      onSaveTheDatePhotoChange(croppedFile);
    } else if (cropType === "digital-invitation") {
      onDigitalInvitationPhotoChange(croppedFile);
    }
    setCropOpen(false);
    setCropImageUrl(null);
    setCropType(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">📸 Photo Management</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Save the Date Photo */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Save the Date Photo</label>
          <div className="border-2 border-dashed border-border rounded-lg p-6 space-y-3">
            <div className="flex justify-center">
              <Upload className="h-8 w-8 text-muted-foreground" />
            </div>
            <label className="cursor-pointer block text-center">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleSaveTheDateChange}
                disabled={isLoading}
                className="hidden"
              />
              <p className="text-sm font-medium">Click to upload</p>
              <p className="text-xs text-muted-foreground">
                PNG, JPG, or WebP • Max 5MB
              </p>
            </label>

            {saveTheDateError && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded">
                <AlertCircle className="h-4 w-4" />
                {saveTheDateError}
              </div>
            )}

            {saveTheDatePreviewUrl && (
              <div className="space-y-2">
                <div className="relative inline-block w-full">
                  <img
                    src={saveTheDatePreviewUrl}
                    alt="Save the Date preview"
                    className="w-full h-40 object-cover rounded border"
                  />
                  <button
                    onClick={() => {
                      onSaveTheDatePhotoChange(null);
                      setSaveTheDateError(null);
                    }}
                    className="absolute top-2 right-2 p-1 bg-destructive text-white rounded-full hover:bg-destructive/90"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Digital Invitation Photo */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Digital Invitation Photo</label>
          <div className="border-2 border-dashed border-border rounded-lg p-6 space-y-3">
            <div className="flex justify-center">
              <Upload className="h-8 w-8 text-muted-foreground" />
            </div>
            <label className="cursor-pointer block text-center">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleDigitalInvitationChange}
                disabled={isLoading}
                className="hidden"
              />
              <p className="text-sm font-medium">Click to upload</p>
              <p className="text-xs text-muted-foreground">
                PNG, JPG, or WebP • Max 5MB
              </p>
            </label>

            {digitalInvitationError && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded">
                <AlertCircle className="h-4 w-4" />
                {digitalInvitationError}
              </div>
            )}

            {digitalInvitationPreviewUrl && (
              <div className="space-y-2">
                <div className="relative inline-block w-full">
                  <img
                    src={digitalInvitationPreviewUrl}
                    alt="Digital invitation preview"
                    className="w-full h-40 object-cover rounded border"
                  />
                  <button
                    onClick={() => {
                      onDigitalInvitationPhotoChange(null);
                      setDigitalInvitationError(null);
                    }}
                    className="absolute top-2 right-2 p-1 bg-destructive text-white rounded-full hover:bg-destructive/90"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>

      {cropImageUrl && (
        <PhotoCropDialog
          open={cropOpen}
          onClose={() => {
            setCropOpen(false);
            setCropImageUrl(null);
            setCropType(null);
          }}
          imageUrl={cropImageUrl}
          onCropComplete={handleCropComplete}
        />
      )}
    </Card>
  );
}
