"use client";

// TEMPORARY - REMOVE BEFORE REAL-USER PILOT.
//
// Account switcher for testing: flip between the seeded admin / head-coach /
// assistant-coach accounts to review features from each role's perspective
// without logging out. Also used on the deployed preview while iterating;
// DELETE this file + its two lines in app/layout.tsx before the pilot with
// real users.
//
// Collapsed to a small pill by default so it never floats over scrollable
// content; tap it to expand the three account buttons, tap anywhere outside
// (or the pill again) to collapse.

import { useEffect, useRef, useState } from "react";
import { login } from "@/app/login/actions";

const ACCOUNTS = [
  { label: "Admin", email: "admin@touchline.local", password: "touchline123" },
  { label: "Club Mgr", email: "cm@touchline.local", password: "touchline123" },
  { label: "Head Coach", email: "demo.head@demo.touchline.local", password: "touchline123" },
  { label: "Assistant", email: "demo.assist@demo.touchline.local", password: "touchline123" },
];

export function DevAccountSwitcher({ currentEmail }: { currentEmail: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const active = ACCOUNTS.find((a) => a.email.toLowerCase() === currentEmail.toLowerCase());

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        right: 14,
        bottom: 14,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: open ? 12 : "var(--radius-pill)",
        padding: open ? 10 : 0,
        boxShadow: "var(--shadow-md)",
      }}
    >
      {open ? (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "2px 4px 4px" }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-faint)" }}>
              DEV · switch account
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close account switcher"
              style={{
                border: "none",
                background: "transparent",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: 14,
                lineHeight: 1,
                padding: 2,
              }}
            >
              ×
            </button>
          </div>
          {ACCOUNTS.map((a) => {
            const isActive = a.email.toLowerCase() === currentEmail.toLowerCase();
            return (
              <form key={a.email} action={login}>
                <input type="hidden" name="email" value={a.email} />
                <input type="hidden" name="password" value={a.password} />
                <button
                  type="submit"
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 10px",
                    border: isActive ? "1px solid var(--secondary)" : "1px solid var(--border)",
                    background: isActive ? "var(--secondary)" : "var(--surface)",
                    color: isActive ? "#fff" : "var(--text)",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  {a.label}
                </button>
              </form>
            );
          })}
        </>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title={active ? `Switch account (${active.label})` : "Switch account"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text)",
            borderRadius: "var(--radius-pill)",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 700,
            boxShadow: "var(--shadow-sm)",
          }}
        >
          DEV · {active ? active.label : "switch"}
        </button>
      )}
    </div>
  );
}