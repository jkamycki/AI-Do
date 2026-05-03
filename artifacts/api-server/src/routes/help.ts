import { Router } from "express";
import { db, contactMessages, feedbackSubmissions, adminUsers, supportTickets } from "@workspace/db";
import { eq, desc, or } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { randomUUID } from "crypto";

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
  const OWNER_EMAILS_LOWER = ["kamyckijoseph@gmail.com"];
  const rows = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.userId, userId))
    .limit(1);
  return rows.length > 0;
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
