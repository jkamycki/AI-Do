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

interface SaveTheDatePreviewProps {
  photoUrl: string | null;
  weddingDate: string;
  colors: ColorPalette;
  font: string;
  layout?: string;
  backgroundColor: string | null;
  partner1Name?: string;
  partner2Name?: string;
  location?: string;
  venueCity?: string;
  venueState?: string;
  venueZip?: string;
  message?: string;
  textOverrides: TextOverrides;
  onTextOverridesChange: (next: TextOverrides) => void;
  editable?: boolean;
}

const CANVAS_W = 500;
const CANVAS_H = 680;
const PHOTO_W = 340;
const PHOTO_H = 220;

const PREFIX = "std:";

export const SaveTheDatePreview = forwardRef<HTMLDivElement, SaveTheDatePreviewProps>(
  function SaveTheDatePreview(
    {
      photoUrl,
      weddingDate,
      colors,
      font,
      layout = "classic",
      backgroundColor,
      partner1Name,
      partner2Name,
      location,
      venueCity,
      venueState,
      venueZip,
      message,
      textOverrides,
      onTextOverridesChange,
      editable = true,
    },
    ref,
  ) {
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const formattedDate = (() => {
      const parts = weddingDate ? weddingDate.split("-").map(Number) : [];
      if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
        const [y, mo, d] = parts;
        return `${String(mo).padStart(2, "0")}.${String(d).padStart(2, "0")}.${y}`;
      }
      return weddingDate || "";
    })();
    const couple =
      partner1Name && partner2Name
        ? `${partner1Name} & ${partner2Name}`
        : partner1Name || partner2Name || "Couple Names";
    const cityStateZip = [venueCity, [venueState, venueZip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    const dateLine = location ? `${formattedDate}  –  ${location}` : formattedDate;

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

    const elements = [
      {
        id: PREFIX + "heading",
        text: "Save the Date",
        defaultX: CANVAS_W / 2,
        defaultY: 40,
        defaultColor: colors.primary,
        defaultFontSize: 38,
        defaultFont: font || "Playfair Display",
        fontWeight: 700 as const,
        uppercase: true,
        letterSpacing: "0.15em",
      },
      {
        id: PREFIX + "couple",
        text: couple,
        defaultX: CANVAS_W / 2,
        defaultY: 375,
        defaultColor: colors.primary,
        defaultFontSize: 36,
        defaultFont: "Great Vibes",
        fontWeight: 600 as const,
      },
      {
        id: PREFIX + "date",
        text: dateLine,
        defaultX: CANVAS_W / 2,
        defaultY: 460,
        defaultColor: colors.accent,
        defaultFontSize: 20,
        defaultFont: font || "Cormorant Garamond",
        fontWeight: 500 as const,
      },
      ...(cityStateZip ? [{
        id: PREFIX + "city-state-zip",
        text: cityStateZip,
        defaultX: CANVAS_W / 2,
        defaultY: 490,
        defaultColor: colors.accent,
        defaultFontSize: 16,
        defaultFont: font || "Cormorant Garamond",
        fontWeight: 400 as const,
      }] : []),
      ...(message ? [{
        id: PREFIX + "message",
        text: message,
        defaultX: CANVAS_W / 2,
        defaultY: 555,
        defaultColor: colors.primary,
        defaultFontSize: 15,
        defaultFont: font || "Cormorant Garamond",
        fontWeight: 400 as const,
        fontStyle: "italic" as const,
      }] : []),
    ];

    const photoId = PREFIX + "photo";
    const photoOverride = textOverrides[photoId];
    const selectedEl = elements.find((e) => e.id === selectedId);

    return (
      <div className="flex flex-col items-center">
        {/* Toolbar lives outside the captured canvas so it never appears in PDF exports */}
        {editable && (
          <div className="min-h-[3rem] h-auto mb-2 flex items-center justify-center sticky top-0 z-10 bg-card py-1">
            {selectedEl ? (
              <EditableToolbar
                override={textOverrides[selectedEl.id]}
                defaults={{
                  font: selectedEl.defaultFont,
                  color: selectedEl.defaultColor,
                  fontSize: selectedEl.defaultFontSize,
                }}
                defaultText={textOverrides[selectedEl.id]?.text ?? selectedEl.text}
                onChange={(patch) => updateOverride(selectedEl.id, patch)}
                onReset={() =>
                  updateOverride(selectedEl.id, {
                    x: undefined,
                    y: undefined,
                    font: undefined,
                    color: undefined,
                    fontSize: undefined,
                    text: undefined,
                  })
                }
                onClose={() => setSelectedId(null)}
                label="Text"
              />
            ) : selectedId === photoId ? (
              <EditableToolbar
                override={photoOverride}
                defaults={{ font: "", color: "", fontSize: 0 }}
                showFont={false}
                showColor={false}
                showFontSize={false}
                onChange={() => {}}
                onReset={() =>
                  updateOverride(photoId, { x: undefined, y: undefined, objectX: undefined, objectY: undefined })
                }
                onClose={() => setSelectedId(null)}
                label="Photo — drag to reposition"
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                Click any text to edit · Click &amp; drag the photo to reposition it in the frame
              </p>
            )}
          </div>
        )}

        {/* Canvas (this is the ref'd element captured by html2canvas) */}
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

          {/* A.IDO logo — always visible at top of canvas */}
          <div
            className="absolute pointer-events-none"
            style={{ top: 8, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 10 }}
          >
            <img
              src="/logo.png"
              alt="A.IDO"
              style={{ height: 36, width: "auto", objectFit: "contain", opacity: 0.85 }}
            />
          </div>

          <EditableImage
            id={photoId}
            src={photoUrl}
            width={PHOTO_W}
            height={PHOTO_H}
            defaultX={CANVAS_W / 2}
            defaultY={120}
            override={photoOverride}
            selected={selectedId === photoId}
            onSelect={setSelectedId}
            onChange={updateOverride}
            editable={editable}
            fallbackBg={colors.secondary + "20"}
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
  },
);
