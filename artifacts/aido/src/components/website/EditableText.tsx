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

// Map the animation keys saved by TextStyleToolbar to their full CSS shorthand.
// Driving the animation via inline style ensures it survives any class-based
// purging or load-order issues with the imported keyframes.
const ANIMATION_CSS: Record<string, string> = {
  "wsa-fade-in":    "wsa-fade-in 0.9s ease-in-out both",
  "wsa-slide-up":   "wsa-slide-up 0.8s ease-out both",
  "wsa-slide-right": "wsa-slide-right 0.8s ease-out both",
  "wsa-zoom-in":    "wsa-zoom-in 0.8s ease-out both",
  "wsa-bounce-in":  "wsa-bounce-in 0.7s ease-out both",
};

function animationStyle(animation: string | undefined): React.CSSProperties {
  if (!animation) return {};
  const css = ANIMATION_CSS[animation];
  return css ? { animation: css } : {};
}

// Module-level registry of debounced commits scheduled by EditableText's blur
// handler. Exposing a flush lets the editor's Undo (and other "I need the
// latest text NOW" callers) run pending onCommit callbacks synchronously,
// avoiding the race where clicking Undo blurs the editable but the 80ms
// commit timer hasn't fired before the undo handler reads its empty queue.
const pendingEditableCommits = new Set<() => void>();

export function flushPendingEditableCommits(): void {
  if (pendingEditableCommits.size === 0) return;
  const fns = Array.from(pendingEditableCommits);
  pendingEditableCommits.clear();
  for (const fn of fns) {
    try { fn(); } catch { /* ignore — best-effort flush */ }
  }
}

// Lightweight pub/sub so the editor preview can show a "drop here to delete"
// trash zone whenever a deletable EditableText is being dragged. EditableText
// fires drag-start / drag-end; the editor subscribes and reveals the trash.
type EditableDragPhase = "start" | "end";
const editableDragSubs = new Set<(phase: EditableDragPhase) => void>();
export function subscribeEditableDrag(fn: (phase: EditableDragPhase) => void): () => void {
  editableDragSubs.add(fn);
  return () => { editableDragSubs.delete(fn); };
}
function emitEditableDrag(phase: EditableDragPhase) {
  for (const fn of editableDragSubs) {
    try { fn(phase); } catch { /* ignore */ }
  }
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
  const animStyle = animationStyle(textStyle?.animation);
  // Re-key by the chosen animation so React remounts the element when the
  // animation name changes — guarantees the keyframes restart from frame 0.
  const animKey = textStyle?.animation ?? "";
  const transform = position ? `translate(${position.x}px, ${position.y}px)` : undefined;

  const Tag = (as === "div" ? "div" : "span") as React.ElementType;
  const Wrap = (as === "div" ? "div" : "span") as React.ElementType;

  if (!editable) {
    // On the public site, an empty value with no fallback should not paint a
    // blank container — render nothing so guests don't see ghost rows.
    if ((display ?? "").trim() === "") return null;
    return (
      <Tag key={animKey} className={className} style={{ ...style, ...tsStyle, ...animStyle, transform }}>
        {display}
      </Tag>
    );
  }

  // --- blur / keep-open ---
  const scheduleHide = (committedText: string) => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    const fire = () => {
      blurTimer.current = null;
      pendingEditableCommits.delete(fire);
      if (toolbarRef.current && toolbarRef.current.contains(document.activeElement)) return;
      setShowToolbar(false);
      setAnchorRect(null);
      // Note: empty commits no longer auto-delete deletable text boxes —
      // users delete by dragging into the editor's trash drop zone.
      // Keeping an empty value here lets the EditableText hide via
      // `isVisiblyEmpty` in the editor preview without losing the row.
      if (!onCommit) return;
      if (committedText === defaultValue.trim() || committedText === "") onCommit("");
      else onCommit(committedText);
    };
    pendingEditableCommits.add(fire);
    blurTimer.current = setTimeout(fire, 80);
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
      if (!dragState.current.moved) {
        // First time we cross the threshold → tell the editor a drag is on.
        // Only emit when this element is deletable (onDelete present), so we
        // don't reveal a trash zone for elements that can't be deleted anyway.
        if (onDelete) emitEditableDrag("start");
      }
      dragState.current.moved = true;
    }
    if (dragState.current.moved) {
      onPositionChange({ x: dragState.current.origX + dx, y: dragState.current.origY + dy });
    }
  };

  const handleWrapPointerUp = (e: React.PointerEvent) => {
    const wasTap = dragState.current && !dragState.current.moved;
    const wasDrag = dragState.current && dragState.current.moved;
    dragState.current = null;
    setIsDragging(false);
    if (wasTap) ref.current?.focus();
    // Drop-on-trash: if a drag ended over the trash zone, fire onDelete
    // instead of leaving the element at its dropped position. We compare
    // against the trash zone's bounding rect rather than using
    // document.elementFromPoint(), because the dragged element has
    // zIndex:100 and its translated box covers the trash zone — so
    // elementFromPoint would return the dragged element itself, not the
    // trash. Bounding-rect math sees through the overlap.
    if (wasDrag && onDelete) {
      emitEditableDrag("end");
      try {
        const trash = document.querySelector('[data-aido-trash="true"]') as HTMLElement | null;
        if (trash) {
          const r = trash.getBoundingClientRect();
          // Tolerance: treat anything within ~24px of the chip as "on" it,
          // so users don't have to land pixel-perfect on the small target.
          const pad = 24;
          const inside = e.clientX >= r.left - pad && e.clientX <= r.right + pad
            && e.clientY >= r.top - pad && e.clientY <= r.bottom + pad;
          if (inside) onDelete();
        }
      } catch { /* ignore */ }
    }
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
  // Visibly-empty element: don't render a Wrap, ever. The earlier "preserve
  // while toolbar open" carveout still left a thin focus rectangle visible
  // during editing because:
  //   1. .editable-text:focus has `outline: 2px solid !important` in CSS, and
  //   2. the inner Tag has minWidth:"1em", so an empty contenteditable still
  //      occupies 1em x line-height (huge on a text-7xl couple-name).
  // Hiding the Wrap unconditionally collapses the focused contenteditable
  // (display:none triggers blur), the toolbar closes via the blur path, and
  // there's nothing for the focus ring to paint around.
  const isVisiblyEmpty = (display ?? "").trim() === "";
  const showControls = (hovered || showToolbar || isDragging) && !isVisiblyEmpty;
  if (isVisiblyEmpty) {
    return <Wrap aria-hidden="true" style={{ display: "none" }} />;
  }

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
        key={animKey}
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
            return;
          }
          // Delete/Backspace with all text selected (or already empty) deletes the whole text box
          if ((e.key === "Delete" || e.key === "Backspace") && onDelete) {
            const el = e.currentTarget as HTMLElement;
            const text = el.innerText;
            const sel = window.getSelection();
            const allSelected = !!sel && sel.toString().length > 0 && sel.toString() === text;
            if (allSelected || text.length === 0) {
              e.preventDefault();
              if (blurTimer.current) { clearTimeout(blurTimer.current); blurTimer.current = null; }
              onDelete();
            }
          }
        }}
        className={`${className} editable-text`}
        style={{
          ...style,
          ...tsStyle,
          ...animStyle,
          outline: "none",
          cursor: showToolbar ? "text" : "inherit",
          minWidth: "1em",
          // Block pointer events only while actively dragging so cursor placement still works on tap-to-edit
          pointerEvents: isDragging ? "none" : undefined,
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
