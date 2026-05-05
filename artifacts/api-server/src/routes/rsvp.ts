import { Router } from "express";
import { db, guests, weddingProfiles, invitationCustomizations } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { resolveProfile, resolveCallerRole, hasMinRole } from "../lib/workspaceAccess";
import { sendEmail } from "../lib/resend";
import { ObjectStorageService } from "../lib/objectStorage";
import { evaluateCustomDesignCompleteness } from "../lib/customDesignValidation";
import { openai, getModel } from "@workspace/integrations-openai-ai-server";
import crypto from "crypto";

const objectStorageService = new ObjectStorageService();

const router = Router();

// Default colors (fallback)
const DEFAULT_COLORS = {
  primary: "#D4A017",
  secondary: "#F5C842",
  accent: "#D4A017",
  neutral: "#E8E0D0",
};

// Allow only known/safe font families in email HTML to avoid injection.
const ALLOWED_FONTS = new Set([
  "Georgia", "Playfair Display", "Cormorant Garamond", "Great Vibes",
  "Times New Roman", "Arial", "Helvetica", "Plus Jakarta Sans", "Inter",
  "Lato", "Montserrat", "Merriweather", "Dancing Script", "Sacramento",
  "Tangerine", "Parisienne", "Cinzel", "EB Garamond", "Libre Baskerville",
  "Crimson Text", "Raleway", "Poppins", "Open Sans", "Josefin Sans",
  "Quicksand", "Lora", "Garamond",
]);

function sanitizeFont(font: string | null | undefined, fallback: string): string {
  if (!font) return fallback;
  return ALLOWED_FONTS.has(font) ? font : fallback;
}

function fontStack(font: string): string {
  return `'${font}', Georgia, 'Times New Roman', serif`;
}

/**
 * Escape user-provided text before interpolating into email HTML.
 * Wedding profile text overrides are owner-controlled, but workspace
 * collaborators can still author them — guests must not be exposed to
 * arbitrary HTML/script injection from those fields.
 */
function escapeHtml(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isLightColor(hex: string): boolean {
  const h = (hex || "").replace("#", "");
  if (h.length !== 6) return true;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
}

function buildOrigin(req: import("express").Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0]?.trim() || req.protocol;
  const host = (req.headers["x-forwarded-host"] as string)?.split(",")[0]?.trim() || req.get("host") || "";
  return `${proto}://${host}`;
}

/**
 * Resolves a stored photo URL to an R2File regardless of whether the URL is in the
 * legacy private `/objects/...` format or the newer public
 * `/api/storage/public-objects/<folder>/<file>` format produced by uploadFile.
 */
async function resolvePhotoFile(photoUrl: string) {
  const PUBLIC_PREFIX = "/api/storage/public-objects/";
  const PUBLIC_PREFIX_NO_API = "/storage/public-objects/";
  let publicPath: string | null = null;
  if (photoUrl.startsWith(PUBLIC_PREFIX)) publicPath = photoUrl.slice(PUBLIC_PREFIX.length);
  else if (photoUrl.startsWith(PUBLIC_PREFIX_NO_API)) publicPath = photoUrl.slice(PUBLIC_PREFIX_NO_API.length);
  if (publicPath) {
    const file = await objectStorageService.searchPublicObject(publicPath);
    if (!file) throw new Error("Public photo not found: " + publicPath);
    return file;
  }
  return objectStorageService.getObjectEntityFile(photoUrl);
}

