import { useEffect, useRef, useState } from "react";
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
  onDelete?: () => void;
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

const DRAG_THRESHOLD = 5;

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
  onDelete,
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
  const dragState = useRef<{
    startX: number; startY: number; origX: number; origY: number; moved: boolean;
  } | null>(null);
  const resizeState = useRef<{ startY: number; startSize: number } | null>(null);

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
      <Tag className={`${className} ${anim}`} style={{ ...style, ...tsStyle, transform }}>
        {display}
      </Tag>
    );
  }

  // --- blur / keep-open ---
  const scheduleHide = (committedText: string) => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    blurTimer.current = setTimeout(() => {
      if (toolbarRef.current && toolbarRef.current.contains(document.activeElement)) return;
      setShowToolbar(false);
      setAnchorRect(null);
      if (!onCommit) return;
      if (committedText === defaultValue.trim() || committedText === "") onCommit("");
      else onCommit(committedText);
    }, 80);
  };

  const keepOpen = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    if (keepOpenTimer.current) clearTimeout(keepOpenTimer.current);
    keepOpenTimer.current = setTimeout(() => ref.current?.focus({ preventScroll: true }), 120);
  };

  // --- whole-box drag (only when not editing) ---
  const canDrag = !!onPositionChange && !showToolbar;

  const handleWrapPointerDown = (e: React.PointerEvent) => {
    if (!onPositionChange || showToolbar) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: position?.x ?? 0,
      origY: position?.y ?? 0,
      moved: false,
    };
    setIsDragging(true);
  };

  const handleWrapPointerMove = (e: React.PointerEvent) => {
    if (!dragState.current || !onPositionChange) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      dragState.current.moved = true;
    }
    if (dragState.current.moved) {
      onPositionChange({ x: dragState.current.origX + dx, y: dragState.current.origY + dy });
    }
  };

  const handleWrapPointerUp = () => {
    const wasTap = dragState.current && !dragState.current.moved;
    dragState.current = null;
    setIsDragging(false);
    if (wasTap) ref.current?.focus();
  };

  // --- corner resize ---
  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const el = ref.current;
    const computed = el ? parseFloat(window.getComputedStyle(el).fontSize) : 16;
    resizeState.current = { startY: e.clientY, startSize: computed };
  };

  const handleResizePointerMove = (e: React.PointerEvent) => {
    if (!resizeState.current || !onStyleChange) return;
    const dy = e.clientY - resizeState.current.startY;
    const newSize = Math.max(8, Math.round(resizeState.current.startSize + dy * 0.5));
    onStyleChange({ ...(textStyle ?? {}), fontSize: `${newSize}px` });
  };

  const handleResizePointerUp = () => { resizeState.current = null; };

  const hasOffset = position && (position.x !== 0 || position.y !== 0);
  const showControls = hovered || showToolbar || isDragging;

  return (
    <Wrap
      style={{
        position: "relative",
        display: as === "div" ? "block" : "inline-block",
        transform,
        zIndex: isDragging ? 100 : undefined,
        outline: showControls ? "1.5px dashed rgba(99,102,241,0.5)" : undefined,
        outlineOffset: 4,
        borderRadius: 2,
        cursor: canDrag ? (isDragging ? "grabbing" : "grab") : undefined,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onPointerDown={handleWrapPointerDown}
      onPointerMove={handleWrapPointerMove}
      onPointerUp={handleWrapPointerUp}
      onPointerCancel={handleWrapPointerUp}
    >
      {/* Reset position button */}
      {hasOffset && showControls && (
        <span
          style={{
            position: "absolute",
            top: -20,
            right: 0,
            background: "rgba(99,102,241,0.9)",
            color: "#fff",
            borderRadius: 4,
            padding: "1px 6px",
            fontSize: 10,
            cursor: "pointer",
            userSelect: "none",
            zIndex: 300,
            lineHeight: 1.6,
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onPositionChange!({ x: 0, y: 0 })}
          title="Reset position"
        >
          ×
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
          scheduleHide((e.currentTarget as HTMLElement).innerText.trim());
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
          cursor: showToolbar ? "text" : "inherit",
          minWidth: "1em",
          pointerEvents: canDrag ? "none" : undefined,
        }}
      >
        {display}
      </Tag>

      {/* Corner resize handle */}
      {showControls && onStyleChange && (
        <span
          title="Drag to resize font"
          style={{
            position: "absolute",
            bottom: -6,
            right: -6,
            width: 12,
            height: 12,
            background: "rgba(99,102,241,0.9)",
            border: "2px solid white",
            borderRadius: 3,
            cursor: "se-resize",
            zIndex: 300,
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          }}
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onPointerCancel={handleResizePointerUp}
        />
      )}

      {showToolbar && anchorRect && onStyleChange && (
        <TextStyleToolbar
          ref={toolbarRef}
          style={textStyle ?? {}}
          onChange={onStyleChange}
          anchorRect={anchorRect}
          onKeepOpen={keepOpen}
          onDelete={onDelete ? () => {
            // Cancel pending blur/commit so the deleted element isn't re-added
            if (blurTimer.current) { clearTimeout(blurTimer.current); blurTimer.current = null; }
            onDelete();
          } : undefined}
        />
      )}
    </Wrap>
  );
}
