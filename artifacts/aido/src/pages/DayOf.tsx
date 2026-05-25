import { Component, useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import { authFetch } from "@/lib/authFetch";
import {
  getGetTimelineQueryKey,
  useEmergencyAdvice,
  useGenerateTimeline,
  useGetGuests,
  useGetProfile,
  useGetTimeline,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Download,
  FileDown,
  Gem,
  GripVertical,
  ListChecks,
  MapPin,
  Mic2,
  Music,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Shirt,
  Siren,
  Sparkles,
  Trash2,
  UserPlus,
  UsersRound,
  Wand2,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface TimelineEvent {
  time: string;
  title: string;
  description: string;
  category: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  notes?: string;
  id?: string;
}

type DayOfTab =
  | "timeline"
  | "ceremony"
  | "music"
  | "speeches"
  | "setup"
  | "attire"
  | "people"
  | "packing";

type BinderSectionId = Exclude<DayOfTab, "timeline" | "packing">;

interface BinderChecklistItem {
  id: string;
  label: string;
  note: string;
  completed: boolean;
}

interface BinderSectionItem {
  id: string;
  title: string;
  helper: string;
}

interface BinderSection {
  id: BinderSectionId;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  items: BinderSectionItem[];
}

type CeremonySectionId = "processional" | "rings" | "officiant" | "recessional";

interface ProcessionalEntry {
  id: string;
  personName: string;
  role: string;
  walksWith: string;
  notes: string;
}

interface KeepsakeItem {
  id: string;
  label: string;
  checked: boolean;
  custom?: boolean;
}

interface ReadingCue {
  id: string;
  readerName: string;
  title: string;
}

interface FamilyPhotoGroup {
  id: string;
  groupName: string;
  members: string;
}

interface CeremonyPlan {
  processional: ProcessionalEntry[];
  ringsAndVows: {
    ringHolder: string;
    vowHolder: string;
    printedVows: boolean;
    remindToPrintVows: boolean;
    keepsakes: KeepsakeItem[];
  };
  officiantCues: {
    licenseSigning: boolean;
    licenseSigningTime: string;
    unpluggedAnnouncement: boolean;
    unpluggedScript: string;
    readings: ReadingCue[];
    pronunciationNotes: string;
    specialAnnouncement: string;
    specialAnnouncementNotes: string;
  };
  recessional: {
    coupleExitsTo: string;
    weddingPartyExitOrder: ProcessionalEntry[];
    familyPhotoGroups: FamilyPhotoGroup[];
    guestFlow: string;
  };
}

const DAY_OF_TABS: Array<{ id: DayOfTab; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: "timeline", label: "Timeline", icon: Clock },
  { id: "ceremony", label: "Ceremony", icon: CalendarDays },
  { id: "music", label: "Music", icon: Music },
  { id: "speeches", label: "Speeches", icon: Mic2 },
  { id: "setup", label: "Setup", icon: ClipboardList },
  { id: "attire", label: "Attire", icon: Shirt },
  { id: "people", label: "Vendors & Party", icon: UsersRound },
  { id: "packing", label: "Packing", icon: ListChecks },
];

const DEFAULT_PACKING_ITEMS: BinderChecklistItem[] = [
  { id: "attire", label: "Wedding dress, suit, or outfit", note: "", completed: false },
  { id: "rings", label: "Rings", note: "", completed: false },
  { id: "vows", label: "Vows or ceremony notes", note: "", completed: false },
  { id: "license", label: "Marriage license and IDs", note: "", completed: false },
  { id: "shoes", label: "Shoes and backup flats", note: "", completed: false },
  {
    id: "emergency-kit",
    label: "Emergency kit",
    note: "Safety pins, stain remover, tissues, pain reliever.",
    completed: false,
  },
  { id: "payments", label: "Vendor tips or final payments", note: "", completed: false },
  {
    id: "details",
    label: "Detail photos box",
    note: "Invitation suite, perfume/cologne, jewelry, heirlooms.",
    completed: false,
  },
];

const CEREMONY_ROLES = [
  "Bride",
  "Groom",
  "Partner",
  "Parent",
  "Grandparent",
  "Maid of Honor",
  "Best Man",
  "Wedding Party",
  "Bridesmaid",
  "Groomsman",
  "Flower Girl",
  "Ring Bearer",
  "Officiant",
  "Reader",
  "Usher",
  "Other",
];

const COUPLE_EXIT_OPTIONS = ["Aisle", "Cocktail hour", "Private room", "Photo location", "Receiving line", "Reception entrance"];
const GUEST_FLOW_OPTIONS = ["Cocktail hour", "Reception", "Outdoor area", "Lobby", "Photo area", "Transportation pickup"];
const SPECIAL_ANNOUNCEMENTS = [
  "None",
  "Unplugged ceremony",
  "Reserved seating",
  "Moment of silence",
  "No flash photography",
  "Cocktail hour directions",
  "Reception directions",
  "Custom",
];

const DEFAULT_UNPLUGGED_SCRIPT =
  "The couple invites you to be fully present during the ceremony. Please silence and put away phones and cameras until the recessional.";

const DEFAULT_KEEPSAKES: KeepsakeItem[] = [
  { id: "rings", label: "Wedding rings", checked: true },
  { id: "printed-vows", label: "Printed vows", checked: true },
  { id: "marriage-license", label: "Marriage license", checked: true },
  { id: "heirloom", label: "Family heirloom or unity item", checked: false },
  { id: "vow-books", label: "Vow books", checked: false },
];

const BINDER_SECTIONS: Record<BinderSectionId, BinderSection> = {
  ceremony: {
    id: "ceremony",
    title: "Ceremony Plan",
    description: "Keep the ceremony sequence, handoffs, and officiant notes in one place.",
    icon: CalendarDays,
    items: [
      { id: "processional", title: "Processional order", helper: "Who walks, with whom, and in what order." },
      { id: "rings", title: "Rings and vows", helper: "Who has the rings, printed vows, and ceremony keepsakes." },
      {
        id: "officiant",
        title: "Officiant cues",
        helper: "License signing, announcements, unplugged ceremony note, or special readings.",
      },
      {
        id: "recessional",
        title: "Recessional and photo handoff",
        helper: "Where the couple, party, and family go immediately after the ceremony.",
      },
    ],
  },
  music: {
    id: "music",
    title: "Music Cues",
    description: "A simple cue sheet for ceremony, reception, and must-play moments.",
    icon: Music,
    items: [
      { id: "prelude", title: "Prelude and guest arrival", helper: "Playlist, live musician notes, volume, and start time." },
      {
        id: "ceremony-cues",
        title: "Ceremony cue sheet",
        helper: "Processional, partner entrance, recessional, and any silence cues.",
      },
      {
        id: "reception-moments",
        title: "Reception moments",
        helper: "Introductions, first dance, parent dances, cake, bouquet, and last song.",
      },
      { id: "do-not-play", title: "Must-play and do-not-play", helper: "Songs, genres, names, and pronunciation notes for the DJ or band." },
    ],
  },
  speeches: {
    id: "speeches",
    title: "Speeches",
    description: "Speaker order, mic notes, and timing guardrails for toasts.",
    icon: Mic2,
    items: [
      { id: "speaker-order", title: "Speaker order", helper: "Who speaks first, who introduces them, and where the mic should be." },
      { id: "mic-plan", title: "Microphone and AV", helper: "Handheld/lapel mic, backup batteries, projector, or sound check notes." },
      { id: "time-limits", title: "Timing guardrails", helper: "Ideal length for each toast and who keeps things moving." },
    ],
  },
  setup: {
    id: "setup",
    title: "Setup Tasks",
    description: "Load-in, decor, room flip, and end-of-night cleanup details.",
    icon: ClipboardList,
    items: [
      { id: "load-in", title: "Vendor load-in", helper: "Arrival windows, loading doors, parking, elevators, and venue contact." },
      { id: "decor", title: "Decor placement", helper: "Signage, guest book, card box, favors, candles, escort cards, and tables." },
      { id: "floor-plan", title: "Room flip and floor plan", helper: "Ceremony-to-reception transition, table counts, chair moves, and timing." },
      { id: "cleanup", title: "Strike and pickup", helper: "Who packs decor, returns rentals, takes gifts, and handles leftovers." },
    ],
  },
  attire: {
    id: "attire",
    title: "Attire",
    description: "Outfits, accessories, touch-ups, and backup wardrobe details.",
    icon: Shirt,
    items: [
      { id: "couple-attire", title: "Couple attire", helper: "Outfits, accessories, steaming, bustle, backup shirt, or outfit change." },
      { id: "wedding-party", title: "Wedding party attire", helper: "Colors, shoes, ties, jewelry, getting-ready deadline, and backups." },
      { id: "beauty", title: "Beauty touch-up plan", helper: "Lip color, blotting papers, hair pins, fragrance, and who carries them." },
    ],
  },
  people: {
    id: "people",
    title: "Vendors & Party",
    description: "A calm contact sheet for the people keeping the day moving.",
    icon: UsersRound,
    items: [
      { id: "point-person", title: "Day-of point person", helper: "Primary contact for questions so the couple is not interrupted." },
      { id: "vendor-contacts", title: "Vendor contact sheet", helper: "Lead names, phone numbers, arrival times, and final balances." },
      { id: "family-vips", title: "Family and VIP notes", helper: "Photo wrangler, sensitive dynamics, accessibility needs, or special honors." },
      {
        id: "wedding-party-duties",
        title: "Wedding party assignments",
        helper: "Who carries items, signs license, gives tips, handles gifts, or cues guests.",
      },
    ],
  },
};

function toDisplayTime(raw: any): string {
  if (raw?.time) return String(raw.time);
  if (raw?.startTime) {
    try {
      const [hStr, mStr] = String(raw.startTime).split(":");
      const h = parseInt(hStr, 10);
      if (isNaN(h)) return "";
      const ampm = h >= 12 ? "PM" : "AM";
      const displayH = h % 12 || 12;
      return `${displayH}:${mStr ?? "00"} ${ampm}`;
    } catch {
      return "";
    }
  }
  return "";
}

function normalizeEvent(raw: any): TimelineEvent {
  return {
    time: toDisplayTime(raw),
    title: raw?.title ?? "",
    description: raw?.description ?? "",
    category: raw?.category ?? "other",
    startTime: raw?.startTime,
    endTime: raw?.endTime,
    location: raw?.location,
    notes: raw?.notes,
    id: raw?.id,
  };
}

function formatProfileTime(value: string | null | undefined) {
  if (!value) return "Time TBD";
  const [hourRaw, minuteRaw = "00"] = value.split(":");
  const hour = Number(hourRaw);
  if (!Number.isFinite(hour)) return value;
  const ampm = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${minuteRaw} ${ampm}`;
}

function getBinderStorageKey(profileId: number | string | null | undefined) {
  return profileId ? `aido_dayof_binder_${profileId}` : null;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function blankProcessionalEntry(role = "Partner"): ProcessionalEntry {
  return { id: makeId("processional"), personName: "", role, walksWith: "None", notes: "" };
}

function blankReadingCue(): ReadingCue {
  return { id: makeId("reading"), readerName: "", title: "" };
}

function blankFamilyPhotoGroup(): FamilyPhotoGroup {
  return { id: makeId("photo-group"), groupName: "", members: "" };
}

function createDefaultCeremonyPlan(): CeremonyPlan {
  return {
    processional: [
      { id: makeId("processional"), personName: "", role: "Officiant", walksWith: "None", notes: "Already standing at the front." },
      blankProcessionalEntry("Parent"),
      blankProcessionalEntry("Partner"),
    ],
    ringsAndVows: {
      ringHolder: "",
      vowHolder: "",
      printedVows: true,
      remindToPrintVows: true,
      keepsakes: DEFAULT_KEEPSAKES.map((item) => ({ ...item })),
    },
    officiantCues: {
      licenseSigning: true,
      licenseSigningTime: "After ceremony",
      unpluggedAnnouncement: true,
      unpluggedScript: DEFAULT_UNPLUGGED_SCRIPT,
      readings: [blankReadingCue()],
      pronunciationNotes: "",
      specialAnnouncement: "Cocktail hour directions",
      specialAnnouncementNotes: "",
    },
    recessional: {
      coupleExitsTo: "Cocktail hour",
      weddingPartyExitOrder: [],
      familyPhotoGroups: [
        { id: makeId("photo-group"), groupName: "Immediate family", members: "" },
        { id: makeId("photo-group"), groupName: "Wedding party", members: "" },
      ],
      guestFlow: "Cocktail hour",
    },
  };
}

function normalizeProcessionalEntry(value: unknown, index: number): ProcessionalEntry {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    id: String(row.id ?? makeId(`processional-${index + 1}`)),
    personName: String(row.personName ?? ""),
    role: String(row.role ?? "Partner"),
    walksWith: String(row.walksWith ?? "None"),
    notes: String(row.notes ?? ""),
  };
}

function normalizeKeepsake(value: unknown, index: number): KeepsakeItem {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    id: String(row.id ?? makeId(`keepsake-${index + 1}`)),
    label: String(row.label ?? "Keepsake"),
    checked: Boolean(row.checked),
    custom: Boolean(row.custom),
  };
}

function normalizeReading(value: unknown, index: number): ReadingCue {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    id: String(row.id ?? makeId(`reading-${index + 1}`)),
    readerName: String(row.readerName ?? ""),
    title: String(row.title ?? ""),
  };
}

function normalizeFamilyPhotoGroup(value: unknown, index: number): FamilyPhotoGroup {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    id: String(row.id ?? makeId(`photo-group-${index + 1}`)),
    groupName: String(row.groupName ?? ""),
    members: String(row.members ?? ""),
  };
}

function normalizeCeremonyPlan(value: unknown): CeremonyPlan {
  const fallback = createDefaultCeremonyPlan();
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const ringsAndVows = row.ringsAndVows && typeof row.ringsAndVows === "object" ? row.ringsAndVows as Record<string, unknown> : {};
  const officiantCues = row.officiantCues && typeof row.officiantCues === "object" ? row.officiantCues as Record<string, unknown> : {};
  const recessional = row.recessional && typeof row.recessional === "object" ? row.recessional as Record<string, unknown> : {};

  return {
    processional: Array.isArray(row.processional) ? row.processional.map(normalizeProcessionalEntry) : fallback.processional,
    ringsAndVows: {
      ringHolder: String(ringsAndVows.ringHolder ?? ""),
      vowHolder: String(ringsAndVows.vowHolder ?? ""),
      printedVows: typeof ringsAndVows.printedVows === "boolean" ? ringsAndVows.printedVows : fallback.ringsAndVows.printedVows,
      remindToPrintVows:
        typeof ringsAndVows.remindToPrintVows === "boolean" ? ringsAndVows.remindToPrintVows : fallback.ringsAndVows.remindToPrintVows,
      keepsakes: Array.isArray(ringsAndVows.keepsakes)
        ? ringsAndVows.keepsakes.map(normalizeKeepsake)
        : fallback.ringsAndVows.keepsakes,
    },
    officiantCues: {
      licenseSigning:
        typeof officiantCues.licenseSigning === "boolean" ? officiantCues.licenseSigning : fallback.officiantCues.licenseSigning,
      licenseSigningTime: String(officiantCues.licenseSigningTime ?? fallback.officiantCues.licenseSigningTime),
      unpluggedAnnouncement:
        typeof officiantCues.unpluggedAnnouncement === "boolean"
          ? officiantCues.unpluggedAnnouncement
          : fallback.officiantCues.unpluggedAnnouncement,
      unpluggedScript: String(officiantCues.unpluggedScript ?? fallback.officiantCues.unpluggedScript),
      readings: Array.isArray(officiantCues.readings) ? officiantCues.readings.map(normalizeReading) : fallback.officiantCues.readings,
      pronunciationNotes: String(officiantCues.pronunciationNotes ?? ""),
      specialAnnouncement: String(officiantCues.specialAnnouncement ?? fallback.officiantCues.specialAnnouncement),
      specialAnnouncementNotes: String(officiantCues.specialAnnouncementNotes ?? ""),
    },
    recessional: {
      coupleExitsTo: String(recessional.coupleExitsTo ?? fallback.recessional.coupleExitsTo),
      weddingPartyExitOrder: Array.isArray(recessional.weddingPartyExitOrder)
        ? recessional.weddingPartyExitOrder.map(normalizeProcessionalEntry)
        : fallback.recessional.weddingPartyExitOrder,
      familyPhotoGroups: Array.isArray(recessional.familyPhotoGroups)
        ? recessional.familyPhotoGroups.map(normalizeFamilyPhotoGroup)
        : fallback.recessional.familyPhotoGroups,
      guestFlow: String(recessional.guestFlow ?? fallback.recessional.guestFlow),
    },
  };
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function buildTraditionalProcessional(profile: any, guestNames: string[]): ProcessionalEntry[] {
  const partner2 = String(profile?.partner2Name ?? "").trim();
  const partner1 = String(profile?.partner1Name ?? "").trim();
  const parentNames = guestNames.filter((name) => /\b(parent|mother|father|mom|dad|grand)/i.test(name)).slice(0, 2);
  return [
    { id: makeId("processional"), personName: "", role: "Officiant", walksWith: "None", notes: "Standing at the front before music begins." },
    ...parentNames.map((name) => ({ id: makeId("processional"), personName: name, role: "Parent", walksWith: "None", notes: "Seated before wedding party enters." })),
    { id: makeId("processional"), personName: "", role: "Wedding Party", walksWith: "Partnered attendant", notes: "Attendants enter in pairs or one at a time." },
    { id: makeId("processional"), personName: "", role: "Flower Girl", walksWith: "Ring Bearer", notes: "" },
    { id: makeId("processional"), personName: "", role: "Ring Bearer", walksWith: "Flower Girl", notes: "" },
    { id: makeId("processional"), personName: partner2, role: "Partner", walksWith: "Parent or escort", notes: "Pause at aisle before entrance." },
    { id: makeId("processional"), personName: partner1, role: "Partner", walksWith: "None", notes: "Enter last unless your ceremony uses a different tradition." },
  ];
}

function createSuggestedCeremonyPlan(section: CeremonySectionId, currentPlan: CeremonyPlan, profile: any, guestNames: string[]): CeremonyPlan {
  const partner2 = String(profile?.partner2Name ?? "").trim();
  const partner1 = String(profile?.partner1Name ?? "").trim();
  const suggested = normalizeCeremonyPlan(currentPlan);
  if (section === "processional") {
    suggested.processional = buildTraditionalProcessional(profile, guestNames);
  }
  if (section === "rings") {
    suggested.ringsAndVows = {
      ...suggested.ringsAndVows,
      ringHolder: suggested.ringsAndVows.ringHolder || guestNames[0] || "",
      vowHolder: suggested.ringsAndVows.vowHolder || partner2 || partner1 || "",
      printedVows: true,
      remindToPrintVows: true,
      keepsakes: DEFAULT_KEEPSAKES.map((item) => ({ ...item, checked: item.checked || item.id === "vow-books" })),
    };
  }
  if (section === "officiant") {
    suggested.officiantCues = {
      licenseSigning: true,
      licenseSigningTime: "Immediately after ceremony",
      unpluggedAnnouncement: true,
      unpluggedScript: DEFAULT_UNPLUGGED_SCRIPT,
      readings: suggested.officiantCues.readings.length
        ? suggested.officiantCues.readings
        : [{ id: makeId("reading"), readerName: guestNames[1] || "", title: "Short reading or blessing" }],
      pronunciationNotes: suggested.officiantCues.pronunciationNotes,
      specialAnnouncement: "Cocktail hour directions",
      specialAnnouncementNotes: "Invite guests to follow venue staff or signage after the recessional.",
    };
  }
  if (section === "recessional") {
    suggested.recessional = {
      coupleExitsTo: "Private room",
      weddingPartyExitOrder:
        suggested.recessional.weddingPartyExitOrder.length > 0
          ? suggested.recessional.weddingPartyExitOrder
          : [
              { id: makeId("exit"), personName: partner2 && partner1 ? `${partner2} & ${partner1}` : "Couple", role: "Partner", walksWith: "Each other", notes: "Exit first." },
              { id: makeId("exit"), personName: "", role: "Wedding Party", walksWith: "Paired attendants", notes: "Follow couple down aisle." },
              { id: makeId("exit"), personName: "", role: "Parent", walksWith: "Family", notes: "Immediate family follows wedding party." },
            ],
      familyPhotoGroups:
        suggested.recessional.familyPhotoGroups.length > 0
          ? suggested.recessional.familyPhotoGroups
          : [
              { id: makeId("photo-group"), groupName: "Couple with immediate family", members: "Parents, siblings, grandparents" },
              { id: makeId("photo-group"), groupName: "Couple with wedding party", members: "All attendants, flower girl, ring bearer" },
            ],
      guestFlow: "Cocktail hour",
    };
  }
  return suggested;
}

function summarizeCeremonyPlanForPdf(plan: CeremonyPlan, itemId: string): string {
  if (itemId === "processional") {
    return plan.processional
      .map((entry, index) => `${index + 1}. ${entry.personName || entry.role}${entry.walksWith && entry.walksWith !== "None" ? ` with ${entry.walksWith}` : ""}${entry.notes ? ` - ${entry.notes}` : ""}`)
      .join("\n");
  }
  if (itemId === "rings") {
    const keepsakes = plan.ringsAndVows.keepsakes.filter((item) => item.checked).map((item) => item.label).join(", ") || "None selected";
    return `Ring holder: ${plan.ringsAndVows.ringHolder || "TBD"}\nVow holder: ${plan.ringsAndVows.vowHolder || "TBD"}\nPrinted vows: ${plan.ringsAndVows.printedVows ? "Yes" : "No"}\nPrint reminder: ${plan.ringsAndVows.remindToPrintVows ? "On" : "Off"}\nKeepsakes: ${keepsakes}`;
  }
  if (itemId === "officiant") {
    const readings = plan.officiantCues.readings
      .filter((reading) => reading.readerName || reading.title)
      .map((reading) => `${reading.readerName || "Reader TBD"} - ${reading.title || "Reading TBD"}`)
      .join("; ");
    return `License signing: ${plan.officiantCues.licenseSigning ? plan.officiantCues.licenseSigningTime || "Yes" : "No"}\nUnplugged announcement: ${plan.officiantCues.unpluggedAnnouncement ? plan.officiantCues.unpluggedScript : "No"}\nReadings: ${readings || "None listed"}\nPronunciation notes: ${plan.officiantCues.pronunciationNotes || "None"}\nAnnouncement: ${plan.officiantCues.specialAnnouncement}${plan.officiantCues.specialAnnouncementNotes ? ` - ${plan.officiantCues.specialAnnouncementNotes}` : ""}`;
  }
  if (itemId === "recessional") {
    const exitOrder = plan.recessional.weddingPartyExitOrder.map((entry, index) => `${index + 1}. ${entry.personName || entry.role}`).join("; ");
    const groups = plan.recessional.familyPhotoGroups.map((group) => `${group.groupName}: ${group.members || "Members TBD"}`).join("; ");
    return `Couple exits to: ${plan.recessional.coupleExitsTo}\nWedding party exit order: ${exitOrder || "TBD"}\nFamily photo groups: ${groups || "TBD"}\nGuest flow: ${plan.recessional.guestFlow}`;
  }
  return "";
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs leading-5 text-[#8A6670]">{children}</p>;
}

function FieldLabel({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-bold text-[#4C2730]">
      {label}
      {children}
      {hint ? <FieldHint>{hint}</FieldHint> : null}
    </label>
  );
}

function SelectInput({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 rounded-2xl border border-[#E8C9D4] bg-white px-3 text-sm font-semibold text-[#4C2730] outline-none focus:ring-2 focus:ring-[#F7DDE2]"
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function GuestNameInput({
  value,
  onChange,
  options,
  placeholder,
  listId,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  listId: string;
}) {
  return (
    <>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        list={listId}
        placeholder={placeholder}
        className="h-11 rounded-2xl border-[#E8C9D4] bg-white"
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </>
  );
}

function ToggleCard({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`rounded-2xl border p-4 text-left transition ${
        checked ? "border-[#8D294D] bg-[#F7DDE2]/65 shadow-sm" : "border-[#E8C9D4] bg-white hover:bg-[#FFF7F2]"
      }`}
    >
      <span className="flex items-center gap-3">
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-md border ${
            checked ? "border-[#8D294D] bg-[#8D294D] text-white" : "border-[#D5AEBB] bg-white text-transparent"
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
        </span>
        <span className="font-bold text-[#4C2730]">{title}</span>
      </span>
      <span className="mt-2 block text-xs leading-5 text-[#7B5364]">{description}</span>
    </button>
  );
}

function CeremonySectionCard({
  icon: Icon,
  title,
  helper,
  section,
  suggestingSection,
  onGenerate,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  helper: string;
  section: CeremonySectionId;
  suggestingSection: CeremonySectionId | null;
  onGenerate: (section: CeremonySectionId) => void;
  children: React.ReactNode;
}) {
  const isGenerating = suggestingSection === section;
  return (
    <article className="rounded-[1.5rem] border border-[#EBCBD2] bg-white p-5 shadow-[0_12px_28px_rgba(141,41,77,0.08)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-[#F7DDE2] p-3 text-[#8D294D]">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-serif text-2xl font-bold text-[#4C2730]">{title}</h3>
            <p className="mt-1 text-sm leading-6 text-[#7B5364]">{helper}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-2 rounded-full border-[#E8C9D4] text-[#8D294D] hover:bg-[#F7DDE2]"
          onClick={() => onGenerate(section)}
          disabled={isGenerating}
        >
          {isGenerating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          Generate Suggested Plan
        </Button>
      </div>
      <div className="mt-5">{children}</div>
    </article>
  );
}

class DayOfErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
          <AlertCircle className="h-12 w-12 text-destructive/60" />
          <h2 className="font-serif text-xl text-foreground">Something went wrong loading Day-Of</h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            There was an error rendering your day-of coordinator. Please refresh the page to try again.
          </p>
          <Button variant="outline" onClick={() => window.location.reload()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh Page
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

async function patchTimeline(id: number, events: TimelineEvent[]) {
  const res = await authFetch(`/api/timeline/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events }),
  });
  if (!res.ok) throw new Error("Failed to save timeline");
  return res.json();
}

