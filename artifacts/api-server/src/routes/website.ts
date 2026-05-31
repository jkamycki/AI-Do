import { Router, type Request, type Response } from "express";
import multer from "multer";
import { scrypt, randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import { promisify } from "node:util";
import { Readable } from "node:stream";
import rateLimit from "express-rate-limit";
import { db, weddingWebsites, weddingProfiles, guests, websiteRsvps, weddingParty, hotelBlocks, invitationCustomizations, guestPhotoUploads, guestPhotoUploadLocks } from "@workspace/db";
import type { WeddingProfile, WebsiteSectionsEnabled, WebsiteCustomText, WebsiteGalleryImage, WebsiteHeroImage, WebsiteTextStyles, WebsiteTextPositions } from "@workspace/db";
import { and, eq, ilike, desc, inArray, not, sql } from "drizzle-orm";
import { openai, getModel } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../middlewares/requireAuth";
import { publicRsvpLimiter } from "../middlewares/rateLimiter";
import { hasMinRole, resolveCallerRole, resolveProfile } from "../lib/workspaceAccess";
import { sendMaintenanceIfActive } from "../lib/maintenance";
import { getRequestLanguage } from "../lib/language";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";
import { sendGuestRsvpBackupEmail, sendWebsiteRsvpBackupEmail } from "../lib/rsvpBackupEmail";
import { normalizePlusOneStatus, plusOneCountsAsGuest, plusOneNameForStatus } from "../lib/plusOneStatus";

const scryptAsync = promisify(scrypt);
const GUEST_PHOTO_WEBSITE_GALLERY_LIMIT = 50;

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

const guestPhotoPublicLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { error: "Too many photo uploads. Please wait a few minutes and try again." },
});

const guestPhotoUsageLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { error: "Too many photo drop checks. Please wait a moment and try again." },
});

const GUEST_PHOTO_MAX_FILES = 10;
const GUEST_PHOTO_MAX_FILE_BYTES = 5 * 1024 * 1024;
const GUEST_PHOTO_ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const guestPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: GUEST_PHOTO_MAX_FILE_BYTES, files: GUEST_PHOTO_MAX_FILES },
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype || "").toLowerCase();
    const name = (file.originalname || "").toLowerCase();
    const extensionOk = /\.(jpe?g|png|webp|heic|heif)$/.test(name);
    if (GUEST_PHOTO_ALLOWED_MIMES.has(mime) || extensionOk) {
      cb(null, true);
      return;
    }
    cb(new Error("Please upload JPG, PNG, WEBP, or HEIC photos only."));
  },
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

function normalizeMediaTail(rawTail: string): string | null {
  const tail = rawTail.split(/[?#]/)[0].replace(/^\/+/, "");
  if (!tail || tail.includes("..") || tail.includes("\\")) return null;
  const decoded = tail
    .split("/")
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    })
    .join("/");
  return decoded || null;
}

function objectPathFromMediaTail(rawTail: string): string | null {
  const tail = normalizeMediaTail(rawTail);
  return tail ? `/objects/${tail}` : null;
}

function privateMediaPathFromPathname(pathname: string): string | null {
  try {
    const parsed = new URL(pathname);
    return privateMediaPathFromPathname(parsed.pathname);
  } catch {
    // Relative paths are handled below.
  }

  const path = pathname.trim();
  if (path.startsWith("/api/storage/objects/")) {
    return objectPathFromMediaTail(path.slice("/api/storage/objects/".length));
  }
  if (path.startsWith("/storage/objects/")) {
    return objectPathFromMediaTail(path.slice("/storage/objects/".length));
  }
  if (path.startsWith("/api/website/media/")) {
    return objectPathFromMediaTail(path.slice("/api/website/media/".length));
  }
  if (path.startsWith("/objects/")) {
    return objectPathFromMediaTail(path.slice("/objects/".length));
  }
  const publicMediaMatch = path.match(/\/api\/website\/public\/[^/]+\/media\/(.+)$/);
  if (publicMediaMatch) return objectPathFromMediaTail(publicMediaMatch[1]);
  return null;
}

function normalizePrivateMediaPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return privateMediaPathFromPathname(trimmed);
}

function normalizeWebsiteImageForStorage(raw: string): string {
  const objectPath = normalizePrivateMediaPath(raw);
  return objectPath ?? raw;
}

