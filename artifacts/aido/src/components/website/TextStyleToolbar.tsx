import { forwardRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2, Sparkles, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { WebsiteTextStyle } from "@workspace/db";
import { authFetch } from "@/lib/authFetch";

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
  // Optional callback that replaces the underlying text with AI-generated
  // copy. When provided, the toolbar shows a Sparkles button that opens a
  // small prompt input. EditableText wires this up so the generated string
  // lands in the contenteditable.
  currentText?: string;
  onAiGenerate?: (newText: string) => void;
}

export const TextStyleToolbar = forwardRef<HTMLDivElement, Props>(
  ({ style, onChange, anchorRect, onKeepOpen, onDelete, currentText, onAiGenerate }, ref) => {
    const { t } = useTranslation();
    // Keep the prompt input collapsed until the user explicitly clicks the
    // sparkle button. Auto-opening it covered too much of the canvas and made
    // a stray click on a text element feel intrusive when the user just
    // wanted to drag or reposition.
    const [aiOpen, setAiOpen] = useState(false);
    const [aiPrompt, setAiPrompt] = useState("");
    const [aiBusy, setAiBusy] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
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
          title={t("text_toolbar.bold", { defaultValue: "Bold" })}
        >
          <strong>B</strong>
        </button>
        <button
          className={btnClass(!!style.italic)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => patch({ italic: !style.italic })}
          title={t("text_toolbar.italic", { defaultValue: "Italic" })}
        >
          <em>I</em>
        </button>

        {/* Color */}
        <label
          className="flex items-center gap-1 cursor-pointer"
          title={t("text_toolbar.text-color", { defaultValue: "Text color" })}
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
              title={t("text_toolbar.reset-color", { defaultValue: "Reset color" })}
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
            title={t("text_toolbar.reset-all-styles", { defaultValue: "Reset all styles" })}
          >
            Reset
          </button>
        )}

        {/* AI generate */}
        {onAiGenerate && (
          <>
            <div className="w-px h-5 bg-border mx-0.5" />
            <button
              className="flex items-center gap-1 text-xs px-1.5 rounded transition-colors"
              style={{ color: "#D4A017" }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setAiOpen((v) => !v); onKeepOpen?.(); }}
              title={t("text_toolbar.ai_generate", { defaultValue: "AI: write this for me" })}
            >
              <Sparkles className="h-3 w-3" />
              <span className="font-semibold">AI</span>
            </button>
          </>
        )}

        {/* Delete element */}
        {onDelete && (
          <>
            <div className="w-px h-5 bg-border mx-0.5" />
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors px-1"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onDelete}
              title={t("text_toolbar.delete-this-text-element", { defaultValue: "Delete this text element" })}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </>
        )}

        {/* AI prompt panel — sits below the toolbar's flex row when open */}
        {onAiGenerate && aiOpen && (
          <div
            className="basis-full flex items-stretch gap-1.5 mt-1 pt-1.5 border-t border-border"
            onMouseDown={(e) => {
              // Block focus loss only when the click lands on padding/empty
              // space — the <input> needs the default mousedown behavior so it
              // can actually receive focus and accept typed text. onKeepOpen
              // re-focuses the contenteditable, so it must also be skipped for
              // the input click; scheduleHide already keeps the toolbar open
              // while the input holds activeElement.
              const target = e.target as HTMLElement;
              if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
              e.preventDefault();
              onKeepOpen?.();
            }}
          >
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && aiPrompt.trim() && !aiBusy) {
                  e.preventDefault();
                  void handleAiGenerate();
                }
                if (e.key === "Escape") { e.preventDefault(); setAiOpen(false); }
              }}
              placeholder={t("text_toolbar.ai_prompt_placeholder", { defaultValue: "Describe what you'd like…" })}
              className="flex-1 h-7 px-2 text-xs rounded border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/40"
            />
            <button
              type="button"
              disabled={!aiPrompt.trim() || aiBusy}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void handleAiGenerate()}
              className="h-7 px-2.5 rounded text-xs font-semibold text-white border-0 disabled:opacity-50"
              style={{ background: "#D4A017" }}
            >
              {aiBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : t("text_toolbar.ai_generate_btn", { defaultValue: "Generate" })}
            </button>
            {aiError && (
              <span className="basis-full text-[11px] text-destructive">{aiError}</span>
            )}
          </div>
        )}
      </div>,
      document.body,
    );

    async function handleAiGenerate() {
      if (!onAiGenerate || !aiPrompt.trim()) return;
      setAiBusy(true);
      setAiError(null);
      try {
        const r = await authFetch("/api/ai/generate-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: aiPrompt.trim(),
            currentText: currentText ?? "",
          }),
        });
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          setAiError(body?.error ?? "Couldn't generate. Please try again.");
          return;
        }
        const body = await r.json() as { text?: string };
        if (body.text) {
          onAiGenerate(body.text);
          setAiOpen(false);
          setAiPrompt("");
        }
      } catch {
        setAiError("Network error. Please try again.");
      } finally {
        setAiBusy(false);
      }
    }
  },
);

TextStyleToolbar.displayName = "TextStyleToolbar";
