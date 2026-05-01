import { Router } from "express";
import { db, contactMessages, feedbackSubmissions, adminUsers } from "@workspace/db";
import { eq, desc, or } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

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

export default router;
