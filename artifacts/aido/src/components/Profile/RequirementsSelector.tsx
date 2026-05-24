import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

const REQUIREMENT_CATEGORIES: Array<{
  key: RequirementCategoryKey;
  title: string;
  description: string;
  cardClass: string;
  activeClass: string;
  textClass: string;
  options: string[];
}> = [
  {
    key: "mustHaves",
    title: "Must Have",
    description: "Non-negotiables for your venue search.",
    cardClass: "border-emerald-200 bg-emerald-50/60",
    activeClass: "border-emerald-300 bg-emerald-100 text-emerald-900 shadow-sm",
    textClass: "text-emerald-700",
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
    description: "Extras that would make the venue feel special.",
    cardClass: "border-amber-200 bg-amber-50/60",
    activeClass: "border-amber-300 bg-amber-100 text-amber-900 shadow-sm",
    textClass: "text-amber-700",
    options: [
      "Scenic photo spots",
      "Open bar",
      "Custom decor options",
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
    description: "Red flags that should stay off the shortlist.",
    cardClass: "border-rose-200 bg-rose-50/60",
    activeClass: "border-rose-300 bg-rose-100 text-rose-900 shadow-sm",
    textClass: "text-rose-700",
    options: [
      "Hidden fees",
      "Strict vendor restrictions",
      "Noise curfews",
      "Limited parking",
      "No alcohol allowed",
      "Mandatory in-house catering",
      "Shared spaces with other events",
      "Long travel distance",
      "Outdated decor",
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
      notes: "",
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
      return `${category.title}: ${selected}.`;
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
        <h4 className="font-serif text-xl font-semibold text-primary">Wedding priorities</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose what matters most before adding venues to your shortlist.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {REQUIREMENT_CATEGORIES.map((category) => {
          const categoryValue = normalized[category.key];
          const allSelected = categoryValue.selected.length === category.options.length;

          return (
            <section key={category.key} className={cn("space-y-3 rounded-2xl border p-4", category.cardClass)}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h5 className={cn("text-sm font-semibold", category.textClass)}>{category.title}</h5>
                  <p className="mt-1 text-xs text-muted-foreground">{category.description}</p>
                </div>
                <button
                  type="button"
                  className={cn("text-xs font-semibold underline-offset-4 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", category.textClass)}
                  onClick={() => updateCategory(category.key, {
                    selected: allSelected ? [] : category.options,
                  })}
                >
                  {allSelected ? "Clear" : "All"}
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
                      variant="outline"
                      className={cn(
                        "h-auto min-h-8 rounded-full border bg-white/90 px-3 py-1.5 text-xs text-foreground shadow-sm hover:-translate-y-0.5 hover:bg-white",
                        selected && category.activeClass,
                      )}
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
            </section>
          );
        })}
      </div>
    </div>
  );
}
