"use client";

// Toggle between light and dark theme. Persists to the user's account via a
// server action and immediately applies the data-theme attribute so the whole
// app switches without a reload.
// Derives the current theme from the DOM data-theme attribute so the button
// label updates immediately after toggling, without requiring a page refresh.

import { useState, useEffect, useTransition } from "react";
import { setTheme } from "@/app/settings/actions";
import { Icon } from "./Icon";

export function ThemeToggle({ theme }: { theme: string }) {
  // Derive current theme from DOM data-theme attribute so the button label
  // updates immediately after toggling, without requiring a page refresh.
  const [domTheme, setDomTheme] = useState(() =>
    document.documentElement.dataset.theme ?? theme
  );

  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = domTheme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setDomTheme(next); // update local state immediately so UI re-renders
    startTransition(async () => {
      await setTheme(next); // persist to DB
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
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
      aria-label="Toggle dark mode"
    >
      {domTheme === "dark" ? (
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