import { Router, type Request, type Response } from "express";
import { scrypt, randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import { promisify } from "node:util";
import { Readable } from "node:stream";
import rateLimit from "express-rate-limit";
import { db, weddingWebsites, weddingProfiles, guests, websiteRsvps, weddingParty, hotelBlocks, invitationCustomizations } from "@workspace/db";
import type { WeddingProfile, WebsiteSectionsEnabled, WebsiteCustomText, WebsiteGalleryImage, WebsiteHeroImage, WebsiteTextStyles, WebsiteTextPositions } from "@workspace/db";
import { and, eq, ilike, desc, not } from "drizzle-orm";
import { openai, getModel } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../middlewares/requireAuth";
import { publicRsvpLimiter } from "../middlewares/rateLimiter";
import { hasMinRole, resolveCallerRole, resolveProfile } from "../lib/workspaceAccess";
import { sendMaintenanceIfActive } from "../lib/maintenance";
import { getRequestLanguage } from "../lib/language";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";

const scryptAsync = promisify(scrypt);

// ─── Password hashing helpers (H-5) ─────────────────────────────────────────
// Format: "scrypt:<salt_hex>:<hash_hex>" — distinguishable from legacy plaintext.
async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(plain, salt, 64)) as Buffer;
  return `scrypt:${salt}:${hash.toString("hex")}`;
}

async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (stored.startsWith("scrypt:")) {
    const parts = stored.split(":");
    if (parts.length !== 3) return false;
    const [, salt, hashHex] = parts;
    const expected = Buffer.from(hashHex, "hex");
    const actual = (await scryptAsync(plain, salt, 64)) as Buffer;
    if (expected.length !== actual.length) return false;
    return timingSafeEqual(expected, actual);
  }
  // Legacy plaintext — direct comparison.
  return plain === stored;
}

// ─── Per-IP rate limiters for public endpoints ───────────────────────────────
const guestSearchLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { error: "Too many requests. Please slow down." },
});

const websiteUnlockLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { error: "Too many password attempts. Please wait a minute and try again." },
});

const router = Router();

// ---------- helpers ----------

const DEFAULT_WEBSITE_HERO_IMAGE = "/images/default-wedding-couple.jpg";
const DEFAULT_PUBLIC_ORIGIN = "https://aidowedding.net";
const DEFAULT_API_ORIGIN = "https://api.aidowedding.net";
const INVITATION_SHARE_SECRET = process.env.INVITATION_SHARE_SECRET || process.env.SESSION_SECRET || process.env.JWT_SECRET || process.env.CLERK_SECRET_KEY || "";
const LOCAL_INVITATION_SHARE_SECRET = "aido-local-invitation-share-secret";
const objectStorageService = new ObjectStorageService();

function sanitizeOrigin(raw: string | undefined, fallback: string): string {
  const value = raw?.trim().replace(/\/+$/, "");
  if (!value) return fallback;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return fallback;
    if (!/^[a-zA-Z0-9.\-]+(?::\d+)?$/.test(parsed.host)) return fallback;
    return parsed.origin;
  } catch {
    return fallback;
  }
}

function requestOrigin(req: import("express").Request, fallback: string): string {
  if (process.env.NODE_ENV === "production") return fallback;
  const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0]?.trim() || req.protocol;
  const host = (req.headers["x-forwarded-host"] as string)?.split(",")[0]?.trim() || req.get("host") || "";
  return sanitizeOrigin(`${proto}://${host}`, fallback);
}

function buildOrigin(req: import("express").Request): string {
  const fromEnv = process.env.API_PUBLIC_URL || process.env.PUBLIC_API_URL || process.env.API_URL;
  if (fromEnv) return sanitizeOrigin(fromEnv, DEFAULT_API_ORIGIN);
  return requestOrigin(req, DEFAULT_API_ORIGIN);
}

function buildFrontendOrigin(req: import("express").Request): string {
  const fromEnv = process.env.FRONTEND_URL || process.env.PUBLIC_APP_URL || process.env.APP_ORIGIN;
  if (fromEnv) return sanitizeOrigin(fromEnv, DEFAULT_PUBLIC_ORIGIN);
  const origin = buildOrigin(req).replace("://api.", "://");
  return sanitizeOrigin(origin, DEFAULT_PUBLIC_ORIGIN);
}

function invitationShareSecret(): string {
  if (INVITATION_SHARE_SECRET) return INVITATION_SHARE_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error("Invitation share secret is not configured.");
  }
  return LOCAL_INVITATION_SHARE_SECRET;
}

function signInvitationShare(profileId: number): string {
  const payload = Buffer.from(String(profileId), "utf8").toString("base64url");
  const sig = createHmac("sha256", invitationShareSecret()).update(payload).digest("base64url").slice(0, 32);
  return `${payload}.${sig}`;
}

function verifyInvitationShare(token: string): number | null {
  const [payload, sig] = String(token || "").split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", invitationShareSecret()).update(payload).digest("base64url").slice(0, 32);
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  const raw = Buffer.from(payload, "base64url").toString("utf8");
  const profileId = Number(raw);
  return Number.isFinite(profileId) && profileId > 0 ? profileId : null;
}

function normalizePrivateMediaPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname.startsWith("/api/storage/objects/")) {
      return `/objects/${parsed.pathname.slice("/api/storage/objects/".length)}`;
    }
    if (parsed.pathname.startsWith("/storage/objects/")) {
      return `/objects/${parsed.pathname.slice("/storage/objects/".length)}`;
    }
    if (parsed.pathname.startsWith("/objects/")) return parsed.pathname;
  } catch {
    // Relative paths are handled below.
  }
  if (trimmed.startsWith("/api/storage/objects/")) {
    return `/objects/${trimmed.slice("/api/storage/objects/".length).split(/[?#]/)[0]}`;
  }
  if (trimmed.startsWith("/storage/objects/")) {
    return `/objects/${trimmed.slice("/storage/objects/".length).split(/[?#]/)[0]}`;
  }
  if (trimmed.startsWith("/objects/")) return trimmed.split(/[?#]/)[0];
  return null;
}

function signWebsiteMedia(row: typeof weddingWebsites.$inferSelect, objectPath: string): string {
  const payload = `${row.id}:${row.slug}:${row.password ?? ""}:${objectPath}`;
  return createHmac("sha256", invitationShareSecret()).update(payload).digest("base64url").slice(0, 32);
}

function verifyWebsiteMedia(row: typeof weddingWebsites.$inferSelect, objectPath: string, token: unknown): boolean {
  if (typeof token !== "string" || !token) return false;
  const expected = signWebsiteMedia(row, objectPath);
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

function websiteMediaUrl(row: typeof weddingWebsites.$inferSelect, raw: string | null | undefined): string | null {
  if (!raw) return raw ?? null;
  const objectPath = normalizePrivateMediaPath(raw);
  if (!objectPath) return raw;
  const mediaPath = objectPath.slice("/objects/".length).split("/").map(encodeURIComponent).join("/");
  const token = signWebsiteMedia(row, objectPath);
  return `/api/website/public/${encodeURIComponent(row.slug)}/media/${mediaPath}?t=${encodeURIComponent(token)}`;
}

function mapWebsiteMedia<T extends { url: string }>(
  row: typeof weddingWebsites.$inferSelect,
  items: T[] | null | undefined,
): T[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    ...item,
    url: websiteMediaUrl(row, item.url) ?? item.url,
  }));
}

function collectWebsiteMediaPaths(
  row: typeof weddingWebsites.$inferSelect,
  party: Array<{ photoUrl: string | null }>,
): Set<string> {
  const paths = new Set<string>();
  const add = (raw: unknown) => {
    const path = normalizePrivateMediaPath(raw);
    if (path) paths.add(path);
  };
  add(row.heroImage);
  for (const image of row.heroImages ?? []) add(image.url);
  for (const image of row.galleryImages ?? []) add(image.url);
  for (const member of party) add(member.photoUrl);
  return paths;
}

const SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomSuffix(len = 5): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)];
  }
  return out;
}

