import { Router, type Request, type Response } from "express";
import { clerkClient } from "@clerk/express";
import { db } from "@workspace/db";
import { vendors, vendorConversations, vendorMessages, weddingProfiles } from "@workspace/db/schema";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { openai, getModel } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../../middlewares/requireAuth";
import { trackEvent } from "../../lib/trackEvent";
import {
  buildInboundAddress,
  buildVendorFromAddress,
  cleanInboundText,
  randomToken,
  sendEmail,
} from "../../lib/resend";
import { hasMinRole, resolveCallerRole, resolveProfile, resolveScopeUserId } from "../../lib/workspaceAccess";
import { getRequestLanguage } from "../../lib/language";

const router = Router();
const PARTNER_INQUIRY_NOTE_MARKER = "[A.I DO partner inquiry only]";

async function ensurePlannerAccess(req: Request, res: Response): Promise<boolean> {
  const callerRole = await resolveCallerRole(req);
  if (!hasMinRole(callerRole, "planner")) {
    res.status(403).json({ error: "Insufficient permissions." });
    return false;
  }
  return true;
}

async function getPrimaryAccountEmail(userId: string): Promise<string | null> {
  try {
    const user = await clerkClient.users.getUser(userId);
    const primary =
      user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId) ??
      user.emailAddresses[0];
    return primary?.emailAddress?.trim().toLowerCase() ?? null;
  } catch {
    return null;
  }
}

async function getOrCreateConversation(userId: string, vendorId: number, profileId?: number) {
  const whereClause = profileId !== undefined
    ? and(eq(vendors.id, vendorId), eq(vendors.profileId, profileId))
    : eq(vendors.id, vendorId);
  const [vendor] = await db.select().from(vendors).where(whereClause).limit(1);
  if (!vendor) return null;

  const [existing] = await db.select().from(vendorConversations)
    .where(and(eq(vendorConversations.vendorId, vendorId), eq(vendorConversations.userId, userId)))
    .limit(1);
  if (existing) return { vendor, conversation: existing };

  const token = randomToken(12);
  const [created] = await db.insert(vendorConversations).values({
    vendorId,
    userId,
    inboundToken: token,
    subject: `Wedding planning — ${vendor.name}`,
  }).returning();
  return { vendor, conversation: created };
}

