import { Router } from "express";
import { db, guests, weddingProfiles } from "@workspace/db";
import { eq, and, or, ilike } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { publicRsvpLimiter } from "../middlewares/rateLimiter";
import { hasMinRole, resolveCallerRole, resolveProfile } from "../lib/workspaceAccess";
import crypto from "crypto";

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanTextField(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function buildRequestOrigin(req: import("express").Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0]?.trim() || req.protocol;
  const rawHost = (req.headers["x-forwarded-host"] as string)?.split(",")[0]?.trim() || req.get("host") || "";
  const safeProto = proto === "https" ? "https" : "http";
  const fallbackHost = (process.env.APP_ORIGIN ?? "aidowedding.net").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const safeHost = /^[a-zA-Z0-9.\-:]+$/.test(rawHost) ? rawHost : fallbackHost;
  return `${safeProto}://${safeHost}`;
}

function buildFrontendOrigin(req: import("express").Request): string {
  const fromEnv = (process.env.FRONTEND_URL ?? process.env.PUBLIC_APP_URL)?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return buildRequestOrigin(req);
}

router.post("/guest-collect/generate", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) return res.status(403).json({ error: "Insufficient permissions." });
    const profile = await resolveProfile(req);
    if (!profile) {
      return res.status(400).json({ error: "No wedding profile found." });
    }

    const existing = profile.guestCollectionToken;
    if (existing) {
      return res.json({ token: existing });
    }

    const token = crypto.randomUUID();
    await db
      .update(weddingProfiles)
      .set({ guestCollectionToken: token })
      .where(eq(weddingProfiles.id, profile.id));

    res.json({ token });
  } catch (err) {
    req.log.error(err, "Failed to generate guest collection token");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/guest-collect/regenerate", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) return res.status(403).json({ error: "Insufficient permissions." });
    const profile = await resolveProfile(req);
    if (!profile) {
      return res.status(400).json({ error: "No wedding profile found." });
    }

    const token = crypto.randomUUID();
    await db
      .update(weddingProfiles)
      .set({ guestCollectionToken: token })
      .where(eq(weddingProfiles.id, profile.id));

    res.json({ token });
  } catch (err) {
    req.log.error(err, "Failed to regenerate guest collection token");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/guest-collect/:token/preview-card.svg", async (req, res) => {
  try {
    const profiles = await db
      .select()
      .from(weddingProfiles)
      .where(eq(weddingProfiles.guestCollectionToken, req.params.token))
      .limit(1);

    if (!profiles.length) {
      return res.status(404).send("Not found");
    }

    const p = profiles[0];
    const name1 = p.partner1Name ?? "Partner 1";
    const name2 = p.partner2Name ?? "Partner 2";
    const couple = escapeHtml(`${name1} & ${name2}`);
    const description = escapeHtml("are collecting addresses for their wedding invitations");

    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="top" x1="0" x2="1">
      <stop offset="0%" stop-color="#E91E8C"/>
      <stop offset="100%" stop-color="#7B2FBE"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-20%" width="120%" height="160%">
      <feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#3B1C2B" flood-opacity="0.22"/>
    </filter>
  </defs>
  <rect width="1200" height="630" fill="#FFF7F2"/>
  <circle cx="1070" cy="112" r="220" fill="#F2E2C6" opacity="0.38"/>
  <circle cx="130" cy="520" r="240" fill="#E6A6B7" opacity="0.18"/>
  <g filter="url(#shadow)">
    <rect x="60" y="135" width="1080" height="360" rx="30" fill="#FFF7F2" stroke="#E6A6B7" stroke-width="2"/>
    <rect x="60" y="135" width="1080" height="8" rx="4" fill="url(#top)"/>
    <circle cx="170" cy="300" r="50" fill="#EED2D9" stroke="#D9A9B7" stroke-width="2"/>
    <text x="170" y="315" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="42" fill="#8D294D">♥</text>
    <text x="250" y="260" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" letter-spacing="4" fill="#B23062">CONTACT INFO REQUEST</text>
    <text x="250" y="315" font-family="Georgia, 'Times New Roman', serif" font-size="42" font-weight="700" fill="#3B1C2B">${couple}</text>
    <text x="250" y="365" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#6F3E54">${description}</text>
    <text x="250" y="420" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#9A7B88">aidowedding.net</text>
  </g>
</svg>`);
  } catch (err) {
    req.log.error(err, "Failed to render guest collector preview card image");
    res.status(500).send("Error");
  }
});

router.get("/guest-collect/:token/preview", async (req, res) => {
  try {
    const profiles = await db
      .select()
      .from(weddingProfiles)
      .where(eq(weddingProfiles.guestCollectionToken, req.params.token))
      .limit(1);

    if (!profiles.length) {
      return res.status(404).send("<h1>Link not found</h1>");
    }

    const p = profiles[0];
    const name1 = p.partner1Name ?? "Partner 1";
    const name2 = p.partner2Name ?? "Partner 2";
    const title = `${name1} & ${name2} - Contact Info Request`;
    const description = `${name1} & ${name2} are collecting mailing addresses for their wedding invitations. Tap to share your contact info.`;

    const frontendOrigin = buildFrontendOrigin(req);
    const formUrl = `${frontendOrigin}/collect/${req.params.token}`;
    const previewUrl = `${frontendOrigin}/api/guest-collect/${req.params.token}/preview`;
    const imageUrl = `${frontendOrigin}/api/guest-collect/${req.params.token}/preview-card.svg`;

    const safeTitle = escapeHtml(title);
    const safeDescription = escapeHtml(description);
    const safeFormUrl = escapeHtml(formUrl);
    const safePreviewUrl = escapeHtml(previewUrl);
    const safeImageUrl = escapeHtml(imageUrl);
    const safeImageAlt = escapeHtml(`A.IDO guest contact collector for ${name1} and ${name2}`);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <link rel="canonical" href="${safePreviewUrl}" />
  <meta name="description" content="${safeDescription}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${safePreviewUrl}" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDescription}" />
  <meta property="og:site_name" content="A.IDO - AI Wedding Planning OS" />
  <meta property="og:image" content="${safeImageUrl}" />
  <meta property="og:image:secure_url" content="${safeImageUrl}" />
  <meta property="og:image:type" content="image/svg+xml" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${safeImageAlt}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDescription}" />
  <meta name="twitter:image" content="${safeImageUrl}" />
  <meta name="twitter:image:alt" content="${safeImageAlt}" />
</head>
<body>
  <script>window.location.replace(${JSON.stringify(formUrl)});</script>
  <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#FFF7F2;color:#3B1C2B;font-family:Arial,Helvetica,sans-serif;text-align:center;padding:24px;">
    <div>
      <p style="margin:0 0 12px;font-size:14px;letter-spacing:.18em;text-transform:uppercase;color:#8D294D;font-weight:700;">Contact Info Request</p>
      <h1 style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;font-size:32px;">${safeTitle}</h1>
      <p style="margin:0 0 20px;color:#6F3E54;">${safeDescription}</p>
      <a href="${safeFormUrl}" style="display:inline-block;background:#8D294D;color:#fff;text-decoration:none;font-weight:700;border-radius:10px;padding:12px 18px;">Open contact form</a>
    </div>
  </main>
</body>
</html>`);
  } catch (err) {
    req.log.error(err, "Failed to render guest collector link preview");
    res.status(500).send("Error");
  }
});

