import type { ColorPalette } from "@/types/invitations";

interface DigitalInvitationPreviewProps {
  photoUrl: string | null;
  venue: string;
  location: string;
  ceremonyTime: string;
  receptionTime: string;
  guestName: string;
  colors: ColorPalette;
  font: string;
  backgroundColor: string | null;
  partner1Name: string;
  partner2Name: string;
  weddingDate: string;
}

export function DigitalInvitationPreview({
  photoUrl,
  venue,
  location,
  ceremonyTime,
  receptionTime,
  guestName,
  colors,
  font,
  backgroundColor,
  partner1Name,
  partner2Name,
  weddingDate,
}: DigitalInvitationPreviewProps) {
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
      className="w-full h-full p-6 overflow-y-auto rounded-lg border border-border space-y-4"
      style={previewStyles}
    >
      {/* Photo */}
      {photoUrl ? (
        <div className="w-full h-32 rounded-lg overflow-hidden border border-border shadow-md">
          <img
            src={photoUrl}
            alt="Invitation"
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div
          className="w-full h-32 rounded-lg border-2 border-dashed border-border flex items-center justify-center"
          style={{ backgroundColor: colors.secondary + "20" }}
        >
          <p className="text-muted-foreground">Photo preview</p>
        </div>
      )}

      {/* Guest Greeting */}
      <div className="space-y-1">
        <p style={{ color: colors.neutral }}>Dear {guestName || "Guest Name"},</p>
      </div>

      {/* Divider */}
      <div
        className="h-px"
        style={{ backgroundColor: colors.accent }}
      />

      {/* Wedding Couple Names */}
      <div className="text-center space-y-1">
        <h2
          className="text-xl font-bold"
          style={{ color: colors.primary }}
        >
          {partner1Name} & {partner2Name}
        </h2>
        <p style={{ color: colors.neutral }}>request your presence</p>
      </div>

      {/* Wedding Details */}
      <div
        className="p-4 rounded-lg space-y-2"
        style={{ backgroundColor: colors.secondary + "20" }}
      >
        <div>
          <p className="text-xs font-medium" style={{ color: colors.neutral }}>
            DATE
          </p>
          <p className="text-sm font-semibold">{formattedDate}</p>
        </div>

        <div>
          <p className="text-xs font-medium" style={{ color: colors.neutral }}>
            CEREMONY
          </p>
          <p className="text-sm">{ceremonyTime}</p>
        </div>

        <div>
          <p className="text-xs font-medium" style={{ color: colors.neutral }}>
            RECEPTION
          </p>
          <p className="text-sm">{receptionTime}</p>
        </div>

        <div>
          <p className="text-xs font-medium" style={{ color: colors.neutral }}>
            VENUE
          </p>
          <p className="text-sm font-semibold">{venue}</p>
          <p className="text-xs text-muted-foreground">{location}</p>
        </div>
      </div>

      {/* RSVP Section */}
      <div className="space-y-3 pt-2">
        <p className="text-sm font-semibold">RSVP</p>
        <select
          className="w-full px-3 py-2 border rounded text-sm"
          style={{
            borderColor: colors.accent,
            backgroundColor: colors.secondary + "10",
          }}
        >
          <option>Select your response...</option>
          <option>Joyfully Accepts</option>
          <option>Declines with Thanks</option>
          <option>Unsure</option>
        </select>

        <div>
          <label className="text-sm font-medium">Meal Choice</label>
          <select
            className="w-full px-3 py-2 border rounded text-sm mt-1"
            style={{
              borderColor: colors.accent,
              backgroundColor: colors.secondary + "10",
            }}
          >
            <option>Select meal preference...</option>
            <option>Chicken</option>
            <option>Fish</option>
            <option>Vegetarian</option>
            <option>Vegan</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="rounded"
            style={{ accentColor: colors.accent }}
          />
          I will bring a plus one
        </label>
      </div>

      {/* Footer */}
      <div
        className="text-center pt-4 text-xs"
        style={{ color: colors.neutral }}
      >
        <p>Together with their families</p>
        <p>{partner1Name} & {partner2Name}</p>
      </div>
    </div>
  );
}