function cleanBodyText(value: unknown, fallback = "") {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

router.post("/messaging/partner-inquiries", requireAuth, async (req, res) => {
  try {
    if (!(await ensurePlannerAccess(req, res))) return;
    const userId = await resolveScopeUserId(req);
    const profile = await resolveProfile(req);
    if (!profile) return res.status(400).json({ error: "No wedding profile found" });

    const name = cleanBodyText(req.body?.name);
    if (!name) return res.status(400).json({ error: "Partner name is required" });

    const email = cleanBodyText(req.body?.email);
    const category = cleanBodyText(req.body?.category, "Other");
    const phone = cleanBodyText(req.body?.phone);
    const website = cleanBodyText(req.body?.website);
    const primaryContact = cleanBodyText(req.body?.primaryContact);
    const note = `${PARTNER_INQUIRY_NOTE_MARKER}\nDiscovery message from the A.I DO Partner Network. Not added to the user's Vendor List.`;

    const [existingInquiry] = await db.select().from(vendors)
      .where(and(
        eq(vendors.profileId, profile.id),
        sql`${vendors.notes} like ${`${PARTNER_INQUIRY_NOTE_MARKER}%`}`,
        email
          ? sql`lower(coalesce(${vendors.email}, '')) = ${email.toLowerCase()}`
          : sql`lower(${vendors.name}) = ${name.toLowerCase()}`,
      ))
      .limit(1);

    const vendor = existingInquiry ?? (await db.insert(vendors).values({
      profileId: profile.id,
      userId,
      name,
      category,
      email: email || null,
      phone: phone || null,
      website: website || null,
      notes: note,
      totalCost: "0",
      depositAmount: "0",
      contractSigned: false,
      primaryContact: primaryContact || null,
    }).returning())[0];

    const r = await getOrCreateConversation(userId, vendor.id, profile.id);
    if (!r) return res.status(500).json({ error: "Could not create partner inquiry" });
    res.status(existingInquiry ? 200 : 201).json({ vendorId: vendor.id, conversationId: r.conversation.id });
  } catch (err) {
    req.log.error(err, "createPartnerInquiry failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/messaging/conversations", requireAuth, async (req, res) => {
  try {
    if (!(await ensurePlannerAccess(req, res))) return;
    const userId = await resolveScopeUserId(req);
    const profile = await resolveProfile(req);
    if (!profile) return res.json([]);
    const rows = await db
      .select({
        id: vendorConversations.id,
        vendorId: vendorConversations.vendorId,
        vendorName: vendors.name,
        vendorEmail: vendors.email,
        subject: vendorConversations.subject,
        lastMessagePreview: vendorConversations.lastMessagePreview,
        lastMessageAt: vendorConversations.lastMessageAt,
        unreadCount: vendorConversations.unreadCount,
      })
      .from(vendorConversations)
      .innerJoin(vendors, eq(vendorConversations.vendorId, vendors.id))
      .where(and(
        eq(vendorConversations.userId, userId),
        eq(vendors.profileId, profile.id),
        sql`exists (
          select 1
          from ${vendorMessages}
          where ${vendorMessages.conversationId} = ${vendorConversations.id}
        )`
      ))
      .orderBy(desc(vendorConversations.lastMessageAt));
    res.json(rows.map((r) => ({ ...r, lastMessagePreview: r.lastMessagePreview ?? "", lastMessageAt: r.lastMessageAt.toISOString() })));
  } catch (err) {
    req.log.error(err, "listConversations failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/messaging/conversations/by-vendor/:vendorId", requireAuth, async (req, res) => {
  try {
    if (!(await ensurePlannerAccess(req, res))) return;
    const userId = await resolveScopeUserId(req);
    const vendorId = Number(req.params.vendorId);
    const profile = await resolveProfile(req);
    const r = await getOrCreateConversation(userId, vendorId, profile?.id);
    if (!r) return res.status(404).json({ error: "Vendor not found" });
    const { vendor, conversation } = r;
    res.json({
      id: conversation.id,
      vendorId: vendor.id,
      vendorName: vendor.name,
      vendorEmail: vendor.email,
      inboundAddress: buildInboundAddress(conversation.id, conversation.inboundToken),
      subject: conversation.subject,
      unreadCount: conversation.unreadCount,
    });
  } catch (err) {
    req.log.error(err, "getOrCreateConversationByVendor failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

async function ownConversation(userId: string, conversationId: number, profileId: number) {
  const [row] = await db.select({ conversation: vendorConversations }).from(vendorConversations)
    .innerJoin(vendors, eq(vendorConversations.vendorId, vendors.id))
    .where(and(
      eq(vendorConversations.id, conversationId),
      eq(vendorConversations.userId, userId),
      eq(vendors.profileId, profileId),
    ))
    .limit(1);
  return row?.conversation ?? null;
}

router.get("/messaging/conversations/:id/messages", requireAuth, async (req, res) => {
  try {
    if (!(await ensurePlannerAccess(req, res))) return;
    const userId = await resolveScopeUserId(req);
    const id = Number(req.params.id);
    const profile = await resolveProfile(req);
    if (!profile) return res.status(404).json({ error: "Conversation not found" });
    const conv = await ownConversation(userId, id, profile.id);
    if (!conv) return res.status(404).json({ error: "Conversation not found" });

    const rows = await db.select().from(vendorMessages)
      .where(eq(vendorMessages.conversationId, id))
      .orderBy(asc(vendorMessages.createdAt));
    res.json(rows.map((r) => ({
      id: r.id,
      conversationId: r.conversationId,
      senderType: r.senderType,
      senderName: r.senderName,
      senderEmail: r.senderEmail,
      subject: r.subject,
      body: r.body,
      attachments: r.attachments ?? [],
      deliveryStatus: r.deliveryStatus,
      errorMessage: r.errorMessage,
      createdAt: r.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err, "listMessages failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/messaging/conversations/:id/messages", requireAuth, async (req, res) => {
  try {
    if (!(await ensurePlannerAccess(req, res))) return;
    const userId = await resolveScopeUserId(req);
    const id = Number(req.params.id);
    const profile = await resolveProfile(req);
    if (!profile) return res.status(404).json({ error: "Conversation not found" });
    const conv = await ownConversation(userId, id, profile.id);
    if (!conv) return res.status(404).json({ error: "Conversation not found" });

    const { body, subject, attachments, cc: ccOverride } = (req.body ?? {}) as {
      body?: string;
      subject?: string;
      attachments?: Array<{ name: string; url: string; type: string; size?: number }>;
      cc?: string[];
    };
    if (!body || !body.trim()) return res.status(400).json({ error: "Body required" });

    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, conv.vendorId)).limit(1);
    if (!vendor) return res.status(404).json({ error: "Vendor not found" });

    const coupleNames = profile ? `${profile.partner2Name} & ${profile.partner1Name}` : "";
    const finalSubject = subject?.trim() || conv.subject || `Wedding planning — ${vendor.name}`;
    const replyTo = buildInboundAddress(conv.id, conv.inboundToken);
    // Optional: use the routing address as From so vendor replies to either
    // From or Reply-To get routed back. Only enable once the sending domain
    // is verified to deliver mail with `messages+...` local parts (some Resend
    // setups reject this even on a verified domain). Toggle via env.
    const useRoutingFrom = process.env.USE_ROUTING_FROM === "true";
    const vendorFrom = useRoutingFrom
      ? buildVendorFromAddress(conv.id, conv.inboundToken)
      : undefined;

    // Validate attachments: must be either a Replit object-storage path (/objects/...)
    // or an https URL (e.g. inbound vendor attachment hosted by Resend).
    // Reject http://, javascript:, data:, file:, mailto: etc.
    const safeAttachments = (attachments ?? [])
      .filter((a) => a && a.url && a.name)
      .filter((a) => /^\/objects\//.test(a.url) || /^https:\/\//i.test(a.url))
      .slice(0, 10);

    // Build absolute URLs for the email recipient.
    const publicBase = (process.env.PUBLIC_APP_URL ?? "https://aidowedding.net").replace(/\/$/, "");
    const toAbsolute = (url: string) => (url.startsWith("/") ? `${publicBase}/api/storage${url}` : url);

    // Insert message first (queued)
    const [inserted] = await db.insert(vendorMessages).values({
      conversationId: id,
      senderType: "couple",
      senderName: coupleNames || null,
      subject: finalSubject,
      body,
      attachments: safeAttachments,
      deliveryStatus: "queued",
    }).returning();

    let result;
    if (vendor.email) {
      const attachmentsLine = safeAttachments.length > 0
        ? `\n\nAttachments:\n${safeAttachments.map((a) => `- ${a.name}: ${toAbsolute(a.url)}`).join("\n")}`
        : "";
      const signature = coupleNames ? `\n\nThanks,\n${coupleNames}` : "";
      // Hidden routing reference — guarantees the routing address survives in
      // the body even if the vendor's email client strips quoted history. We
      // scan the body for this on inbound when the To header lacks routing.
      const routingFooter = `\n\n--\nReply-tracking ID: ${replyTo}`;
      const text = `${body}${attachmentsLine}${signature}${routingFooter}`;

      // Simple plain-style HTML — mirrors the text closely so spam filters
      // see a consistent text/html ratio. Avoids images, bright colors, and
      // marketing-style buttons that trigger Outlook's filters.
      const esc = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const bodyHtml = esc(body).replace(/\n/g, "<br>");
      const attHtml = safeAttachments.length > 0
        ? `<p style="margin:16px 0 0 0;font-size:14px;color:#444;"><b>Attachments</b><br>${safeAttachments
            .map((a) => `<a href="${toAbsolute(a.url)}">${esc(a.name)}</a>`)
            .join("<br>")}</p>`
        : "";
      const sigHtml = coupleNames
        ? `<p style="margin:16px 0 0 0;">Thanks,<br>${esc(coupleNames)}</p>`
        : "";
      const footerHtml = `<p style="margin:24px 0 0 0;font-size:11px;color:#999;">Reply-tracking ID: ${esc(replyTo)}</p>`;
      const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#222;"><div>${bodyHtml}</div>${attHtml}${sigHtml}${footerHtml}</body></html>`;

      const fromName = coupleNames || undefined;

      // CC the user's personal email(s), including the signed-in account email.
      // 1. The live CC list sent with this request (ccOverride) — used even if not yet saved to profile.
      // 2. The profile's saved vendorBccEmail (legacy field name) as fallback / supplement.
      const isValidEmail = (e: string) => { const at = e.indexOf("@"); return at > 0 && at < e.length - 1 && e.indexOf(".", at) > at + 1; };
      const accountEmail = await getPrimaryAccountEmail(req.userId!);
      const ccRaw = profile?.vendorBccEmail?.trim() ?? "";
      const savedCcList = ccRaw
        .split(/[,;\s]+/)
        .map((e) => e.trim())
        .filter((e) => isValidEmail(e))
        .map((e) => e.toLowerCase());
      const requestCcList = Array.isArray(ccOverride)
        ? ccOverride.map((e) => e.trim().toLowerCase()).filter((e) => isValidEmail(e))
        : [];
      const accountCcList = accountEmail && isValidEmail(accountEmail) ? [accountEmail] : [];
      const vendorEmail = vendor.email.trim().toLowerCase();
      const ccList = Array.from(new Set([...requestCcList, ...savedCcList, ...accountCcList]))
        .filter((email) => email !== vendorEmail);
      const cc = ccList.length > 0 ? ccList : undefined;

      result = await sendEmail({
        to: vendor.email,
        from: vendorFrom,
        replyTo,
        cc,
        subject: finalSubject,
        text,
        html,
        fromName,
      });
    } else {
      result = { ok: false, error: "Vendor has no email address" };
    }

    const [updated] = await db.update(vendorMessages)
      .set({
        deliveryStatus: result.ok ? "sent" : "failed",
        errorMessage: result.ok ? null : (result.error ?? "Unknown error"),
      })
      .where(eq(vendorMessages.id, inserted.id))
      .returning();

    await db.update(vendorConversations).set({
      lastMessageAt: new Date(),
      lastMessagePreview: body.slice(0, 140),
      subject: finalSubject,
    }).where(eq(vendorConversations.id, id));

    trackEvent(req.userId!, "vendor_message_sent", { vendorId: vendor.id, ok: result.ok });

    res.status(201).json({
      id: updated.id,
      conversationId: updated.conversationId,
      senderType: updated.senderType,
      senderName: updated.senderName,
      senderEmail: updated.senderEmail,
      subject: updated.subject,
      body: updated.body,
      attachments: updated.attachments ?? [],
      deliveryStatus: updated.deliveryStatus,
      errorMessage: updated.errorMessage,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err, "sendMessage failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/messaging/conversations/:id/suggest-reply", requireAuth, async (req, res) => {
  try {
    if (!(await ensurePlannerAccess(req, res))) return;
    const userId = await resolveScopeUserId(req);
    const id = Number(req.params.id);
    const profile = await resolveProfile(req);
    if (!profile) return res.status(404).json({ error: "Conversation not found" });
    const conv = await ownConversation(userId, id, profile.id);
    if (!conv) return res.status(404).json({ error: "Conversation not found" });

    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, conv.vendorId)).limit(1);
    const recent = await db.select().from(vendorMessages)
      .where(eq(vendorMessages.conversationId, id))
      .orderBy(desc(vendorMessages.createdAt))
      .limit(10);
    const transcript = recent.reverse().map((m) => {
      const who = m.senderType === "couple" ? "Couple" : m.senderType === "vendor" ? `Vendor (${vendor?.name ?? ""})` : "System";
      return `${who}: ${cleanInboundText(m.body)}`;
    }).join("\n\n");

    const ctx = profile
      ? `Couple: ${profile.partner2Name} & ${profile.partner1Name}\nWedding date: ${profile.weddingDate}\nVenue: ${profile.venue}, ${profile.location}\nGuest count: ${profile.guestCount}`
      : "";

    const requestLanguage = getRequestLanguage(req, profile?.preferredLanguage);
    const lang = requestLanguage !== "English" ? requestLanguage : null;
    const langInstruction = lang ? `\n\nIMPORTANT: Write the entire reply in ${lang}.` : "";

    const prompt = `You are drafting a reply on behalf of a couple to their wedding ${vendor?.category ?? "vendor"} "${vendor?.name ?? ""}".

${ctx}

Recent conversation (oldest first):
${transcript || "(no messages yet)"}

Write a friendly, professional reply the couple can send. Keep it concise (2-4 short paragraphs). Do NOT include a subject line, do NOT include greeting placeholders like [Vendor Name] — use the actual name. End with the couple's first names. Return ONLY the message body, no JSON, no markdown.${langInstruction}`;

    const completion = await openai.chat.completions.create({
      model: getModel(),
      // Was 1000. 2-4 short paragraphs ≈ 300-500 tok; 600 fits comfortably.
      max_completion_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });
    const draft = completion.choices[0]?.message?.content?.trim() ?? "";
    trackEvent(req.userId!, "vendor_message_suggest_reply", { vendorId: vendor?.id });
    res.json({ draft });
  } catch (err) {
    req.log.error(err, "suggestReply failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/messaging/conversations/:id/messages", requireAuth, async (req, res) => {
  try {
    if (!(await ensurePlannerAccess(req, res))) return;
    const userId = await resolveScopeUserId(req);
    const id = Number(req.params.id);
    const profile = await resolveProfile(req);
    if (!profile) return res.status(404).json({ error: "Conversation not found" });
    const conv = await ownConversation(userId, id, profile.id);
    if (!conv) return res.status(404).json({ error: "Conversation not found" });
    await db.delete(vendorMessages).where(eq(vendorMessages.conversationId, id));
    await db.update(vendorConversations).set({
      lastMessageAt: new Date(),
      lastMessagePreview: "",
      unreadCount: 0,
    }).where(eq(vendorConversations.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "clearConversation failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/messaging/conversations/:id/read", requireAuth, async (req, res) => {
  try {
    if (!(await ensurePlannerAccess(req, res))) return;
    const userId = await resolveScopeUserId(req);
    const id = Number(req.params.id);
    const profile = await resolveProfile(req);
    if (!profile) return res.status(404).json({ error: "Conversation not found" });
    const conv = await ownConversation(userId, id, profile.id);
    if (!conv) return res.status(404).json({ error: "Conversation not found" });
    await db.update(vendorConversations).set({ unreadCount: 0 }).where(eq(vendorConversations.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "markConversationRead failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