router.get("/guest-collect/:token/preview-legacy", async (req, res) => {
  try {
    const profiles = await db
      .select()
      .from(weddingProfiles)
      .where(eq(weddingProfiles.guestCollectionToken, req.params.token))
      .limit(1);

    if (!profiles.length) {
      return res.status(404).send("<h1>Link not found</h1>");
    }

    const p = profiles[0];
    const name1 = p.partner1Name ?? "Partner 1";
    const name2 = p.partner2Name ?? "Partner 2";
    const title = `${name1} & ${name2} — Contact Info Request`;
    const description = `${name1} & ${name2} are collecting mailing addresses for their wedding invitations. Tap to share your contact info.`;

    const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0]?.trim() || req.protocol;
    const rawHost = (req.headers["x-forwarded-host"] as string)?.split(",")[0]?.trim() || req.get("host") || "";
    // Only allow safe host values (alphanumeric, dots, hyphens, colons for port)
    const safeProto = proto === "https" ? "https" : "http";
    const safeHost = /^[a-zA-Z0-9.\-:]+$/.test(rawHost) ? rawHost : (process.env.APP_ORIGIN ?? "aidowedding.net");
    const origin = `${safeProto}://${safeHost}`;
    const formUrl = `${origin}/collect/${req.params.token}`;

    const safeTitle = escapeHtml(title);
    const safeDescription = escapeHtml(description);
    const safeFormUrl = escapeHtml(formUrl);
    const safePreviewUrl = escapeHtml(`${origin}/api/guest-collect/${req.params.token}/preview`);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${safePreviewUrl}" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDescription}" />
  <meta property="og:site_name" content="A.IDO — AI Wedding Planning OS" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDescription}" />
  <meta http-equiv="refresh" content="0;url=${safeFormUrl}" />
</head>
<body>
  <script>window.location.replace(${JSON.stringify(formUrl)});</script>
  <p>Redirecting… <a href="${safeFormUrl}">Click here if you are not redirected</a></p>
</body>
</html>`);
  } catch (err) {
    req.log.error(err, "Failed to render OG preview");
    res.status(500).send("Error");
  }
});

router.get("/guest-collect/:token", async (req, res) => {
  try {
    const profiles = await db
      .select()
      .from(weddingProfiles)
      .where(eq(weddingProfiles.guestCollectionToken, req.params.token))
      .limit(1);

    if (!profiles.length) {
      return res.status(404).json({ error: "Invalid or expired link." });
    }

    const p = profiles[0];
    res.json({
      partner1Name: p.partner1Name,
      partner2Name: p.partner2Name,
      weddingDate: p.weddingDate,
      venue: p.venue,
    });
  } catch (err) {
    req.log.error(err, "Failed to get guest collect info");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/guest-collect/:token", publicRsvpLimiter, async (req, res) => {
  try {
    const profiles = await db
      .select()
      .from(weddingProfiles)
      .where(eq(weddingProfiles.guestCollectionToken, req.params.token))
      .limit(1);

    if (!profiles.length) {
      return res.status(404).json({ error: "Invalid or expired link." });
    }

    const { name, email, phone, address, mealChoice, dietaryNotes, plusOne, plusOneFirstName, plusOneLastName } = req.body;
    const trimmedName = cleanTextField(name, 120);
    const trimmedEmail = cleanTextField(email, 254).toLowerCase() || null;
    const cleanPhone = cleanTextField(phone, 40) || null;
    const cleanAddress = cleanTextField(address, 500) || null;
    const cleanMeal = cleanTextField(mealChoice, 80) || null;
    const cleanDietary = cleanMeal === "other" ? cleanTextField(dietaryNotes, 500) || null : null;
    const cleanPlusOneFirstName = cleanTextField(plusOneFirstName, 80);
    const cleanPlusOneLastName = cleanTextField(plusOneLastName, 80);

    if (!trimmedName) {
      return res.status(400).json({ error: "Your name is required." });
    }
    if (trimmedEmail && !EMAIL_RE.test(trimmedEmail)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    const profileId = profiles[0].id;

    const dupConditions = [ilike(guests.name, trimmedName)];
    if (trimmedEmail) dupConditions.push(ilike(guests.email, trimmedEmail));

    const existing = await db
      .select({ id: guests.id })
      .from(guests)
      .where(and(eq(guests.profileId, profileId), or(...dupConditions)));

    if (existing.length > 0) {
      return res.status(409).json({ error: "It looks like your info is already in the system — no need to submit again!" });
    }

    const plusOneName = plusOne
      ? [cleanPlusOneFirstName, cleanPlusOneLastName].filter(Boolean).join(" ") || null
      : null;

    const [created] = await db
      .insert(guests)
      .values({
        profileId,
        name: trimmedName,
        email: trimmedEmail,
        phone: cleanPhone,
        address: cleanAddress,
        rsvpStatus: "pending",
        mealChoice: cleanMeal,
        dietaryNotes: cleanDietary,
        plusOne: !!plusOne,
        plusOneName,
        source: "self_collect",
        acknowledgedAt: null,
      })
      .returning();

    res.status(201).json({ success: true, guestId: created.id });
  } catch (err) {
    req.log.error(err, "Failed to submit guest info");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
