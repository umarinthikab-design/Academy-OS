"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { NavItem } from "@/lib/navItems";

// Desktop sidebar. Active item gets a soft highlight pill - the football
// accent stays subtle via the pitch-green palette and amber active marker.
// Items are resolved server-side (permission-aware) and passed in.

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, padding: "0 12px", overflowY: "auto" }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          opacity: 0.55,
          padding: "4px 10px 8px",
        }}
      >
        Menu
      </div>
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              padding: "9px 10px",
              color: active ? "#fff" : "#d9e6df",
              textDecoration: "none",
              fontSize: 13.5,
              fontWeight: active ? 700 : 500,
              borderRadius: 8,
              background: active ? "var(--secondary)" : "transparent",
              transition: "background var(--transition), color var(--transition)",
            }}
          >
            <Icon name={item.icon} size={18} />
            <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>
            {item.badge ? (
              <span
                style={{
                  minWidth: 18,
                  height: 18,
                  padding: "0 5px",
                  borderRadius: "var(--radius-pill)",
                  background: "var(--accent)",
                  color: "var(--primary-dark)",
                  fontSize: 11,
                  fontWeight: 800,
                  lineHeight: "18px",
                  textAlign: "center",
                  flexShrink: 0,
                }}
              >
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
