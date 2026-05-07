import { forwardRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";
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

// Custom dropdown — uses e.preventDefault() like buttons so the contenteditable
// never loses focus. Native <select> can't be reliably blocked from triggering
// parent e.preventDefault() across browsers.
function ToolbarDropdown({
  value,
  options,
  onChange,
  onKeepOpen,
  minWidth = 120,
  fontPreview = false,
}: {
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
  onKeepOpen?: () => void;
  minWidth?: number;
  fontPreview?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value) ?? options[0];

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        style={{
          minWidth,
          fontFamily: fontPreview && value ? `'${value}', serif` : undefined,
        }}
        className="h-7 text-xs rounded border border-border bg-background px-2 flex items-center gap-1 cursor-pointer hover:bg-muted"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => { setOpen((o) => !o); onKeepOpen?.(); }}
      >
        <span className="flex-1 text-left truncate">{current.label}</span>
        <span className="opacity-40 ml-1 text-[9px] flex-shrink-0">▾</span>
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-0.5 bg-background border border-border rounded-md shadow-lg overflow-auto"
          style={{ minWidth, maxHeight: 200, zIndex: 10001 }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors whitespace-nowrap ${opt.value === value ? "text-primary font-semibold" : ""}`}
              style={{ fontFamily: fontPreview && opt.value ? `'${opt.value}', serif` : undefined }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
                onKeepOpen?.();
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  style: WebsiteTextStyle;
  onChange: (next: WebsiteTextStyle) => void;
  anchorRect: DOMRect;
  onKeepOpen?: () => void;
  onDelete?: () => void;
}

export const TextStyleToolbar = forwardRef<HTMLDivElement, Props>(
  ({ style, onChange, anchorRect, onKeepOpen, onDelete }, ref) => {
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

    return createPortal(
      <div
        ref={ref}
        className="fixed z-[9999] flex items-center gap-1 flex-wrap px-2 py-1.5 rounded-lg shadow-xl border border-border bg-background"
        style={{ top, left, maxWidth: "min(640px, 94vw)" }}
        onMouseDown={(e) => { e.preventDefault(); onKeepOpen?.(); }}
        onMouseEnter={onKeepOpen}
      >
        {/* Font family — custom dropdown avoids native <select> event issues */}
        <ToolbarDropdown
          value={style.fontFamily ?? ""}
          options={FONT_OPTIONS}
          onChange={(v) => {
            patch({ fontFamily: v || undefined });
            if (v) loadGoogleFont(v);
          }}
          onKeepOpen={onKeepOpen}
          minWidth={140}
          fontPreview
        />

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

        {/* Animation — custom dropdown */}
        <ToolbarDropdown
          value={style.animation ?? ""}
          options={ANIMATION_OPTIONS}
          onChange={(v) => patch({ animation: v || undefined })}
          onKeepOpen={onKeepOpen}
          minWidth={100}
        />

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

        {/* Delete element */}
        {onDelete && (
          <>
            <div className="w-px h-5 bg-border mx-0.5" />
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors px-1"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onDelete}
              title="Delete this text element"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </>
        )}
      </div>,
      document.body,
    );
  },
);

TextStyleToolbar.displayName = "TextStyleToolbar";
