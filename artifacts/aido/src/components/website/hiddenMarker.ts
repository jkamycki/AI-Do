export const EDITABLE_HIDDEN_MARKER = "__AIDO_HIDDEN_TEXT_MARKER__";

const LEGACY_HIDDEN_MARKERS = new Set<string>([
  EDITABLE_HIDDEN_MARKER,
  "\u0000__aido_hidden__\u0000",
  "\\u0000__aido_hidden__\\u0000",
]);

export function isEditableHiddenMarker(value: unknown): boolean {
  return typeof value === "string" && LEGACY_HIDDEN_MARKERS.has(value);
}

export function stripEditableHiddenMarkers(value: unknown): string {
  if (typeof value !== "string") return "";
  let next = value;
  for (const marker of LEGACY_HIDDEN_MARKERS) {
    next = next.split(marker).join("");
  }
  return next.replace(/\n{3,}/g, "\n\n").trim();
}
