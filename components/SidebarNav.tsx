"use client";

import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/schedule", label: "Schedule" },
  { href: "/squad", label: "Squad" },
  { href: "/drills", label: "Drill Library" },
  { href: "/coaches", label: "Coach Roster" },
  { href: "/batches", label: "Batches" },
  { href: "/locations", label: "Locations" },
  { href: "/age-groups", label: "Age Groups" },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <a
            key={item.href}
            href={item.href}
            style={{
              padding: "10px 20px",
              color: "#F1FAEE",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: active ? 800 : 600,
              background: active ? "rgba(255,255,255,0.12)" : "transparent",
              borderLeft: active ? "3px solid var(--amber)" : "3px solid transparent",
            }}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
