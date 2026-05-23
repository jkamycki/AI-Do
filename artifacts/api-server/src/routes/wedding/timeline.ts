import { Router } from "express";
import { db } from "@workspace/db";
import { timelines, weddingProfiles } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { openai, getModel } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../../middlewares/requireAuth";
import { trackEvent } from "../../lib/trackEvent";
import { logActivity, resolveProfile, resolveCallerRole, hasMinRole } from "../../lib/workspaceAccess";
import { getRequestLanguage } from "../../lib/language";

const router = Router();
const DEFAULT_TIMELINE_AI_TIMEOUT_MS = 8_000;
const MAX_TIMELINE_AI_TIMEOUT_MS = 15_000;

type TimelineBlock = {
  id: string;
  startTime: string;
  endTime: string;
  title: string;
  description: string;
  category: string;
  location: string;
  notes: string;
};

function timelineAiTimeoutMs(): number {
  const raw = Number(process.env.TIMELINE_AI_TIMEOUT_MS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TIMELINE_AI_TIMEOUT_MS;
  return Math.min(MAX_TIMELINE_AI_TIMEOUT_MS, Math.max(3_000, Math.round(raw)));
}

function normalizeTimelineBlocks(value: unknown): TimelineBlock[] {
  if (!Array.isArray(value)) return [];
  return value.map((event, index) => {
    const row = event && typeof event === "object" ? event as Record<string, unknown> : {};
    return {
      ...row,
      id: String(row.id ?? `block-${index + 1}`),
      startTime: String(row.startTime ?? ""),
      endTime: String(row.endTime ?? ""),
      title: String(row.title ?? ""),
      description: String(row.description ?? ""),
      category: String(row.category ?? "other"),
      location: String(row.location ?? ""),
      notes: String(row.notes ?? ""),
    } as TimelineBlock;
  });
}

function parseTimeToMinutes(value: string | null | undefined, fallback: number): number {
  if (!value) return fallback;
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return fallback;
  return Math.max(0, Math.min(23 * 60 + 59, hours * 60 + minutes));
}

function minutesToTime(total: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(total)));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function makeTimelineBlock(
  id: number,
  start: number,
  end: number,
  title: string,
  description: string,
  category: string,
  location: string,
  notes = "",
): TimelineBlock {
  return {
    id: `block-${id}`,
    startTime: minutesToTime(start),
    endTime: minutesToTime(Math.max(start + 15, end)),
    title,
    description,
    category,
    location,
    notes,
  };
}

function eventDuration(event: TimelineBlock): number {
  const start = parseTimeToMinutes(event.startTime, 8 * 60);
  const end = parseTimeToMinutes(event.endTime, start + 60);
  return Math.max(15, end - start);
}

function normalizePrompt(value: string): string {
  return value.toLowerCase().replace(/[^\w\s:.-]/g, " ").replace(/\s+/g, " ").trim();
}

const TIMELINE_INTENT_ALIASES: Array<{ key: string; pattern: RegExp; title: string; category: string }> = [
  { key: "hair_makeup", pattern: /\b(hair|make\s*up|make-up|makeup|getting ready|glam|beauty)\b/i, title: "Hair, makeup, and getting ready", category: "preparation" },
  { key: "vendor_setup", pattern: /\b(vendor|setup|set up|load in|arrival|arrivals|florist|dj|caterer|photo|video)\b/i, title: "Vendor arrivals and setup", category: "vendors" },
  { key: "first_look", pattern: /\b(first look|private look|couple portrait|portrait)\b/i, title: "Couple portraits and first look", category: "photos" },
  { key: "wedding_party_photos", pattern: /\b(wedding party photos|bridal party photos|group photos)\b/i, title: "Wedding party photos", category: "photos" },
  { key: "guest_arrival", pattern: /\b(guest arrival|guests arrive|prelude|seating)\b/i, title: "Guest arrival", category: "ceremony" },
  { key: "ceremony", pattern: /\b(ceremony|vows|processional|recessional)\b/i, title: "Ceremony", category: "ceremony" },
  { key: "cocktail", pattern: /\b(cocktail|cocktail hour)\b/i, title: "Cocktail hour", category: "cocktail" },
  { key: "dinner", pattern: /\b(dinner|meal|dinner service|reception dinner)\b/i, title: "Dinner service", category: "reception" },
  { key: "toasts", pattern: /\b(toast|toasts|speech|speeches)\b/i, title: "Toasts and special dances", category: "reception" },
  { key: "cake", pattern: /\b(cake|cake cutting|dessert)\b/i, title: "Cake cutting", category: "reception" },
  { key: "dancing", pattern: /\b(dance|dancing|party|open dance floor)\b/i, title: "Open dancing and celebration", category: "dancing" },
  { key: "sendoff", pattern: /\b(sendoff|send off|exit|last song|private last dance)\b/i, title: "Final song and send-off", category: "dancing" },
];

