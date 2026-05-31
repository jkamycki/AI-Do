import { forwardRef, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlignCenter, AlignLeft, AlignRight, Loader2, Smile, Sparkles, Strikethrough, Trash2, Underline } from "lucide-react";
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
        className="h-7 text-xs rounded border border-[#D6C8B8] bg-[#FFFDF8] px-2 flex items-center gap-1 cursor-pointer text-[#1F242C] hover:bg-[#F3E8DC]"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => { setOpen((o) => !o); onKeepOpen?.(); }}
      >
        <span className="flex-1 text-left truncate">{current.label}</span>
        <span className="opacity-40 ml-1 text-[9px] flex-shrink-0">▾</span>
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-0.5 bg-[#FFFDF8] border border-[#D6C8B8] rounded-md shadow-lg overflow-auto text-[#1F242C]"
          style={{ minWidth, maxHeight: 200, zIndex: 10001 }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#F3E8DC] transition-colors whitespace-nowrap ${opt.value === value ? "text-[#1F242C] font-semibold bg-[#F3E8DC]" : "text-[#1F242C]"}`}
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
  // When provided, the toolbar shows an emoji picker button. Picking an
  // emoji calls onInsertText with the chosen character; EditableText then
  // splices it into the current selection and commits.
  onInsertText?: (text: string) => void;
}

export const TextStyleToolbar = forwardRef<HTMLDivElement, Props>(
  ({ style, onChange, anchorRect, onKeepOpen, onDelete, currentText, onAiGenerate, onInsertText }, ref) => {
    const { t } = useTranslation();
    // Keep the prompt input collapsed until the user explicitly clicks the
    // sparkle button. Auto-opening it covered too much of the canvas and made
    // a stray click on a text element feel intrusive when the user just
    // wanted to drag or reposition.
    const [aiOpen, setAiOpen] = useState(false);
    const [aiPrompt, setAiPrompt] = useState("");
    const [aiBusy, setAiBusy] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [emojiOpen, setEmojiOpen] = useState(false);
    const [fontSizeDraft, setFontSizeDraft] = useState("");
    const [fontSizeFocused, setFontSizeFocused] = useState(false);
    const aiInputRef = useRef<HTMLInputElement | null>(null);
    useEffect(() => {
      FONT_OPTIONS.filter((f) => f.value).forEach((f) => loadGoogleFont(f.value));
    }, []);

    // The contenteditable underneath is greedy about focus; explicitly hand
    // focus to the AI input the moment the panel opens so the user's
    // keystrokes go into the prompt instead of the heading underneath.
    useEffect(() => {
      if (aiOpen) {
        const id = window.setTimeout(() => aiInputRef.current?.focus(), 0);
        return () => window.clearTimeout(id);
      }
      return undefined;
    }, [aiOpen]);

    useEffect(() => {
      if (style.fontFamily) loadGoogleFont(style.fontFamily);
    }, [style.fontFamily]);

    const top = Math.max(8, anchorRect.top - 52 + window.scrollY);
    const left = Math.max(8, anchorRect.left + window.scrollX);

    const fontSizeNumber = (() => {
      const raw = style.fontSize;
      if (!raw) return "";
      const n = Number.parseInt(String(raw).replace("px", "").trim(), 10);
      return Number.isFinite(n) ? String(n) : "";
    })();
    useEffect(() => {
      if (!fontSizeFocused) setFontSizeDraft(fontSizeNumber);
    }, [fontSizeFocused, fontSizeNumber]);
    const patch = (partial: Partial<WebsiteTextStyle>) => onChange({ ...style, ...partial });
    const commitFontSize = (value = fontSizeDraft) => {
      const v = value.trim();
      if (!v) {
        patch({ fontSize: undefined });
        return;
      }
      const n = Number.parseInt(v, 10);
      if (!Number.isFinite(n)) {
        setFontSizeDraft(fontSizeNumber);
        return;
      }
      const clamped = Math.max(8, Math.min(120, n));
      setFontSizeDraft(String(clamped));
      patch({ fontSize: `${clamped}px` });
    };

    const btnClass = (active: boolean) =>
      `px-2 py-1 rounded text-xs font-medium transition-colors ${
        active
          ? "bg-[#1F242C] text-[#FFFDF8]"
          : "bg-[#FFFDF8] border border-[#D6C8B8] hover:bg-[#F3E8DC] text-[#1F242C]"
      }`;

    return createPortal(
      <div
        ref={ref}
        className="fixed z-[9999] flex items-center gap-1 flex-wrap px-2 py-1.5 rounded-lg shadow-xl border border-[#D6C8B8] bg-[#FFFDF8] text-[#1F242C]"
        style={{ top, left, maxWidth: "min(640px, 94vw)" }}
        onMouseDown={(e) => {
          // Keep the contenteditable focused when the user clicks toolbar
          // chrome — but skip when the click lands on a text input so it
          // can actually receive focus and accept typed input.
          const target = e.target as HTMLElement;
          const tag = target.tagName;
          if (tag === "INPUT" || tag === "TEXTAREA") {
            onKeepOpen?.();
            return;
          }
          e.preventDefault();
          onKeepOpen?.();
        }}
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

        {/* Font size */}
        <label className="flex items-center gap-1" title={t("text_toolbar.font-size", { defaultValue: "Font size" })}>
          <span className="text-[10px] text-[#4A5563]">px</span>
          <input
            type="number"
            min={8}
            max={120}
            step={1}
            value={fontSizeFocused ? fontSizeDraft : fontSizeNumber}
            onFocus={() => {
              setFontSizeFocused(true);
              setFontSizeDraft(fontSizeNumber);
              onKeepOpen?.();
            }}
            onBlur={() => {
              setFontSizeFocused(false);
              commitFontSize();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                e.preventDefault();
                commitFontSize();
                (e.currentTarget as HTMLInputElement).blur();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setFontSizeDraft(fontSizeNumber);
                (e.currentTarget as HTMLInputElement).blur();
              }
            }}
            onChange={(e) => {
              setFontSizeDraft(e.target.value.replace(/[^\d]/g, ""));
            }}
            className="h-7 w-[64px] rounded border border-[#D6C8B8] bg-[#FFFDF8] px-1.5 text-xs text-[#1F242C]"
            aria-label={t("text_toolbar.font-size", { defaultValue: "Font size" })}
          />
        </label>

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
        <button
          className={btnClass(!!style.underline)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => patch({ underline: !style.underline })}
          title={t("text_toolbar.underline", { defaultValue: "Underline" })}
        >
          <Underline className="h-3.5 w-3.5" />
        </button>
        <button
          className={btnClass(!!style.strikethrough)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => patch({ strikethrough: !style.strikethrough })}
          title={t("text_toolbar.strikethrough", { defaultValue: "Strikethrough" })}
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </button>

        <div
          className="inline-flex h-7 overflow-hidden rounded border border-[#D6C8B8]"
          title={t("text_toolbar.alignment", { defaultValue: "Text alignment" })}
        >
          {[
            { value: "left" as const, icon: AlignLeft, label: "Align left" },
            { value: "center" as const, icon: AlignCenter, label: "Align center" },
            { value: "right" as const, icon: AlignRight, label: "Align right" },
          ].map(({ value, icon: Icon, label }) => {
            const active = style.textAlign === value;
            return (
              <button
                key={value}
                type="button"
                className={`inline-flex w-7 items-center justify-center transition-colors ${
                  active ? "bg-[#1F242C] text-[#FFFDF8]" : "bg-[#FFFDF8] text-[#1F242C] hover:bg-[#F3E8DC]"
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => patch({ textAlign: active ? undefined : value })}
                title={t(`text_toolbar.${value}`, { defaultValue: label })}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>

        {/* Color */}
        <label
          className="flex items-center gap-1 cursor-pointer"
          title={t("text_toolbar.text-color", { defaultValue: "Text color" })}
          onMouseDown={(e) => e.preventDefault()}
        >
          <span className="text-xs text-[#4A5563]">A</span>
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
              style={{ color: "#8D294D" }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setAiOpen((v) => !v); onKeepOpen?.(); }}
              title={t("text_toolbar.ai_generate", { defaultValue: "AI: write this for me" })}
            >
              <Sparkles className="h-3 w-3" />
              <span className="font-semibold">AI</span>
            </button>
          </>
        )}

        {/* Emoji picker */}
        {onInsertText && (
          <>
            <div className="w-px h-5 bg-border mx-0.5" />
            <button
              className="flex items-center gap-1 text-xs px-1 rounded transition-colors hover:bg-accent"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setEmojiOpen((v) => !v); onKeepOpen?.(); }}
              title={t("text_toolbar.insert-emoji", { defaultValue: "Insert emoji" })}
            >
              <Smile className="h-3 w-3" />
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

        {/* Emoji picker panel — wedding-themed picks */}
        {onInsertText && emojiOpen && (
          <div
            className="basis-full mt-1 pt-1.5 border-t border-border"
            onMouseDown={(e) => { e.preventDefault(); onKeepOpen?.(); }}
          >
            <div className="grid grid-cols-10 gap-0.5">
              {[
                "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃",
                "😉", "😊", "😇", "🤩", "😗", "☺️", "😚", "😋", "😎", "🥲",
                "💍", "💐", "💒", "👰", "🤵", "💕", "💖", "❤️", "🌹", "🥂",
                "🍾", "🎉", "🎊", "✨", "💫", "🕊️", "🦋", "🌸", "📅", "✉️",
                "🌷", "🌺", "🌻", "🌼", "🍰", "🧁", "🎂", "🎁", "💌", "👑",
                "🥰", "😍", "😘", "💋", "🫶", "💗", "💓", "💞", "🧡", "💙",
                "🌙", "⭐", "🌟", "☀️", "🌈", "🌊", "🏖️", "✈️", "🎵", "🎶",
                "🍷", "🫖", "🎀", "🎈", "🪄", "📸", "🙏", "🌿", "🔮", "👫",
              ].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="text-base leading-none p-1 rounded hover:bg-accent transition-colors"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { onInsertText(emoji); setEmojiOpen(false); }}
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
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
              ref={aiInputRef}
              type="text"
              value={aiPrompt}
              autoFocus
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onFocus={() => onKeepOpen?.()}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter" && aiPrompt.trim() && !aiBusy) {
                  e.preventDefault();
                  void handleAiGenerate();
                }
                if (e.key === "Escape") { e.preventDefault(); setAiOpen(false); }
              }}
              placeholder={t("text_toolbar.ai_prompt_placeholder", { defaultValue: "Describe what you'd like…" })}
              className="flex-1 h-7 px-2 text-xs rounded border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-rose-300/50"
            />
            <button
              type="button"
              disabled={!aiPrompt.trim() || aiBusy}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void handleAiGenerate()}
              className="h-7 px-2.5 rounded text-xs font-semibold text-white border-0 disabled:opacity-50"
              style={{ background: "#8D294D" }}
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
