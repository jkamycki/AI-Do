import { useEffect, useRef, useState } from "react";
import { TextStyleToolbar, type WebsiteTextStyle } from "./TextStyleToolbar";

interface Props {
  value: string;
  defaultValue: string;
  onCommit?: (next: string) => void;
  editable?: boolean;
  multiline?: boolean;
  className?: string;
  style?: React.CSSProperties;
  as?: "span" | "div";
  // Text style (font, size, color, animation, bold, italic)
  textStyle?: WebsiteTextStyle;
  onStyleChange?: (next: WebsiteTextStyle) => void;
  // Kept for API compatibility with existing callers — no longer used.
  fontKey?: string;
  fontValue?: string;
  onFontCommit?: (next: string) => void;
}

function animClass(animation: string | undefined): string {
  return animation ? animation : "";
}

function styleFromTextStyle(ts: WebsiteTextStyle | undefined): React.CSSProperties {
  if (!ts) return {};
  const css: React.CSSProperties = {};
  if (ts.fontFamily) css.fontFamily = `'${ts.fontFamily}', inherit`;
  if (ts.fontSize)   css.fontSize = ts.fontSize;
  if (ts.color)      css.color = ts.color;
  if (ts.bold)       css.fontWeight = "bold";
  if (ts.italic)     css.fontStyle = "italic";
  return css;
}

/**
 * Inline-editable text. When `editable` is true, the rendered element
 * becomes contenteditable. On blur, commits whatever the user typed.
 * If the user types exactly the default text, we treat that as
 * "use default" and clear the override.
 *
 * When `textStyle` + `onStyleChange` are provided, a floating toolbar
 * appears on focus letting the user change font, size, color, and animation.
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
  textStyle,
  onStyleChange,
}: Props) {
  const display = value && value.trim() ? value : defaultValue;
  const ref = useRef<HTMLElement | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.innerText !== display) {
      el.innerText = display;
    }
  }, [display]);

  const Tag = (as === "div" ? "div" : "span") as React.ElementType;
  const tsStyle = styleFromTextStyle(textStyle);
  const anim = animClass(textStyle?.animation);

  if (!editable) {
    return (
      <Tag className={`${className} ${anim}`} style={{ ...style, ...tsStyle }}>
        {display}
      </Tag>
    );
  }

  return (
    <>
      <Tag
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Editable text"
        onFocus={(e) => {
          setAnchorRect(e.currentTarget.getBoundingClientRect());
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(e.currentTarget);
          sel?.removeAllRanges();
          sel?.addRange(range);
        }}
        onBlur={(e: React.FocusEvent) => {
          setTimeout(() => setAnchorRect(null), 200);
          const next = (e.currentTarget as HTMLElement).innerText.trim();
          if (!onCommit) return;
          if (next === defaultValue.trim() || next === "") {
            onCommit("");
          } else {
            onCommit(next);
          }
        }}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (!multiline && e.key === "Enter") {
            e.preventDefault();
            (e.currentTarget as HTMLElement).blur();
          }
        }}
        className={`${className} ${anim} editable-text`}
        style={{ ...style, ...tsStyle, outline: "none", cursor: "text", minWidth: "1em" }}
      >
        {display}
      </Tag>

      {anchorRect && onStyleChange && (
        <TextStyleToolbar
          style={textStyle ?? {}}
          onChange={onStyleChange}
          anchorRect={anchorRect}
        />
      )}
    </>
  );
}
