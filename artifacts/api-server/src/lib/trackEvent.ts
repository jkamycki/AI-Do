import { db, analyticsEvents } from "@workspace/db";
import { logger } from "./logger";

export async function trackEvent(
  userId: string,
  eventType: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  db.insert(analyticsEvents)
    .values({ userId, eventType, metadata: metadata ?? null })
    .then(() => {})
    .catch((err: unknown) => logger.error({ err, eventType }, "[trackEvent] Failed to track"));
}