function baseSlug(profile: WeddingProfile): string {
  const a = (profile.partner1Name || "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  const b = (profile.partner2Name || "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  const cleaned = [b, a].filter(Boolean).join("-").replace(/[^a-z0-9-]/g, "");
  return cleaned || "wedding";
}

async function generateUniqueSlug(profile: WeddingProfile): Promise<string> {
  const base = baseSlug(profile);
  // Try the base slug first, then base-XXXXX suffixes
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${randomSuffix()}`;
    const [existing] = await db
      .select({ id: weddingWebsites.id })
      .from(weddingWebsites)
      .where(eq(weddingWebsites.slug, candidate))
      .limit(1);
    if (!existing) return candidate;
  }
  // Fallback — extremely unlikely
  return `${base}-${Date.now().toString(36)}`;
}

function autoGenerateText(profile: WeddingProfile): WebsiteCustomText {
  const couple = `${profile.partner2Name} & ${profile.partner1Name}`;
  const venueLine = profile.venue ? `${profile.venue}${profile.location ? `, ${profile.location}` : ""}` : "";
  return {
    welcome: `Welcome to our wedding website! We can't wait to celebrate with you on ${profile.weddingDate}${venueLine ? ` at ${venueLine}` : ""}. Browse the site for everything you need to know.`,
    story: `${couple} are getting married! We're so grateful to have you in our lives and can't wait to share this special day with you.`,
    faq: `Have questions? You can reach us anytime — and we'll keep this page updated with the latest details as the day approaches.`,
    travel: profile.venue ? `Our wedding will take place at ${profile.venue}${profile.location ? `, ${profile.location}` : ""}. We'll be sharing recommended hotels and travel tips here.` : "Travel details coming soon.",
    registry: "We're so thankful for your love and support. Registry details will be shared here.",
  };
}

function defaultHeroImageFor(profile: WeddingProfile): string {
  const profilePhoto = (profile.invitationPhotoUrl ?? "").trim();
  return profilePhoto || DEFAULT_WEBSITE_HERO_IMAGE;
}

function serialize(w: typeof weddingWebsites.$inferSelect) {
  return {
    id: w.id,
    profileId: w.profileId,
    slug: w.slug,
    theme: w.theme,
    layoutStyle: w.layoutStyle,
    font: w.font,
    accentColor: w.accentColor,
    colorPalette: w.colorPalette,
    sectionsEnabled: w.sectionsEnabled,
    customText: w.customText,
    textStyles: w.textStyles ?? {},
    textPositions: w.textPositions ?? {},
    galleryImages: w.galleryImages,
    heroImages: w.heroImages ?? [],
    heroImage: w.heroImage,
    passwordEnabled: !!w.password,
    published: w.published,
    publishedAt: w.publishedAt?.toISOString() ?? null,
    lastUpdated: w.lastUpdated.toISOString(),
    createdAt: w.createdAt.toISOString(),
  };
}

function normalizeWebsiteTranslationText(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw !== "string") continue;
    const cleanKey = key.trim();
    const cleanValue = raw.trim();
    if (!cleanKey || !cleanValue) continue;
    if (cleanKey.length > 80 || cleanValue.length > 5000) continue;
    out[cleanKey] = cleanValue;
  }
  return out;
}

async function buildPublicWebsitePayload(row: typeof weddingWebsites.$inferSelect) {
  const [profile] = await db
    .select()
    .from(weddingProfiles)
    .where(eq(weddingProfiles.id, row.profileId))
    .limit(1);
  if (!profile) return null;

  const portalParty = await db
    .select({ id: weddingParty.id, name: weddingParty.name, role: weddingParty.role, side: weddingParty.side, photoUrl: weddingParty.photoUrl, sortOrder: weddingParty.sortOrder })
    .from(weddingParty)
    .where(eq(weddingParty.profileId, profile.id))
    .orderBy(weddingParty.sortOrder, weddingParty.createdAt);

  const hotelOptions = await db
    .select({
      id: hotelBlocks.id,
      hotelName: hotelBlocks.hotelName,
      bookingLink: hotelBlocks.bookingLink,
      discountCode: hotelBlocks.discountCode,
      groupName: hotelBlocks.groupName,
      cutoffDate: hotelBlocks.cutoffDate,
      address: hotelBlocks.address,
      city: hotelBlocks.city,
      state: hotelBlocks.state,
      zip: hotelBlocks.zip,
    })
    .from(hotelBlocks)
    .where(eq(hotelBlocks.profileId, profile.id))
    .orderBy(hotelBlocks.createdAt);

  const [invitationCustomization] = await db
    .select({
      customColors: invitationCustomizations.customColors,
      colorPalette: invitationCustomizations.colorPalette,
      digitalInvitationPhotoUrl: invitationCustomizations.digitalInvitationPhotoUrl,
      digitalInvitationPhotoPosition: invitationCustomizations.digitalInvitationPhotoPosition,
      digitalInvitationBackground: invitationCustomizations.digitalInvitationBackground,
      digitalInvitationFont: invitationCustomizations.digitalInvitationFont,
      digitalInvitationFontColor: invitationCustomizations.digitalInvitationFontColor,
      digitalInvitationFontSize: invitationCustomizations.digitalInvitationFontSize,
      digitalInvitationAccentColor: invitationCustomizations.digitalInvitationAccentColor,
      useGeneratedInvitation: invitationCustomizations.useGeneratedInvitation,
      rsvpByDate: invitationCustomizations.rsvpByDate,
    })
    .from(invitationCustomizations)
    .where(eq(invitationCustomizations.profileId, profile.id))
    .limit(1);
  const invitationColors = (invitationCustomization?.customColors ?? {}) as Record<string, unknown>;
  const customText = { ...(row.customText as Record<string, string>) };
  if (invitationColors.rsvpHotelBlockId !== undefined && invitationColors.rsvpHotelBlockId !== null) {
    customText._rsvpHotelBlockId = String(invitationColors.rsvpHotelBlockId);
  }

  return {
    slug: row.slug,
    publicWebsiteUrl: row.published && row.slug ? `/w/${row.slug}` : null,
    theme: row.theme,
    layoutStyle: row.layoutStyle,
    font: row.font,
    accentColor: row.accentColor,
    colorPalette: row.colorPalette,
    sectionsEnabled: row.sectionsEnabled,
    customText,
    textStyles: row.textStyles ?? {},
    textPositions: row.textPositions ?? {},
    galleryImages: mapWebsiteMedia(row, row.galleryImages),
    heroImages: mapWebsiteMedia(row, row.heroImages ?? []),
    heroImage: websiteMediaUrl(row, row.heroImage) ?? row.heroImage,
    portalParty: portalParty.map((member) => ({
      ...member,
      photoUrl: websiteMediaUrl(row, member.photoUrl) ?? member.photoUrl,
    })),
    hotelOptions,
    mealOptions: normalizeMealOptions(invitationColors.rsvpMealOptions),
    couple: {
      partner1Name: profile.partner1Name,
      partner2Name: profile.partner2Name,
      weddingDate: profile.weddingDate,
      ceremonyTime: profile.ceremonyTime,
      receptionTime: profile.receptionTime,
      venue: profile.venue,
      location: profile.location,
      venueCity: profile.venueCity,
      venueState: profile.venueState,
    },
  };
}

