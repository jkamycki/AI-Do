import { logger } from "./logger";
import * as crypto from "crypto";
import he from "he";

const RESEND_API = "https://api.resend.com";

export const INBOUND_DOMAIN = process.env.INBOUND_EMAIL_DOMAIN ?? "mail.aidowedding.net";
export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? `messaging@${INBOUND_DOMAIN}`;
export const FROM_NAME = process.env.RESEND_FROM_NAME ?? "A.IDO Messaging";

// The domain Resend is verified to SEND from (extracted from FROM_EMAIL).
// Used to build the per-conversation From/Reply-To address so that vendor
// replies to either field are routed back to the right conversation.
export const SENDING_DOMAIN = FROM_EMAIL.split("@")[1] ?? INBOUND_DOMAIN;

export interface SendEmailParams {
  to: string;
  from?: string;
  fromName?: string;
  replyTo?: string;
  bcc?: string | string[];
  cc?: string | string[];
  subject: string;
  text: string;
  html?: string;
  headers?: Record<string, string>;
  attachments?: Array<{ filename: string; path?: string; content?: string; contentType?: string }>;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export interface RetrievedEmail {
  text?: string;
  html?: string;
  subject?: string;
  from?: string;
  to?: string[];
}

const AIDO_WEBSITE_URL = "https://aidowedding.net";
const AIDO_WEBSITE_LIGHT_URL = `${AIDO_WEBSITE_URL}?theme=light`;
const AIDO_LOGO_URL = `${AIDO_WEBSITE_URL}/logo.png`;
const AIDO_SIGNATURE_MARKER = "data-aido-email-signature";
const AIDO_SIGNATURE_BG = "#fffaf7";
const AIDO_SIGNATURE_TEXT = "#6f4b5a";
const AIDO_SIGNATURE_ACCENT = "#8d294d";

function escapeEmailHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function textToEmailHtml(text: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#3a1826;font-size:15px;line-height:1.55;white-space:pre-wrap;">${escapeEmailHtml(text)}</div>`;
}

function withLightEmailHints(html: string): string {
  const hints = `
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light" />
  <style>
    :root { color-scheme: light only; supported-color-schemes: light; }
    [${AIDO_SIGNATURE_MARKER}] { background-color: ${AIDO_SIGNATURE_BG} !important; color: ${AIDO_SIGNATURE_TEXT} !important; }
    [data-aido-logo-card] { background-color: ${AIDO_SIGNATURE_BG} !important; background-image: linear-gradient(${AIDO_SIGNATURE_BG}, ${AIDO_SIGNATURE_BG}) !important; }
  </style>`;

  if (/<meta\s+name=["']color-scheme["']/i.test(html)) {
    return html.replace(/<meta\s+name=["']color-scheme["'][^>]*>/i, `<meta name="color-scheme" content="light only" />`)
      .replace(/<meta\s+name=["']supported-color-schemes["'][^>]*>/i, `<meta name="supported-color-schemes" content="light" />`);
  }

  if (/<\/head\s*>/i.test(html)) {
    return html.replace(/<\/head\s*>/i, `${hints}</head>`);
  }

  if (/<html[\s>]/i.test(html)) {
    return html;
  }

  return `<!DOCTYPE html><html><head>${hints}</head><body style="margin:0;padding:0;background:${AIDO_SIGNATURE_BG};color:#3a1826;">${html}</body></html>`;
}

function buildPortalHtmlSignature(): string {
  return `
<table ${AIDO_SIGNATURE_MARKER}="true" role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${AIDO_SIGNATURE_BG}" style="margin-top:32px;border-top:1px solid #ead8cf;background-color:${AIDO_SIGNATURE_BG};background-image:linear-gradient(${AIDO_SIGNATURE_BG},${AIDO_SIGNATURE_BG});color-scheme:light only;mso-color-alt:auto;">
  <tr>
    <td bgcolor="${AIDO_SIGNATURE_BG}" style="padding:18px 0 0;background-color:${AIDO_SIGNATURE_BG};background-image:linear-gradient(${AIDO_SIGNATURE_BG},${AIDO_SIGNATURE_BG});font-family:Arial,Helvetica,sans-serif;color:${AIDO_SIGNATURE_TEXT};font-size:13px;line-height:1.5;">
      <a href="${AIDO_WEBSITE_LIGHT_URL}" target="_blank" rel="noopener noreferrer" data-aido-logo-card="true" style="display:inline-block;text-decoration:none;color:${AIDO_SIGNATURE_ACCENT};font-weight:700;background-color:${AIDO_SIGNATURE_BG};background-image:linear-gradient(${AIDO_SIGNATURE_BG},${AIDO_SIGNATURE_BG});border-radius:14px;padding:8px 12px 6px 0;">
        <img src="${AIDO_LOGO_URL}" alt="A.IDO" width="92" style="display:block;width:92px;max-width:92px;height:auto;border:0;margin:0;outline:none;text-decoration:none;background-color:${AIDO_SIGNATURE_BG};color:${AIDO_SIGNATURE_ACCENT};" />
      </a>
      <div style="margin:2px 0 0;color:${AIDO_SIGNATURE_TEXT};">
        Sent with <a href="${AIDO_WEBSITE_LIGHT_URL}" target="_blank" rel="noopener noreferrer" style="color:${AIDO_SIGNATURE_ACCENT};font-weight:700;text-decoration:none;">A.IDO</a>
      </div>
      <div style="margin:2px 0 0;color:${AIDO_SIGNATURE_TEXT};">
        <a href="${AIDO_WEBSITE_LIGHT_URL}" target="_blank" rel="noopener noreferrer" style="color:${AIDO_SIGNATURE_ACCENT};text-decoration:underline;">${AIDO_WEBSITE_URL}</a>
      </div>
    </td>
  </tr>
</table>`;
}

function appendPortalSignature(text: string, html?: string): { text: string; html: string } {
  const signedText = text.includes("Sent with A.IDO")
    ? text
    : `${text.trimEnd()}\n\n--\nSent with A.IDO\n${AIDO_WEBSITE_LIGHT_URL}`;

  const sourceHtml = html?.trim() ? html : textToEmailHtml(text);
  if (sourceHtml.includes(AIDO_SIGNATURE_MARKER)) {
    return { text: signedText, html: withLightEmailHints(sourceHtml) };
  }

  const signature = buildPortalHtmlSignature();
  const signedHtml = /<\/body\s*>/i.test(sourceHtml)
    ? sourceHtml.replace(/<\/body\s*>/i, `${signature}</body>`)
    : `${sourceHtml}${signature}`;

  return { text: signedText, html: withLightEmailHints(signedHtml) };
}

/** Fetch full inbound email body from Resend by email_id (webhook only sends metadata). */
export async function getEmail(emailId: string): Promise<RetrievedEmail | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  // Validate emailId to prevent SSRF — Resend IDs are alphanumeric with hyphens/underscores
  if (!/^[a-zA-Z0-9_-]{1,200}$/.test(emailId)) return null;
  const candidates = [
    `${RESEND_API}/inbound/emails/${emailId}`,
    `${RESEND_API}/inbound/${emailId}`,
    `${RESEND_API}/emails/${emailId}`,
  ];
  for (const url of candidates) {
    try {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
      if (r.ok) {
        const json = (await r.json()) as RetrievedEmail;
        logger.info({ url, keys: Object.keys(json) }, "Fetched full email from Resend");
        return json;
      }
      logger.info({ url, status: r.status }, "Resend email fetch attempt failed");
    } catch (err) {
      logger.error({ url, err: String(err) }, "Resend getEmail network error");
    }
  }
  return null;
}

export async function sendEmail(p: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not configured" };

  const fromName = p.fromName ?? FROM_NAME;
  const requestedFrom = p.from ?? FROM_EMAIL;
  const requestedDomain = requestedFrom.split("@")[1]?.toLowerCase() ?? "";
  const allowedDomain = SENDING_DOMAIN.toLowerCase();
  // Keep envelope/domain alignment on our verified sender domain to reduce
  // spam classification from spoof-like mismatches.
  const fromEmail = requestedDomain === allowedDomain ? requestedFrom : FROM_EMAIL;
  if (requestedDomain && requestedDomain !== allowedDomain) {
    logger.warn({ requestedFrom, fallbackFrom: FROM_EMAIL }, "sendEmail: non-verified from domain replaced");
  }

  const signedContent = appendPortalSignature(p.text, p.html);

  const body: Record<string, unknown> = {
    from: `${fromName} <${fromEmail}>`,
    to: [p.to],
    reply_to: p.replyTo ?? fromEmail,
    subject: p.subject,
    text: signedContent.text,
  };
  const headers: Record<string, string> = {
    "X-Auto-Response-Suppress": "All",
    "X-Entity-Ref-ID": crypto.randomUUID(),
    ...(p.headers ?? {}),
  };
  if (p.bcc) body.bcc = Array.isArray(p.bcc) ? p.bcc : [p.bcc];
  if (p.cc) body.cc = Array.isArray(p.cc) ? p.cc : [p.cc];
  body.html = signedContent.html;
  body.headers = headers;
  if (p.attachments && p.attachments.length > 0) {
    body.attachments = p.attachments.map((a) => ({
      filename: a.filename,
      ...(a.path ? { path: a.path } : {}),
      ...(a.content ? { content: a.content } : {}),
      ...(a.contentType ? { content_type: a.contentType } : {}),
    }));
  }

  try {
    const r = await fetch(`${RESEND_API}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const json = (await r.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (!r.ok) {
      logger.error({ status: r.status, json }, "Resend send failed");
      return { ok: false, error: json.message ?? json.name ?? `HTTP ${r.status}` };
    }
    return { ok: true, id: json.id };
  } catch (err) {
    logger.error(err, "Resend network error");
    return { ok: false, error: err instanceof Error ? err.message : "network error" };
  }
}

/** Build the per-conversation Reply-To address vendors send replies to. */
export function buildInboundAddress(conversationId: number, token: string): string {
  return `messages+${conversationId}.${token}@${INBOUND_DOMAIN}`;
}

/**
 * Build the per-conversation FROM address used when emailing vendors.
 * Uses the verified SENDING domain so that:
 * - Resend can actually send the email
 * - Vendor replies to the From field (Outlook-style clients) land on the
 *   same domain as the Reply-To and get routed back to the right conversation.
 */
export function buildVendorFromAddress(conversationId: number, token: string): string {
  return `messages+${conversationId}.${token}@${SENDING_DOMAIN}`;
}

/** Parse `messages+{conversationId}.{token}@domain` and return the parts. */
export function parseInboundAddress(addr: string): { conversationId: number; token: string } | null {
  const m = addr.match(/messages\+(\d+)\.([A-Za-z0-9_-]+)@/);
  if (!m) return null;
  return { conversationId: Number(m[1]), token: m[2] };
}

/**
 * Find a routing address anywhere in the supplied text. Used as a fallback
 * when the recipient (To) header doesn't contain a routing match — e.g. a
 * vendor's email client replied to From instead of Reply-To. The routing
 * address typically still appears in the quoted original message at the
 * bottom of the reply.
 */
export function findRoutingAddressInText(text: string): { conversationId: number; token: string } | null {
  if (!text) return null;
  const m = text.match(/messages\+(\d+)\.([A-Za-z0-9_-]+)@[A-Za-z0-9.-]+/);
  if (!m) return null;
  return { conversationId: Number(m[1]), token: m[2] };
}

const SIG_MARKERS = [
  /^--\s*$/m,
  /^sent from my (iphone|android|ipad|samsung|mobile)/im,
  /^get outlook for /im,
  /^________________________________/m,
];

const QUOTE_MARKERS = [
  /^>+\s/m,
  /^on .+ wrote:$/im,
  /^from:\s.+$/im,
  /^-----original message-----/im,
];

/** Strip quoted reply blocks and signatures from inbound email text. */
export function cleanInboundText(text: string): string {
  if (!text) return "";
  let cleaned = text.replace(/\r\n/g, "\n");

  let earliestCut = cleaned.length;
  for (const re of [...QUOTE_MARKERS, ...SIG_MARKERS]) {
    const m = cleaned.match(re);
    if (m && m.index !== undefined && m.index < earliestCut) earliestCut = m.index;
  }
  cleaned = cleaned.slice(0, earliestCut);

  cleaned = cleaned.split("\n").filter((l) => !l.trim().startsWith(">")).join("\n");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();
  return cleaned;
}

/** Strip HTML tags and decode entities — output is plain text, not HTML. */
export function htmlToText(html: string): string {
  if (!html) return "";

  // Remove <style> and <script> blocks using indexOf to avoid ReDoS
  let s = html;
  for (const [open, close] of [["<style", "</style>"], ["<script", "</script>"]] as const) {
    let i: number;
    while ((i = s.toLowerCase().indexOf(open)) >= 0) {
      const j = s.toLowerCase().indexOf(close, i);
      if (j < 0) { s = s.slice(0, i); break; }
      s = s.slice(0, i) + s.slice(j + close.length);
    }
  }

  // Insert newlines for block-level breaks before stripping tags
  s = s.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p\s*>/gi, "\n\n");

  // Strip tags character-by-character (handles > inside attribute values safely)
  let result = "";
  let inTag = false;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "<") { inTag = true; continue; }
    if (s[i] === ">" && inTag) { inTag = false; continue; }
    if (!inTag) result += s[i];
  }

  // Decode HTML entities properly using the `he` library
  return he.decode(result).replace(/\n{3,}/g, "\n\n").trim();
}

export function randomToken(bytes = 18): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

/**
 * Verify a Resend / Svix-style webhook signature.
 * Resend signs webhooks via Svix. Header `svix-signature` contains
 * "v1,<base64sig>", computed as HMAC-SHA256 over `${id}.${timestamp}.${rawBody}`
 * using a secret stored as `RESEND_WEBHOOK_SECRET` ("whsec_<base64>").
 *
 * Returns true ONLY if signature is valid.
 * If RESEND_WEBHOOK_SECRET is not set, returns false (fail-closed).
 */
export function verifyResendWebhook(
  rawBody: string,
  headers: { svixId?: string; svixTimestamp?: string; svixSignature?: string },
): boolean {
  const secretFull = process.env.RESEND_WEBHOOK_SECRET;
  if (!secretFull) return false;
  if (!headers.svixId || !headers.svixTimestamp || !headers.svixSignature) return false;

  // Reject stale (>5 min skew)
  const ts = Number(headers.svixTimestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const secretB64 = secretFull.startsWith("whsec_") ? secretFull.slice(6) : secretFull;
  let secretBytes: Buffer;
  try {
    secretBytes = Buffer.from(secretB64, "base64");
  } catch {
    return false;
  }

  const signedContent = `${headers.svixId}.${headers.svixTimestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secretBytes).update(signedContent).digest("base64");

  // Header format: "v1,sig1 v1,sig2 ..."
  const candidates = headers.svixSignature.split(" ").map((s) => {
    const [, sig] = s.split(",");
    return sig ?? "";
  });

  const expectedBuf = Buffer.from(expected);
  return candidates.some((sig) => {
    if (!sig) return false;
    const sigBuf = Buffer.from(sig);
    return sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
  });
}
