import { useEffect, useMemo, useState } from "react";
import type { ElementType } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Copy,
  Flower2,
  Lightbulb,
  MapPin,
  Mic2,
  Music2,
  Palette,
  Scissors,
  Shirt,
  Sofa,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type GuideStatus = "not-started" | "in-progress" | "complete";
type QuestionType = "text" | "textarea" | "choice" | "multi";
type AnswerValue = string | string[];

type GuideQuestion = {
  id: string;
  label: string;
  helper?: string;
  type: QuestionType;
  placeholder?: string;
  options?: string[];
};

type GuideDefinition = {
  id: string;
  title: string;
  description: string;
  time: string;
  icon: ElementType;
  startHere?: boolean;
  questions: GuideQuestion[];
};

type GuideRecord = {
  status?: GuideStatus;
  answers: Record<string, AnswerValue>;
  updatedAt?: string;
};

type GuideStore = Record<string, GuideRecord>;

const STORAGE_KEY = "aido_planning_guides_v1";

const GUIDES: GuideDefinition[] = [
  {
    id: "guest-list",
    title: "Guest List",
    description: "Build your list with capacity planning, RSVP groups, and priority tiers.",
    time: "5 min",
    icon: ClipboardList,
    startHere: true,
    questions: [
      {
        id: "guest_goal",
        label: "What guest count feels right?",
        helper: "Use a range if you are still deciding.",
        type: "text",
        placeholder: "e.g. 120-150",
      },
      {
        id: "groups",
        label: "Which groups need to be represented?",
        type: "multi",
        options: ["Immediate family", "Extended family", "Wedding party", "College friends", "Work friends", "Parents' guests", "Kids"],
      },
      {
        id: "priority",
        label: "How should A.I Do prioritize invitations?",
        type: "choice",
        options: ["Keep it intimate", "Balanced list", "Invite broadly", "Parents decide some seats"],
      },
      {
        id: "notes",
        label: "Any guest sensitivities Aria should remember?",
        helper: "Accessibility needs, family dynamics, language needs, or travel concerns.",
        type: "textarea",
        placeholder: "e.g. Keep both sides of the family balanced and note wheelchair access.",
      },
    ],
  },
  {
    id: "colors-theme",
    title: "Colors & Theme",
    description: "Define the visual direction, palette, and feeling for the day.",
    time: "10 min",
    icon: Palette,
    questions: [
      {
        id: "style_words",
        label: "Choose the words that should guide the design.",
        type: "multi",
        options: ["Romantic", "Modern", "Classic", "Garden", "Glam", "Minimal", "Editorial", "Coastal", "Rustic-elegant"],
      },
      {
        id: "palette",
        label: "What colors are you drawn to?",
        type: "text",
        placeholder: "e.g. blush, cream, champagne, sage",
      },
      {
        id: "avoid",
        label: "Any colors or themes to avoid?",
        type: "textarea",
        placeholder: "e.g. No bright red, no rustic burlap, no heavy black.",
      },
      {
        id: "venue_fit",
        label: "How should the design fit the venue?",
        type: "textarea",
        placeholder: "e.g. Chateau feel, soft florals, gold details, candlelight.",
      },
    ],
  },
  {
    id: "florist",
    title: "Florist",
    description: "Plan ceremony florals, personal flowers, reception decor, and cleanup.",
    time: "10 min",
    icon: Flower2,
    questions: [
      {
        id: "must_have_florals",
        label: "Which floral pieces do you need?",
        type: "multi",
        options: ["Bouquets", "Boutonnieres", "Ceremony arch", "Aisle flowers", "Centerpieces", "Cake flowers", "Installations"],
      },
      {
        id: "style",
        label: "What floral style feels right?",
        type: "choice",
        options: ["Soft garden", "Modern sculptural", "Classic white", "Colorful seasonal", "Greenery-forward"],
      },
      {
        id: "budget",
        label: "Target floral budget",
        type: "text",
        placeholder: "e.g. $4,500",
      },
      {
        id: "logistics",
        label: "Any delivery, flip, or cleanup notes?",
        type: "textarea",
        placeholder: "e.g. Ceremony pieces should move to sweetheart table after cocktail hour.",
      },
    ],
  },
  {
    id: "rentals",
    title: "Rentals",
    description: "Plan tables, chairs, linens, tabletop, lounge pieces, and extras.",
    time: "8 min",
    icon: Sofa,
    questions: [
      {
        id: "rental_needs",
        label: "What rental categories do you need?",
        type: "multi",
        options: ["Tables", "Chairs", "Linens", "Chargers", "Flatware", "Glassware", "Lounge furniture", "Tent", "Dance floor"],
      },
      {
        id: "look",
        label: "What should rentals feel like?",
        type: "choice",
        options: ["Clean and minimal", "Romantic and soft", "Luxury formal", "Colorful statement", "Venue-provided basics"],
      },
      {
        id: "counts",
        label: "Known quantities or guest count assumptions",
        type: "textarea",
        placeholder: "e.g. 150 guests, 15 round tables, sweetheart table, 2 bars.",
      },
      {
        id: "delivery",
        label: "Delivery and pickup constraints",
        type: "textarea",
        placeholder: "e.g. Venue allows load-in after 9 AM and pickup by midnight.",
      },
    ],
  },
  {
    id: "wedding-dress",
    title: "Wedding Dress",
    description: "Capture silhouette, details, alteration timing, and boutique prep.",
    time: "5 min",
    icon: Shirt,
    questions: [
      {
        id: "silhouette",
        label: "Preferred silhouette",
        type: "multi",
        options: ["A-line", "Ball gown", "Fit and flare", "Mermaid", "Sheath", "Jumpsuit", "Not sure"],
      },
      {
        id: "details",
        label: "Details you love",
        type: "multi",
        options: ["Lace", "Clean satin", "Beading", "Sleeves", "Corset", "Low back", "Cathedral train", "Color"],
      },
      {
        id: "appointments",
        label: "Shopping or alteration timeline",
        type: "textarea",
        placeholder: "e.g. First fitting in March, final pickup two weeks before wedding.",
      },
      {
        id: "budget",
        label: "Dress and alterations budget",
        type: "text",
        placeholder: "e.g. $2,500 dress, $600 alterations",
      },
    ],
  },
  {
    id: "hair-makeup",
    title: "Hair & Makeup",
    description: "Build an artist brief, getting-ready schedule, and trial plan.",
    time: "5 min",
    icon: Scissors,
    questions: [
      {
        id: "services",
        label: "Who needs services?",
        type: "multi",
        options: ["Bride", "Partner", "Wedding party", "Mothers", "Guests", "Touch-up artist"],
      },
      {
        id: "look",
        label: "Desired beauty look",
        type: "choice",
        options: ["Soft natural", "Classic glam", "Full glam", "Romantic updo", "Hollywood waves", "Not sure"],
      },
      {
        id: "trial",
        label: "Trial plan",
        type: "textarea",
        placeholder: "e.g. Trial after dress fitting, bring veil and inspiration photos.",
      },
      {
        id: "getting_ready",
        label: "Getting-ready location and timing",
        type: "textarea",
        placeholder: "e.g. Hotel suite from 8 AM, first look at 2 PM.",
      },
    ],
  },
  {
    id: "decor",
    title: "Decor",
    description: "Shape ceremony, cocktail hour, reception details, signage, and keepsakes.",
    time: "8 min",
    icon: Lightbulb,
    questions: [
      {
        id: "decor_priorities",
        label: "Where should decor make the biggest impact?",
        type: "multi",
        options: ["Ceremony", "Cocktail hour", "Reception tables", "Escort display", "Bar", "Sweetheart table", "Photo moment"],
      },
      {
        id: "signage",
        label: "What signage do you need?",
        type: "multi",
        options: ["Welcome sign", "Seating chart", "Menus", "Bar menu", "Table numbers", "Guest book sign", "Favor sign"],
      },
      {
        id: "personal",
        label: "Personal touches to include",
        type: "textarea",
        placeholder: "e.g. Family photos, custom crest, meaningful song lyric, pet detail.",
      },
      {
        id: "avoid",
        label: "Anything decor should avoid?",
        type: "textarea",
        placeholder: "e.g. No neon signs, no balloons, no tall centerpieces blocking conversation.",
      },
    ],
  },
  {
    id: "music",
    title: "Music",
    description: "Create ceremony cues, reception moments, playlists, and do-not-play notes.",
    time: "7 min",
    icon: Music2,
    questions: [
      {
        id: "vendor",
        label: "What music support are you using?",
        type: "choice",
        options: ["DJ", "Live band", "Ceremony musician", "Playlist only", "Still deciding"],
      },
      {
        id: "moments",
        label: "Which moments need songs?",
        type: "multi",
        options: ["Processional", "Recessional", "Grand entrance", "First dance", "Parent dances", "Cake cutting", "Last song"],
      },
      {
        id: "vibe",
        label: "Dance floor vibe",
        type: "choice",
        options: ["Packed all night", "Elegant lounge", "Mixed generations", "Club energy", "Low-key"],
      },
      {
        id: "must_play",
        label: "Must-play and do-not-play songs",
        type: "textarea",
        placeholder: "e.g. Must play: September. Do not play: line dances.",
      },
    ],
  },
  {
    id: "speeches",
    title: "Speeches",
    description: "Plan who speaks, when they speak, and what boundaries matter.",
    time: "5 min",
    icon: Mic2,
    questions: [
      {
        id: "speakers",
        label: "Who is speaking?",
        type: "multi",
        options: ["Maid of honor", "Best man", "Parents", "Couple welcome", "Officiant", "Open mic", "No speeches"],
      },
      {
        id: "timing",
        label: "When should speeches happen?",
        type: "choice",
        options: ["Welcome toast", "During dinner", "After dinner", "Before dancing", "Not sure"],
      },
      {
        id: "limits",
        label: "Any time limits or boundaries?",
        type: "textarea",
        placeholder: "e.g. 3 minutes each, keep it warm and no inside jokes about exes.",
      },
      {
        id: "support",
        label: "Do speakers need prompts or examples?",
        type: "choice",
        options: ["Yes, send prompts", "Maybe", "No, they are set"],
      },
    ],
  },
  {
    id: "photography",
    title: "Photography",
    description: "Prepare shot lists, family groupings, timeline priorities, and style notes.",
    time: "10 min",
    icon: Camera,
    questions: [
      {
        id: "style",
        label: "Preferred photography style",
        type: "multi",
        options: ["Editorial", "Documentary", "Classic portraits", "Light and airy", "True color", "Flash party photos"],
      },
      {
        id: "moments",
        label: "Must-capture moments",
        type: "multi",
        options: ["Getting ready", "First look", "Private vows", "Family portraits", "Details", "Dance floor", "Exit"],
      },
      {
        id: "family",
        label: "Family photo groupings or dynamics",
        type: "textarea",
        placeholder: "e.g. Keep divorced parents separate; include grandparents first.",
      },
      {
        id: "deliverables",
        label: "Deliverables and deadlines",
        type: "textarea",
        placeholder: "e.g. Sneak peeks within 1 week, full gallery by 8 weeks.",
      },
    ],
  },
  {
    id: "venue",
    title: "Venue",
    description: "Document venue rules, access windows, floor plan needs, and backup plans.",
    time: "10 min",
    icon: MapPin,
    questions: [
      {
        id: "status",
        label: "Where are you with the venue?",
        type: "choice",
        options: ["Booked", "Touring venues", "Need venue discovery", "Non-traditional location"],
      },
      {
        id: "spaces",
        label: "Which spaces will be used?",
        type: "multi",
        options: ["Ceremony", "Cocktail hour", "Reception", "Getting ready", "After party", "Outdoor backup", "Vendor staging"],
      },
      {
        id: "rules",
        label: "Important venue rules",
        type: "textarea",
        placeholder: "e.g. Music off by 10 PM, candles enclosed, all rentals out same night.",
      },
      {
        id: "discovery",
        label: "If you are still looking, what should the venue discovery wizard find?",
        type: "textarea",
        placeholder: "e.g. Estate venue near Austin, 150 guests, indoor/outdoor, under $18k.",
      },
    ],
  },
  {
    id: "ceremony",
    title: "Ceremony",
    description: "Shape ceremony tone, traditions, readings, processional order, and vows.",
    time: "6 min",
    icon: Sparkles,
    questions: [
      {
        id: "tone",
        label: "Ceremony tone",
        type: "choice",
        options: ["Romantic", "Spiritual", "Traditional", "Short and sweet", "Funny and personal", "Cultural blend"],
      },
      {
        id: "elements",
        label: "Ceremony elements to include",
        type: "multi",
        options: ["Personal vows", "Readings", "Unity ceremony", "Cultural tradition", "Religious blessing", "Memorial moment"],
      },
      {
        id: "processional",
        label: "Processional notes",
        type: "textarea",
        placeholder: "e.g. Grandparents seated first, wedding party enters in pairs.",
      },
      {
        id: "officiant",
        label: "Officiant instructions",
        type: "textarea",
        placeholder: "e.g. Keep ceremony under 25 minutes and pronounce both full names.",
      },
    ],
  },
];

