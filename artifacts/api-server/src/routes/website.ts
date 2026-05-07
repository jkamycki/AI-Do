import { Router } from "express";
import { db, weddingWebsites, weddingProfiles, guests, websiteRsvps, weddingParty } from "@workspace/db";
import type { WeddingProfile, WebsiteSectionsEnabled, WebsiteCustomText, WebsiteGalleryImage, WebsiteTextStyles, WebsiteTextPositions } from "@workspace/db";
import { and, eq, ilike, desc, not } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { resolveProfile } from "../lib/workspaceAccess";

const router = Router();

// ---------- helpers ----------

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
  const cleaned = [a, b].filter(Boolean).join("-").replace(/[^a-z0-9-]/g, "");
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
  const couple = `${profile.partner1Name} & ${profile.partner2Name}`;
  const venueLine = profile.venue ? `${profile.venue}${profile.location ? `, ${profile.location}` : ""}` : "";
  return {
    welcome: `Welcome to our wedding website! We can't wait to celebrate with you on ${profile.weddingDate}${venueLine ? ` at ${venueLine}` : ""}. Browse the site for everything you need to know.`,
    story: `${couple} are getting married! We're so grateful to have you in our lives and can't wait to share this special day with you.`,
    faq: `Have questions? You can reach us anytime — and we'll keep this page updated with the latest details as the day approaches.`,
    travel: profile.venue ? `Our wedding will take place at ${profile.venue}${profile.location ? `, ${profile.location}` : ""}. We'll be sharing recommended hotels and travel tips here.` : "Travel details coming soon.",
    registry: "We're so thankful for your love and support. Registry details will be shared here.",
  };
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
    heroImage: w.heroImage,
    passwordEnabled: !!w.password,
    published: w.published,
    publishedAt: w.publishedAt?.toISOString() ?? null,
    lastUpdated: w.lastUpdated.toISOString(),
    createdAt: w.createdAt.toISOString(),
  };
}

// ---------- POST /api/website/create ----------

