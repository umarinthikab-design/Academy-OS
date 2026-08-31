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
      className="page-header"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: 16,
        flexWrap: "wrap",
        marginBottom: 20,
      }}
    >
      <div className="page-header-title" style={{ minWidth: 0 }}>
        <h1 style={{ fontFamily: "var(--font-headline)", fontSize: 32, fontWeight: 600, lineHeight: 1.2, letterSpacing: "-0.01em", color: "var(--primary)" }}>{title}</h1>
        {subtitle && <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--text-muted)" }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div>}
    </div>
  );
}