async function resetTimeline(id: number) {
  const res = await authFetch(`/api/timeline/${id}/reset`, {
    method: "POST",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "Failed to reset timeline");
  }
  return res.json() as Promise<{ id: number; events: TimelineEvent[]; generatedAt: string }>;
}

function DayOfInner() {
  const { t } = useTranslation();
  const { data: timeline, isLoading: isLoadingTimeline } = useGetTimeline();
  const { data: profile } = useGetProfile();
  const { data: guestListData } = useGetGuests();
  const { activeWorkspace } = useWorkspace();
  const getAdvice = useEmergencyAdvice();
  const generateTimeline = useGenerateTimeline();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [emergencyText, setEmergencyText] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRegenerateOpen, setIsRegenerateOpen] = useState(false);
  const [dayVision, setDayVision] = useState("");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [completedSet, setCompletedSet] = useState<Set<number>>(new Set());
  const [editableEvents, setEditableEvents] = useState<TimelineEvent[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<TimelineEvent | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<DayOfTab>("timeline");
  const [packingItems, setPackingItems] = useState<BinderChecklistItem[]>(DEFAULT_PACKING_ITEMS);
  const [binderNotes, setBinderNotes] = useState<Record<string, string>>({});
  const [ceremonyPlan, setCeremonyPlan] = useState<CeremonyPlan>(() => createDefaultCeremonyPlan());
  const [suggestingSection, setSuggestingSection] = useState<CeremonySectionId | null>(null);
  const [newKeepsakeLabel, setNewKeepsakeLabel] = useState("");
  const [newPackingItem, setNewPackingItem] = useState("");
  const [isExportingTimelinePdf, setIsExportingTimelinePdf] = useState(false);
  const [isExportingBinderPdf, setIsExportingBinderPdf] = useState(false);
  const [loadedStorageKey, setLoadedStorageKey] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const storageKey = getBinderStorageKey(profile?.id);
  const guestNameOptions = Array.from(
    new Set(
      (((guestListData as any)?.guests ?? []) as Array<{ name?: string; plusOneName?: string | null }>)
        .flatMap((guest) => [guest.name, guest.plusOneName])
        .filter((name): name is string => typeof name === "string" && name.trim().length > 0)
        .map((name) => name.trim())
    )
  ).sort((a, b) => a.localeCompare(b));

  useEffect(() => {
    if (timeline?.events) {
      setEditableEvents((timeline.events as any[]).map(normalizeEvent));
    }
  }, [timeline]);

  useEffect(() => {
    if (editingIndex !== null) {
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [editingIndex]);

  useEffect(() => {
    if (!storageKey) {
      setLoadedStorageKey(null);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          packingItems?: BinderChecklistItem[];
          binderNotes?: Record<string, string>;
          ceremonyPlan?: unknown;
        };
        if (Array.isArray(parsed.packingItems)) setPackingItems(parsed.packingItems);
        if (parsed.binderNotes && typeof parsed.binderNotes === "object") setBinderNotes(parsed.binderNotes);
        if (parsed.ceremonyPlan) setCeremonyPlan(normalizeCeremonyPlan(parsed.ceremonyPlan));
      }
    } catch {
      // Keep the default binder if locally stored data is malformed.
    } finally {
      setLoadedStorageKey(storageKey);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || loadedStorageKey !== storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ packingItems, binderNotes, ceremonyPlan }));
    } catch {
      // Non-blocking local convenience storage.
    }
  }, [storageKey, loadedStorageKey, packingItems, binderNotes, ceremonyPlan]);

  const handleEmergencySubmit = () => {
    if (!emergencyText.trim()) return;
    getAdvice.mutate({ data: { situation: emergencyText } });
  };

  const resetEmergency = () => {
    setEmergencyText("");
    getAdvice.reset();
  };

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setEditDraft({ ...editableEvents[index] });
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditDraft(null);
  };

  const updateEditDraft = (patch: Partial<TimelineEvent>) => {
    setEditDraft((draft) => (draft ? { ...draft, ...patch } : draft));
    setHasUnsavedChanges(true);
  };

  const saveEdit = async () => {
    if (!editDraft || editingIndex === null || !timeline?.id) return;
    const updated = editableEvents.map((ev, i) => (i === editingIndex ? editDraft : ev));
    setIsSaving(true);
    try {
      await patchTimeline(timeline.id, updated);
      setEditableEvents(updated);
      setHasUnsavedChanges(false);
      qc.invalidateQueries({ queryKey: ["/api/timeline"] });
      toast({ title: t("dayof.event_updated") });
    } catch {
      toast({ title: t("dayof.save_failed"), variant: "destructive" });
    } finally {
      setIsSaving(false);
      setEditingIndex(null);
      setEditDraft(null);
    }
  };

  const resetAll = async () => {
    if (!timeline?.id) return;
    if (!confirm(t("dayof.reset_confirm"))) return;
    setIsSaving(true);
    try {
      const restored = await resetTimeline(timeline.id);
      setEditableEvents((restored.events as any[]).map(normalizeEvent));
      setCompletedSet(new Set());
      setActiveIndex(null);
      cancelEditing();
      setHasUnsavedChanges(false);
      qc.invalidateQueries({ queryKey: getGetTimelineQueryKey() });
      toast({ title: t("dayof.timeline_reset") });
    } catch (err) {
      toast({
        title: t("dayof.reset_failed"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerate = () => {
    if (!profile?.id) {
      toast({
        title: "Wedding profile needed",
        description: "Complete your wedding profile first so Aria can build the day-of timeline.",
        variant: "destructive",
      });
      return;
    }
    generateTimeline.mutate(
      { data: { profileId: profile.id, dayVision: dayVision.trim() || undefined } },
      {
        onSuccess: (created: any) => {
          setEditableEvents((created.events as any[]).map(normalizeEvent));
          setCompletedSet(new Set());
          setActiveIndex(null);
          cancelEditing();
          qc.invalidateQueries({ queryKey: getGetTimelineQueryKey() });
          setIsRegenerateOpen(false);
          setDayVision("");
          toast({ title: "Timeline regenerated" });
        },
        onError: (err: unknown) => {
          const e = err as { data?: { error?: string }; message?: string; status?: number };
          const serverMsg = e?.data?.error ?? e?.message;
          toast({
            title: "Failed to regenerate timeline",
            description: serverMsg || "Please check your wedding profile and try again.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const toggleDone = (index: number) => {
    setCompletedSet((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const deleteEvent = async (index: number) => {
    if (!timeline?.id) return;
    const updated = editableEvents.filter((_, i) => i !== index);
    setCompletedSet((prev) => {
      const next = new Set<number>();
      prev.forEach((ci) => {
        if (ci < index) next.add(ci);
        else if (ci > index) next.add(ci - 1);
      });
      return next;
    });
    if (activeIndex === index) setActiveIndex(null);
    else if (activeIndex !== null && activeIndex > index) setActiveIndex(activeIndex - 1);
    setEditableEvents(updated);
    try {
      await patchTimeline(timeline.id, updated);
      qc.invalidateQueries({ queryKey: ["/api/timeline"] });
      toast({ title: "Event removed" });
    } catch {
      toast({ title: "Failed to remove event", variant: "destructive" });
    }
  };

  const updateBinderNote = (key: string, value: string) => {
    setBinderNotes((notes) => ({ ...notes, [key]: value }));
  };

  const updateCeremonyPlan = (patch: Partial<CeremonyPlan>) => {
    setCeremonyPlan((plan) => normalizeCeremonyPlan({ ...plan, ...patch }));
  };

  const updateRingsAndVows = (patch: Partial<CeremonyPlan["ringsAndVows"]>) => {
    setCeremonyPlan((plan) => ({
      ...plan,
      ringsAndVows: { ...plan.ringsAndVows, ...patch },
    }));
  };

  const updateOfficiantCues = (patch: Partial<CeremonyPlan["officiantCues"]>) => {
    setCeremonyPlan((plan) => ({
      ...plan,
      officiantCues: { ...plan.officiantCues, ...patch },
    }));
  };

  const updateRecessional = (patch: Partial<CeremonyPlan["recessional"]>) => {
    setCeremonyPlan((plan) => ({
      ...plan,
      recessional: { ...plan.recessional, ...patch },
    }));
  };

  const generateCeremonySuggestion = async (section: CeremonySectionId) => {
    setSuggestingSection(section);
    try {
      const response = await authFetch("/api/dayof/ceremony-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, currentPlan: ceremonyPlan }),
      });
      if (!response.ok) throw new Error("Suggestion failed");
      const body = await response.json() as { plan?: unknown };
      setCeremonyPlan(normalizeCeremonyPlan(body.plan));
      toast({ title: "Suggested ceremony plan added" });
    } catch {
      setCeremonyPlan(createSuggestedCeremonyPlan(section, ceremonyPlan, profile, guestNameOptions));
      toast({
        title: "Starter suggestion added",
        description: "Aria could not reach the AI service, so A.I Do filled a polished starter plan you can edit.",
      });
    } finally {
      setSuggestingSection(null);
    }
  };

  const useTraditionalOrder = () => {
    updateCeremonyPlan({ processional: buildTraditionalProcessional(profile, guestNameOptions) });
    toast({ title: "Traditional processional order added" });
  };

  const togglePackingItem = (id: string) => {
    setPackingItems((items) =>
      items.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item))
    );
  };

  const updatePackingNote = (id: string, note: string) => {
    setPackingItems((items) => items.map((item) => (item.id === id ? { ...item, note } : item)));
  };

  const removePackingItem = (id: string) => {
    setPackingItems((items) => items.filter((item) => item.id !== id));
  };

  const addPackingItem = () => {
    const label = newPackingItem.trim();
    if (!label) return;
    setPackingItems((items) => [
      ...items,
      { id: `custom-${Date.now()}`, label, note: "", completed: false },
    ]);
    setNewPackingItem("");
  };

  const handleDownloadTimelinePdf = async () => {
    if (!editableEvents.length) return;
    setIsExportingTimelinePdf(true);
    try {
      const coupleName = profile ? `${profile.partner2Name} & ${profile.partner1Name}` : undefined;
      const eventsForPdf = editableEvents.map((event, index) => ({
        time: event.time,
        title: event.title,
        description: event.description,
        category: event.category,
        status: completedSet.has(index) ? "Done" : "",
        location: event.location,
        endTime: event.endTime,
      }));
      const response = await authFetch("/api/pdf/timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: eventsForPdf,
          coupleName,
          weddingDate: profile?.weddingDate,
          venue: profile?.venue,
        }),
      });
      if (!response.ok) throw new Error("PDF failed");
      downloadBlob(await response.blob(), "aido-day-of-timeline.pdf");
      toast({ title: "Timeline PDF downloaded" });
    } catch {
      toast({ title: "Could not export timeline PDF", variant: "destructive" });
    } finally {
      setIsExportingTimelinePdf(false);
    }
  };

  const handleDownloadBinderPdf = async () => {
    setIsExportingBinderPdf(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "p", unit: "pt", format: "letter" });
      const margin = 42;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const contentWidth = pageWidth - margin * 2;
      const burgundy = "#8D294D";
      const ink = "#33202A";
      const muted = "#7B5364";
      let y = margin;

      const ensurePage = (needed = 32) => {
        if (y + needed <= pageHeight - margin) return;
        doc.addPage();
        y = margin;
      };

      const writeWrapped = (text: string, x: number, width: number, lineHeight = 14) => {
        const lines = doc.splitTextToSize(text || "-", width);
        doc.text(lines, x, y);
        y += lines.length * lineHeight;
      };

      doc.setFillColor("#FFF9F5");
      doc.rect(0, 0, pageWidth, pageHeight, "F");
      doc.setFont("times", "bold");
      doc.setFontSize(28);
      doc.setTextColor(burgundy);
      doc.text("A.I Do Day-Of Binder", margin, y);
      y += 26;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(muted);
      doc.text(`${profile?.partner2Name ?? "Partner"} & ${profile?.partner1Name ?? "Partner"} | ${profile?.weddingDate ?? "Wedding date TBD"} | ${profile?.venue ?? "Venue TBD"}`, margin, y);
      y += 28;

      doc.setFont("times", "bold");
      doc.setFontSize(18);
      doc.setTextColor(ink);
      doc.text("Timeline", margin, y);
      y += 18;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      editableEvents.forEach((event, index) => {
        ensurePage(44);
        doc.setTextColor(burgundy);
        doc.setFont("helvetica", "bold");
        doc.text(`${event.time || "Time TBD"}  ${event.title || "Untitled event"}`, margin, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(muted);
        doc.text(completedSet.has(index) ? "Done" : "Open", pageWidth - margin - 46, y);
        y += 14;
        doc.setTextColor(ink);
        writeWrapped(event.description || event.location || "No details yet.", margin, contentWidth);
        y += 8;
      });

      Object.values(BINDER_SECTIONS).forEach((section) => {
        ensurePage(56);
        y += 8;
        doc.setFont("times", "bold");
        doc.setFontSize(18);
        doc.setTextColor(burgundy);
        doc.text(section.title, margin, y);
        y += 18;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(muted);
        writeWrapped(section.description, margin, contentWidth);
        y += 4;
        section.items.forEach((item) => {
          ensurePage(54);
          const note =
            section.id === "ceremony"
              ? summarizeCeremonyPlanForPdf(ceremonyPlan, item.id).trim()
              : binderNotes[`${section.id}.${item.id}`]?.trim();
          doc.setFont("helvetica", "bold");
          doc.setTextColor(ink);
          doc.text(item.title, margin, y);
          y += 14;
          doc.setFont("helvetica", "normal");
          doc.setTextColor(muted);
          writeWrapped(note || item.helper, margin + 12, contentWidth - 12);
          y += 8;
        });
      });

      ensurePage(56);
      y += 8;
      doc.setFont("times", "bold");
      doc.setFontSize(18);
      doc.setTextColor(burgundy);
      doc.text("Packing Checklist", margin, y);
      y += 20;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      packingItems.forEach((item) => {
        ensurePage(36);
        doc.setTextColor(ink);
        doc.text(`${item.completed ? "[x]" : "[ ]"} ${item.label}`, margin, y);
        y += 14;
        if (item.note.trim()) {
          doc.setTextColor(muted);
          writeWrapped(item.note, margin + 14, contentWidth - 14);
        }
        y += 6;
      });

      doc.save("aido-day-of-binder.pdf");
      toast({ title: "Full day-of binder exported" });
    } catch {
      toast({ title: "Could not export day-of binder", variant: "destructive" });
    } finally {
      setIsExportingBinderPdf(false);
    }
  };

  if (isLoadingTimeline) {
    return (
      <div className="mx-auto max-w-6xl space-y-5 p-4">
        <Skeleton className="h-40 w-full rounded-[2rem]" />
        <Skeleton className="h-20 w-full rounded-3xl" />
        <Skeleton className="h-80 w-full rounded-[2rem]" />
      </div>
    );
  }

  const weddingDate = profile?.weddingDate ? new Date(profile.weddingDate + "T00:00:00") : new Date();
  const dateStr = format(weddingDate, "EEEE, MMMM do");
  const ceremonyDisplay = formatProfileTime((profile as any)?.ceremonyTime);
  const coupleName = profile ? `${profile.partner2Name} & ${profile.partner1Name}` : "Your wedding";
  const venueLabel = profile?.venue || (profile as any)?.location || "Venue TBD";
  const packedCount = packingItems.filter((item) => item.completed).length;
  const completedTimelineCount = completedSet.size;
  const timelineProgress = editableEvents.length
    ? Math.round((completedTimelineCount / editableEvents.length) * 100)
    : 0;
  const nextEvent = editableEvents.find((_, index) => !completedSet.has(index));
  const activeSection =
    activeTab !== "timeline" && activeTab !== "packing" ? BINDER_SECTIONS[activeTab] : null;
  const ActiveSectionIcon = activeSection?.icon ?? ClipboardList;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[2rem] border border-[#efd6d9] bg-[#fff9f5] shadow-[0_22px_55px_rgba(141,41,77,0.12)]">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.35fr_0.65fr]">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#F7DDE2] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#8D294D]">
              <Sparkles className="h-3.5 w-3.5" />
              A.I Do Day-Of Coordinator
            </div>
            <h1 className="font-serif text-4xl font-bold leading-tight text-[#4C2730] sm:text-5xl">
              Wedding day command center
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[#7B5364]">
              A cleaner run-of-show binder for your timeline, ceremony cues, music, speeches,
              setup details, attire, contacts, and packing.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                variant="outline"
                className="gap-2 rounded-full border-[#E8C9D4] bg-white/80 text-[#8D294D] hover:bg-[#F7DDE2]"
                onClick={handleDownloadTimelinePdf}
                disabled={!editableEvents.length || isExportingTimelinePdf}
              >
                <FileDown className="h-4 w-4" />
                {isExportingTimelinePdf ? "Exporting..." : "Export Timeline PDF"}
              </Button>
              <Button
                className="gap-2 rounded-full bg-[#24432E] text-white hover:bg-[#1c3525]"
                onClick={handleDownloadBinderPdf}
                disabled={isExportingBinderPdf}
              >
                <Download className="h-4 w-4" />
                {isExportingBinderPdf ? "Exporting..." : "Export Full Binder"}
              </Button>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[#F1D6DD] bg-white/85 p-5 shadow-[0_14px_35px_rgba(141,41,77,0.09)]">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#A65A73]">Current plan</p>
            <h2 className="mt-2 font-serif text-3xl font-bold text-[#4C2730]">{coupleName}</h2>
            <div className="mt-4 space-y-3 text-sm text-[#6F4A55]">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-[#D4A373]" />
                {dateStr}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#D4A373]" />
                Ceremony at {ceremonyDisplay}
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#D4A373]" />
                {venueLabel}
              </div>
            </div>
          </div>
        </div>
        <div className="grid border-t border-[#F1D6DD] bg-white/70 sm:grid-cols-4">
          {[
            ["Timeline", `${editableEvents.length}`, "items"],
            ["Completed", `${timelineProgress}%`, "checked"],
            ["Packed", `${packedCount}/${packingItems.length}`, "ready"],
            ["Next Up", nextEvent?.time || "TBD", nextEvent?.title || "No open event"],
          ].map(([label, value, helper]) => (
            <div key={label} className="border-[#F1D6DD] p-4 sm:border-r last:border-r-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#A65A73]">{label}</p>
              <p className="mt-1 font-serif text-2xl font-bold text-[#4C2730]">{value}</p>
              <p className="text-xs text-[#7B5364]">{helper}</p>
            </div>
          ))}
        </div>
      </section>

      {activeWorkspace && activeWorkspace.role !== "owner" && (
        <div className="mt-4 rounded-2xl border border-[#F1D6DD] bg-white px-4 py-3 text-sm text-[#7B5364]">
          You are viewing {activeWorkspace.partner2Name} &amp; {activeWorkspace.partner1Name}'s shared wedding workspace.
        </div>
      )}

      {hasUnsavedChanges && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          You have unsaved timeline edits. Save or cancel the active event before leaving the page.
        </div>
      )}

      <section className="mt-6 rounded-[1.75rem] border border-[#EBCBD2] bg-white p-4 shadow-[0_14px_35px_rgba(141,41,77,0.08)] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-2xl bg-[#F7DDE2] p-3 text-[#8D294D]">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#A65A73]">Day-of timeline</p>
              <h2 className="font-serif text-2xl font-bold text-[#4C2730]">Ceremony begins at {ceremonyDisplay}</h2>
              <p className="text-sm text-[#7B5364]">
                Regenerate the schedule when the ceremony time, venue flow, or photo plan changes.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="gap-2 rounded-full border-[#E8C9D4] text-[#8D294D] hover:bg-[#F7DDE2]"
              onClick={() => setIsRegenerateOpen(true)}
              disabled={generateTimeline.isPending}
            >
              <Sparkles className="h-4 w-4" />
              Regenerate
            </Button>
            <Button
              variant="ghost"
              className="gap-2 rounded-full text-[#7B5364] hover:bg-[#FFF4F0]"
              onClick={resetAll}
              disabled={isSaving || !timeline?.id}
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>
      </section>

      <nav className="mt-6 overflow-x-auto border-b border-[#E8C9D4]">
        <div className="flex min-w-max gap-2">
          {DAY_OF_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-t-2xl px-4 py-3 text-sm font-bold transition ${
                  isActive
                    ? "border-b-2 border-[#8D294D] bg-white text-[#8D294D]"
                    : "text-[#72535B] hover:bg-white/70 hover:text-[#8D294D]"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="mt-6">
        {activeTab === "timeline" && (
          <section className="space-y-4">
            {editableEvents.length === 0 ? (
              <Card className="rounded-[2rem] border-[#EBCBD2] bg-white py-12 text-center shadow-sm">
                <CardContent className="space-y-4">
                  <Clock className="mx-auto h-12 w-12 text-[#8D294D]/40" />
                  <p className="text-[#7B5364]">{t("dayof.no_timeline")}</p>
                  <div className="flex flex-col justify-center gap-2 sm:flex-row">
                    <Button
                      className="gap-2 rounded-full bg-[#8D294D] hover:bg-[#7a2140]"
                      onClick={() => setIsRegenerateOpen(true)}
                      disabled={generateTimeline.isPending}
                    >
                      <Sparkles className="h-4 w-4" />
                      Generate with AI
                    </Button>
                    <Button variant="outline" className="rounded-full" onClick={() => (window.location.href = "/timeline")}>
                      {t("dayof.go_to_timeline")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {editableEvents.map((event, i) => {
                  const isDone = completedSet.has(i);
                  const editing = editingIndex === i;
                  return (
                    <article
                      key={`${event.id ?? event.title}-${i}`}
                      className={`rounded-[1.5rem] border bg-white p-4 shadow-[0_12px_28px_rgba(141,41,77,0.08)] transition ${
                        isDone ? "border-[#D7E6D4] bg-[#FAFDF9]" : "border-[#EBCBD2]"
                      }`}
                    >
                      <div className="grid gap-4 lg:grid-cols-[9rem_1fr_auto] lg:items-start">
                        <div className="rounded-2xl bg-[#FFF4F0] px-4 py-3 text-center">
                          {editing ? (
                            <Input
                              value={editDraft?.time ?? ""}
                              onChange={(e) => updateEditDraft({ time: e.target.value })}
                              className="h-9 border-[#E8C9D4] text-center font-serif"
                            />
                          ) : (
                            <>
                              <p className="font-serif text-2xl font-bold text-[#8D294D]">{event.time || "TBD"}</p>
                              <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-[#A65A73]">
                                {event.category || "Timeline"}
                              </p>
                            </>
                          )}
                        </div>

                        <div className="min-w-0">
                          {editing ? (
                            <div className="space-y-3">
                              <Input
                                ref={titleRef}
                                value={editDraft?.title ?? ""}
                                onChange={(e) => updateEditDraft({ title: e.target.value })}
                                className="border-[#E8C9D4] font-serif text-lg"
                                placeholder={t("dayof.event_title_placeholder")}
                              />
                              <Textarea
                                value={editDraft?.description ?? ""}
                                onChange={(e) => updateEditDraft({ description: e.target.value })}
                                className="min-h-[96px] resize-none border-[#E8C9D4]"
                                placeholder={t("dayof.description_placeholder")}
                              />
                              <Input
                                value={editDraft?.location ?? ""}
                                onChange={(e) => updateEditDraft({ location: e.target.value })}
                                className="border-[#E8C9D4]"
                                placeholder="Location or handoff point"
                              />
                            </div>
                          ) : (
                            <>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className={`font-serif text-2xl font-bold ${isDone ? "text-[#6E8D5C]" : "text-[#4C2730]"}`}>
                                  {event.title || "Untitled event"}
                                </h3>
                                {isDone && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F2E2] px-2.5 py-1 text-xs font-bold text-[#5F7D4E]">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Done
                                  </span>
                                )}
                              </div>
                              <p className="mt-2 text-sm leading-6 text-[#6F4A55]">{event.description || "No notes yet."}</p>
                              {event.location && (
                                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#FFF4F0] px-3 py-1 text-xs font-bold text-[#8D294D]">
                                  <MapPin className="h-3.5 w-3.5" />
                                  {event.location}
                                </p>
                              )}
                            </>
                          )}
                        </div>

                        <div className="flex flex-wrap justify-end gap-2">
                          {editing ? (
                            <>
                              <Button variant="ghost" className="gap-1.5 rounded-full" onClick={cancelEditing} disabled={isSaving}>
                                <X className="h-4 w-4" />
                                Cancel
                              </Button>
                              <Button className="gap-1.5 rounded-full bg-[#8D294D] hover:bg-[#7a2140]" onClick={saveEdit} disabled={isSaving}>
                                <Save className="h-4 w-4" />
                                {isSaving ? "Saving..." : "Save"}
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                className="gap-1.5 rounded-full border-[#E8C9D4] text-[#8D294D]"
                                onClick={() => startEditing(i)}
                              >
                                <Pencil className="h-4 w-4" />
                                Edit
                              </Button>
                              <Button
                                variant={isDone ? "secondary" : "outline"}
                                className="gap-1.5 rounded-full"
                                onClick={() => toggleDone(i)}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                {isDone ? "Undo" : "Done"}
                              </Button>
                              <Button
                                variant="ghost"
                                className="rounded-full text-destructive hover:bg-destructive/10"
                                onClick={() => deleteEvent(i)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeTab === "ceremony" && (
          <section className="space-y-4">
            <div className="rounded-[1.75rem] border border-[#EBCBD2] bg-white p-5 shadow-[0_12px_28px_rgba(141,41,77,0.08)]">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-[#F7DDE2] p-3 text-[#8D294D]">
                  <CalendarDays className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="font-serif text-3xl font-bold text-[#4C2730]">Ceremony Plan</h2>
                  <p className="mt-1 text-sm leading-6 text-[#7B5364]">
                    Keep the ceremony sequence, handoffs, and officiant notes in one structured plan.
                  </p>
                </div>
              </div>
            </div>

            <CeremonySectionCard
              icon={UsersRound}
              title="Processional order"
              helper="Who walks, with whom, and in what order."
              section="processional"
              suggestingSection={suggestingSection}
              onGenerate={generateCeremonySuggestion}
            >
              <div className="mb-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="gap-2 rounded-full bg-[#8D294D] hover:bg-[#7a2140]"
                  onClick={() => updateCeremonyPlan({ processional: [...ceremonyPlan.processional, blankProcessionalEntry()] })}
                >
                  <UserPlus className="h-4 w-4" />
                  Add Person
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 rounded-full border-[#E8C9D4] text-[#8D294D] hover:bg-[#F7DDE2]"
                  onClick={useTraditionalOrder}
                >
                  <Sparkles className="h-4 w-4" />
                  Use Traditional Order
                </Button>
              </div>
              <div className="space-y-3">
                {ceremonyPlan.processional.map((entry, index) => {
                  const walkOptions = Array.from(new Set(["None", ...guestNameOptions.filter((name) => name !== entry.personName), "Partnered attendant", "Parent or escort"]));
                  return (
                    <div
                      key={entry.id}
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const from = Number(event.dataTransfer.getData("text/plain"));
                        updateCeremonyPlan({ processional: moveItem(ceremonyPlan.processional, from, index) });
                      }}
                      className="rounded-2xl border border-[#E8C9D4] bg-[#FFFDFC] p-3"
                    >
                      <div className="grid gap-3 lg:grid-cols-[auto_1.25fr_1fr_1fr_auto] lg:items-start">
                        <div className="flex items-center gap-2 pt-2 text-[#A65A73]">
                          <GripVertical className="h-5 w-5" />
                          <span className="text-xs font-bold">{index + 1}</span>
                        </div>
                        <FieldLabel label="Person name" hint="Start typing to use a saved guest name. Example: Stacy's mom.">
                          <GuestNameInput
                            value={entry.personName}
                            onChange={(value) =>
                              updateCeremonyPlan({
                                processional: ceremonyPlan.processional.map((item, i) => (i === index ? { ...item, personName: value } : item)),
                              })
                            }
                            options={guestNameOptions}
                            placeholder="Type or choose guest"
                            listId={`processional-guest-${entry.id}`}
                          />
                        </FieldLabel>
                        <FieldLabel label="Role" hint="Example: Parent, Officiant, Flower Girl.">
                          <SelectInput
                            value={entry.role}
                            options={CEREMONY_ROLES}
                            onChange={(value) =>
                              updateCeremonyPlan({
                                processional: ceremonyPlan.processional.map((item, i) => (i === index ? { ...item, role: value } : item)),
                              })
                            }
                          />
                        </FieldLabel>
                        <FieldLabel label="Walks with" hint="Choose None for solo entrances.">
                          <SelectInput
                            value={entry.walksWith}
                            options={walkOptions}
                            onChange={(value) =>
                              updateCeremonyPlan({
                                processional: ceremonyPlan.processional.map((item, i) => (i === index ? { ...item, walksWith: value } : item)),
                              })
                            }
                          />
                        </FieldLabel>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-7 rounded-full text-[#A65A73] hover:bg-destructive/10 hover:text-destructive"
                          onClick={() =>
                            updateCeremonyPlan({ processional: ceremonyPlan.processional.filter((item) => item.id !== entry.id) })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.16em] text-[#A65A73]">
                          Optional notes
                        </summary>
                        <Textarea
                          value={entry.notes}
                          onChange={(event) =>
                            updateCeremonyPlan({
                              processional: ceremonyPlan.processional.map((item, i) => (i === index ? { ...item, notes: event.target.value } : item)),
                            })
                          }
                          className="mt-2 min-h-[72px] resize-none rounded-2xl border-[#E8C9D4] bg-white"
                          placeholder="Example: Pause at aisle entrance until music changes."
                        />
                      </details>
                    </div>
                  );
                })}
              </div>
            </CeremonySectionCard>

            <CeremonySectionCard
              icon={Gem}
              title="Rings and vows"
              helper="Who has the rings, printed vows, and ceremony keepsakes."
              section="rings"
              suggestingSection={suggestingSection}
              onGenerate={generateCeremonySuggestion}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <FieldLabel label="Ring holder" hint="Example: Best Man, Maid of Honor, or officiant.">
                  <SelectInput
                    value={ceremonyPlan.ringsAndVows.ringHolder}
                    placeholder="Choose guest"
                    options={guestNameOptions}
                    onChange={(value) => updateRingsAndVows({ ringHolder: value })}
                  />
                </FieldLabel>
                <FieldLabel label="Vow holder" hint="Example: couple keeps vow books, or officiant holds copies.">
                  <SelectInput
                    value={ceremonyPlan.ringsAndVows.vowHolder}
                    placeholder="Choose guest"
                    options={guestNameOptions}
                    onChange={(value) => updateRingsAndVows({ vowHolder: value })}
                  />
                </FieldLabel>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <ToggleCard
                  checked={ceremonyPlan.ringsAndVows.printedVows}
                  onChange={(checked) => updateRingsAndVows({ printedVows: checked })}
                  title="Printed vows"
                  description="Turn on if physical vow cards or vow books are part of the ceremony."
                />
                <ToggleCard
                  checked={ceremonyPlan.ringsAndVows.remindToPrintVows}
                  onChange={(checked) => updateRingsAndVows({ remindToPrintVows: checked })}
                  title="Remind me to print vows"
                  description="Keeps this visible in your day-of prep so it does not get missed."
                />
              </div>
              <div className="mt-5 rounded-2xl border border-[#E8C9D4] bg-[#FFF7F2]/60 p-4">
                <p className="font-bold text-[#4C2730]">Keepsakes checklist</p>
                <FieldHint>Examples: rings, vow books, marriage license, unity candle, family heirloom.</FieldHint>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {ceremonyPlan.ringsAndVows.keepsakes.map((item) => (
                    <label key={item.id} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-[#4C2730]">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(event) =>
                          updateRingsAndVows({
                            keepsakes: ceremonyPlan.ringsAndVows.keepsakes.map((keepsake) =>
                              keepsake.id === item.id ? { ...keepsake, checked: event.target.checked } : keepsake
                            ),
                          })
                        }
                        className="h-4 w-4 accent-[#8D294D]"
                      />
                      <span className="min-w-0 flex-1">{item.label}</span>
                      {item.custom && (
                        <button
                          type="button"
                          className="text-[#A65A73] hover:text-destructive"
                          onClick={() =>
                            updateRingsAndVows({
                              keepsakes: ceremonyPlan.ringsAndVows.keepsakes.filter((keepsake) => keepsake.id !== item.id),
                            })
                          }
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={newKeepsakeLabel}
                    onChange={(event) => setNewKeepsakeLabel(event.target.value)}
                    placeholder="Add custom keepsake, e.g. unity glass"
                    className="h-11 rounded-full border-[#E8C9D4] bg-white"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 rounded-full border-[#E8C9D4] text-[#8D294D] hover:bg-[#F7DDE2]"
                    onClick={() => {
                      const label = newKeepsakeLabel.trim();
                      if (!label) return;
                      updateRingsAndVows({
                        keepsakes: [...ceremonyPlan.ringsAndVows.keepsakes, { id: makeId("keepsake"), label, checked: true, custom: true }],
                      });
                      setNewKeepsakeLabel("");
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </div>
              </div>
            </CeremonySectionCard>

            <CeremonySectionCard
              icon={Mic2}
              title="Officiant cues"
              helper="License signing, announcements, unplugged ceremony note, or special readings."
              section="officiant"
              suggestingSection={suggestingSection}
              onGenerate={generateCeremonySuggestion}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <ToggleCard
                  checked={ceremonyPlan.officiantCues.licenseSigning}
                  onChange={(checked) => updateOfficiantCues({ licenseSigning: checked })}
                  title="License signing"
                  description="Track whether the license needs a specific signing moment."
                />
                <ToggleCard
                  checked={ceremonyPlan.officiantCues.unpluggedAnnouncement}
                  onChange={(checked) => updateOfficiantCues({ unpluggedAnnouncement: checked })}
                  title="Unplugged ceremony announcement"
                  description="Show a script the officiant can read before the processional."
                />
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <FieldLabel label="License signing time" hint="Example: Immediately after ceremony or during cocktail hour.">
                  <Input
                    value={ceremonyPlan.officiantCues.licenseSigningTime}
                    onChange={(event) => updateOfficiantCues({ licenseSigningTime: event.target.value })}
                    disabled={!ceremonyPlan.officiantCues.licenseSigning}
                    placeholder="Immediately after ceremony"
                    className="h-11 rounded-2xl border-[#E8C9D4] bg-white"
                  />
                </FieldLabel>
                <FieldLabel label="Special announcement" hint="Example: Cocktail hour directions.">
                  <SelectInput
                    value={ceremonyPlan.officiantCues.specialAnnouncement}
                    options={SPECIAL_ANNOUNCEMENTS}
                    onChange={(value) => updateOfficiantCues({ specialAnnouncement: value })}
                  />
                </FieldLabel>
              </div>
              {ceremonyPlan.officiantCues.unpluggedAnnouncement && (
                <div className="mt-4 rounded-2xl border border-[#E8C9D4] bg-[#FFF7F2]/70 p-4">
                  <p className="text-sm font-bold text-[#4C2730]">Script preview</p>
                  <Textarea
                    value={ceremonyPlan.officiantCues.unpluggedScript}
                    onChange={(event) => updateOfficiantCues({ unpluggedScript: event.target.value })}
                    className="mt-2 min-h-[86px] resize-none rounded-2xl border-[#E8C9D4] bg-white"
                    placeholder={DEFAULT_UNPLUGGED_SCRIPT}
                  />
                </div>
              )}
              <div className="mt-5 rounded-2xl border border-[#E8C9D4] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-[#4C2730]">Readings</p>
                    <FieldHint>Add each reader and the title of their reading.</FieldHint>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 rounded-full border-[#E8C9D4] text-[#8D294D]"
                    onClick={() => updateOfficiantCues({ readings: [...ceremonyPlan.officiantCues.readings, blankReadingCue()] })}
                  >
                    <Plus className="h-4 w-4" />
                    Add Reading
                  </Button>
                </div>
                <div className="mt-3 space-y-3">
                  {ceremonyPlan.officiantCues.readings.map((reading, index) => (
                    <div key={reading.id} className="grid gap-3 rounded-2xl bg-[#FFFDFC] p-3 md:grid-cols-[1fr_1fr_auto]">
                      <FieldLabel label="Reader name">
                        <GuestNameInput
                          value={reading.readerName}
                          onChange={(value) =>
                            updateOfficiantCues({
                              readings: ceremonyPlan.officiantCues.readings.map((item, i) => (i === index ? { ...item, readerName: value } : item)),
                            })
                          }
                          options={guestNameOptions}
                          placeholder="Choose reader"
                          listId={`reading-guest-${reading.id}`}
                        />
                      </FieldLabel>
                      <FieldLabel label="Reading title">
                        <Input
                          value={reading.title}
                          onChange={(event) =>
                            updateOfficiantCues({
                              readings: ceremonyPlan.officiantCues.readings.map((item, i) => (i === index ? { ...item, title: event.target.value } : item)),
                            })
                          }
                          placeholder="Example: Love Is Patient"
                          className="h-11 rounded-2xl border-[#E8C9D4] bg-white"
                        />
                      </FieldLabel>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-7 rounded-full text-[#A65A73] hover:bg-destructive/10 hover:text-destructive"
                        onClick={() =>
                          updateOfficiantCues({ readings: ceremonyPlan.officiantCues.readings.filter((item) => item.id !== reading.id) })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              <details className="mt-4 rounded-2xl border border-[#E8C9D4] bg-[#FFFDFC] p-4">
                <summary className="cursor-pointer text-sm font-bold text-[#8D294D]">Advanced officiant notes</summary>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <FieldLabel label="Pronunciation notes" hint="Example: Last name is pronounced Lah-MARE.">
                    <Textarea
                      value={ceremonyPlan.officiantCues.pronunciationNotes}
                      onChange={(event) => updateOfficiantCues({ pronunciationNotes: event.target.value })}
                      className="min-h-[80px] resize-none rounded-2xl border-[#E8C9D4] bg-white"
                      placeholder="Names, cultural terms, or ceremony wording..."
                    />
                  </FieldLabel>
                  <FieldLabel label="Special announcement notes" hint="Example: Mention shuttle pickup by the fountain.">
                    <Textarea
                      value={ceremonyPlan.officiantCues.specialAnnouncementNotes}
                      onChange={(event) => updateOfficiantCues({ specialAnnouncementNotes: event.target.value })}
                      className="min-h-[80px] resize-none rounded-2xl border-[#E8C9D4] bg-white"
                      placeholder="Add details only the officiant needs..."
                    />
                  </FieldLabel>
                </div>
              </details>
            </CeremonySectionCard>

            <CeremonySectionCard
              icon={ClipboardList}
              title="Recessional and photo handoff"
              helper="Where the couple, party, and family go immediately after the ceremony."
              section="recessional"
              suggestingSection={suggestingSection}
              onGenerate={generateCeremonySuggestion}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <FieldLabel label="Couple exits to" hint="Example: private room for a quiet moment before photos.">
                  <SelectInput
                    value={ceremonyPlan.recessional.coupleExitsTo}
                    options={COUPLE_EXIT_OPTIONS}
                    onChange={(value) => updateRecessional({ coupleExitsTo: value })}
                  />
                </FieldLabel>
                <FieldLabel label="Guest flow" hint="Example: cocktail hour while family photos happen.">
                  <SelectInput
                    value={ceremonyPlan.recessional.guestFlow}
                    options={GUEST_FLOW_OPTIONS}
                    onChange={(value) => updateRecessional({ guestFlow: value })}
                  />
                </FieldLabel>
              </div>
              <div className="mt-5 rounded-2xl border border-[#E8C9D4] bg-[#FFF7F2]/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-[#4C2730]">Wedding party exit order</p>
                    <FieldHint>Drag rows into the order people should leave the ceremony.</FieldHint>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 rounded-full border-[#E8C9D4] text-[#8D294D]"
                    onClick={() =>
                      updateRecessional({
                        weddingPartyExitOrder: [...ceremonyPlan.recessional.weddingPartyExitOrder, blankProcessionalEntry("Wedding Party")],
                      })
                    }
                  >
                    <Plus className="h-4 w-4" />
                    Add Exit
                  </Button>
                </div>
                <div className="mt-3 space-y-2">
                  {ceremonyPlan.recessional.weddingPartyExitOrder.map((entry, index) => (
                    <div
                      key={entry.id}
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const from = Number(event.dataTransfer.getData("text/plain"));
                        updateRecessional({ weddingPartyExitOrder: moveItem(ceremonyPlan.recessional.weddingPartyExitOrder, from, index) });
                      }}
                      className="grid gap-3 rounded-2xl bg-white p-3 md:grid-cols-[auto_1fr_1fr_auto]"
                    >
                      <div className="flex items-center gap-2 text-[#A65A73]">
                        <GripVertical className="h-5 w-5" />
                        <span className="text-xs font-bold">{index + 1}</span>
                      </div>
                      <GuestNameInput
                        value={entry.personName}
                        onChange={(value) =>
                          updateRecessional({
                            weddingPartyExitOrder: ceremonyPlan.recessional.weddingPartyExitOrder.map((item, i) =>
                              i === index ? { ...item, personName: value } : item
                            ),
                          })
                        }
                        options={guestNameOptions}
                        placeholder="Person or group"
                        listId={`exit-guest-${entry.id}`}
                      />
                      <SelectInput
                        value={entry.role}
                        options={CEREMONY_ROLES}
                        onChange={(value) =>
                          updateRecessional({
                            weddingPartyExitOrder: ceremonyPlan.recessional.weddingPartyExitOrder.map((item, i) =>
                              i === index ? { ...item, role: value } : item
                            ),
                          })
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="rounded-full text-[#A65A73] hover:bg-destructive/10 hover:text-destructive"
                        onClick={() =>
                          updateRecessional({
                            weddingPartyExitOrder: ceremonyPlan.recessional.weddingPartyExitOrder.filter((item) => item.id !== entry.id),
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {ceremonyPlan.recessional.weddingPartyExitOrder.length === 0 && (
                    <p className="rounded-2xl bg-white px-4 py-3 text-sm text-[#7B5364]">
                      Add the couple, wedding party, and immediate family in the order they should exit.
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-5 rounded-2xl border border-[#E8C9D4] bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-[#4C2730]">Family photo groups</p>
                    <FieldHint>Repeatable groups keep the photographer handoff clear.</FieldHint>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 rounded-full border-[#E8C9D4] text-[#8D294D]"
                    onClick={() =>
                      updateRecessional({ familyPhotoGroups: [...ceremonyPlan.recessional.familyPhotoGroups, blankFamilyPhotoGroup()] })
                    }
                  >
                    <Plus className="h-4 w-4" />
                    Add Group
                  </Button>
                </div>
                <div className="mt-3 space-y-3">
                  {ceremonyPlan.recessional.familyPhotoGroups.map((group, index) => (
                    <div key={group.id} className="grid gap-3 rounded-2xl bg-[#FFFDFC] p-3 md:grid-cols-[0.9fr_1.3fr_auto]">
                      <FieldLabel label="Group name">
                        <Input
                          value={group.groupName}
                          onChange={(event) =>
                            updateRecessional({
                              familyPhotoGroups: ceremonyPlan.recessional.familyPhotoGroups.map((item, i) =>
                                i === index ? { ...item, groupName: event.target.value } : item
                              ),
                            })
                          }
                          placeholder="Immediate family"
                          className="h-11 rounded-2xl border-[#E8C9D4] bg-white"
                        />
                      </FieldLabel>
                      <FieldLabel label="Members" hint="Example: couple, parents, siblings, grandparents.">
                        <Input
                          value={group.members}
                          onChange={(event) =>
                            updateRecessional({
                              familyPhotoGroups: ceremonyPlan.recessional.familyPhotoGroups.map((item, i) =>
                                i === index ? { ...item, members: event.target.value } : item
                              ),
                            })
                          }
                          placeholder="List names or relationship groups"
                          className="h-11 rounded-2xl border-[#E8C9D4] bg-white"
                        />
                      </FieldLabel>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-7 rounded-full text-[#A65A73] hover:bg-destructive/10 hover:text-destructive"
                        onClick={() =>
                          updateRecessional({
                            familyPhotoGroups: ceremonyPlan.recessional.familyPhotoGroups.filter((item) => item.id !== group.id),
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              <details className="mt-5 rounded-2xl border border-[#E8C9D4] bg-[#FFFDFC] p-4">
                <summary className="cursor-pointer text-sm font-bold text-[#8D294D]">Structured JSON preview</summary>
                <pre className="mt-3 max-h-72 overflow-auto rounded-2xl bg-[#2C1821] p-4 text-xs leading-5 text-[#FFF7F2]">
                  {JSON.stringify(ceremonyPlan, null, 2)}
                </pre>
              </details>
            </CeremonySectionCard>
          </section>
        )}

        {activeSection && activeSection.id !== "ceremony" && (
          <section className="space-y-4">
            <div className="rounded-[1.75rem] border border-[#EBCBD2] bg-white p-5 shadow-[0_12px_28px_rgba(141,41,77,0.08)]">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-[#F7DDE2] p-3 text-[#8D294D]">
                  <ActiveSectionIcon className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="font-serif text-3xl font-bold text-[#4C2730]">{activeSection.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-[#7B5364]">{activeSection.description}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {activeSection.items.map((item) => {
                const noteKey = `${activeSection.id}.${item.id}`;
                return (
                  <article
                    key={item.id}
                    className="rounded-[1.5rem] border border-[#EBCBD2] bg-white p-5 shadow-[0_12px_28px_rgba(141,41,77,0.08)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-serif text-2xl font-bold text-[#4C2730]">{item.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-[#7B5364]">{item.helper}</p>
                      </div>
                      <ChevronRight className="mt-2 h-5 w-5 text-[#D4A373]" />
                    </div>
                    <Textarea
                      value={binderNotes[noteKey] ?? ""}
                      onChange={(e) => updateBinderNote(noteKey, e.target.value)}
                      className="mt-4 min-h-[112px] resize-none rounded-2xl border-[#E8C9D4] bg-[#FFFDFC]"
                      placeholder="Add names, times, phone numbers, cues, or special instructions..."
                    />
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === "packing" && (
          <section className="space-y-4">
            <div className="rounded-[1.75rem] border border-[#EBCBD2] bg-white p-5 shadow-[0_12px_28px_rgba(141,41,77,0.08)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="font-serif text-3xl font-bold text-[#4C2730]">Packing Checklist</h2>
                  <p className="mt-1 text-sm text-[#7B5364]">
                    Check items off as they are packed. Add notes for who carries each item.
                  </p>
                </div>
                <div className="rounded-full bg-[#F7DDE2] px-4 py-2 text-sm font-bold text-[#8D294D]">
                  {packedCount}/{packingItems.length} packed
                </div>
              </div>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Input
                  value={newPackingItem}
                  onChange={(e) => setNewPackingItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addPackingItem();
                  }}
                  className="h-11 rounded-full border-[#E8C9D4]"
                  placeholder="Add another packing item..."
                />
                <Button className="gap-2 rounded-full bg-[#8D294D] hover:bg-[#7a2140]" onClick={addPackingItem}>
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
            </div>

            <div className="grid gap-4">
              {packingItems.map((item) => (
                <article
                  key={item.id}
                  className={`rounded-[1.5rem] border bg-white p-4 shadow-[0_12px_28px_rgba(141,41,77,0.08)] ${
                    item.completed ? "border-[#D7E6D4] bg-[#FBFEFA]" : "border-[#EBCBD2]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => togglePackingItem(item.id)}
                      className={`mt-1 flex h-6 w-6 items-center justify-center rounded-md border transition ${
                        item.completed
                          ? "border-[#6E8D5C] bg-[#6E8D5C] text-white"
                          : "border-[#CFA8B4] bg-white text-transparent hover:border-[#8D294D]"
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`font-serif text-xl font-bold ${item.completed ? "text-[#6E8D5C]" : "text-[#4C2730]"}`}>
                        {item.label}
                      </p>
                      <Input
                        value={item.note}
                        onChange={(e) => updatePackingNote(item.id, e.target.value)}
                        className="mt-3 h-11 rounded-2xl border-[#E8C9D4] bg-[#FFFDFC]"
                        placeholder="Add a note, owner, bag, or location..."
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full text-[#A65A73] hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => removePackingItem(item.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>

      <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-sm text-blue-900">
        Day-of tools are planning aids, not professional event coordination services. Confirm timing,
        responsibilities, and access details with your venue and vendors.{" "}
        <a href="/terms" className="font-bold underline underline-offset-2">
          Terms apply.
        </a>
      </div>

      <Dialog
        open={isRegenerateOpen}
        onOpenChange={(open) => {
          setIsRegenerateOpen(open);
          if (!open) {
            setDayVision("");
            generateTimeline.reset();
          }
        }}
      >
        <DialogContent className="w-[95vw] rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif text-xl">
              <Sparkles className="h-5 w-5 text-primary" /> Regenerate Timeline
            </DialogTitle>
            <DialogDescription>
              Aria will create a fresh wedding day timeline from your profile. Add any special direction below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="Examples: outdoor ceremony, first look before ceremony, shuttle timing, extra family photo time..."
              value={dayVision}
              onChange={(e) => setDayVision(e.target.value)}
              className="min-h-[110px] resize-none bg-muted/50"
              disabled={generateTimeline.isPending}
            />
            <Button onClick={handleRegenerate} disabled={generateTimeline.isPending} className="w-full gap-2">
              {generateTimeline.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Generate New Timeline
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="fixed bottom-6 right-4 z-30 sm:right-6">
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) setTimeout(resetEmergency, 300);
          }}
        >
          <DialogTrigger asChild>
            <Button
              size="lg"
              className="rounded-full border-2 border-white/25 bg-destructive text-white shadow-xl shadow-destructive/20 hover:bg-destructive/90"
              data-testid="btn-emergency-trigger"
            >
              <Siren className="mr-2 h-5 w-5" />
              {t("dayof.emergency_btn")}
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] rounded-2xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-serif text-2xl text-destructive">
                <AlertCircle className="h-6 w-6" /> {t("dayof.stay_calm")}
              </DialogTitle>
              <DialogDescription className="text-base">{t("dayof.whats_wrong")}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {!getAdvice.data ? (
                <>
                  <Textarea
                    placeholder={t("dayof.emergency_placeholder")}
                    value={emergencyText}
                    onChange={(e) => setEmergencyText(e.target.value)}
                    className="min-h-[120px] resize-none border-destructive/20 bg-muted/50 p-4 text-lg focus-visible:ring-destructive"
                    data-testid="textarea-emergency"
                  />
                  <Button
                    onClick={handleEmergencySubmit}
                    disabled={!emergencyText.trim() || getAdvice.isPending}
                    className="h-14 w-full bg-destructive text-lg hover:bg-destructive/90"
                    data-testid="btn-emergency-submit"
                  >
                    {getAdvice.isPending ? t("dayof.analyzing") : t("dayof.get_advice")}
                  </Button>
                </>
              ) : (
                <div className="space-y-6 animate-in zoom-in-95 duration-300">
                  <div className="rounded-xl border border-secondary/30 bg-secondary/20 p-4">
                    <h4 className="mb-2 font-serif text-lg font-medium text-foreground">{t("dayof.instant_advice")}</h4>
                    <p className="leading-relaxed text-foreground">{getAdvice.data.advice}</p>
                  </div>

                  <div>
                    <h4 className="mb-3 font-serif text-lg font-medium text-destructive">{t("dayof.action_steps")}</h4>
                    <ul className="space-y-3">
                      {getAdvice.data.steps.map((step: string, idx: number) => (
                        <li key={idx} className="flex gap-3 rounded-lg bg-muted p-3">
                          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-destructive text-sm font-bold text-white">
                            {idx + 1}
                          </span>
                          <span className="text-sm font-medium">{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Button variant="outline" className="h-12 w-full" onClick={resetEmergency}>
                    {t("dayof.ask_another")}
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export default function DayOf() {
  return (
    <DayOfErrorBoundary>
      <DayOfInner />
    </DayOfErrorBoundary>
  );
}
