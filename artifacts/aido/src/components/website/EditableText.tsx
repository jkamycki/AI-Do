import { useEffect, useRef, useState } from "react";

const DEFAULT_FONT_OPTIONS = [
  "Playfair Display", "Cormorant Garamond", "Lora", "Merriweather", "Bodoni Moda",
  "Cinzel", "Italiana", "Tangerine", "Great Vibes", "Allura", "Parisienne",
  "Inter", "Montserrat", "Josefin Sans", "Lato", "Open Sans", "Source Sans 3",
  "Nunito", "Raleway", "Poppins",
];

interface Props {
  // Stored override value. Empty/falsy → defaultValue is shown.
  value: string;
  defaultValue: string;
  // Called when the user finishes editing (on blur). Pass the new value.
  // Pass empty string to revert to default (i.e. user cleared the field
  // or typed exactly the default).
  onCommit?: (next: string) => void;
  editable?: boolean;
  multiline?: boolean;
  className?: string;
  style?: React.CSSProperties;
  // For the small uppercase chip labels and titles, render as <span>.
  // For paragraphs that span multiple lines, render as <div> so newlines
  // work naturally in contenteditable.
  as?: "span" | "div";
  // If provided, an "Aa" font picker appears when the element is focused.
  // The selected font is committed via onFontCommit; the current font
  // can be applied via the parent's style prop.
  fontKey?: string;
  fontValue?: string;
  onFontCommit?: (next: string) => void;
}

/**
 * Inline-editable text. When `editable` is true, the rendered element
 * becomes contenteditable. On blur, commits whatever the user typed.
 * If the user types exactly the default text, we treat that as
 * "use default" and clear the override.
 *
 * Implementation note: contenteditable + React controlled inputs don't
 * mix well. We treat the DOM as the source of truth while editing and
 * only resync from props when the underlying value changes from outside
 * (e.g. theme switch, autosave round-trip).
 */
export function EditableText({
  value,
  defaultValue,
  onCommit,
  editable = false,
  multiline = false,
  className = "",
  style,
  as = "span",
  fontKey,
  fontValue,
  onFontCommit,
}: Props) {
  const display = value && value.trim() ? value : defaultValue;
  const ref = useRef<HTMLElement | null>(null);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const showFontUI = editable && !!fontKey && !!onFontCommit;

  // Sync external changes (theme reset, autosave bringing in fresh data)
  // back into the contenteditable DOM. Skip while the element is focused
  // so we don't kill the user's caret mid-typing.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.innerText !== display) {
      el.innerText = display;
    }
  }, [display]);

  const Tag = (as === "div" ? "div" : "span") as React.ElementType;

  if (!editable) {
    if (multiline) {
      return (
        <Tag className={className} style={style}>
          {display}
        </Tag>
      );
    }
    return (
      <Tag className={className} style={style}>
        {display}
      </Tag>
    );
  }

  const editableEl = (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label="Editable text"
      onFocus={(e) => {
        // Select all on focus so users can quickly replace placeholder text
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(e.currentTarget);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (!multiline && e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
        }
      }}
      onBlur={(e: React.FocusEvent) => {
        const next = (e.currentTarget as HTMLElement).innerText.trim();
        if (!onCommit) return;
        // Treat "matches default" as "use default" — keeps the override clean.
        if (next === defaultValue.trim() || next === "") {
          onCommit("");
        } else {
          onCommit(next);
        }
      }}
      className={`${className} editable-text`}
      style={{
        ...style,
        outline: "none",
        cursor: "text",
        minWidth: "1em",
      }}
    >
      {display}
    </Tag>
  );

  if (!showFontUI) {
    return editableEl;
  }

  return (
    <span className="editable-with-font" style={{ position: "relative", display: "inline-block" }}>
      {editableEl}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowFontPicker((s) => !s);
        }}
        onMouseDown={(e) => e.preventDefault() /* don't blur the editable */}
        title="Change font"
        className="editable-font-btn"
        style={{
          position: "absolute",
          top: -10,
          right: -10,
          width: 24,
          height: 24,
          borderRadius: 12,
          background: "rgba(99,102,241,0.95)",
          color: "#fff",
          fontSize: 11,
          fontWeight: 700,
          fontFamily: "system-ui, sans-serif",
          border: "1px solid rgba(255,255,255,0.4)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
          zIndex: 20,
        }}
      >
        Aa
      </button>
      {showFontPicker && (
        <div
          className="editable-font-popover"
          onMouseDown={(e) => e.preventDefault()}
          style={{
            position: "absolute",
            top: 24,
            right: 0,
            zIndex: 30,
            background: "#fff",
            color: "#222",
            border: "1px solid rgba(0,0,0,0.1)",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            padding: 6,
            width: 200,
            maxHeight: 280,
            overflowY: "auto",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <button
            type="button"
            onClick={() => {
              onFontCommit?.("");
              setShowFontPicker(false);
            }}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "6px 8px",
              borderRadius: 4,
              background: !fontValue ? "rgba(99,102,241,0.1)" : "transparent",
              color: "#444",
              fontSize: 12,
              border: "none",
              cursor: "pointer",
            }}
          >
            <span style={{ fontStyle: "italic" }}>Use theme font</span>
          </button>
          {DEFAULT_FONT_OPTIONS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                onFontCommit?.(f);
                setShowFontPicker(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "6px 8px",
                borderRadius: 4,
                background: fontValue === f ? "rgba(99,102,241,0.15)" : "transparent",
                color: "#222",
                fontFamily: `'${f}', system-ui, sans-serif`,
                fontSize: 14,
                border: "none",
                cursor: "pointer",
              }}
            >
              {f}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