async function buildInvitationSharePayload(profileId: number, frontendOrigin: string) {
  const [profile] = await db
    .select()
    .from(weddingProfiles)
    .where(eq(weddingProfiles.id, profileId))
    .limit(1);
  if (!profile) return null;

  const hotelOptions = await db
    .select({
      id: hotelBlocks.id,
      hotelName: hotelBlocks.hotelName,
      bookingLink: hotelBlocks.bookingLink,
      discountCode: hotelBlocks.discountCode,
      groupName: hotelBlocks.groupName,
      cutoffDate: hotelBlocks.cutoffDate,
      address: hotelBlocks.address,
      city: hotelBlocks.city,
      state: hotelBlocks.state,
      zip: hotelBlocks.zip,
    })
    .from(hotelBlocks)
    .where(eq(hotelBlocks.profileId, profile.id))
    .orderBy(hotelBlocks.createdAt);

  const [invitationCustomization] = await db
    .select({
      customColors: invitationCustomizations.customColors,
      colorPalette: invitationCustomizations.colorPalette,
      digitalInvitationPhotoUrl: invitationCustomizations.digitalInvitationPhotoUrl,
      digitalInvitationPhotoPosition: invitationCustomizations.digitalInvitationPhotoPosition,
      digitalInvitationBackground: invitationCustomizations.digitalInvitationBackground,
      digitalInvitationFont: invitationCustomizations.digitalInvitationFont,
      digitalInvitationFontColor: invitationCustomizations.digitalInvitationFontColor,
      digitalInvitationFontSize: invitationCustomizations.digitalInvitationFontSize,
      digitalInvitationAccentColor: invitationCustomizations.digitalInvitationAccentColor,
      useGeneratedInvitation: invitationCustomizations.useGeneratedInvitation,
      rsvpByDate: invitationCustomizations.rsvpByDate,
    })
    .from(invitationCustomizations)
    .where(eq(invitationCustomizations.profileId, profile.id))
    .limit(1);
  const [publishedWebsite] = await db
    .select({ slug: weddingWebsites.slug, published: weddingWebsites.published })
    .from(weddingWebsites)
    .where(eq(weddingWebsites.profileId, profile.id))
    .limit(1);
  const invitationColors = (invitationCustomization?.customColors ?? {}) as Record<string, unknown>;
  const customText: Record<string, string> = {
    rsvp_title: "RSVP",
    rsvp_subtitle: "Will you be joining us?",
    rsvp_intro: "Find your name on the guest list and let us know if you can make it.",
  };
  if (invitationColors.rsvpHotelBlockId !== undefined && invitationColors.rsvpHotelBlockId !== null) {
    customText._rsvpHotelBlockId = String(invitationColors.rsvpHotelBlockId);
  }
  const publicWebsiteUrl = publishedWebsite?.published && publishedWebsite.slug
    ? `${frontendOrigin.replace(/\/$/, "")}/w/${publishedWebsite.slug}`
    : null;
  const isCustomInvitation = invitationCustomization?.useGeneratedInvitation === false;
  const digitalAccent = isCustomInvitation
    ? String(invitationCustomization?.digitalInvitationAccentColor || invitationColors.digitalInvitationAccent || invitationCustomization?.colorPalette?.accent || "#8D294D")
    : "#8D294D";
  const digitalFontColor = String(invitationCustomization?.digitalInvitationFontColor || "#3B1C2B");

  return {
    slug: signInvitationShare(profile.id),
    publicWebsiteUrl,
    invitationPreview: {
      photoUrl: invitationCustomization?.digitalInvitationPhotoUrl || profile.digitalInvitationPhotoUrl || profile.invitationPhotoUrl || defaultHeroImageFor(profile),
      photoPosition: invitationCustomization?.digitalInvitationPhotoPosition ?? { x: 50, y: 58 },
      photoZoom: typeof invitationColors.digitalInvitationPhotoZoom === "number" ? invitationColors.digitalInvitationPhotoZoom : 1,
      photoEffect: typeof invitationColors.digitalInvitationPhotoEffect === "string" ? invitationColors.digitalInvitationPhotoEffect : "none",
      customColors: isCustomInvitation ? {
        bg: invitationCustomization?.digitalInvitationBackground || "#FFFFFF",
        accent: digitalAccent,
        text: digitalFontColor,
        muted: `${digitalFontColor}99`,
        cardBdr: `${digitalAccent}33`,
        font: invitationCustomization?.digitalInvitationFont || "Playfair Display",
        fontSize: invitationCustomization?.digitalInvitationFontSize || "16",
      } : null,
      profile: {
        partner1Name: profile.partner1Name,
        partner2Name: profile.partner2Name,
        weddingDate: profile.weddingDate,
        venue: profile.venue,
        venueAddress: profile.location,
        venueCity: profile.venueCity,
        venueState: profile.venueState,
        venueZip: profile.venueZip,
        ceremonyTime: profile.ceremonyTime,
        receptionTime: profile.receptionTime,
        invitationMessage: profile.invitationMessage,
        websiteUrl: publicWebsiteUrl,
        guestName: "Guest",
        rsvpByDate: invitationCustomization?.rsvpByDate ?? null,
      },
    },
    theme: "classic",
    layoutStyle: "standard",
    font: "Playfair Display",
    accentColor: "#8D294D",
    colorPalette: {
      primary: "#8D294D",
      secondary: "#E6A6B7",
      accent: "#B16C8E",
      neutral: "#F2E2C6",
      background: "#FFF7F2",
      text: "#3B1C2B",
    },
    sectionsEnabled: {
      welcome: false,
      story: false,
      schedule: false,
      travel: false,
      registry: false,
      faq: false,
      gallery: false,
      weddingParty: false,
      rsvp: true,
    },
    customText,
    textStyles: {},
    textPositions: {},
    galleryImages: [],
    heroImages: [],
    heroImage: defaultHeroImageFor(profile),
    portalParty: [],
    hotelOptions,
    mealOptions: normalizeMealOptions(invitationColors.rsvpMealOptions),
    couple: {
      partner1Name: profile.partner1Name,
      partner2Name: profile.partner2Name,
      weddingDate: profile.weddingDate,
      ceremonyTime: profile.ceremonyTime,
      receptionTime: profile.receptionTime,
      venue: profile.venue,
      location: profile.location,
      venueCity: profile.venueCity,
      venueState: profile.venueState,
    },
  };
}

async function resolveInvitationShare(token: string) {
  const profileId = verifyInvitationShare(token);
  if (!profileId) return null;
  const [profile] = await db
    .select({ id: weddingProfiles.id })
    .from(weddingProfiles)
    .where(eq(weddingProfiles.id, profileId))
    .limit(1);
  return profile ?? null;
}

// ---------- POST /api/website/create ----------

router.post("/website/create", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) return res.status(403).json({ error: "Insufficient permissions." });
    const profile = await resolveProfile(req);
    if (!profile) return res.status(404).json({ error: "Wedding profile not found. Complete onboarding first." });

    const [existing] = await db
      .select()
      .from(weddingWebsites)
      .where(eq(weddingWebsites.profileId, profile.id))
      .limit(1);
    if (existing) {
      if (!existing.heroImage?.trim()) {
        const [updated] = await db
          .update(weddingWebsites)
          .set({ heroImage: defaultHeroImageFor(profile), lastUpdated: new Date() })
          .where(and(eq(weddingWebsites.id, existing.id), eq(weddingWebsites.profileId, profile.id)))
          .returning();
        return res.json(serialize(updated ?? existing));
      }
      return res.json(serialize(existing));
    }

    const slug = await generateUniqueSlug(profile);
    const customText = autoGenerateText(profile);

    const [created] = await db
      .insert(weddingWebsites)
      .values({
        profileId: profile.id,
        slug,
        customText,
        heroImage: defaultHeroImageFor(profile),
      })
      .returning();

    res.status(201).json(serialize(created));
  } catch (err) {
    req.log.error(err, "createWebsite failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------- GET /api/website/me ----------

router.get("/website/me", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) return res.status(403).json({ error: "Insufficient permissions." });
    const profile = await resolveProfile(req);
    if (!profile) return res.status(404).json({ error: "Wedding profile not found" });

    const [row] = await db
      .select()
      .from(weddingWebsites)
      .where(eq(weddingWebsites.profileId, profile.id))
      .limit(1);
    if (!row) return res.status(404).json({ error: "Website not created yet" });

    const partyMembers = await db
      .select({ id: weddingParty.id, name: weddingParty.name, role: weddingParty.role, side: weddingParty.side, photoUrl: weddingParty.photoUrl, sortOrder: weddingParty.sortOrder })
      .from(weddingParty)
      .where(eq(weddingParty.profileId, profile.id))
      .orderBy(weddingParty.sortOrder, weddingParty.createdAt);

    res.json({ ...serialize(row), portalParty: partyMembers });
  } catch (err) {
    req.log.error(err, "getWebsite failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------- POST /api/website/:id/translate ----------

router.post("/website/:id/translate", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid website id" });

    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) return res.status(403).json({ error: "Insufficient permissions." });
    const profile = await resolveProfile(req);
    if (!profile) return res.status(404).json({ error: "Wedding profile not found" });

    const [row] = await db
      .select()
      .from(weddingWebsites)
      .where(and(eq(weddingWebsites.id, id), eq(weddingWebsites.profileId, profile.id)))
      .limit(1);
    if (!row) return res.status(404).json({ error: "Website not found" });

    const language = getRequestLanguage(req, profile.preferredLanguage);
    const customText = normalizeWebsiteTranslationText(req.body?.customText);
    if (language === "English" || Object.keys(customText).length === 0) {
      return res.json({ language, customText });
    }

    const prompt = `Translate this wedding website editor copy into ${language}.

CRITICAL RULES:
- Return ONLY valid JSON in this shape: {"customText":{...}}.
- Preserve every key exactly.
- Preserve URLs, dates, times, emoji, names, venue names, addresses, and placeholders that are already proper nouns.
- Translate only the readable UI/copy text values.
- If a value is a JSON string for FAQ items, return a JSON string with the same array/object shape and translate only question and answer text.
- Do not add, remove, rename, merge, or reorder keys.

Website copy JSON:
${JSON.stringify(customText)}`;

    const completion = await openai.chat.completions.create({
      model: getModel(),
      response_format: { type: "json_object" },
      max_completion_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    }, { signal: AbortSignal.timeout(30_000) });

    const content = completion.choices[0]?.message?.content ?? "{}";
    let translated: Record<string, string> | null = null;
    try {
      const parsed = JSON.parse(content);
      const parsedText = normalizeWebsiteTranslationText(parsed?.customText);
      const sourceKeys = Object.keys(customText);
      if (sourceKeys.length > 0 && sourceKeys.every((key) => key in parsedText)) {
        translated = Object.fromEntries(sourceKeys.map((key) => [key, parsedText[key]]));
      }
    } catch (parseErr) {
      req.log.warn({ err: String(parseErr), preview: content.slice(0, 500) }, "Website translation JSON parse failed");
    }
    if (!translated) {
      res.status(502).json({ error: "Website translation failed. Please try again." });
      return;
    }

    res.json({ language, customText: translated });
  } catch (err) {
    req.log.error(err, "translateWebsite failed");
    const e = err as { status?: number; message?: string };
    if (e?.status === 429) {
      return res.status(429).json({ error: "Aria is at her daily AI limit. Please try again after midnight UTC." });
    }
    res.status(500).json({ error: e?.message ? `Website translation failed: ${e.message}` : "Internal server error" });
  }
});

