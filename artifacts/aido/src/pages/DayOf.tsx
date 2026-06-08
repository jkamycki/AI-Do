import { Component, useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import { authFetch } from "@/lib/authFetch";
import { coupleFirstNames } from "@/lib/coupleNames";
import {
  getGetTimelineQueryKey,
  useEmergencyAdvice,
  useGenerateTimeline,
  useGetGuests,
  useGetProfile,
  useGetTimeline,
  useListVendors,
} from "@workspace/api-client-react";
import type { Vendor } from "@workspace/api-client-react";
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
  ClipboardList,
  Clock,
  Download,
  FileDown,
  Gem,
  GripVertical,
  Heart,
  Headphones,
  ListChecks,
  MapPin,
  Mic2,
  Music,
  PackageCheck,
  Pencil,
  PhoneCall,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Shirt,
  Siren,
  Sparkles,
  Trash2,
  UsersRound,
  UserPlus,
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
  | "vendors-party"
  | "packing"
  | "export";

type BinderSectionId = Exclude<DayOfTab, "timeline" | "packing" | "export">;

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

type StructuredBinderSectionId = Exclude<BinderSectionId, "ceremony">;

interface MusicCue {
  id: string;
  moment: string;
  song: string;
  artist: string;
  cueBy: string;
  notes: string;
}

interface MusicPreference {
  id: string;
  song: string;
  note: string;
}

interface MusicPlan {
  preludeStart: string;
  soundCheckTime: string;
  cueOwner: string;
  ceremonyCues: MusicCue[];
  receptionCues: MusicCue[];
  mustPlay: MusicPreference[];
  doNotPlay: MusicPreference[];
  notes: string;
}

interface SpeechSpeaker {
  id: string;
  speakerName: string;
  role: string;
  duration: string;
  micType: string;
  notes: string;
}

interface SpeechPlan {
  toastStart: string;
  hostName: string;
  micPlan: string;
  speakers: SpeechSpeaker[];
  avNeeds: KeepsakeItem[];
  timekeeper: string;
  notes: string;
}

interface SetupTask {
  id: string;
  area: string;
  task: string;
  owner: string;
  dueBy: string;
  status: string;
  notes: string;
}

interface SetupPlan {
  loadInStart: string;
  roomFlipTime: string;
  venueContact: string;
  cleanupOwner: string;
  tasks: SetupTask[];
  notes: string;
}

interface AttireItem {
  id: string;
  personName: string;
  item: string;
  location: string;
  owner: string;
  packed: boolean;
  notes: string;
}

interface AttirePlan {
  gettingReadyLocation: string;
  attireLead: string;
  finalSteamTime: string;
  items: AttireItem[];
  emergencyKit: KeepsakeItem[];
  notes: string;
}

interface VendorRunbookContact {
  id: string;
  vendorName: string;
  category: string;
  leadName: string;
  phone: string;
  arrivalTime: string;
  paymentStatus: string;
  notes: string;
}

interface PartyContact {
  id: string;
  personName: string;
  role: string;
  phone: string;
  arrivalTime: string;
  duty: string;
}

interface VendorsPartyPlan {
  vendors: VendorRunbookContact[];
  party: PartyContact[];
  handoffNotes: string;
}

interface DayOfRunbookPlan {
  music: MusicPlan;
  speeches: SpeechPlan;
  setup: SetupPlan;
  attire: AttirePlan;
  vendorsParty: VendorsPartyPlan;
}

const DAY_OF_TABS: Array<{ id: DayOfTab; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: "timeline", label: "Timeline", icon: Clock },
  { id: "ceremony", label: "Ceremony", icon: CalendarDays },
  { id: "vendors-party", label: "Vendors", icon: PhoneCall },
  { id: "music", label: "Music & Speeches", icon: Music },
  { id: "setup", label: "Setup", icon: ClipboardList },
  { id: "packing", label: "Packing", icon: ListChecks },
  { id: "export", label: "Export Binder", icon: Download },
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

const MUSIC_MOMENTS = [
  "Prelude",
  "Family seating",
  "Wedding party processional",
  "Partner entrance",
  "Recessional",
  "Grand entrance",
  "First dance",
  "Parent dance",
  "Cake cutting",
  "Last song",
  "Custom",
];

const SPEECH_ROLES = ["Host", "Parent", "Maid of Honor", "Best Man", "Partner", "Sibling", "Friend", "Officiant", "Other"];
const MIC_OPTIONS = ["Handheld mic", "Lapel mic", "Podium mic", "DJ announces", "No mic needed"];
const SETUP_AREAS = ["Venue access", "Ceremony", "Cocktail hour", "Reception", "Signage", "Tabletop", "Florals", "Rentals", "Cleanup"];
const SETUP_STATUS = ["Not started", "Assigned", "Ready", "Complete"];
const ATTIRE_DEFAULT_ITEMS = ["Dress / suit", "Veil / tie", "Shoes", "Jewelry", "Rings", "Undergarments", "Backup flats", "Getting-ready robe"];
const VENDOR_PAYMENT_STATUSES = ["Confirmed", "Final payment due", "Tip prepared", "Paid in full", "No payment day-of"];

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
    title: "Music & Speeches",
    description: "Reception and program cues for songs, speeches, microphones, and timing.",
    icon: Music,
    items: [
      { id: "sound-check", title: "Sound check and cue owner", helper: "Who owns the music timeline and when audio is tested." },
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
    title: "Attire Prep",
    description: "Getting-ready outfits, packed items, emergency kit, and who owns each handoff.",
    icon: Shirt,
    items: [
      { id: "getting-ready", title: "Getting-ready plan", helper: "Where attire lives, who steams it, and when everyone gets dressed." },
      { id: "outfit-checklist", title: "Outfit checklist", helper: "Track the outfit pieces, location, owner, and packed status." },
      { id: "emergency-kit", title: "Emergency kit", helper: "Stain remover, sewing kit, tape, safety pins, tissues, and backup items." },
    ],
  },
  "vendors-party": {
    id: "vendors-party",
    title: "Vendor Contact Sheet & Wedding Party",
    description: "One practical contact sheet for vendor leads, arrival times, and wedding party duties.",
    icon: UsersRound,
    items: [
      { id: "vendor-contact-sheet", title: "Vendor contact sheet", helper: "Names, categories, phone numbers, arrival times, and payment reminders." },
      { id: "arrival-times", title: "Arrival and payment checks", helper: "Confirm load-in timing, balances, tips, and who greets each vendor." },
      { id: "wedding-party-roles", title: "Wedding party responsibilities", helper: "Who handles rings, phone calls, gifts, bustle, family photos, and end-of-night items." },
      { id: "handoff-contacts", title: "Handoff notes", helper: "The short list of who gets called before the couple gets interrupted." },
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

function pdfCell(value: unknown, fallback = "TBD"): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function vendorContactRows(vendors: Vendor[]) {
  return vendors
    .map((vendor) => ({
      vendor: pdfCell(vendor.name, "Vendor"),
      category: pdfCell(vendor.category, "Vendor"),
      lead: pdfCell((vendor as any).primaryContact, "Lead TBD"),
      phone: pdfCell((vendor as any).phone, "Phone TBD"),
      email: pdfCell((vendor as any).email, "Email TBD"),
      arrival: "Arrival: __________",
    }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.vendor.localeCompare(b.vendor));
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

function blankMusicCue(moment = "Custom"): MusicCue {
  return { id: makeId("music-cue"), moment, song: "", artist: "", cueBy: "", notes: "" };
}

function blankMusicPreference(): MusicPreference {
  return { id: makeId("song"), song: "", note: "" };
}

function blankSpeechSpeaker(role = "Other"): SpeechSpeaker {
  return { id: makeId("speaker"), speakerName: "", role, duration: "3 min", micType: "Handheld mic", notes: "" };
}

function blankSetupTask(area = "Reception"): SetupTask {
  return { id: makeId("setup-task"), area, task: "", owner: "", dueBy: "", status: "Not started", notes: "" };
}

function blankAttireItem(item = ""): AttireItem {
  return { id: makeId("attire"), personName: "", item, location: "", owner: "", packed: false, notes: "" };
}

function blankVendorContact(): VendorRunbookContact {
  return {
    id: makeId("vendor-contact"),
    vendorName: "",
    category: "",
    leadName: "",
    phone: "",
    arrivalTime: "",
    paymentStatus: "Confirmed",
    notes: "",
  };
}

function blankPartyContact(role = "Wedding Party"): PartyContact {
  return { id: makeId("party-contact"), personName: "", role, phone: "", arrivalTime: "", duty: "" };
}

function vendorToRunbookContact(vendor: Vendor): VendorRunbookContact {
  return {
    id: makeId("vendor-contact"),
    vendorName: String(vendor.name ?? ""),
    category: String(vendor.category ?? "Vendor"),
    leadName: String((vendor as any).primaryContact ?? ""),
    phone: String((vendor as any).phone ?? ""),
    arrivalTime: "",
    paymentStatus: "Confirmed",
    notes: String((vendor as any).notes ?? ""),
  };
}

function createDefaultRunbookPlan(): DayOfRunbookPlan {
  return {
    music: {
      preludeStart: "30 minutes before ceremony",
      soundCheckTime: "Before guest arrival",
      cueOwner: "DJ / band lead",
      ceremonyCues: [
        blankMusicCue("Prelude"),
        blankMusicCue("Wedding party processional"),
        blankMusicCue("Partner entrance"),
        blankMusicCue("Recessional"),
      ],
      receptionCues: [
        blankMusicCue("Grand entrance"),
        blankMusicCue("First dance"),
        blankMusicCue("Parent dance"),
        blankMusicCue("Last song"),
      ],
      mustPlay: [{ id: makeId("song"), song: "", note: "" }],
      doNotPlay: [],
      notes: "",
    },
    speeches: {
      toastStart: "During dinner",
      hostName: "",
      micPlan: "Handheld mic",
      speakers: [blankSpeechSpeaker("Parent"), blankSpeechSpeaker("Maid of Honor"), blankSpeechSpeaker("Best Man")],
      avNeeds: [
        { id: "wireless-mic", label: "Wireless mic tested", checked: true },
        { id: "backup-batteries", label: "Backup batteries", checked: true },
        { id: "podium", label: "Podium or clear speech spot", checked: false },
        { id: "projector", label: "Projector or slideshow", checked: false },
      ],
      timekeeper: "",
      notes: "",
    },
    setup: {
      loadInStart: "Morning of wedding",
      roomFlipTime: "",
      venueContact: "",
      cleanupOwner: "",
      tasks: [
        { ...blankSetupTask("Venue access"), task: "Confirm load-in door, parking, and vendor check-in spot", dueBy: "Before first vendor arrives", status: "Assigned" },
        { ...blankSetupTask("Signage"), task: "Place welcome sign, card box, guest book, and seating display", dueBy: "Before guest arrival", status: "Not started" },
        { ...blankSetupTask("Reception"), task: "Verify table numbers, place cards, favors, and candles", dueBy: "Before room reveal", status: "Not started" },
      ],
      notes: "",
    },
    attire: {
      gettingReadyLocation: "",
      attireLead: "",
      finalSteamTime: "Before photos",
      items: ATTIRE_DEFAULT_ITEMS.map((item) => blankAttireItem(item)),
      emergencyKit: [
        { id: "stain-remover", label: "Stain remover pen", checked: true },
        { id: "safety-pins", label: "Safety pins", checked: true },
        { id: "fashion-tape", label: "Fashion tape", checked: true },
        { id: "sewing-kit", label: "Mini sewing kit", checked: true },
        { id: "lint-roller", label: "Lint roller", checked: false },
        { id: "backup-shoes", label: "Backup flats or socks", checked: false },
      ],
      notes: "",
    },
    vendorsParty: {
      vendors: [],
      party: [blankPartyContact("Maid of Honor"), blankPartyContact("Best Man"), blankPartyContact("Parent")],
      handoffNotes: "",
    },
  };
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

function normalizeString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeMusicCue(value: unknown, index: number): MusicCue {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    id: String(row.id ?? makeId(`music-cue-${index + 1}`)),
    moment: normalizeString(row.moment, "Custom"),
    song: normalizeString(row.song),
    artist: normalizeString(row.artist),
    cueBy: normalizeString(row.cueBy),
    notes: normalizeString(row.notes),
  };
}

function normalizeMusicPreference(value: unknown, index: number): MusicPreference {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    id: String(row.id ?? makeId(`song-${index + 1}`)),
    song: normalizeString(row.song),
    note: normalizeString(row.note),
  };
}

function normalizeSpeechSpeaker(value: unknown, index: number): SpeechSpeaker {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    id: String(row.id ?? makeId(`speaker-${index + 1}`)),
    speakerName: normalizeString(row.speakerName),
    role: normalizeString(row.role, "Other"),
    duration: normalizeString(row.duration, "3 min"),
    micType: normalizeString(row.micType, "Handheld mic"),
    notes: normalizeString(row.notes),
  };
}

function normalizeSetupTask(value: unknown, index: number): SetupTask {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    id: String(row.id ?? makeId(`setup-task-${index + 1}`)),
    area: normalizeString(row.area, "Reception"),
    task: normalizeString(row.task),
    owner: normalizeString(row.owner),
    dueBy: normalizeString(row.dueBy),
    status: normalizeString(row.status, "Not started"),
    notes: normalizeString(row.notes),
  };
}

function normalizeAttireItem(value: unknown, index: number): AttireItem {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    id: String(row.id ?? makeId(`attire-${index + 1}`)),
    personName: normalizeString(row.personName),
    item: normalizeString(row.item, "Attire item"),
    location: normalizeString(row.location),
    owner: normalizeString(row.owner),
    packed: Boolean(row.packed),
    notes: normalizeString(row.notes),
  };
}

function normalizeVendorRunbookContact(value: unknown, index: number): VendorRunbookContact {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    id: String(row.id ?? makeId(`vendor-contact-${index + 1}`)),
    vendorName: normalizeString(row.vendorName),
    category: normalizeString(row.category, "Vendor"),
    leadName: normalizeString(row.leadName),
    phone: normalizeString(row.phone),
    arrivalTime: normalizeString(row.arrivalTime),
    paymentStatus: normalizeString(row.paymentStatus, "Confirmed"),
    notes: normalizeString(row.notes),
  };
}

