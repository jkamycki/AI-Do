import { Router } from "express";
import { db, guests, weddingProfiles } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { resolveProfile, resolveCallerRole, hasMinRole } from "../lib/workspaceAccess";
import { sendEmail } from "../lib/resend";
import { ObjectStorageService } from "../lib/objectStorage";
import { openai, getModel } from "@workspace/integrations-openai-ai-server";
import crypto from "crypto";

const objectStorageService = new ObjectStorageService();

const router = Router();

function buildOrigin(req: import("express").Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0]?.trim() || req.protocol;
  const host = (req.headers["x-forwarded-host"] as string)?.split(",")[0]?.trim() || req.get("host") || "";
  return `${proto}://${host}`;
}

router.get("/guests/:id/rsvp-link", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid guest ID" });

    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) return res.status(403).json({ error: "Insufficient permissions." });

    const profile = await resolveProfile(req);
    if (!profile) return res.status(400).json({ error: "No wedding profile found." });

    const rows = await db
      .select()
      .from(guests)
      .where(and(eq(guests.id, id), eq(guests.profileId, profile.id)))
      .limit(1);

    if (!rows.length) return res.status(404).json({ error: "Guest not found" });
    const guest = rows[0];

    const token = guest.rsvpToken ?? crypto.randomUUID();
    if (!guest.rsvpToken) {
      await db.update(guests).set({ rsvpToken: token }).where(eq(guests.id, id));
    }

    const origin = buildOrigin(req);
    const rsvpUrl = `${origin}/rsvp/${token}`;
    res.json({ rsvpUrl });
  } catch (err) {
    req.log.error(err, "Failed to generate RSVP link");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/guests/:id/send-rsvp", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid guest ID" });

    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) return res.status(403).json({ error: "Insufficient permissions." });

    const profile = await resolveProfile(req);
    if (!profile) return res.status(400).json({ error: "No wedding profile found." });

    const rows = await db
      .select()
      .from(guests)
      .where(and(eq(guests.id, id), eq(guests.profileId, profile.id)))
      .limit(1);

    if (!rows.length) return res.status(404).json({ error: "Guest not found" });
    const guest = rows[0];

    const token = guest.rsvpToken ?? crypto.randomUUID();
    const now = new Date();

    // Track "sent" on invitationStatus — rsvpStatus is reserved for the guest's
    // actual response (attending / maybe / declined / pending).
    await db
      .update(guests)
      .set({ rsvpToken: token, invitationStatus: "sent", rsvpSentAt: now })
      .where(eq(guests.id, id));

    const origin = buildOrigin(req);
    const rsvpUrl = `${origin}/rsvp/${token}`;

    let emailSent = false;
    if (guest.email) {
      const couple = [profile.partner1Name, profile.partner2Name].filter(Boolean).join(" & ") || "The Couple";
      const weddingDateStr = profile.weddingDate
        ? (() => {
            const [y, m, d] = profile.weddingDate.split("-").map(Number);
            return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
          })()
        : null;

      const photoBlock = profile.invitationPhotoUrl
        ? `
        <tr>
          <td style="padding:0;line-height:0;font-size:0;">
            <img src="${origin}/api/rsvp/${token}/photo" alt="${couple}'s Wedding" width="560" style="width:100%;max-width:560px;height:auto;display:block;border-radius:0;"/>
          </td>
        </tr>`
        : "";

      const customMsg = profile.invitationMessage
        ? `<p style="font-family:Georgia,'Times New Roman',serif;color:#7a6a5a;font-size:15px;line-height:1.8;margin:0 0 28px;font-style:italic;">&ldquo;${profile.invitationMessage}&rdquo;</p>`
        : "";

      const formatTime12h = (timeStr: string | null | undefined): string | null => {
        if (!timeStr) return null;
        const [h, m] = timeStr.split(":").map(Number);
        if (Number.isNaN(h) || Number.isNaN(m)) return timeStr;
        const ampm = h >= 12 ? "PM" : "AM";
        const h12 = h % 12 || 12;
        return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
      };

      const ceremonyTimeStr = formatTime12h(profile.ceremonyTime);
      const receptionTimeStr = formatTime12h(profile.receptionTime);

      const receptionCityStateZip = [
        profile.venueCity,
        [profile.venueState, profile.venueZip].filter(Boolean).join(" "),
      ].filter(Boolean).join(", ");

      const ceremonyCityStateZip = [
        profile.ceremonyCity,
        [profile.ceremonyState, profile.ceremonyZip].filter(Boolean).join(" "),
      ].filter(Boolean).join(", ");

      const hasSeparateCeremony = !profile.ceremonyAtVenue && !!(
        profile.ceremonyVenueName || profile.ceremonyAddress || profile.ceremonyCity
      );

      const eventDetailsBlock = hasSeparateCeremony
        ? `
        <tr>
          <td style="padding:18px 32px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="50%" valign="top" style="padding:12px 8px;background:#faf7f4;border-radius:4px;text-align:center;">
                  <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;color:#c9a96e;font-size:9px;letter-spacing:3px;text-transform:uppercase;">Ceremony</p>
                  ${ceremonyTimeStr ? `<p style="margin:0 0 6px;font-family:Georgia,'Times New Roman',serif;color:#3d2e22;font-size:15px;font-weight:bold;">${ceremonyTimeStr}</p>` : ""}
                  ${profile.ceremonyVenueName ? `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;color:#3d2e22;font-size:11px;font-weight:bold;">${profile.ceremonyVenueName}</p>` : ""}
                  ${profile.ceremonyAddress ? `<p style="margin:2px 0 0;font-family:Arial,Helvetica,sans-serif;color:#7a6a5a;font-size:10px;">${profile.ceremonyAddress}</p>` : ""}
                  ${ceremonyCityStateZip ? `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;color:#7a6a5a;font-size:10px;">${ceremonyCityStateZip}</p>` : ""}
                </td>
                <td width="8" style="font-size:1px;line-height:1px;">&nbsp;</td>
                <td width="50%" valign="top" style="padding:12px 8px;background:#faf7f4;border-radius:4px;text-align:center;">
                  <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;color:#c9a96e;font-size:9px;letter-spacing:3px;text-transform:uppercase;">Reception</p>
                  ${receptionTimeStr ? `<p style="margin:0 0 6px;font-family:Georgia,'Times New Roman',serif;color:#3d2e22;font-size:15px;font-weight:bold;">${receptionTimeStr}</p>` : ""}
                  ${profile.venue ? `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;color:#3d2e22;font-size:11px;font-weight:bold;">${profile.venue}</p>` : ""}
                  ${profile.location ? `<p style="margin:2px 0 0;font-family:Arial,Helvetica,sans-serif;color:#7a6a5a;font-size:10px;">${profile.location}</p>` : ""}
                  ${receptionCityStateZip ? `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;color:#7a6a5a;font-size:10px;">${receptionCityStateZip}</p>` : ""}
                </td>
              </tr>
            </table>
          </td>
        </tr>`
        : `
        <tr>
          <td style="padding:8px 48px 0;text-align:center;">
            ${profile.location ? `<p style="margin:4px 0 0;font-family:Arial,Helvetica,sans-serif;color:#7a6a5a;font-size:11px;">${profile.location}</p>` : ""}
            ${receptionCityStateZip ? `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;color:#7a6a5a;font-size:11px;">${receptionCityStateZip}</p>` : ""}
            ${(ceremonyTimeStr || receptionTimeStr) ? `<p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;color:#7a6a5a;font-size:12px;">${[ceremonyTimeStr ? `Ceremony ${ceremonyTimeStr}` : null, receptionTimeStr ? `Reception ${receptionTimeStr}` : null].filter(Boolean).join(" &nbsp;&bull;&nbsp; ")}</p>` : ""}
          </td>
        </tr>`;

      const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="x-apple-disable-message-reformatting"/>
  <title>Wedding Invitation — ${couple}</title>
</head>
<body style="margin:0;padding:0;background-color:#f7f3ef;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f3ef;padding:40px 16px;">
    <tr><td align="center">

      <!-- Outer card -->
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.10);">

        <!-- Hero photo (embedded) -->
        ${photoBlock}

        <!-- Ornament row -->
        <tr>
          <td style="padding:36px 48px 0;text-align:center;">
            <p style="margin:0;font-family:Georgia,'Times New Roman',serif;color:#c9a96e;font-size:22px;letter-spacing:8px;line-height:1;">&#10022; &#10022; &#10022;</p>
          </td>
        </tr>

        <!-- Eyebrow label -->
        <tr>
          <td style="padding:16px 48px 0;text-align:center;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;color:#b8a898;font-size:10px;letter-spacing:4px;text-transform:uppercase;">You are cordially invited to</p>
          </td>
        </tr>

        <!-- Couple names -->
        <tr>
          <td style="padding:14px 48px 0;text-align:center;">
            <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;color:#3d2e22;font-size:34px;font-weight:400;line-height:1.2;">${couple}&rsquo;s Wedding</h1>
          </td>
        </tr>

        <!-- Thin divider -->
        <tr>
          <td style="padding:20px 80px 0;text-align:center;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="border-top:1px solid #e8ddd4;height:1px;font-size:1px;line-height:1px;">&nbsp;</td>
            </tr></table>
          </td>
        </tr>

        <!-- Date and venue -->
        <tr>
          <td style="padding:18px 48px 0;text-align:center;">
            ${weddingDateStr ? `<p style="margin:0 0 4px;font-family:Georgia,'Times New Roman',serif;color:#7a6a5a;font-size:15px;">${weddingDateStr}</p>` : ""}
            ${profile.venue && !hasSeparateCeremony ? `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;color:#b8a898;font-size:12px;letter-spacing:1px;">${profile.venue}</p>` : ""}
          </td>
        </tr>

        <!-- Event details: ceremony / reception with times + addresses -->
        ${eventDetailsBlock}

        <!-- Body copy -->
        <tr>
          <td style="padding:32px 48px 0;text-align:center;">
            <p style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;color:#7a6a5a;font-size:15px;line-height:1.8;">
              Dear <span style="color:#3d2e22;font-weight:bold;">${guest.name}</span>,
            </p>
            ${customMsg}
            <p style="margin:0;font-family:Georgia,'Times New Roman',serif;color:#7a6a5a;font-size:15px;line-height:1.8;">
              We would be deeply honoured to have you join us as we celebrate our love. Please take a moment to let us know if you&rsquo;ll be able to attend.
            </p>
          </td>
        </tr>

        <!-- RSVP button -->
        <tr>
          <td style="padding:36px 48px;text-align:center;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="border-radius:2px;background:#3d2e22;">
                  <a href="${rsvpUrl}" style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;color:#f7f3ef;text-decoration:none;letter-spacing:3px;text-transform:uppercase;padding:16px 44px;">
                    RSVP Now
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:20px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#c4b8ac;">
              Button not working? <a href="${rsvpUrl}" style="color:#c9a96e;text-decoration:underline;">Click here to RSVP</a>
            </p>
          </td>
        </tr>

        <!-- Bottom ornament -->
        <tr>
          <td style="padding:0 48px 8px;text-align:center;">
            <p style="margin:0;font-family:Georgia,'Times New Roman',serif;color:#c9a96e;font-size:18px;letter-spacing:6px;">&#10022; &#10022; &#10022;</p>
          </td>
        </tr>

        <!-- Bottom accent bar -->
        <tr><td style="height:5px;background:linear-gradient(90deg,#c9a96e,#e8c99a,#c9a96e);line-height:5px;font-size:5px;">&nbsp;</td></tr>

        <!-- Footer -->
        <tr>
          <td style="background:#faf7f4;padding:18px 48px;text-align:center;border-top:1px solid #f0ebe4;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#c4b8ac;letter-spacing:0.5px;">
              Planning your own wedding? <a href="https://aidowedding.net" style="color:#c9a96e;text-decoration:none;">Try A.IDO free</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

      const result = await sendEmail({
        to: guest.email,
        replyTo: `noreply@aidowedding.net`,
        fromName: `${couple} via A.IDO`,
        subject: `You're invited — ${couple}'s Wedding`,
        text: `Dear ${guest.name},\n\nYou are cordially invited to ${couple}'s Wedding${weddingDateStr ? ` on ${weddingDateStr}` : ""}${profile.venue ? ` at ${profile.venue}` : ""}.\n\n${profile.invitationMessage ? `"${profile.invitationMessage}"\n\n` : ""}Please RSVP using the link below:\n\n${rsvpUrl}\n\nWith love,\n${couple}`,
        html,
      });
      emailSent = result.ok;
    }

    res.json({ rsvpUrl, emailSent });
  } catch (err) {
    req.log.error(err, "Failed to send RSVP");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/rsvp/:token/photo", async (req, res) => {
  try {
    const rows = await db
      .select({ profileId: guests.profileId })
      .from(guests)
      .where(eq(guests.rsvpToken, req.params.token))
      .limit(1);

    if (!rows.length) return res.status(404).end();

    const profiles = await db
      .select({ invitationPhotoUrl: weddingProfiles.invitationPhotoUrl })
      .from(weddingProfiles)
      .where(eq(weddingProfiles.id, rows[0].profileId))
      .limit(1);

    const photoUrl = profiles[0]?.invitationPhotoUrl;
    if (!photoUrl) return res.status(404).end();

    const file = await objectStorageService.getObjectEntityFile(photoUrl);
    const response = await objectStorageService.downloadObject(file, 86400);

    const contentType = response.headers.get("Content-Type") ?? "image/jpeg";
    const cacheControl = response.headers.get("Cache-Control") ?? "public, max-age=86400";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", cacheControl);

    if (response.body) {
      const { Readable } = await import("stream");
      Readable.fromWeb(response.body as import("stream/web").ReadableStream).pipe(res);
    } else {
      res.status(404).end();
    }
  } catch (err) {
    req.log.error(err, "Failed to serve invitation photo");
    res.status(404).end();
  }
});

