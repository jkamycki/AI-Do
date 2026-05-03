import type { ColorPalette } from "@/types/invitations";

interface SaveTheDatePreviewProps {
  photoUrl: string | null;
  weddingDate: string;
  colors: ColorPalette;
  font: string;
  backgroundColor: string | null;
}

export function SaveTheDatePreview({
  photoUrl,
  weddingDate,
  colors,
  font,
  backgroundColor,
}: SaveTheDatePreviewProps) {
  const previewStyles = {
    backgroundColor: backgroundColor || "#FFFFFF",
    fontFamily: font,
  };

  const formattedDate = new Date(weddingDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      className="w-full h-full p-8 flex flex-col items-center justify-center space-y-6 rounded-lg border border-border"
      style={previewStyles}
    >
      {/* Heading */}
      <h1
        className="text-4xl font-bold text-center"
        style={{ color: colors.primary }}
      >
        Save the Date
      </h1>

      {/* Photo */}
      {photoUrl ? (
        <div className="w-full max-w-xs h-40 rounded-lg overflow-hidden border border-border shadow-md">
          <img
            src={photoUrl}
            alt="Save the Date"
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div
          className="w-full max-w-xs h-40 rounded-lg border-2 border-dashed border-border flex items-center justify-center"
          style={{ backgroundColor: colors.secondary + "20" }}
        >
          <p className="text-muted-foreground">Photo preview</p>
        </div>
      )}

      {/* Wedding Date */}
      <p
        className="text-2xl font-semibold text-center"
        style={{ color: colors.accent }}
      >
        {formattedDate}
      </p>
    </div>
  );
}
