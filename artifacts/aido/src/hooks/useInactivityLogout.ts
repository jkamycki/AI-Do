import { useEffect, useRef } from "react";
import { useAuth, useClerk } from "@clerk/react";

// Bumped from 5 → 30 minutes so users actively editing a long-form page
// (wedding website, vendor email composer, mood board) don't get logged
// out while pausing to think. Kept on a hard upper bound so a truly
// abandoned session still ends.
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

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

    // Added "mousemove" and "input" so passive mouse hover or typing in a
    // contenteditable (the website editor) resets the timer. Previously
    // a user pausing to think while editing inline text would silently
    // tip into the inactivity window.
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
