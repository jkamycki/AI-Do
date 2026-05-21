import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, anonymousSessions, analyticsEvents } from "@workspace/db";
import { pruneAnalyticsEvents, sanitizeAnalyticsMetadata } from "../lib/trackEvent";
import crypto from "crypto";

const router = Router();

function cleanSessionId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^(test_anon|anon)_[A-Za-z0-9_-]{8,80}$/.test(trimmed)) return null;
  return trimmed;
}

function sessionRef(sessionId: string): string {
  return crypto.createHash("sha256").update(sessionId).digest("hex").slice(0, 16);
}

router.post("/track", async (req, res) => {
  try {
    const sessionId = cleanSessionId(req.body?.sessionId) ?? cleanSessionId(req.headers["x-aido-session-id"]);
    const event = typeof req.body?.event === "string" ? req.body.event.trim().slice(0, 120) : "";
    const testMode = req.body?.testMode === true || req.headers["x-aido-test-mode"] === "true";
    const metadata = sanitizeAnalyticsMetadata(req.body?.metadata) ?? {};
    const timestamp = req.body?.timestamp ? new Date(String(req.body.timestamp)) : new Date();
    const safeTimestamp = Number.isNaN(timestamp.getTime()) ? new Date() : timestamp;

    if (!sessionId || !event) {
      return res.status(400).json({ error: "sessionId and event are required." });
    }

    await db.insert(anonymousSessions).values({
      sessionId,
      testMode,
      event,
      metadata,
      timestamp: safeTimestamp,
      createdAt: safeTimestamp,
      lastActiveAt: safeTimestamp,
    });

    const auth = getAuth(req);
    const safeSessionRef = sessionRef(sessionId);
    const userId =
      (typeof req.userId === "string" && req.userId) ||
      (typeof auth?.userId === "string" && auth.userId) ||
      `anonymous:${safeSessionRef}`;

    await db.insert(analyticsEvents).values({
      userId,
      eventType: event,
      timestamp: safeTimestamp,
      metadata: {
        ...metadata,
        sessionRef: safeSessionRef,
        testMode,
        clientTimestamp: safeTimestamp.toISOString(),
        source: "portal_tracker",
      },
    });
    await pruneAnalyticsEvents(userId);

    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "Track endpoint error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
