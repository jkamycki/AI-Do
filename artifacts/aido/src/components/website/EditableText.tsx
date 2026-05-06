import { useEffect, useRef } from "react";

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

  return (
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
}
