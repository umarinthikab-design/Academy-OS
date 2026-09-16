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
//
// `compact` renders the same items as an icon-only rail (label dropped to a
// title-attribute tooltip, badge collapsed to a dot) for the tablet tier -
// see .tablet-sidebar in globals.css. Same component, same data, so the
// two tiers can never drift out of sync with each other.

export function SidebarNav({ items, compact = false }: { items: NavItem[]; compact?: boolean }) {
  const pathname = usePathname();

  return (
    <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, padding: compact ? "0 8px" : "0 12px", overflowY: "auto" }}>
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={compact ? item.label : undefined}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: compact ? "center" : "flex-start",
              gap: 12,
              padding: compact ? "12px 8px" : "10px 14px",
              position: "relative",
              color: active ? "var(--secondary-fixed)" : "var(--primary-fixed-dim)",
              textDecoration: "none",
              fontSize: 13.5,
              fontWeight: active ? 700 : 500,
              borderRadius: 8,
              borderRight: active && !compact ? "4px solid var(--secondary-fixed)" : "4px solid transparent",
              background: active ? "var(--primary-container)" : "transparent",
              transition: "background var(--transition), color var(--transition)",
            }}
          >
            <Icon name={item.icon} size={compact ? 20 : 18} />
            {!compact && <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>}
            {item.badge ? (
              compact ? (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--accent)",
                  }}
                />
              ) : (
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
              )
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}