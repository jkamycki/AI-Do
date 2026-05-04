import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { ElementOverride } from "@/types/invitations";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const FONT_GROUPS = [
  {
    label: "Script & Calligraphy",
    fonts: ["Great Vibes", "Dancing Script", "Sacramento", "Tangerine", "Parisienne"],
  },
  {
    label: "Elegant Serif",
    fonts: [
      "Playfair Display",
      "Cormorant Garamond",
      "Cinzel",
      "EB Garamond",
      "Lora",
      "Merriweather",
      "Libre Baskerville",
      "Crimson Text",
    ],
  },
  {
    label: "Modern Sans-Serif",
    fonts: ["Montserrat", "Raleway", "Poppins", "Inter", "Open Sans", "Josefin Sans", "Quicksand"],
  },
  {
    label: "Classic",
    fonts: ["Georgia", "Garamond", "Times New Roman", "Arial"],
  },
];

export const FONT_OPTIONS = FONT_GROUPS.flatMap((g) => g.fonts);

const GOOGLE_FONT_MAP: Record<string, string> = {
  "Great Vibes": "Great+Vibes",
  "Dancing Script": "Dancing+Script:wght@400;700",
  Sacramento: "Sacramento",
  Tangerine: "Tangerine:wght@400;700",
  Parisienne: "Parisienne",
  "Playfair Display": "Playfair+Display:ital,wght@0,400;0,700;1,400",
  "Cormorant Garamond": "Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,700;1,400",
  Cinzel: "Cinzel:wght@400;600;700",
  "EB Garamond": "EB+Garamond:ital,wght@0,400;0,700;1,400",
  Lora: "Lora:ital,wght@0,400;0,700;1,400",
  Merriweather: "Merriweather:ital,wght@0,400;0,700;1,400",
  "Libre Baskerville": "Libre+Baskerville:ital,wght@0,400;0,700;1,400",
  "Crimson Text": "Crimson+Text:ital,wght@0,400;0,700;1,400",
  Montserrat: "Montserrat:ital,wght@0,400;0,600;0,700;1,400",
  Raleway: "Raleway:wght@400;600;700",
  Poppins: "Poppins:wght@400;600;700",
  Inter: "Inter:wght@400;600;700",
  "Open Sans": "Open+Sans:ital,wght@0,400;0,600;1,400",
  "Josefin Sans": "Josefin+Sans:ital,wght@0,300;0,400;0,600;1,300;1,400",
  Quicksand: "Quicksand:wght@400;600;700",
  // Georgia, Garamond, Times New Roman, Arial are system fonts — no Google Fonts needed
};

let fontsLoaded = false;
export function ensureFontsLoaded() {
  if (fontsLoaded || typeof document === "undefined") return;
  fontsLoaded = true;
  const families = Object.values(GOOGLE_FONT_MAP).join("&family=");
  const link = document.createElement("link");
  link.href = `https://fonts.googleapis.com/css2?family=${families}&display=swap`;
  link.rel = "stylesheet";
  link.dataset["editableFonts"] = "true";
  document.head.appendChild(link);
}

function useDrag(
  id: string,
  enabled: boolean,
  override: ElementOverride | undefined,
  defaultX: number,
  defaultY: number,
  onSelect: (id: string) => void,
  onChange: (id: string, patch: ElementOverride) => void,
) {
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(
    null,
  );
  const movedRef = useRef(false);

  const x = override?.x ?? defaultX;
  const y = override?.y ?? defaultY;

  return {
    x,
    y,
    onPointerDown: (e: React.PointerEvent) => {
      if (!enabled) return;
      e.stopPropagation();
      movedRef.current = false;
      dragRef.current = { sx: e.clientX, sy: e.clientY, ox: x, oy: y };
      onSelect(id);
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.sx;
      const dy = e.clientY - dragRef.current.sy;
      if (Math.abs(dx) + Math.abs(dy) > 2) movedRef.current = true;
      if (movedRef.current) {
        onChange(id, {
          x: Math.round(dragRef.current.ox + dx),
          y: Math.round(dragRef.current.oy + dy),
        });
      }
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      dragRef.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        /* noop */
      }
    },
  };
}

