import { useEffect, useRef } from "react";
import type { ElementOverride } from "@/types/invitations";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const FONT_OPTIONS = [
  "Playfair Display",
  "Cormorant Garamond",
  "Great Vibes",
  "Dancing Script",
  "Montserrat",
  "Open Sans",
  "Lora",
  "Merriweather",
  "Raleway",
  "Poppins",
  "Inter",
  "Source Sans Pro",
  "Georgia",
  "Times New Roman",
  "Arial",
];

const GOOGLE_FONT_MAP: Record<string, string> = {
  "Playfair Display": "Playfair+Display:wght@400;700",
  "Cormorant Garamond": "Cormorant+Garamond:wght@400;700;ital,wght@1,400",
  "Great Vibes": "Great+Vibes:wght@400",
  "Dancing Script": "Dancing+Script:wght@400;700",
  Montserrat: "Montserrat:wght@400;700",
  "Open Sans": "Open+Sans:wght@400;700",
  Lora: "Lora:wght@400;700",
  Merriweather: "Merriweather:wght@400;700",
  Raleway: "Raleway:wght@400;700",
  Poppins: "Poppins:wght@400;700",
  Inter: "Inter:wght@400;700",
  "Source Sans Pro": "Source+Sans+Pro:wght@400;700",
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
        left: drag.x,
        top: drag.y,
        transform: textAlign === "center" ? "translateX(-50%)" : undefined,
        color,
        fontFamily: `"${font}"`,
        fontSize,
        fontWeight,
        fontStyle,
        textAlign,
        textTransform: uppercase ? "uppercase" : undefined,
        letterSpacing,
        maxWidth,
        padding: "2px 6px",
        lineHeight: 1.2,
      }}
      data-editable-id={id}
    >
      {text}
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
  const drag = useDrag(id, editable, override, defaultX, defaultY, onSelect, onChange);
  return (
    <div
      onPointerDown={drag.onPointerDown}
      onPointerMove={drag.onPointerMove}
      onPointerUp={drag.onPointerUp}
      onPointerCancel={drag.onPointerUp}
      className={[
        "absolute overflow-hidden rounded-lg shadow-md select-none",
        editable ? "cursor-move" : "",
        selected
          ? "ring-2 ring-blue-500 ring-offset-1"
          : editable
            ? "hover:ring-1 hover:ring-blue-300"
            : "",
      ].join(" ")}
      style={{
        left: drag.x,
        top: drag.y,
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
          className="w-full h-full object-cover pointer-events-none"
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
  return (
    <div
      className="bg-white border rounded-lg shadow-md p-2 flex items-center gap-2 flex-wrap"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {label && (
        <span className="text-xs font-medium text-muted-foreground px-1">
          {label}
        </span>
      )}
      {showFont && (
        <Select value={font} onValueChange={(v) => onChange({ font: v })}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_OPTIONS.map((f) => (
              <SelectItem key={f} value={f} style={{ fontFamily: `"${f}"` }}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {showColor && (
        <input
          type="color"
          value={color}
          onChange={(e) => onChange({ color: e.target.value })}
          className="h-8 w-10 rounded border cursor-pointer"
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
            onClick={() => onChange({ fontSize: Math.max(8, fontSize - 2) })}
            aria-label="Decrease font size"
          >
            −
          </Button>
          <span className="text-xs w-8 text-center tabular-nums">{fontSize}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0"
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
        onClick={onReset}
      >
        Reset
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0"
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </Button>
    </div>
  );
}