function normalizeWebsiteImagesForStorage<T extends { url: string }>(items: T[], limit: number): T[] {
  return items.slice(0, limit).map((item) => ({
    ...item,
    url: normalizeWebsiteImageForStorage(item.url),
  }));
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

type GuestPhotoDropSettings = {
  enabled: boolean;
  galleryEnabled: boolean;
  displayMode: "portal" | "website" | "both";
  approvalRequired: boolean;
  maxUploads: number;
  uploadLimitMb: number;
  title: string;
  instructions: string;
};

const DEFAULT_GUEST_PHOTO_SETTINGS: GuestPhotoDropSettings = {
  enabled: false,
  galleryEnabled: true,
  displayMode: "both",
  approvalRequired: true,
  maxUploads: 10,
  uploadLimitMb: 5,
  title: "Guest Photo Drop",
  instructions: "Share your favorite moments from the wedding day. The couple will review photos before they appear on the website.",
};

function boolSetting(value: unknown, fallback: boolean): boolean {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return fallback;
}

function guestPhotoDisplayMode(value: unknown, galleryEnabled: boolean): GuestPhotoDropSettings["displayMode"] {
  if (value === "portal" || value === "website" || value === "both") return value;
  return galleryEnabled ? "both" : "portal";
}

function guestPhotoShowsOnWebsite(settings: Pick<GuestPhotoDropSettings, "enabled" | "displayMode">): boolean {
  return settings.enabled && (settings.displayMode === "website" || settings.displayMode === "both");
}

function guestPhotoDropSettings(customText: WebsiteCustomText | null | undefined): GuestPhotoDropSettings {
  const text = customText ?? {};
  const maxUploadsRaw = Number(text._guestPhotoMaxUploads);
  const maxUploads = Number.isFinite(maxUploadsRaw)
    ? Math.max(1, Math.min(GUEST_PHOTO_MAX_FILES, Math.floor(maxUploadsRaw)))
    : DEFAULT_GUEST_PHOTO_SETTINGS.maxUploads;
  const legacyGalleryEnabled = boolSetting(text._guestPhotoGalleryEnabled, DEFAULT_GUEST_PHOTO_SETTINGS.galleryEnabled);
  const displayMode = guestPhotoDisplayMode(text._guestPhotoDisplayMode, legacyGalleryEnabled);
  return {
    enabled: boolSetting(text._guestPhotoDropEnabled, DEFAULT_GUEST_PHOTO_SETTINGS.enabled),
    galleryEnabled: displayMode === "website" || displayMode === "both",
    displayMode,
    approvalRequired: true,
    maxUploads,
    uploadLimitMb: DEFAULT_GUEST_PHOTO_SETTINGS.uploadLimitMb,
    title: typeof text._guestPhotoTitle === "string" && text._guestPhotoTitle.trim()
      ? text._guestPhotoTitle.trim().slice(0, 80)
      : DEFAULT_GUEST_PHOTO_SETTINGS.title,
    instructions: typeof text._guestPhotoInstructions === "string" && text._guestPhotoInstructions.trim()
      ? text._guestPhotoInstructions.trim().slice(0, 500)
      : DEFAULT_GUEST_PHOTO_SETTINGS.instructions,
  };
}

function mergeGuestPhotoDropSettings(
  current: WebsiteCustomText,
  patch: Partial<GuestPhotoDropSettings>,
): WebsiteCustomText {
  const next = { ...current };
  if (typeof patch.enabled === "boolean") next._guestPhotoDropEnabled = String(patch.enabled);
  if (patch.displayMode === "portal" || patch.displayMode === "website" || patch.displayMode === "both") {
    next._guestPhotoDisplayMode = patch.displayMode;
    next._guestPhotoGalleryEnabled = String(patch.displayMode === "website" || patch.displayMode === "both");
  } else if (typeof patch.galleryEnabled === "boolean") {
    next._guestPhotoGalleryEnabled = String(patch.galleryEnabled);
    next._guestPhotoDisplayMode = patch.galleryEnabled ? "both" : "portal";
  }
  next._guestPhotoApprovalRequired = "true";
  if (typeof patch.maxUploads === "number" && Number.isFinite(patch.maxUploads)) {
    next._guestPhotoMaxUploads = String(Math.max(1, Math.min(GUEST_PHOTO_MAX_FILES, Math.floor(patch.maxUploads))));
  }
  if (typeof patch.title === "string") next._guestPhotoTitle = patch.title.trim().slice(0, 80);
  if (typeof patch.instructions === "string") next._guestPhotoInstructions = patch.instructions.trim().slice(0, 500);
  return next;
}

const GUEST_PHOTO_CUSTOM_TEXT_KEYS = [
  "_guestPhotoDropEnabled",
  "_guestPhotoGalleryEnabled",
  "_guestPhotoDisplayMode",
  "_guestPhotoApprovalRequired",
  "_guestPhotoMaxUploads",
  "_guestPhotoTitle",
  "_guestPhotoInstructions",
] as const;

function preserveGuestPhotoDropCustomText(
  current: WebsiteCustomText | null | undefined,
  incoming: WebsiteCustomText,
): WebsiteCustomText {
  const next = { ...incoming };
  const existing = current ?? {};
  for (const key of GUEST_PHOTO_CUSTOM_TEXT_KEYS) {
    if (existing[key] !== undefined) next[key] = existing[key];
    else delete next[key];
  }
  return next;
}

function publicGuestPhotoUrl(row: typeof weddingWebsites.$inferSelect, raw: string): string {
  return websiteMediaUrl(row, raw) ?? raw;
}

async function buildPublicPhotoDropPayload(row: typeof weddingWebsites.$inferSelect) {
  const [profile] = await db
    .select()
    .from(weddingProfiles)
    .where(eq(weddingProfiles.id, row.profileId))
    .limit(1);
  if (!profile) return null;

  return {
    slug: row.slug,
    websitePublished: row.published,
    colorPalette: row.colorPalette,
    couple: {
      partner1Name: profile.partner1Name,
      partner2Name: profile.partner2Name,
      weddingDate: profile.weddingDate,
      venue: profile.venue,
    },
    guestPhotoDrop: guestPhotoDropSettings(row.customText),
  };
}

async function resolveGuestPhotoDropSite(slug: string) {
  const [row] = await db
    .select()
    .from(weddingWebsites)
    .where(eq(weddingWebsites.slug, slug.toLowerCase()))
    .limit(1);
  if (!row) return { ok: false as const, status: 404 };
  return { ok: true as const, site: row, settings: guestPhotoDropSettings(row.customText) };
}

function cleanGuestPhotoDeviceId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().slice(0, 160);
  if (value.length < 16) return null;
  return value;
}

function cleanGuestPhotoDeviceFingerprint(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().slice(0, 800);
  if (value.length < 24 || value === "unknown") return null;
  return value;
}

function guestPhotoRemoteBasis(req: Request): string {
  const userAgent = String(req.headers["user-agent"] ?? "").slice(0, 220);
  const forwardedFor = String(req.headers["x-forwarded-for"] ?? "").split(",")[0]?.trim();
  const remoteAddress = forwardedFor || req.ip || req.socket.remoteAddress || "unknown";
  return `fallback:${remoteAddress}:${userAgent}`;
}

function guestPhotoUploadKey(site: typeof weddingWebsites.$inferSelect, basis: string): string {
  return createHmac("sha256", invitationShareSecret())
    .update(`guest-photo:${site.id}:${site.slug}:${basis}`)
    .digest("base64url")
    .slice(0, 48);
}

function guestPhotoUploadKeys(
  req: Request,
  site: typeof weddingWebsites.$inferSelect,
  rawDeviceId: unknown,
  rawDeviceFingerprint: unknown,
): { all: string[]; primary: string } {
  const deviceId = cleanGuestPhotoDeviceId(rawDeviceId);
  const fingerprint = cleanGuestPhotoDeviceFingerprint(rawDeviceFingerprint);
  const bases = [
    fingerprint ? `fingerprint:${fingerprint}` : null,
    deviceId ? `device:${deviceId}` : null,
    guestPhotoRemoteBasis(req),
  ].filter((value): value is string => Boolean(value));
  const all = Array.from(new Set(bases.map((basis) => guestPhotoUploadKey(site, basis))));
  return { all, primary: all[0] };
}

async function countGuestPhotoUploadsForKeys(websiteId: number, uploaderKeys: string[]): Promise<number> {
  if (!uploaderKeys.length) return 0;
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(guestPhotoUploads)
    .where(and(eq(guestPhotoUploads.websiteId, websiteId), inArray(guestPhotoUploads.uploaderKey, uploaderKeys)));
  return Number(row?.count ?? 0);
}

