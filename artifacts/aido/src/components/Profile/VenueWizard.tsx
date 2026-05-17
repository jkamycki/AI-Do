import { useMemo, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { Mail, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";

export type VenueShortlistItem = {
  id: string;
  name: string;
  link: string;
  notes: string;
};

export type VenueScreenshot = {
  id: string;
  name: string;
  dataUrl: string;
};

export type VenueDiscoveryData = {
  guestCount: string;
  indoorOutdoor: string;
  budgetRange: string;
  location: string;
  style: string[];
  notes: string;
  aiVenueOptions: string;
  shortlist: VenueShortlistItem[];
  screenshots: VenueScreenshot[];
  emailDraftType: string;
  emailPrompt: string;
  emailDraft: string;
};

type VenueWizardProps = {
  value: VenueDiscoveryData;
  onChange: (value: VenueDiscoveryData) => void;
  coupleNames?: string;
};

const STYLE_OPTIONS = ["Rustic", "Modern", "Ballroom", "Garden", "Coastal", "Industrial", "Boho", "Classic"];

const DRAFT_LABELS = {
  inquiry: "Inquiry email",
  tour: "Tour request email",
  pricing: "Pricing request email",
  availability: "Availability check email",
} as const;

export const emptyVenueDiscoveryData: VenueDiscoveryData = {
  guestCount: "",
  indoorOutdoor: "",
  budgetRange: "",
  location: "",
  style: [],
  notes: "",
  aiVenueOptions: "",
  shortlist: [],
  screenshots: [],
  emailDraftType: "",
  emailPrompt: "",
  emailDraft: "",
};

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatLocations(text: string, fallback = "[location]") {
  const locations = text
    .split(/\r?\n|;/)
    .map((location) => location.trim())
    .filter(Boolean);
  return locations.length ? locations.join(", ") : fallback;
}

function officialVenueSearchUrl(query: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(`${query} official wedding venue website`)}`;
}

export function VenueWizard({ value, onChange, coupleNames = "our wedding" }: VenueWizardProps) {
  const [uploadError, setUploadError] = useState("");
  const [generatingPromptDraft, setGeneratingPromptDraft] = useState(false);
  const [generatingVenueOptions, setGeneratingVenueOptions] = useState(false);

  const styleText = value.style.length ? value.style.join(", ").toLowerCase() : "warm and elegant";

  const draftBase = useMemo(() => ({
    names: coupleNames,
    guestCount: value.guestCount || "[guest count]",
    location: formatLocations(value.location),
    budgetRange: value.budgetRange || "[budget range]",
    style: styleText,
    preference: value.indoorOutdoor || "indoor or outdoor",
  }), [coupleNames, styleText, value.budgetRange, value.guestCount, value.indoorOutdoor, value.location]);

  const update = (patch: Partial<VenueDiscoveryData>) => onChange({ ...value, ...patch });

  const bulletLines = (text: string) => text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*]|\u2022|\d+[.)])\s*/, "").trim())
    .filter(Boolean);

  const formatBulletNotes = (text: string) => {
    const lines = bulletLines(text);
    return lines.length ? lines.map((line) => `- ${line}`).join("\n") : "";
  };

  const formatNotesForEmail = (text: string) => {
    const lines = bulletLines(text);
    return lines.length ? `\n\nA few notes from us:\n${lines.map((line) => `- ${line}`).join("\n")}` : "";
  };

  const insertBulletLine = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const target = event.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const next = `${value.notes.slice(0, start)}\n- ${value.notes.slice(end)}`;
    update({ notes: next });
    requestAnimationFrame(() => {
      target.selectionStart = start + 3;
      target.selectionEnd = start + 3;
    });
  };

  const addShortlistItem = () => {
    update({
      shortlist: [
        ...value.shortlist,
        { id: createId(), name: "", link: "", notes: "" },
      ],
    });
  };

  const updateShortlistItem = (id: string, patch: Partial<VenueShortlistItem>) => {
    update({
      shortlist: value.shortlist.map((item) => item.id === id ? { ...item, ...patch } : item),
    });
  };

  const removeShortlistItem = (id: string) => {
    update({ shortlist: value.shortlist.filter((item) => item.id !== id) });
  };

  const onScreenshotUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setUploadError("");

    const validFiles = files.filter((file) => {
      if (!file.type.startsWith("image/")) {
        setUploadError("Only image screenshots can be saved here.");
        return false;
      }
      if (file.size > 1_500_000) {
        setUploadError("Please upload screenshots smaller than 1.5 MB so the profile stays quick to load.");
        return false;
      }
      return true;
    });

    Promise.all(
      validFiles.map((file) => new Promise<VenueScreenshot>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ id: createId(), name: file.name, dataUrl: String(reader.result ?? "") });
        reader.readAsDataURL(file);
      })),
    ).then((screenshots) => {
      if (screenshots.length) {
        update({ screenshots: [...value.screenshots, ...screenshots] });
      }
    }).catch(() => setUploadError("We could not read that screenshot. Please try a different image."));

    event.target.value = "";
  };

  const removeScreenshot = (id: string) => {
    update({ screenshots: value.screenshots.filter((screenshot) => screenshot.id !== id) });
  };

  const generateDraft = (type: keyof typeof DRAFT_LABELS) => {
    const opener = `Hi,\n\nMy name is ${draftBase.names}. We are looking for a wedding venue in ${draftBase.location} for about ${draftBase.guestCount} guests.`;
    const preference = `We are hoping for a ${draftBase.style} feel, prefer ${draftBase.preference} options, and are working with a venue budget around ${draftBase.budgetRange}.`;
    const notes = formatNotesForEmail(value.notes);
    const closers: Record<keyof typeof DRAFT_LABELS, string> = {
      inquiry: "Could you please send your wedding package information and next steps?",
      tour: "Do you have any available tour times over the next couple of weeks?",
      pricing: "Could you please share pricing, package inclusions, minimums, and any required fees?",
      availability: "Could you please let us know if you have availability around our wedding date and what dates are currently open?",
    };

    update({
      emailDraftType: DRAFT_LABELS[type],
      emailDraft: `${opener}\n\n${preference}${notes}\n\n${closers[type]}\n\nThank you,\n${draftBase.names}`,
    });
  };

  const fallbackPromptDraft = (prompt: string) => {
    const notes = formatNotesForEmail(value.notes);
    return `Hi,\n\nMy name is ${draftBase.names}. We are looking for a wedding venue in ${draftBase.location} for about ${draftBase.guestCount} guests.\n\nCould you please help us with the following request: ${prompt}\n\nFor context, we are hoping for a ${draftBase.style} feel, prefer ${draftBase.preference} options, and are working with a venue budget around ${draftBase.budgetRange}.${notes}\n\nCould you please let us know the best next step?\n\nThank you,\n${draftBase.names}`;
  };

  const fallbackVenueOptions = () => {
    const venueArea = formatLocations(value.location, "your preferred areas");
    const guestCount = value.guestCount.trim() || "your guest count";
    const budgetRange = value.budgetRange.trim() || "your budget";
    const preference = value.indoorOutdoor.trim() || "indoor or outdoor";

    return [
      "### Venue options to explore",
      "",
      `These options are based on ${guestCount} guests, ${preference} preference, a ${draftBase.style} style, and ${budgetRange}. Add each promising match to your shortlist, then attach the venue's official website once confirmed.`,
      "",
      `- [Garden estate or conservatory near ${venueArea}](${officialVenueSearchUrl(`garden estate conservatory near ${venueArea}`)}) - strong fit for floral, outdoor, or romantic styling; ask for rain backup, ceremony rules, and included rentals.`,
      `- [Boutique hotel or restaurant event room near ${venueArea}](${officialVenueSearchUrl(`boutique hotel restaurant wedding venue near ${venueArea}`)}) - useful for built-in service, guest convenience, and fewer outside rentals; confirm minimum spend and menu flexibility.`,
      `- [Ballroom, country club, or banquet venue near ${venueArea}](${officialVenueSearchUrl(`ballroom country club banquet wedding venue near ${venueArea}`)}) - practical for ${guestCount} guests; compare package minimums, service fees, and payment dates.`,
      `- [Historic mansion, museum, or gallery near ${venueArea}](${officialVenueSearchUrl(`historic mansion museum gallery wedding venue near ${venueArea}`)}) - adds character without heavy decor; ask about vendor restrictions, load-in rules, and accessibility.`,
      `- [Winery, brewery, or private estate near ${venueArea}](${officialVenueSearchUrl(`winery brewery private estate wedding venue near ${venueArea}`)}) - distinctive guest experience; confirm parking, noise limits, transportation, and weather backup.`,
      "",
      "### Questions to ask first",
      "",
      "- What dates are available in your preferred season?",
      "- What is included in the venue fee, and what rentals are extra?",
      "- Are catering, bar, decor, music, or vendor choices restricted?",
      "- What deposit amount, payment schedule, and cancellation terms apply?",
      "",
      "### Simple shortlist score",
      "",
      "Score each venue from 1-5 for budget fit, guest fit, style fit, logistics, and rule flexibility.",
    ].join("\n");
  };

  const generatePromptDraft = async () => {
    const prompt = (value.emailPrompt ?? "").trim();
    if (!prompt || generatingPromptDraft) return;

    setGeneratingPromptDraft(true);
    const context = [
      `User prompt: ${prompt}`,
      `Couple / names: ${draftBase.names}`,
      `Guest count: ${draftBase.guestCount}`,
      `Preferred locations: ${draftBase.location}`,
      `Budget range: ${draftBase.budgetRange}`,
      `Style: ${draftBase.style}`,
      `Indoor/outdoor preference: ${draftBase.preference}`,
      value.notes ? `Notes:\n${formatBulletNotes(value.notes)}` : "",
    ].filter(Boolean).join("\n");

    try {
      const response = await authFetch("/api/vendor/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorType: "wedding venue",
          emailType: "custom venue outreach email based on the user's prompt",
          vendorName: "",
          weddingDate: "TBD",
          venue: "Venue search in progress",
          guestCount: draftBase.guestCount,
          additionalNotes: context,
        }),
      });

      if (!response.ok) throw new Error("AI draft failed");
      const data = await response.json() as { subject?: string; body?: string };
      const subject = data.subject?.trim();
      const body = data.body?.trim();

      update({
        emailDraftType: "Custom AI email",
        emailDraft: `${subject ? `Subject: ${subject}\n\n` : ""}${body || fallbackPromptDraft(prompt)}`,
      });
    } catch {
      update({
        emailDraftType: "Custom prompt email",
        emailDraft: fallbackPromptDraft(prompt),
      });
    } finally {
      setGeneratingPromptDraft(false);
    }
  };

  const generateVenueOptions = async () => {
    if (generatingVenueOptions) return;
    setGeneratingVenueOptions(true);
    try {
      const response = await authFetch("/api/ai/venue-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coupleNames,
          guestCount: value.guestCount,
          indoorOutdoor: value.indoorOutdoor,
          budgetRange: value.budgetRange,
          location: formatLocations(value.location, ""),
          style: value.style,
          notes: formatBulletNotes(value.notes),
        }),
      });
      if (!response.ok) throw new Error("AI venue options failed");
      const data = await response.json() as { text?: string };
      const text = data.text?.trim();
      if (!text) throw new Error("AI venue options empty");
      update({ aiVenueOptions: text });
    } catch {
      update({ aiVenueOptions: fallbackVenueOptions() });
    } finally {
      setGeneratingVenueOptions(false);
    }
  };

  return (
    <section className="space-y-6 rounded-lg border border-primary/15 bg-background p-4 shadow-sm sm:p-5">
      <div>
        <h3 className="font-serif text-xl text-primary">Venue Discovery Wizard</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Use this as a planning helper while you search. Everything here saves with your wedding profile.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">
          Guest count
          <Input
            value={value.guestCount}
            onChange={(event) => update({ guestCount: event.target.value })}
            placeholder="Approx. 120"
            inputMode="numeric"
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Indoor / outdoor preference
          <Select
            value={value.indoorOutdoor}
            onValueChange={(indoorOutdoor) => update({ indoorOutdoor })}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Choose preference" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Indoor">Indoor</SelectItem>
              <SelectItem value="Outdoor">Outdoor</SelectItem>
              <SelectItem value="Both">Both</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-2 text-sm font-medium">
          Budget range
          <Input
            value={value.budgetRange}
            onChange={(event) => update({ budgetRange: event.target.value })}
            placeholder="$8,000 - $15,000"
          />
        </label>
        <label className="space-y-2 text-sm font-medium md:col-span-2">
          Preferred locations
          <Textarea
            value={value.location}
            onChange={(event) => update({ location: event.target.value })}
            placeholder={"City, state, or preferred area\nAdd another city or area on a new line"}
            rows={2}
          />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Style</p>
        <div className="flex flex-wrap gap-2">
          {STYLE_OPTIONS.map((style) => {
            const selected = value.style.includes(style);
            return (
              <Button
                key={style}
                type="button"
                size="sm"
                variant={selected ? "default" : "outline"}
                onClick={() => {
                  update({
                    style: selected ? value.style.filter((item) => item !== style) : [...value.style, style],
                  });
                }}
              >
                {style}
              </Button>
            );
          })}
        </div>
      </div>

      <label className="block space-y-2 text-sm font-medium">
        Notes
        <Textarea
          value={value.notes}
          onChange={(event) => update({ notes: event.target.value })}
          onFocus={() => {
            if (!value.notes.trim()) update({ notes: "- " });
          }}
          onBlur={() => update({ notes: formatBulletNotes(value.notes) })}
          onKeyDown={insertBulletLine}
          placeholder={"- Must-haves\n- Questions\n- Accessibility needs\n- Parking or catering rules"}
          rows={4}
        />
      </label>

      <div className="space-y-3 rounded-lg border border-primary/15 bg-primary/5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" />
              AI venue options
            </p>
            <p className="text-xs text-muted-foreground">
              Generate named venue suggestions with website links and shortlist guidance from the details above.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={generateVenueOptions}
            disabled={generatingVenueOptions}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            {generatingVenueOptions ? "Generating..." : "Generate options"}
          </Button>
        </div>
        {value.aiVenueOptions && (
          <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm leading-relaxed">
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-headings:font-serif prose-headings:text-primary">
              <ReactMarkdown>{value.aiVenueOptions}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Shortlist</p>
            <p className="text-xs text-muted-foreground">Save venue names, links, and quick notes.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addShortlistItem} className="gap-2">
            <Plus className="h-4 w-4" />
            Add venue
          </Button>
        </div>

        <div className="space-y-3">
          {value.shortlist.map((item) => (
            <div key={item.id} className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-[1fr_1fr_auto]">
              <Input
                value={item.name}
                onChange={(event) => updateShortlistItem(item.id, { name: event.target.value })}
                placeholder="Venue name"
              />
              <Input
                value={item.link}
                onChange={(event) => updateShortlistItem(item.id, { link: event.target.value })}
                placeholder="Website or saved link"
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeShortlistItem(item.id)} aria-label="Remove venue">
                <Trash2 className="h-4 w-4" />
              </Button>
              <Textarea
                value={item.notes}
                onChange={(event) => updateShortlistItem(item.id, { notes: event.target.value })}
                placeholder="Notes"
                rows={2}
                className="md:col-span-3"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">Screenshots</p>
          <p className="text-xs text-muted-foreground">Upload small screenshots from venue sites or social posts.</p>
        </div>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-4 py-5 text-sm font-medium text-primary">
          <Upload className="h-4 w-4" />
          Upload screenshots
          <input type="file" accept="image/*" multiple className="sr-only" onChange={onScreenshotUpload} />
        </label>
        {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
        {value.screenshots.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {value.screenshots.map((screenshot) => (
              <div key={screenshot.id} className="overflow-hidden rounded-lg border border-border">
                <img src={screenshot.dataUrl} alt={screenshot.name} className="h-32 w-full object-cover" />
                <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                  <span className="truncate">{screenshot.name}</span>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeScreenshot(screenshot.id)} aria-label="Remove screenshot">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-primary/10 bg-primary/5 p-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-primary" />
            Outreach email drafts
          </p>
          <p className="text-xs text-muted-foreground">Generate a starter message, then edit it before sending.</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="venue-email-prompt">
            Custom AI prompt
          </label>
          <Textarea
            id="venue-email-prompt"
            value={value.emailPrompt ?? ""}
            onChange={(event) => update({ emailPrompt: event.target.value })}
            placeholder="Example: Write a friendly email asking if they allow outside catering and if there are Saturday dates available next fall."
            rows={3}
          />
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={generatePromptDraft}
            disabled={generatingPromptDraft || !(value.emailPrompt ?? "").trim()}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            {generatingPromptDraft ? "Generating..." : "Generate from prompt"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(DRAFT_LABELS).map(([type, label]) => (
            <Button key={type} type="button" variant="outline" size="sm" onClick={() => generateDraft(type as keyof typeof DRAFT_LABELS)} className="gap-2">
              <Mail className="h-4 w-4" />
              {label}
            </Button>
          ))}
        </div>
        <Textarea
          value={value.emailDraft}
          onChange={(event) => update({ emailDraft: event.target.value })}
          placeholder="Your generated outreach draft will appear here."
          rows={8}
        />
      </div>
    </section>
  );
}
