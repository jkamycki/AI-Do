import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, anonymousSessions, analyticsEvents } from "@workspace/db";

const router = Router();

function cleanSessionId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^(test_anon|anon)_[A-Za-z0-9_-]{8,80}$/.test(trimmed)) return null;
  return trimmed;
}

function cleanMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > 12000) {
      return {
        truncated: true,
        originalSize: serialized.length,
      };
    }
    return JSON.parse(serialized) as Record<string, unknown>;
  } catch {
    return {};
  }
}

router.post("/track", async (req, res) => {
  try {
    const sessionId = cleanSessionId(req.body?.sessionId) ?? cleanSessionId(req.headers["x-aido-session-id"]);
    const event = typeof req.body?.event === "string" ? req.body.event.trim().slice(0, 120) : "";
    const testMode = req.body?.testMode === true || req.headers["x-aido-test-mode"] === "true";
    const metadata = cleanMetadata(req.body?.metadata);
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
    const userId =
      (typeof req.userId === "string" && req.userId) ||
      (typeof auth?.userId === "string" && auth.userId) ||
      `anonymous:${sessionId}`;

    await db.insert(analyticsEvents).values({
      userId,
      eventType: event,
      timestamp: safeTimestamp,
      metadata: {
        ...metadata,
        sessionId,
        testMode,
        clientTimestamp: safeTimestamp.toISOString(),
        source: "portal_tracker",
      },
    });

    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "Track endpoint error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
