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
];

const SIZE_OPTIONS = [
  { label: "S", value: "0.85em", title: "Small" },
  { label: "M", value: "1em", title: "Normal" },
  { label: "L", value: "1.25em", title: "Large" },
  { label: "XL", value: "1.6em", title: "X-Large" },
  { label: "2X", value: "2em", title: "2X-Large" },
];

const ANIMATION_OPTIONS = [
  { label: "None", value: "" },
  { label: "Fade In", value: "wsa-fade-in" },
  { label: "Slide Up", value: "wsa-slide-up" },
  { label: "Slide Right", value: "wsa-slide-right" },
  { label: "Zoom In", value: "wsa-zoom-in" },
  { label: "Bounce", value: "wsa-bounce-in" },
];

interface Props {
  style: WebsiteTextStyle;
  onChange: (next: WebsiteTextStyle) => void;
  anchorRect: DOMRect;
}

export function TextStyleToolbar({ style, onChange, anchorRect }: Props) {
  const top = Math.max(8, anchorRect.top - 48 + window.scrollY);
  const left = Math.max(8, anchorRect.left + window.scrollX);

  const patch = (partial: Partial<WebsiteTextStyle>) => onChange({ ...style, ...partial });

  const btnClass = (active: boolean) =>
    `px-2 py-1 rounded text-xs font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-background border border-border hover:bg-muted text-foreground"}`;

  return createPortal(
    <div
      className="fixed z-[9999] flex items-center gap-1 flex-wrap px-2 py-1.5 rounded-lg shadow-xl border border-border bg-background"
      style={{ top, left, maxWidth: "min(640px, 90vw)" }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Font family */}
      <select
        value={style.fontFamily ?? ""}
        onChange={(e) => patch({ fontFamily: e.target.value || undefined })}
        className="h-7 text-xs rounded border border-border bg-background px-1 cursor-pointer"
        style={{ fontFamily: style.fontFamily ?? "inherit", minWidth: 120 }}
      >
        {FONT_OPTIONS.map((f) => (
          <option key={f.value} value={f.value} style={{ fontFamily: f.value || "inherit" }}>
            {f.label}
          </option>
        ))}
      </select>

      {/* Font size */}
      <div className="flex gap-0.5">
        {SIZE_OPTIONS.map((s) => (
          <button
            key={s.value}
            title={s.title}
            className={btnClass(style.fontSize === s.value)}
            onClick={() => patch({ fontSize: style.fontSize === s.value ? undefined : s.value })}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Bold / Italic */}
      <button className={btnClass(!!style.bold)} onClick={() => patch({ bold: !style.bold })} title="Bold">
        <strong>B</strong>
      </button>
      <button className={btnClass(!!style.italic)} onClick={() => patch({ italic: !style.italic })} title="Italic">
        <em>I</em>
      </button>

      {/* Color */}
      <label className="flex items-center gap-1 cursor-pointer" title="Text color">
        <span className="text-xs text-muted-foreground">A</span>
        <div className="relative w-5 h-5 rounded overflow-hidden border border-border flex-shrink-0">
          <div className="absolute inset-0" style={{ background: style.color ?? "#000" }} />
          <input
            type="color"
            value={style.color ?? "#000000"}
            onChange={(e) => patch({ color: e.target.value })}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </div>
        {style.color && (
          <button
            className="text-xs text-muted-foreground hover:text-foreground"
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
        className="h-7 text-xs rounded border border-border bg-background px-1 cursor-pointer"
      >
        {ANIMATION_OPTIONS.map((a) => (
          <option key={a.value} value={a.value}>{a.label}</option>
        ))}
      </select>

      {/* Reset all */}
      {Object.keys(style).length > 0 && (
        <button
          className="text-xs text-muted-foreground hover:text-destructive transition-colors px-1"
          onClick={() => onChange({})}
          title="Reset all styles"
        >
          Reset
        </button>
      )}
    </div>,
    document.body,
  );
}
