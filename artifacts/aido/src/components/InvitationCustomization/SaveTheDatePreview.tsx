import { useEffect } from "react";
import type { ColorPalette } from "@/types/invitations";

interface SaveTheDatePreviewProps {
  photoUrl: string | null;
  weddingDate: string;
  colors: ColorPalette;
  font: string;
  backgroundColor: string | null;
  partner1Name?: string;
  partner2Name?: string;
  location?: string;
}

export function SaveTheDatePreview({
  photoUrl,
  weddingDate,
  colors,
  font,
  backgroundColor,
  partner1Name,
  partner2Name,
  location,
}: SaveTheDatePreviewProps) {
  useEffect(() => {
    const fontMap: Record<string, string> = {
      "Playfair Display": "Playfair+Display:wght@400;700",
      "Cormorant Garamond": "Cormorant+Garamond:wght@400;700",
      "Great Vibes": "Great+Vibes:wght@400",
      "Dancing Script": "Dancing+Script:wght@400;700",
      "Montserrat": "Montserrat:wght@400;700",
      "Open Sans": "Open+Sans:wght@400;700",
      "Lora": "Lora:wght@400;700",
      "Merriweather": "Merriweather:wght@400;700",
      "Raleway": "Raleway:wght@400;700",
      "Poppins": "Poppins:wght@400;700",
      "Inter": "Inter:wght@400;700",
      "Source Sans Pro": "Source+Sans+Pro:wght@400;700",
    };

    const fontKey = fontMap[font];
    if (!fontKey) return;

    const link = document.createElement("link");
    link.href = `https://fonts.googleapis.com/css2?family=${fontKey}&display=swap`;
    link.rel = "stylesheet";
    document.head.appendChild(link);

    return () => {
      document.head.removeChild(link);
    };
  }, [font]);

  const previewStyles = {
    backgroundColor: backgroundColor || "#FFFFFF",
    fontFamily: font,
  };

  const dateObj = new Date(weddingDate);
  const formattedDate = isNaN(dateObj.getTime())
    ? weddingDate
    : `${String(dateObj.getMonth() + 1).padStart(2, "0")}.${String(
        dateObj.getDate(),
      ).padStart(2, "0")}.${dateObj.getFullYear()}`;

  const coupleNames =
    partner1Name && partner2Name
      ? `${partner1Name} & ${partner2Name}`
      : partner1Name || partner2Name || "";

  const dateLocation = location ? `${formattedDate} – ${location}` : formattedDate;

  return (
    <div
      className="w-full h-full p-8 flex flex-col items-center justify-center space-y-6 rounded-lg border border-border"
      style={previewStyles}
    >
      {/* Heading */}
      <h1
        className="text-4xl font-bold text-center tracking-wide uppercase"
        style={{ color: colors.primary }}
      >
        Save the Date
      </h1>

      {/* Photo */}
      {photoUrl ? (
        <div className="w-full max-w-sm h-56 rounded-lg overflow-hidden border border-border shadow-md">
          <img
            src={photoUrl}
            alt="Save the Date"
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div
          className="w-full max-w-sm h-56 rounded-lg border-2 border-dashed border-border flex items-center justify-center"
          style={{ backgroundColor: colors.secondary + "20" }}
        >
          <p className="text-muted-foreground">Photo preview</p>
        </div>
      )}

      {/* Couple names */}
      {coupleNames && (
        <p
          className="text-3xl font-semibold text-center"
          style={{ color: colors.primary }}
        >
          {coupleNames}
        </p>
      )}

      {/* Date – Location */}
      <p
        className="text-xl font-medium text-center"
        style={{ color: colors.accent }}
      >
        {dateLocation}
      </p>
    </div>
  );
}
