import { forwardRef, useState } from "react";
import type {
  ColorPalette,
  TextOverrides,
  ElementOverride,
} from "@/types/invitations";
import {
  EditableText,
  EditableImage,
  EditableToolbar,
} from "./EditableElements";
import { LayoutDecorations } from "./LayoutDecorations";

interface DigitalInvitationPreviewProps {
  photoUrl: string | null;
  venue: string;
  location: string;
  venueCity?: string;
  venueState?: string;
  venueZip?: string;
  ceremonyTime: string;
  receptionTime: string;
  guestName: string;
  colors: ColorPalette;
  font: string;
  layout?: string;
  backgroundColor: string | null;
  partner1Name: string;
  partner2Name: string;
  weddingDate: string;
  textOverrides: TextOverrides;
  onTextOverridesChange: (next: TextOverrides) => void;
  editable?: boolean;
}

const CANVAS_W = 500;
const CANVAS_H = 920;
const PHOTO_W = 460;
const PHOTO_H = 180;

const PREFIX = "dig:";

/** Convert "17:30" or "5:30 PM" → "5:30 PM".  Passes through already-formatted strings. */
function formatTime(t: string): string {
  if (!t) return t;
  const m24 = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m24) return t;
  let h = parseInt(m24[1], 10);
  const min = m24[2];
  const period = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${min} ${period}`;
}

export const DigitalInvitationPreview = forwardRef<
  HTMLDivElement,
  DigitalInvitationPreviewProps
>(function DigitalInvitationPreview(
  {
    photoUrl,
    venue,
    location,
    venueCity,
    venueState,
    venueZip,
    ceremonyTime,
    receptionTime,
    guestName,
    colors,
    font,
    layout = "classic",
    backgroundColor,
    partner1Name,
    partner2Name,
    weddingDate,
    textOverrides,
    onTextOverridesChange,
    editable = true,
  },
  ref,
) {
  const cityStateZip = [venueCity, [venueState, venueZip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const formattedDate = (() => {
    const d = new Date(weddingDate);
    if (isNaN(d.getTime())) return weddingDate;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  })();
  const couple =
    partner1Name && partner2Name
      ? `${partner1Name} & ${partner2Name}`
      : partner1Name || partner2Name || "Couple Names";

  const updateOverride = (id: string, patch: ElementOverride) => {
    const cur = textOverrides[id] || {};
    const merged: ElementOverride = { ...cur, ...patch };
    (Object.keys(merged) as (keyof ElementOverride)[]).forEach((k) => {
      if (merged[k] === undefined) delete merged[k];
    });
    const next = { ...textOverrides };
    if (Object.keys(merged).length === 0) {
      delete next[id];
    } else {
      next[id] = merged;
    }
    onTextOverridesChange(next);
  };

  type El = {
    id: string;
    text: string;
    defaultX: number;
    defaultY: number;
    defaultColor: string;
    defaultFontSize: number;
    defaultFont: string;
    fontWeight?: number;
    fontStyle?: "italic" | "normal";
    uppercase?: boolean;
    letterSpacing?: string;
  };

  const elements: El[] = [
    {
      id: PREFIX + "greeting",
      text: `Dear ${guestName || "Guest"},`,
      defaultX: CANVAS_W / 2,
      defaultY: 230,
      defaultColor: colors.neutral,
      defaultFontSize: 18,
      defaultFont: "Cormorant Garamond",
      fontWeight: 500,
    },
    {
      id: PREFIX + "request",
      text: "request the honor of your presence",
      defaultX: CANVAS_W / 2,
      defaultY: 270,
      defaultColor: colors.neutral,
      defaultFontSize: 15,
      defaultFont: "Cormorant Garamond",
      fontStyle: "italic",
    },
    {
      id: PREFIX + "couple",
      text: couple,
      defaultX: CANVAS_W / 2,
      defaultY: 320,
      defaultColor: colors.primary,
      defaultFontSize: 36,
      defaultFont: "Great Vibes",
      fontWeight: 600,
    },
    {
      id: PREFIX + "date-label",
      text: "DATE",
      defaultX: CANVAS_W / 2,
      defaultY: 410,
      defaultColor: colors.neutral,
      defaultFontSize: 11,
      defaultFont: font || "Montserrat",
      fontWeight: 600,
      uppercase: true,
      letterSpacing: "0.2em",
    },
    {
      id: PREFIX + "date-value",
      text: formattedDate,
      defaultX: CANVAS_W / 2,
      defaultY: 432,
      defaultColor: colors.primary,
      defaultFontSize: 18,
      defaultFont: font || "Cormorant Garamond",
      fontWeight: 600,
    },
    {
      id: PREFIX + "ceremony-label",
      text: "CEREMONY",
      defaultX: CANVAS_W / 2,
      defaultY: 480,
      defaultColor: colors.neutral,
      defaultFontSize: 11,
      defaultFont: font || "Montserrat",
      fontWeight: 600,
      uppercase: true,
      letterSpacing: "0.2em",
    },
    {
      id: PREFIX + "ceremony-value",
      text: formatTime(ceremonyTime || ""),
      defaultX: CANVAS_W / 2,
      defaultY: 502,
      defaultColor: colors.primary,
      defaultFontSize: 16,
      defaultFont: font || "Cormorant Garamond",
    },
    {
      id: PREFIX + "reception-label",
      text: "RECEPTION",
      defaultX: CANVAS_W / 2,
      defaultY: 548,
      defaultColor: colors.neutral,
      defaultFontSize: 11,
      defaultFont: font || "Montserrat",
      fontWeight: 600,
      uppercase: true,
      letterSpacing: "0.2em",
    },
    {
      id: PREFIX + "reception-value",
      text: formatTime(receptionTime || ""),
      defaultX: CANVAS_W / 2,
      defaultY: 570,
      defaultColor: colors.primary,
      defaultFontSize: 16,
      defaultFont: font || "Cormorant Garamond",
    },
    {
      id: PREFIX + "venue-label",
      text: "VENUE",
      defaultX: CANVAS_W / 2,
      defaultY: 616,
      defaultColor: colors.neutral,
      defaultFontSize: 11,
      defaultFont: font || "Montserrat",
      fontWeight: 600,
      uppercase: true,
      letterSpacing: "0.2em",
    },
    {
      id: PREFIX + "venue-value",
      text: venue || "",
      defaultX: CANVAS_W / 2,
      defaultY: 638,
      defaultColor: colors.primary,
      defaultFontSize: 18,
      defaultFont: font || "Cormorant Garamond",
      fontWeight: 600,
    },
    {
      id: PREFIX + "location",
      text: location || "",
      defaultX: CANVAS_W / 2,
      defaultY: 660,
      defaultColor: colors.neutral,
      defaultFontSize: 14,
      defaultFont: font || "Cormorant Garamond",
    },
    ...(cityStateZip ? [{
      id: PREFIX + "city-state-zip",
      text: cityStateZip,
      defaultX: CANVAS_W / 2,
      defaultY: 684,
      defaultColor: colors.neutral,
      defaultFontSize: 14,
      defaultFont: font || "Cormorant Garamond",
    }] : []),
    {
      id: PREFIX + "footer-label",
      text: "Together with their families",
      defaultX: CANVAS_W / 2,
      defaultY: 800,
      defaultColor: colors.neutral,
      defaultFontSize: 12,
      defaultFont: font || "Cormorant Garamond",
      fontStyle: "italic",
    },
    {
      id: PREFIX + "footer-couple",
      text: couple,
      defaultX: CANVAS_W / 2,
      defaultY: 825,
      defaultColor: colors.primary,
      defaultFontSize: 18,
      defaultFont: "Great Vibes",
    },
  ];

  const photoId = PREFIX + "photo";
  const photoOverride = textOverrides[photoId];
  const selectedEl = elements.find((e) => e.id === selectedId);

  return (
    <div className="flex flex-col items-center">
      <div className="h-12 mb-2 flex items-center justify-center">
        {editable && selectedEl ? (
          <EditableToolbar
            override={textOverrides[selectedEl.id]}
            defaults={{
              font: selectedEl.defaultFont,
              color: selectedEl.defaultColor,
              fontSize: selectedEl.defaultFontSize,
            }}
            onChange={(patch) => updateOverride(selectedEl.id, patch)}
            onReset={() =>
              updateOverride(selectedEl.id, {
                x: undefined,
                y: undefined,
                font: undefined,
                color: undefined,
                fontSize: undefined,
              })
            }
            onClose={() => setSelectedId(null)}
            label="Text"
          />
        ) : editable && selectedId === photoId ? (
          <EditableToolbar
            override={photoOverride}
            defaults={{ font: "", color: "", fontSize: 0 }}
            showFont={false}
            showColor={false}
            showFontSize={false}
            onChange={() => {}}
            onReset={() =>
              updateOverride(photoId, { x: undefined, y: undefined })
            }
            onClose={() => setSelectedId(null)}
            label="Photo"
          />
        ) : editable ? (
          <p className="text-xs text-muted-foreground">
            Click any text or the photo to edit. Drag to reposition.
          </p>
        ) : null}
      </div>

      <div
        ref={ref}
        className="rounded-lg border border-border relative shadow-sm overflow-hidden"
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          backgroundColor: backgroundColor || "#FFFFFF",
        }}
        onPointerDown={() => setSelectedId(null)}
      >
        {/* Layout decoration overlay — rendered behind content */}
        <LayoutDecorations
          layout={layout}
          colors={colors}
          canvasW={CANVAS_W}
          canvasH={CANVAS_H}
        />

        <EditableImage
          id={photoId}
          src={photoUrl}
          width={PHOTO_W}
          height={PHOTO_H}
          defaultX={CANVAS_W / 2}
          defaultY={20}
          override={photoOverride}
          selected={selectedId === photoId}
          onSelect={setSelectedId}
          onChange={updateOverride}
          editable={editable}
          fallbackBg={colors.secondary + "20"}
        />

        {/* Decorative divider — not draggable */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: CANVAS_W / 2 - 100,
            top: 380,
            width: 200,
            height: 1,
            backgroundColor: colors.accent,
            opacity: 0.5,
          }}
        />

        {elements.map((el) => (
          <EditableText
            key={el.id}
            id={el.id}
            text={el.text}
            defaultX={el.defaultX}
            defaultY={el.defaultY}
            defaultColor={el.defaultColor}
            defaultFontSize={el.defaultFontSize}
            defaultFont={el.defaultFont}
            fontWeight={el.fontWeight}
            fontStyle={el.fontStyle}
            uppercase={el.uppercase}
            letterSpacing={el.letterSpacing}
            override={textOverrides[el.id]}
            selected={selectedId === el.id}
            onSelect={setSelectedId}
            onChange={updateOverride}
            editable={editable}
          />
        ))}
      </div>
    </div>
  );
});
