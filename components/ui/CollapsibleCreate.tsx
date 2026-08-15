"use client";

// Uniform collapsible "create" card used across the app (Add a player, Add a
// coach, Create a session plan, Schedule a session, Create a batch, etc).
// The summary icon flips between + and − so it's obvious the panel opens and
// closes, and the whole row stays clickable.

import { useState } from "react";
import { Icon } from "./Icon";

export function CollapsibleCreate({
  title,
  subtitle,
  children,
  defaultOpen = false,
  style,
  contentStyle,
  summaryIcon = "plus",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  style?: React.CSSProperties;
  contentStyle?: React.CSSProperties;
  summaryIcon?: "plus" | "filter";
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow-sm)",
        padding: 14,
        marginBottom: 24,
        ...style,
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          listStyle: "none",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 14,
          fontWeight: 800,
          userSelect: "none",
        }}
      >
        <Icon
          name={open && summaryIcon === "plus" ? "minus" : summaryIcon}
          size={16}
          style={{ color: "var(--secondary)", transition: "transform var(--transition)" }}
        />
        <span>{title}</span>
        {subtitle && <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>{subtitle}</span>}
      </summary>
      <div style={{ paddingTop: 14, ...contentStyle }}>{children}</div>
    </details>
  );
}
