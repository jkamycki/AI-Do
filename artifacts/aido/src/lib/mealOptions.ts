export type MealOption = {
  value: string;
  label: string;
};

export const DEFAULT_RSVP_MEAL_OPTIONS: MealOption[] = [
  { value: "chicken", label: "Chicken" },
  { value: "steak", label: "Steak" },
  { value: "fish", label: "Fish" },
  { value: "none", label: "None / No preference" },
];

export function optionValueFromLabel(label: string, existing: MealOption[] = []) {
  const base =
    label
      .trim()
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "meal";
  const used = new Set(existing.map((option) => option.value));
  let value = base;
  let index = 2;
  while (used.has(value)) {
    value = `${base}_${index}`;
    index += 1;
  }
  return value;
}

export function normalizeMealOptions(value: unknown): MealOption[] {
  if (!Array.isArray(value)) return DEFAULT_RSVP_MEAL_OPTIONS;

  const seen = new Set<string>();
  const options = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const raw = item as Partial<MealOption>;
      const label = typeof raw.label === "string" ? raw.label.trim() : "";
      const value = typeof raw.value === "string" ? raw.value.trim() : "";
      if (!label || !value || seen.has(value)) return null;
      seen.add(value);
      return { value, label };
    })
    .filter((item): item is MealOption => !!item)
    .slice(0, 12);

  return options.length > 0 ? options : DEFAULT_RSVP_MEAL_OPTIONS;
}
