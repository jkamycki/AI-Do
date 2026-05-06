import { Router } from "express";
import { db, weddingWebsites, weddingProfiles, timelines } from "@workspace/db";
import type { WeddingProfile, WebsiteSectionsEnabled, WebsiteCustomText, WebsiteGalleryImage } from "@workspace/db";
import { eq } from "drizzle-orm";
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
    res.json(serialize(row));
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

    const [tl] = await db
      .select()
      .from(timelines)
      .where(eq(timelines.profileId, row.profileId))
      .limit(1);

    res.json({
      slug: row.slug,
      theme: row.theme,
      layoutStyle: row.layoutStyle,
      font: row.font,
      accentColor: row.accentColor,
      colorPalette: row.colorPalette,
      sectionsEnabled: row.sectionsEnabled,
      customText: row.customText,
      galleryImages: row.galleryImages,
      heroImage: row.heroImage,
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
      timeline: tl?.events ?? [],
    });
  } catch (err) {
    req.log.error(err, "publicWebsite failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
