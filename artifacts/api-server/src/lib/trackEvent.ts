import { db, analyticsEvents } from "@workspace/db";

export async function trackEvent(
  userId: string,
  eventType: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  db.insert(analyticsEvents)
    .values({ userId, eventType, metadata: metadata ?? null })
    .then(() => {})
    .catch((err: unknown) => console.error("[trackEvent] Failed to track:", eventType, err));
}
