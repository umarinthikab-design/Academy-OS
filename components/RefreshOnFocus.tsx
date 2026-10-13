"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useRef } from "react";

let lastRefresh = 0;

export function RefreshOnFocus() {
  const pathname = usePathname();
  const now = Date.now();

  useEffect(() => {
    const handleFocus = () => {
      if (now - lastRefresh > 30_000) {
        lastRefresh = now;
        void window.dispatchEvent(new Event("focus-refresh"));
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (now - lastRefresh > 30_000) {
          lastRefresh = now;
          void window.dispatchEvent(new Event("focus-refresh"));
        }
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pathname]);

  useEffect(() => {
    const handleFocusEvent = (e: Event) => {
      void window.dispatchEvent(new Event("focus-refresh"));
    };

    const handleVisibilityEvent = () => {
      if (document.visibilityState === "visible") {
        void window.dispatchEvent(new Event("focus-refresh"));
      }
    };

    window.addEventListener("focus", handleFocusEvent);
    document.addEventListener("visibilitychange", handleVisibilityEvent);

    return () => {
      window.removeEventListener("focus", handleFocusEvent);
      document.removeEventListener("visibilitychange", handleVisibilityEvent);
    };
  }, []);

  return null;
}