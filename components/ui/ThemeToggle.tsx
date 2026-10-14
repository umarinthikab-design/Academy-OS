"use client";

import { useRef, useSyncExternalStore } from "react";
import { setTheme } from "@/app/settings/actions";
import { Icon } from "./Icon";

type Theme = "light" | "dark";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function getSnapshot(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function ThemeToggle({ theme }: { theme: string }) {
  const serverTheme: Theme = theme === "dark" ? "dark" : "light";
  const current = useSyncExternalStore(subscribe, getSnapshot, () => serverTheme);
  const writeId = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  function toggle() {
    const prev = getSnapshot();
    const next: Theme = prev === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    const id = ++writeId.current;
    queue.current = queue.current
      .then(() => setTheme(next))
      .catch(() => {
        if (writeId.current === id) document.documentElement.dataset.theme = prev;
      });
  }

  return (
    <button className="ui-btn"
      type="button"
      onClick={toggle}
      aria-label={current === "dark" ? "Switch to light mode" : "Switch to dark mode"}
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
    >
      {current === "dark" ? (
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