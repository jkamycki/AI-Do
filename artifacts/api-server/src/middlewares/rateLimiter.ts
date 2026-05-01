import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";
import { getAuth } from "@clerk/express";

// ─── IP-based general limiter ─────────────────────────────────────────────────
// Broad protection against bots/scrapers hitting the API.
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { error: "Too many requests. Please try again in a few minutes." },
  skip: (req) => req.path.startsWith("/api/analytics"),
});

// ─── AI endpoint limiter ──────────────────────────────────────────────────────
// Stricter limit on AI chat routes to control OpenAI spend.
// Keyed per authenticated user so legitimate users each get the full allowance.
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 40,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
  keyGenerator: (req: Request) => {
    try {
      const { userId } = getAuth(req);
      if (userId) return userId;
    } catch {}
    return req.ip ?? req.socket?.remoteAddress ?? "unknown";
  },
  message: { error: "You've reached the hourly AI request limit. Please wait a while before continuing." },
  handler: (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.write(`data: ${JSON.stringify({ error: "You've reached the hourly AI limit. Please wait a few minutes and try again." })}\n\n`);
    res.end();
  },
});

// ─── Auth brute-force limiter ─────────────────────────────────────────────────
// Prevents credential-stuffing attacks on sign-in routes.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
});

// ─── Per-user daily AI message cap ───────────────────────────────────────────
// Separate from the hourly limiter — caps total daily spend per user.
// Resets at midnight UTC. Stored in-memory (resets on server restart, which
// is acceptable for a beta where restarts are occasional).

const DAILY_SUPPORT_LIMIT = 120;
const DAILY_ARIA_LIMIT = 60;

interface DailyBucket {
  date: string;
  count: number;
}

const supportBuckets = new Map<string, DailyBucket>();
const ariaBuckets = new Map<string, DailyBucket>();

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function checkDailyLimit(
  buckets: Map<string, DailyBucket>,
  userId: string,
  limit: number,
): { allowed: boolean; remaining: number } {
  const today = todayUTC();
  const bucket = buckets.get(userId);
  if (!bucket || bucket.date !== today) {
    buckets.set(userId, { date: today, count: 0 });
    return { allowed: true, remaining: limit };
  }
  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: limit - bucket.count };
}

export function incrementDailySupport(userId: string): { allowed: boolean; remaining: number } {
  const result = checkDailyLimit(supportBuckets, userId, DAILY_SUPPORT_LIMIT);
  if (result.allowed) {
    const today = todayUTC();
    const bucket = supportBuckets.get(userId)!;
    supportBuckets.set(userId, { date: today, count: bucket.count + 1 });
  }
  return result;
}

export function incrementDailyAria(userId: string): { allowed: boolean; remaining: number } {
  const result = checkDailyLimit(ariaBuckets, userId, DAILY_ARIA_LIMIT);
  if (result.allowed) {
    const today = todayUTC();
    const bucket = ariaBuckets.get(userId)!;
    ariaBuckets.set(userId, { date: today, count: bucket.count + 1 });
  }
  return result;
}
