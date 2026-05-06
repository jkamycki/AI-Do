import { logger } from "./logger";
import * as crypto from "crypto";
import he from "he";

const RESEND_API = "https://api.resend.com";

export const INBOUND_DOMAIN = process.env.INBOUND_EMAIL_DOMAIN ?? "mail.aidowedding.net";
export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? `messaging@${INBOUND_DOMAIN}`;
export const FROM_NAME = process.env.RESEND_FROM_NAME ?? "A.IDo Messaging";

export interface SendEmailParams {
  to: string;
  from?: string;
  fromName?: string;
  replyTo: string;
  bcc?: string | string[];
  cc?: string | string[];
  subject: string;
  text: string;
  html?: string;
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
  const fromEmail = p.from ?? FROM_EMAIL;

  const body: Record<string, unknown> = {
    from: `${fromName} <${fromEmail}>`,
    to: [p.to],
    reply_to: p.replyTo,
    subject: p.subject,
    text: p.text,
  };
  if (p.bcc) body.bcc = Array.isArray(p.bcc) ? p.bcc : [p.bcc];
  if (p.cc) body.cc = Array.isArray(p.cc) ? p.cc : [p.cc];
  if (p.html) body.html = p.html;
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

/** Parse `messages+{conversationId}.{token}@domain` and return the parts. */
export function parseInboundAddress(addr: string): { conversationId: number; token: string } | null {
  const m = addr.match(/messages\+(\d+)\.([A-Za-z0-9_-]+)@/);
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
