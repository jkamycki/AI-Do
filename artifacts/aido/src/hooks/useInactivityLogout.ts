import { useEffect, useRef } from "react";
import { useAuth, useClerk } from "@clerk/react";

// Keep abandoned sessions short while resetting on real user activity.
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export function useInactivityLogout() {
  const { isSignedIn } = useAuth();
  const clerk = useClerk();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isSignedIn || !clerk.signOut) return;

    const resetTimeout = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      timeoutRef.current = setTimeout(() => {
        clerk.signOut();
      }, INACTIVITY_TIMEOUT);
    };

    // Include typing and pointer movement so active editing keeps the session alive.
    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click", "input"];

    events.forEach((event) => {
      document.addEventListener(event, resetTimeout);
    });

    resetTimeout();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach((event) => {
        document.removeEventListener(event, resetTimeout);
      });
    };
  }, [isSignedIn, clerk]);
}
