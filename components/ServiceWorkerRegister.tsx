"use client";

// Registers the minimal pass-through service worker. Runs only on the client
// (obviously) and only when the browser supports service workers. Kept tiny -
// the worker itself does no real caching; this just satisfies installability
// requirements so the "Add to Home Screen" / install prompt is available.

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failure is non-fatal - the app works fine without it,
        // the install prompt just won't appear.
      });
    }
  }, []);
  return null;
}
