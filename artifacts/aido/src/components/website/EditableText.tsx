import { useEffect, useRef, useState } from "react";
import { GripHorizontal } from "lucide-react";
import { TextStyleToolbar, type WebsiteTextStyle } from "./TextStyleToolbar";

export type TextPosition = { x: number; y: number };

interface Props {
  value: string;
  defaultValue: string;
  onCommit?: (next: string) => void;
  editable?: boolean;
  multiline?: boolean;
  className?: string;
  style?: React.CSSProperties;
  as?: "span" | "div";
  textStyle?: WebsiteTextStyle;
  onStyleChange?: (next: WebsiteTextStyle) => void;
  position?: TextPosition;
  onPositionChange?: (next: TextPosition) => void;
  // Legacy — unused
  fontKey?: string;
  fontValue?: string;
  onFontCommit?: (next: string) => void;
}

function animClass(animation: string | undefined): string {
  return animation ?? "";
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
  position,
  onPositionChange,
}: Props) {
  const display = value && value.trim() ? value : defaultValue;
  const ref = useRef<HTMLElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepOpenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [hovered, setHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Sync external value changes into contenteditable without clobbering an active edit
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.innerText !== display) el.innerText = display;
  }, [display]);

  const tsStyle = styleFromTextStyle(textStyle);
  const anim = animClass(textStyle?.animation);
  const transform = position ? `translate(${position.x}px, ${position.y}px)` : undefined;

  const Tag = (as === "div" ? "div" : "span") as React.ElementType;
  const Wrap = (as === "div" ? "div" : "span") as React.ElementType;

  if (!editable) {
    return (
      <Tag
        className={`${className} ${anim}`}
        style={{ ...style, ...tsStyle, transform }}
      >
        {display}
      </Tag>
    );
  }

  // --- blur / keep-open logic ---
  // When the contenteditable blurs, we wait 80ms before hiding the toolbar.
  // If focus moved into the toolbar (or onKeepOpen is called), we cancel the hide.
  const scheduleHide = (committedText: string) => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    blurTimer.current = setTimeout(() => {
      if (toolbarRef.current && toolbarRef.current.contains(document.activeElement)) {
        return; // focus is inside toolbar — keep open
      }
      setShowToolbar(false);
      setAnchorRect(null);
      if (!onCommit) return;
      if (committedText === defaultValue.trim() || committedText === "") {
        onCommit("");
      } else {
        onCommit(committedText);
      }
    }, 80);
  };

  const keepOpen = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    // re-focus the text element so the toolbar stays logically attached
    if (keepOpenTimer.current) clearTimeout(keepOpenTimer.current);
    keepOpenTimer.current = setTimeout(() => {
      ref.current?.focus({ preventScroll: true });
    }, 120);
  };

  // --- drag ---
  const handleDragPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: position?.x ?? 0,
      origY: position?.y ?? 0,
    };
    setIsDragging(true);
  };

  const handleDragPointerMove = (e: React.PointerEvent) => {
    if (!dragState.current || !onPositionChange) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    onPositionChange({ x: dragState.current.origX + dx, y: dragState.current.origY + dy });
  };

  const handleDragPointerUp = () => {
    dragState.current = null;
    setIsDragging(false);
  };

  const showDragHandle = onPositionChange && (hovered || showToolbar || isDragging);
  const hasOffset = position && (position.x !== 0 || position.y !== 0);

  return (
    <Wrap
      style={{
        position: "relative",
        display: as === "div" ? "block" : "inline-block",
        transform,
        zIndex: isDragging ? 100 : undefined,
        outline: hovered && !isDragging ? "1.5px dashed rgba(99,102,241,0.35)" : undefined,
        outlineOffset: 3,
        borderRadius: 2,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Drag handle */}
      {showDragHandle && (
        <span
          title="Drag to reposition"
          style={{
            position: "absolute",
            top: -22,
            left: 0,
            cursor: isDragging ? "grabbing" : "grab",
            background: "rgba(99,102,241,0.92)",
            color: "#fff",
            borderRadius: 4,
            padding: "2px 6px 2px 4px",
            fontSize: 11,
            userSelect: "none",
            zIndex: 300,
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            whiteSpace: "nowrap",
            lineHeight: 1,
          }}
          onPointerDown={handleDragPointerDown}
          onPointerMove={handleDragPointerMove}
          onPointerUp={handleDragPointerUp}
          onPointerCancel={handleDragPointerUp}
        >
          <GripHorizontal size={11} />
          drag
          {hasOffset && (
            <button
              style={{
                marginLeft: 4,
                background: "rgba(255,255,255,0.25)",
                border: "none",
                borderRadius: 3,
                color: "#fff",
                fontSize: 10,
                cursor: "pointer",
                padding: "0 3px",
                lineHeight: 1.4,
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onPositionChange!({ x: 0, y: 0 }); }}
              title="Reset position"
            >
              ×
            </button>
          )}
        </span>
      )}

      <Tag
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Editable text"
        onFocus={(e) => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          setAnchorRect(e.currentTarget.getBoundingClientRect());
          setShowToolbar(true);
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(e.currentTarget);
          sel?.removeAllRanges();
          sel?.addRange(range);
        }}
        onBlur={(e: React.FocusEvent) => {
          const committedText = (e.currentTarget as HTMLElement).innerText.trim();
          scheduleHide(committedText);
        }}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (!multiline && e.key === "Enter") {
            e.preventDefault();
            (e.currentTarget as HTMLElement).blur();
          }
        }}
        className={`${className} ${anim} editable-text`}
        style={{
          ...style,
          ...tsStyle,
          outline: "none",
          cursor: isDragging ? "grabbing" : "text",
          minWidth: "1em",
        }}
      >
        {display}
      </Tag>

      {showToolbar && anchorRect && onStyleChange && (
        <TextStyleToolbar
          ref={toolbarRef}
          style={textStyle ?? {}}
          onChange={onStyleChange}
          anchorRect={anchorRect}
          onKeepOpen={keepOpen}
        />
      )}
    </Wrap>
  );
}
