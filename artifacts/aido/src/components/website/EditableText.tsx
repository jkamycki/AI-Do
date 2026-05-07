import { useEffect, useRef } from "react";

interface Props {
  value: string;
  defaultValue: string;
  onCommit?: (next: string) => void;
  editable?: boolean;
  multiline?: boolean;
  className?: string;
  style?: React.CSSProperties;
  as?: "span" | "div";
  // Kept for API compatibility with existing callers — no longer used.
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
}: Props) {
  const display = value && value.trim() ? value : defaultValue;
  const ref = useRef<HTMLElement | null>(null);

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
    return (
      <Tag className={className} style={style}>
        {display}
      </Tag>
    );
  }

  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label="Editable text"
      onFocus={(e) => {
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
        if (next === defaultValue.trim() || next === "") {
          onCommit("");
        } else {
          onCommit(next);
        }
      }}
      className={`${className} editable-text`}
      style={{ ...style, outline: "none", cursor: "text", minWidth: "1em" }}
    >
      {display}
    </Tag>
  );
}