router.post("/website/create", requireAuth, async (req, res) => {
  try {
    const profile = await resolveProfile(req);
    if (!profile) return res.status(404).json({ error: "Wedding profile not found. Complete onboarding first." });

    const [existing] = await db
      .select()
      .from(weddingWebsites)
      .where(eq(weddingWebsites.profileId, profile.id))
      .limit(1);
    if (existing) return res.json(serialize(existing));

    const slug = await generateUniqueSlug(profile);
    const customText = autoGenerateText(profile);

    const [created] = await db
      .insert(weddingWebsites)
      .values({
        profileId: profile.id,
        slug,
        customText,
        heroImage: profile.invitationPhotoUrl ?? null,
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
      .where(eq(weddingParty.userId, profile.userId))
      .orderBy(weddingParty.sortOrder, weddingParty.createdAt);

    res.json({ ...serialize(row), portalParty: partyMembers });
  } catch (err) {
    req.log.error(err, "getWebsite failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------- PUT /api/website/update ----------

router.put("/website/update", requireAuth, async (req, res) => {
  try {
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
    if ("heroImage" in body) updates.heroImage = body.heroImage ?? null;
    if ("password" in body) {
      const p = body.password?.trim();
      updates.password = p ? p : null;
    }

    const [updated] = await db
      .update(weddingWebsites)
      .set(updates)
      .where(eq(weddingWebsites.id, existing.id))
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
      .where(eq(weddingWebsites.id, existing.id))
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
    const profile = await resolveProfile(req);
    if (!profile) return res.status(404).json({ error: "Wedding profile not found" });

    const [existing] = await db
      .select()
      .from(weddingWebsites)
      .where(eq(weddingWebsites.profileId, profile.id))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Website not created yet" });

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
      .where(eq(weddingWebsites.id, existing.id))
      .returning();
    res.json(serialize(updated));
  } catch (err) {
    req.log.error(err, "updateSlug failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------- GET /api/website/public/:slug ----------
//
// Public, unauthenticated. Returns the rendered website data the guest site
// needs to display the page. If the website has a password set, the body
// must include the matching password (via `?password=...` or POST body, but
// here we keep it GET-only and accept the password as a query string).

router.get("/website/public/:slug", async (req, res) => {
  try {
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
      const supplied = String(req.query.password ?? "");
      if (supplied !== row.password) {
        return res.status(401).json({
          passwordRequired: true,
          coupleNames: null,
        });
      }
    }

    const [profile] = await db
      .select()
      .from(weddingProfiles)
      .where(eq(weddingProfiles.id, row.profileId))
      .limit(1);
    if (!profile) return res.status(404).json({ error: "Not found" });

    const portalParty = await db
      .select({ id: weddingParty.id, name: weddingParty.name, role: weddingParty.role, side: weddingParty.side, photoUrl: weddingParty.photoUrl, sortOrder: weddingParty.sortOrder })
      .from(weddingParty)
      .where(eq(weddingParty.userId, profile.userId))
      .orderBy(weddingParty.sortOrder, weddingParty.createdAt);

    res.json({
      slug: row.slug,
      theme: row.theme,
      layoutStyle: row.layoutStyle,
      font: row.font,
      accentColor: row.accentColor,
      colorPalette: row.colorPalette,
      sectionsEnabled: row.sectionsEnabled,
      customText: row.customText,
      textStyles: row.textStyles ?? {},
      textPositions: row.textPositions ?? {},
      galleryImages: row.galleryImages,
      heroImage: row.heroImage,
      portalParty,
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
    });
  } catch (err) {
    req.log.error(err, "publicWebsite failed");
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

async function resolvePublishedSite(slug: string, password: string | undefined) {
  const [row] = await db
    .select()
    .from(weddingWebsites)
    .where(eq(weddingWebsites.slug, slug.toLowerCase()))
    .limit(1);
  if (!row || !row.published) return { ok: false as const, status: 404 };
  if (row.password && row.password !== (password ?? "")) {
    return { ok: false as const, status: 401 };
  }
  return { ok: true as const, site: row };
}

// GET /api/website/public/:slug/guests/search?q=name&password=...
// Returns guests on this wedding's list whose name fuzzy-matches the query.
// Limit 10 to keep the page responsive and reduce enumeration risk.
router.get("/website/public/:slug/guests/search", async (req, res) => {
  try {
    const slug = String(req.params.slug ?? "").toLowerCase();
    const q = String(req.query.q ?? "").trim();
    const password = req.query.password ? String(req.query.password) : undefined;
    if (q.length < 2) return res.json({ matches: [] });

    const r = await resolvePublishedSite(slug, password);
    if (!r.ok) return res.status(r.status).json({ error: r.status === 401 ? "Password required" : "Not found" });

    const rows = await db
      .select({
        id: guests.id,
        name: guests.name,
        rsvpStatus: guests.rsvpStatus,
        plusOne: guests.plusOne,
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
router.get("/website/public/:slug/guests/:guestId", async (req, res) => {
  try {
    const slug = String(req.params.slug ?? "").toLowerCase();
    const guestId = parseInt(String(req.params.guestId), 10);
    const password = req.query.password ? String(req.query.password) : undefined;
    if (!Number.isFinite(guestId)) return res.status(400).json({ error: "Bad guest id" });

    const r = await resolvePublishedSite(slug, password);
    if (!r.ok) return res.status(r.status).json({ error: r.status === 401 ? "Password required" : "Not found" });

    const [guest] = await db
      .select()
      .from(guests)
      .where(and(eq(guests.id, guestId), eq(guests.profileId, r.site.profileId)))
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
    });
  } catch (err) {
    req.log.error(err, "websiteRsvpPreviewGetGuest failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/website/public/:slug/rsvp — submit/update RSVP for a guest.
// Same write semantics as POST /rsvp/:token but identifies the guest by
// guestId (returned from the search endpoint) instead of a token.
router.post("/website/public/:slug/rsvp", async (req, res) => {
  try {
    const slug = String(req.params.slug ?? "").toLowerCase();
    const password = req.body?.password ? String(req.body.password) : undefined;
    const r = await resolvePublishedSite(slug, password);
    if (!r.ok) return res.status(r.status).json({ error: r.status === 401 ? "Password required" : "Not found" });

    const {
      guestId,
      attendance,
      mealChoice,
      plusOne,
      plusOneName,
      plusOneMealChoice,
      dietaryRestrictions,
    } = (req.body ?? {}) as {
      guestId?: number;
      attendance?: string;
      mealChoice?: string;
      plusOne?: boolean;
      plusOneName?: string;
      plusOneMealChoice?: string;
      dietaryRestrictions?: string;
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

    if (attendance === "attending") {
      updateData.mealChoice = normalizeMeal(mealChoice);
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
    }

    await db.update(guests).set(updateData).where(eq(guests.id, guest.id));

    res.json({ success: true, status: attendance });
  } catch (err) {
    req.log.error(err, "websiteRsvpSubmit failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------- POST /api/website/rsvp/:slug ----------
// Public — no auth required. Guests submit their RSVP.

router.post("/website/rsvp/:slug", async (req, res) => {
  try {
    const slug = String(req.params.slug ?? "").toLowerCase();
    if (!slug) return res.status(400).json({ error: "Slug required" });

    const [row] = await db
      .select({ id: weddingWebsites.id, published: weddingWebsites.published })
      .from(weddingWebsites)
      .where(eq(weddingWebsites.slug, slug))
      .limit(1);
    if (!row || !row.published) return res.status(404).json({ error: "Not found" });

    const { name, email, attending, plusOneCount, dietaryRestrictions, message } = (req.body ?? {}) as {
      name?: string;
      email?: string;
      attending?: string;
      plusOneCount?: number;
      dietaryRestrictions?: string;
      message?: string;
    };

    if (!name?.trim()) return res.status(400).json({ error: "Name is required" });
    const att = attending === "no" ? "no" : attending === "maybe" ? "maybe" : "yes";

    const [created] = await db
      .insert(websiteRsvps)
      .values({
        websiteId: row.id,
        name: name.trim().slice(0, 120),
        email: email?.trim().slice(0, 200) || null,
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
