export function displayFirstName(name?: string | null) {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "";
  return parts.slice(0, -1).join(" ");
}

export function coupleFirstNames(
  partner2Name?: string | null,
  partner1Name?: string | null,
  fallback = "The Couple",
) {
  return [displayFirstName(partner2Name), displayFirstName(partner1Name)]
    .filter(Boolean)
    .join(" & ") || fallback;
}