// ---------- PUT /api/website/update ----------

router.put("/website/update", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) return res.status(403).json({ error: "Insufficient permissions." });
    const profile = await resolveProfile(req);
    if (!profile) return res.status(404).json({ error: "Wedding profile not found" });

    const [existing] = await db
      .select()
      .from(weddingWebsites)
      .where(eq(weddingWebsites.profileId, profile.id))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Website not created yet" });

    const body = (req.body ?? {}) as Partial<{
      theme: string;
      layoutStyle: string;
      font: string;
      accentColor: string;
      colorPalette: typeof existing.colorPalette;
      sectionsEnabled: WebsiteSectionsEnabled;
      customText: WebsiteCustomText;
      textStyles: WebsiteTextStyles;
      textPositions: WebsiteTextPositions;
      galleryImages: WebsiteGalleryImage[];
      heroImages: WebsiteHeroImage[];
      heroImage: string | null;
      password: string | null;
    }>;

    const updates: Partial<typeof weddingWebsites.$inferInsert> = {
      lastUpdated: new Date(),
    };
    if (typeof body.theme === "string") updates.theme = body.theme;
    if (typeof body.layoutStyle === "string") updates.layoutStyle = body.layoutStyle;
    if (typeof body.font === "string") updates.font = body.font;
    if (typeof body.accentColor === "string") updates.accentColor = body.accentColor;
    if (body.colorPalette && typeof body.colorPalette === "object") updates.colorPalette = body.colorPalette;
    if (body.sectionsEnabled && typeof body.sectionsEnabled === "object") updates.sectionsEnabled = body.sectionsEnabled;
    if (body.customText && typeof body.customText === "object") updates.customText = body.customText;
    if (body.textStyles && typeof body.textStyles === "object") updates.textStyles = body.textStyles;
    if (body.textPositions && typeof body.textPositions === "object") updates.textPositions = body.textPositions;
    if (Array.isArray(body.galleryImages)) updates.galleryImages = body.galleryImages.slice(0, 60);
    if (Array.isArray(body.heroImages)) updates.heroImages = body.heroImages.slice(0, 30);
    if ("heroImage" in body) updates.heroImage = body.heroImage ?? null;
    if ("password" in body) {
      const p = body.password?.trim();
      updates.password = p ? await hashPassword(p) : null;
    }

    const [updated] = await db
      .update(weddingWebsites)
      .set(updates)
      .where(and(eq(weddingWebsites.id, existing.id), eq(weddingWebsites.profileId, profile.id)))
      .returning();
    res.json(serialize(updated));
  } catch (err) {
    req.log.error(err, "updateWebsite failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------- PUT /api/website/publish ----------

router.put("/website/publish", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) return res.status(403).json({ error: "Insufficient permissions." });
    const profile = await resolveProfile(req);
    if (!profile) return res.status(404).json({ error: "Wedding profile not found" });

    const [existing] = await db
      .select()
      .from(weddingWebsites)
      .where(eq(weddingWebsites.profileId, profile.id))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Website not created yet" });

    const desired = typeof req.body?.published === "boolean" ? req.body.published : !existing.published;

    const [updated] = await db
      .update(weddingWebsites)
      .set({
        published: desired,
        publishedAt: desired ? (existing.publishedAt ?? new Date()) : existing.publishedAt,
        lastUpdated: new Date(),
      })
      .where(and(eq(weddingWebsites.id, existing.id), eq(weddingWebsites.profileId, profile.id)))
      .returning();
    res.json(serialize(updated));
  } catch (err) {
    req.log.error(err, "publishWebsite failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------- PUT /api/website/slug ----------

router.put("/website/slug", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) return res.status(403).json({ error: "Insufficient permissions." });
    const profile = await resolveProfile(req);
    if (!profile) return res.status(404).json({ error: "Wedding profile not found" });

    const [existing] = await db
      .select()
      .from(weddingWebsites)
      .where(eq(weddingWebsites.profileId, profile.id))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Website not created yet" });
    if (existing.publishedAt) return res.status(400).json({ error: "Website URL is locked after first publish to keep your link and QR code permanent." });

    const raw = String(req.body?.slug ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-");

    if (!raw || raw.length < 3) return res.status(400).json({ error: "Slug must be at least 3 characters" });
    if (raw.length > 60) return res.status(400).json({ error: "Slug too long (max 60 characters)" });
    if (raw === existing.slug) return res.json(serialize(existing));

    const [conflict] = await db
      .select({ id: weddingWebsites.id })
      .from(weddingWebsites)
      .where(eq(weddingWebsites.slug, raw))
      .limit(1);
    if (conflict) return res.status(409).json({ error: "That URL is already taken. Please try a different one." });

    const [updated] = await db
      .update(weddingWebsites)
      .set({ slug: raw, lastUpdated: new Date() })
      .where(and(eq(weddingWebsites.id, existing.id), eq(weddingWebsites.profileId, profile.id)))
      .returning();
    res.json(serialize(updated));
  } catch (err) {
    req.log.error(err, "updateSlug failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/invitation-shares/links", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) return res.status(403).json({ error: "Insufficient permissions." });
    const profile = await resolveProfile(req);
    if (!profile) return res.status(404).json({ error: "Wedding profile not found" });
    const origin = buildFrontendOrigin(req);
    const token = signInvitationShare(profile.id);
    res.json({
      token,
      rsvpUrl: `${origin}/rsvp/shared/${token}`,
      reminderUrl: `${origin}/rsvp/shared/${token}`,
      saveTheDateUrl: `${origin}/save-the-date/shared-invite/${token}`,
    });
  } catch (err) {
    req.log.error(err, "invitationShareLinks failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/invitation-shares/:token", async (req, res) => {
  try {
    if (await sendMaintenanceIfActive(res, "rsvp")) return;
    const profile = await resolveInvitationShare(String(req.params.token ?? ""));
    if (!profile) return res.status(404).json({ error: "Not found" });
    const payload = await buildInvitationSharePayload(profile.id, buildFrontendOrigin(req));
    if (!payload) return res.status(404).json({ error: "Not found" });
    res.json(payload);
  } catch (err) {
    req.log.error(err, "invitationSharePayload failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/invitation-shares/:token/guests/search", guestSearchLimiter, async (req, res) => {
  try {
    if (await sendMaintenanceIfActive(res, "rsvp")) return;
    const profile = await resolveInvitationShare(String(req.params.token ?? ""));
    if (!profile) return res.status(404).json({ error: "Not found" });
    const q = String(req.query.q ?? "").trim();
    if (q.length < 2) return res.json({ matches: [] });
    const rows = await db
      .select({ id: guests.id, name: guests.name })
      .from(guests)
      .where(and(eq(guests.profileId, profile.id), ilike(guests.name, `%${q.replace(/[%_]/g, "\\$&")}%`)))
      .limit(10);
    res.json({ matches: rows });
  } catch (err) {
    req.log.error(err, "invitationShareGuestSearch failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/invitation-shares/:token/guests/:guestId", guestSearchLimiter, async (req, res) => {
  try {
    if (await sendMaintenanceIfActive(res, "rsvp")) return;
    const profile = await resolveInvitationShare(String(req.params.token ?? ""));
    if (!profile) return res.status(404).json({ error: "Not found" });
    const guestId = parseInt(String(req.params.guestId), 10);
    if (!Number.isFinite(guestId)) return res.status(400).json({ error: "Bad guest id" });
    const [guest] = await db
      .select()
      .from(guests)
      .where(and(eq(guests.id, guestId), eq(guests.profileId, profile.id)))
      .limit(1);
    if (!guest) return res.status(404).json({ error: "Guest not found" });
    if (normalizeGuestLookupName(req.query.name) !== normalizeGuestLookupName(guest.name)) {
      return res.status(403).json({ error: "Please select your name from the guest search again." });
    }
    if (guest.rsvpStatus && guest.rsvpStatus !== "pending") {
      return res.json({
        id: guest.id,
        name: guest.name,
        rsvpStatus: guest.rsvpStatus,
      });
    }

    res.json({
      id: guest.id,
      name: guest.name,
      rsvpStatus: guest.rsvpStatus,
      mealChoice: guest.mealChoice,
      dietaryNotes: guest.dietaryNotes,
      plusOne: guest.plusOne,
      plusOneName: guest.plusOneName,
      plusOneMealChoice: guest.plusOneMealChoice,
      needsHotel: guest.needsHotel,
      bookedHotelBlockId: guest.bookedHotelBlockId,
      bookedHotelRoomCount: guest.bookedHotelRoomCount,
    });
  } catch (err) {
    req.log.error(err, "invitationShareGetGuest failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/invitation-shares/:token/rsvp/self-add", publicRsvpLimiter, async (req, res) => {
  try {
    if (await sendMaintenanceIfActive(res, "rsvp")) return;
    const profile = await resolveInvitationShare(String(req.params.token ?? ""));
    if (!profile) return res.status(404).json({ error: "Not found" });
    const {
      name,
      email,
      attendance,
      mealChoice,
      plusOne,
      plusOneName,
      plusOneMealChoice,
      dietaryRestrictions,
      hotelNeeded,
      bookedHotelBlockId,
      bookedHotelRoomCount,
      message,
    } = (req.body ?? {}) as Record<string, any>;

    const cleanName = typeof name === "string" ? name.trim() : "";
    if (!cleanName) return res.status(400).json({ error: "Please enter your full name." });
    if (cleanName.length > 120) return res.status(400).json({ error: "Name is too long." });
    if (attendance !== "attending" && attendance !== "declined") return res.status(400).json({ error: "Please select Attending or Declined." });
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return res.status(400).json({ error: "Email address looks invalid." });
    const normalizeMeal = (val: unknown): string | null => {
      if (typeof val !== "string") return null;
      const trimmed = val.trim().toLowerCase();
      if (!trimmed || trimmed === "none" || trimmed === "no_preference") return null;
      return val.trim();
    };
    const isAttending = attendance === "attending";
    const wantsPlusOne = isAttending && plusOne === true;
    const [created] = await db.insert(guests).values({
      profileId: profile.id,
      name: cleanName,
      email: cleanEmail || null,
      rsvpStatus: attendance,
      mealChoice: isAttending ? normalizeMeal(mealChoice) : null,
      dietaryNotes: typeof dietaryRestrictions === "string" && dietaryRestrictions.trim() ? dietaryRestrictions.trim() : null,
      plusOne: wantsPlusOne,
      plusOneName: wantsPlusOne && typeof plusOneName === "string" && plusOneName.trim() ? plusOneName.trim() : null,
      plusOneMealChoice: wantsPlusOne ? normalizeMeal(plusOneMealChoice) : null,
      notes: "Guest used RSVP anyway because they could not find themselves on the guest list. Review before sending future invites.",
      rsvpMessage: typeof message === "string" && message.trim() ? message.trim().slice(0, 1000) : null,
      needsHotel: false,
      bookedHotelBlockId: null,
      bookedHotelRoomCount: null,
      source: "rsvp_self_add",
    }).returning();
    res.json({ success: true, status: attendance, guestId: created.id });
  } catch (err) {
    req.log.error(err, "invitationShareSelfAdd failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/invitation-shares/:token/rsvp", publicRsvpLimiter, async (req, res) => {
  try {
    if (await sendMaintenanceIfActive(res, "rsvp")) return;
    const profile = await resolveInvitationShare(String(req.params.token ?? ""));
    if (!profile) return res.status(404).json({ error: "Not found" });
    const {
      guestId,
      guestName,
      attendance,
      mealChoice,
      plusOne,
      plusOneName,
      plusOneMealChoice,
      dietaryRestrictions,
      hotelNeeded,
      bookedHotelBlockId,
      bookedHotelRoomCount,
      message,
    } = (req.body ?? {}) as Record<string, any>;
    if (!guestId || !Number.isFinite(Number(guestId))) return res.status(400).json({ error: "Missing guestId" });
    if (attendance !== "attending" && attendance !== "declined") return res.status(400).json({ error: "Please select Attending or Declined." });
    const [guest] = await db
      .select()
      .from(guests)
      .where(and(eq(guests.id, Number(guestId)), eq(guests.profileId, profile.id)))
      .limit(1);
    if (!guest) return res.status(404).json({ error: "Guest not found on this guest list." });
    if (normalizeGuestLookupName(guestName) !== normalizeGuestLookupName(guest.name)) {
      return res.status(403).json({ error: "Please select your name from the guest search again." });
    }
    const normalizeMeal = (val: unknown): string | null => {
      if (typeof val !== "string") return null;
      const trimmed = val.trim().toLowerCase();
      if (!trimmed || trimmed === "none" || trimmed === "no_preference") return null;
      return val.trim();
    };
    const updateData: Partial<typeof guests.$inferInsert> = {
      rsvpStatus: attendance,
      dietaryNotes: typeof dietaryRestrictions === "string" && dietaryRestrictions.trim() ? dietaryRestrictions.trim() : null,
    };
    if (typeof message === "string") updateData.rsvpMessage = message.trim().slice(0, 1000) || null;
    if (attendance === "attending") {
      updateData.mealChoice = normalizeMeal(mealChoice);
      updateData.needsHotel = false;
      updateData.bookedHotelBlockId = null;
      updateData.bookedHotelRoomCount = null;
      if (plusOne !== undefined) {
        updateData.plusOne = !!plusOne;
        const finalName = typeof plusOneName === "string" ? plusOneName.trim() : "";
        updateData.plusOneName = plusOne && finalName ? finalName : null;
        updateData.plusOneMealChoice = plusOne ? normalizeMeal(plusOneMealChoice) : null;
      }
    } else {
      updateData.plusOne = false;
      updateData.plusOneName = null;
      updateData.plusOneMealChoice = null;
      updateData.mealChoice = null;
      updateData.needsHotel = false;
      updateData.bookedHotelBlockId = null;
      updateData.bookedHotelRoomCount = null;
    }
    await db.update(guests).set(updateData).where(and(eq(guests.id, guest.id), eq(guests.profileId, profile.id)));
    res.json({ success: true, status: attendance });
  } catch (err) {
    req.log.error(err, "invitationShareRsvpSubmit failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------- GET /api/website/public/:slug/media/* ----------
//
// Public wedding sites need to show photos to unauthenticated guests, but the
// original uploads live behind authenticated object storage. This route serves
// only private objects that are referenced by the published site payload and
// only with the HMAC token generated by buildPublicWebsitePayload().
router.get("/website/public/:slug/media/*objectPath", async (req: Request, res: Response) => {
  try {
    if (await sendMaintenanceIfActive(res, "wedding-website")) return;
    const slug = String(req.params.slug ?? "").toLowerCase();
    const rawPath = req.params.objectPath;
    const mediaPath = Array.isArray(rawPath) ? rawPath.join("/") : String(rawPath ?? "");
    const objectPath = normalizePrivateMediaPath(`/objects/${mediaPath}`);
    if (!slug || !objectPath) return res.status(400).json({ error: "Invalid media path" });
    if (objectPath.includes("..") || objectPath.includes("\\")) {
      return res.status(400).json({ error: "Invalid media path" });
    }

    const [row] = await db
      .select()
      .from(weddingWebsites)
      .where(eq(weddingWebsites.slug, slug))
      .limit(1);
    if (!row || !row.published) return res.status(404).json({ error: "Not found" });
    if (!verifyWebsiteMedia(row, objectPath, req.query.t)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const party = await db
      .select({ photoUrl: weddingParty.photoUrl })
      .from(weddingParty)
      .where(eq(weddingParty.profileId, row.profileId));
    if (!collectWebsiteMediaPaths(row, party).has(objectPath)) {
      return res.status(404).json({ error: "Not found" });
    }

    const file = await objectStorageService.getObjectEntityFile(objectPath);
    const response = await objectStorageService.downloadObject(file);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      return res.status(404).json({ error: "Not found" });
    }
    req.log.error(err, "publicWebsiteMedia failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------- GET /api/website/public/:slug ----------
//
// Public, unauthenticated. Returns the rendered website data the guest site
// needs to display the page. If the website has a password set, the caller
// must supply it via the X-Site-Password request header (NOT a query param,
// to avoid passwords appearing in server logs and browser history).

router.get("/website/public/:slug", async (req, res) => {
  try {
    if (await sendMaintenanceIfActive(res, "wedding-website")) return;
    const slug = String(req.params.slug ?? "").toLowerCase();
    if (!slug) return res.status(400).json({ error: "Slug required" });

    const [row] = await db
      .select()
      .from(weddingWebsites)
      .where(eq(weddingWebsites.slug, slug))
      .limit(1);
    if (!row) return res.status(404).json({ error: "Not found" });
    if (!row.published) return res.status(404).json({ error: "Not found" });

    if (row.password) {
      const supplied = req.headers["x-site-password"];
      const suppliedStr = typeof supplied === "string" ? supplied : "";
      const passwordValid = await verifyPassword(suppliedStr, row.password);
      if (!passwordValid) {
        return res.status(401).json({
          passwordRequired: true,
          coupleNames: null,
        });
      }
      // Transparent migration: re-hash legacy plaintext passwords on first match.
      if (!row.password.startsWith("scrypt:")) {
        const hashed = await hashPassword(suppliedStr);
        await db.update(weddingWebsites).set({ password: hashed }).where(eq(weddingWebsites.id, row.id));
      }
    }

    const payload = await buildPublicWebsitePayload(row);
    if (!payload) return res.status(404).json({ error: "Not found" });
    res.json(payload);
  } catch (err) {
    req.log.error(err, "publicWebsite failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------- POST /api/website/public/:slug/unlock ----------
//
// Browser-friendly unlock endpoint for password-protected sites. The public
// page can submit the guest-entered password in the JSON body instead of using
// a custom request header for the initial site load.
router.post("/website/public/:slug/unlock", websiteUnlockLimiter, async (req, res) => {
  try {
    if (await sendMaintenanceIfActive(res, "wedding-website")) return;
    const slug = String(req.params.slug ?? "").toLowerCase();
    if (!slug) return res.status(400).json({ error: "Slug required" });

    const [row] = await db
      .select()
      .from(weddingWebsites)
      .where(eq(weddingWebsites.slug, slug))
      .limit(1);
    if (!row || !row.published) return res.status(404).json({ error: "Not found" });
    if (!row.password) {
      const payload = await buildPublicWebsitePayload(row);
      if (!payload) return res.status(404).json({ error: "Not found" });
      return res.json(payload);
    }

    const supplied = String(req.body?.password ?? "").trim();
    const passwordValid = await verifyPassword(supplied, row.password);
    if (!passwordValid) {
      return res.status(401).json({ passwordRequired: true });
    }

    if (!row.password.startsWith("scrypt:")) {
      const hashed = await hashPassword(supplied);
      await db.update(weddingWebsites).set({ password: hashed }).where(eq(weddingWebsites.id, row.id));
    }

    const payload = await buildPublicWebsitePayload(row);
    if (!payload) return res.status(404).json({ error: "Not found" });
    res.json(payload);
  } catch (err) {
    req.log.error(err, "publicWebsiteUnlock failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------- Public RSVP integration ----------
//
// Guests on the wedding website RSVP without a personalized token. They type
// their name, we look them up in the guest list scoped to this site's profile,
// and submit updates the matched guest record (same fields the existing
// /rsvp/:token POST writes). The published flag must be true and the password
// (if set) must match — same gating as the public site itself.

// resolvePublishedSite reads the password from the X-Site-Password header
// (GET requests) or falls back to the request body (POST requests). This
// keeps passwords out of query strings, URLs, and server logs.
import type { Request as ExpressRequest } from "express";

const DEFAULT_RSVP_MEAL_OPTIONS = [
  { value: "chicken", label: "Chicken" },
  { value: "steak", label: "Steak" },
  { value: "fish", label: "Fish" },
  { value: "none", label: "None / No preference" },
];

function normalizeGuestLookupName(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, " ") : "";
}

function normalizeMealOptions(value: unknown): Array<{ value: string; label: string }> {
  if (!Array.isArray(value)) return DEFAULT_RSVP_MEAL_OPTIONS;
  const seen = new Set<string>();
  const options = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const raw = item as { value?: unknown; label?: unknown };
      const optionValue = typeof raw.value === "string" ? raw.value.trim() : "";
      const label = typeof raw.label === "string" ? raw.label.trim() : "";
      if (!optionValue || !label || seen.has(optionValue)) return null;
      seen.add(optionValue);
      return { value: optionValue, label };
    })
    .filter((item): item is { value: string; label: string } => !!item)
    .slice(0, 12);
  return options.length ? options : DEFAULT_RSVP_MEAL_OPTIONS;
}

async function resolvePublishedSite(slug: string, req: ExpressRequest) {
  const [row] = await db
    .select()
    .from(weddingWebsites)
    .where(eq(weddingWebsites.slug, slug.toLowerCase()))
    .limit(1);
  if (!row || !row.published) return { ok: false as const, status: 404 };
  if (row.password) {
    // Accept password from header (GET) or from body (POST, for backward compat).
    const headerVal = req.headers["x-site-password"];
    const supplied =
      typeof headerVal === "string"
        ? headerVal
        : (req.body?.password ? String(req.body.password) : "");
    const valid = await verifyPassword(supplied, row.password);
    if (!valid) {
      return { ok: false as const, status: 401 };
    }
    // Transparent migration: re-hash legacy plaintext on first successful match.
    if (!row.password.startsWith("scrypt:")) {
      const hashed = await hashPassword(supplied);
      await db.update(weddingWebsites).set({ password: hashed }).where(eq(weddingWebsites.id, row.id));
    }
  }
  return { ok: true as const, site: row };
}

async function normalizeHotelRsvp(
  profileId: number,
  attendance: string | undefined,
  hotelNeeded: unknown,
  bookedHotelBlockId: unknown,
  bookedHotelRoomCount: unknown,
): Promise<Pick<typeof guests.$inferInsert, "needsHotel" | "bookedHotelBlockId" | "bookedHotelRoomCount">> {
  if (attendance !== "attending") {
    return { needsHotel: false, bookedHotelBlockId: null, bookedHotelRoomCount: null };
  }
  const wantsHotel = hotelNeeded === true || hotelNeeded === "true";
  if (!wantsHotel) return { needsHotel: false, bookedHotelBlockId: null, bookedHotelRoomCount: null };

  const roomCount = Number(bookedHotelRoomCount);
  const normalizedRoomCount = Number.isInteger(roomCount) && roomCount >= 1 && roomCount <= 2 ? roomCount : 1;
  const update: Pick<typeof guests.$inferInsert, "needsHotel" | "bookedHotelBlockId" | "bookedHotelRoomCount"> = {
    needsHotel: true,
    bookedHotelBlockId: null,
    bookedHotelRoomCount: normalizedRoomCount,
  };
  if (bookedHotelBlockId !== undefined && bookedHotelBlockId !== null && bookedHotelBlockId !== "") {
    const hotelId = Number(bookedHotelBlockId);
    if (!Number.isInteger(hotelId) || hotelId <= 0) {
      throw new Error("Invalid hotel block selection.");
    }
    const [hotel] = await db
      .select({ id: hotelBlocks.id })
      .from(hotelBlocks)
      .where(and(eq(hotelBlocks.id, hotelId), eq(hotelBlocks.profileId, profileId)))
      .limit(1);
    if (!hotel) throw new Error("That hotel block is not available for this RSVP.");
    update.bookedHotelBlockId = hotel.id;
  }
  return update;
}

// GET /api/website/public/:slug/guests/search?q=name
// Returns guests on this wedding's list whose name fuzzy-matches the query.
// Limit 10 to keep the page responsive and reduce enumeration risk.
// H-2: Strict rate limit + removed rsvpStatus/plusOne from response.
router.get("/website/public/:slug/guests/search", guestSearchLimiter, async (req, res) => {
  try {
    if (await sendMaintenanceIfActive(res, "wedding-website")) return;
    const slug = String(req.params.slug ?? "").toLowerCase();
    const q = String(req.query.q ?? "").trim();
    if (q.length < 2) return res.json({ matches: [] });

    const r = await resolvePublishedSite(slug, req);
    if (!r.ok) return res.status(r.status).json({ error: r.status === 401 ? "Password required" : "Not found" });

    const rows = await db
      .select({
        id: guests.id,
        name: guests.name,
      })
      .from(guests)
      .where(and(eq(guests.profileId, r.site.profileId), ilike(guests.name, `%${q.replace(/[%_]/g, "\\$&")}%`)))
      .limit(10);

    res.json({ matches: rows });
  } catch (err) {
    req.log.error(err, "websiteRsvpSearch failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/website/public/:slug/guests/:guestId — fetch the single guest's
// current RSVP details so the form can pre-fill (for guests editing their reply).
router.get("/website/public/:slug/guests/:guestId", guestSearchLimiter, async (req, res) => {
  try {
    if (await sendMaintenanceIfActive(res, "wedding-website")) return;
    const slug = String(req.params.slug ?? "").toLowerCase();
    const guestId = parseInt(String(req.params.guestId), 10);
    if (!Number.isFinite(guestId)) return res.status(400).json({ error: "Bad guest id" });

    const r = await resolvePublishedSite(slug, req);
    if (!r.ok) return res.status(r.status).json({ error: r.status === 401 ? "Password required" : "Not found" });

    const [guest] = await db
      .select()
      .from(guests)
      .where(and(eq(guests.id, guestId), eq(guests.profileId, r.site.profileId)))
      .limit(1);
    if (!guest) return res.status(404).json({ error: "Guest not found" });
    if (normalizeGuestLookupName(req.query.name) !== normalizeGuestLookupName(guest.name)) {
      return res.status(403).json({ error: "Please select your name from the guest search again." });
    }

    if (guest.rsvpStatus && guest.rsvpStatus !== "pending") {
      return res.json({
        id: guest.id,
        name: guest.name,
        rsvpStatus: guest.rsvpStatus,
      });
    }

    res.json({
      id: guest.id,
      name: guest.name,
      rsvpStatus: guest.rsvpStatus,
      mealChoice: guest.mealChoice,
      dietaryNotes: guest.dietaryNotes,
      plusOne: guest.plusOne,
      plusOneName: guest.plusOneName,
      plusOneMealChoice: guest.plusOneMealChoice,
      needsHotel: guest.needsHotel,
      bookedHotelBlockId: guest.bookedHotelBlockId,
      bookedHotelRoomCount: guest.bookedHotelRoomCount,
    });
  } catch (err) {
    req.log.error(err, "websiteRsvpGetGuest failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/website/preview/guests/search?q=name — authenticated owner-only
// search used by the editor's "Guest Preview" overlay before the site is
// published. Searches the owner's guest list directly; no published check.
router.get("/website/preview/guests/search", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) return res.status(403).json({ error: "Insufficient permissions." });
    const profile = await resolveProfile(req);
    if (!profile) return res.status(404).json({ error: "Wedding profile not found" });
    const q = String(req.query.q ?? "").trim();
    if (q.length < 2) return res.json({ matches: [] });

    const rows = await db
      .select({
        id: guests.id,
        name: guests.name,
        rsvpStatus: guests.rsvpStatus,
        plusOne: guests.plusOne,
      })
      .from(guests)
      .where(and(eq(guests.profileId, profile.id), ilike(guests.name, `%${q.replace(/[%_]/g, "\\$&")}%`)))
      .limit(10);

    res.json({ matches: rows });
  } catch (err) {
    req.log.error(err, "websiteRsvpPreviewSearch failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/website/preview/guests/:guestId — authenticated owner-only fetch
// of a single guest, for the preview RSVP flow.
router.get("/website/preview/guests/:guestId", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) return res.status(403).json({ error: "Insufficient permissions." });
    const profile = await resolveProfile(req);
    if (!profile) return res.status(404).json({ error: "Wedding profile not found" });
    const guestId = parseInt(String(req.params.guestId), 10);
    if (!Number.isFinite(guestId)) return res.status(400).json({ error: "Bad guest id" });

    const [guest] = await db
      .select()
      .from(guests)
      .where(and(eq(guests.id, guestId), eq(guests.profileId, profile.id)))
      .limit(1);
    if (!guest) return res.status(404).json({ error: "Guest not found" });

    res.json({
      id: guest.id,
      name: guest.name,
      rsvpStatus: guest.rsvpStatus,
      mealChoice: guest.mealChoice,
      dietaryNotes: guest.dietaryNotes,
      plusOne: guest.plusOne,
      plusOneName: guest.plusOneName,
      plusOneMealChoice: guest.plusOneMealChoice,
      needsHotel: guest.needsHotel,
      bookedHotelBlockId: guest.bookedHotelBlockId,
      bookedHotelRoomCount: guest.bookedHotelRoomCount,
    });
  } catch (err) {
    req.log.error(err, "websiteRsvpPreviewGetGuest failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/website/public/:slug/rsvp/self-add — guest is not on the list
// but wants to RSVP anyway. Create a new guest record marked as self-added so
// the couple can manually verify them in the portal, and record the RSVP in
// the same shape as the existing flow above.
router.post("/website/public/:slug/rsvp/self-add", publicRsvpLimiter, async (req, res) => {
  try {
    if (await sendMaintenanceIfActive(res, "wedding-website")) return;
    const slug = String(req.params.slug ?? "").toLowerCase();
    const r = await resolvePublishedSite(slug, req);
    if (!r.ok) return res.status(r.status).json({ error: r.status === 401 ? "Password required" : "Not found" });

    const {
      name,
      email,
      attendance,
      mealChoice,
      plusOne,
      plusOneName,
      plusOneMealChoice,
      dietaryRestrictions,
      hotelNeeded,
      bookedHotelBlockId,
      bookedHotelRoomCount,
      message,
    } = (req.body ?? {}) as {
      name?: string;
      email?: string;
      attendance?: string;
      mealChoice?: string;
      plusOne?: boolean;
      plusOneName?: string;
      plusOneMealChoice?: string;
      dietaryRestrictions?: string;
      hotelNeeded?: boolean;
      bookedHotelBlockId?: number | null;
      bookedHotelRoomCount?: number | null;
      message?: string;
    };

    const cleanName = typeof name === "string" ? name.trim() : "";
    if (!cleanName) return res.status(400).json({ error: "Please enter your full name." });
    if (cleanName.length > 120) return res.status(400).json({ error: "Name is too long." });
    if (attendance !== "attending" && attendance !== "declined") {
      return res.status(400).json({ error: "Please select Attending or Declined." });
    }

    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: "Email address looks invalid." });
    }

    const normalizeMeal = (val: unknown): string | null => {
      if (typeof val !== "string") return null;
      const trimmed = val.trim().toLowerCase();
      if (!trimmed || trimmed === "none" || trimmed === "no_preference") return null;
      return val.trim();
    };

    const dietaryClean = typeof dietaryRestrictions === "string" && dietaryRestrictions.trim()
      ? dietaryRestrictions.trim()
      : null;

    const messageClean = typeof message === "string" && message.trim()
      ? message.trim().slice(0, 1000)
      : "";

    const isAttending = attendance === "attending";
    const wantsPlusOne = isAttending && plusOne === true;
    const cleanPlusOneName = typeof plusOneName === "string" ? plusOneName.trim() : "";
    const [created] = await db.insert(guests).values({
      profileId: r.site.profileId,
      name: cleanName,
      email: cleanEmail || null,
      rsvpStatus: attendance,
      mealChoice: isAttending ? normalizeMeal(mealChoice) : null,
      dietaryNotes: dietaryClean,
      plusOne: wantsPlusOne,
      plusOneName: wantsPlusOne && cleanPlusOneName ? cleanPlusOneName : null,
      plusOneMealChoice: wantsPlusOne ? normalizeMeal(plusOneMealChoice) : null,
      // Notes column is reserved for couple-authored notes; the guest's
      // RSVP message lives in rsvpMessage so it can render in the RSVP
      // column on the guest list page.
      notes: "Guest used RSVP anyway because they could not find themselves on the guest list. Review before sending future invites.",
      rsvpMessage: messageClean || null,
      needsHotel: false,
      bookedHotelBlockId: null,
      bookedHotelRoomCount: null,
      source: "rsvp_self_add",
    }).returning();

    res.json({ success: true, status: attendance, guestId: created.id });
  } catch (err) {
    req.log.error(err, "websiteRsvpSelfAdd failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/website/public/:slug/rsvp — submit/update RSVP for a guest.
// Same write semantics as POST /rsvp/:token but identifies the guest by
// guestId (returned from the search endpoint) instead of a token.
router.post("/website/public/:slug/rsvp", publicRsvpLimiter, async (req, res) => {
  try {
    if (await sendMaintenanceIfActive(res, "wedding-website")) return;
    const slug = String(req.params.slug ?? "").toLowerCase();
    const r = await resolvePublishedSite(slug, req);
    if (!r.ok) return res.status(r.status).json({ error: r.status === 401 ? "Password required" : "Not found" });

    const {
      guestId,
      guestName,
      attendance,
      mealChoice,
      plusOne,
      plusOneName,
      plusOneMealChoice,
      dietaryRestrictions,
      hotelNeeded,
      bookedHotelBlockId,
      bookedHotelRoomCount,
      message,
    } = (req.body ?? {}) as {
      guestId?: number;
      guestName?: string;
      attendance?: string;
      mealChoice?: string;
      plusOne?: boolean;
      plusOneName?: string;
      plusOneMealChoice?: string;
      dietaryRestrictions?: string;
      hotelNeeded?: boolean;
      bookedHotelBlockId?: number | null;
      bookedHotelRoomCount?: number | null;
      message?: string;
    };

    if (!guestId || !Number.isFinite(guestId)) return res.status(400).json({ error: "Missing guestId" });
    if (attendance !== "attending" && attendance !== "declined") {
      return res.status(400).json({ error: "Please select Attending or Declined." });
    }

    const [guest] = await db
      .select()
      .from(guests)
      .where(and(eq(guests.id, guestId), eq(guests.profileId, r.site.profileId)))
      .limit(1);
    if (!guest) return res.status(404).json({ error: "Guest not found on this guest list." });
    if (normalizeGuestLookupName(guestName) !== normalizeGuestLookupName(guest.name)) {
      return res.status(403).json({ error: "Please select your name from the guest search again." });
    }

    const normalizeMeal = (val: unknown): string | null => {
      if (typeof val !== "string") return null;
      const trimmed = val.trim().toLowerCase();
      if (!trimmed || trimmed === "none" || trimmed === "no_preference") return null;
      return val.trim();
    };

    const updateData: Partial<typeof guests.$inferInsert> = {
      rsvpStatus: attendance,
      dietaryNotes: typeof dietaryRestrictions === "string" && dietaryRestrictions.trim()
        ? dietaryRestrictions.trim()
        : null,
    };
    if (typeof message === "string") {
      const trimmed = message.trim().slice(0, 1000);
      updateData.rsvpMessage = trimmed || null;
    }

    if (attendance === "attending") {
      updateData.mealChoice = normalizeMeal(mealChoice);
      updateData.needsHotel = false;
      updateData.bookedHotelBlockId = null;
      updateData.bookedHotelRoomCount = null;
      if (plusOne !== undefined) {
        updateData.plusOne = !!plusOne;
        const finalName = typeof plusOneName === "string" ? plusOneName.trim() : "";
        updateData.plusOneName = plusOne && finalName ? finalName : null;
        updateData.plusOneMealChoice = plusOne ? normalizeMeal(plusOneMealChoice) : null;
      }
    } else {
      updateData.plusOne = false;
      updateData.plusOneName = null;
      updateData.plusOneMealChoice = null;
      updateData.mealChoice = null;
      updateData.needsHotel = false;
      updateData.bookedHotelBlockId = null;
      updateData.bookedHotelRoomCount = null;
    }

    await db.update(guests).set(updateData).where(and(eq(guests.id, guest.id), eq(guests.profileId, r.site.profileId)));

    res.json({ success: true, status: attendance });
  } catch (err) {
    req.log.error(err, "websiteRsvpSubmit failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------- POST /api/website/rsvp/:slug ----------
// Public — no auth required. Guests submit their RSVP.

router.post("/website/rsvp/:slug", publicRsvpLimiter, async (req, res) => {
  try {
    if (await sendMaintenanceIfActive(res, "wedding-website")) return;
    const slug = String(req.params.slug ?? "").toLowerCase();
    if (!slug) return res.status(400).json({ error: "Slug required" });

    const siteResult = await resolvePublishedSite(slug, req);
    if (!siteResult.ok) {
      return res.status(siteResult.status).json({ error: siteResult.status === 401 ? "Password required" : "Not found" });
    }
    const row = siteResult.site;

    const { name, email, attending, plusOneCount, dietaryRestrictions, message } = (req.body ?? {}) as {
      name?: string;
      email?: string;
      attending?: string;
      plusOneCount?: number;
      dietaryRestrictions?: string;
      message?: string;
    };

    if (!name?.trim()) return res.status(400).json({ error: "Name is required" });
    const cleanEmail = typeof email === "string" ? email.trim().slice(0, 200).toLowerCase() : "";
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: "Email address looks invalid." });
    }
    const att = attending === "no" ? "no" : attending === "maybe" ? "maybe" : "yes";

    const [created] = await db
      .insert(websiteRsvps)
      .values({
        websiteId: row.id,
        name: name.trim().slice(0, 120),
        email: cleanEmail || null,
        attending: att,
        plusOneCount: Math.max(0, Math.min(10, Number(plusOneCount) || 0)),
        dietaryRestrictions: dietaryRestrictions?.trim().slice(0, 500) || null,
        message: message?.trim().slice(0, 1000) || null,
      })
      .returning({ id: websiteRsvps.id });

    res.status(201).json({ success: true, id: created.id });
  } catch (err) {
    req.log.error(err, "submitRsvp failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------- GET /api/website/rsvps ----------
// Authenticated — returns RSVPs for the couple's own website.

router.get("/website/rsvps", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) return res.status(403).json({ error: "Insufficient permissions." });
    const profile = await resolveProfile(req);
    if (!profile) return res.status(404).json({ error: "Wedding profile not found" });

    const [site] = await db
      .select({ id: weddingWebsites.id })
      .from(weddingWebsites)
      .where(eq(weddingWebsites.profileId, profile.id))
      .limit(1);
    if (!site) return res.status(404).json({ error: "Website not created yet" });

    // Simple anonymous RSVPs (old flow)
    const anonymousRsvps = await db
      .select()
      .from(websiteRsvps)
      .where(eq(websiteRsvps.websiteId, site.id))
      .orderBy(desc(websiteRsvps.submittedAt));

    // Guest-list RSVPs: guests who replied via the name-search flow
    const guestListRsvps = await db
      .select({
        id: guests.id,
        name: guests.name,
        email: guests.email,
        rsvpStatus: guests.rsvpStatus,
        plusOne: guests.plusOne,
        dietaryNotes: guests.dietaryNotes,
        createdAt: guests.createdAt,
      })
      .from(guests)
      .where(and(eq(guests.profileId, profile.id), not(eq(guests.rsvpStatus, "pending"))));

    // Normalise guest-list entries into the same shape as anonymous RSVPs
    const guestEntries = guestListRsvps.map((g) => ({
      id: -(g.id), // negative IDs to avoid collisions
      name: g.name,
      email: g.email ?? null,
      attending: g.rsvpStatus === "attending" ? "yes" : g.rsvpStatus === "declined" ? "no" : "maybe",
      plusOneCount: g.plusOne ? 1 : 0,
      dietaryRestrictions: g.dietaryNotes ?? null,
      message: null,
      submittedAt: g.createdAt.toISOString(),
      source: "guest_list" as const,
    }));

    const anonymousEntries = anonymousRsvps.map((r) => ({ ...r, source: "website" as const }));

    const allRsvps = [
      ...guestEntries,
      ...anonymousEntries,
    ].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    const yes = allRsvps.filter((r) => r.attending === "yes");
    const no = allRsvps.filter((r) => r.attending === "no");
    const maybe = allRsvps.filter((r) => r.attending === "maybe");
    const totalGuests = yes.reduce((s, r) => s + 1 + r.plusOneCount, 0);

    res.json({ rsvps: allRsvps, summary: { yes: yes.length, no: no.length, maybe: maybe.length, totalGuests } });
  } catch (err) {
    req.log.error(err, "getRsvps failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
