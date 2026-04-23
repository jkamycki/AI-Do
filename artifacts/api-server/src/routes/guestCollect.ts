import { Router } from "express";
import { db, guests, weddingProfiles } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import crypto from "crypto";

const router = Router();

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

router.post("/guest-collect/generate", requireAuth, async (req, res) => {
  try {
    const profiles = await db
      .select()
      .from(weddingProfiles)
      .where(eq(weddingProfiles.userId, req.userId!))
      .limit(1);

    if (!profiles.length) {
      return res.status(400).json({ error: "No wedding profile found." });
    }

    const existing = profiles[0].guestCollectionToken;
    if (existing) {
      return res.json({ token: existing });
    }

    const token = crypto.randomUUID();
    await db
      .update(weddingProfiles)
      .set({ guestCollectionToken: token })
      .where(eq(weddingProfiles.userId, req.userId!));

    res.json({ token });
  } catch (err) {
    req.log.error(err, "Failed to generate guest collection token");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/guest-collect/regenerate", requireAuth, async (req, res) => {
  try {
    const profiles = await db
      .select()
      .from(weddingProfiles)
      .where(eq(weddingProfiles.userId, req.userId!))
      .limit(1);

    if (!profiles.length) {
      return res.status(400).json({ error: "No wedding profile found." });
    }

    const token = crypto.randomUUID();
    await db
      .update(weddingProfiles)
      .set({ guestCollectionToken: token })
      .where(eq(weddingProfiles.userId, req.userId!));

    res.json({ token });
  } catch (err) {
    req.log.error(err, "Failed to regenerate guest collection token");
    res.status(500).json({ error: "Internal server error" });
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
    const title = `${name1} & ${name2} — Contact Info Request`;
    const description = `${name1} & ${name2} are collecting mailing addresses for their wedding invitations. Tap to share your contact info.`;

    const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0]?.trim() || req.protocol;
    const host = (req.headers["x-forwarded-host"] as string)?.split(",")[0]?.trim() || req.get("host");
    const origin = `${proto}://${host}`;
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

router.post("/guest-collect/:token", async (req, res) => {
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

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "Your name is required." });
    }

    const cleanMeal = typeof mealChoice === "string" && mealChoice.trim() ? mealChoice.trim() : null;
    const cleanDietary = cleanMeal === "other" && typeof dietaryNotes === "string" && dietaryNotes.trim()
      ? dietaryNotes.trim().slice(0, 500)
      : null;

    const plusOneName = plusOne
      ? [plusOneFirstName?.trim(), plusOneLastName?.trim()].filter(Boolean).join(" ") || null
      : null;

    const [created] = await db
      .insert(guests)
      .values({
        profileId: profiles[0].id,
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        rsvpStatus: "pending",
        mealChoice: cleanMeal,
        dietaryNotes: cleanDietary,
        plusOne: !!plusOne,
        plusOneName,
      })
      .returning();

    res.status(201).json({ success: true, guestId: created.id });
  } catch (err) {
    req.log.error(err, "Failed to submit guest info");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