function aliasForText(text: string) {
  return TIMELINE_INTENT_ALIASES.find(alias => alias.pattern.test(text));
}

function eventMatchesAlias(event: TimelineBlock, alias: { pattern: RegExp; category: string }): boolean {
  const haystack = `${event.title} ${event.description} ${event.category}`.toLowerCase();
  return alias.pattern.test(haystack);
}

function findEventIndex(events: TimelineBlock[], text: string): number {
  const alias = aliasForText(text);
  if (alias) return events.findIndex(event => eventMatchesAlias(event, alias));
  const normalized = normalizePrompt(text);
  if (!normalized) return -1;
  return events.findIndex(event => normalizePrompt(`${event.title} ${event.description} ${event.category}`).includes(normalized));
}

function isHairMakeupEvent(event: TimelineBlock): boolean {
  const alias = TIMELINE_INTENT_ALIASES[0];
  return eventMatchesAlias(event, alias);
}

function promptSaysMakeupNotFirst(vision: string): boolean {
  return /\b(?:do\s*not|don't|dont|no|avoid|stop)\b[\s\S]{0,50}\b(?:hair|make\s*up|make-up|makeup|getting ready|glam)\b[\s\S]{0,35}\bfirst\b/i.test(vision)
    || /\b(?:hair|make\s*up|make-up|makeup|getting ready|glam)\b[\s\S]{0,35}\b(?:not|never|shouldn'?t)\b[\s\S]{0,35}\bfirst\b/i.test(vision);
}

function parsePromptTime(rawHour: string, rawMinute?: string, meridiem?: string): number {
  let hour = Number(rawHour);
  const minute = rawMinute ? Number(rawMinute) : 0;
  const ampm = meridiem?.toLowerCase();
  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
  return Math.max(0, Math.min(23 * 60 + 59, hour * 60 + minute));
}

function extractAddRequests(vision: string): Array<{ label: string; time?: number }> {
  const requests: Array<{ label: string; time?: number }> = [];
  const re = /\b(?:add|include|put in|make sure there is|make sure to have)\s+(.{3,70}?)(?:\s+(?:at|around)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?(?:[.!?]|$)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(vision))) {
    const label = match[1]?.trim().replace(/\s+/g, " ");
    if (!label) continue;
    requests.push({
      label,
      time: match[2] ? parsePromptTime(match[2], match[3], match[4]) : undefined,
    });
  }
  return requests;
}

function applyTimeMoveInstructions(events: TimelineBlock[], vision: string): TimelineBlock[] {
  const moved = events.map(event => ({ ...event }));
  const re = /\b(?:move|put|schedule|start|set)\s+(.{3,60}?)\s+(?:at|to|for)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(vision))) {
    const label = match[1]?.trim() ?? "";
    const idx = findEventIndex(moved, label);
    if (idx < 0) continue;
    const start = parsePromptTime(match[2], match[3], match[4]);
    const duration = eventDuration(moved[idx]);
    moved[idx].startTime = minutesToTime(start);
    moved[idx].endTime = minutesToTime(start + duration);
    moved[idx].notes = [moved[idx].notes, `Time adjusted from prompt: ${match[0]}.`].filter(Boolean).join(" ");
  }
  return moved.sort((a, b) => parseTimeToMinutes(a.startTime, 0) - parseTimeToMinutes(b.startTime, 0));
}

function moveEventToIndex(events: TimelineBlock[], fromIndex: number, toIndex: number, note: string): TimelineBlock[] {
  if (fromIndex === toIndex || fromIndex < 0) return events;
  const ordered = events.map(event => ({ ...event }));
  const [target] = ordered.splice(fromIndex, 1);
  if (!target) return ordered;
  const clampedToIndex = Math.max(0, Math.min(toIndex, ordered.length));
  ordered.splice(clampedToIndex, 0, target);

  const firstRetimedIndex = Math.min(fromIndex, clampedToIndex);
  const lastRetimedIndex = Math.max(fromIndex, clampedToIndex);
  let cursor = parseTimeToMinutes(events[firstRetimedIndex]?.startTime, parseTimeToMinutes(target.startTime, 8 * 60));
  for (let index = firstRetimedIndex; index <= lastRetimedIndex; index += 1) {
    const event = ordered[index];
    if (!event) continue;
    const duration = eventDuration(event);
    event.startTime = minutesToTime(cursor);
    event.endTime = minutesToTime(cursor + duration);
    cursor += duration;
  }

  target.notes = [target.notes, note].filter(Boolean).join(" ");
  return ordered.sort((a, b) => parseTimeToMinutes(a.startTime, 0) - parseTimeToMinutes(b.startTime, 0));
}

