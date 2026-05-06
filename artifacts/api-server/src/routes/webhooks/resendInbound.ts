import { Router, raw } from "express";
import { db } from "@workspace/db";
import { vendorConversations, vendorMessages, vendors } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { cleanInboundText, findRoutingAddressInText, htmlToText, parseInboundAddress, getEmail } from "../../lib/resend";
import { logger } from "../../lib/logger";
import { Webhook } from "svix";

const router = Router();

// In-memory ring buffer of the last 20 inbound webhook attempts (resets on restart)
const recentHits: Array<{ ts: string; result: string; conversationId?: number; senderEmail?: string; recipient?: string; reason?: string }> = [];
function logHit(result: string, extra: { conversationId?: number; senderEmail?: string; recipient?: string; reason?: string } = {}) {
  recentHits.unshift({ ts: new Date().toISOString(), result, ...extra });
  if (recentHits.length > 20) recentHits.pop();
}

// Last raw payload received (truncated) for debugging
let lastPayload: { ts: string; recipients?: string[]; from?: string; subject?: string; bodyPreview?: string } | null = null;

// GET /api/webhooks/resend/status — config check + recent hit log (no auth needed, safe info only)
router.get("/webhooks/resend/status", (_req, res) => {
  res.json({
    secretConfigured: !!process.env.RESEND_WEBHOOK_SECRET,
    inboundDomain: process.env.INBOUND_EMAIL_DOMAIN ?? "mail.aidowedding.net (default)",
    fromEmail: process.env.RESEND_FROM_EMAIL ?? "(default)",
    recentHits,
    lastPayload,
  });
});

interface ResendInboundEvent {
  type?: string;
  data?: {
    email_id?: string;
    from?: { email?: string; name?: string } | string;
    to?: Array<{ email?: string } | string> | string;
    subject?: string;
    text?: string;
    html?: string;
    headers?: Record<string, string>;
    message_id?: string;
    attachments?: Array<{ filename?: string; content_type?: string; url?: string; size?: number }>;
  };
}

function extractRecipient(to: unknown): string[] {
  if (!to) return [];
  if (typeof to === "string") return [to];
  if (Array.isArray(to)) {
    return to.map((x) => (typeof x === "string" ? x : (x as { email?: string })?.email ?? "")).filter(Boolean);
  }
  return [];
}

