import { Lightbulb, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type VenueBrainstormItem = {
  id: string;
  title: string;
  details: string;
};

export type VenueBrainstormData = {
  notes: string;
  ideas: VenueBrainstormItem[];
  inspiration: VenueBrainstormItem[];
  conversations: VenueBrainstormItem[];
  suggestions: string[];
};

type VenueBrainstormProps = {
  value: VenueBrainstormData;
  onChange: (value: VenueBrainstormData) => void;
};

export const emptyVenueBrainstormData: VenueBrainstormData = {
  notes: "",
  ideas: [],
  inspiration: [],
  conversations: [],
  suggestions: [],
};

const DEFAULT_SUGGESTIONS = [
  "Compare what is included in the venue fee before looking only at the headline price.",
  "Ask whether catering, bar service, rentals, security, parking, and cleanup are required vendors.",
  "Check weather backup plans if any part of the day could be outdoors.",
  "Confirm guest capacity for seated dinner, ceremony, dancing, and vendor setup space.",
  "Think about travel time between ceremony, photos, hotels, and reception.",
];

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sectionLabel(section: keyof Pick<VenueBrainstormData, "ideas" | "inspiration" | "conversations">) {
  if (section === "ideas") return "Idea board";
  if (section === "inspiration") return "Inspiration";
  return "Conversations";
}

export function VenueBrainstorm({ value, onChange }: VenueBrainstormProps) {
  const update = (patch: Partial<VenueBrainstormData>) => onChange({ ...value, ...patch });

  const addItem = (section: keyof Pick<VenueBrainstormData, "ideas" | "inspiration" | "conversations">) => {
    update({
      [section]: [
        ...value[section],
        { id: createId(), title: "", details: "" },
      ],
    });
  };

  const updateItem = (
    section: keyof Pick<VenueBrainstormData, "ideas" | "inspiration" | "conversations">,
    id: string,
    patch: Partial<VenueBrainstormItem>,
  ) => {
    update({
      [section]: value[section].map((item) => item.id === id ? { ...item, ...patch } : item),
    });
  };

  const removeItem = (
    section: keyof Pick<VenueBrainstormData, "ideas" | "inspiration" | "conversations">,
    id: string,
  ) => {
    update({ [section]: value[section].filter((item) => item.id !== id) });
  };

  return (
    <section className="space-y-6 rounded-lg border border-primary/15 bg-background p-4 shadow-sm sm:p-5">
      <div>
        <h3 className="font-serif text-xl text-primary">Venue Brainstorm</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Capture early ideas without locking yourself into a venue yet.
        </p>
      </div>

      <label className="block space-y-2 text-sm font-medium">
        Notes
        <Textarea
          value={value.notes}
          onChange={(event) => update({ notes: event.target.value })}
          placeholder="What kind of setting feels right? What do you want guests to remember?"
          rows={4}
        />
      </label>

      <div className="grid gap-4 lg:grid-cols-3">
        {(["ideas", "inspiration", "conversations"] as const).map((section) => (
          <div key={section} className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{sectionLabel(section)}</p>
                <p className="text-xs text-muted-foreground">
                  {section === "ideas" && "Venue types, moods, and must-haves."}
                  {section === "inspiration" && "Links, photos, or references to revisit."}
                  {section === "conversations" && "Notes from calls, tours, or planner chats."}
                </p>
              </div>
              <Button type="button" variant="outline" size="icon" onClick={() => addItem(section)} aria-label={`Add ${sectionLabel(section)}`}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3">
              {value[section].map((item) => (
                <div key={item.id} className="space-y-2 rounded-lg bg-muted/40 p-3">
                  <div className="flex gap-2">
                    <Input
                      value={item.title}
                      onChange={(event) => updateItem(section, item.id, { title: event.target.value })}
                      placeholder="Title"
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(section, item.id)} aria-label="Remove item">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea
                    value={item.details}
                    onChange={(event) => updateItem(section, item.id, { details: event.target.value })}
                    placeholder="Details"
                    rows={3}
                  />
                </div>
              ))}
              {value[section].length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  Nothing saved yet.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-lg border border-primary/10 bg-primary/5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium">
              <Lightbulb className="h-4 w-4 text-primary" />
              Things to consider
            </p>
            <p className="text-xs text-muted-foreground">Optional prompts to help compare future venues.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => update({ suggestions: DEFAULT_SUGGESTIONS })} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Suggest considerations
          </Button>
        </div>
        {value.suggestions.length > 0 && (
          <ul className="space-y-2 text-sm text-muted-foreground">
            {value.suggestions.map((suggestion) => (
              <li key={suggestion} className="rounded-md bg-background px-3 py-2">
                {suggestion}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