function applyDurationInstructions(events: TimelineBlock[], vision: string): TimelineBlock[] {
  const adjusted = events.map(event => ({ ...event }));
  const durationPatterns = [
    /\b(?:make|set|change)\s+(.{3,70}?)\s+(?:duration\s+)?(?:to|for)\s+(\d{1,3})\s*(?:minutes?|mins?)\b/gi,
    /\b(?:make|set|change)\s+(.{3,70}?)\s+(\d{1,3})\s*(?:minutes?|mins?)\b/gi,
    /\b(?:shorten|extend|lengthen)\s+(.{3,70}?)\s+(?:to|for)\s+(\d{1,3})\s*(?:minutes?|mins?)\b/gi,
  ];

  for (const re of durationPatterns) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(vision))) {
      const label = match[1]?.trim() ?? "";
      const idx = findEventIndex(adjusted, label);
      if (idx < 0) continue;
      const duration = Math.max(15, Math.min(240, Number(match[2])));
      const start = parseTimeToMinutes(adjusted[idx].startTime, 8 * 60);
      adjusted[idx].endTime = minutesToTime(start + duration);
      adjusted[idx].notes = [adjusted[idx].notes, `Duration adjusted from prompt: ${match[0]}.`].filter(Boolean).join(" ");
    }
  }

  return adjusted.sort((a, b) => parseTimeToMinutes(a.startTime, 0) - parseTimeToMinutes(b.startTime, 0));
}

function applyRelativeMoveInstructions(events: TimelineBlock[], vision: string): TimelineBlock[] {
  let ordered = events.map(event => ({ ...event }));
  const earlyRe = /\b(?:move|put|schedule|start|shift)\s+(.{3,70}?)\s+(?:to\s+)?(?:much\s+)?(?:earlier in the day|earlier|early|up|sooner)\b/gi;
  let match: RegExpExecArray | null;

  while ((match = earlyRe.exec(vision))) {
    const label = match[1]?.trim() ?? "";
    const idx = findEventIndex(ordered, label);
    if (idx <= 0) continue;
    const toIndex = /early|earlier in the day|sooner/i.test(match[0])
      ? Math.max(1, idx - 2)
      : idx - 1;
    ordered = moveEventToIndex(ordered, idx, toIndex, `Moved earlier from prompt: ${match[0]}.`);
  }

  const laterRe = /\b(?:move|put|schedule|start|shift)\s+(.{3,70}?)\s+(?:to\s+)?(?:much\s+)?(?:later in the day|later|back)\b/gi;
  while ((match = laterRe.exec(vision))) {
    const label = match[1]?.trim() ?? "";
    const idx = findEventIndex(ordered, label);
    if (idx < 0 || idx >= ordered.length - 1) continue;
    const toIndex = /later in the day/i.test(match[0])
      ? Math.min(ordered.length - 1, idx + 2)
      : idx + 1;
    ordered = moveEventToIndex(ordered, idx, toIndex, `Moved later from prompt: ${match[0]}.`);
  }

  const beforeRe = /\b(?:move|put|schedule|start|shift)\s+(.{3,70}?)\s+(?:before|ahead of)\s+(.{3,70}?)(?:[.!?]|$)/gi;
  while ((match = beforeRe.exec(vision))) {
    const label = match[1]?.trim() ?? "";
    const referenceLabel = match[2]?.trim() ?? "";
    const idx = findEventIndex(ordered, label);
    const referenceIndex = findEventIndex(ordered, referenceLabel);
    if (idx < 0 || referenceIndex < 0) continue;
    const toIndex = idx < referenceIndex ? referenceIndex - 1 : referenceIndex;
    if (idx === toIndex) continue;
    ordered = moveEventToIndex(ordered, idx, toIndex, `Moved before ${ordered[referenceIndex]?.title ?? referenceLabel} from prompt: ${match[0]}.`);
  }

  const afterRe = /\b(?:move|put|schedule|start|shift)\s+(.{3,70}?)\s+(?:after|behind|following)\s+(.{3,70}?)(?:[.!?]|$)/gi;
  while ((match = afterRe.exec(vision))) {
    const label = match[1]?.trim() ?? "";
    const referenceLabel = match[2]?.trim() ?? "";
    const idx = findEventIndex(ordered, label);
    const referenceIndex = findEventIndex(ordered, referenceLabel);
    if (idx < 0 || referenceIndex < 0) continue;
    const toIndex = idx < referenceIndex ? referenceIndex : referenceIndex + 1;
    if (idx === toIndex) continue;
    ordered = moveEventToIndex(ordered, idx, toIndex, `Moved after ${ordered[referenceIndex]?.title ?? referenceLabel} from prompt: ${match[0]}.`);
  }

  return ordered;
}

