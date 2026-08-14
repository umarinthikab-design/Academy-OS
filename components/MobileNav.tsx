"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { roleLabel } from "@/lib/roleLabel";
import type { NavItem } from "@/lib/navItems";

// Mobile drawer nav. Same items as the desktop sidebar (resolved server-side
// from permissions), rendered as a slide-in panel from the left.

export function MobileNav({
  userName,
  userRole,
  photoUrl,
  logoutAction,
  items,
}: {
  userName: string;
  userRole: string;
  photoUrl: string | null;
  logoutAction: () => Promise<void>;
  items: NavItem[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <div className="mobile-topbar">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", display: "flex", padding: 4 }}
        >
          <Icon name="menu" size={24} />
        </button>
        <Link href="/" style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 16, color: "#fff", textDecoration: "none", letterSpacing: "0.02em" }}>
          Touchline
        </Link>
        <div style={{ width: 24 }} />
      </div>

      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex" }}>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "absolute", inset: 0, background: "rgba(6,39,30,0.5)", animation: "fadeIn 150ms ease" }}
          />
          <div
            style={{
              position: "relative",
              width: 280,
              maxWidth: "84vw",
              background: "var(--primary-dark)",
              color: "#fff",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              padding: "16px 0",
              overflowY: "auto",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div style={{ padding: "0 20px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", opacity: 0.55, textTransform: "uppercase" }}>
                  Grassroots Coaching
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.02em" }}>Touchline</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", display: "flex", opacity: 0.8 }}
              >
                <Icon name="close" size={22} />
              </button>
            </div>

            <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, padding: "0 12px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.55, padding: "4px 10px 8px" }}>
                Menu
              </div>
              {items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 11,
                      padding: "11px 10px",
                      color: active ? "#fff" : "#d9e6df",
                      textDecoration: "none",
                      fontSize: 14,
                      fontWeight: active ? 700 : 500,
                      borderRadius: 8,
                      background: active ? "var(--secondary)" : "transparent",
                    }}
                  >
                    <Icon name={item.icon} size={18} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div style={{ padding: "14px 20px 0", borderTop: "1px solid rgba(255,255,255,0.12)", marginTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <Avatar name={userName} src={photoUrl} size={38} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>{roleLabel(userRole)}</div>
                </div>
              </div>
              <form action={logoutAction}>
                <button
                  type="submit"
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "9px 10px",
                    background: "rgba(255,255,255,0.08)",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <Icon name="logout" size={16} />
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
    </>
  );
}