export interface EditableTextProps {
  id: string;
  text: string;
  defaultX: number;
  defaultY: number;
  defaultColor: string;
  defaultFontSize: number;
  defaultFont: string;
  fontWeight?: number | string;
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right";
  uppercase?: boolean;
  letterSpacing?: string;
  override?: ElementOverride;
  selected: boolean;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: ElementOverride) => void;
  editable: boolean;
  maxWidth?: number;
}

export function EditableText({
  id,
  text,
  defaultX,
  defaultY,
  defaultColor,
  defaultFontSize,
  defaultFont,
  fontWeight,
  fontStyle,
  textAlign = "center",
  uppercase,
  letterSpacing,
  override,
  selected,
  onSelect,
  onChange,
  editable,
  maxWidth = 460,
}: EditableTextProps) {
  useEffect(() => {
    ensureFontsLoaded();
  }, []);
  const drag = useDrag(id, editable, override, defaultX, defaultY, onSelect, onChange);
  const font = override?.font ?? defaultFont;
  const color = override?.color ?? defaultColor;
  const fontSize = override?.fontSize ?? defaultFontSize;

  const hasXOverride = override?.x !== undefined;

  const positionStyle: CSSProperties = hasXOverride
    ? {
        left: drag.x,
        top: drag.y,
        transform: textAlign === "center" ? "translateX(-50%)" : undefined,
      }
    : {
        left: 0,
        right: 0,
        top: drag.y,
      };

  return (
    <div
      onPointerDown={drag.onPointerDown}
      onPointerMove={drag.onPointerMove}
      onPointerUp={drag.onPointerUp}
      onPointerCancel={drag.onPointerUp}
      className={[
        "absolute whitespace-pre-wrap select-none rounded",
        editable ? "cursor-move" : "",
        selected
          ? "ring-2 ring-blue-500 ring-offset-1"
          : editable
            ? "hover:ring-1 hover:ring-blue-300"
            : "",
      ].join(" ")}
      style={{
        ...positionStyle,
        color,
        fontFamily: `"${font}", serif`,
        fontSize,
        fontWeight,
        fontStyle,
        textAlign,
        textTransform: uppercase ? "uppercase" : undefined,
        letterSpacing,
        maxWidth: hasXOverride ? maxWidth : undefined,
        padding: "2px 6px",
        lineHeight: 1.2,
      }}
      data-editable-id={id}
    >
      {override?.text ?? text}
    </div>
  );
}

export interface EditableImageProps {
  id: string;
  src: string | null;
  width: number;
  height: number;
  defaultX: number;
  defaultY: number;
  override?: ElementOverride;
  selected: boolean;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: ElementOverride) => void;
  editable: boolean;
  fallbackBg?: string;
  placeholder?: string;
}

export function EditableImage({
  id,
  src,
  width,
  height,
  defaultX,
  defaultY,
  override,
  selected,
  onSelect,
  onChange,
  editable,
  fallbackBg,
  placeholder = "Photo preview",
}: EditableImageProps) {
  const x = override?.x ?? defaultX;
  const y = override?.y ?? defaultY;
  const objectX = override?.objectX ?? 50;
  const objectY = override?.objectY ?? 50;

  const panRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const panMovedRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!editable) return;
    e.stopPropagation();
    onSelect(id);
    panMovedRef.current = false;
    panRef.current = { sx: e.clientX, sy: e.clientY, ox: objectX, oy: objectY };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch { /* noop */ }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!panRef.current) return;
    const dx = e.clientX - panRef.current.sx;
    const dy = e.clientY - panRef.current.sy;
    if (Math.abs(dx) + Math.abs(dy) > 2) panMovedRef.current = true;
    if (panMovedRef.current) {
      onChange(id, {
        objectX: Math.max(0, Math.min(100, panRef.current.ox - dx * 0.15)),
        objectY: Math.max(0, Math.min(100, panRef.current.oy - dy * 0.15)),
      });
    }
  };

  const handlePointerUp = () => {
    panRef.current = null;
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={[
        "absolute overflow-hidden rounded-lg shadow-md select-none",
        editable ? "cursor-grab active:cursor-grabbing" : "",
        selected
          ? "ring-2 ring-blue-500 ring-offset-1"
          : editable
            ? "hover:ring-1 hover:ring-blue-300"
            : "",
      ].join(" ")}
      style={{
        left: x,
        top: y,
        width,
        height,
        transform: "translateX(-50%)",
        backgroundColor: fallbackBg,
        border: src ? "1px solid #e5e7eb" : "2px dashed #cbd5e1",
      }}
      data-editable-id={id}
    >
      {src ? (
        <img
          src={src}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: `${objectX}% ${objectY}%`,
            pointerEvents: "none",
          }}
          draggable={false}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm pointer-events-none">
          {placeholder}
        </div>
      )}
    </div>
  );
}

