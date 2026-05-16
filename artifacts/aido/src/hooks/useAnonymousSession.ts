import { useEffect, useMemo, useState } from "react";
import { useAuth, useUser } from "@clerk/react";

const TEST_MODE_KEY = "aido_test_account_mode";
const TEST_SESSION_KEY = "aido_test_anonymous_session_id";
const REAL_SESSION_KEY = "aido_anonymous_session_id";
const DEFAULT_TEST_EMAIL = "test@aidowedding.net";

declare global {
  interface Window {
    __AIDO_TEST_MODE__?: boolean;
  }
}

function makeSessionId(prefix: "test_anon" | "anon") {
  const random = crypto.getRandomValues(new Uint8Array(8));
  const suffix = Array.from(random, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${suffix}`;
}

function getOrCreateSessionId(key: string, prefix: "test_anon" | "anon") {
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const next = makeSessionId(prefix);
  window.localStorage.setItem(key, next);
  return next;
}

export function useAnonymousSession() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);

  const testAccountEmail = useMemo(
    () => String(import.meta.env.VITE_TEST_ACCOUNT_EMAIL || DEFAULT_TEST_EMAIL).trim().toLowerCase(),
    [],
  );

  useEffect(() => {
    if (!isLoaded || typeof window === "undefined") return;

    const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase()
      ?? user?.emailAddresses?.[0]?.emailAddress?.toLowerCase()
      ?? "";
    const isTestAccount = !!isSignedIn && email === testAccountEmail;

    try {
      if (isSignedIn && email && !isTestAccount) {
        window.localStorage.removeItem(TEST_MODE_KEY);
      }

      if (isTestAccount) {
        window.localStorage.setItem(TEST_MODE_KEY, "true");
      }

      const nextTestMode = isTestAccount && window.localStorage.getItem(TEST_MODE_KEY) === "true";
      const nextSessionId = nextTestMode
        ? getOrCreateSessionId(TEST_SESSION_KEY, "test_anon")
        : getOrCreateSessionId(REAL_SESSION_KEY, "anon");

      window.__AIDO_TEST_MODE__ = nextTestMode;
      setTestMode(nextTestMode);
      setSessionId(nextSessionId);
    } catch {
      window.__AIDO_TEST_MODE__ = false;
      setTestMode(false);
      setSessionId(null);
    }
  }, [isLoaded, isSignedIn, testAccountEmail, user?.emailAddresses, user?.primaryEmailAddress?.emailAddress]);

  return { sessionId, testMode };
}