async function getImageAsBase64(photoUrl: string | null | undefined): Promise<string | null> {
  if (!photoUrl) return null;
  // Skip blob URLs — they only exist in the browser and cannot be fetched server-side.
  if (photoUrl.startsWith("blob:")) return null;

  const TIMEOUT_MS = 8_000;

  async function doFetch(): Promise<string | null> {
    try {
      // External HTTPS/HTTP URLs: fetch directly rather than going through object storage.
      if (photoUrl!.startsWith("https://") || photoUrl!.startsWith("http://")) {
        const resp = await fetch(photoUrl!, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!resp.ok) return null;
        const buffer = Buffer.from(await resp.arrayBuffer());
        const contentType = resp.headers.get("Content-Type") || "image/jpeg";
        return `data:${contentType};base64,${buffer.toString("base64")}`;
      }

      const file = await resolvePhotoFile(photoUrl!);
      const response = await objectStorageService.downloadObject(file, 86400);
      if (!response.body) return null;

      const chunks: Uint8Array[] = [];
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }

      const buffer = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
      const base64 = buffer.toString("base64");
      const contentType = response.headers.get("Content-Type") || "image/jpeg";
      return `data:${contentType};base64,${base64}`;
    } catch (err) {
      console.error("[getImageAsBase64] failed for URL:", photoUrl, err);
      return null;
    }
  }

  // Race the fetch against a hard timeout so a slow/hanging object-storage
  // connection never blocks the entire email-send request.
  return Promise.race([
    doFetch(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// AI-generated email templates — mirror the AiDigitalInvitationPreview /
// AiSaveDatePreview components so what the planner sees in the modal is what
// the guest receives in their inbox: navy #1E1A2E card + gold #D4A017 accents,
// A.IDO logo, optional photo with rounded corners, badge icon, italic gold
// couple line, and a prominent gold call-to-action.
// ─────────────────────────────────────────────────────────────────────────────

const AI_BG = "#1E1A2E";
const AI_PAGE_BG = "#14111f";
const AI_GOLD = "#D4A017";
const AI_WHITE = "#ffffff";
const AI_MUTED = "rgba(255,255,255,0.58)";
const AI_CARD_BDR = "rgba(255,255,255,0.12)";
const AI_CORMORANT = "'Cormorant Garamond','Playfair Display',Georgia,serif";
const AI_JAKARTA = "'Plus Jakarta Sans','Helvetica Neue',Arial,sans-serif";

function aiLogoBlock(logoBase64: string | null, accent = AI_GOLD): string {
  return logoBase64
    ? `<img src="${logoBase64}" alt="A.IDO" width="48" style="height:48px;width:auto;display:inline-block;border:0;outline:none;text-decoration:none;" />`
    : `<span style="font-family:${AI_CORMORANT};font-size:22px;font-style:italic;color:${accent};letter-spacing:1px;">A.IDO</span>`;
}

function aiPhotoBlock(
  photoSrc: string | null,
  alt: string,
  objectPos: string,
  bg = AI_BG,
): string {
  if (!photoSrc) return "";
  return `
        <tr>
          <td bgcolor="${bg}" style="background:${bg};padding:0 20px 12px;line-height:0;font-size:0;">
            <div style="width:100%;aspect-ratio:520/200;border-radius:8px;overflow:hidden;box-shadow:0 6px 30px rgba(0,0,0,0.5);">
              <img src="${photoSrc}" alt="${escapeHtml(alt)}" width="520" style="width:100%;height:100%;display:block;object-fit:cover;object-position:${objectPos};border:0;outline:none;text-decoration:none;" />
            </div>
          </td>
        </tr>`;
}

interface AiDigitalInviteOpts {
  couple: string;
  guestName: string;
  weddingDateStr: string | null;
  venue: string | null;
  venueAddress: string | null;
  cityStateZip: string;
  ceremonyTimeStr: string | null;
  receptionTimeStr: string | null;
  invitationMessage: string | null;
  rsvpUrl: string;
  photoImgSrc: string | null;
  photoObjectPos: string;
  logoBase64: string | null;
  // Optional color overrides for custom design mode; omit to use default navy/gold brand palette
  overrideBg?: string;
  overridePageBg?: string;
  overrideAccent?: string;
  overrideText?: string;
  overrideMuted?: string;
  overrideCardBdr?: string;
  overrideCoupleFont?: string;
}

function aiDigitalInvitationHtml(opts: AiDigitalInviteOpts): string {
  const BG       = opts.overrideBg       ?? AI_BG;
  const PAGE_BG  = opts.overridePageBg   ?? AI_PAGE_BG;
  const ACCENT   = opts.overrideAccent   ?? AI_GOLD;
  const TEXT_COL = opts.overrideText     ?? AI_WHITE;
  const MUTED    = opts.overrideMuted    ?? AI_MUTED;
  const CARD_BDR = opts.overrideCardBdr  ?? AI_CARD_BDR;
  const SERIF    = opts.overrideCoupleFont
    ? `'${opts.overrideCoupleFont}',${AI_CORMORANT}` : AI_CORMORANT;
  const FOOTER_BG = opts.overrideBg ? BG : "#15121d";
  const BTN_TXT  = isLightColor(ACCENT) ? "#000000" : (opts.overrideBg ? TEXT_COL : AI_BG);

  const timesLine = [
    opts.ceremonyTimeStr ? `Ceremony ${opts.ceremonyTimeStr}` : null,
    opts.receptionTimeStr ? `Reception ${opts.receptionTimeStr}` : null,
  ].filter(Boolean).join(" · ");

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no" />
  <title>Wedding Invitation — ${escapeHtml(opts.couple)}</title>
  <style>
    a[x-apple-data-detectors], u + #body a { color: inherit !important; text-decoration: none !important; }
  </style>
</head>
<body id="body" bgcolor="${PAGE_BG}" style="margin:0;padding:0;background:${PAGE_BG};-webkit-font-smoothing:antialiased;font-family:${AI_JAKARTA};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${PAGE_BG}" style="background:${PAGE_BG};padding:32px 16px;">
    <tr><td bgcolor="${PAGE_BG}" align="center">

      <table role="presentation" width="420" cellpadding="0" cellspacing="0" bgcolor="${BG}" style="max-width:420px;width:100%;background:${BG};border-radius:12px;overflow:hidden;border:1px solid ${CARD_BDR};box-shadow:0 24px 60px rgba(0,0,0,0.55);">

        <tr>
          <td bgcolor="${BG}" style="background:${BG};padding:20px 0 6px;text-align:center;">
            ${aiLogoBlock(opts.logoBase64, ACCENT)}
          </td>
        </tr>

        ${aiPhotoBlock(opts.photoImgSrc, opts.couple, opts.photoObjectPos, BG)}

        <tr>
          <td bgcolor="${BG}" style="background:${BG};padding:14px 0 4px;text-align:center;">
            <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>
              <td width="52" height="52" align="center" valign="middle" style="background:${ACCENT}22;border:1px solid ${ACCENT}44;border-radius:50%;width:52px;height:52px;line-height:52px;font-size:24px;color:${ACCENT};">&hearts;</td>
            </tr></table>
          </td>
        </tr>

        <tr>
          <td bgcolor="${BG}" style="background:${BG};padding:14px 24px 0;text-align:center;">
            <p style="margin:0;font-family:${AI_JAKARTA};font-size:11px;font-weight:700;letter-spacing:4.5px;text-transform:uppercase;color:${ACCENT};">Wedding RSVP</p>
          </td>
        </tr>

        <tr>
          <td bgcolor="${BG}" style="background:${BG};padding:8px 24px 0;text-align:center;">
            <h1 style="margin:0;font-family:${SERIF};font-size:32px;font-weight:400;font-style:italic;color:${ACCENT};line-height:1.2;">${escapeHtml(opts.couple)}</h1>
          </td>
        </tr>

        ${opts.weddingDateStr ? `
        <tr>
          <td bgcolor="${BG}" style="background:${BG};padding:14px 24px 0;text-align:center;">
            <p style="margin:0;font-family:${AI_JAKARTA};font-size:11px;font-weight:600;letter-spacing:1.4px;text-transform:uppercase;color:${TEXT_COL};">${escapeHtml(opts.weddingDateStr)}</p>
          </td>
        </tr>` : ""}

        ${opts.venue ? `
        <tr>
          <td bgcolor="${BG}" style="background:${BG};padding:12px 24px 0;text-align:center;">
            <p style="margin:0;font-family:${SERIF};font-size:16px;font-weight:500;color:${ACCENT};">
              <span style="color:${ACCENT};font-size:13px;">&#9679;</span>&nbsp;${escapeHtml(opts.venue)}
            </p>
          </td>
        </tr>` : ""}

        ${opts.venueAddress ? `
        <tr>
          <td bgcolor="${BG}" style="background:${BG};padding:4px 24px 0;text-align:center;">
            <p style="margin:0;font-family:${AI_JAKARTA};font-size:11px;color:${TEXT_COL};">${escapeHtml(opts.venueAddress)}</p>
          </td>
        </tr>` : ""}

        ${opts.cityStateZip ? `
        <tr>
          <td bgcolor="${BG}" style="background:${BG};padding:2px 24px 0;text-align:center;">
            <p style="margin:0;font-family:${AI_JAKARTA};font-size:11px;color:${TEXT_COL};">${escapeHtml(opts.cityStateZip)}</p>
          </td>
        </tr>` : ""}

        ${timesLine ? `
        <tr>
          <td bgcolor="${BG}" style="background:${BG};padding:8px 24px 0;text-align:center;">
            <p style="margin:0;font-family:${AI_JAKARTA};font-size:11px;color:${ACCENT};">${escapeHtml(timesLine)}</p>
          </td>
        </tr>` : ""}

        ${opts.invitationMessage ? `
        <tr>
          <td bgcolor="${BG}" style="background:${BG};padding:18px 28px 0;text-align:center;">
            <p style="margin:0;font-family:${SERIF};font-size:15px;font-style:italic;color:${TEXT_COL};line-height:1.7;">&ldquo;${escapeHtml(opts.invitationMessage)}&rdquo;</p>
          </td>
        </tr>` : ""}

        <tr>
          <td bgcolor="${BG}" style="background:${BG};padding:18px 28px 0;text-align:center;">
            <p style="margin:0;font-family:${AI_JAKARTA};font-size:13px;color:${MUTED};">
              Dear <span style="color:${TEXT_COL};font-weight:600;">${escapeHtml(opts.guestName)}</span>, will you be joining us?
            </p>
          </td>
        </tr>

        <tr>
          <td bgcolor="${BG}" style="background:${BG};padding:18px 32px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="border-top:1px solid ${CARD_BDR};height:1px;font-size:1px;line-height:1px;">&nbsp;</td>
            </tr></table>
          </td>
        </tr>

        <tr>
          <td bgcolor="${BG}" style="background:${BG};padding:18px 24px 28px;text-align:center;">
            <a href="${opts.rsvpUrl}" style="display:block;background:${ACCENT};color:${BTN_TXT};font-family:${AI_JAKARTA};font-size:13px;font-weight:700;text-decoration:none;letter-spacing:1.5px;text-transform:uppercase;padding:14px 24px;border-radius:8px;">RSVP NOW</a>
            <p style="margin:12px 0 0;font-family:${AI_JAKARTA};font-size:10px;color:${MUTED};">
              Button not working? <a href="${opts.rsvpUrl}" style="color:${ACCENT};text-decoration:underline;">Open your RSVP</a>
            </p>
          </td>
        </tr>

        <tr>
          <td bgcolor="${FOOTER_BG}" style="background:${FOOTER_BG};padding:16px 24px;text-align:center;border-top:1px solid ${CARD_BDR};">
            <p style="margin:0 0 4px;font-family:${AI_JAKARTA};font-size:10px;color:${MUTED};letter-spacing:0.5px;">Planning your own wedding?</p>
            <p style="margin:0;font-family:${AI_JAKARTA};font-size:10px;color:${MUTED};">
              <a href="https://aidowedding.net" style="color:${ACCENT};text-decoration:none;font-weight:600;">Try A.IDO free</a> — AI-powered wedding planning
            </p>
          </td>
        </tr>

      </table>

    </td></tr>
  </table>
</body>
</html>`;
}

interface AiSaveTheDateOpts {
  couple: string;
  weddingDateStr: string | null;
  venue: string | null;
  venueAddress: string | null;
  cityStateZip: string;
  ceremonyTimeStr: string | null;
  receptionTimeStr: string | null;
  saveTheDateMessage: string | null;
  viewUrl: string;
  photoImgSrc: string | null;
  photoObjectPos: string;
  logoBase64: string | null;
  // Optional color overrides for custom design mode; omit to use default navy/gold brand palette
  overrideBg?: string;
  overridePageBg?: string;
  overrideAccent?: string;
  overrideText?: string;
  overrideMuted?: string;
  overrideCardBdr?: string;
  overrideCoupleFont?: string;
}

function aiSaveTheDateHtml(opts: AiSaveTheDateOpts): string {
  const BG       = opts.overrideBg       ?? AI_BG;
  const PAGE_BG  = opts.overridePageBg   ?? AI_PAGE_BG;
  const ACCENT   = opts.overrideAccent   ?? AI_GOLD;
  const TEXT_COL = opts.overrideText     ?? AI_WHITE;
  const MUTED    = opts.overrideMuted    ?? AI_MUTED;
  const CARD_BDR = opts.overrideCardBdr  ?? AI_CARD_BDR;
  const SERIF    = opts.overrideCoupleFont
    ? `'${opts.overrideCoupleFont}',${AI_CORMORANT}` : AI_CORMORANT;
  const FOOTER_BG = opts.overrideBg ? BG : "#15121d";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no" />
  <title>Save the Date — ${escapeHtml(opts.couple)}</title>
  <style>
    a[x-apple-data-detectors], u + #body a { color: inherit !important; text-decoration: none !important; }
  </style>
</head>
<body id="body" bgcolor="${PAGE_BG}" style="margin:0;padding:0;background:${PAGE_BG};-webkit-font-smoothing:antialiased;font-family:${AI_JAKARTA};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${PAGE_BG}" style="background:${PAGE_BG};padding:32px 16px;">
    <tr><td bgcolor="${PAGE_BG}" align="center">

      <table role="presentation" width="420" cellpadding="0" cellspacing="0" bgcolor="${BG}" style="max-width:420px;width:100%;background:${BG};border-radius:12px;overflow:hidden;border:1px solid ${CARD_BDR};box-shadow:0 24px 60px rgba(0,0,0,0.55);">

        <tr>
          <td bgcolor="${BG}" style="background:${BG};padding:20px 0 6px;text-align:center;">
            ${aiLogoBlock(opts.logoBase64, ACCENT)}
          </td>
        </tr>

        ${aiPhotoBlock(opts.photoImgSrc, `Save the Date — ${opts.couple}`, opts.photoObjectPos, BG)}

        <tr>
          <td bgcolor="${BG}" style="background:${BG};padding:14px 0 4px;text-align:center;">
            <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>
              <td width="52" height="52" align="center" valign="middle" style="background:${ACCENT}22;border:1px solid ${ACCENT}44;border-radius:50%;width:52px;height:52px;line-height:52px;font-size:22px;color:${ACCENT};">&#9993;</td>
            </tr></table>
          </td>
        </tr>

        <tr>
          <td bgcolor="${BG}" style="background:${BG};padding:14px 24px 0;text-align:center;">
            <p style="margin:0;font-family:${AI_JAKARTA};font-size:11px;font-weight:700;letter-spacing:4.5px;text-transform:uppercase;color:${ACCENT};">Save the Date</p>
          </td>
        </tr>

        <tr>
          <td bgcolor="${BG}" style="background:${BG};padding:8px 24px 0;text-align:center;">
            <h1 style="margin:0;font-family:${SERIF};font-size:32px;font-weight:400;font-style:italic;color:${ACCENT};line-height:1.2;">${escapeHtml(opts.couple)}</h1>
          </td>
        </tr>

        <tr>
          <td bgcolor="${BG}" style="background:${BG};padding:14px 40px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="border-top:1px solid ${CARD_BDR};height:1px;font-size:1px;line-height:1px;">&nbsp;</td>
            </tr></table>
          </td>
        </tr>

        ${opts.weddingDateStr ? `
        <tr>
          <td bgcolor="${BG}" style="background:${BG};padding:14px 24px 0;text-align:center;">
            <p style="margin:0;font-family:${AI_JAKARTA};font-size:11px;font-weight:600;letter-spacing:1.4px;text-transform:uppercase;color:${TEXT_COL};">${escapeHtml(opts.weddingDateStr)}</p>
          </td>
        </tr>` : ""}

        ${opts.saveTheDateMessage ? `
        <tr>
          <td bgcolor="${BG}" style="background:${BG};padding:18px 28px 0;text-align:center;">
            <p style="margin:0;font-family:${SERIF};font-size:15px;font-style:italic;color:${TEXT_COL};line-height:1.7;">&ldquo;${escapeHtml(opts.saveTheDateMessage)}&rdquo;</p>
          </td>
        </tr>` : ""}

        <tr>
          <td bgcolor="${BG}" style="background:${BG};padding:14px 24px 0;text-align:center;">
            <p style="margin:0;font-family:${SERIF};font-size:13px;font-style:italic;color:${MUTED};">Formal invitation to follow</p>
          </td>
        </tr>

        <tr>
          <td bgcolor="${BG}" style="background:${BG};padding:18px 24px 28px;text-align:center;">
            <a href="${opts.viewUrl}" style="display:inline-block;background:${ACCENT}1a;border:1px solid ${CARD_BDR};color:${MUTED};font-family:${AI_JAKARTA};font-size:11px;font-weight:600;text-decoration:none;letter-spacing:2px;text-transform:uppercase;padding:12px 28px;border-radius:6px;">&darr;&nbsp;View &amp; Download</a>
          </td>
        </tr>

        <tr>
          <td bgcolor="${FOOTER_BG}" style="background:${FOOTER_BG};padding:16px 24px;text-align:center;border-top:1px solid ${CARD_BDR};">
            <p style="margin:0 0 4px;font-family:${AI_JAKARTA};font-size:10px;color:${MUTED};letter-spacing:0.5px;">Planning your own wedding?</p>
            <p style="margin:0;font-family:${AI_JAKARTA};font-size:10px;color:${MUTED};">
              <a href="https://aidowedding.net" style="color:${ACCENT};text-decoration:none;font-weight:600;">Try A.IDO free</a> — AI-powered wedding planning
            </p>
          </td>
        </tr>

      </table>

    </td></tr>
  </table>
</body>
</html>`;
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

    // Fetch invitation customizations — wrapped in try/catch so a missing column
    // or schema mismatch never blocks the email from sending.
    let customization: typeof invitationCustomizations.$inferSelect | null = null;
    try {
      const customizationRows = await db
        .select()
        .from(invitationCustomizations)
        .where(eq(invitationCustomizations.profileId, profile.id))
        .limit(1);
      customization = customizationRows.length > 0 ? customizationRows[0] : null;
    } catch {
      // Schema mismatch or missing columns — continue with defaults
    }

    // When useGeneratedInvitation is true (or we couldn't load customization),
    // skip custom colours/photo and use the AI-generated defaults.
    const useGenerated = customization?.useGeneratedInvitation !== false;

    if (!useGenerated) {
      const completeness = evaluateCustomDesignCompleteness({ customization, profile });
      if (!completeness.isComplete) {
        return res.status(422).json({
          error: "Your custom design is not finished. Please complete your customization or switch to an AI-generated design before sending.",
          missing: completeness.missing,
          code: "custom_design_incomplete",
        });
      }
    }

    const colors = (!useGenerated && customization?.colorPalette) ? customization.colorPalette : DEFAULT_COLORS;
    // Photo URL: prefer the customization photo regardless of mode (the modal
    // preview uses the same fallback), then the profile's invitation photos.
    const digitalInvitationPhotoUrl =
      customization?.digitalInvitationPhotoUrl
        ?? profile.digitalInvitationPhotoUrl
        ?? profile.invitationPhotoUrl
        ?? null;
    const headingFont = !useGenerated
      ? sanitizeFont(customization?.digitalInvitationFont || customization?.selectedFont, "Playfair Display")
      : "Playfair Display";

    // Pull text & photo overrides from the customization so the email mirrors
    // exactly what the user sees in the DigitalInvitationPreview canvas.
    const digOverrides = (!useGenerated
      ? (customization?.textOverrides as Record<string, {
          text?: string;
          color?: string;
          font?: string;
          objectX?: number;
          objectY?: number;
        }> | null) ?? {}
      : {}) as Record<string, { text?: string; color?: string; font?: string; objectX?: number; objectY?: number }>;
    const digPhotoOverride = digOverrides["dig:photo"] ?? {};
    // In AI mode the planner positions the photo via the AiPreview drag → stored
    // on `customization.digitalInvitationPhotoPosition`. In custom mode the
    // canvas writes the position to the `dig:photo` text override.
    const aiDigPhotoPos = (customization?.digitalInvitationPhotoPosition as { x?: number; y?: number } | null) ?? null;
    const digPhotoObjectPos = useGenerated
      ? `${aiDigPhotoPos?.x ?? 50}% ${aiDigPhotoPos?.y ?? 50}%`
      : `${digPhotoOverride.objectX ?? 50}% ${digPhotoOverride.objectY ?? 50}%`;

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

      // Fetch and embed photo as base64; fall back to a direct HTTPS URL so the
      // photo still renders in email clients that load external images.
      const photoBase64 = await getImageAsBase64(digitalInvitationPhotoUrl);
      const photoImgSrc: string | null = photoBase64 ?? (
        digitalInvitationPhotoUrl && !digitalInvitationPhotoUrl.startsWith("blob:")
          ? (digitalInvitationPhotoUrl.startsWith("http") ? digitalInvitationPhotoUrl : `${origin}${digitalInvitationPhotoUrl}`)
          : null
      );
      // Honour the user's photo positioning from the canvas. Same approach as
      // the Save the Date email — fixed-aspect frame with object-position.
      const photoBlock = photoImgSrc
        ? `
        <tr>
          <td style="padding:0;line-height:0;font-size:0;">
            <div style="width:100%;max-width:560px;aspect-ratio:560/360;overflow:hidden;">
              <img src="${photoImgSrc}" alt="${couple}'s Wedding" width="560" style="width:100%;height:100%;display:block;object-fit:cover;object-position:${digPhotoObjectPos};"/>
            </div>
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

      const cityStateZip = [
        profile.venueCity,
        [profile.venueState, profile.venueZip].filter(Boolean).join(" "),
      ].filter(Boolean).join(", ");

      const monthDayYear = profile.weddingDate
        ? (() => {
            const [y, m, d] = profile.weddingDate.split("-").map(Number);
            return new Date(y, m - 1, d).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            });
          })()
        : null;

      const timesLine = [
        ceremonyTimeStr ? `Ceremony ${ceremonyTimeStr}` : null,
        receptionTimeStr ? `Reception ${receptionTimeStr}` : null,
      ]
        .filter(Boolean)
        .join("  •  ");

      // Colors: custom design palette in custom mode, brand defaults in AI mode.
      const rawBg = !useGenerated && customization?.digitalInvitationBackground
        ? customization.digitalInvitationBackground : "#1E1A2E";
      const bgIsLight = isLightColor(rawBg);
      const PAGE_BG = !useGenerated ? rawBg : "#1a1614";
      const BG = rawBg;
      // Mirror the DigitalInvitationPreview component: primary for main content,
      // neutral for labels/heading text.
      const TEXT = !useGenerated ? colors.primary : "#e8dcc7";
      const MUTED = !useGenerated ? (colors.neutral || "#e8dcc7") : "#b6a890";
      const ACCENT = !useGenerated ? colors.accent : "#c9a97e";
      const BTN_BG = !useGenerated ? colors.primary : "#8a6a4f";
      const BTN_TXT = isLightColor(BTN_BG) ? "#000000" : "#ffffff";
      // Text overrides — honour the canvas edits for the headline, couple,
      // date, location and message so the email reads exactly like the preview.
      // Override IDs match those defined in DigitalInvitationPreview.tsx.
      const digHeadingText = escapeHtml(
        digOverrides["dig:greeting"]?.text || "You are cordially invited to",
      );
      const digCoupleText = escapeHtml(
        digOverrides["dig:couple"]?.text || `${couple}'s Wedding`,
      );
      const digDateText = escapeHtml(
        digOverrides["dig:date-value"]?.text || monthDayYear || "",
      );
      const digVenueText = escapeHtml(
        digOverrides["dig:venue-value"]?.text || profile.venue || "",
      );
      const digLocationText = escapeHtml(
        digOverrides["dig:location"]?.text || profile.location || "",
      );
      const digCityText = escapeHtml(
        digOverrides["dig:city-state-zip"]?.text || cityStateZip || "",
      );
      const invitationMessage = escapeHtml(
        !useGenerated
          ? (digOverrides["dig:message"]?.text || profile.invitationMessage)
          : profile.invitationMessage,
      );

      // ── Render the email — both AI and custom modes use the same A.IDO template
      // structure; custom mode swaps in the user's color palette.
      const logoBase64 = await getImageAsBase64(`${origin}/logo.png`);
      let html: string;
      if (useGenerated) {
        html = aiDigitalInvitationHtml({
          couple,
          guestName: guest.name,
          weddingDateStr,
          venue: profile.venue,
          venueAddress: profile.location,
          cityStateZip,
          ceremonyTimeStr,
          receptionTimeStr,
          invitationMessage: profile.invitationMessage,
          rsvpUrl,
          photoImgSrc,
          photoObjectPos: digPhotoObjectPos,
          logoBase64,
        });
      } else {
        html = aiDigitalInvitationHtml({
          couple: digOverrides["dig:couple"]?.text || `${couple}'s Wedding`,
          guestName: guest.name,
          weddingDateStr: digOverrides["dig:date-value"]?.text || weddingDateStr,
          venue: digOverrides["dig:venue-value"]?.text || profile.venue || null,
          venueAddress: digOverrides["dig:location"]?.text || profile.location || null,
          cityStateZip: digOverrides["dig:city-state-zip"]?.text || cityStateZip,
          ceremonyTimeStr,
          receptionTimeStr,
          invitationMessage: digOverrides["dig:message"]?.text || profile.invitationMessage || null,
          rsvpUrl,
          photoImgSrc,
          photoObjectPos: digPhotoObjectPos,
          logoBase64,
          overrideBg: BG,
          overridePageBg: PAGE_BG,
          overrideAccent: ACCENT,
          overrideText: bgIsLight ? "#1a1a1a" : "#ffffff",
          overrideMuted: bgIsLight ? "rgba(0,0,0,0.58)" : "rgba(255,255,255,0.58)",
          overrideCardBdr: bgIsLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)",
          overrideCoupleFont: headingFont,
        });
      }

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
    const errorMsg = err instanceof Error ? err.message : String(err);
    req.log.error({ error: errorMsg, stack: err instanceof Error ? err.stack : undefined }, "Failed to send RSVP");
    res.status(500).json({ error: "Internal server error", details: errorMsg });
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

    // Try customized photo first, fall back to profile photo
    const customizations = await db
      .select({ digitalInvitationPhotoUrl: invitationCustomizations.digitalInvitationPhotoUrl })
      .from(invitationCustomizations)
      .where(eq(invitationCustomizations.profileId, rows[0].profileId))
      .limit(1);

    let photoUrl = customizations[0]?.digitalInvitationPhotoUrl;

    if (!photoUrl) {
      const profiles = await db
        .select({ invitationPhotoUrl: weddingProfiles.invitationPhotoUrl })
        .from(weddingProfiles)
        .where(eq(weddingProfiles.id, rows[0].profileId))
        .limit(1);
      photoUrl = profiles[0]?.invitationPhotoUrl;
    }

    if (!photoUrl) return res.status(404).end();

    const file = await resolvePhotoFile(photoUrl);
    const response = await objectStorageService.downloadObject(file, 86400);

    const contentType = response.headers.get("Content-Type") ?? "image/jpeg";
    const cacheControl = response.headers.get("Cache-Control") ?? "public, max-age=86400";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", cacheControl);
    res.setHeader("Access-Control-Allow-Origin", "*");

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

    // Also pull customization to expose its photo (and to ensure hasPhoto reflects
    // either the customization's digital invitation photo or the profile fallback).
    const customizationRows = profile
      ? await db
          .select({
            digitalInvitationPhotoUrl: invitationCustomizations.digitalInvitationPhotoUrl,
            colorPalette: invitationCustomizations.colorPalette,
            customColors: invitationCustomizations.customColors,
            digitalInvitationBackground: invitationCustomizations.digitalInvitationBackground,
            digitalInvitationFont: invitationCustomizations.digitalInvitationFont,
            digitalInvitationLayout: invitationCustomizations.digitalInvitationLayout,
          })
          .from(invitationCustomizations)
          .where(eq(invitationCustomizations.profileId, profile.id))
          .limit(1)
      : [];
    const c = customizationRows[0] ?? null;
    const customizationPhoto = c?.digitalInvitationPhotoUrl ?? null;

    // Merge customColors on top of the palette (same logic as the frontend)
    const basePalette = c?.colorPalette ?? DEFAULT_COLORS;
    const mergedPalette = c?.customColors
      ? { ...basePalette, ...c.customColors }
      : basePalette;

    // Resolve the best available photo URL — prefer the digital invitation
    // customization photo, then fall back to the profile's invitation photo.
    // We return it directly so the guest page can load it without a proxy hop.
    const resolvedPhotoUrl = customizationPhoto || profile?.invitationPhotoUrl || null;

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
      plusOneAllowed: true,
      hasPhoto: !!resolvedPhotoUrl,
      photoUrl: resolvedPhotoUrl,
      invitationMessage: profile?.invitationMessage ?? null,
      // Custom design theming — used to style the RSVP page
      colorPalette: mergedPalette,
      backgroundColor: c?.digitalInvitationBackground ?? null,
      font: c?.digitalInvitationFont ?? null,
      layout: c?.digitalInvitationLayout ?? null,
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

    // Fetch invitation customizations — wrapped in try/catch so a missing column
    // or schema mismatch never blocks the email from sending.
    let customization: typeof invitationCustomizations.$inferSelect | null = null;
    try {
      const customizationRows = await db
        .select()
        .from(invitationCustomizations)
        .where(eq(invitationCustomizations.profileId, profile.id))
        .limit(1);
      customization = customizationRows.length > 0 ? customizationRows[0] : null;
    } catch (custErr) {
      console.error("[send-save-the-date] customization SELECT failed:", custErr);
    }
    console.log("[send-save-the-date] photoUrl =", customization?.saveTheDatePhotoUrl ?? "(null/missing)");

    // When useGeneratedInvitation is true (or we couldn't load customization),
    // skip custom colours/photo and use the AI-generated defaults.
    const useGenerated = customization?.useGeneratedInvitation !== false;

    if (!useGenerated) {
      const completeness = evaluateCustomDesignCompleteness({ customization, profile });
      if (!completeness.isComplete) {
        return res.status(422).json({
          error: "Your custom design is not finished. Please complete your customization or switch to an AI-generated design before sending.",
          missing: completeness.missing,
          code: "custom_design_incomplete",
        });
      }
    }

    const colors = (!useGenerated && customization?.colorPalette) ? customization.colorPalette : DEFAULT_COLORS;
    // Photo URL: prefer the customization photo regardless of mode (the modal
    // preview uses the same fallback), then the profile's save-the-date /
    // invitation photo as a fallback.
    const saveTheDatePhotoUrl =
      customization?.saveTheDatePhotoUrl
        ?? profile.saveTheDatePhotoUrl
        ?? profile.invitationPhotoUrl
        ?? null;
    const headingFont = !useGenerated
      ? sanitizeFont(customization?.saveTheDateFont || customization?.selectedFont, "Playfair Display")
      : "Playfair Display";

    // Pull text & photo overrides from the customization so the email mirrors
    // exactly what the user sees in the SaveTheDatePreview canvas.
    const stdOverrides = (!useGenerated
      ? (customization?.textOverrides as Record<string, {
          text?: string;
          color?: string;
          font?: string;
          objectX?: number;
          objectY?: number;
        }> | null) ?? {}
      : {}) as Record<string, { text?: string; color?: string; font?: string; objectX?: number; objectY?: number }>;
    const stdPhotoOverride = stdOverrides["std:photo"] ?? {};
    // In AI mode the planner positions the photo via the AiPreview drag → stored
    // on `customization.saveTheDatePhotoPosition`. In custom mode the canvas
    // writes the position to the `std:photo` text override.
    const aiStdPhotoPos = (customization?.saveTheDatePhotoPosition as { x?: number; y?: number } | null) ?? null;
    const stdPhotoObjectPos = useGenerated
      ? `${aiStdPhotoPos?.x ?? 50}% ${aiStdPhotoPos?.y ?? 50}%`
      : `${stdPhotoOverride.objectX ?? 50}% ${stdPhotoOverride.objectY ?? 50}%`;

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

      // Fetch and embed photo as base64; fall back to a direct HTTPS URL so the
      // photo still renders in email clients that load external images.
      const photoBase64 = await getImageAsBase64(saveTheDatePhotoUrl);
      const photoImgSrc: string | null = photoBase64 ?? (
        saveTheDatePhotoUrl && !saveTheDatePhotoUrl.startsWith("blob:")
          ? (saveTheDatePhotoUrl.startsWith("http") ? saveTheDatePhotoUrl : `${origin}${saveTheDatePhotoUrl}`)
          : null
      );
      // Honour the user's photo positioning from the canvas. We use a fixed
      // aspect-ratio frame and `object-position` so the photo crops the same
      // way as in the SaveTheDatePreview component.
      const photoBlock = photoImgSrc
        ? `
        <tr>
          <td style="padding:0;line-height:0;font-size:0;">
            <div style="width:100%;max-width:560px;aspect-ratio:560/360;overflow:hidden;">
              <img src="${photoImgSrc}" alt="Save the Date — ${couple}" width="560" style="width:100%;height:100%;display:block;object-fit:cover;object-position:${stdPhotoObjectPos};"/>
            </div>
          </td>
        </tr>`
        : "";

      const locationLine = [
        profile.venue,
        profile.location,
        [profile.venueCity, [profile.venueState, profile.venueZip].filter(Boolean).join(" ")].filter(Boolean).join(", "),
      ].filter(Boolean).join(" · ");

      const STD_EMAIL_BG = !useGenerated && customization?.saveTheDateBackground
        ? customization.saveTheDateBackground : "#ffffff";
      const stdBgIsLight = isLightColor(STD_EMAIL_BG);
      const STD_MUTED = !useGenerated ? (stdBgIsLight ? "#666666" : "#bbbbbb") : "#9a8a7e";
      const STD_TIMES = !useGenerated ? (stdBgIsLight ? "#888888" : "#aaaaaa") : "#b0a09a";
      const STD_ITALIC = !useGenerated ? (stdBgIsLight ? "#7a6a5a" : "#cccccc") : "#7a6a5a";
      const STD_FOOTER_BG = !useGenerated ? (stdBgIsLight ? "#f5f0eb" : STD_EMAIL_BG) : "#f5f2ef";
      const STD_FOOTER_TEXT = !useGenerated ? (stdBgIsLight ? "#a89890" : "#bbbbbb") : "#a89890";

      // Text overrides — the canvas lets the user edit the actual text of the
      // headline, couple line, date, and message. Honour those edits here so
      // the email reads exactly like the preview.
      // Override IDs match those defined in SaveTheDatePreview.tsx.
      const stdHeadingText = escapeHtml(
        stdOverrides["std:heading"]?.text || "Save the Date",
      );
      const stdCoupleText = escapeHtml(
        stdOverrides["std:couple"]?.text || couple,
      );
      const stdDateText = escapeHtml(
        stdOverrides["std:date"]?.text || weddingDateStr || "",
      );
      const stdCityText = escapeHtml(
        stdOverrides["std:city-state-zip"]?.text || "",
      );
      const stdLocationLine = escapeHtml(locationLine);
      const saveTheDateMessage = escapeHtml(
        !useGenerated
          ? (stdOverrides["std:message"]?.text || (profile as any).saveTheDateMessage)
          : (profile as any).saveTheDateMessage,
      );

      // ── AI-generated mode ─────────────────────────────────────────────
      // Render the navy + gold layout that mirrors AiSaveDatePreview so what
      // the planner sees in the modal is what the guest receives.
      // ── Render the email — both AI and custom modes use the same A.IDO template
      // structure; custom mode swaps in the user's color palette.
      const logoBase64 = await getImageAsBase64(`${origin}/logo.png`);
      const stdCityStateZip = [
        profile.venueCity,
        [profile.venueState, profile.venueZip].filter(Boolean).join(" "),
      ].filter(Boolean).join(", ");
      let html: string;
      if (useGenerated) {
        html = aiSaveTheDateHtml({
          couple,
          weddingDateStr,
          venue: profile.venue,
          venueAddress: profile.location,
          cityStateZip: stdCityStateZip,
          ceremonyTimeStr,
          receptionTimeStr,
          saveTheDateMessage: (profile as any).saveTheDateMessage ?? null,
          viewUrl: `${origin}/save-the-date/${token}`,
          photoImgSrc,
          photoObjectPos: stdPhotoObjectPos,
          logoBase64,
        });
      } else {
        html = aiSaveTheDateHtml({
          couple: stdOverrides["std:couple"]?.text || couple,
          weddingDateStr: stdOverrides["std:date"]?.text || weddingDateStr,
          venue: null,
          venueAddress: null,
          cityStateZip: "",
          ceremonyTimeStr: null,
          receptionTimeStr: null,
          saveTheDateMessage: stdOverrides["std:message"]?.text || (profile as any).saveTheDateMessage || null,
          viewUrl: `${origin}/save-the-date/${token}`,
          photoImgSrc,
          photoObjectPos: stdPhotoObjectPos,
          logoBase64,
          overrideBg: STD_EMAIL_BG,
          overridePageBg: STD_EMAIL_BG,
          overrideAccent: colors.accent,
          overrideText: stdBgIsLight ? "#1a1a1a" : "#ffffff",
          overrideMuted: stdBgIsLight ? "rgba(0,0,0,0.58)" : "rgba(255,255,255,0.58)",
          overrideCardBdr: stdBgIsLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)",
          overrideCoupleFont: headingFont,
        });
      }

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
    const errorMsg = err instanceof Error ? err.message : String(err);
    req.log.error({ error: errorMsg, stack: err instanceof Error ? err.stack : undefined }, "Failed to send save-the-date");
    res.status(500).json({ error: "Internal server error", details: errorMsg });
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

    // Try to get customized photo first, fall back to profile photo
    const customizations = await db.select({ saveTheDatePhotoUrl: invitationCustomizations.saveTheDatePhotoUrl }).from(invitationCustomizations).where(eq(invitationCustomizations.profileId, rows[0].profileId)).limit(1);
    let photoUrl = customizations.length > 0 ? (customizations[0] as any).saveTheDatePhotoUrl : null;

    if (!photoUrl) {
      const profiles = await db.select({ saveTheDatePhotoUrl: weddingProfiles.saveTheDatePhotoUrl }).from(weddingProfiles).where(eq(weddingProfiles.id, rows[0].profileId)).limit(1);
      if (!profiles.length) return res.status(404).end();
      photoUrl = (profiles[0] as any).saveTheDatePhotoUrl;
    }

    if (!photoUrl) return res.status(404).end();
    const file = await resolvePhotoFile(photoUrl);
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