function loadGuideStore(): GuideStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function answerIsFilled(value: AnswerValue | undefined) {
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === "string" && value.trim().length > 0;
}

function getStatus(guide: GuideDefinition, record?: GuideRecord): GuideStatus {
  if (record?.status === "complete") return "complete";
  const answered = guide.questions.filter((question) => answerIsFilled(record?.answers?.[question.id])).length;
  return answered > 0 ? "in-progress" : "not-started";
}

function statusLabel(status: GuideStatus) {
  if (status === "complete") return "Complete";
  if (status === "in-progress") return "In Progress";
  return "Not Started";
}

function statusClasses(status: GuideStatus) {
  if (status === "complete") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "in-progress") return "border-[#D4A373]/35 bg-[#FFF3D8] text-[#8A5A20]";
  return "border-[#E9DED6] bg-[#EEE7DF] text-[#6B5961]";
}

function formatAnswer(value: AnswerValue | undefined) {
  if (!value) return "";
  return Array.isArray(value) ? value.join(", ") : value;
}

function buildBrief(guide: GuideDefinition, record?: GuideRecord) {
  const lines = guide.questions
    .map((question) => {
      const answer = formatAnswer(record?.answers?.[question.id]).trim();
      return answer ? `${question.label}: ${answer}` : "";
    })
    .filter(Boolean);

  if (lines.length === 0) {
    return "Answer a few questions and A.I Do will turn this into a clean vendor brief.";
  }

  return [`${guide.title} brief`, ...lines].join("\n");
}

