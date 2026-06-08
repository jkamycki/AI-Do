import { Building2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

export type VenueStatus = "booked" | "not_yet";

type VenueQuestionProps = {
  value: VenueStatus;
  onChange: (value: VenueStatus) => void;
};

const OPTIONS: Array<{
  value: VenueStatus;
  label: string;
  description: string;
  icon: typeof Building2;
}> = [
  {
    value: "booked",
    label: "Yes",
    description: "I already have a venue booked.",
    icon: Building2,
  },
  {
    value: "not_yet",
    label: "Not yet",
    description: "Save the basics now. Venue search can come later.",
    icon: MapPin,
  },
];

export function VenueQuestion({ value, onChange }: VenueQuestionProps) {
  return (
    <section className="space-y-3 rounded-lg border border-primary/10 bg-primary/5 p-4 sm:p-5">
      <div>
        <h3 className="font-serif text-xl text-primary">Do you already have a venue booked?</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose the option that matches where you are. You can still continue and save your profile anytime.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = value === option.value;
          return (
            <Button
              key={option.value}
              type="button"
              variant={selected ? "default" : "outline"}
              onClick={() => onChange(option.value)}
              className="h-auto justify-start gap-3 whitespace-normal rounded-lg px-4 py-4 text-left"
              data-testid={`venue-status-${option.value}`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="min-w-0">
                <span className="block font-semibold">{option.label}</span>
                <span className={selected ? "block text-xs text-primary-foreground/85" : "block text-xs text-muted-foreground"}>
                  {option.description}
                </span>
              </span>
            </Button>
          );
        })}
      </div>
    </section>
  );
}
