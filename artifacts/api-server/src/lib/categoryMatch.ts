const SYNONYMS: Array<[RegExp, string]> = [
  [/\b(dj|band|musician|music)\b/i, "music"],
  [/\b(photograph\w*)\b/i, "photograph"],
  [/\b(videograph\w*|video|cinematograph\w*)\b/i, "videograph"],
  [/\b(cater\w*|food|bar|drink|beverage)\b/i, "cater"],
  [/\b(florist|floral\w*|flower\w*|decor\w*)\b/i, "floral"],
  [/\b(venue|reception|ceremony)\b/i, "venue"],
  [/\b(cake|baker\w*|pastr\w*|dessert\w*)\b/i, "cake"],
  [/\b(officiant|minister|priest|rabbi)\b/i, "officiant"],
  [/\b(transport\w*|limo|car|shuttle)\b/i, "transport"],
  [/\b(invit\w*|stationer\w*|paper)\b/i, "stationery"],
  [/\b(attire|dress|suit|tux|gown|beauty|hair|makeup|hmua)\b/i, "attire"],
  [/\b(planner|coordinator|coordination)\b/i, "planner"],
  [/\b(favor\w*|gift\w*)\b/i, "favors"],
  [/\b(honeymoon|travel)\b/i, "honeymoon"],
  [/\b(rental\w*)\b/i, "rentals"],
];

export function normalizeCategory(raw: string | null | undefined): string {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return "";
  for (const [re, root] of SYNONYMS) if (re.test(s)) return root;
  return s
    .replace(/\s*&.*$/, "")
    .replace(/(ers|er|ing|ist|s)\b/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

const ROOT_TO_BUDGET_LABEL: Record<string, string> = {
  music: "Music/DJ/Band",
  photograph: "Photography",
  videograph: "Videography",
  cater: "Catering & Bar",
  floral: "Florals & Decor",
  venue: "Venue",
  cake: "Wedding Cake",
  officiant: "Officiant",
  transport: "Transportation",
  stationery: "Invitations & Stationery",
  attire: "Attire & Beauty",
  planner: "Wedding Planner",
  favors: "Favors & Gifts",
  honeymoon: "Honeymoon Fund",
  rentals: "Rentals",
};

export function canonicalBudgetLabel(vendorCategory: string | null | undefined): string {
  const root = normalizeCategory(vendorCategory);
  return ROOT_TO_BUDGET_LABEL[root] ?? (vendorCategory ?? "Other").trim();
}
