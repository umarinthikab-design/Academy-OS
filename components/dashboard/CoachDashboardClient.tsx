"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

// Contextual Quick Actions (FAB) per the Stitch export: a rounded primary
// "+" button pinned bottom-right that expands into mini action buttons
// ("Suggest Drill", "Add Note"). The mini menu rotates the plus icon closed
// state and slides the actions up over the main button.

export function CoachDashboardClient() {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 40,
        display: "flex",
        flexDirection: "column-reverse",
        alignItems: "flex-end",
        gap: 12,
      }}
    >
      {/* Mini FABs (hidden by default) */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          alignItems: "flex-end",
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0)" : "translateY(16px)",
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 250ms ease, transform 250ms ease",
        }}
      >
        <Link
          href="/drills/new"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            background: "var(--surface)",
            color: "var(--primary)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-md)",
            fontSize: 13,
            fontWeight: 500,
            textDecoration: "none",
            transition: "background var(--transition)",
          }}
        >
          Suggest Drill
          <Icon name="plus" size={18} />
        </Link>
        <Link
          href="/sessions/new"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            background: "var(--surface)",
            color: "var(--primary)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-md)",
            fontSize: 13,
            fontWeight: 500,
            textDecoration: "none",
            transition: "background var(--transition)",
          }}
        >
          Add Note
          <Icon name="edit" size={18} />
        </Link>
      </div>

      {/* Main FAB */}
      <button
        aria-label="Quick Actions"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 56,
          height: 56,
          background: "var(--primary)",
          color: "#fff",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          cursor: "pointer",
          transition: "transform var(--transition), background var(--transition)",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            transition: "transform 250ms ease",
            transform: open ? "rotate(45deg)" : "rotate(0deg)",
          }}
        >
          <Icon name="plus" size={26} />
        </span>
      </button>
    </div>
  );
}
