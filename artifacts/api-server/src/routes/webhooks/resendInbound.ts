import { Router, raw } from "express";
import { db } from "@workspace/db";
import { vendorConversations, vendorMessages, vendors } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { cleanInboundText, htmlToText, parseInboundAddress, getEmail } from "../../lib/resend";
import { logger } from "../../lib/logger";
import { Webhook } from "svix";

const router = Router();

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

    if (!conversationId || !token) {
      logger.warn({ recipients }, "Inbound email had no matching routing address");
      return res.status(200).json({ ignored: true, reason: "no routing match" });
    }

    const [conv] = await db.select().from(vendorConversations)
      .where(and(eq(vendorConversations.id, conversationId), eq(vendorConversations.inboundToken, token)))
      .limit(1);
    if (!conv) {
      logger.warn({ conversationId }, "Inbound email token mismatch");
      return res.status(200).json({ ignored: true, reason: "token mismatch" });
    }

    // Idempotency: skip if message_id already seen for this conversation.
    if (data.message_id) {
      const [existing] = await db.select({ id: vendorMessages.id }).from(vendorMessages)
        .where(and(eq(vendorMessages.conversationId, conv.id), eq(vendorMessages.inboundMessageId, data.message_id)))
        .limit(1);
      if (existing) {
        return res.status(200).json({ ok: true, deduped: true });
      }
    }

    const sender = extractSender(data.from);

    // Sender identity verification: compare the From: address against the stored
    // vendor email. If the vendor has a known email, any mismatch means the token
    // was used by someone other than the actual vendor (impersonation attempt).
    // If no email is stored yet, pin the first sender so future messages can be
    // verified.
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, conv.vendorId)).limit(1);
    if (vendor) {
      if (vendor.email) {
        const normalizedSender = sender.email.trim().toLowerCase();
        const normalizedVendor = vendor.email.trim().toLowerCase();
        if (!normalizedSender || normalizedSender !== normalizedVendor) {
          logger.warn(
            { conversationId: conv.id, vendorId: vendor.id, expectedEmail: vendor.email, actualEmail: sender.email },
            "Inbound email sender mismatch — rejecting as possible impersonation"
          );
          return res.status(200).json({ ignored: true, reason: "sender mismatch" });
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

    res.json({ ok: true, conversationId: conv.id });
  } catch (err) {
    logger.error(err, "resend inbound webhook failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
