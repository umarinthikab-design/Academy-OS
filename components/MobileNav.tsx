"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { NAV_ITEMS } from "@/lib/navItems";

export function MobileNav({
  userName,
  userRole,
  photoUrl,
  logoutAction,
}: {
  userName: string;
  userRole: string;
  photoUrl: string | null;
  logoutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <div className="mobile-topbar">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          style={{ background: "none", border: "none", color: "#fff", fontSize: 24, cursor: "pointer", padding: 4 }}
        >
          ☰
        </button>
        <div style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 16 }}>Touchline</div>
        <div style={{ width: 32 }} />
      </div>

      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex" }}>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }}
          />
          <div
            style={{
              position: "relative",
              width: 250,
              maxWidth: "82vw",
              background: "var(--pitch)",
              color: "#fff",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              padding: "20px 0",
              overflowY: "auto",
            }}
          >
            <div style={{ padding: "0 20px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", opacity: 0.7 }}>
                  GRASSROOTS COACHING
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, textTransform: "uppercase" }}>Touchline</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                style={{ background: "none", border: "none", color: "#fff", fontSize: 22, cursor: "pointer", lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    style={{
                      padding: "12px 20px",
                      color: "#F1FAEE",
                      textDecoration: "none",
                      fontSize: 15,
                      fontWeight: active ? 800 : 600,
                      background: active ? "rgba(255,255,255,0.12)" : "transparent",
                      borderLeft: active ? "3px solid var(--amber)" : "3px solid transparent",
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div style={{ padding: "16px 20px 0", borderTop: "1px solid rgba(255,255,255,0.15)", marginTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrl}
                    alt={userName}
                    style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.3)" }}
                  />
                ) : (
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "var(--turf)",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 16,
                      fontWeight: 800,
                    }}
                  >
                    {userName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{userName}</div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>{userRole.replace("_", " ")}</div>
                </div>
              </div>
              <form action={logoutAction}>
                <button
                  type="submit"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    background: "rgba(255,255,255,0.1)",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.3)",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
