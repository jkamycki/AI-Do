import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, X, AlertCircle, Crop } from "lucide-react";
import { InvitationCropDialog } from "@/components/InvitationCropDialog";

interface PhotoUploadSectionProps {
  mode: "saveTheDate" | "digitalInvitation";
  onSaveTheDatePhotoChange: (file: File | null) => void;
  onDigitalInvitationPhotoChange: (file: File | null) => void;
  saveTheDatePreviewUrl: string | null;
  digitalInvitationPreviewUrl: string | null;
  isLoading?: boolean;
}

export function PhotoUploadSection({
  mode,
  onSaveTheDatePhotoChange,
  onDigitalInvitationPhotoChange,
  saveTheDatePreviewUrl,
  digitalInvitationPreviewUrl,
  isLoading = false,
}: PhotoUploadSectionProps) {
  const [saveTheDateError, setSaveTheDateError] = useState<string | null>(null);
  const [digitalInvitationError, setDigitalInvitationError] = useState<string | null>(null);

  const [cropOpen, setCropOpen] = useState(false);
  const [cropType, setCropType] = useState<"save-the-date" | "digital-invitation" | null>(null);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState<string>("photo");

  // Incrementing this key resets the <input> so the same file can be selected again
  const [inputKey, setInputKey] = useState(0);

  const validateFile = (file: File): string | null => {
    const allowedMimes = ["image/png", "image/jpeg", "image/webp"];
    if (!allowedMimes.includes(file.type)) {
      return "Only PNG, JPG, and WebP images are supported";
    }
    if (file.size > 5 * 1024 * 1024) {
      return "Image must be smaller than 5MB";
    }
    return null;
  };

  const openCrop = (file: File, type: "save-the-date" | "digital-invitation") => {
    const url = URL.createObjectURL(file);
    setCropImageUrl(url);
    setCropFileName(file.name);
    setCropType(type);
    setCropOpen(true);
  };

  const handleSaveTheDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) { onSaveTheDatePhotoChange(null); setSaveTheDateError(null); return; }
    const error = validateFile(file);
    if (error) { setSaveTheDateError(error); onSaveTheDatePhotoChange(null); return; }
    setSaveTheDateError(null);
    openCrop(file, "save-the-date");
  };

  const handleDigitalInvitationChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) { onDigitalInvitationPhotoChange(null); setDigitalInvitationError(null); return; }
    const error = validateFile(file);
    if (error) { setDigitalInvitationError(error); onDigitalInvitationPhotoChange(null); return; }
    setDigitalInvitationError(null);
    openCrop(file, "digital-invitation");
  };

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

  const isSaveTheDate = mode === "saveTheDate";
  const label = isSaveTheDate ? "Save the Date" : "Digital Invitation";
  const previewUrl = isSaveTheDate ? saveTheDatePreviewUrl : digitalInvitationPreviewUrl;
  const error = isSaveTheDate ? saveTheDateError : digitalInvitationError;
  const handleChange = isSaveTheDate ? handleSaveTheDateChange : handleDigitalInvitationChange;
  const testId = isSaveTheDate ? "save-the-date-photo-input" : "digital-invitation-photo-input";

  const handleRemove = () => {
    if (isSaveTheDate) { onSaveTheDatePhotoChange(null); setSaveTheDateError(null); }
    else { onDigitalInvitationPhotoChange(null); setDigitalInvitationError(null); }
    setInputKey(k => k + 1);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">📸 Photo</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <label className="text-sm font-medium">{label} Photo</label>
          <div className="border-2 border-dashed border-border rounded-lg p-6 space-y-3">
            <div className="flex justify-center">
              <Upload className="h-8 w-8 text-muted-foreground" />
            </div>
            <label className="cursor-pointer block text-center">
              <input
                key={inputKey}
                data-testid={testId}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleChange}
                disabled={isLoading}
                className="hidden"
              />
              <p className="text-sm font-medium">Click to upload</p>
              <p className="text-xs text-muted-foreground">PNG, JPG, or WebP • Max 5MB</p>
            </label>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {previewUrl && (
              <div className="space-y-2">
                <div className="relative inline-block w-full">
                  <img
                    src={previewUrl}
                    alt={`${label} preview`}
                    className="w-full h-40 object-cover rounded border"
                  />
                  <div className="absolute top-2 right-2 flex gap-1">
                    <button
                      onClick={() => {
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
                      onClick={handleRemove}
                      className="p-1 bg-destructive text-white rounded-full hover:bg-destructive/90"
                      title="Remove photo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
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
