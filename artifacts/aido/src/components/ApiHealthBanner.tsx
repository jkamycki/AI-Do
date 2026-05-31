import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ExternalLink } from "lucide-react";

// Public BetterStack status page — pinging api.aidowedding.net/api/healthz
// every 3 minutes. Leave as null to hide the "View status" link entirely.
const STATUS_PAGE_URL: string | null = "https://aido.betteruptime.com";

const HEALTH_CHECK_INTERVAL_MS = 30_000;
const FAILURES_BEFORE_BANNER = 2;
const FETCH_TIMEOUT_MS = 8_000;

async function pingHealth(): Promise<boolean> {
  const apiUrl =
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)
      ? ""
      : (import.meta.env.VITE_API_URL ?? "");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${apiUrl}/api/healthz`, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function ApiHealthBanner() {
  const { t } = useTranslation();
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const ok = await pingHealth();
      if (cancelled) return;
      setConsecutiveFailures((prev) => (ok ? 0 : prev + 1));
    }
    check();
    const id = setInterval(check, HEALTH_CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (consecutiveFailures < FAILURES_BEFORE_BANNER) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-[200] flex items-center justify-center gap-2 px-4 py-2 text-sm border-b shadow-sm"
      style={{
        background: "rgba(245, 158, 11, 0.95)",
        color: "#1a0f00",
        borderColor: "rgba(120, 70, 0, 0.4)",
      }}
    >
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <span className="font-medium">
        {t("outage_banner.message", {
          defaultValue: "We're having a temporary connection issue. Your data is safe — we'll be back online shortly.",
        })}
      </span>
      {STATUS_PAGE_URL && (
        <a
          href={STATUS_PAGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 underline font-semibold hover:no-underline"
        >
          {t("outage_banner.view_status", { defaultValue: "View status" })}
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}