function extractSender(from: unknown): { email: string; name?: string } {
  if (!from) return { email: "" };
  if (typeof from === "string") {
    const lt = from.indexOf("<");
    const gt = from.lastIndexOf(">");
    if (lt >= 0 && gt > lt) {
      return { name: from.slice(0, lt).trim().replace(/"/g, ""), email: from.slice(lt + 1, gt).trim() };
    }
    return { email: from.trim() };
  }
  const f = from as { email?: string; name?: string };
  return { email: f.email ?? "", name: f.name };
}

// Use raw body so we can verify the Svix signature.
router.post("/webhooks/resend/inbound", raw({ type: "*/*", limit: "20mb" }), async (req, res) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";

    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) {
      logger.error("RESEND_WEBHOOK_SECRET not set");
      return res.status(500).json({ error: "Server not configured" });
    }
    try {
      const wh = new Webhook(secret);
      wh.verify(rawBody, {
        "svix-id": req.header("svix-id") ?? "",
        "svix-timestamp": req.header("svix-timestamp") ?? "",
        "svix-signature": req.header("svix-signature") ?? "",
      });
    } catch (err) {
      logger.warn({ svixId: req.header("svix-id"), err: String(err) }, "Inbound webhook signature verification failed");
      logHit("error:invalid_signature");
      return res.status(401).json({ error: "Invalid signature" });
    }

    let event: ResendInboundEvent;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }

    logger.info({ payload: rawBody.slice(0, 4000) }, "inbound raw payload");

    const data = event.data ?? {};
    const recipients = extractRecipient(data.to);
    lastPayload = {
      ts: new Date().toISOString(),
      recipients,
      from: typeof data.from === "string" ? data.from : data.from?.email,
      subject: data.subject,
      bodyPreview: ((data.text ?? "") || (data.html ?? "")).slice(0, 1000),
    };
    let conversationId: number | null = null;
    let token: string | null = null;
    for (const r of recipients) {
      const parsed = parseInboundAddress(r);
      if (parsed) {
        conversationId = parsed.conversationId;
        token = parsed.token;
        break;
      }
    }

    // Fallback: vendor replied to From (not Reply-To) so the To header has
    // no routing info. Fetch the body if needed and scan it for the routing
    // address — it typically appears in the quoted original message.
    if (!conversationId || !token) {
      let fbText = (data.text && data.text.trim()) || "";
      let fbHtml = data.html || "";
      if (!fbText && !fbHtml && data.email_id) {
        const full = await getEmail(data.email_id);
        fbText = full?.text?.trim() || "";
        fbHtml = full?.html || "";
      }
      const found =
        findRoutingAddressInText(fbText) ??
        findRoutingAddressInText(fbHtml);
      if (found) {
        conversationId = found.conversationId;
        token = found.token;
        logger.info({ recipients, source: "fallback" }, "Inbound: routing matched via body fallback");
      }
    }

    if (!conversationId || !token) {
      logger.warn({ recipients }, "Inbound email had no matching routing address");
      logHit("ignored:no_routing_match");
      return res.status(200).json({ ignored: true, reason: "no routing match" });
    }

    const [conv] = await db.select().from(vendorConversations)
      .where(and(eq(vendorConversations.id, conversationId), eq(vendorConversations.inboundToken, token)))
      .limit(1);
    if (!conv) {
      logger.warn({ conversationId }, "Inbound email token mismatch");
      logHit("ignored:token_mismatch", { conversationId });
      return res.status(200).json({ ignored: true, reason: "token mismatch" });
    }

    // Idempotency: skip if message_id already seen for this conversation.
    if (data.message_id) {
      const [existing] = await db.select({ id: vendorMessages.id }).from(vendorMessages)
        .where(and(eq(vendorMessages.conversationId, conv.id), eq(vendorMessages.inboundMessageId, data.message_id)))
        .limit(1);
      if (existing) {
        logHit("ignored:duplicate", { conversationId: conv.id });
        return res.status(200).json({ ok: true, deduped: true });
      }
    }

    const sender = extractSender(data.from);

    // Sender identity check: the token is already a cryptographic secret so
    // the email check is advisory only. Log a mismatch but still accept the
    // message — vendors often reply from a different address than the one saved
    // in their profile (personal vs business email, alias, etc.) and silently
    // dropping their reply is worse than accepting it.
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, conv.vendorId)).limit(1);
    if (vendor) {
      if (vendor.email) {
        const normalizedSender = sender.email.trim().toLowerCase();
        const normalizedVendor = vendor.email.trim().toLowerCase();
        if (normalizedSender && normalizedSender !== normalizedVendor) {
          logger.warn(
            { conversationId: conv.id, vendorId: vendor.id, expectedEmail: vendor.email, actualEmail: sender.email },
            "Inbound email sender mismatch — accepting anyway (token is authoritative)"
          );
        }
      } else if (sender.email) {
        await db.update(vendors).set({ email: sender.email.trim().toLowerCase() }).where(eq(vendors.id, vendor.id));
      }
    }

    let bodyText = (data.text && data.text.trim()) || "";
    let bodyHtml = data.html || "";
    if (!bodyText && !bodyHtml && data.email_id) {
      const full = await getEmail(data.email_id);
      bodyText = full?.text?.trim() || "";
      bodyHtml = full?.html || "";
    }
    const rawText = bodyText || (bodyHtml ? htmlToText(bodyHtml) : "");
    const cleanedAttempt = cleanInboundText(rawText);
    const cleaned = cleanedAttempt || rawText.trim() || "(empty message)";
    const subject = data.subject ?? conv.subject;

    const attachments = (data.attachments ?? [])
      .filter((a) => a && a.url && /^https:\/\//i.test(a.url))
      .map((a) => ({
        name: a.filename ?? "attachment",
        url: a.url!,
        type: a.content_type ?? "application/octet-stream",
        size: a.size,
      }));

    await db.insert(vendorMessages).values({
      conversationId: conv.id,
      senderType: "vendor",
      senderName: sender.name ?? null,
      senderEmail: sender.email || null,
      subject,
      body: cleaned,
      attachments,
      inboundMessageId: data.message_id ?? null,
      deliveryStatus: "received",
    });

    await db.update(vendorConversations).set({
      lastMessageAt: new Date(),
      lastMessagePreview: cleaned.slice(0, 140),
      unreadCount: (conv.unreadCount ?? 0) + 1,
      subject,
    }).where(eq(vendorConversations.id, conv.id));

    logHit("saved", { conversationId: conv.id, senderEmail: sender.email });
    res.json({ ok: true, conversationId: conv.id });
  } catch (err) {
    logHit("error:exception");
    logger.error(err, "resend inbound webhook failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
