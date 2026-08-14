// PageHeader - consistent page title + subtitle + actions slot. Gives every
// page the same top structure so hierarchy stays predictable.

import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: 16,
        flexWrap: "wrap",
        marginBottom: 20,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>{title}</h1>
        {subtitle && <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div>}
    </div>
  );
}