function applyRemovalInstructions(events: TimelineBlock[], vision: string): TimelineBlock[] {
  const removals: string[] = [];
  const re = /\b(?:remove|delete|skip|do\s*not include|don't include|dont include|no)\s+(.{3,55}?)(?:[.!?]|$)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(vision))) {
    const label = match[1]?.trim() ?? "";
    if (/\bfirst\b/i.test(label)) continue;
    removals.push(label);
  }
  if (!removals.length) return events;
  return events.filter(event => !removals.some(label => {
    const alias = aliasForText(label);
    if (alias) return eventMatchesAlias(event, alias);
    return normalizePrompt(`${event.title} ${event.description}`).includes(normalizePrompt(label));
  }));
}

function applyPutFirstInstructions(events: TimelineBlock[], vision: string): TimelineBlock[] {
  const match = vision.match(/\b(?:put|start with|make|have)\s+(.{3,60}?)\s+first\b/i);
  const label = match?.[1]?.trim();
  if (!label) return events;
  const ordered = events.map(event => ({ ...event }));
  const idx = findEventIndex(ordered, label);
  if (idx <= 0) return ordered;
  const [target] = ordered.splice(idx, 1);
  const firstStart = parseTimeToMinutes(ordered[0]?.startTime, parseTimeToMinutes(target.startTime, 8 * 60));
  const targetDuration = eventDuration(target);
  target.startTime = minutesToTime(firstStart);
  target.endTime = minutesToTime(firstStart + targetDuration);
  target.notes = [target.notes, `Moved first from prompt: ${match[0]}.`].filter(Boolean).join(" ");
  ordered.unshift(target);
  return ordered;
}

function applyOrderingInstructions(events: TimelineBlock[], dayVision?: string): TimelineBlock[] {
  const vision = (dayVision ?? "").trim();
  if (!vision || events.length < 2) return events;
  let ordered = applyPutFirstInstructions(events, vision);
  ordered = applyRemovalInstructions(ordered, vision);
  ordered = applyRelativeMoveInstructions(ordered, vision);
  ordered = applyTimeMoveInstructions(ordered, vision);
  ordered = applyDurationInstructions(ordered, vision);
  if (!promptSaysMakeupNotFirst(vision) || ordered.length < 2) return ordered;

  const firstMakeupIndex = ordered.findIndex(isHairMakeupEvent);
  if (firstMakeupIndex === 0) {
    const makeupEvent = ordered[firstMakeupIndex];
    const nextNonMakeupIndex = ordered.findIndex((event, index) => index > firstMakeupIndex && !isHairMakeupEvent(event));
    if (!makeupEvent || nextNonMakeupIndex === -1) return ordered;

    const firstStart = parseTimeToMinutes(makeupEvent.startTime, 8 * 60);
    const makeupDuration = eventDuration(makeupEvent);
    const nextEvent = ordered[nextNonMakeupIndex];
    const nextDuration = eventDuration(nextEvent);

    ordered.splice(firstMakeupIndex, 1);
    ordered.splice(nextNonMakeupIndex, 0, makeupEvent);

    const newFirst = ordered[0];
    newFirst.startTime = minutesToTime(firstStart);
    newFirst.endTime = minutesToTime(firstStart + nextDuration);
    makeupEvent.startTime = minutesToTime(firstStart + nextDuration);
    makeupEvent.endTime = minutesToTime(firstStart + nextDuration + makeupDuration);
    makeupEvent.notes = [
      makeupEvent.notes,
      "Moved later because the latest prompt asked not to start the timeline with hair or makeup.",
    ].filter(Boolean).join(" ");
  }

  return ordered;
}

