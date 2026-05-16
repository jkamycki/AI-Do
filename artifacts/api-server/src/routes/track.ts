import { Router } from "express";
import { db, anonymousSessions } from "@workspace/db";

const router = Router();

function cleanSessionId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^(test_anon|anon)_[A-Za-z0-9_-]{8,80}$/.test(trimmed)) return null;
  return trimmed;
}

router.post("/track", async (req, res) => {
  try {
    const sessionId = cleanSessionId(req.body?.sessionId) ?? cleanSessionId(req.headers["x-aido-session-id"]);
    const event = typeof req.body?.event === "string" ? req.body.event.trim().slice(0, 120) : "";
    const testMode = req.body?.testMode === true || req.headers["x-aido-test-mode"] === "true";
    const metadata =
      req.body?.metadata && typeof req.body.metadata === "object" && !Array.isArray(req.body.metadata)
        ? req.body.metadata
        : {};
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

    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "Track endpoint error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
