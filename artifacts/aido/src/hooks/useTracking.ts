import { useCallback } from "react";
import { authFetch } from "@/lib/authFetch";
import { useAnonymousSession } from "@/hooks/useAnonymousSession";

type TrackingMetadata = Record<string, unknown>;

export function useTracking() {
  const { sessionId, testMode } = useAnonymousSession();

  const track = useCallback(
    async (event: string, metadata: TrackingMetadata = {}) => {
      if (!sessionId || !event.trim()) return;

      const payload = {
        sessionId,
        testMode,
        event: event.trim(),
        metadata,
        timestamp: new Date().toISOString(),
      };

      try {
        await authFetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch {
        // Tracking must never block the app.
      }
    },
    [sessionId, testMode],
  );

  return { sessionId, testMode, track };
}
