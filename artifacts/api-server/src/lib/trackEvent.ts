import { db, analyticsEvents } from "@workspace/db";
import { logger } from "./logger";
import { sql } from "drizzle-orm";

export async function pruneAnalyticsEvents(userId: string, keep = 20): Promise<void> {
  await db.execute(sql`
    DELETE FROM analytics_events
    WHERE user_id = ${userId}
      AND id NOT IN (
        SELECT id
        FROM analytics_events
        WHERE user_id = ${userId}
        ORDER BY timestamp DESC, id DESC
        LIMIT ${keep}
      )
  `);
}

export async function trackEvent(
  userId: string,
  eventType: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  db.insert(analyticsEvents)
    .values({ userId, eventType, metadata: metadata ?? null })
    .then(() => pruneAnalyticsEvents(userId))
    .catch((err: unknown) => logger.error({ err, eventType }, "[trackEvent] Failed to track"));
}