async function hasGuestPhotoUploadLock(websiteId: number, uploaderKeys: string[]): Promise<boolean> {
  if (!uploaderKeys.length) return false;
  const [row] = await db
    .select({ id: guestPhotoUploadLocks.id })
    .from(guestPhotoUploadLocks)
    .where(and(eq(guestPhotoUploadLocks.websiteId, websiteId), inArray(guestPhotoUploadLocks.uploaderKey, uploaderKeys)))
    .limit(1);
  return Boolean(row);
}

async function lockGuestPhotoUploaderKeys(websiteId: number, uploaderKeys: string[]): Promise<void> {
  const uniqueKeys = Array.from(new Set(uploaderKeys.filter(Boolean)));
  if (!uniqueKeys.length) return;
  await db
    .insert(guestPhotoUploadLocks)
    .values(uniqueKeys.map((uploaderKey) => ({ websiteId, uploaderKey })))
    .onConflictDoNothing();
}

function guestPhotoUsage(uploadedCount: number, totalLimit: number) {
  const limit = Math.max(1, Math.min(GUEST_PHOTO_MAX_FILES, Math.floor(totalLimit)));
  const used = Math.max(0, Math.min(limit, Math.floor(uploadedCount)));
  return {
    limit,
    uploadedCount: used,
    remaining: Math.max(0, limit - used),
  };
}

