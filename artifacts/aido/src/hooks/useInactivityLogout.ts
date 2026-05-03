import { useEffect, useRef } from "react";
import { useAuth, useClerk } from "@clerk/react";

const INACTIVITY_TIMEOUT = 2 * 60 * 1000; // 2 minutes in milliseconds

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

    const events = ["mousedown", "keydown", "scroll", "touchstart", "click"];

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
