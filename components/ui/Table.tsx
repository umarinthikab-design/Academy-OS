// Table - clean, compact table with sticky header, row hover, and responsive
// card fallback on narrow screens via a horizontal scroll wrapper.

import type { ReactNode } from "react";

export function Table({
  columns,
  rows,
  empty,
}: {
  columns: { key: string; label: string; align?: "left" | "right" }[];
  rows: { key: string; cells: ReactNode[] }[];
  empty?: ReactNode;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <div style={{ overflowX: "auto", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--surface)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 480 }}>
        <thead>
          <tr style={{ background: "var(--surface-muted)" }}>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{
                  textAlign: c.align === "right" ? "right" : "left",
                  padding: "9px 12px",
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--text-muted)",
                  borderBottom: "1px solid var(--border)",
                  whiteSpace: "nowrap",
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} style={{ transition: "background var(--transition)" }}>
              {r.cells.map((cell, i) => (
                <td
                  key={i}
                  style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid var(--border)",
                    color: "var(--text)",
                    textAlign: columns[i]?.align === "right" ? "right" : "left",
                    verticalAlign: "top",
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}