router.get("/rsvp/:token", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(guests)
      .where(eq(guests.rsvpToken, req.params.token))
      .limit(1);

    if (!rows.length) return res.status(404).json({ error: "Invalid or expired RSVP link." });
    const guest = rows[0];

    const profiles = await db
      .select()
      .from(weddingProfiles)
      .where(eq(weddingProfiles.id, guest.profileId))
      .limit(1);

    const profile = profiles[0];

    res.json({
      guestName: guest.name,
      partner1Name: profile?.partner1Name ?? null,
      partner2Name: profile?.partner2Name ?? null,
      weddingDate: profile?.weddingDate ?? null,
      venue: profile?.venue ?? null,
      venueAddress: profile?.location ?? null,
      venueCity: profile?.venueCity ?? null,
      venueState: profile?.venueState ?? null,
      venueZip: profile?.venueZip ?? null,
      ceremonyTime: profile?.ceremonyTime ?? null,
      receptionTime: profile?.receptionTime ?? null,
      ceremonyAtVenue: profile?.ceremonyAtVenue ?? true,
      ceremonyVenueName: profile?.ceremonyVenueName ?? null,
      ceremonyAddress: profile?.ceremonyAddress ?? null,
      ceremonyCity: profile?.ceremonyCity ?? null,
      ceremonyState: profile?.ceremonyState ?? null,
      ceremonyZip: profile?.ceremonyZip ?? null,
      currentStatus: guest.rsvpStatus,
      plusOneAllowed: !!guest.plusOne,
      hasPhoto: !!(profile?.invitationPhotoUrl),
      invitationMessage: profile?.invitationMessage ?? null,
    });
  } catch (err) {
    req.log.error(err, "Failed to get RSVP info");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/rsvp/:token", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(guests)
      .where(eq(guests.rsvpToken, req.params.token))
      .limit(1);

    if (!rows.length) return res.status(404).json({ error: "Invalid or expired RSVP link." });
    const guest = rows[0];

    const {
      attendance,
      mealChoice,
      plusOne,
      plusOneName,
      plusOneFirstName,
      plusOneLastName,
      plusOneMealChoice,
      dietaryRestrictions,
    } = req.body;

    if (attendance !== "attending" && attendance !== "declined") {
      return res.status(400).json({ error: "Please select Accept or Decline." });
    }

    // Treat "none" / "no preference" / empty as an explicit clear (null).
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
      // Always set mealChoice (including null for "none") so guests can clear it.
      updateData.mealChoice = normalizeMeal(mealChoice);
      if (plusOne !== undefined) {
        updateData.plusOne = !!plusOne;
        // Prefer split first/last when provided; fall back to combined plusOneName.
        const combined = [
          typeof plusOneFirstName === "string" ? plusOneFirstName.trim() : "",
          typeof plusOneLastName === "string" ? plusOneLastName.trim() : "",
        ].filter(Boolean).join(" ");
        const fallback = typeof plusOneName === "string" ? plusOneName.trim() : "";
        const finalName = combined || fallback;
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
    req.log.error(err, "Failed to submit RSVP");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/guests/:id/send-save-the-date", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid guest ID" });

    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "planner")) return res.status(403).json({ error: "Insufficient permissions." });

    const profile = await resolveProfile(req);
    if (!profile) return res.status(400).json({ error: "No wedding profile found." });

    const rows = await db
      .select()
      .from(guests)
      .where(and(eq(guests.id, id), eq(guests.profileId, profile.id)))
      .limit(1);

    if (!rows.length) return res.status(404).json({ error: "Guest not found" });
    const guest = rows[0];

    const token = guest.rsvpToken ?? crypto.randomUUID();
    if (!guest.rsvpToken) {
      await db.update(guests).set({ rsvpToken: token, saveTheDateStatus: "sent" }).where(eq(guests.id, id));
    } else {
      await db.update(guests).set({ saveTheDateStatus: "sent" }).where(eq(guests.id, id));
    }

    let emailSent = false;
    if (guest.email) {
      const formatTime12h = (timeStr: string | null | undefined): string | null => {
        if (!timeStr) return null;
        const [h, m] = timeStr.split(":").map(Number);
        if (Number.isNaN(h) || Number.isNaN(m)) return timeStr;
        const ampm = h >= 12 ? "PM" : "AM";
        const h12 = h % 12 || 12;
        return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
      };
      const ceremonyTimeStr = formatTime12h(profile.ceremonyTime);
      const receptionTimeStr = formatTime12h(profile.receptionTime);

      const couple = [profile.partner1Name, profile.partner2Name].filter(Boolean).join(" & ") || "The Couple";
      const weddingDateStr = profile.weddingDate
        ? (() => {
            const [y, m, d] = profile.weddingDate.split("-").map(Number);
            return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
          })()
        : null;

      const origin = buildOrigin(req);

      const photoBlock = profile.saveTheDatePhotoUrl
        ? `
        <tr>
          <td style="padding:0;line-height:0;font-size:0;">
            <img src="${origin}/api/save-the-date/${token}/photo" alt="Save the Date — ${couple}" width="560" style="width:100%;max-width:560px;height:auto;display:block;"/>
          </td>
        </tr>`
        : "";

      const locationLine = [
        profile.venue,
        profile.location,
        [profile.venueCity, [profile.venueState, profile.venueZip].filter(Boolean).join(" ")].filter(Boolean).join(", "),
      ].filter(Boolean).join(" · ");

      const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="x-apple-disable-message-reformatting"/>
  <title>Save the Date — ${couple}</title>
</head>
<body style="margin:0;padding:0;background-color:#f7f3ef;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f3ef;padding:40px 16px;">
    <tr><td align="center">

      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.10);">

        ${photoBlock}

        <tr>
          <td style="padding:36px 48px 0;text-align:center;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;color:#b8a898;font-size:10px;letter-spacing:5px;text-transform:uppercase;">Please</p>
          </td>
        </tr>

        <tr>
          <td style="padding:8px 48px 0;text-align:center;">
            <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;color:#3d2e22;font-size:42px;font-weight:400;line-height:1.1;letter-spacing:2px;">Save the Date</h1>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 80px 0;text-align:center;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="border-top:1px solid #e8ddd4;height:1px;font-size:1px;line-height:1px;">&nbsp;</td>
            </tr></table>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 48px 0;text-align:center;">
            <h2 style="margin:0;font-family:Georgia,'Times New Roman',serif;color:#3d2e22;font-size:26px;font-weight:400;">${couple}</h2>
          </td>
        </tr>

        ${weddingDateStr ? `
        <tr>
          <td style="padding:14px 48px 0;text-align:center;">
            <p style="margin:0;font-family:Georgia,'Times New Roman',serif;color:#7a6a5a;font-size:16px;">${weddingDateStr}</p>
          </td>
        </tr>` : ""}

        ${locationLine ? `
        <tr>
          <td style="padding:8px 48px 0;text-align:center;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;color:#b8a898;font-size:12px;letter-spacing:1px;">${locationLine}</p>
          </td>
        </tr>` : ""}

        ${(ceremonyTimeStr || receptionTimeStr) ? `
        <tr>
          <td style="padding:12px 48px 0;text-align:center;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;color:#b8a898;font-size:11px;letter-spacing:1px;">
              ${[ceremonyTimeStr ? `Ceremony ${ceremonyTimeStr}` : null, receptionTimeStr ? `Reception ${receptionTimeStr}` : null].filter(Boolean).join("&nbsp;&nbsp;·&nbsp;&nbsp;")}
            </p>
          </td>
        </tr>` : ""}

        ${(profile as any).saveTheDateMessage ? `
        <tr>
          <td style="padding:20px 48px 0;text-align:center;">
            <p style="margin:0;font-family:Georgia,'Times New Roman',serif;color:#7a6a5a;font-size:15px;line-height:1.7;font-style:italic;">${(profile as any).saveTheDateMessage}</p>
          </td>
        </tr>` : ""}

        <tr>
          <td style="padding:28px 48px 0;text-align:center;">
            <p style="margin:0;font-family:Georgia,'Times New Roman',serif;color:#c9a96e;font-size:14px;font-style:italic;letter-spacing:1px;">Formal invitation to follow</p>
          </td>
        </tr>

        <tr>
          <td style="padding:16px 48px 0;text-align:center;">
            <a href="${origin}/save-the-date/${token}" style="display:inline-block;background:#3d2e22;color:#c9a96e;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:12px 28px;border-radius:2px;">View &amp; Download</a>
          </td>
        </tr>

        <tr><td style="height:36px;font-size:36px;line-height:36px;">&nbsp;</td></tr>

        <tr><td style="height:5px;background:linear-gradient(90deg,#c9a96e,#e8c99a,#c9a96e);line-height:5px;font-size:5px;">&nbsp;</td></tr>

        <tr>
          <td style="background:#faf7f4;padding:18px 48px;text-align:center;border-top:1px solid #f0ebe4;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#c4b8ac;letter-spacing:0.5px;">
              Planning your own wedding? <a href="https://aidowedding.net" style="color:#c9a96e;text-decoration:none;">Try A.IDO free</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

      const timesLine = [ceremonyTimeStr ? `Ceremony ${ceremonyTimeStr}` : null, receptionTimeStr ? `Reception ${receptionTimeStr}` : null].filter(Boolean).join(" · ");
      const result = await sendEmail({
        to: guest.email,
        replyTo: `noreply@aidowedding.net`,
        fromName: `${couple} via A.IDO`,
        subject: `Save the Date — ${couple}'s Wedding`,
        text: `Save the Date!\n\n${couple}\n\n${weddingDateStr ?? ""}${locationLine ? `\n${locationLine}` : ""}${timesLine ? `\n${timesLine}` : ""}\n\nFormal invitation to follow.\n\nView & Download your Save the Date:\n${origin}/save-the-date/${token}\n\nWith love,\n${couple}`,
        html,
      });
      emailSent = result.ok;
    }

    res.json({ emailSent });
  } catch (err) {
    req.log.error(err, "Failed to send save-the-date");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/save-the-date/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const rows = await db.select().from(guests).where(eq(guests.rsvpToken, token)).limit(1);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const guest = rows[0];
    const profiles = await db.select().from(weddingProfiles).where(eq(weddingProfiles.id, guest.profileId)).limit(1);
    if (!profiles.length) return res.status(404).json({ error: "Not found" });
    const profile = profiles[0];
    res.json({
      guestName: guest.name,
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
      ceremonyAtVenue: profile.ceremonyAtVenue,
      ceremonyVenueName: profile.ceremonyVenueName,
      ceremonyAddress: profile.ceremonyAddress,
      ceremonyCity: profile.ceremonyCity,
      ceremonyState: profile.ceremonyState,
      ceremonyZip: profile.ceremonyZip,
      saveTheDateMessage: (profile as any).saveTheDateMessage ?? null,
      hasPhoto: !!(profile as any).saveTheDatePhotoUrl,
    });
  } catch (err) {
    req.log.error(err, "Failed to get save-the-date info");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/save-the-date/:token/photo", async (req, res) => {
  try {
    const { token } = req.params;
    const rows = await db.select({ profileId: guests.profileId }).from(guests).where(eq(guests.rsvpToken, token)).limit(1);
    if (!rows.length) return res.status(404).end();
    const profiles = await db.select({ saveTheDatePhotoUrl: weddingProfiles.saveTheDatePhotoUrl }).from(weddingProfiles).where(eq(weddingProfiles.id, rows[0].profileId)).limit(1);
    if (!profiles.length) return res.status(404).end();
    const photoUrl = (profiles[0] as any).saveTheDatePhotoUrl;
    if (!photoUrl) return res.status(404).end();
    const file = await objectStorageService.getObjectEntityFile(photoUrl);
    const response = await objectStorageService.downloadObject(file, 3600);
    res.set("Content-Type", response.headers.get("Content-Type") || "image/jpeg");
    res.set("Cache-Control", "public, max-age=3600");
    res.set("Access-Control-Allow-Origin", "*");
    const reader = response.body!.getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    };
    await pump();
  } catch (err) {
    req.log.error(err, "Failed to serve save-the-date photo");
    res.status(500).end();
  }
});

