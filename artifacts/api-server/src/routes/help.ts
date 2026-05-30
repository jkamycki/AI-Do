import { Router } from "express";
import { db, contactMessages, contactMessageReplies, feedbackSubmissions, supportTickets } from "@workspace/db";
import { eq, desc, asc, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { randomUUID } from "crypto";
import { clerkClient } from "@clerk/express";
import { sendEmail, FROM_EMAIL } from "../lib/resend";
import { getSupportInboxAddresses, buildSupportThreadAddress, ensureContactThreadToken } from "../lib/supportInbox";
import { OWNER_EMAILS, isOwnerEmail } from "../lib/adminOwners";
import { publicFormLimiter } from "../middlewares/rateLimiter";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const router = Router();

function cleanTextField(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

const FEEDBACK_CATEGORY_LABELS: Record<string, string> = {
  bug: "Bug Report",
  feature: "Feature Request",
  general: "General Feedback",
  praise: "Something I Love",
};

async function getUserContactIdentity(userId: string | null | undefined) {
  if (!userId) {
    return { name: "A.IDO User", email: "unknown-user@aidowedding.net" };
  }

  try {
    const user = await clerkClient.users.getUser(userId);
    const primaryEmail = user.emailAddresses.find(email => email.id === user.primaryEmailAddressId)?.emailAddress
      ?? user.emailAddresses[0]?.emailAddress
      ?? "unknown-user@aidowedding.net";
    const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim()
      || user.username
      || primaryEmail.split("@")[0]
      || "A.IDO User";

    return {
      name: displayName,
      email: primaryEmail.toLowerCase(),
    };
  } catch {
    return { name: "A.IDO User", email: "unknown-user@aidowedding.net" };
  }
}

function isMissingSupportTicketStorageError(err: unknown): boolean {
  const pgError = err as { code?: string; message?: string };
  return pgError.code === "42P01" || pgError.code === "42703" || /support_tickets/i.test(pgError.message ?? "");
}

router.post("/help/contact", requireAuth, async (req, res) => {
  try {
    const { name, email, subject, message } = req.body as {
      name: string;
      email: string;
      subject: string;
      message: string;
    };

    if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
      return res.status(400).json({ error: "All fields are required." });
    }

    const [saved] = await db
      .insert(contactMessages)
      .values({
        userId: req.userId ?? null,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        subject: subject.trim(),
        message: message.trim(),
      })
      .returning();

    res.json({ success: true, id: saved.id });
  } catch (err) {
    req.log.error(err, "Failed to save contact message");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/help/feedback", requireAuth, async (req, res) => {
  try {
    const { rating, category, message } = req.body as {
      rating?: number;
      category?: string;
      message: string;
    };

    if (!message?.trim()) {
      return res.status(400).json({ error: "Message is required." });
    }

    const [saved] = await db
      .insert(feedbackSubmissions)
      .values({
        userId: req.userId ?? null,
        rating: rating ?? null,
        category: category ?? null,
        message: message.trim(),
      })
      .returning();

    const userIdentity = await getUserContactIdentity(req.userId);
    const categoryLabel = category?.trim()
      ? FEEDBACK_CATEGORY_LABELS[category.trim()] ?? category.trim()
      : "Uncategorized";
    const ratingLabel = typeof rating === "number" && Number.isFinite(rating) && rating > 0
      ? `${rating}/5 stars`
      : "No rating provided";

    const [messageRecord] = await db
      .insert(contactMessages)
      .values({
        userId: req.userId ?? null,
        name: userIdentity.name,
        email: userIdentity.email,
        subject: `User Feedback: ${categoryLabel}`,
        message: [
          message.trim(),
          "",
          "---",
          `Category: ${categoryLabel}`,
          `Rating: ${ratingLabel}`,
          `Feedback ID: ${saved.id}`,
        ].join("\n"),
        isRead: false,
        isResolved: false,
      })
      .returning();

    res.json({ success: true, id: saved.id, messageId: messageRecord.id });
  } catch (err) {
    req.log.error(err, "Failed to save feedback");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/help/suggestion", publicFormLimiter, async (req, res) => {
  try {
    const { name, email, message, source } = req.body as {
      name?: string;
      email?: string;
      message?: string;
      source?: string;
    };
    const cleanName = cleanTextField(name, 120);
    const cleanEmail = cleanTextField(email, 254).toLowerCase();
    const cleanMessage = cleanTextField(message, 4000);
    const cleanSource = cleanTextField(source, 120) || "Updates & Improvements suggestion";

    if (!cleanName || !cleanEmail || !cleanMessage) {
      return res.status(400).json({ error: "Name, email, and suggestion are required." });
    }
    if (!EMAIL_RE.test(cleanEmail)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    const [saved] = await db
      .insert(contactMessages)
      .values({
        userId: null,
        name: cleanName,
        email: cleanEmail,
        subject: cleanSource,
        message: cleanMessage,
        isRead: false,
        isResolved: false,
      })
      .returning();

    res.json({ success: true, id: saved.id });
  } catch (err) {
    req.log.error(err, "Failed to save public suggestion");
    res.status(500).json({ error: "Internal server error" });
  }
});

async function isAdmin(userId: string): Promise<boolean> {
  try {
    const user = await clerkClient.users.getUser(userId);
    return user.emailAddresses.some(e => isOwnerEmail(e.emailAddress));
  } catch {
    return false;
  }
}

router.get("/help/messages", requireAuth, async (req, res) => {
  try {
    const admin = await isAdmin(req.userId!);
    if (!admin) return res.status(403).json({ error: "Access denied." });

    const contacts = await db
      .select()
      .from(contactMessages)
      .orderBy(desc(contactMessages.createdAt))
      .limit(200);

    const feedback = await db
      .select()
      .from(feedbackSubmissions)
      .orderBy(desc(feedbackSubmissions.createdAt))
      .limit(200);

    const contactIds = contacts.map(c => c.id);
    const repliesRows = contactIds.length > 0
      ? await db
          .select()
          .from(contactMessageReplies)
          .where(inArray(contactMessageReplies.contactMessageId, contactIds))
          .orderBy(asc(contactMessageReplies.createdAt))
      : [];
    const repliesByMessage = new Map<number, typeof repliesRows>();
    for (const r of repliesRows) {
      const list = repliesByMessage.get(r.contactMessageId) ?? [];
      list.push(r);
      repliesByMessage.set(r.contactMessageId, list);
    }

    const unreadContacts = contacts.filter(c => !c.isRead).length;
    const unreadFeedback = feedback.filter(f => !f.isRead).length;

    res.json({
      contacts: contacts.map(c => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
        replies: (repliesByMessage.get(c.id) ?? []).map(r => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
        })),
      })),
      feedback: feedback.map(f => ({ ...f, createdAt: f.createdAt.toISOString() })),
      unreadCount: unreadContacts + unreadFeedback,
    });
  } catch (err) {
    req.log.error(err, "Failed to fetch messages");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/help/messages/contact/:id/read", requireAuth, async (req, res) => {
  try {
    const admin = await isAdmin(req.userId!);
    if (!admin) return res.status(403).json({ error: "Access denied." });

    await db
      .update(contactMessages)
      .set({ isRead: true })
      .where(eq(contactMessages.id, parseInt(String(req.params["id"] ?? "0"), 10)));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/help/messages/feedback/:id/read", requireAuth, async (req, res) => {
  try {
    const admin = await isAdmin(req.userId!);
    if (!admin) return res.status(403).json({ error: "Access denied." });

    await db
      .update(feedbackSubmissions)
      .set({ isRead: true })
      .where(eq(feedbackSubmissions.id, parseInt(String(req.params["id"] ?? "0"), 10)));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/help/messages/contact/:id/resolve", requireAuth, async (req, res) => {
  try {
    const admin = await isAdmin(req.userId!);
    if (!admin) return res.status(403).json({ error: "Access denied." });

    const { resolved } = req.body as { resolved?: boolean };
    await db
      .update(contactMessages)
      .set({ isResolved: resolved !== false, isRead: true })
      .where(eq(contactMessages.id, parseInt(String(req.params["id"] ?? "0"), 10)));

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/help/messages/contact/:id/reply", requireAuth, async (req, res) => {
  try {
    const admin = await isAdmin(req.userId!);
    if (!admin) return res.status(403).json({ error: "Access denied." });

    const { replyText } = req.body as { replyText?: string };
    if (!replyText?.trim()) {
      return res.status(400).json({ error: "Reply text is required." });
    }

    const id = parseInt(String(req.params["id"] ?? "0"), 10);
    const [msg] = await db
      .select()
      .from(contactMessages)
      .where(eq(contactMessages.id, id))
      .limit(1);
    if (!msg) return res.status(404).json({ error: "Message not found." });

    const supportAddress = getSupportInboxAddresses()[0] ?? OWNER_EMAILS[0];
    const threadToken = await ensureContactThreadToken(id);
    const replyToAddress = threadToken ? buildSupportThreadAddress(id, threadToken) : supportAddress;
    const subject = msg.subject.toLowerCase().startsWith("re:") ? msg.subject : `Re: ${msg.subject}`;
    const result = await sendEmail({
      to: msg.email,
      replyTo: replyToAddress,
      subject,
      text: [
        replyText.trim(),
        ``,
        `— A.IDO Support`,
      ].join("\n"),
    });

    if (!result.ok) {
      req.log.error({ error: result.error }, "Failed to send contact-message reply");
      return res.status(502).json({ error: "Email delivery failed." });
    }

    await db.insert(contactMessageReplies).values({
      contactMessageId: id,
      direction: "outbound",
      body: replyText.trim(),
      senderUserId: req.userId ?? null,
      senderEmail: supportAddress,
      senderName: "A.IDO Support",
    });

    await db
      .update(contactMessages)
      .set({ isRead: true })
      .where(eq(contactMessages.id, id));

    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "Failed to reply to contact message");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/help/messages/feedback/:id/resolve", requireAuth, async (req, res) => {
  try {
    const admin = await isAdmin(req.userId!);
    if (!admin) return res.status(403).json({ error: "Access denied." });

    const { resolved } = req.body as { resolved?: boolean };
    await db
      .update(feedbackSubmissions)
      .set({ isResolved: resolved !== false, isRead: true })
      .where(eq(feedbackSubmissions.id, parseInt(String(req.params["id"] ?? "0"), 10)));

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/help/support-ticket", publicFormLimiter, async (req, res) => {
  try {
    const { name, email, category, subject, message } = req.body as {
      name: string;
      email: string;
      category: string;
      subject: string;
      message: string;
    };
    const cleanName = cleanTextField(name, 120);
    const cleanEmail = cleanTextField(email, 254).toLowerCase();
    const cleanCategory = cleanTextField(category, 80);
    const cleanSubject = cleanTextField(subject, 160);
    const cleanMessage = cleanTextField(message, 8000);

    if (!cleanName || !cleanEmail || !cleanCategory || !cleanSubject || !cleanMessage) {
      return res.status(400).json({ error: "All fields are required." });
    }
    if (!EMAIL_RE.test(cleanEmail)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    const ticketNumber = `TKT-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const userId = req.userId || null;

    const [ticket] = await db
      .insert(supportTickets)
      .values({
        ticketNumber,
        name: cleanName,
        email: cleanEmail,
        category: cleanCategory,
        subject: cleanSubject,
        message: cleanMessage,
        status: "open",
        priority: "medium",
        userId,
      })
      .returning();

    // Notify the ops team
    sendEmail({
      to: OWNER_EMAILS[0],
      from: FROM_EMAIL,
      replyTo: cleanEmail,
      subject: `[${ticketNumber}] New Support Ticket: ${cleanSubject.slice(0, 80)}`,
      text: [
        `New support ticket submitted via A.IDO`,
        ``,
        `Ticket: ${ticketNumber}`,
        `From:   ${cleanName} <${cleanEmail}>`,
        `Category: ${cleanCategory}`,
        `Subject: ${cleanSubject}`,
        ``,
        `--- Conversation ---`,
        cleanMessage,
      ].join("\n"),
    }).catch(() => {});

    // Confirm receipt to the user
    sendEmail({
      to: cleanEmail,
      replyTo: OWNER_EMAILS[0],
      subject: `We received your support request [${ticketNumber}]`,
      text: [
        `Hi ${cleanName},`,
        ``,
        `Thanks for reaching out to A.IDO support. We've received your message and will get back to you as soon as possible.`,
        ``,
        `Your ticket number is: ${ticketNumber}`,
        ``,
        `--- Your conversation ---`,
        cleanMessage,
        ``,
        `— The A.IDO Team`,
      ].join("\n"),
    }).catch(() => {});

    res.json({
      success: true,
      ticketNumber: ticket.ticketNumber,
      message: "Your support ticket has been created. We'll get back to you shortly!",
    });
  } catch (err) {
    req.log.error(err, "Failed to create support ticket");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/help/support-tickets", requireAuth, async (req, res) => {
  try {
    const admin = await isAdmin(req.userId!);
    if (!admin) return res.status(403).json({ error: "Access denied." });

    const tickets = await db
      .select({
        id: supportTickets.id,
        ticketNumber: supportTickets.ticketNumber,
        name: supportTickets.name,
        email: supportTickets.email,
        category: supportTickets.category,
        subject: supportTickets.subject,
        message: supportTickets.message,
        status: supportTickets.status,
        priority: supportTickets.priority,
        userId: supportTickets.userId,
        profileId: supportTickets.profileId,
        createdAt: supportTickets.createdAt,
        updatedAt: supportTickets.updatedAt,
      })
      .from(supportTickets)
      .orderBy(desc(supportTickets.createdAt));

    res.json({
      tickets: tickets.map(t => ({
        ...t,
        followUpNotes: null,
        followUpEmail: null,
        followUpSentAt: null,
        followUpSentBy: null,
        createdAt: t.createdAt?.toISOString?.() ?? new Date().toISOString(),
        updatedAt: t.updatedAt?.toISOString?.() ?? t.createdAt?.toISOString?.() ?? new Date().toISOString(),
      })),
    });
  } catch (err) {
    req.log.error(err, "Failed to fetch support tickets");
    if (isMissingSupportTicketStorageError(err)) {
      return res.json({ tickets: [] });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/help/support-tickets/:id/follow-up", requireAuth, async (req, res) => {
  try {
    const admin = await isAdmin(req.userId!);
    if (!admin) return res.status(403).json({ error: "Access denied." });

    const { followUpEmail, followUpNotes } = req.body as {
      followUpEmail: string;
      followUpNotes: string;
    };

    if (!followUpEmail?.trim() || !followUpNotes?.trim()) {
      return res.status(400).json({ error: "Follow-up email and notes are required." });
    }

    const ticketId = parseInt(String(req.params["id"] ?? "0"), 10);

    // Fetch the ticket so we have the original subject for the email
    const [existing] = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, ticketId))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Ticket not found." });

    // Actually send the email before saving so we can report failure
    const emailResult = await sendEmail({
      to: followUpEmail.trim(),
      replyTo: OWNER_EMAILS[0],
      subject: `Re: ${existing.subject} [${existing.ticketNumber}]`,
      text: [
        followUpNotes.trim(),
        ``,
        `— A.IDO Support Team`,
        `Ticket: ${existing.ticketNumber}`,
      ].join("\n"),
    });

    if (!emailResult.ok) {
      req.log.error({ error: emailResult.error }, "Failed to send follow-up email");
      return res.status(502).json({ error: "Email delivery failed." });
    }

    const [updated] = await db
      .update(supportTickets)
      .set({
        followUpEmail: followUpEmail.trim(),
        followUpNotes: followUpNotes.trim(),
        followUpSentAt: new Date(),
        followUpSentBy: req.userId,
        status: "in_progress",
        updatedAt: new Date(),
      })
      .where(eq(supportTickets.id, ticketId))
      .returning();

    res.json({
      success: true,
      ticket: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        followUpSentAt: updated.followUpSentAt?.toISOString(),
      },
    });
  } catch (err) {
    req.log.error(err, "Failed to send follow-up");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/help/support-tickets/:id/status", requireAuth, async (req, res) => {
  try {
    const admin = await isAdmin(req.userId!);
    if (!admin) return res.status(403).json({ error: "Access denied." });

    const { status, priority } = req.body as { status?: string; priority?: string };
    const ticketId = parseInt(String(req.params["id"] ?? "0"), 10);

    const [updated] = await db
      .update(supportTickets)
      .set({
        ...(status && { status }),
        ...(priority && { priority }),
        updatedAt: new Date(),
      })
      .where(eq(supportTickets.id, ticketId))
      .returning();

    res.json({
      success: true,
      ticket: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        followUpSentAt: updated.followUpSentAt?.toISOString(),
      },
    });
  } catch (err) {
    req.log.error(err, "Failed to update ticket status");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/help/messages/contact/:id", requireAuth, async (req, res) => {
  try {
    const admin = await isAdmin(req.userId!);
    if (!admin) return res.status(403).json({ error: "Access denied." });
    const id = parseInt(String(req.params["id"] ?? "0"), 10);
    await db.delete(contactMessages).where(eq(contactMessages.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "Failed to delete contact message");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/help/messages/feedback/:id", requireAuth, async (req, res) => {
  try {
    const admin = await isAdmin(req.userId!);
    if (!admin) return res.status(403).json({ error: "Access denied." });
    const id = parseInt(String(req.params["id"] ?? "0"), 10);
    await db.delete(feedbackSubmissions).where(eq(feedbackSubmissions.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "Failed to delete feedback submission");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/help/support-tickets/:id", requireAuth, async (req, res) => {
  try {
    const admin = await isAdmin(req.userId!);
    if (!admin) return res.status(403).json({ error: "Access denied." });

    const ticketId = parseInt(String(req.params["id"] ?? "0"), 10);
    await db.delete(supportTickets).where(eq(supportTickets.id, ticketId));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "Failed to delete ticket");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