function cleanGuestPhotoName(raw: unknown): string {
  return String(raw ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
}

function cleanGuestPhotoEmail(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase().slice(0, 200);
}

function isValidGuestPhotoEmail(email: string): boolean {
  return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function cleanGuestPhotoCaption(raw: unknown): string {
  return String(raw ?? "").trim().slice(0, 500);
}

function cleanGuestPhotoContentType(raw: unknown): string {
  const contentType = String(raw ?? "").trim().toLowerCase();
  return GUEST_PHOTO_ALLOWED_MIMES.has(contentType) ? contentType : "image/jpeg";
}

function validateGuestPhotoFileDetails(fileName: string, contentType: string, fileSize: number): string | null {
  const extensionOk = /\.(jpe?g|png|webp|heic|heif)$/i.test(fileName);
  if (!GUEST_PHOTO_ALLOWED_MIMES.has(contentType) && !extensionOk) {
    return "Please upload JPG, PNG, WEBP, or HEIC photos only.";
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0) return "Photo file size is required.";
  if (fileSize > GUEST_PHOTO_MAX_FILE_BYTES) return "Each photo must be 5 MB or smaller.";
  return null;
}

function serializeGuestPhotoUpload(
  row: typeof guestPhotoUploads.$inferSelect,
  site: typeof weddingWebsites.$inferSelect,
  includeEmail = false,
  allowPublicImageUrl = true,
) {
  const publicImageUrl = row.status === "approved" && allowPublicImageUrl ? publicGuestPhotoUrl(site, row.imageUrl) : null;
  return {
    id: row.id,
    guestName: row.guestName,
    ...(includeEmail ? { guestEmail: row.guestEmail } : {}),
    note: row.note,
    caption: row.note,
    imageUrl: includeEmail ? row.imageUrl : publicImageUrl ?? "",
    publicImageUrl,
    originalName: row.originalName,
    contentType: row.contentType,
    fileSize: row.fileSize,
    status: row.status,
    uploadedAt: row.uploadedAt.toISOString(),
    approvedAt: row.approvedAt?.toISOString() ?? null,
  };
}

function collectWebsiteMediaPaths(
  row: typeof weddingWebsites.$inferSelect,
  party: Array<{ photoUrl: string | null }>,
  extraMedia: Array<string | null | undefined> = [],
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
  for (const media of extraMedia) add(media);
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

function cleanGuestPhotoFileName(name: string): string {
  return (name || "guest-photo")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140) || "guest-photo";
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
      checkInDate: hotelBlocks.checkInDate,
      checkOutDate: hotelBlocks.checkOutDate,
      address: hotelBlocks.address,
      city: hotelBlocks.city,
      state: hotelBlocks.state,
      zip: hotelBlocks.zip,
      distanceFromVenue: hotelBlocks.distanceFromVenue,
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
  const guestPhotoSettings = guestPhotoDropSettings(customText);
  const showGuestPhotosOnWebsite = guestPhotoShowsOnWebsite(guestPhotoSettings);
  const approvedGuestPhotos = showGuestPhotosOnWebsite
    ? await db
      .select()
      .from(guestPhotoUploads)
      .where(and(eq(guestPhotoUploads.websiteId, row.id), eq(guestPhotoUploads.status, "approved")))
      .orderBy(desc(guestPhotoUploads.uploadedAt))
      .limit(GUEST_PHOTO_WEBSITE_GALLERY_LIMIT)
    : [];

  return {
    slug: row.slug,
    publicWebsiteUrl: row.published && row.slug ? `/w/${row.slug}/home` : null,
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
    guestPhotoDrop: guestPhotoSettings.enabled
      ? {
        ...guestPhotoSettings,
        galleryEnabled: showGuestPhotosOnWebsite,
        photos: approvedGuestPhotos.map((photo) => serializeGuestPhotoUpload(photo, row, false, showGuestPhotosOnWebsite)),
      }
      : {
        ...guestPhotoSettings,
        enabled: false,
        galleryEnabled: false,
        photos: [],
      },
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
      venueZip: profile.venueZip,
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
      checkInDate: hotelBlocks.checkInDate,
      checkOutDate: hotelBlocks.checkOutDate,
      address: hotelBlocks.address,
      city: hotelBlocks.city,
      state: hotelBlocks.state,
      zip: hotelBlocks.zip,
      distanceFromVenue: hotelBlocks.distanceFromVenue,
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
    ? `${frontendOrigin.replace(/\/$/, "")}/w/${publishedWebsite.slug}/home`
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
      venueZip: profile.venueZip,
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

// ---------- GET /api/website/media/* ----------
//
// Editor-only media bridge. Website images may be older uploads without ACL
// metadata, or they may be edited by a collaborator whose Clerk id is not the
// original object owner. This route still requires an authenticated planner and
// only streams objects that are already referenced by that planner's website.
router.get("/website/media/*objectPath", requireAuth, async (req: Request, res: Response) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) return res.status(403).json({ error: "Insufficient permissions." });
    const profile = await resolveProfile(req);
    if (!profile) return res.status(404).json({ error: "Wedding profile not found" });

    const rawPath = req.params.objectPath;
    const mediaPath = Array.isArray(rawPath) ? rawPath.join("/") : String(rawPath ?? "");
    const objectPath = normalizePrivateMediaPath(`/objects/${mediaPath}`);
    if (!objectPath) return res.status(400).json({ error: "Invalid media path" });
    if (objectPath.includes("..") || objectPath.includes("\\")) {
      return res.status(400).json({ error: "Invalid media path" });
    }

    const [row] = await db
      .select()
      .from(weddingWebsites)
      .where(eq(weddingWebsites.profileId, profile.id))
      .limit(1);
    if (!row) return res.status(404).json({ error: "Website not found" });

    const party = await db
      .select({ photoUrl: weddingParty.photoUrl })
      .from(weddingParty)
      .where(eq(weddingParty.profileId, profile.id));
    const isWebsiteMedia = collectWebsiteMediaPaths(row, party, []).has(objectPath);
    let isGuestPhotoMedia = false;
    if (!isWebsiteMedia) {
      const [photoMatch] = await db
        .select({ id: guestPhotoUploads.id })
        .from(guestPhotoUploads)
        .where(and(eq(guestPhotoUploads.websiteId, row.id), eq(guestPhotoUploads.imageUrl, objectPath)))
        .limit(1);
      isGuestPhotoMedia = !!photoMatch;
    }

    if (!isWebsiteMedia && !isGuestPhotoMedia) {
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
    req.log.error(err, "websiteEditorMedia failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------- Guest Photo Drop management ----------

router.get("/website/photo-drop", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) return res.status(403).json({ error: "Insufficient permissions." });
    const profile = await resolveProfile(req);
    if (!profile) return res.status(404).json({ error: "Wedding profile not found" });

    const [site] = await db
      .select()
      .from(weddingWebsites)
      .where(eq(weddingWebsites.profileId, profile.id))
      .limit(1);
    if (!site) return res.status(404).json({ error: "Website not created yet" });

    const limit = Math.max(1, Math.min(96, Number(req.query.limit ?? 48) || 48));
    const offset = Math.max(0, Number(req.query.offset ?? 0) || 0);
    const [summaryRow] = await db
      .select({
        total: sql<number>`count(*)::int`,
        pending: sql<number>`coalesce(sum(case when ${guestPhotoUploads.status} = 'pending' then 1 else 0 end), 0)::int`,
        approved: sql<number>`coalesce(sum(case when ${guestPhotoUploads.status} = 'approved' then 1 else 0 end), 0)::int`,
        hidden: sql<number>`coalesce(sum(case when ${guestPhotoUploads.status} = 'hidden' then 1 else 0 end), 0)::int`,
      })
      .from(guestPhotoUploads)
      .where(eq(guestPhotoUploads.websiteId, site.id));

    const uploads = await db
      .select()
      .from(guestPhotoUploads)
      .where(eq(guestPhotoUploads.websiteId, site.id))
      .orderBy(desc(guestPhotoUploads.uploadedAt))
      .limit(limit)
      .offset(offset);
    const settings = guestPhotoDropSettings(site.customText);
    const publicUploadUrl = `${buildFrontendOrigin(req).replace(/\/+$/, "")}/photo-drop/${site.slug}`;
    const total = Number(summaryRow?.total ?? 0);

    res.json({
      website: serialize(site),
      settings,
      publicUploadUrl,
      summary: {
        total,
        pending: Number(summaryRow?.pending ?? 0),
        approved: Number(summaryRow?.approved ?? 0),
        hidden: Number(summaryRow?.hidden ?? 0),
      },
      uploads: uploads.map((upload) => serializeGuestPhotoUpload(upload, site, true, guestPhotoShowsOnWebsite(settings))),
      page: {
        limit,
        offset,
        returned: uploads.length,
        hasMore: offset + uploads.length < total,
        nextOffset: offset + uploads.length,
      },
    });
  } catch (err) {
    req.log.error(err, "guestPhotoDropGet failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/website/photo-drop/settings", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) return res.status(403).json({ error: "Insufficient permissions." });
    const profile = await resolveProfile(req);
    if (!profile) return res.status(404).json({ error: "Wedding profile not found" });

    const [site] = await db
      .select()
      .from(weddingWebsites)
      .where(eq(weddingWebsites.profileId, profile.id))
      .limit(1);
    if (!site) return res.status(404).json({ error: "Website not created yet" });

    const body = (req.body ?? {}) as Partial<GuestPhotoDropSettings>;
    const customText = mergeGuestPhotoDropSettings(site.customText ?? {}, body);
    const [updated] = await db
      .update(weddingWebsites)
      .set({ customText, lastUpdated: new Date() })
      .where(and(eq(weddingWebsites.id, site.id), eq(weddingWebsites.profileId, profile.id)))
      .returning();

    res.json({ settings: guestPhotoDropSettings(updated.customText), website: serialize(updated) });
  } catch (err) {
    req.log.error(err, "guestPhotoDropSettings failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/website/photo-drop/uploads/:id", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) return res.status(403).json({ error: "Insufficient permissions." });
    const profile = await resolveProfile(req);
    if (!profile) return res.status(404).json({ error: "Wedding profile not found" });

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid photo id" });
    const status = String(req.body?.status ?? "").trim().toLowerCase();
    if (!["pending", "approved", "hidden"].includes(status)) return res.status(400).json({ error: "Invalid status" });

    const [site] = await db
      .select()
      .from(weddingWebsites)
      .where(eq(weddingWebsites.profileId, profile.id))
      .limit(1);
    if (!site) return res.status(404).json({ error: "Website not created yet" });

    if (status === "approved") {
      const guestPhotoSettings = guestPhotoDropSettings(site.customText as WebsiteCustomText);
      if (guestPhotoShowsOnWebsite(guestPhotoSettings)) {
        const [current] = await db
          .select({ id: guestPhotoUploads.id, status: guestPhotoUploads.status })
          .from(guestPhotoUploads)
          .where(and(eq(guestPhotoUploads.id, id), eq(guestPhotoUploads.websiteId, site.id), eq(guestPhotoUploads.profileId, profile.id)))
          .limit(1);
        if (!current) return res.status(404).json({ error: "Photo not found" });
        if (current.status !== "approved") {
          const [{ approvedCount = 0 } = { approvedCount: 0 }] = await db
            .select({ approvedCount: sql<number>`count(*)` })
            .from(guestPhotoUploads)
            .where(and(eq(guestPhotoUploads.websiteId, site.id), eq(guestPhotoUploads.profileId, profile.id), eq(guestPhotoUploads.status, "approved")));
          if (Number(approvedCount) >= GUEST_PHOTO_WEBSITE_GALLERY_LIMIT) {
            return res.status(409).json({
              error: `Wedding website gallery is limited to ${GUEST_PHOTO_WEBSITE_GALLERY_LIMIT} guest photos. Hide or move an approved photo back to review before approving another.`,
            });
          }
        }
      }
    }

    const [updated] = await db
      .update(guestPhotoUploads)
      .set({ status, approvedAt: status === "approved" ? new Date() : null })
      .where(and(eq(guestPhotoUploads.id, id), eq(guestPhotoUploads.websiteId, site.id), eq(guestPhotoUploads.profileId, profile.id)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Photo not found" });

    res.json({ upload: serializeGuestPhotoUpload(updated, site, true) });
  } catch (err) {
    req.log.error(err, "guestPhotoDropUpdateUpload failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/website/photo-drop/uploads/:id", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) return res.status(403).json({ error: "Insufficient permissions." });
    const profile = await resolveProfile(req);
    if (!profile) return res.status(404).json({ error: "Wedding profile not found" });

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid photo id" });
    const [site] = await db
      .select({ id: weddingWebsites.id })
      .from(weddingWebsites)
      .where(eq(weddingWebsites.profileId, profile.id))
      .limit(1);
    if (!site) return res.status(404).json({ error: "Website not created yet" });

    const [deleted] = await db
      .delete(guestPhotoUploads)
      .where(and(eq(guestPhotoUploads.id, id), eq(guestPhotoUploads.websiteId, site.id), eq(guestPhotoUploads.profileId, profile.id)))
      .returning({ id: guestPhotoUploads.id });
    if (!deleted) return res.status(404).json({ error: "Photo not found" });
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "guestPhotoDropDeleteUpload failed");
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
    if (body.customText && typeof body.customText === "object") {
      updates.customText = preserveGuestPhotoDropCustomText(existing.customText, body.customText);
    }
    if (body.textStyles && typeof body.textStyles === "object") updates.textStyles = body.textStyles;
    if (body.textPositions && typeof body.textPositions === "object") updates.textPositions = body.textPositions;
    if (Array.isArray(body.galleryImages)) {
      updates.galleryImages = normalizeWebsiteImagesForStorage(body.galleryImages, 60);
    }
    if (Array.isArray(body.heroImages)) {
      updates.heroImages = normalizeWebsiteImagesForStorage(body.heroImages, 30);
    }
    if ("heroImage" in body) {
      updates.heroImage = typeof body.heroImage === "string" ? normalizeWebsiteImageForStorage(body.heroImage) : null;
    }
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
    if (existing.published) return res.status(400).json({ error: "Unpublish your website before changing the URL." });

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
      plusOneStatus: guest.plusOneStatus,
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
      plusOneStatus,
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
    const normalizedPlusOneStatus = isAttending ? normalizePlusOneStatus(plusOneStatus, plusOne, plusOneName) : "none";
    const wantsPlusOne = plusOneCountsAsGuest(normalizedPlusOneStatus);
    const [created] = await db.insert(guests).values({
      profileId: profile.id,
      name: cleanName,
      email: cleanEmail || null,
      rsvpStatus: attendance,
      mealChoice: isAttending ? normalizeMeal(mealChoice) : null,
      dietaryNotes: typeof dietaryRestrictions === "string" && dietaryRestrictions.trim() ? dietaryRestrictions.trim() : null,
      rsvpRespondedAt: new Date(),
      plusOne: wantsPlusOne,
      plusOneStatus: normalizedPlusOneStatus,
      plusOneName: plusOneNameForStatus(normalizedPlusOneStatus, plusOneName),
      plusOneMealChoice: wantsPlusOne ? normalizeMeal(plusOneMealChoice) : null,
      notes: "Guest used RSVP anyway because they could not find themselves on the guest list. Review before sending future invites.",
      rsvpMessage: typeof message === "string" && message.trim() ? message.trim().slice(0, 1000) : null,
      needsHotel: false,
      bookedHotelBlockId: null,
      bookedHotelRoomCount: null,
      source: "rsvp_self_add",
    }).returning();
    void sendGuestRsvpBackupEmail({
      profileId: profile.id,
      guest: created,
      source: "shared_invitation_self_add",
      logger: req.log,
    });
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
      plusOneStatus,
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
      rsvpRespondedAt: new Date(),
      dietaryNotes: typeof dietaryRestrictions === "string" && dietaryRestrictions.trim() ? dietaryRestrictions.trim() : null,
    };
    if (typeof message === "string") updateData.rsvpMessage = message.trim().slice(0, 1000) || null;
    if (attendance === "attending") {
      updateData.mealChoice = normalizeMeal(mealChoice);
      updateData.needsHotel = false;
      updateData.bookedHotelBlockId = null;
      updateData.bookedHotelRoomCount = null;
      if (plusOne !== undefined) {
        const finalName = typeof plusOneName === "string" ? plusOneName.trim() : "";
        const normalizedPlusOneStatus = normalizePlusOneStatus(plusOneStatus, plusOne, finalName);
        const hasPlusOneSeat = plusOneCountsAsGuest(normalizedPlusOneStatus);
        updateData.plusOne = hasPlusOneSeat;
        updateData.plusOneStatus = normalizedPlusOneStatus;
        updateData.plusOneName = plusOneNameForStatus(normalizedPlusOneStatus, finalName);
        updateData.plusOneMealChoice = hasPlusOneSeat ? normalizeMeal(plusOneMealChoice) : null;
      }
    } else {
      updateData.plusOne = false;
      updateData.plusOneStatus = "none";
      updateData.plusOneName = null;
      updateData.plusOneMealChoice = null;
      updateData.mealChoice = null;
      updateData.needsHotel = false;
      updateData.bookedHotelBlockId = null;
      updateData.bookedHotelRoomCount = null;
    }
    const [updated] = await db
      .update(guests)
      .set(updateData)
      .where(and(eq(guests.id, guest.id), eq(guests.profileId, profile.id)))
      .returning();
    if (updated) {
      void sendGuestRsvpBackupEmail({
        profileId: profile.id,
        guest: updated,
        source: "shared_invitation_rsvp",
        logger: req.log,
      });
    }
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
    const guestPhotoSettings = guestPhotoDropSettings(row.customText);
    const isWebsiteMedia = collectWebsiteMediaPaths(row, party, []).has(objectPath);
    let isApprovedGuestPhotoMedia = false;
    if (!isWebsiteMedia && guestPhotoShowsOnWebsite(guestPhotoSettings)) {
      const [photoMatch] = await db
        .select({ id: guestPhotoUploads.id })
        .from(guestPhotoUploads)
        .where(and(
          eq(guestPhotoUploads.websiteId, row.id),
          eq(guestPhotoUploads.status, "approved"),
          eq(guestPhotoUploads.imageUrl, objectPath),
        ))
        .limit(1);
      isApprovedGuestPhotoMedia = !!photoMatch;
    }

    if (!isWebsiteMedia && !isApprovedGuestPhotoMedia) {
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

// ---------- GET /api/website/public/:slug/photo-drop ----------
//
// Dedicated public payload for the QR-code photo uploader. This intentionally
// does not depend on the full wedding website being published or unlocked:
// if the couple turned on Guest Photo Drop, the wedding-day upload link should
// stay reliable for guests scanning a sign at the event.
router.get("/website/public/:slug/photo-drop", guestPhotoUsageLimiter, async (req, res) => {
  try {
    if (await sendMaintenanceIfActive(res, "wedding-website")) return;
    const slug = String(req.params.slug ?? "").toLowerCase();
    if (!slug) return res.status(400).json({ error: "Slug required" });

    const r = await resolveGuestPhotoDropSite(slug);
    if (!r.ok) return res.status(r.status).json({ error: "Photo drop not found" });

    const payload = await buildPublicPhotoDropPayload(r.site);
    if (!payload) return res.status(404).json({ error: "Photo drop not found" });
    res.json(payload);
  } catch (err) {
    req.log.error(err, "publicGuestPhotoDrop failed");
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

// POST /api/website/public/:slug/photo-drop/usage
// Returns how many upload slots this browser/device has left for the wedding.
// The client stores a random local device id; the server stores only its HMAC.
router.post("/website/public/:slug/photo-drop/usage", guestPhotoUsageLimiter, async (req, res) => {
  try {
    if (await sendMaintenanceIfActive(res, "wedding-website")) return;
    const slug = String(req.params.slug ?? "").toLowerCase();
    const r = await resolveGuestPhotoDropSite(slug);
    if (!r.ok) return res.status(r.status).json({ error: "Photo drop not found" });

    const settings = r.settings;
    if (!settings.enabled) return res.status(404).json({ error: "Guest photo sharing is not available for this wedding." });

    const uploaderKeys = guestPhotoUploadKeys(req, r.site, req.body?.deviceId, req.body?.deviceFingerprint);
    const locked = await hasGuestPhotoUploadLock(r.site.id, uploaderKeys.all);
    if (locked) {
      const usage = guestPhotoUsage(settings.maxUploads, settings.maxUploads);
      return res.json({
        ...usage,
        maxPerUpload: 0,
        submitted: true,
      });
    }
    const uploadedCount = await countGuestPhotoUploadsForKeys(r.site.id, uploaderKeys.all);
    const usage = guestPhotoUsage(uploadedCount, settings.maxUploads);
    if (usage.remaining <= 0) {
      await lockGuestPhotoUploaderKeys(r.site.id, uploaderKeys.all);
    }
    res.json({
      ...usage,
      maxPerUpload: Math.max(0, Math.min(settings.maxUploads, usage.remaining)),
      submitted: usage.remaining <= 0,
    });
  } catch (err) {
    req.log.error(err, "guestPhotoDropUsage failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/website/public/:slug/photo-drop/upload-url
// Creates a short-lived R2 signed URL so guest photos upload straight to
// object storage instead of being buffered through the API process.
router.post("/website/public/:slug/photo-drop/upload-url", guestPhotoPublicLimiter, async (req, res) => {
  try {
    if (await sendMaintenanceIfActive(res, "wedding-website")) return;
    const slug = String(req.params.slug ?? "").toLowerCase();
    const r = await resolveGuestPhotoDropSite(slug);
    if (!r.ok) return res.status(r.status).json({ error: "Photo drop not found" });

    const settings = r.settings;
    if (!settings.enabled) return res.status(404).json({ error: "Guest photo sharing is not available for this wedding." });

    const cleanName = cleanGuestPhotoName(req.body?.guestName);
    if (!cleanName) return res.status(400).json({ error: "Please enter your name before uploading." });
    const cleanEmail = cleanGuestPhotoEmail(req.body?.guestEmail);
    if (!isValidGuestPhotoEmail(cleanEmail)) return res.status(400).json({ error: "Email address looks invalid." });

    const originalName = cleanGuestPhotoFileName(String(req.body?.fileName ?? "guest-photo.jpg"));
    const contentType = cleanGuestPhotoContentType(req.body?.contentType);
    const fileSize = Number(req.body?.fileSize ?? 0);
    const detailError = validateGuestPhotoFileDetails(originalName, contentType, fileSize);
    if (detailError) return res.status(detailError.includes("5 MB") ? 413 : 400).json({ error: detailError });

    const uploaderKeys = guestPhotoUploadKeys(req, r.site, req.body?.deviceId, req.body?.deviceFingerprint);
    const locked = await hasGuestPhotoUploadLock(r.site.id, uploaderKeys.all);
    if (locked) {
      const usage = guestPhotoUsage(settings.maxUploads, settings.maxUploads);
      return res.status(409).json({
        error: `This phone has already submitted its ${usage.limit}-photo disposable camera roll for this wedding.`,
        usage,
        submitted: true,
      });
    }
    const uploadedCount = await countGuestPhotoUploadsForKeys(r.site.id, uploaderKeys.all);
    const usageBeforeUpload = guestPhotoUsage(uploadedCount, settings.maxUploads);
    if (usageBeforeUpload.remaining <= 0) {
      await lockGuestPhotoUploaderKeys(r.site.id, uploaderKeys.all);
      return res.status(409).json({
        error: `This phone has already submitted its ${usageBeforeUpload.limit}-photo disposable camera roll for this wedding.`,
        usage: usageBeforeUpload,
        submitted: true,
      });
    }

    const { uploadUrl, objectPath } = await objectStorageService.createObjectEntityUploadURL(originalName, contentType);
    res.json({
      uploadUrl,
      objectPath,
      originalName,
      contentType,
      maxBytes: GUEST_PHOTO_MAX_FILE_BYTES,
      usage: usageBeforeUpload,
    });
  } catch (err) {
    req.log.error(err, "guestPhotoDropCreateUploadUrl failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/website/public/:slug/photo-drop/complete
// Records a photo after the browser has uploaded it directly to storage.
router.post("/website/public/:slug/photo-drop/complete", guestPhotoPublicLimiter, async (req, res) => {
  try {
    if (await sendMaintenanceIfActive(res, "wedding-website")) return;
    const slug = String(req.params.slug ?? "").toLowerCase();
    const r = await resolveGuestPhotoDropSite(slug);
    if (!r.ok) return res.status(r.status).json({ error: "Photo drop not found" });

    const settings = r.settings;
    if (!settings.enabled) return res.status(404).json({ error: "Guest photo sharing is not available for this wedding." });

    const cleanName = cleanGuestPhotoName(req.body?.guestName);
    if (!cleanName) return res.status(400).json({ error: "Please enter your name before uploading." });
    const cleanEmail = cleanGuestPhotoEmail(req.body?.guestEmail);
    if (!isValidGuestPhotoEmail(cleanEmail)) return res.status(400).json({ error: "Email address looks invalid." });
    const caption = cleanGuestPhotoCaption(req.body?.caption ?? req.body?.note);
    const originalName = cleanGuestPhotoFileName(String(req.body?.originalName ?? req.body?.fileName ?? "guest-photo.jpg"));
    const contentType = cleanGuestPhotoContentType(req.body?.contentType);
    const fileSize = Number(req.body?.fileSize ?? 0);
    const detailError = validateGuestPhotoFileDetails(originalName, contentType, fileSize);
    if (detailError) return res.status(detailError.includes("5 MB") ? 413 : 400).json({ error: detailError });

    const rawObjectPath = String(req.body?.objectPath ?? "");
    const normalizedPath = objectStorageService.normalizeObjectEntityPath(rawObjectPath);
    if (!normalizedPath.startsWith("/objects/uploads/")) {
      return res.status(400).json({ error: "Invalid uploaded photo path." });
    }

    const uploaderKeys = guestPhotoUploadKeys(req, r.site, req.body?.deviceId, req.body?.deviceFingerprint);
    const uploaderKey = uploaderKeys.primary;
    const locked = await hasGuestPhotoUploadLock(r.site.id, uploaderKeys.all);
    if (locked) {
      const usage = guestPhotoUsage(settings.maxUploads, settings.maxUploads);
      return res.status(409).json({
        error: `This phone has already submitted its ${usage.limit}-photo disposable camera roll for this wedding.`,
        usage,
        submitted: true,
      });
    }
    const uploadedCount = await countGuestPhotoUploadsForKeys(r.site.id, uploaderKeys.all);
    const usageBeforeUpload = guestPhotoUsage(uploadedCount, settings.maxUploads);
    if (usageBeforeUpload.remaining <= 0) {
      await lockGuestPhotoUploaderKeys(r.site.id, uploaderKeys.all);
      return res.status(409).json({
        error: `This phone has already submitted its ${usageBeforeUpload.limit}-photo disposable camera roll for this wedding.`,
        usage: usageBeforeUpload,
        submitted: true,
      });
    }

    const [profile] = await db
      .select({ id: weddingProfiles.id, userId: weddingProfiles.userId })
      .from(weddingProfiles)
      .where(eq(weddingProfiles.id, r.site.profileId))
      .limit(1);
    if (!profile) return res.status(404).json({ error: "Wedding profile not found" });

    const file = await objectStorageService.getObjectEntityFile(normalizedPath);
    const [metadata] = await file.getMetadata();
    const storedSize = Number(metadata.size || fileSize);
    if (Number.isFinite(storedSize) && storedSize > GUEST_PHOTO_MAX_FILE_BYTES) {
      return res.status(413).json({ error: "Each photo must be 5 MB or smaller." });
    }
    await objectStorageService.trySetObjectEntityAclPolicy(normalizedPath, {
      owner: profile.userId,
      visibility: "private",
    });

    const status = "pending";
    const [created] = await db
      .insert(guestPhotoUploads)
      .values({
        websiteId: r.site.id,
        profileId: r.site.profileId,
        guestName: cleanName,
        guestEmail: cleanEmail || null,
        note: caption || null,
        imageUrl: normalizedPath,
        originalName,
        contentType,
        fileSize: Math.max(1, Math.min(GUEST_PHOTO_MAX_FILE_BYTES, Math.floor(storedSize || fileSize))),
        uploaderKey,
        status,
        approvedAt: null,
      })
      .returning();

    const usageAfterUpload = guestPhotoUsage(uploadedCount + 1, settings.maxUploads);
    if (usageAfterUpload.remaining <= 0) {
      await lockGuestPhotoUploaderKeys(r.site.id, uploaderKeys.all);
    }

    res.status(201).json({
      success: true,
      status,
      upload: serializeGuestPhotoUpload(created, r.site, false, false),
      usage: usageAfterUpload,
      submitted: usageAfterUpload.remaining <= 0,
      message: "Thanks! Your photos were uploaded and are waiting for the couple to approve.",
    });
  } catch (err) {
    req.log.error(err, "guestPhotoDropCompleteDirectUpload failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/website/public/:slug/photo-drop
// Public upload endpoint for the wedding-day QR code. The site must be
// published, the couple must have Guest Photo Drop enabled, and photos are
// private until approved unless the couple disables approval.
router.post(
  "/website/public/:slug/photo-drop",
  guestPhotoPublicLimiter,
  (req, res, next) => {
    guestPhotoUpload.array("photos", GUEST_PHOTO_MAX_FILES)(req, res, (err) => {
      if (!err) return next();
      const code = (err as { code?: string })?.code;
      if (code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "Each photo must be 5 MB or smaller." });
      }
      if (code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({ error: `You can upload up to ${GUEST_PHOTO_MAX_FILES} photos at once.` });
      }
      const msg = err instanceof Error ? err.message : "Invalid photo upload.";
      req.log?.warn({ error: msg }, "Guest photo upload rejected");
      return res.status(400).json({ error: msg });
    });
  },
  async (req, res) => {
    try {
      if (await sendMaintenanceIfActive(res, "wedding-website")) return;
      const slug = String(req.params.slug ?? "").toLowerCase();
      const r = await resolveGuestPhotoDropSite(slug);
      if (!r.ok) return res.status(r.status).json({ error: "Photo drop not found" });

      const settings = r.settings;
      if (!settings.enabled) return res.status(404).json({ error: "Guest photo sharing is not available for this wedding." });

      const files = Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : [];
      if (files.length === 0) return res.status(400).json({ error: "Please choose at least one photo." });
      if (files.length > settings.maxUploads) {
        return res.status(400).json({ error: `Please upload no more than ${settings.maxUploads} photos at once.` });
      }
      const uploaderKeys = guestPhotoUploadKeys(req, r.site, req.body?.deviceId, req.body?.deviceFingerprint);
      const uploaderKey = uploaderKeys.primary;
      const locked = await hasGuestPhotoUploadLock(r.site.id, uploaderKeys.all);
      if (locked) {
        const usage = guestPhotoUsage(settings.maxUploads, settings.maxUploads);
        return res.status(409).json({
          error: `This phone has already submitted its ${usage.limit}-photo disposable camera roll for this wedding.`,
          usage,
          submitted: true,
        });
      }
      const uploadedCount = await countGuestPhotoUploadsForKeys(r.site.id, uploaderKeys.all);
      const usageBeforeUpload = guestPhotoUsage(uploadedCount, settings.maxUploads);
      if (usageBeforeUpload.remaining <= 0) {
        await lockGuestPhotoUploaderKeys(r.site.id, uploaderKeys.all);
        return res.status(409).json({
          error: `This phone has already submitted its ${usageBeforeUpload.limit}-photo disposable camera roll for this wedding.`,
          usage: usageBeforeUpload,
          submitted: true,
        });
      }
      if (files.length > usageBeforeUpload.remaining) {
        return res.status(400).json({
          error: `This phone has ${usageBeforeUpload.remaining} photo${usageBeforeUpload.remaining === 1 ? "" : "s"} left to upload. Please remove ${files.length - usageBeforeUpload.remaining} photo${files.length - usageBeforeUpload.remaining === 1 ? "" : "s"} and try again.`,
          usage: usageBeforeUpload,
        });
      }

      const cleanName = String(req.body?.guestName ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
      if (!cleanName) return res.status(400).json({ error: "Please enter your name before uploading." });
      const cleanEmail = String(req.body?.guestEmail ?? "").trim().toLowerCase().slice(0, 200);
      if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ error: "Email address looks invalid." });
      }
      const caption = String(req.body?.caption ?? req.body?.note ?? "").trim().slice(0, 500);

      const [profile] = await db
        .select({ id: weddingProfiles.id, userId: weddingProfiles.userId })
        .from(weddingProfiles)
        .where(eq(weddingProfiles.id, r.site.profileId))
        .limit(1);
      if (!profile) return res.status(404).json({ error: "Wedding profile not found" });

      const status = "pending";
      const createdRows: Array<typeof guestPhotoUploads.$inferSelect> = [];
      for (const file of files) {
        const originalName = cleanGuestPhotoFileName(file.originalname);
        const fileUrl = await objectStorageService.uploadObjectEntityFile(file.buffer, originalName, file.mimetype || "image/jpeg", {
          owner: profile.userId,
          visibility: "private",
        });
        const [created] = await db
          .insert(guestPhotoUploads)
          .values({
            websiteId: r.site.id,
            profileId: r.site.profileId,
            guestName: cleanName,
            guestEmail: cleanEmail || null,
            note: caption || null,
            imageUrl: fileUrl,
            originalName,
            contentType: file.mimetype || "image/jpeg",
            fileSize: file.size,
            uploaderKey,
            status,
            approvedAt: status === "approved" ? new Date() : null,
          })
          .returning();
        createdRows.push(created);
      }

      const usageAfterUpload = guestPhotoUsage(uploadedCount + createdRows.length, settings.maxUploads);
      if (usageAfterUpload.remaining <= 0) {
        await lockGuestPhotoUploaderKeys(r.site.id, uploaderKeys.all);
      }

      res.status(201).json({
        success: true,
        status,
        count: createdRows.length,
        usage: usageAfterUpload,
        submitted: usageAfterUpload.remaining <= 0,
        message: "Thanks! Your photos were uploaded and are waiting for the couple to approve.",
      });
    } catch (err) {
      req.log.error(err, "guestPhotoDropPublicUpload failed");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

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
      plusOneStatus: guest.plusOneStatus,
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
      plusOneStatus,
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
      plusOneStatus?: string;
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
    const normalizedPlusOneStatus = isAttending ? normalizePlusOneStatus(plusOneStatus, plusOne, plusOneName) : "none";
    const wantsPlusOne = plusOneCountsAsGuest(normalizedPlusOneStatus);
    const cleanPlusOneName = typeof plusOneName === "string" ? plusOneName.trim() : "";
    const [created] = await db.insert(guests).values({
      profileId: r.site.profileId,
      name: cleanName,
      email: cleanEmail || null,
      rsvpStatus: attendance,
      mealChoice: isAttending ? normalizeMeal(mealChoice) : null,
      dietaryNotes: dietaryClean,
      rsvpRespondedAt: new Date(),
      plusOne: wantsPlusOne,
      plusOneStatus: normalizedPlusOneStatus,
      plusOneName: plusOneNameForStatus(normalizedPlusOneStatus, cleanPlusOneName),
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
    void sendGuestRsvpBackupEmail({
      profileId: r.site.profileId,
      guest: created,
      source: "website_self_add",
      logger: req.log,
    });

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
      plusOneStatus,
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
      plusOneStatus?: string;
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
      rsvpRespondedAt: new Date(),
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
        const finalName = typeof plusOneName === "string" ? plusOneName.trim() : "";
        const normalizedPlusOneStatus = normalizePlusOneStatus(plusOneStatus, plusOne, finalName);
        const hasPlusOneSeat = plusOneCountsAsGuest(normalizedPlusOneStatus);
        updateData.plusOne = hasPlusOneSeat;
        updateData.plusOneStatus = normalizedPlusOneStatus;
        updateData.plusOneName = plusOneNameForStatus(normalizedPlusOneStatus, finalName);
        updateData.plusOneMealChoice = hasPlusOneSeat ? normalizeMeal(plusOneMealChoice) : null;
      }
    } else {
      updateData.plusOne = false;
      updateData.plusOneStatus = "none";
      updateData.plusOneName = null;
      updateData.plusOneMealChoice = null;
      updateData.mealChoice = null;
      updateData.needsHotel = false;
      updateData.bookedHotelBlockId = null;
      updateData.bookedHotelRoomCount = null;
    }

    const [updated] = await db
      .update(guests)
      .set(updateData)
      .where(and(eq(guests.id, guest.id), eq(guests.profileId, r.site.profileId)))
      .returning();
    if (updated) {
      void sendGuestRsvpBackupEmail({
        profileId: r.site.profileId,
        guest: updated,
        source: "website_guest_rsvp",
        logger: req.log,
      });
    }

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
    void sendWebsiteRsvpBackupEmail({
      profileId: row.profileId,
      rsvp: {
        name: name.trim().slice(0, 120),
        email: cleanEmail || null,
        attending: att,
        plusOneCount: Math.max(0, Math.min(10, Number(plusOneCount) || 0)),
        dietaryRestrictions: dietaryRestrictions?.trim().slice(0, 500) || null,
        message: message?.trim().slice(0, 1000) || null,
      },
      source: "website_form_rsvp",
      logger: req.log,
    });

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
