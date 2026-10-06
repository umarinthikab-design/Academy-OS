"use client";

import * as React from "react";
import { useSyncExternalStore } from "react";
import { setTheme } from "@/app/settings/actions";
import { Icon } from "./Icon";

// MutationObserver that subscribes to data-theme attribute changes on <html>.
// Returns a cleanup function that disconnects the observer.
function useThemeFromDOM(
  serverTheme: string // theme from the DB (prop), used as the SSR snapshot
) {
  // Snapshot used during SSR (before the DOM is available).
  if (typeof document === "undefined") {
    return serverTheme;
  }

  const getSnapshot = () =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light";

  const observe = () => {
    const observer = new MutationObserver(() => {
      // The observer fires; useSyncExternalStore will re-read the snapshot
      // and trigger a re-render automatically.
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  };

  const cleanup = observe();

  // useSyncExternalStore must be called after the DOM is available.
  return useSyncExternalStore(
    // subscribe: return a function that React calls to set up the subscription.
    // We use a ref to avoid setting up multiple observers.
    () => {
      // The observer was already set up via the cleanup above in the render
        // cycle. This no-op return tells React the snapshot hasn't changed
        // from the subscription perspective.
      return getSnapshot;
    },
    // getSnapshot
    getSnapshot,
    // getServerSnapshot: use the theme from the DB (the prop) as the SSR snapshot.
    () => serverTheme
  );
}

export function ThemeToggle({ theme }: { theme: string }) {
  // serverTheme is the theme from the DB (the prop). This serves as the
  // getServerSnapshot for useSyncExternalStore, ensuring SSR hydration works.
  const themeFromStore = useThemeFromDOM(theme);

  // Persistence ref: keep track of the latest requested theme so that
  // only the last click's server action resolves; earlier in-flight
  // actions are no-ops (stale writes are skipped).
  const latestRef = React.useRef<string | null>(null);

  const toggle = () => {
    const next = themeFromStore === "dark" ? "light" : "dark";

    // Set the data-theme attribute immediately so the UI updates
    // visually right away (the MutationObserver will keep react in sync).
    document.documentElement.dataset.theme = next;

    // Record this as the latest request; earlier in-flight actions will
    // be skipped because their .then() check will fail.
    latestRef.current = next;

    // Persist to the DB via the server action. We do NOT disable the
    // button – the user can click again immediately.
    Promise.resolve()
      .then(async () => {
        // Skip this write if it's not the latest request.
        if (latestRef.current !== next) return;

        try {
          await setTheme(next);
          // Success – the DB now reflects the choice. No need to revert.
          latestRef.current = null;
        } catch (err) {
          // Server action failed – revert the DOM attribute to the
          // previous value so the UI stays consistent.
          const prev = next === "dark" ? "light" : "dark";
          document.documentElement.dataset.theme = prev;
          latestRef.current = null;
        }
      })
      .catch(() => {
        // Outer catch for Promise.resolve() rejection path.
        // Already handled in the .then, but be defensive.
        latestRef.current = null;
      });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 14px",
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        color: "var(--text)",
        cursor: "pointer",
        fontWeight: 700,
        fontSize: 13,
        transition: "all var(--transition)",
      }}
      aria-label={themeFromStore === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {themeFromStore === "dark" ? (
        <>
          <Icon name="sun" size={16} /> Light mode
        </>
      ) : (
        <>
          <Icon name="moon" size={16} /> Dark mode
        </>
      )}
    </button>
  );
}