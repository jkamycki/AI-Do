import { forwardRef, useEffect } from "react";
import { createPortal } from "react-dom";
import type { WebsiteTextStyle } from "@workspace/db";

export { type WebsiteTextStyle };

const FONT_OPTIONS = [
  { label: "Default", value: "" },
  { label: "Playfair Display", value: "Playfair Display" },
  { label: "Cormorant Garamond", value: "Cormorant Garamond" },
  { label: "Lora", value: "Lora" },
  { label: "Merriweather", value: "Merriweather" },
  { label: "Cinzel", value: "Cinzel" },
  { label: "Tangerine", value: "Tangerine" },
  { label: "Great Vibes", value: "Great Vibes" },
  { label: "Inter", value: "Inter" },
  { label: "Montserrat", value: "Montserrat" },
  { label: "Raleway", value: "Raleway" },
  { label: "Parisienne", value: "Parisienne" },
  { label: "Dancing Script", value: "Dancing Script" },
];

const ANIMATION_OPTIONS = [
  { label: "None", value: "" },
  { label: "Fade In", value: "wsa-fade-in" },
  { label: "Slide Up", value: "wsa-slide-up" },
  { label: "Slide Right", value: "wsa-slide-right" },
  { label: "Zoom In", value: "wsa-zoom-in" },
  { label: "Bounce", value: "wsa-bounce-in" },
];

function loadGoogleFont(family: string) {
  if (!family) return;
  const id = `gf-${family.replace(/\s+/g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700&display=swap`;
  document.head.appendChild(link);
}

interface Props {
  style: WebsiteTextStyle;
  onChange: (next: WebsiteTextStyle) => void;
  anchorRect: DOMRect;
  onKeepOpen?: () => void;
}

export const TextStyleToolbar = forwardRef<HTMLDivElement, Props>(
  ({ style, onChange, anchorRect, onKeepOpen }, ref) => {
    useEffect(() => {
      FONT_OPTIONS.filter((f) => f.value).forEach((f) => loadGoogleFont(f.value));
    }, []);

    useEffect(() => {
      if (style.fontFamily) loadGoogleFont(style.fontFamily);
    }, [style.fontFamily]);

    const top = Math.max(8, anchorRect.top - 52 + window.scrollY);
    const left = Math.max(8, anchorRect.left + window.scrollX);

    const patch = (partial: Partial<WebsiteTextStyle>) => onChange({ ...style, ...partial });

    const btnClass = (active: boolean) =>
      `px-2 py-1 rounded text-xs font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-background border border-border hover:bg-muted text-foreground"
      }`;

    // Called on selects: stop propagation so the parent div's preventDefault doesn't
    // block the native dropdown from opening, but still keep the toolbar alive.
    const selectMouseDown = (e: React.MouseEvent) => {
      e.stopPropagation();
      onKeepOpen?.();
    };

    return createPortal(
      <div
        ref={ref}
        className="fixed z-[9999] flex items-center gap-1 flex-wrap px-2 py-1.5 rounded-lg shadow-xl border border-border bg-background"
        style={{ top, left, maxWidth: "min(600px, 94vw)" }}
        // preventDefault on the toolbar background prevents contenteditable blur;
        // individual <select> elements stop propagation so they can still open.
        onMouseDown={(e) => { e.preventDefault(); onKeepOpen?.(); }}
        onMouseEnter={onKeepOpen}
      >
        {/* Font family */}
        <select
          value={style.fontFamily ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            patch({ fontFamily: v || undefined });
            if (v) loadGoogleFont(v);
          }}
          onMouseDown={selectMouseDown}
          onFocus={() => onKeepOpen?.()}
          className="h-7 text-xs rounded border border-border bg-background px-1 cursor-pointer"
          style={{ fontFamily: style.fontFamily ?? "inherit", minWidth: 140 }}
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f.value} value={f.value} style={{ fontFamily: f.value || "inherit" }}>
              {f.label}
            </option>
          ))}
        </select>

        {/* Bold / Italic */}
        <button
          className={btnClass(!!style.bold)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => patch({ bold: !style.bold })}
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button
          className={btnClass(!!style.italic)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => patch({ italic: !style.italic })}
          title="Italic"
        >
          <em>I</em>
        </button>

        {/* Color */}
        <label
          className="flex items-center gap-1 cursor-pointer"
          title="Text color"
          onMouseDown={(e) => e.preventDefault()}
        >
          <span className="text-xs text-muted-foreground">A</span>
          <div className="relative w-5 h-5 rounded overflow-hidden border border-border flex-shrink-0">
            <div className="absolute inset-0" style={{ background: style.color ?? "#000" }} />
            <input
              type="color"
              value={style.color ?? "#000000"}
              onChange={(e) => patch({ color: e.target.value })}
              onFocus={() => onKeepOpen?.()}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </div>
          {style.color && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => patch({ color: undefined })}
              title="Reset color"
            >
              ×
            </button>
          )}
        </label>

        {/* Separator */}
        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Animation */}
        <select
          value={style.animation ?? ""}
          onChange={(e) => patch({ animation: e.target.value || undefined })}
          onMouseDown={selectMouseDown}
          onFocus={() => onKeepOpen?.()}
          className="h-7 text-xs rounded border border-border bg-background px-1 cursor-pointer"
        >
          {ANIMATION_OPTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>

        {/* Reset all */}
        {Object.keys(style).length > 0 && (
          <button
            className="text-xs text-muted-foreground hover:text-destructive transition-colors px-1"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange({})}
            title="Reset all styles"
          >
            Reset
          </button>
        )}
      </div>,
      document.body,
    );
  },
);

TextStyleToolbar.displayName = "TextStyleToolbar";
