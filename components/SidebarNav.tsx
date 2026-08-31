"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { NavItem } from "@/lib/navItems";

// Desktop sidebar nav, styled per the Stitch exports: deep pitch background
// (owned by the aside in layout.tsx), inactive items in primary-fixed-dim,
// active item marked by a 4px secondary-fixed right bar on a
// primary-container surface. Items are resolved server-side
// (permission-aware) and passed in — never hardcoded per screen.

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, padding: "0 12px", overflowY: "auto" }}>
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              color: active ? "var(--secondary-fixed)" : "var(--primary-fixed-dim)",
              textDecoration: "none",
              fontSize: 13.5,
              fontWeight: active ? 700 : 500,
              borderRadius: 8,
              borderRight: active ? "4px solid var(--secondary-fixed)" : "4px solid transparent",
              background: active ? "var(--primary-container)" : "transparent",
              transition: "background var(--transition), color var(--transition)",
            }}
          >
            <Icon name={item.icon} size={18} />
            <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>
            {item.badge ? (
              <span
                className="label-caps"
                style={{
                  minWidth: 18,
                  height: 18,
                  padding: "0 5px",
                  borderRadius: "var(--radius-pill)",
                  background: "var(--accent)",
                  color: "var(--primary-dark)",
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