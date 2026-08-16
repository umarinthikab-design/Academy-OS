// TEMPORARY - REMOVE BEFORE REAL-USER PILOT.
//
// Floating account switcher for testing: flip between the seeded admin /
// head-coach / assistant-coach accounts to review features from each role's
// perspective without logging out. Also used on the deployed preview while
// iterating; DELETE this file + its two lines in app/layout.tsx before the
// pilot with real users.

import { login } from "@/app/login/actions";

const ACCOUNTS = [
  { label: "Admin", email: "admin@touchline.local", password: "touchline123" },
  { label: "Head Coach", email: "demo.head@demo.touchline.local", password: "touchline123" },
  { label: "Assistant", email: "demo.assist@demo.touchline.local", password: "touchline123" },
];

export function DevAccountSwitcher({ currentEmail }: { currentEmail: string }) {
  return (
    <div
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
        borderRadius: 12,
        padding: 10,
        boxShadow: "var(--shadow-md)",
        maxWidth: 150,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-faint)" }}>
        DEV · switch account
      </div>
      {ACCOUNTS.map((a) => {
        const active = currentEmail.toLowerCase() === a.email.toLowerCase();
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
                border: active ? "1px solid var(--secondary)" : "1px solid var(--border)",
                background: active ? "var(--secondary)" : "var(--surface)",
                color: active ? "#fff" : "var(--text)",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {a.label}
            </button>
          </form>
        );
      })}
    </div>
  );
}