router.patch("/profile/invitation-settings", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "partner")) return res.status(403).json({ error: "Insufficient permissions." });

    const profile = await resolveProfile(req);
    if (!profile) return res.status(400).json({ error: "No wedding profile found." });

    const { invitationPhotoUrl, invitationMessage, saveTheDatePhotoUrl, saveTheDateMessage, digitalInvitationPhotoUrl } = req.body;

    const updateData: Partial<typeof weddingProfiles.$inferInsert> = {};
    if (invitationPhotoUrl !== undefined) updateData.invitationPhotoUrl = invitationPhotoUrl || null;
    if (invitationMessage !== undefined) updateData.invitationMessage = invitationMessage || null;
    if (saveTheDatePhotoUrl !== undefined) updateData.saveTheDatePhotoUrl = saveTheDatePhotoUrl || null;
    if (saveTheDateMessage !== undefined) updateData.saveTheDateMessage = saveTheDateMessage || null;
    if (digitalInvitationPhotoUrl !== undefined) updateData.digitalInvitationPhotoUrl = digitalInvitationPhotoUrl || null;

    await db.update(weddingProfiles).set(updateData).where(eq(weddingProfiles.id, profile.id));

    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "Failed to save invitation settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/profile/generate-invitation-message", requireAuth, async (req, res) => {
  try {
    const callerRole = await resolveCallerRole(req);
    if (!hasMinRole(callerRole, "partner")) return res.status(403).json({ error: "Insufficient permissions." });

    const profile = await resolveProfile(req);
    if (!profile) return res.status(400).json({ error: "No wedding profile found." });

    const { details = "" } = req.body;

    const couple = [profile.partner1Name, profile.partner2Name].filter(Boolean).join(" and ");
    const dateStr = profile.weddingDate
      ? new Date(profile.weddingDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
      : null;
    const venue = profile.venue ?? null;

    const context = [
      couple && `Couple: ${couple}`,
      dateStr && `Wedding date: ${dateStr}`,
      venue && `Venue: ${venue}`,
      details && `What the couple wants to convey: ${details}`,
    ].filter(Boolean).join("\n");

    const completion = await openai.chat.completions.create({
      model: getModel(),
      messages: [
        {
          role: "system",
          content: `You write short, beautiful custom messages for digital wedding invitations. The message appears directly below the couple's names on their RSVP page. Base the tone and content entirely on what the couple wants to convey — honour their voice and intent. Keep it to 1–3 sentences, max 300 characters. No salutations, no "Dear guest". Output only the message text — no quotes, no labels.`,
        },
        {
          role: "user",
          content: context,
        },
      ],
      max_tokens: 150,
      temperature: 0.85,
    });

    const message = completion.choices[0]?.message?.content?.trim() ?? "";
    res.json({ message });
  } catch (err) {
    req.log.error(err, "Failed to generate invitation message");
    res.status(500).json({ error: "Failed to generate message" });
  }
});

export default router;