function normalizePartyContact(value: unknown, index: number): PartyContact {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    id: String(row.id ?? makeId(`party-contact-${index + 1}`)),
    personName: normalizeString(row.personName),
    role: normalizeString(row.role, "Wedding Party"),
    phone: normalizeString(row.phone),
    arrivalTime: normalizeString(row.arrivalTime),
    duty: normalizeString(row.duty),
  };
}

function normalizeRunbookPlan(value: unknown): DayOfRunbookPlan {
  const fallback = createDefaultRunbookPlan();
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const music = row.music && typeof row.music === "object" ? row.music as Record<string, unknown> : {};
  const speeches = row.speeches && typeof row.speeches === "object" ? row.speeches as Record<string, unknown> : {};
  const setup = row.setup && typeof row.setup === "object" ? row.setup as Record<string, unknown> : {};
  const attire = row.attire && typeof row.attire === "object" ? row.attire as Record<string, unknown> : {};
  const vendorsParty = row.vendorsParty && typeof row.vendorsParty === "object" ? row.vendorsParty as Record<string, unknown> : {};

  return {
    music: {
      preludeStart: normalizeString(music.preludeStart, fallback.music.preludeStart),
      soundCheckTime: normalizeString(music.soundCheckTime, fallback.music.soundCheckTime),
      cueOwner: normalizeString(music.cueOwner, fallback.music.cueOwner),
      ceremonyCues: Array.isArray(music.ceremonyCues) ? music.ceremonyCues.map(normalizeMusicCue) : fallback.music.ceremonyCues,
      receptionCues: Array.isArray(music.receptionCues) ? music.receptionCues.map(normalizeMusicCue) : fallback.music.receptionCues,
      mustPlay: Array.isArray(music.mustPlay) ? music.mustPlay.map(normalizeMusicPreference) : fallback.music.mustPlay,
      doNotPlay: Array.isArray(music.doNotPlay) ? music.doNotPlay.map(normalizeMusicPreference) : fallback.music.doNotPlay,
      notes: normalizeString(music.notes),
    },
    speeches: {
      toastStart: normalizeString(speeches.toastStart, fallback.speeches.toastStart),
      hostName: normalizeString(speeches.hostName),
      micPlan: normalizeString(speeches.micPlan, fallback.speeches.micPlan),
      speakers: Array.isArray(speeches.speakers) ? speeches.speakers.map(normalizeSpeechSpeaker) : fallback.speeches.speakers,
      avNeeds: Array.isArray(speeches.avNeeds) ? speeches.avNeeds.map(normalizeKeepsake) : fallback.speeches.avNeeds,
      timekeeper: normalizeString(speeches.timekeeper),
      notes: normalizeString(speeches.notes),
    },
    setup: {
      loadInStart: normalizeString(setup.loadInStart, fallback.setup.loadInStart),
      roomFlipTime: normalizeString(setup.roomFlipTime),
      venueContact: normalizeString(setup.venueContact),
      cleanupOwner: normalizeString(setup.cleanupOwner),
      tasks: Array.isArray(setup.tasks) ? setup.tasks.map(normalizeSetupTask) : fallback.setup.tasks,
      notes: normalizeString(setup.notes),
    },
    attire: {
      gettingReadyLocation: normalizeString(attire.gettingReadyLocation),
      attireLead: normalizeString(attire.attireLead),
      finalSteamTime: normalizeString(attire.finalSteamTime, fallback.attire.finalSteamTime),
      items: Array.isArray(attire.items) ? attire.items.map(normalizeAttireItem) : fallback.attire.items,
      emergencyKit: Array.isArray(attire.emergencyKit) ? attire.emergencyKit.map(normalizeKeepsake) : fallback.attire.emergencyKit,
      notes: normalizeString(attire.notes),
    },
    vendorsParty: {
      vendors: Array.isArray(vendorsParty.vendors) ? vendorsParty.vendors.map(normalizeVendorRunbookContact) : fallback.vendorsParty.vendors,
      party: Array.isArray(vendorsParty.party) ? vendorsParty.party.map(normalizePartyContact) : fallback.vendorsParty.party,
      handoffNotes: normalizeString(vendorsParty.handoffNotes),
    },
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

function createSuggestedRunbookPlan(
  section: StructuredBinderSectionId,
  currentPlan: DayOfRunbookPlan,
  profile: any,
  guestNames: string[],
  vendors: Vendor[]
): DayOfRunbookPlan {
  const suggested = normalizeRunbookPlan(currentPlan);
  const partner2 = normalizeString(profile?.partner2Name, "Partner");
  const partner1 = normalizeString(profile?.partner1Name, "Partner");
  const venue = normalizeString(profile?.venue, "venue");

  if (section === "music") {
    suggested.music = {
      ...suggested.music,
      preludeStart: "30 minutes before ceremony",
      soundCheckTime: "90 minutes before ceremony",
      cueOwner: suggested.music.cueOwner || "DJ / band lead",
      ceremonyCues: [
        { ...blankMusicCue("Prelude"), song: "Instrumental playlist", cueBy: "DJ / musician", notes: "Start as guests arrive." },
        { ...blankMusicCue("Wedding party processional"), cueBy: "Coordinator", notes: "Cue after family seating." },
        { ...blankMusicCue("Partner entrance"), cueBy: "Coordinator", notes: `Hold doors until ${partner1 || "partner"} is ready.` },
        { ...blankMusicCue("Recessional"), song: "Upbeat exit song", cueBy: "Officiant recessional line", notes: "Begin immediately after kiss / final blessing." },
      ],
      receptionCues: [
        { ...blankMusicCue("Grand entrance"), cueBy: "DJ / MC", notes: "Confirm pronunciation before guests enter reception." },
        { ...blankMusicCue("First dance"), cueBy: "DJ / MC", notes: "Couple enters dance floor before song starts." },
        { ...blankMusicCue("Parent dance"), cueBy: "DJ / MC", notes: "Invite parent(s) by name." },
        { ...blankMusicCue("Last song"), cueBy: "DJ / band lead", notes: "Announce final private dance or exit sendoff." },
      ],
      mustPlay: suggested.music.mustPlay.length ? suggested.music.mustPlay : [{ id: makeId("song"), song: "Couple favorite", note: "" }],
      doNotPlay: suggested.music.doNotPlay,
    };
  }

  if (section === "speeches") {
    suggested.speeches = {
      ...suggested.speeches,
      toastStart: suggested.speeches.toastStart || "After salads are served",
      hostName: suggested.speeches.hostName || "DJ / MC",
      micPlan: suggested.speeches.micPlan || "Handheld mic",
      speakers: suggested.speeches.speakers.length
        ? suggested.speeches.speakers
        : [
            { ...blankSpeechSpeaker("Parent"), speakerName: guestNames[0] || "", duration: "3 min", notes: "Welcome guests and invite next speaker." },
            { ...blankSpeechSpeaker("Maid of Honor"), speakerName: guestNames[1] || "", duration: "3 min", notes: "Keep mic nearby after speech." },
            { ...blankSpeechSpeaker("Best Man"), speakerName: guestNames[2] || "", duration: "3 min", notes: "Final toast before dinner resumes." },
          ],
      avNeeds: suggested.speeches.avNeeds.map((item) => ({ ...item, checked: item.checked || item.id === "wireless-mic" || item.id === "backup-batteries" })),
      timekeeper: suggested.speeches.timekeeper || "Coordinator or DJ",
    };
  }

  if (section === "setup") {
    suggested.setup = {
      ...suggested.setup,
      loadInStart: suggested.setup.loadInStart || "Venue access time",
      roomFlipTime: suggested.setup.roomFlipTime || "Immediately after ceremony",
      venueContact: suggested.setup.venueContact || venue,
      cleanupOwner: suggested.setup.cleanupOwner || "Designated family member or coordinator",
      tasks: suggested.setup.tasks.length
        ? suggested.setup.tasks
        : createDefaultRunbookPlan().setup.tasks,
    };
  }

  if (section === "attire") {
    suggested.attire = {
      ...suggested.attire,
      gettingReadyLocation: suggested.attire.gettingReadyLocation || `${venue} getting-ready suite`,
      attireLead: suggested.attire.attireLead || guestNames[0] || "Maid of Honor / Best Man",
      finalSteamTime: suggested.attire.finalSteamTime || "Before first look or portraits",
      items: suggested.attire.items.length
        ? suggested.attire.items
        : [
            { ...blankAttireItem("Wedding outfit"), personName: partner2, owner: guestNames[0] || "", location: "Getting-ready suite" },
            { ...blankAttireItem("Wedding outfit"), personName: partner1, owner: guestNames[1] || "", location: "Getting-ready suite" },
            { ...blankAttireItem("Rings"), owner: guestNames[2] || "", location: "With ring holder" },
          ],
      emergencyKit: suggested.attire.emergencyKit.map((item) => ({ ...item, checked: true })),
    };
  }

  if (section === "vendors-party") {
    suggested.vendorsParty = {
      vendors: suggested.vendorsParty.vendors.length
        ? suggested.vendorsParty.vendors
        : (vendors as Vendor[]).slice(0, 12).map(vendorToRunbookContact),
      party: suggested.vendorsParty.party.length
        ? suggested.vendorsParty.party
        : [
            { ...blankPartyContact("Maid of Honor"), personName: guestNames[0] || "", duty: "Couple questions, bustle, emergency kit" },
            { ...blankPartyContact("Best Man"), personName: guestNames[1] || "", duty: "Rings, tips, transportation checks" },
            { ...blankPartyContact("Parent"), personName: guestNames[2] || "", duty: "Family photo gathering and guest support" },
          ],
      handoffNotes: suggested.vendorsParty.handoffNotes || "Call the wedding party contact before interrupting the couple unless urgent.",
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

function summarizeRunbookForPdf(plan: DayOfRunbookPlan, sectionId: StructuredBinderSectionId, itemId: string, vendors: Vendor[]): string {
  if (sectionId === "music") {
    if (itemId === "sound-check") {
      return `Prelude starts: ${plan.music.preludeStart || "TBD"}\nSound check: ${plan.music.soundCheckTime || "TBD"}\nCue owner: ${plan.music.cueOwner || "TBD"}\nNotes: ${plan.music.notes || "None"}`;
    }
    if (itemId === "ceremony-cues") {
      return plan.music.ceremonyCues.map((cue, index) => `${index + 1}. ${cue.moment}: ${cue.song || "Song TBD"}${cue.artist ? ` by ${cue.artist}` : ""} | Cue by: ${cue.cueBy || "TBD"}${cue.notes ? ` | ${cue.notes}` : ""}`).join("\n");
    }
    if (itemId === "reception-moments") {
      return plan.music.receptionCues.map((cue, index) => `${index + 1}. ${cue.moment}: ${cue.song || "Song TBD"}${cue.artist ? ` by ${cue.artist}` : ""} | Cue by: ${cue.cueBy || "TBD"}${cue.notes ? ` | ${cue.notes}` : ""}`).join("\n");
    }
    if (itemId === "do-not-play") {
      const must = plan.music.mustPlay.map((song) => `Must play: ${song.song || "Song TBD"}`).join("\n");
      const avoid = plan.music.doNotPlay.map((song) => `Do not play: ${song.song || "Song TBD"}`).join("\n");
      return [must, avoid].filter(Boolean).join("\n") || "No song preferences listed.";
    }
  }

  if (sectionId === "speeches") {
    if (itemId === "speaker-order") {
      return plan.speeches.speakers.map((speaker, index) => `${index + 1}. ${speaker.speakerName || speaker.role} (${speaker.role}) - ${speaker.duration || "Duration TBD"}${speaker.notes ? ` | ${speaker.notes}` : ""}`).join("\n");
    }
    if (itemId === "mic-plan") {
      const needs = plan.speeches.avNeeds.filter((item) => item.checked).map((item) => item.label).join(", ") || "None selected";
      return `Mic plan: ${plan.speeches.micPlan || "TBD"}\nHost / introducer: ${plan.speeches.hostName || "TBD"}\nAV needs: ${needs}`;
    }
    if (itemId === "time-limits") {
      return `Toast start: ${plan.speeches.toastStart || "TBD"}\nTimekeeper: ${plan.speeches.timekeeper || "TBD"}\nNotes: ${plan.speeches.notes || "None"}`;
    }
  }

  if (sectionId === "setup") {
    if (itemId === "load-in") return `Load-in start: ${plan.setup.loadInStart || "TBD"}\nVenue contact: ${plan.setup.venueContact || "TBD"}`;
    if (itemId === "floor-plan") return `Room flip time: ${plan.setup.roomFlipTime || "TBD"}\n${plan.setup.tasks.filter((task) => task.area === "Reception" || task.area === "Ceremony").map((task) => `${task.area}: ${task.task || "Task TBD"} (${task.status})`).join("\n")}`;
    if (itemId === "cleanup") return `Cleanup owner: ${plan.setup.cleanupOwner || "TBD"}\nNotes: ${plan.setup.notes || "None"}`;
    return plan.setup.tasks.map((task) => `${task.area}: ${task.task || "Task TBD"} | Owner: ${task.owner || "TBD"} | Due: ${task.dueBy || "TBD"} | ${task.status}${task.notes ? ` | ${task.notes}` : ""}`).join("\n");
  }

  if (sectionId === "attire") {
    if (itemId === "getting-ready") return `Getting-ready location: ${plan.attire.gettingReadyLocation || "TBD"}\nAttire lead: ${plan.attire.attireLead || "TBD"}\nFinal steam time: ${plan.attire.finalSteamTime || "TBD"}`;
    if (itemId === "emergency-kit") return plan.attire.emergencyKit.filter((item) => item.checked).map((item) => item.label).join(", ") || "No emergency kit items selected.";
    return plan.attire.items.map((item) => `${item.packed ? "[x]" : "[ ]"} ${item.personName || "Person TBD"} - ${item.item || "Item TBD"} | Location: ${item.location || "TBD"} | Owner: ${item.owner || "TBD"}${item.notes ? ` | ${item.notes}` : ""}`).join("\n");
  }

  if (sectionId === "vendors-party") {
    if (itemId === "vendor-contact-sheet" || itemId === "arrival-times") {
      const contacts = plan.vendorsParty.vendors.length ? plan.vendorsParty.vendors : vendors.map(vendorToRunbookContact);
      return contacts.map((vendor) => `${vendor.vendorName || "Vendor TBD"} (${vendor.category || "Vendor"}) | Lead: ${vendor.leadName || "TBD"} | Phone: ${vendor.phone || "TBD"} | Arrival: ${vendor.arrivalTime || "TBD"} | ${vendor.paymentStatus}`).join("\n");
    }
    if (itemId === "wedding-party-roles") {
      return plan.vendorsParty.party.map((person) => `${person.personName || person.role} (${person.role}) | Phone: ${person.phone || "TBD"} | Arrival: ${person.arrivalTime || "TBD"} | Duty: ${person.duty || "TBD"}`).join("\n");
    }
    return plan.vendorsParty.handoffNotes || "No handoff notes yet.";
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

function RunbookSectionCard({
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
  section: StructuredBinderSectionId;
  suggestingSection: StructuredBinderSectionId | null;
  onGenerate: (section: StructuredBinderSectionId) => void;
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
  const { data: vendors = [] } = useListVendors();
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
  const [runbookPlan, setRunbookPlan] = useState<DayOfRunbookPlan>(() => createDefaultRunbookPlan());
  const [suggestingRunbookSection, setSuggestingRunbookSection] = useState<StructuredBinderSectionId | null>(null);
  const [newKeepsakeLabel, setNewKeepsakeLabel] = useState("");
  const [newPackingItem, setNewPackingItem] = useState("");
  const [isExportingTimelinePdf, setIsExportingTimelinePdf] = useState(false);
  const [isExportingBinderPdf, setIsExportingBinderPdf] = useState(false);
  const [hasExportedBinder, setHasExportedBinder] = useState(false);
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
          runbookPlan?: unknown;
        };
        if (Array.isArray(parsed.packingItems)) setPackingItems(parsed.packingItems);
        if (parsed.binderNotes && typeof parsed.binderNotes === "object") setBinderNotes(parsed.binderNotes);
        if (parsed.ceremonyPlan) setCeremonyPlan(normalizeCeremonyPlan(parsed.ceremonyPlan));
        if (parsed.runbookPlan) setRunbookPlan(normalizeRunbookPlan(parsed.runbookPlan));
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
      localStorage.setItem(storageKey, JSON.stringify({ packingItems, binderNotes, ceremonyPlan, runbookPlan }));
    } catch {
      // Non-blocking local convenience storage.
    }
  }, [storageKey, loadedStorageKey, packingItems, binderNotes, ceremonyPlan, runbookPlan]);

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

  const updateRunbookSection = <K extends keyof DayOfRunbookPlan>(section: K, patch: Partial<DayOfRunbookPlan[K]>) => {
    setRunbookPlan((plan) => normalizeRunbookPlan({ ...plan, [section]: { ...plan[section], ...patch } }));
  };

  const updateVendorParty = (patch: Partial<VendorsPartyPlan>) => {
    updateRunbookSection("vendorsParty", patch);
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

  const generateRunbookSuggestion = (section: StructuredBinderSectionId) => {
    setSuggestingRunbookSection(section);
    window.setTimeout(() => {
      setRunbookPlan((plan) => createSuggestedRunbookPlan(section, plan, profile, guestNameOptions, vendors as Vendor[]));
      setSuggestingRunbookSection(null);
      toast({ title: "Suggested day-of section added" });
    }, 250);
  };

  const useSavedVendorsForBinder = () => {
    const savedVendors = (vendors as Vendor[]).map(vendorToRunbookContact);
    if (!savedVendors.length) {
      toast({
        title: "No saved vendors yet",
        description: "Add vendors in your Vendor List, then pull them into the day-of contact sheet.",
      });
      return;
    }
    updateVendorParty({ vendors: savedVendors });
    toast({ title: "Saved vendors added to contact sheet" });
  };

  const useSavedInfoForBinder = () => {
    const savedVendors = (vendors as Vendor[]).map(vendorToRunbookContact);

    setCeremonyPlan((plan) => {
      let nextPlan = normalizeCeremonyPlan(plan);
      (["processional", "rings", "officiant", "recessional"] as CeremonySectionId[]).forEach((section) => {
        nextPlan = createSuggestedCeremonyPlan(section, nextPlan, profile, guestNameOptions);
      });
      return nextPlan;
    });

    setRunbookPlan((plan) => {
      let nextPlan = normalizeRunbookPlan(plan);
      (["music", "speeches", "setup", "attire", "vendors-party"] as StructuredBinderSectionId[]).forEach((section) => {
        nextPlan = createSuggestedRunbookPlan(section, nextPlan, profile, guestNameOptions, vendors as Vendor[]);
      });
      if (savedVendors.length) nextPlan = { ...nextPlan, vendorsParty: { ...nextPlan.vendorsParty, vendors: savedVendors } };
      return normalizeRunbookPlan(nextPlan);
    });

    toast({
      title: "Saved info added",
      description: "A.I DO pulled in profile, guest, vendor, venue, and ceremony details where available.",
    });
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
      const coupleName = profile ? coupleFirstNames(profile.partner2Name, profile.partner1Name) : undefined;
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

      const paintPageBackground = () => {
        doc.setFillColor("#FFF9F5");
        doc.rect(0, 0, pageWidth, pageHeight, "F");
      };

      const ensurePage = (needed = 32) => {
        if (y + needed <= pageHeight - margin) return;
        doc.addPage();
        y = margin;
        paintPageBackground();
      };

      const writeWrapped = (text: string, x: number, width: number, lineHeight = 14) => {
        const lines = doc.splitTextToSize(text || "-", width);
        doc.text(lines, x, y);
        y += lines.length * lineHeight;
      };

      paintPageBackground();
      doc.setFont("times", "bold");
      doc.setFontSize(28);
      doc.setTextColor(burgundy);
      doc.text("A.I Do Day-Of Binder", margin, y);
      y += 26;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(muted);
      doc.text(`${profile ? coupleFirstNames(profile.partner2Name, profile.partner1Name) : "Partner & Partner"} | ${profile?.weddingDate ?? "Wedding date TBD"} | ${profile?.venue ?? "Venue TBD"}`, margin, y);
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
              : summarizeRunbookForPdf(runbookPlan, section.id, item.id, vendors as Vendor[]).trim() || binderNotes[`${section.id}.${item.id}`]?.trim();
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

      doc.addPage();
      y = margin;
      paintPageBackground();
      doc.setFont("times", "bold");
      doc.setFontSize(22);
      doc.setTextColor(burgundy);
      doc.text("Vendor Contact Sheet", margin, y);
      y += 18;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(muted);
      writeWrapped("Quick day-of reference for vendor names, lead contacts, phone numbers, and arrival check-ins. Fill in arrival times after final confirmation.", margin, contentWidth);
      y += 8;
      const contacts = vendorContactRows(vendors as Vendor[]);
      if (contacts.length === 0) {
        doc.setTextColor(ink);
        writeWrapped("No vendors have been added yet. Add vendors in the Vendor List to populate this page.", margin, contentWidth);
      } else {
        const fitText = (value: string, width: number) => {
          if (doc.getTextWidth(value) <= width) return value;
          let next = value;
          while (next.length > 3 && doc.getTextWidth(`${next}...`) > width) {
            next = next.slice(0, -1);
          }
          return `${next.trimEnd()}...`;
        };
        const columns = [
          { label: "Vendor", x: margin + 12, width: 132 },
          { label: "Category", x: margin + 150, width: 82 },
          { label: "Lead", x: margin + 238, width: 108 },
          { label: "Phone", x: margin + 352, width: 88 },
          { label: "Arrival", x: margin + 446, width: 70 },
        ];
        const rowHeight = 26;
        const headerY = y;

        doc.setFillColor("#FFFFFF");
        doc.roundedRect(margin, headerY - 4, contentWidth, 28, 10, 10, "F");
        doc.setDrawColor(235, 203, 210);
        doc.roundedRect(margin, headerY - 4, contentWidth, 28, 10, 10, "S");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(burgundy);
        columns.forEach((column) => doc.text(column.label.toUpperCase(), column.x, headerY + 13));
        y += 32;

        const maxRows = Math.max(0, Math.floor((pageHeight - margin - y - 24) / rowHeight));
        const visibleContacts = contacts.slice(0, maxRows);
        visibleContacts.forEach((row, index) => {
          const rowY = y + index * rowHeight;
          if (index % 2 === 0) {
            doc.setFillColor("#FFFFFF");
            doc.rect(margin, rowY - 8, contentWidth, rowHeight, "F");
          }
          doc.setDrawColor(245, 222, 226);
          doc.line(margin, rowY + 17, margin + contentWidth, rowY + 17);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(ink);
          doc.text(fitText(row.vendor, columns[0].width), columns[0].x, rowY + 8);
          doc.text(fitText(row.category, columns[1].width), columns[1].x, rowY + 8);
          doc.text(fitText(row.lead, columns[2].width), columns[2].x, rowY + 8);
          doc.text(fitText(row.phone, columns[3].width), columns[3].x, rowY + 8);
          doc.text("________", columns[4].x, rowY + 8);
        });
        y += visibleContacts.length * rowHeight + 8;

        if (contacts.length > visibleContacts.length) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(muted);
          doc.text(`${contacts.length - visibleContacts.length} more vendors are saved in the Vendor List.`, margin, y);
        }
      }

      doc.addPage();
      y = margin;
      paintPageBackground();
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
      setHasExportedBinder(true);
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
  const coupleName = profile ? coupleFirstNames(profile.partner2Name, profile.partner1Name) : "Your wedding";
  const venueLabel = profile?.venue || (profile as any)?.location || "Venue TBD";
  const packedCount = packingItems.filter((item) => item.completed).length;
  const completedTimelineCount = completedSet.size;
  const timelineProgress = editableEvents.length
    ? Math.round((completedTimelineCount / editableEvents.length) * 100)
    : 0;
  const nextEvent = editableEvents.find((_, index) => !completedSet.has(index));
  const activeSection =
    activeTab !== "timeline" && activeTab !== "packing" && activeTab !== "export" ? BINDER_SECTIONS[activeTab] : null;
  const ActiveSectionIcon = activeSection?.icon ?? ClipboardList;
  const renderRunbookPlan = normalizeRunbookPlan(runbookPlan);
  const musicPlan = renderRunbookPlan.music;
  const speechPlan = renderRunbookPlan.speeches;
  const setupPlan = renderRunbookPlan.setup;
  const attirePlan = renderRunbookPlan.attire;
  const vendorsPartyPlan = renderRunbookPlan.vendorsParty;
  const commandCenterItems: Array<{
    id: string;
    label: string;
    helper: string;
    complete: boolean;
    tab: DayOfTab;
  }> = [
    {
      id: "timeline",
      label: "Confirm timeline",
      helper: editableEvents.length ? `${completedTimelineCount}/${editableEvents.length} timeline items checked` : "Generate or add your wedding day timeline",
      complete: editableEvents.length > 0 && completedTimelineCount === editableEvents.length,
      tab: "timeline",
    },
    {
      id: "vendors",
      label: "Add vendor contacts",
      helper: vendorsPartyPlan.vendors.length ? `${vendorsPartyPlan.vendors.length} day-of contacts added` : "Pull saved vendors or add key contacts",
      complete: vendorsPartyPlan.vendors.some((vendor) => vendor.vendorName.trim() || vendor.phone.trim()),
      tab: "vendors-party",
    },
    {
      id: "ceremony",
      label: "Confirm ceremony cues",
      helper: ceremonyPlan.processional.length ? `${ceremonyPlan.processional.length} processional entries started` : "Add processional, rings, officiant, and exit cues",
      complete: ceremonyPlan.processional.length > 0 && !!ceremonyPlan.ringsAndVows.ringHolder,
      tab: "ceremony",
    },
    {
      id: "music",
      label: "Confirm music and speeches",
      helper: "Set cue owner, key songs, speakers, and mic plan",
      complete:
        (musicPlan.ceremonyCues.some((cue) => cue.song.trim() || cue.cueBy.trim()) ||
          musicPlan.receptionCues.some((cue) => cue.song.trim() || cue.cueBy.trim())) &&
        speechPlan.speakers.some((speaker) => speaker.speakerName.trim()),
      tab: "music",
    },
    {
      id: "packing",
      label: "Pack emergency kit",
      helper: `${packedCount}/${packingItems.length} packing items checked`,
      complete: packingItems.some((item) => item.id === "emergency-kit" && item.completed),
      tab: "packing",
    },
    {
      id: "export",
      label: "Export binder",
      helper: "Download the final handoff PDF when the setup items are ready",
      complete: hasExportedBinder,
      tab: "export",
    },
  ];
  const completedCommandItems = commandCenterItems.filter((item) => item.complete).length;
  const binderReadiness = Math.round((completedCommandItems / commandCenterItems.length) * 100);
  const nextCommandItem = commandCenterItems.find((item) => !item.complete) ?? commandCenterItems[commandCenterItems.length - 1];

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
              setup details, vendor contacts, and packing.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                className="gap-2 rounded-full border border-[#D4A373]/70 bg-[#8D294D] text-white shadow-[0_10px_24px_rgba(141,41,77,0.22)] hover:bg-[#762140]"
                onClick={useSavedInfoForBinder}
              >
                <Sparkles className="h-4 w-4" />
                Use saved info
              </Button>
              <Button
                variant="outline"
                className="gap-2 rounded-full border-[#E8C9D4] bg-white/80 text-[#8D294D] hover:bg-[#F7DDE2]"
                onClick={() => setActiveTab(nextCommandItem.tab)}
              >
                <CheckCircle2 className="h-4 w-4" />
                Next: {nextCommandItem.label}
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

      <section className="mt-6 rounded-[1.75rem] border border-[#EBCBD2] bg-white p-4 shadow-[0_14px_35px_rgba(141,41,77,0.08)] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#A65A73]">Today's setup progress</p>
            <h2 className="mt-1 font-serif text-2xl font-bold text-[#4C2730]">
              Your day-of binder is {binderReadiness}% ready.
            </h2>
            <p className="mt-1 text-sm text-[#7B5364]">
              Next: {nextCommandItem.label.toLowerCase()}.
            </p>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-[#F7DDE2] lg:w-64">
            <div
              className="h-full rounded-full bg-[#8D294D] transition-all"
              style={{ width: `${binderReadiness}%` }}
            />
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {commandCenterItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.tab)}
              className={`flex min-h-[5.5rem] items-start gap-3 rounded-2xl border p-4 text-left transition ${
                item.complete
                  ? "border-[#D7E6D4] bg-[#FAFDF9] text-[#4F7142]"
                  : item.id === nextCommandItem.id
                    ? "border-[#8D294D] bg-[#FFF7F2] text-[#4C2730] shadow-[0_10px_24px_rgba(141,41,77,0.10)]"
                    : "border-[#EBCBD2] bg-[#FFFDFC] text-[#4C2730] hover:border-[#D99AAC]"
              }`}
            >
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                  item.complete ? "border-[#6E8D5C] bg-[#6E8D5C] text-white" : "border-[#D9B0BC] bg-white text-[#8D294D]"
                }`}
              >
                {item.complete ? <CheckCircle2 className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-current" />}
              </span>
              <span className="min-w-0">
                <span className="block font-bold">{item.label}</span>
                <span className="mt-1 block text-sm text-[#7B5364]">{item.helper}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {activeWorkspace && activeWorkspace.role !== "owner" && (
        <div className="mt-4 rounded-2xl border border-[#F1D6DD] bg-white px-4 py-3 text-sm text-[#7B5364]">
          You are viewing {coupleFirstNames(activeWorkspace.partner2Name, activeWorkspace.partner1Name)}'s shared wedding workspace.
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

            {activeSection.id === "music" && (
              <>
                <RunbookSectionCard
                  icon={Headphones}
                  title="Sound check and cue owner"
                  helper="Give one person ownership of the music timeline so cues are not scattered."
                  section="music"
                  suggestingSection={suggestingRunbookSection}
                  onGenerate={generateRunbookSuggestion}
                >
                  <div className="grid gap-4 md:grid-cols-3">
                    <FieldLabel label="Prelude starts" hint="Example: 30 minutes before ceremony.">
                      <Input
                        value={musicPlan.preludeStart}
                        onChange={(event) => updateRunbookSection("music", { preludeStart: event.target.value })}
                        className="h-11 rounded-2xl border-[#E8C9D4] bg-white"
                        placeholder="30 minutes before ceremony"
                      />
                    </FieldLabel>
                    <FieldLabel label="Sound check time" hint="Example: 90 minutes before ceremony.">
                      <Input
                        value={musicPlan.soundCheckTime}
                        onChange={(event) => updateRunbookSection("music", { soundCheckTime: event.target.value })}
                        className="h-11 rounded-2xl border-[#E8C9D4] bg-white"
                        placeholder="Before guest arrival"
                      />
                    </FieldLabel>
                    <FieldLabel label="Cue owner" hint="Usually DJ, band leader, or coordinator.">
                      <Input
                        value={musicPlan.cueOwner}
                        onChange={(event) => updateRunbookSection("music", { cueOwner: event.target.value })}
                        className="h-11 rounded-2xl border-[#E8C9D4] bg-white"
                        placeholder="DJ / band lead"
                      />
                    </FieldLabel>
                  </div>
                </RunbookSectionCard>

                {([
                  ["ceremonyCues", "Ceremony cue sheet", "Processional, partner entrance, recessional, and any silence cues."],
                  ["receptionCues", "Reception moments", "Introductions, first dance, parent dances, cake, bouquet, and last song."],
                ] as const).map(([listKey, title, helper]) => (
                  <RunbookSectionCard
                    key={listKey}
                    icon={Music}
                    title={title}
                    helper={helper}
                    section="music"
                    suggestingSection={suggestingRunbookSection}
                    onGenerate={generateRunbookSuggestion}
                  >
                    <div className="mb-4 flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2 rounded-full border-[#E8C9D4] text-[#8D294D]"
                        onClick={() => updateRunbookSection("music", { [listKey]: [...musicPlan[listKey], blankMusicCue()] } as Partial<MusicPlan>)}
                      >
                        <Plus className="h-4 w-4" />
                        Add Cue
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {musicPlan[listKey].map((cue, index) => (
                        <div key={cue.id} className="rounded-2xl border border-[#E8C9D4] bg-[#FFFDFC] p-3">
                          <div className="grid gap-3 lg:grid-cols-[1fr_1.1fr_1fr_1fr_auto] lg:items-start">
                            <FieldLabel label="Moment" hint="Choose the cue moment.">
                              <SelectInput
                                value={cue.moment}
                                options={MUSIC_MOMENTS}
                                onChange={(value) =>
                                  updateRunbookSection("music", {
                                    [listKey]: musicPlan[listKey].map((item, i) => (i === index ? { ...item, moment: value } : item)),
                                  } as Partial<MusicPlan>)
                                }
                              />
                            </FieldLabel>
                            <FieldLabel label="Song" hint="Example: Canon in D, acoustic version.">
                              <Input
                                value={cue.song}
                                onChange={(event) =>
                                  updateRunbookSection("music", {
                                    [listKey]: musicPlan[listKey].map((item, i) => (i === index ? { ...item, song: event.target.value } : item)),
                                  } as Partial<MusicPlan>)
                                }
                                className="h-11 rounded-2xl border-[#E8C9D4] bg-white"
                                placeholder="Song title"
                              />
                            </FieldLabel>
                            <FieldLabel label="Artist / version" hint="Optional, but helpful for DJs.">
                              <Input
                                value={cue.artist}
                                onChange={(event) =>
                                  updateRunbookSection("music", {
                                    [listKey]: musicPlan[listKey].map((item, i) => (i === index ? { ...item, artist: event.target.value } : item)),
                                  } as Partial<MusicPlan>)
                                }
                                className="h-11 rounded-2xl border-[#E8C9D4] bg-white"
                                placeholder="Artist or version"
                              />
                            </FieldLabel>
                            <FieldLabel label="Cue by" hint="Who tells music to start.">
                              <Input
                                value={cue.cueBy}
                                onChange={(event) =>
                                  updateRunbookSection("music", {
                                    [listKey]: musicPlan[listKey].map((item, i) => (i === index ? { ...item, cueBy: event.target.value } : item)),
                                  } as Partial<MusicPlan>)
                                }
                                className="h-11 rounded-2xl border-[#E8C9D4] bg-white"
                                placeholder="Coordinator"
                              />
                            </FieldLabel>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="mt-7 rounded-full text-[#A65A73] hover:bg-destructive/10 hover:text-destructive"
                              onClick={() =>
                                updateRunbookSection("music", {
                                  [listKey]: musicPlan[listKey].filter((item) => item.id !== cue.id),
                                } as Partial<MusicPlan>)
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <details className="mt-3">
                            <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.16em] text-[#A65A73]">
                              Optional cue notes
                            </summary>
                            <Textarea
                              value={cue.notes}
                              onChange={(event) =>
                                updateRunbookSection("music", {
                                  [listKey]: musicPlan[listKey].map((item, i) => (i === index ? { ...item, notes: event.target.value } : item)),
                                } as Partial<MusicPlan>)
                              }
                              className="mt-2 min-h-[72px] resize-none rounded-2xl border-[#E8C9D4] bg-white"
                              placeholder="Example: Fade down after first chorus, wait for doors to open."
                            />
                          </details>
                        </div>
                      ))}
                    </div>
                  </RunbookSectionCard>
                ))}

                <RunbookSectionCard
                  icon={Heart}
                  title="Must-play and do-not-play"
                  helper="Keep song preferences clear without burying them in a note box."
                  section="music"
                  suggestingSection={suggestingRunbookSection}
                  onGenerate={generateRunbookSuggestion}
                >
                  <div className="grid gap-4 lg:grid-cols-2">
                    {([
                      ["mustPlay", "Must play", "Song the couple really wants"],
                      ["doNotPlay", "Do not play", "Song, artist, or genre to avoid"],
                    ] as const).map(([listKey, title, placeholder]) => (
                      <div key={listKey} className="rounded-2xl border border-[#E8C9D4] bg-[#FFF7F2]/60 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="font-bold text-[#4C2730]">{title}</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-2 rounded-full border-[#E8C9D4] text-[#8D294D]"
                            onClick={() =>
                              updateRunbookSection("music", {
                                [listKey]: [...musicPlan[listKey], blankMusicPreference()],
                              } as Partial<MusicPlan>)
                            }
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {musicPlan[listKey].map((song, index) => (
                            <div key={song.id} className="grid gap-2 rounded-2xl bg-white p-3 md:grid-cols-[1fr_auto]">
                              <Input
                                value={song.song}
                                onChange={(event) =>
                                  updateRunbookSection("music", {
                                    [listKey]: musicPlan[listKey].map((item, i) => (i === index ? { ...item, song: event.target.value } : item)),
                                  } as Partial<MusicPlan>)
                                }
                                className="h-10 rounded-xl border-[#E8C9D4]"
                                placeholder={placeholder}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="rounded-full text-[#A65A73] hover:bg-destructive/10 hover:text-destructive"
                                onClick={() =>
                                  updateRunbookSection("music", {
                                    [listKey]: musicPlan[listKey].filter((item) => item.id !== song.id),
                                  } as Partial<MusicPlan>)
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </RunbookSectionCard>
              </>
            )}

            {activeSection.id === "music" && (
              <>
                <RunbookSectionCard
                  icon={Mic2}
                  title="Speaker order"
                  helper="Drag speakers into order and keep time limits visible."
                  section="speeches"
                  suggestingSection={suggestingRunbookSection}
                  onGenerate={generateRunbookSuggestion}
                >
                  <div className="mb-4 grid gap-4 md:grid-cols-3">
                    <FieldLabel label="Toast start" hint="Example: after salads are served.">
                      <Input
                        value={speechPlan.toastStart}
                        onChange={(event) => updateRunbookSection("speeches", { toastStart: event.target.value })}
                        className="h-11 rounded-2xl border-[#E8C9D4]"
                        placeholder="During dinner"
                      />
                    </FieldLabel>
                    <FieldLabel label="Host / introducer" hint="Usually DJ, MC, planner, or parent.">
                      <GuestNameInput
                        value={speechPlan.hostName}
                        onChange={(value) => updateRunbookSection("speeches", { hostName: value })}
                        options={guestNameOptions}
                        placeholder="Who introduces speakers"
                        listId="speech-host-name"
                      />
                    </FieldLabel>
                    <FieldLabel label="Timekeeper" hint="Who gently keeps speeches moving.">
                      <Input
                        value={speechPlan.timekeeper}
                        onChange={(event) => updateRunbookSection("speeches", { timekeeper: event.target.value })}
                        className="h-11 rounded-2xl border-[#E8C9D4]"
                        placeholder="Coordinator or DJ"
                      />
                    </FieldLabel>
                  </div>
                  <div className="mb-4 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 rounded-full border-[#E8C9D4] text-[#8D294D]"
                      onClick={() => updateRunbookSection("speeches", { speakers: [...speechPlan.speakers, blankSpeechSpeaker()] })}
                    >
                      <Plus className="h-4 w-4" />
                      Add Speaker
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {speechPlan.speakers.map((speaker, index) => (
                      <div
                        key={speaker.id}
                        draggable
                        onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          const from = Number(event.dataTransfer.getData("text/plain"));
                          updateRunbookSection("speeches", { speakers: moveItem(speechPlan.speakers, from, index) });
                        }}
                        className="rounded-2xl border border-[#E8C9D4] bg-[#FFFDFC] p-3"
                      >
                        <div className="grid gap-3 lg:grid-cols-[auto_1.1fr_1fr_0.8fr_1fr_auto] lg:items-start">
                          <div className="flex items-center gap-2 pt-2 text-[#A65A73]">
                            <GripVertical className="h-5 w-5" />
                            <span className="text-xs font-bold">{index + 1}</span>
                          </div>
                          <FieldLabel label="Speaker">
                            <GuestNameInput
                              value={speaker.speakerName}
                              onChange={(value) =>
                                updateRunbookSection("speeches", {
                                  speakers: speechPlan.speakers.map((item, i) => (i === index ? { ...item, speakerName: value } : item)),
                                })
                              }
                              options={guestNameOptions}
                              placeholder="Choose or type name"
                              listId={`speaker-name-${speaker.id}`}
                            />
                          </FieldLabel>
                          <FieldLabel label="Role">
                            <SelectInput
                              value={speaker.role}
                              options={SPEECH_ROLES}
                              onChange={(value) =>
                                updateRunbookSection("speeches", {
                                  speakers: speechPlan.speakers.map((item, i) => (i === index ? { ...item, role: value } : item)),
                                })
                              }
                            />
                          </FieldLabel>
                          <FieldLabel label="Limit">
                            <Input
                              value={speaker.duration}
                              onChange={(event) =>
                                updateRunbookSection("speeches", {
                                  speakers: speechPlan.speakers.map((item, i) => (i === index ? { ...item, duration: event.target.value } : item)),
                                })
                              }
                              className="h-11 rounded-2xl border-[#E8C9D4]"
                              placeholder="3 min"
                            />
                          </FieldLabel>
                          <FieldLabel label="Mic">
                            <SelectInput
                              value={speaker.micType}
                              options={MIC_OPTIONS}
                              onChange={(value) =>
                                updateRunbookSection("speeches", {
                                  speakers: speechPlan.speakers.map((item, i) => (i === index ? { ...item, micType: value } : item)),
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
                              updateRunbookSection("speeches", {
                                speakers: speechPlan.speakers.filter((item) => item.id !== speaker.id),
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <details className="mt-3">
                          <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.16em] text-[#A65A73]">
                            Optional speaker notes
                          </summary>
                          <Textarea
                            value={speaker.notes}
                            onChange={(event) =>
                              updateRunbookSection("speeches", {
                                speakers: speechPlan.speakers.map((item, i) => (i === index ? { ...item, notes: event.target.value } : item)),
                              })
                            }
                            className="mt-2 min-h-[72px] resize-none rounded-2xl border-[#E8C9D4] bg-white"
                            placeholder="Example: Walk mic to parent table, remind speaker to toast at the end."
                          />
                        </details>
                      </div>
                    ))}
                  </div>
                </RunbookSectionCard>

                <RunbookSectionCard
                  icon={Headphones}
                  title="Microphone and AV"
                  helper="Structured AV checklist so the speaker moment is ready before dinner."
                  section="speeches"
                  suggestingSection={suggestingRunbookSection}
                  onGenerate={generateRunbookSuggestion}
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <FieldLabel label="Default mic plan" hint="What should be ready for most speakers.">
                      <SelectInput
                        value={speechPlan.micPlan}
                        options={MIC_OPTIONS}
                        onChange={(value) => updateRunbookSection("speeches", { micPlan: value })}
                      />
                    </FieldLabel>
                    <FieldLabel label="Optional notes" hint="Example: projector needed for welcome toast slideshow.">
                      <Input
                        value={speechPlan.notes}
                        onChange={(event) => updateRunbookSection("speeches", { notes: event.target.value })}
                        className="h-11 rounded-2xl border-[#E8C9D4]"
                        placeholder="AV or timing notes"
                      />
                    </FieldLabel>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {speechPlan.avNeeds.map((need) => (
                      <label key={need.id} className="flex items-center gap-3 rounded-2xl border border-[#E8C9D4] bg-[#FFFDFC] px-3 py-2 text-sm font-semibold text-[#4C2730]">
                        <input
                          type="checkbox"
                          checked={need.checked}
                          onChange={(event) =>
                            updateRunbookSection("speeches", {
                              avNeeds: speechPlan.avNeeds.map((item) => (item.id === need.id ? { ...item, checked: event.target.checked } : item)),
                            })
                          }
                          className="h-4 w-4 accent-[#8D294D]"
                        />
                        {need.label}
                      </label>
                    ))}
                  </div>
                </RunbookSectionCard>
              </>
            )}

            {activeSection.id === "setup" && (
              <RunbookSectionCard
                icon={PackageCheck}
                title="Setup task board"
                helper="Assign load-in, decor, room flip, and cleanup tasks with owners and due times."
                section="setup"
                suggestingSection={suggestingRunbookSection}
                onGenerate={generateRunbookSuggestion}
              >
                <div className="grid gap-4 md:grid-cols-4">
                  <FieldLabel label="Load-in starts">
                    <Input value={setupPlan.loadInStart} onChange={(event) => updateRunbookSection("setup", { loadInStart: event.target.value })} className="h-11 rounded-2xl border-[#E8C9D4]" placeholder="8:00 AM" />
                  </FieldLabel>
                  <FieldLabel label="Room flip time">
                    <Input value={setupPlan.roomFlipTime} onChange={(event) => updateRunbookSection("setup", { roomFlipTime: event.target.value })} className="h-11 rounded-2xl border-[#E8C9D4]" placeholder="After ceremony" />
                  </FieldLabel>
                  <FieldLabel label="Venue contact">
                    <Input value={setupPlan.venueContact} onChange={(event) => updateRunbookSection("setup", { venueContact: event.target.value })} className="h-11 rounded-2xl border-[#E8C9D4]" placeholder="Venue manager" />
                  </FieldLabel>
                  <FieldLabel label="Cleanup owner">
                    <Input value={setupPlan.cleanupOwner} onChange={(event) => updateRunbookSection("setup", { cleanupOwner: event.target.value })} className="h-11 rounded-2xl border-[#E8C9D4]" placeholder="Who takes items home" />
                  </FieldLabel>
                </div>
                <div className="mt-5 flex justify-end">
                  <Button type="button" variant="outline" className="gap-2 rounded-full border-[#E8C9D4] text-[#8D294D]" onClick={() => updateRunbookSection("setup", { tasks: [...setupPlan.tasks, blankSetupTask()] })}>
                    <Plus className="h-4 w-4" />
                    Add Setup Task
                  </Button>
                </div>
                <div className="mt-3 space-y-3">
                  {setupPlan.tasks.map((task, index) => (
                    <div key={task.id} className="rounded-2xl border border-[#E8C9D4] bg-[#FFFDFC] p-3">
                      <div className="grid gap-3 lg:grid-cols-[0.9fr_1.3fr_1fr_0.9fr_0.9fr_auto]">
                        <FieldLabel label="Area">
                          <SelectInput value={task.area} options={SETUP_AREAS} onChange={(value) => updateRunbookSection("setup", { tasks: setupPlan.tasks.map((item, i) => (i === index ? { ...item, area: value } : item)) })} />
                        </FieldLabel>
                        <FieldLabel label="Task" hint="Example: place card box on welcome table.">
                          <Input value={task.task} onChange={(event) => updateRunbookSection("setup", { tasks: setupPlan.tasks.map((item, i) => (i === index ? { ...item, task: event.target.value } : item)) })} className="h-11 rounded-2xl border-[#E8C9D4]" placeholder="Setup task" />
                        </FieldLabel>
                        <FieldLabel label="Owner">
                          <Input value={task.owner} onChange={(event) => updateRunbookSection("setup", { tasks: setupPlan.tasks.map((item, i) => (i === index ? { ...item, owner: event.target.value } : item)) })} className="h-11 rounded-2xl border-[#E8C9D4]" placeholder="Person or vendor" />
                        </FieldLabel>
                        <FieldLabel label="Due by">
                          <Input value={task.dueBy} onChange={(event) => updateRunbookSection("setup", { tasks: setupPlan.tasks.map((item, i) => (i === index ? { ...item, dueBy: event.target.value } : item)) })} className="h-11 rounded-2xl border-[#E8C9D4]" placeholder="Before guests arrive" />
                        </FieldLabel>
                        <FieldLabel label="Status">
                          <SelectInput value={task.status} options={SETUP_STATUS} onChange={(value) => updateRunbookSection("setup", { tasks: setupPlan.tasks.map((item, i) => (i === index ? { ...item, status: value } : item)) })} />
                        </FieldLabel>
                        <Button type="button" variant="ghost" size="icon" className="mt-7 rounded-full text-[#A65A73] hover:bg-destructive/10 hover:text-destructive" onClick={() => updateRunbookSection("setup", { tasks: setupPlan.tasks.filter((item) => item.id !== task.id) })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.16em] text-[#A65A73]">
                          Optional setup notes
                        </summary>
                        <Textarea value={task.notes} onChange={(event) => updateRunbookSection("setup", { tasks: setupPlan.tasks.map((item, i) => (i === index ? { ...item, notes: event.target.value } : item)) })} className="mt-2 min-h-[72px] resize-none rounded-2xl border-[#E8C9D4]" placeholder="Optional details: loading dock, rental count, photo reference, or cleanup instruction." />
                      </details>
                    </div>
                  ))}
                </div>
              </RunbookSectionCard>
            )}

            {activeSection.id === "attire" && (
              <>
                <RunbookSectionCard
                  icon={Shirt}
                  title="Getting-ready plan"
                  helper="Keep outfit prep, steaming, and handoffs out of the couple's head."
                  section="attire"
                  suggestingSection={suggestingRunbookSection}
                  onGenerate={generateRunbookSuggestion}
                >
                  <div className="grid gap-4 md:grid-cols-3">
                    <FieldLabel label="Getting-ready location">
                      <Input value={attirePlan.gettingReadyLocation} onChange={(event) => updateRunbookSection("attire", { gettingReadyLocation: event.target.value })} className="h-11 rounded-2xl border-[#E8C9D4]" placeholder="Hotel suite, venue suite..." />
                    </FieldLabel>
                    <FieldLabel label="Attire lead">
                      <GuestNameInput value={attirePlan.attireLead} onChange={(value) => updateRunbookSection("attire", { attireLead: value })} options={guestNameOptions} placeholder="Who owns attire prep" listId="attire-lead" />
                    </FieldLabel>
                    <FieldLabel label="Final steam time">
                      <Input value={attirePlan.finalSteamTime} onChange={(event) => updateRunbookSection("attire", { finalSteamTime: event.target.value })} className="h-11 rounded-2xl border-[#E8C9D4]" placeholder="Before first look" />
                    </FieldLabel>
                  </div>
                </RunbookSectionCard>

                <RunbookSectionCard
                  icon={ListChecks}
                  title="Outfit checklist"
                  helper="Track each item, who owns it, and whether it is packed."
                  section="attire"
                  suggestingSection={suggestingRunbookSection}
                  onGenerate={generateRunbookSuggestion}
                >
                  <div className="mb-4 flex justify-end">
                    <Button type="button" variant="outline" className="gap-2 rounded-full border-[#E8C9D4] text-[#8D294D]" onClick={() => updateRunbookSection("attire", { items: [...attirePlan.items, blankAttireItem()] })}>
                      <Plus className="h-4 w-4" />
                      Add Item
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {attirePlan.items.map((item, index) => (
                      <div key={item.id} className="rounded-2xl border border-[#E8C9D4] bg-[#FFFDFC] p-3">
                        <div className="grid gap-3 lg:grid-cols-[auto_1fr_1fr_1fr_1fr_auto]">
                          <label className="mt-8 flex items-center gap-2 text-sm font-bold text-[#4C2730]">
                            <input type="checkbox" checked={item.packed} onChange={(event) => updateRunbookSection("attire", { items: attirePlan.items.map((entry, i) => (i === index ? { ...entry, packed: event.target.checked } : entry)) })} className="h-4 w-4 accent-[#8D294D]" />
                            Packed
                          </label>
                          <FieldLabel label="Person">
                            <GuestNameInput value={item.personName} onChange={(value) => updateRunbookSection("attire", { items: attirePlan.items.map((entry, i) => (i === index ? { ...entry, personName: value } : entry)) })} options={guestNameOptions} placeholder="Name" listId={`attire-person-${item.id}`} />
                          </FieldLabel>
                          <FieldLabel label="Item">
                            <Input value={item.item} onChange={(event) => updateRunbookSection("attire", { items: attirePlan.items.map((entry, i) => (i === index ? { ...entry, item: event.target.value } : entry)) })} className="h-11 rounded-2xl border-[#E8C9D4]" placeholder="Dress, shoes, veil..." />
                          </FieldLabel>
                          <FieldLabel label="Location">
                            <Input value={item.location} onChange={(event) => updateRunbookSection("attire", { items: attirePlan.items.map((entry, i) => (i === index ? { ...entry, location: event.target.value } : entry)) })} className="h-11 rounded-2xl border-[#E8C9D4]" placeholder="Suite, bag, car..." />
                          </FieldLabel>
                          <FieldLabel label="Owner">
                            <Input value={item.owner} onChange={(event) => updateRunbookSection("attire", { items: attirePlan.items.map((entry, i) => (i === index ? { ...entry, owner: event.target.value } : entry)) })} className="h-11 rounded-2xl border-[#E8C9D4]" placeholder="Who carries it" />
                          </FieldLabel>
                          <Button type="button" variant="ghost" size="icon" className="mt-7 rounded-full text-[#A65A73] hover:bg-destructive/10 hover:text-destructive" onClick={() => updateRunbookSection("attire", { items: attirePlan.items.filter((entry) => entry.id !== item.id) })}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </RunbookSectionCard>

                <RunbookSectionCard
                  icon={PackageCheck}
                  title="Emergency kit"
                  helper="Quick checkboxes for the most common outfit fixes."
                  section="attire"
                  suggestingSection={suggestingRunbookSection}
                  onGenerate={generateRunbookSuggestion}
                >
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {attirePlan.emergencyKit.map((kitItem) => (
                      <label key={kitItem.id} className="flex items-center gap-3 rounded-2xl border border-[#E8C9D4] bg-[#FFFDFC] px-3 py-2 text-sm font-semibold text-[#4C2730]">
                        <input type="checkbox" checked={kitItem.checked} onChange={(event) => updateRunbookSection("attire", { emergencyKit: attirePlan.emergencyKit.map((entry) => (entry.id === kitItem.id ? { ...entry, checked: event.target.checked } : entry)) })} className="h-4 w-4 accent-[#8D294D]" />
                        {kitItem.label}
                      </label>
                    ))}
                  </div>
                </RunbookSectionCard>
              </>
            )}

            {activeSection.id === "vendors-party" && (
              <>
                <RunbookSectionCard
                  icon={PhoneCall}
                  title="Vendor contact sheet"
                  helper="A day-of-only contact page: names, phone numbers, arrival times, and payment reminders."
                  section="vendors-party"
                  suggestingSection={suggestingRunbookSection}
                  onGenerate={generateRunbookSuggestion}
                >
                  <div className="mb-4 flex flex-wrap justify-end gap-2">
                    <Button type="button" variant="outline" className="gap-2 rounded-full border-[#E8C9D4] text-[#8D294D]" onClick={useSavedVendorsForBinder}>
                      <Sparkles className="h-4 w-4" />
                      Use Saved Vendors
                    </Button>
                    <Button type="button" className="gap-2 rounded-full bg-[#8D294D] hover:bg-[#7a2140]" onClick={() => updateVendorParty({ vendors: [...vendorsPartyPlan.vendors, blankVendorContact()] })}>
                      <Plus className="h-4 w-4" />
                      Add Vendor Contact
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {vendorsPartyPlan.vendors.map((vendor, index) => (
                      <div key={vendor.id} className="rounded-2xl border border-[#E8C9D4] bg-[#FFFDFC] p-3">
                        <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr_1fr_0.9fr_0.9fr_1fr_auto]">
                          <FieldLabel label="Vendor">
                            <Input value={vendor.vendorName} onChange={(event) => updateVendorParty({ vendors: vendorsPartyPlan.vendors.map((entry, i) => (i === index ? { ...entry, vendorName: event.target.value } : entry)) })} className="h-11 rounded-2xl border-[#E8C9D4]" placeholder="Vendor name" />
                          </FieldLabel>
                          <FieldLabel label="Category">
                            <Input value={vendor.category} onChange={(event) => updateVendorParty({ vendors: vendorsPartyPlan.vendors.map((entry, i) => (i === index ? { ...entry, category: event.target.value } : entry)) })} className="h-11 rounded-2xl border-[#E8C9D4]" placeholder="Florist, DJ..." />
                          </FieldLabel>
                          <FieldLabel label="Lead">
                            <Input value={vendor.leadName} onChange={(event) => updateVendorParty({ vendors: vendorsPartyPlan.vendors.map((entry, i) => (i === index ? { ...entry, leadName: event.target.value } : entry)) })} className="h-11 rounded-2xl border-[#E8C9D4]" placeholder="Contact name" />
                          </FieldLabel>
                          <FieldLabel label="Phone">
                            <Input value={vendor.phone} onChange={(event) => updateVendorParty({ vendors: vendorsPartyPlan.vendors.map((entry, i) => (i === index ? { ...entry, phone: event.target.value } : entry)) })} className="h-11 rounded-2xl border-[#E8C9D4]" placeholder="Phone" />
                          </FieldLabel>
                          <FieldLabel label="Arrival">
                            <Input value={vendor.arrivalTime} onChange={(event) => updateVendorParty({ vendors: vendorsPartyPlan.vendors.map((entry, i) => (i === index ? { ...entry, arrivalTime: event.target.value } : entry)) })} className="h-11 rounded-2xl border-[#E8C9D4]" placeholder="10:00 AM" />
                          </FieldLabel>
                          <FieldLabel label="Payment">
                            <SelectInput value={vendor.paymentStatus} options={VENDOR_PAYMENT_STATUSES} onChange={(value) => updateVendorParty({ vendors: vendorsPartyPlan.vendors.map((entry, i) => (i === index ? { ...entry, paymentStatus: value } : entry)) })} />
                          </FieldLabel>
                          <Button type="button" variant="ghost" size="icon" className="mt-7 rounded-full text-[#A65A73] hover:bg-destructive/10 hover:text-destructive" onClick={() => updateVendorParty({ vendors: vendorsPartyPlan.vendors.filter((entry) => entry.id !== vendor.id) })}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <Textarea value={vendor.notes} onChange={(event) => updateVendorParty({ vendors: vendorsPartyPlan.vendors.map((entry, i) => (i === index ? { ...entry, notes: event.target.value } : entry)) })} className="mt-3 min-h-[72px] resize-none rounded-2xl border-[#E8C9D4]" placeholder="Access notes, final count, setup instruction, tip envelope, or emergency backup." />
                      </div>
                    ))}
                    {vendorsPartyPlan.vendors.length === 0 && (
                      <p className="rounded-2xl border border-dashed border-[#E8C9D4] bg-[#FFF7F2] px-4 py-5 text-center text-sm text-[#7B5364]">
                        Add day-of contacts manually or pull from your saved Vendor List.
                      </p>
                    )}
                  </div>
                </RunbookSectionCard>

                <RunbookSectionCard
                  icon={UsersRound}
                  title="Wedding party responsibilities"
                  helper="Assign who handles rings, calls, gifts, bustle, family photos, and end-of-night handoffs."
                  section="vendors-party"
                  suggestingSection={suggestingRunbookSection}
                  onGenerate={generateRunbookSuggestion}
                >
                  <div className="mb-4 flex justify-end">
                    <Button type="button" variant="outline" className="gap-2 rounded-full border-[#E8C9D4] text-[#8D294D]" onClick={() => updateVendorParty({ party: [...vendorsPartyPlan.party, blankPartyContact()] })}>
                      <Plus className="h-4 w-4" />
                      Add Person
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {vendorsPartyPlan.party.map((person, index) => (
                      <div key={person.id} className="grid gap-3 rounded-2xl border border-[#E8C9D4] bg-[#FFFDFC] p-3 lg:grid-cols-[1fr_0.9fr_0.9fr_0.9fr_1.4fr_auto]">
                        <FieldLabel label="Person">
                          <GuestNameInput value={person.personName} onChange={(value) => updateVendorParty({ party: vendorsPartyPlan.party.map((entry, i) => (i === index ? { ...entry, personName: value } : entry)) })} options={guestNameOptions} placeholder="Name" listId={`party-person-${person.id}`} />
                        </FieldLabel>
                        <FieldLabel label="Role">
                          <Input value={person.role} onChange={(event) => updateVendorParty({ party: vendorsPartyPlan.party.map((entry, i) => (i === index ? { ...entry, role: event.target.value } : entry)) })} className="h-11 rounded-2xl border-[#E8C9D4]" placeholder="Maid of Honor" />
                        </FieldLabel>
                        <FieldLabel label="Phone">
                          <Input value={person.phone} onChange={(event) => updateVendorParty({ party: vendorsPartyPlan.party.map((entry, i) => (i === index ? { ...entry, phone: event.target.value } : entry)) })} className="h-11 rounded-2xl border-[#E8C9D4]" placeholder="Phone" />
                        </FieldLabel>
                        <FieldLabel label="Arrival">
                          <Input value={person.arrivalTime} onChange={(event) => updateVendorParty({ party: vendorsPartyPlan.party.map((entry, i) => (i === index ? { ...entry, arrivalTime: event.target.value } : entry)) })} className="h-11 rounded-2xl border-[#E8C9D4]" placeholder="9:00 AM" />
                        </FieldLabel>
                        <FieldLabel label="Duty">
                          <Input value={person.duty} onChange={(event) => updateVendorParty({ party: vendorsPartyPlan.party.map((entry, i) => (i === index ? { ...entry, duty: event.target.value } : entry)) })} className="h-11 rounded-2xl border-[#E8C9D4]" placeholder="Family photos, rings, gifts..." />
                        </FieldLabel>
                        <Button type="button" variant="ghost" size="icon" className="mt-7 rounded-full text-[#A65A73] hover:bg-destructive/10 hover:text-destructive" onClick={() => updateVendorParty({ party: vendorsPartyPlan.party.filter((entry) => entry.id !== person.id) })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <FieldLabel label="Handoff notes" hint="Tell helpers who to call before interrupting the couple.">
                    <Textarea value={vendorsPartyPlan.handoffNotes} onChange={(event) => updateVendorParty({ handoffNotes: event.target.value })} className="mt-4 min-h-[92px] resize-none rounded-2xl border-[#E8C9D4]" placeholder="Example: Venue issues go to coordinator first. Family photo questions go to maid of honor." />
                  </FieldLabel>
                </RunbookSectionCard>
              </>
            )}
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

        {activeTab === "export" && (
          <section className="space-y-4">
            <div className="rounded-[1.75rem] border border-[#EBCBD2] bg-white p-5 shadow-[0_12px_28px_rgba(141,41,77,0.08)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl bg-[#F7DDE2] p-3 text-[#8D294D]">
                    <Download className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#A65A73]">Final step</p>
                    <h2 className="font-serif text-3xl font-bold text-[#4C2730]">Export Binder</h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-[#7B5364]">
                      Download the handoff PDF after the main setup sections are filled in. Use the timeline-only export when a vendor just needs the schedule.
                    </p>
                  </div>
                </div>
                <div className="rounded-full bg-[#F7DDE2] px-4 py-2 text-sm font-bold text-[#8D294D]">
                  {binderReadiness}% ready
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
              <div className="rounded-[1.75rem] border border-[#EBCBD2] bg-white p-5 shadow-[0_12px_28px_rgba(141,41,77,0.08)]">
                <h3 className="font-serif text-2xl font-bold text-[#4C2730]">Before exporting</h3>
                <div className="mt-4 space-y-3">
                  {commandCenterItems.filter((item) => item.id !== "export").map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.tab)}
                      className="flex w-full items-start gap-3 rounded-2xl border border-[#EBCBD2] bg-[#FFFDFC] p-3 text-left hover:border-[#D99AAC]"
                    >
                      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${item.complete ? "bg-[#6E8D5C] text-white" : "bg-[#F7DDE2] text-[#8D294D]"}`}>
                        {item.complete ? <CheckCircle2 className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-current" />}
                      </span>
                      <span>
                        <span className="block font-bold text-[#4C2730]">{item.label}</span>
                        <span className="block text-sm text-[#7B5364]">{item.helper}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 rounded-[1.75rem] border border-[#EBCBD2] bg-[#FFF9F5] p-5 shadow-[0_12px_28px_rgba(141,41,77,0.08)]">
                <Button
                  className="h-auto w-full justify-center gap-2 rounded-2xl bg-[#8D294D] px-4 py-4 text-base hover:bg-[#7a2140]"
                  onClick={handleDownloadBinderPdf}
                  disabled={isExportingBinderPdf}
                >
                  <Download className="h-5 w-5" />
                  {isExportingBinderPdf ? "Exporting..." : "Export Full Binder"}
                </Button>
                <Button
                  variant="outline"
                  className="h-auto w-full justify-center gap-2 rounded-2xl border-[#E8C9D4] bg-white px-4 py-4 text-base text-[#8D294D] hover:bg-[#F7DDE2]"
                  onClick={handleDownloadTimelinePdf}
                  disabled={!editableEvents.length || isExportingTimelinePdf}
                >
                  <FileDown className="h-5 w-5" />
                  {isExportingTimelinePdf ? "Exporting..." : "Export Timeline Only"}
                </Button>
                <p className="text-sm leading-6 text-[#7B5364]">
                  The full binder includes timeline, ceremony, music, speeches, setup, vendor contacts, and packing checklist.
                </p>
              </div>
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
