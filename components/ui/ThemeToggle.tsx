"use client";

// Toggle between light and dark theme. Persists to the user's account via a
// server action and immediately applies the data-theme attribute so the whole
// app switches without a reload.

import { useTransition } from "react";
import { setTheme } from "@/app/settings/actions";
import { Icon } from "./Icon";

export function ThemeToggle({ theme }: { theme: string }) {
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    startTransition(async () => {
      await setTheme(next);
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
      {theme === "dark" ? (
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