export default function PlanningGuides() {
  const { toast } = useToast();
  const [store, setStore] = useState<GuideStore>(() => loadGuideStore());
  const [activeGuideId, setActiveGuideId] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      /* local persistence is best effort */
    }
  }, [store]);

  const activeGuide = GUIDES.find((guide) => guide.id === activeGuideId) ?? null;
  const activeRecord = activeGuide ? store[activeGuide.id] ?? { answers: {} } : null;
  const ActiveGuideIcon = activeGuide?.icon;

  const guideSummaries = useMemo(() => {
    return GUIDES.map((guide) => {
      const record = store[guide.id];
      const answered = guide.questions.filter((question) => answerIsFilled(record?.answers?.[question.id])).length;
      const status = getStatus(guide, record);
      return { guide, answered, status };
    });
  }, [store]);

  const completeCount = guideSummaries.filter((summary) => summary.status === "complete").length;
  const progressPct = Math.round((completeCount / GUIDES.length) * 100);

  function updateAnswer(guideId: string, question: GuideQuestion, value: AnswerValue) {
    setStore((current) => {
      const currentRecord = current[guideId] ?? { answers: {} };
      const nextAnswers = { ...currentRecord.answers, [question.id]: value };
      const nextRecord: GuideRecord = {
        ...currentRecord,
        answers: nextAnswers,
        status: currentRecord.status === "complete" ? "complete" : "in-progress",
        updatedAt: new Date().toISOString(),
      };
      return { ...current, [guideId]: nextRecord };
    });
  }

  function toggleMulti(guideId: string, question: GuideQuestion, option: string) {
    const current = store[guideId]?.answers?.[question.id];
    const values = Array.isArray(current) ? current : [];
    const next = values.includes(option)
      ? values.filter((item) => item !== option)
      : [...values, option];
    updateAnswer(guideId, question, next);
  }

  function markComplete() {
    if (!activeGuide) return;
    const record = store[activeGuide.id];
    const hasAnswers = activeGuide.questions.some((question) => answerIsFilled(record?.answers?.[question.id]));
    if (!hasAnswers) {
      toast({
        title: "Add at least one answer first",
        description: "A guide needs a few details before it can be marked complete.",
      });
      return;
    }
    setStore((current) => ({
      ...current,
      [activeGuide.id]: {
        answers: current[activeGuide.id]?.answers ?? {},
        status: "complete",
        updatedAt: new Date().toISOString(),
      },
    }));
    toast({ title: `${activeGuide.title} guide completed` });
  }

  function resetGuide() {
    if (!activeGuide) return;
    setStore((current) => {
      const next = { ...current };
      delete next[activeGuide.id];
      return next;
    });
    toast({ title: `${activeGuide.title} guide reset` });
  }

  async function copyBrief() {
    if (!activeGuide) return;
    await navigator.clipboard.writeText(buildBrief(activeGuide, activeRecord ?? undefined));
    toast({ title: "Guide brief copied" });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-10">
      <section className="relative overflow-hidden rounded-[2rem] border border-[#F0D2D9] bg-[#FFF8F5] p-6 shadow-[0_22px_60px_rgba(141,41,77,0.10)] sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(247,221,226,0.85),transparent_34%),linear-gradient(135deg,rgba(255,250,246,0.98),rgba(255,241,244,0.86))]" />
        <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_340px] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#D4A373]/40 bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#8D294D] shadow-sm">
              <BookOpenCheck className="h-3.5 w-3.5 text-[#D4A373]" />
              Planning Tools
            </div>
            <h1 className="font-serif text-4xl font-semibold leading-tight text-[#3B1C2B] sm:text-5xl">
              Planning Guides
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[#7A5261] sm:text-lg">
              Step-by-step questionnaires to help you make decisions, prep Aria, and brief every vendor without starting from a blank page.
            </p>
          </div>
          <Card className="border-[#F0D2D9] bg-white/82 shadow-[0_18px_40px_rgba(141,41,77,0.12)] backdrop-blur">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#3B1C2B]">{completeCount}/{GUIDES.length} complete</p>
                  <p className="text-xs text-[#8D6A73]">Your planning guide progress</p>
                </div>
                <span className="font-serif text-3xl font-semibold text-[#8D294D]">{progressPct}%</span>
              </div>
              <Progress value={progressPct} className="h-2.5 bg-[#F3EAE4] [&>div]:bg-[#B56D83]" />
              <div className="grid grid-cols-3 gap-2 text-center text-xs text-[#7A5261]">
                <div className="rounded-xl border border-[#F0D2D9] bg-white/80 p-2">
                  <p className="font-semibold text-[#3B1C2B]">{completeCount}</p>
                  <p>Done</p>
                </div>
                <div className="rounded-xl border border-[#F0D2D9] bg-white/80 p-2">
                  <p className="font-semibold text-[#3B1C2B]">
                    {guideSummaries.filter((summary) => summary.status === "in-progress").length}
                  </p>
                  <p>Active</p>
                </div>
                <div className="rounded-xl border border-[#F0D2D9] bg-white/80 p-2">
                  <p className="font-semibold text-[#3B1C2B]">
                    {guideSummaries.filter((summary) => summary.status === "not-started").length}
                  </p>
                  <p>Ready</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {guideSummaries.map(({ guide, answered, status }) => {
          const Icon = guide.icon;
          const isStarted = status !== "not-started";
          const isComplete = status === "complete";
          return (
            <button
              key={guide.id}
              type="button"
              onClick={() => setActiveGuideId(guide.id)}
              className={cn(
                "group relative min-h-[260px] rounded-[1.6rem] border bg-white/88 p-6 text-left shadow-[0_16px_36px_rgba(59,28,43,0.07)] transition-all duration-300 hover:-translate-y-1 hover:border-[#D4A373]/70 hover:shadow-[0_22px_50px_rgba(141,41,77,0.13)]",
                guide.startHere ? "border-[#C7B9AA] ring-2 ring-[#C7B9AA]/40" : "border-[#F0D2D9]",
              )}
              data-testid={`planning-guide-${guide.id}`}
            >
              {guide.startHere && (
                <span className="absolute -top-3 left-6 rounded-full bg-[#26452F] px-4 py-1.5 text-xs font-bold text-white shadow-sm">
                  Start here
                </span>
              )}
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F7DDE2] text-[#8D294D] shadow-inner">
                  <Icon className="h-6 w-6" />
                </span>
                <Badge className={cn("rounded-full border px-3 py-1", statusClasses(status))}>
                  {statusLabel(status)}
                </Badge>
              </div>
              <div className="mt-8">
                <h2 className="font-serif text-2xl font-semibold text-[#3B1C2B]">{guide.title}</h2>
                <p className="mt-3 min-h-[56px] text-sm leading-6 text-[#6F5860]">{guide.description}</p>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-[#F0D2D9] pt-4">
                <span className="inline-flex items-center gap-1 text-sm font-bold text-[#26452F]">
                  {isComplete ? "Review" : isStarted ? "Continue" : "Start"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
                <span className="inline-flex items-center gap-1 text-sm text-[#7A5261]">
                  <Clock3 className="h-4 w-4 text-[#D4A373]" />
                  {answered}/{guide.questions.length} | {guide.time}
                </span>
              </div>
            </button>
          );
        })}
      </section>

      <Dialog open={!!activeGuide} onOpenChange={(open) => !open && setActiveGuideId(null)}>
        {activeGuide && activeRecord && (
          <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto border-[#F0D2D9] bg-[#FFF8F5] p-0 shadow-[0_24px_80px_rgba(59,28,43,0.22)]">
            <div className="grid lg:grid-cols-[1fr_340px]">
              <div className="p-6 sm:p-8">
                <DialogHeader className="text-left">
                  {ActiveGuideIcon && (
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F7DDE2] text-[#8D294D]">
                      <ActiveGuideIcon className="h-6 w-6" />
                    </div>
                  )}
                  <DialogTitle className="font-serif text-3xl text-[#3B1C2B]">{activeGuide.title}</DialogTitle>
                  <DialogDescription className="text-[#7A5261]">
                    Answer what you know now. You can come back and fill in the rest as plans firm up.
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-6 space-y-5">
                  {activeGuide.questions.map((question, index) => {
                    const value = activeRecord.answers[question.id];
                    return (
                      <div key={question.id} className="rounded-2xl border border-[#F0D2D9] bg-white/86 p-5 shadow-[0_10px_26px_rgba(141,41,77,0.06)]">
                        <div className="mb-4 flex items-start gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F7DDE2] text-xs font-bold text-[#8D294D]">
                            {index + 1}
                          </span>
                          <div>
                            <label className="text-sm font-bold text-[#3B1C2B]" htmlFor={`${activeGuide.id}-${question.id}`}>
                              {question.label}
                            </label>
                            {question.helper && <p className="mt-1 text-xs leading-5 text-[#8D6A73]">{question.helper}</p>}
                          </div>
                        </div>

                        {question.type === "text" && (
                          <Input
                            id={`${activeGuide.id}-${question.id}`}
                            value={typeof value === "string" ? value : ""}
                            onChange={(event) => updateAnswer(activeGuide.id, question, event.target.value)}
                            placeholder={question.placeholder}
                            className="h-11 rounded-xl border-[#E8C9D0] bg-white text-[#3B1C2B] placeholder:text-[#A98B94] focus-visible:ring-[#D4A373]"
                          />
                        )}

                        {question.type === "textarea" && (
                          <Textarea
                            id={`${activeGuide.id}-${question.id}`}
                            value={typeof value === "string" ? value : ""}
                            onChange={(event) => updateAnswer(activeGuide.id, question, event.target.value)}
                            placeholder={question.placeholder}
                            className="min-h-[120px] rounded-xl border-[#E8C9D0] bg-white text-[#3B1C2B] placeholder:text-[#A98B94] focus-visible:ring-[#D4A373]"
                          />
                        )}

                        {question.type === "choice" && (
                          <div className="grid gap-2 sm:grid-cols-2">
                            {question.options?.map((option) => {
                              const selected = value === option;
                              return (
                                <button
                                  key={option}
                                  type="button"
                                  onClick={() => updateAnswer(activeGuide.id, question, selected ? "" : option)}
                                  className={cn(
                                    "rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-all",
                                    selected
                                      ? "border-[#8D294D] bg-[#F7DDE2] text-[#3B1C2B] shadow-sm"
                                      : "border-[#E8C9D0] bg-white text-[#6F5860] hover:border-[#D4A373] hover:bg-[#FFF3D8]",
                                  )}
                                >
                                  {option}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {question.type === "multi" && (
                          <div className="flex flex-wrap gap-2">
                            {question.options?.map((option) => {
                              const selected = Array.isArray(value) && value.includes(option);
                              return (
                                <button
                                  key={option}
                                  type="button"
                                  onClick={() => toggleMulti(activeGuide.id, question, option)}
                                  className={cn(
                                    "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition-all",
                                    selected
                                      ? "border-[#8D294D] bg-[#F7DDE2] text-[#3B1C2B] shadow-sm"
                                      : "border-[#E8C9D0] bg-white text-[#6F5860] hover:border-[#D4A373] hover:bg-[#FFF3D8]",
                                  )}
                                >
                                  {selected && <CheckCircle2 className="h-3.5 w-3.5 text-[#8D294D]" />}
                                  {option}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <aside className="border-t border-[#F0D2D9] bg-white/72 p-6 lg:border-l lg:border-t-0">
                <div className="sticky top-6 space-y-5">
                  <div className="rounded-2xl border border-[#F0D2D9] bg-white p-5 shadow-[0_14px_34px_rgba(141,41,77,0.08)]">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-[#3B1C2B]">Guide progress</p>
                      <Badge className={cn("rounded-full border", statusClasses(getStatus(activeGuide, activeRecord)))}>
                        {statusLabel(getStatus(activeGuide, activeRecord))}
                      </Badge>
                    </div>
                    <Progress
                      value={(activeGuide.questions.filter((question) => answerIsFilled(activeRecord.answers[question.id])).length / activeGuide.questions.length) * 100}
                      className="mt-4 h-2 bg-[#F3EAE4] [&>div]:bg-[#B56D83]"
                    />
                    <p className="mt-2 text-xs text-[#8D6A73]">
                      {activeGuide.questions.filter((question) => answerIsFilled(activeRecord.answers[question.id])).length} of {activeGuide.questions.length} questions answered
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#F0D2D9] bg-[#FFF8F5] p-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-[#3B1C2B]">Vendor brief</p>
                        <p className="text-xs text-[#8D6A73]">Copy this into Aria, vendor emails, or planning notes.</p>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={copyBrief}
                        className="shrink-0 border-[#E8C9D0] text-[#8D294D] hover:bg-[#F7DDE2]"
                        aria-label="Copy vendor brief"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <pre className="max-h-72 whitespace-pre-wrap rounded-xl border border-[#F0D2D9] bg-white p-4 font-sans text-xs leading-5 text-[#4A3039]">
                      {buildBrief(activeGuide, activeRecord)}
                    </pre>
                  </div>

                  <div className="grid gap-2">
                    <Button
                      type="button"
                      onClick={markComplete}
                      className="rounded-full bg-[#8D294D] text-white hover:bg-[#7A2442]"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Mark Complete
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetGuide}
                      className="rounded-full border-[#E8C9D0] bg-white text-[#8D294D] hover:bg-[#F7DDE2]"
                    >
                      Reset This Guide
                    </Button>
                  </div>
                </div>
              </aside>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
