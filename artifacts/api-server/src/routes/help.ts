import { Router } from "express";
import { db, contactMessages, feedbackSubmissions, supportTickets } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { randomUUID } from "crypto";
import { clerkClient } from "@clerk/express";
import { sendEmail, FROM_EMAIL } from "../lib/resend";

const OWNER_EMAILS = ["kamyckijoseph@gmail.com"];

const router = Router();

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

    res.json({ success: true, id: saved.id });
  } catch (err) {
    req.log.error(err, "Failed to save feedback");
    res.status(500).json({ error: "Internal server error" });
  }
});

async function isAdmin(userId: string): Promise<boolean> {
  try {
    const user = await clerkClient.users.getUser(userId);
    const userEmails = user.emailAddresses.map(e => e.emailAddress.toLowerCase());
    return OWNER_EMAILS.some(e => userEmails.includes(e));
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

    const unreadContacts = contacts.filter(c => !c.isRead).length;
    const unreadFeedback = feedback.filter(f => !f.isRead).length;

    res.json({
      contacts: contacts.map(c => ({ ...c, createdAt: c.createdAt.toISOString() })),
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

router.post("/help/support-ticket", async (req, res) => {
  try {
    const { name, email, category, subject, message } = req.body as {
      name: string;
      email: string;
      category: string;
      subject: string;
      message: string;
    };

    if (!name?.trim() || !email?.trim() || !category?.trim() || !subject?.trim() || !message?.trim()) {
      return res.status(400).json({ error: "All fields are required." });
    }

    const ticketNumber = `TKT-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const userId = req.userId || null;

    const [ticket] = await db
      .insert(supportTickets)
      .values({
        ticketNumber,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        category: category.trim(),
        subject: subject.trim(),
        message: message.trim(),
        status: "open",
        priority: "medium",
        userId,
      })
      .returning();

    // Notify the ops team
    sendEmail({
      to: OWNER_EMAILS[0],
      from: FROM_EMAIL,
      replyTo: email.trim().toLowerCase(),
      subject: `[${ticketNumber}] New Support Ticket: ${subject.trim().slice(0, 80)}`,
      text: [
        `New support ticket submitted via A.IDO`,
        ``,
        `Ticket: ${ticketNumber}`,
        `From:   ${name.trim()} <${email.trim()}>`,
        `Category: ${category.trim()}`,
        `Subject: ${subject.trim()}`,
        ``,
        `--- Conversation ---`,
        message.trim(),
      ].join("\n"),
    }).catch(() => {});

    // Confirm receipt to the user
    sendEmail({
      to: email.trim().toLowerCase(),
      replyTo: OWNER_EMAILS[0],
      subject: `We received your support request [${ticketNumber}]`,
      text: [
        `Hi ${name.trim()},`,
        ``,
        `Thanks for reaching out to A.IDO support. We've received your message and will get back to you as soon as possible.`,
        ``,
        `Your ticket number is: ${ticketNumber}`,
        ``,
        `--- Your conversation ---`,
        message.trim(),
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
      .select()
      .from(supportTickets)
      .orderBy(desc(supportTickets.createdAt));

    res.json({
      tickets: tickets.map(t => ({ ...t, createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString() })),
    });
  } catch (err) {
    req.log.error(err, "Failed to fetch support tickets");
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
      return res.status(502).json({ error: `Email delivery failed: ${emailResult.error}` });
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

export default router;
