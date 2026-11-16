"use client";

import { useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";

// 10 minutes of inactivity
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;

export function IdleTimer() {
  const { data: session } = useSession();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only run idle tracking when user is logged in
    if (!session?.user) return;

    const handleTimeout = () => {
      signOut({ callbackUrl: "/auth?error=SessionExpired" });
    };

    const resetTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(handleTimeout, IDLE_TIMEOUT_MS);
    };

    const activityEvents = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];

    activityEvents.forEach((event) => {
      window.addEventListener(event, resetTimer, { passive: true });
    });

    // Start timer on mount
    resetTimer();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [session]);

  return null;
}