export interface EditableToolbarProps {
  override?: ElementOverride;
  defaults: { font: string; color: string; fontSize: number };
  defaultText?: string;
  onChange: (patch: ElementOverride) => void;
  onReset: () => void;
  onClose: () => void;
  showFont?: boolean;
  showColor?: boolean;
  showFontSize?: boolean;
  label?: string;
}

export function EditableToolbar({
  override,
  defaults,
  defaultText,
  onChange,
  onReset,
  onClose,
  showFont = true,
  showColor = true,
  showFontSize = true,
  label,
}: EditableToolbarProps) {
  const font = override?.font ?? defaults.font;
  const color = override?.color ?? defaults.color;
  const fontSize = override?.fontSize ?? defaults.fontSize;
  const currentText = override?.text ?? defaultText ?? "";
  return (
    <div
      className="rounded-lg shadow-lg p-2 flex flex-col gap-1.5"
      style={{
        background: "#2A2440",
        border: "1px solid rgba(212,160,23,0.35)",
        color: "#E8E0D0",
        minWidth: 280,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 flex-wrap">
        {label && (
          <span className="text-xs font-medium px-1" style={{ color: "#b8a88a" }}>
            {label}
          </span>
        )}
        {showFont && (
          <Select value={font} onValueChange={(v) => onChange({ font: v })}>
            <SelectTrigger
              className="h-8 w-[170px] text-xs"
              style={{ background: "#1E1A2E", color: "#E8E0D0", borderColor: "rgba(212,160,23,0.3)" }}
            >
              <SelectValue>
                <span style={{ fontFamily: `"${font}", serif` }}>{font}</span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={6} className="z-[9999] max-h-72 overflow-y-auto">
              {FONT_GROUPS.map((group) => (
                <SelectGroup key={group.label}>
                  <SelectLabel className="text-xs font-semibold text-muted-foreground px-2 py-1">
                    {group.label}
                  </SelectLabel>
                  {group.fonts.map((f) => (
                    <SelectItem key={f} value={f} style={{ fontFamily: `"${f}", serif` }}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        )}
        {showColor && (
          <input
            type="color"
            value={color}
            onChange={(e) => onChange({ color: e.target.value })}
            onFocus={(e) => e.target.blur()}
            className="h-8 w-10 rounded cursor-pointer"
            style={{ border: "1px solid rgba(212,160,23,0.4)" }}
            tabIndex={-1}
            aria-label="Text color"
          />
        )}
        {showFontSize && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              style={{ background: "#1E1A2E", color: "#E8E0D0", borderColor: "rgba(212,160,23,0.3)" }}
              onClick={() => onChange({ fontSize: Math.max(8, fontSize - 2) })}
              aria-label="Decrease font size"
            >
              −
            </Button>
            <span className="text-xs w-8 text-center tabular-nums" style={{ color: "#E8E0D0" }}>{fontSize}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              style={{ background: "#1E1A2E", color: "#E8E0D0", borderColor: "rgba(212,160,23,0.3)" }}
              onClick={() => onChange({ fontSize: fontSize + 2 })}
              aria-label="Increase font size"
            >
              +
            </Button>
          </div>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 text-xs"
          style={{ color: "#b8a88a" }}
          onClick={onReset}
        >
          Reset
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          style={{ color: "#b8a88a" }}
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </Button>
      </div>
      {defaultText !== undefined && (
        <textarea
          className="w-full rounded px-2 py-1 text-xs resize-none outline-none"
          style={{
            background: "#1E1A2E",
            color: "#E8E0D0",
            border: "1px solid rgba(212,160,23,0.3)",
            minHeight: 52,
            fontFamily: `"${font}", serif`,
          }}
          rows={2}
          value={currentText}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Type to edit this text…"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
}
