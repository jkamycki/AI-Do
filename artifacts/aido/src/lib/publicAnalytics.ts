import { apiFetch } from "@/lib/authFetch";

type PublicAnalyticsMetadata = Record<string, unknown>;

const VISITOR_ID_KEY = "aido_vid";

export function publicVisitorId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let visitorId = window.localStorage.getItem(VISITOR_ID_KEY);
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      window.localStorage.setItem(VISITOR_ID_KEY, visitorId);
    }
    return visitorId;
  } catch {
    return null;
  }
}

function publicTrackingSessionId(): string | null {
  const visitorId = publicVisitorId();
  return visitorId ? `anon_${visitorId}` : null;
}

function isLocalhost() {
  return typeof window !== "undefined" && ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

export function trackPublicEvent(event: string, metadata: PublicAnalyticsMetadata = {}) {
  const sessionId = publicTrackingSessionId();
  if (!sessionId || !event.trim()) return;
  const path = typeof window !== "undefined" ? window.location.pathname : undefined;
  apiFetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      event,
      testMode: isLocalhost(),
      metadata: { path, ...metadata },
    }),
  }).catch(() => {});
}

export function trackPublicPageView(path: string) {
  trackPublicEvent("page_view", { path });
}

export function trackPublicMarketingEvent(event: string, metadata: PublicAnalyticsMetadata = {}) {
  if (!/^marketing_[a-z_]{2,64}$/.test(event)) return;
  trackPublicEvent(event, metadata);
}
