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
      textOverrides,
      onTextOverridesChange,
      editable = true,
    },
    ref,
  ) {
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const dateObj = new Date(weddingDate);
    const formattedDate = isNaN(dateObj.getTime())
      ? weddingDate
      : `${String(dateObj.getMonth() + 1).padStart(2, "0")}.${String(
          dateObj.getDate(),
        ).padStart(2, "0")}.${dateObj.getFullYear()}`;
    const couple =
      partner1Name && partner2Name
        ? `${partner1Name} & ${partner2Name}`
        : partner1Name || partner2Name || "Couple Names";
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
        defaultY: 380,
        defaultColor: colors.primary,
        defaultFontSize: 36,
        defaultFont: "Great Vibes",
        fontWeight: 600 as const,
      },
      {
        id: PREFIX + "date",
        text: dateLine,
        defaultX: CANVAS_W / 2,
        defaultY: 470,
        defaultColor: colors.accent,
        defaultFontSize: 20,
        defaultFont: "Cormorant Garamond",
        fontWeight: 500 as const,
      },
    ];

    const photoId = PREFIX + "photo";
    const photoOverride = textOverrides[photoId];
    const selectedEl = elements.find((e) => e.id === selectedId);

    return (
      <div className="flex flex-col items-center">
        {/* Toolbar lives outside the captured canvas so it never appears in PDF exports */}
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