function applyAddInstructions(events: TimelineBlock[], dayVision?: string): TimelineBlock[] {
  const vision = (dayVision ?? "").trim();
  if (!vision) return events;
  const additions = extractAddRequests(vision);
  if (!additions.length) return events;
  const nextId = () => `block-added-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const output = events.map(event => ({ ...event }));
  for (const addition of additions) {
    if (findEventIndex(output, addition.label) >= 0) continue;
    const alias = aliasForText(addition.label);
    const fallbackStart = output.length
      ? parseTimeToMinutes(output[output.length - 1].endTime, 20 * 60)
      : 8 * 60;
    const start = addition.time ?? fallbackStart;
    output.push({
      id: nextId(),
      startTime: minutesToTime(start),
      endTime: minutesToTime(start + 30),
      title: alias?.title ?? addition.label.replace(/\b\w/g, (letter) => letter.toUpperCase()).slice(0, 80),
      description: `Added from prompt: ${addition.label}.`,
      category: alias?.category ?? "other",
      location: output[0]?.location ?? "Wedding venue",
      notes: "Added because the latest prompt requested it.",
    });
  }
  return output.sort((a, b) => parseTimeToMinutes(a.startTime, 0) - parseTimeToMinutes(b.startTime, 0));
}

function extractVenueOverride(dayVision?: string): string | null {
  const vision = (dayVision ?? "").trim();
  if (!vision) return null;

  const patterns = [
    /\b(?:at|on|for|in)\s+(?:the\s+)?([A-Z][A-Za-z0-9'&.\-\s]{2,80}?(?:estate|manor|venue|hotel|hall|garden|gardens|barn|farm|club|resort|winery|vineyard|house|inn|museum|loft|terrace|castle|chapel|church|beach|ballroom))\b/i,
    /\b(?:venue|location)\s*(?:is|:|-)\s*([A-Za-z0-9'&.\-\s]{2,80})$/i,
  ];

  for (const pattern of patterns) {
    const match = vision.match(pattern);
    const raw = match?.[1]?.trim();
    if (raw) {
      return raw
        .replace(/[.!,;:]$/g, "")
        .replace(/\s+/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
    }
  }

  return null;
}

function applyDayVisionToTimeline(
  events: TimelineBlock[],
  dayVision?: string,
  savedVenue?: string | null,
): TimelineBlock[] {
  const vision = (dayVision ?? "").trim();
  if (!vision) return events;
  const lower = vision.toLowerCase();
  const venueOverride = extractVenueOverride(vision);
  const enhanced = events.map((event) => ({ ...event }));

  if (venueOverride) {
    const savedVenuePattern = savedVenue?.trim()
      ? new RegExp(escapeRegExp(savedVenue.trim()), "gi")
      : null;
    for (const event of enhanced) {
      const currentLocation = String(event.location ?? "").trim();
      if (!currentLocation || !savedVenue || currentLocation.toLowerCase() === savedVenue.toLowerCase()) {
        event.location = venueOverride;
      } else if (savedVenuePattern && currentLocation.match(savedVenuePattern)) {
        event.location = currentLocation.replace(savedVenuePattern, venueOverride);
      }
      event.description = savedVenuePattern
        ? String(event.description ?? "").replace(savedVenuePattern, venueOverride)
        : String(event.description ?? "");
      event.notes = savedVenuePattern
        ? String(event.notes ?? "").replace(savedVenuePattern, venueOverride)
        : String(event.notes ?? "");
    }
  }

  const appendNote = (category: string, note: string) => {
    const target = enhanced.find(event => event.category === category) ?? enhanced[0];
    if (!target) return;
    target.notes = [target.notes, note].filter(Boolean).join(" ");
  };

  appendNote("preparation", `Planning note from couple: ${vision.slice(0, 220)}`);
  if (venueOverride) {
    appendNote("ceremony", `Use ${venueOverride} as the working venue/location from the latest prompt.`);
  }

  if (/\b(calm|relax|slow|quiet|peaceful|intimate|private)\b/i.test(lower)) {
    appendNote("preparation", "Keep the morning calm with extra buffer, fewer room changes, and limited visitors.");
    appendNote("photos", "Prioritize relaxed portraits and avoid overpacking the photo list.");
  }
  if (/\b(party|dance|dancing|high[-\s]?energy|fun|celebrat)\b/i.test(lower)) {
    appendNote("dancing", "Protect a high-energy dance block and keep formalities tight so the party starts quickly.");
  }
  if (/\b(first look|private look)\b/i.test(lower)) {
    appendNote("photos", "Include a first look before ceremony portraits.");
  }
  if (/\b(no first look|aisle reveal)\b/i.test(lower)) {
    appendNote("photos", "Avoid a first look and shift couple portraits after the ceremony.");
  }
  if (/\b(family|parents|grandparents|kids|children)\b/i.test(lower)) {
    appendNote("photos", "Build in family photo time and keep important relatives close to the photo location.");
  }
  if (/\b(outdoor|garden|beach|rain|weather)\b/i.test(lower)) {
    appendNote("ceremony", "Confirm weather backup timing, shade, water, and guest comfort for outdoor moments.");
  }
  if (/\b(church|chapel|travel|shuttle|transport|different location)\b/i.test(lower)) {
    appendNote("travel", "Add clear travel buffers and confirm transportation timing between locations.");
  }

  return applyAddInstructions(applyOrderingInstructions(enhanced, dayVision), dayVision);
}

function buildFallbackTimeline(profile: typeof weddingProfiles.$inferSelect, dayVision?: string): TimelineBlock[] {
  const ceremony = parseTimeToMinutes(profile.ceremonyTime, 16 * 60);
  const reception = parseTimeToMinutes(profile.receptionTime, ceremony + 2 * 60);
  const venue = extractVenueOverride(dayVision) || profile.venue || "Wedding venue";
  const ceremonyLocation = profile.ceremonyAtVenue === false
    ? profile.ceremonyVenueName || profile.ceremonyAddress || "Ceremony location"
    : venue;

  const events = [
    makeTimelineBlock(1, ceremony - 8 * 60, ceremony - 6 * 60, "Hair, makeup, and getting ready", "Wedding party begins hair, makeup, wardrobe prep, and detail photos.", "preparation", venue),
    makeTimelineBlock(2, ceremony - 6 * 60, ceremony - 5 * 60, "Vendor arrivals and setup", "Photo/video team, florist, music, and venue team begin setup and day-of coordination.", "vendors", venue),
    makeTimelineBlock(3, ceremony - 5 * 60, ceremony - 4 * 60, "Couple portraits and first look", "Optional first look, couple portraits, and immediate family photos.", "photos", venue),
    makeTimelineBlock(4, ceremony - 4 * 60, ceremony - 3 * 60, "Wedding party photos", "Capture wedding party portraits and any pre-ceremony group photos.", "photos", venue),
    makeTimelineBlock(5, ceremony - 90, ceremony - 45, "Final ceremony prep", "Hideaway time, ceremony details, music checks, and guest arrival preparation.", "preparation", ceremonyLocation),
    makeTimelineBlock(6, ceremony - 30, ceremony, "Guest arrival", "Guests arrive, find seats, and prelude music begins.", "ceremony", ceremonyLocation),
    makeTimelineBlock(7, ceremony, ceremony + 45, "Ceremony", "Processional, vows, rings, pronouncement, and recessional.", "ceremony", ceremonyLocation),
    makeTimelineBlock(8, ceremony + 45, reception, "Cocktail hour and family photos", "Guests enjoy cocktail hour while family and newlywed portraits are completed.", "cocktail", venue),
    makeTimelineBlock(9, reception, reception + 30, "Reception entrance and welcome", "Grand entrance, welcome remarks, and transition into dinner service.", "reception", venue),
    makeTimelineBlock(10, reception + 30, reception + 90, "Dinner service", "Dinner is served with space for table visits and guest greetings.", "reception", venue),
    makeTimelineBlock(11, reception + 90, reception + 135, "Toasts and special dances", "Toasts, first dance, parent dances, and formal reception moments.", "reception", venue),
    makeTimelineBlock(12, reception + 135, reception + 240, "Open dancing and celebration", "Dance floor opens, cake cutting happens as scheduled, and the party continues.", "dancing", venue),
    makeTimelineBlock(13, reception + 240, reception + 270, "Final song and send-off", "Final song, private last dance or send-off, and guest departure.", "dancing", venue),
  ].filter((event) => parseTimeToMinutes(event.startTime, 0) >= 0);

  return applyDayVisionToTimeline(events, dayVision, profile.venue);
}

router.get("/timeline", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(404).json({ error: "No timeline found" });
      return;
    }

    const rows = await db
      .select()
      .from(timelines)
      .where(eq(timelines.profileId, profile.id))
      .orderBy(desc(timelines.id))
      .limit(1);

    if (!rows.length) {
      res.status(404).json({ error: "No timeline found" });
      return;
    }
    const t = rows[0];
    res.json({
      id: t.id,
      events: t.events,
      generatedAt: t.generatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err, "Failed to get timeline");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/timeline", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(404).json({ error: "Profile not found. Please complete your wedding profile first." });
      return;
    }

    const { dayVision } = req.body as { dayVision?: string };
    const trimmedDayVision = typeof dayVision === "string" ? dayVision.trim() : "";

    const requestLanguage = getRequestLanguage(req, profile.preferredLanguage);
    const lang = requestLanguage !== "English" ? requestLanguage : null;
    let events: TimelineBlock[] = [];
    let usedFallback = false;
    const shouldUseAi = !!trimmedDayVision || !!lang;
    // Important: tell the model to keep JSON structural fields (keys + the
    // category enum + time format) in English while only translating the
    // human-readable strings (title, description, location, notes). Small
    // models otherwise translate the JSON keys (e.g. "título" instead of
    // "title") which breaks our parser.
    const langInstruction = lang
      ? `\n\nLANGUAGE RULE — CRITICAL:
- Translate ONLY the values of "title", "description", "location", and "notes" into ${lang}.
- The JSON keys (id, startTime, endTime, title, description, category, location, notes) MUST stay in English.
- The "category" value MUST stay in English from the allowed list (preparation, ceremony, cocktail, reception, photos, vendors, travel, dancing, other).
- Times must remain in 24-hour HH:MM format.
- Do NOT include any text outside the JSON array. Output ONLY the array.`
      : "";

    if (shouldUseAi) {
      const prompt = `Create a concise wedding day timeline for the following wedding:
- Couple: ${profile.partner2Name} & ${profile.partner1Name}
- Date: ${profile.weddingDate}
- Ceremony Time: ${profile.ceremonyTime}
- Reception Time: ${profile.receptionTime}
- Saved Profile Venue: ${profile.venue}
- Location: ${profile.location}
- Guest Count: ${profile.guestCount}
- Wedding Style: ${profile.weddingVibe}${trimmedDayVision ? `\n- Couple's Vision for the Day: ${trimmedDayVision}` : ""}

Generate 10 to 13 schedule blocks from preparation through send-off. Include:
- Bridal party / couple getting ready (preparation)
- Vendor arrival blocks (photographer, florist, DJ, caterer, etc.) — category: vendors
- First look or couple portraits — category: photos
- Travel between locations — category: travel
- Ceremony — category: ceremony
- Cocktail hour — category: cocktail
- Reception dinner — category: reception
- First dance, toasts, cake cutting, dancing — category: dancing
- Departure

Keep descriptions under 18 words. Include realistic buffer time between events. Use specific locations where applicable.
If a Couple's Vision for the Day is provided, it is the user's latest instruction and must override saved profile details when they conflict. If the vision names a venue, location, estate, manor, hotel, or place, use that place in event locations and descriptions instead of the saved profile venue. If the vision says not to put hair, makeup, glam, or getting-ready first, do not make that the first block; start with another appropriate preparation/vendor/setup block and place hair/makeup later. Make the timeline visibly reflect the request. Add or adjust timing, notes, categories, locations, and descriptions for those priorities instead of returning a generic wedding schedule.

Return ONLY a valid JSON array (no markdown, no explanation) with this exact structure:
[
  {
    "id": "block-1",
    "startTime": "08:00",
    "endTime": "09:30",
    "title": "Event Title",
    "description": "Detailed description of what happens during this block",
    "category": "preparation|ceremony|cocktail|reception|photos|vendors|travel|dancing|other",
    "location": "Room or venue area name",
    "notes": ""
  }
]

Use 24-hour HH:MM format for startTime and endTime. Use sequential IDs like block-1, block-2, etc.${langInstruction}`;

      const completion = await openai.chat.completions.create({
        model: getModel(),
        // Keep output bounded for lower latency while still covering a full day.
        max_completion_tokens: 1100,
        messages: [{ role: "user", content: prompt }],
      }, { signal: AbortSignal.timeout(timelineAiTimeoutMs()) });

      const content = completion.choices[0]?.message?.content ?? "[]";

      try {
      // Strip common preamble/postamble text the model adds in non-English
      // responses ("Aquí tienes el cronograma:..."). We greedy-match the
      // outermost array.
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      events = JSON.parse(jsonMatch ? jsonMatch[0] : content);
      if (!Array.isArray(events)) events = [];
      } catch (parseErr) {
        req.log.warn({ err: String(parseErr), preview: content.slice(0, 500) }, "Timeline JSON parse failed");
        events = [];
      }
    }

    if (events.length === 0) {
      events = buildFallbackTimeline(profile, trimmedDayVision);
      usedFallback = true;
      if (shouldUseAi) req.log.warn("Timeline AI returned no usable events; using fallback timeline");
    } else {
      events = applyDayVisionToTimeline(events, trimmedDayVision, profile.venue);
    }

    // Replace any existing timelines for this profile so regenerate doesn't pile up duplicate rows.
    // Wrap delete+insert in a transaction so concurrent regenerate clicks can't interleave
    // (last-deleter-wins) and produce missing/inconsistent timeline state.
    const created = await db.transaction(async (tx) => {
      await tx.delete(timelines).where(eq(timelines.profileId, profile.id));
      const [row] = await tx
        .insert(timelines)
        .values({ profileId: profile.id, events })
        .returning();
      return row;
    });

    trackEvent(req.userId!, "timeline_generated", { eventCount: events.length, fallback: usedFallback, aiSkipped: !shouldUseAi });
    logActivity(profile.id, req.userId!, `Generated day-of timeline (${events.length} events)`, "timeline", { eventCount: events.length, fallback: usedFallback, aiSkipped: !shouldUseAi });
    res.json({
      id: created.id,
      events: created.events,
      generatedAt: created.generatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err, "Failed to generate timeline");
    try {
      const profile = await resolveProfile(req);
      if (profile) {
        const fallbackDayVision = typeof req.body?.dayVision === "string" ? req.body.dayVision : undefined;
        const events = buildFallbackTimeline(profile, fallbackDayVision);
        const created = await db.transaction(async (tx) => {
          await tx.delete(timelines).where(eq(timelines.profileId, profile.id));
          const [row] = await tx
            .insert(timelines)
            .values({ profileId: profile.id, events })
            .returning();
          return row;
        });
        trackEvent(req.userId!, "timeline_generated", { eventCount: events.length, fallback: true });
        logActivity(profile.id, req.userId!, `Generated fallback day-of timeline (${events.length} events)`, "timeline", { eventCount: events.length, fallback: true });
        res.json({
          id: created.id,
          events: created.events,
          generatedAt: created.generatedAt.toISOString(),
        });
        return;
      }
    } catch (fallbackErr) {
      req.log.error(fallbackErr, "Fallback timeline generation failed");
    }
    // Surface AI provider rate limits / capacity errors so the client can show
    // a meaningful message instead of a generic "generation failed" toast.
    const e = err as { status?: number; code?: string; message?: string };
    const status = typeof e?.status === "number" ? e.status : 500;
    if (status === 429) {
      res.status(429).json({
        error: "Aria is at her daily AI limit. Please try again after midnight UTC.",
      });
      return;
    }
    if (status === 503 || status === 502) {
      res.status(503).json({
        error: "Aria is temporarily unavailable. Please try again in a moment.",
      });
      return;
    }
    res.status(500).json({
      error: e?.message ? `Timeline generation failed: ${e.message}` : "Internal server error",
    });
  }
});

router.post("/timeline/:id/translate", requireAuth, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid timeline id" });

    const profile = await resolveProfile(req);
    if (!profile) return res.status(404).json({ error: "Profile not found" });

    const [timeline] = await db
      .select()
      .from(timelines)
      .where(and(eq(timelines.id, id), eq(timelines.profileId, profile.id)))
      .limit(1);
    if (!timeline) return res.status(404).json({ error: "Timeline not found" });

    const language = getRequestLanguage(req, profile.preferredLanguage);
    const events = normalizeTimelineBlocks(req.body?.events ?? timeline.events);
    if (language === "English" || events.length === 0) {
      return res.json({ language, events });
    }

    const prompt = `Translate these wedding timeline blocks into ${language}.

CRITICAL RULES:
- Return ONLY valid JSON in this shape: {"events":[...]}.
- No markdown. No explanation.
- Preserve the array length and order.
- Preserve every id, startTime, endTime, category, status, and any unknown fields exactly.
- Translate ONLY the human-readable values: title, description, location, and notes.
- If a field is empty, keep it empty.
- Do not add, remove, reorder, merge, or regenerate events.

Timeline JSON:
${JSON.stringify(events)}`;

    const completion = await openai.chat.completions.create({
      model: getModel(),
      response_format: { type: "json_object" },
      max_completion_tokens: 2400,
      messages: [{ role: "user", content: prompt }],
    }, { signal: AbortSignal.timeout(30_000) });

    const content = completion.choices[0]?.message?.content ?? "[]";
    let translated: TimelineBlock[] | null = null;
    try {
      const parsed = JSON.parse(content);
      const parsedEvents = normalizeTimelineBlocks(Array.isArray(parsed) ? parsed : parsed?.events);
      if (parsedEvents.length === events.length) {
        translated = parsedEvents.map((event, index) => ({
          ...events[index],
          title: event.title,
          description: event.description,
          location: event.location,
          notes: event.notes,
        }));
      }
    } catch (parseErr) {
      req.log.warn({ err: String(parseErr), preview: content.slice(0, 500) }, "Timeline translation JSON parse failed");
    }
    if (!translated) {
      res.status(502).json({ error: "Timeline translation failed. Please try again." });
      return;
    }

    res.json({ language, events: translated });
  } catch (err) {
    req.log.error(err, "Failed to translate timeline");
    const e = err as { status?: number; message?: string };
    if (e?.status === 429) {
      return res.status(429).json({ error: "Aria is at her daily AI limit. Please try again after midnight UTC." });
    }
    res.status(500).json({ error: e?.message ? `Timeline translation failed: ${e.message}` : "Internal server error" });
  }
});

router.patch("/timeline/:id", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    const { events } = req.body;
    if (!Array.isArray(events)) return res.status(400).json({ error: "events must be an array" });

    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    const [updated] = await db
      .update(timelines)
      .set({ events })
      .where(and(eq(timelines.id, id), eq(timelines.profileId, profile.id)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Timeline not found" });

    logActivity(profile.id, req.userId!, `Edited day-of timeline`, "timeline", { eventCount: events.length });

    res.json({
      id: updated.id,
      events: updated.events,
      generatedAt: updated.generatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err, "Failed to update timeline");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/timeline/:id/reset", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    const resetVision = typeof req.body?.dayVision === "string" ? req.body.dayVision : undefined;
    const events = buildFallbackTimeline(profile, resetVision);
    const [updated] = await db
      .update(timelines)
      .set({ events })
      .where(and(eq(timelines.id, id), eq(timelines.profileId, profile.id)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Timeline not found" });

    logActivity(profile.id, req.userId!, `Reset day-of timeline`, "timeline", { eventCount: events.length });

    res.json({
      id: updated.id,
      events: updated.events,
      generatedAt: updated.generatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err, "Failed to reset timeline");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
