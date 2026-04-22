import { Router } from "express";
import { db } from "@workspace/db";
import { vendorConversations, vendorMessages, vendors } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { cleanInboundText, htmlToText, parseInboundAddress } from "../../lib/resend";
import { logger } from "../../lib/logger";

const router = Router();

interface CloudflareInboundPayload {
  to?: string;
  from?: string;
  fromName?: string;
  subject?: string;
  text?: string;
  html?: string;
  messageId?: string;
  attachments?: Array<{ name?: string; url?: string; type?: string; size?: number }>;
}

function parseFromHeader(from: string | undefined): { email: string; name?: string } {
  if (!from) return { email: "" };
  const m = from.match(/^\s*"?([^"<]*?)"?\s*<(.+?)>\s*$/);
  if (m) return { name: m[1].trim() || undefined, email: m[2].trim() };
  return { email: from.trim() };
}

router.post("/webhooks/cloudflare/inbound", async (req, res) => {
  try {
    const secret = process.env.CLOUDFLARE_INBOUND_SECRET;
    if (!secret) {
      logger.error("CLOUDFLARE_INBOUND_SECRET not set");
      return res.status(500).json({ error: "Server not configured" });
    }
    const auth = req.header("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (token !== secret) {
      logger.warn({ ip: req.ip }, "Cloudflare inbound webhook auth failed");
      return res.status(401).json({ error: "Invalid auth" });
    }

    const payload = (req.body ?? {}) as CloudflareInboundPayload;
    const recipient = payload.to ?? "";
    const parsed = parseInboundAddress(recipient);
    if (!parsed) {
      logger.warn({ recipient }, "Cloudflare inbound: no routing match");
      return res.status(200).json({ ignored: true, reason: "no routing match" });
    }
    const { conversationId, token: inboundToken } = parsed;

    const [conv] = await db
      .select()
      .from(vendorConversations)
      .where(and(eq(vendorConversations.id, conversationId), eq(vendorConversations.inboundToken, inboundToken)))
      .limit(1);
    if (!conv) {
      logger.warn({ conversationId }, "Cloudflare inbound: token mismatch");
      return res.status(200).json({ ignored: true, reason: "token mismatch" });
    }

    // Idempotency
    if (payload.messageId) {
      const [existing] = await db
        .select({ id: vendorMessages.id })
        .from(vendorMessages)
        .where(and(eq(vendorMessages.conversationId, conv.id), eq(vendorMessages.inboundMessageId, payload.messageId)))
        .limit(1);
      if (existing) {
        return res.status(200).json({ ok: true, deduped: true });
      }
    }

    const sender = parseFromHeader(payload.from);
    if (payload.fromName && !sender.name) sender.name = payload.fromName;

    const bodyText = (payload.text && payload.text.trim()) || "";
    const bodyHtml = payload.html || "";
    const rawText = bodyText || (bodyHtml ? htmlToText(bodyHtml) : "");
    const cleanedAttempt = cleanInboundText(rawText);
    const cleaned = cleanedAttempt || rawText.trim() || "(empty message)";
    const subject = payload.subject ?? conv.subject;

    const attachments = (payload.attachments ?? [])
      .filter((a) => a && a.url && /^https:\/\//i.test(a.url))
      .map((a) => ({
        name: a.name ?? "attachment",
        url: a.url!,
        type: a.type ?? "application/octet-stream",
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
      inboundMessageId: payload.messageId ?? null,
      deliveryStatus: "received",
    });

    await db
      .update(vendorConversations)
      .set({
        lastMessageAt: new Date(),
        lastMessagePreview: cleaned.slice(0, 140),
        unreadCount: (conv.unreadCount ?? 0) + 1,
        subject,
      })
      .where(eq(vendorConversations.id, conv.id));

    if (sender.email) {
      const [vendor] = await db.select().from(vendors).where(eq(vendors.id, conv.vendorId)).limit(1);
      if (vendor && !vendor.email) {
        await db.update(vendors).set({ email: sender.email }).where(eq(vendors.id, vendor.id));
      }
    }

    res.json({ ok: true, conversationId: conv.id });
  } catch (err) {
    logger.error(err, "cloudflare inbound webhook failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
