// SectionHeader - labelled block separator with an optional trailing slot
// (count badge, action button).

import type { ReactNode } from "react";

export function SectionHeader({
  title,
  count,
  actions,
  style,
}: {
  title: string;
  count?: number;
  actions?: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        marginBottom: 12,
        ...style,
      }}
    >
      <h2 style={{ fontSize: 16, fontWeight: 700 }}>
        {title}
        {typeof count === "number" && (
          <span style={{ color: "var(--text-faint)", fontWeight: 600, marginLeft: 6 }}>{count}</span>
        )}
      </h2>
      {actions}
    </div>
  );
}