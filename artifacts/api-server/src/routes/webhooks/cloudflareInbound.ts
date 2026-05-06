import { Router, json } from "express";
import { db } from "@workspace/db";
import { vendorConversations, vendorMessages, vendors } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import PostalMime from "postal-mime";
import { cleanInboundText, htmlToText, parseInboundAddress } from "../../lib/resend";
import { logger } from "../../lib/logger";

const router = Router();

interface CloudflareInboundPayload {
  to?: string;
  from?: string;
  rawMime?: string;
}

function parseFromHeader(from: string | undefined): { email: string; name?: string } {
  if (!from) return { email: "" };
  const lt = from.indexOf("<");
  const gt = from.lastIndexOf(">");
  if (lt >= 0 && gt > lt) {
    const name = from.slice(0, lt).trim().replace(/^"|"$/g, "") || undefined;
    return { name, email: from.slice(lt + 1, gt).trim() };
  }
  return { email: from.trim() };
}

router.post("/webhooks/cloudflare/inbound", json({ limit: "20mb" }), async (req, res) => {
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

    // Parse the raw MIME on our side (so the worker stays dependency-free)
    let parsedMime: Awaited<ReturnType<InstanceType<typeof PostalMime>["parse"]>> | null = null;
    if (payload.rawMime) {
      try {
        parsedMime = await new PostalMime().parse(payload.rawMime);
      } catch (e) {
        logger.warn({ err: String(e) }, "Cloudflare inbound: MIME parse failed");
      }
    }

    const recipient = payload.to ?? parsedMime?.to?.[0]?.address ?? "";
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

    const messageId = parsedMime?.messageId ?? null;

    // Idempotency
    if (messageId) {
      const [existing] = await db
        .select({ id: vendorMessages.id })
        .from(vendorMessages)
        .where(and(eq(vendorMessages.conversationId, conv.id), eq(vendorMessages.inboundMessageId, messageId)))
        .limit(1);
      if (existing) {
        return res.status(200).json({ ok: true, deduped: true });
      }
    }

    const fromAddr = parsedMime?.from?.address ?? "";
    const fromName = parsedMime?.from?.name ?? "";
    const sender = fromAddr
      ? { email: fromAddr, name: fromName || undefined }
      : parseFromHeader(payload.from);

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
            "Cloudflare inbound email sender mismatch — rejecting as possible impersonation"
          );
          return res.status(200).json({ ignored: true, reason: "sender mismatch" });
        }
      } else if (sender.email) {
        await db.update(vendors).set({ email: sender.email.trim().toLowerCase() }).where(eq(vendors.id, vendor.id));
      }
    }

    const bodyText = (parsedMime?.text && parsedMime.text.trim()) || "";
    const bodyHtml = parsedMime?.html || "";
    const rawText = bodyText || (bodyHtml ? htmlToText(bodyHtml) : "");
    const cleanedAttempt = cleanInboundText(rawText);
    const cleaned = cleanedAttempt || rawText.trim() || "(empty message)";
    const subject = parsedMime?.subject ?? conv.subject;

    // Attachments arrive as buffers from postal-mime; we record metadata only
    // for now (vendor replies rarely include heavy attachments).
    const attachments = (parsedMime?.attachments ?? []).slice(0, 10).map((a) => ({
      name: a.filename ?? "attachment",
      url: "",
      type: a.mimeType ?? "application/octet-stream",
      size: a.content instanceof ArrayBuffer ? a.content.byteLength : undefined,
    }));

    await db.insert(vendorMessages).values({
      conversationId: conv.id,
      senderType: "vendor",
      senderName: sender.name ?? null,
      senderEmail: sender.email || null,
      subject,
      body: cleaned,
      attachments,
      inboundMessageId: messageId,
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

    res.json({ ok: true, conversationId: conv.id });
  } catch (err) {
    logger.error(err, "cloudflare inbound webhook failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
