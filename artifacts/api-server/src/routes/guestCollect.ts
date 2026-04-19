import { Router } from "express";
import { db, guests, weddingProfiles } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import crypto from "crypto";

const router = Router();

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

    const { name, email, phone, address, plusOne, plusOneName } = req.body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "Your name is required." });
    }

    const [created] = await db
      .insert(guests)
      .values({
        profileId: profiles[0].id,
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        rsvpStatus: "attending",
        plusOne: !!plusOne,
        plusOneName: plusOne && plusOneName?.trim() ? plusOneName.trim() : null,
      })
      .returning();

    res.status(201).json({ success: true, guestId: created.id });
  } catch (err) {
    req.log.error(err, "Failed to submit guest info");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
