import { db, analyticsEvents } from "@workspace/db";
import { logger } from "./logger";
import { sql } from "drizzle-orm";

const SENSITIVE_METADATA_KEY = /(password|token|secret|authorization|cookie|session|ticket|key)/i;
const MAX_METADATA_BYTES = 12_000;
const MAX_STRING_LENGTH = 1_000;

function sanitizeMetadataValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value.slice(0, MAX_STRING_LENGTH);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (depth >= 4) return "[Truncated]";

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeMetadataValue(item, depth + 1));
  }

  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_METADATA_KEY.test(key)) {
        output[key] = "[Redacted]";
        continue;
      }
      output[key] = sanitizeMetadataValue(nestedValue, depth + 1);
    }
    return output;
  }

  return String(value).slice(0, MAX_STRING_LENGTH);
}

export function sanitizeAnalyticsMetadata(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const sanitized = sanitizeMetadataValue(value) as Record<string, unknown>;
  try {
    const serialized = JSON.stringify(sanitized);
    if (serialized.length <= MAX_METADATA_BYTES) return sanitized;
    return {
      truncated: true,
      originalSize: serialized.length,
    };
  } catch {
    return null;
  }
}

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
    .values({ userId, eventType, metadata: sanitizeAnalyticsMetadata(metadata) })
    .then(() => pruneAnalyticsEvents(userId))
    .catch((err: unknown) => logger.error({ err, eventType }, "[trackEvent] Failed to track"));
}
