import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type RequirementCategoryKey = "mustHaves" | "niceToHaves" | "mustNotHaves";

export type RequirementCategoryValue = {
  selected: string[];
  notes: string;
};

export type RequirementsSelectorValue = Record<RequirementCategoryKey, RequirementCategoryValue>;

type RequirementsSelectorProps = {
  value: RequirementsSelectorValue;
  onChange: (value: RequirementsSelectorValue) => void;
};

const NOTES_PLACEHOLDER = [
  "Dealbreakers",
  "Preferences",
  "Red flags",
  "Optional upgrades",
  "Required accommodations",
].join("\n");

const REQUIREMENT_CATEGORIES: Array<{
  key: RequirementCategoryKey;
  title: string;
  options: string[];
}> = [
  {
    key: "mustHaves",
    title: "Must Have",
    options: [
      "Budget-friendly",
      "Specific date availability",
      "Indoor option",
      "Outdoor option",
      "ADA accessible",
      "Parking included",
      "Vendor flexibility",
      "Pet-friendly",
      "On-site coordinator",
      "Private getting-ready suite",
      "Climate control",
      "Backup weather plan",
      "Preferred location radius",
    ],
  },
  {
    key: "niceToHaves",
    title: "Nice to Have",
    options: [
      "Scenic photo spots",
      "Open bar",
      "Custom décor options",
      "Late-night food",
      "On-site lodging",
      "Outdoor ceremony space",
      "Upgraded lighting",
      "Live music allowed",
      "Multiple layout options",
      "High-end catering",
      "Extra guest capacity",
      "Early setup access",
    ],
  },
  {
    key: "mustNotHaves",
    title: "Must Avoid",
    options: [
      "Hidden fees",
      "Strict vendor restrictions",
      "Noise curfews",
      "Limited parking",
      "No alcohol allowed",
      "Mandatory in-house catering",
      "Shared spaces with other events",
      "Long travel distance",
      "Outdated décor",
      "Poor lighting",
      "No backup plan",
      "Guest capacity limits",
    ],
  },
];

export const emptyRequirementsSelectorValue: RequirementsSelectorValue = {
  mustHaves: { selected: [], notes: "" },
  niceToHaves: { selected: [], notes: "" },
  mustNotHaves: { selected: [], notes: "" },
};

export function normalizeRequirementsSelectorValue(value?: Partial<RequirementsSelectorValue> | null): RequirementsSelectorValue {
  return REQUIREMENT_CATEGORIES.reduce((acc, category) => {
    const categoryValue = value?.[category.key];
    const selected = Array.isArray(categoryValue?.selected)
      ? categoryValue.selected.filter(option => category.options.includes(option))
      : [];
    acc[category.key] = {
      selected,
      notes: typeof categoryValue?.notes === "string" ? categoryValue.notes : "",
    };
    return acc;
  }, { ...emptyRequirementsSelectorValue } as RequirementsSelectorValue);
}

export function formatRequirementsForPrompt(value?: RequirementsSelectorValue | null): string {
  const normalized = normalizeRequirementsSelectorValue(value);
  return REQUIREMENT_CATEGORIES
    .map((category) => {
      const categoryValue = normalized[category.key];
      const selected = categoryValue.selected.length ? categoryValue.selected.join(", ") : "none selected";
      const notes = categoryValue.notes.trim() ? ` Notes: ${categoryValue.notes.trim()}` : "";
      return `${category.title}: ${selected}.${notes}`;
    })
    .join("\n");
}

export default function RequirementsSelector({ value, onChange }: RequirementsSelectorProps) {
  const normalized = normalizeRequirementsSelectorValue(value);

  const updateCategory = (key: RequirementCategoryKey, patch: Partial<RequirementCategoryValue>) => {
    onChange({
      ...normalized,
      [key]: {
        ...normalized[key],
        ...patch,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-foreground">Requirements Selector</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Capture your dealbreakers, preferences, and red flags for venue research.
        </p>
      </div>

      {REQUIREMENT_CATEGORIES.map((category) => {
        const categoryValue = normalized[category.key];
        const allSelected = categoryValue.selected.length === category.options.length;

        return (
          <section key={category.key} className="space-y-3 rounded-lg border border-primary/15 bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <h5 className="text-sm font-semibold text-foreground">{category.title}</h5>
              <button
                type="button"
                className="text-xs font-semibold text-primary underline-offset-4 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => updateCategory(category.key, {
                  selected: allSelected ? [] : category.options,
                })}
              >
                {allSelected ? "Clear all" : "Select all"}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {category.options.map((option) => {
                const selected = categoryValue.selected.includes(option);
                return (
                  <Button
                    key={option}
                    type="button"
                    size="sm"
                    variant={selected ? "default" : "outline"}
                    className="h-auto min-h-8 rounded-full px-3 py-1.5 text-xs sm:text-sm"
                    onClick={() => updateCategory(category.key, {
                      selected: selected
                        ? categoryValue.selected.filter(item => item !== option)
                        : [...categoryValue.selected, option],
                    })}
                  >
                    {option}
                  </Button>
                );
              })}
            </div>

            <Textarea
              value={categoryValue.notes}
              onChange={(event) => updateCategory(category.key, { notes: event.target.value })}
              placeholder={NOTES_PLACEHOLDER}
              rows={4}
              className="min-h-24 resize-y border-primary/20 bg-background text-sm"
            />
          </section>
        );
      })}
    </div>
  );
}
