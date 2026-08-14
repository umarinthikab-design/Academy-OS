// StatCard - dashboard stat tile: icon, big number, label, optional trend.
// All cards share one surface style; colour only appears via the icon tint.

import { Icon } from "./Icon";
import type { CSSProperties } from "react";

const TINTS: Record<string, string> = {
  green: "var(--secondary)",
  pitch: "var(--primary)",
  accent: "#65a30d",
  amber: "var(--warning)",
  blue: "#2563eb",
  red: "var(--error)",
  muted: "var(--text-muted)",
};

export function StatCard({
  label,
  value,
  icon,
  tint = "green",
  trend,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  icon: string;
  tint?: keyof typeof TINTS | string;
  trend?: { value: string; up?: boolean };
  sub?: string;
}) {
  const color = TINTS[tint] ?? TINTS.green;
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: 16,
        boxShadow: "var(--shadow-sm)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        transition: "box-shadow var(--transition), transform var(--transition)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: `${color}14`,
            color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={icon} size={18} />
        </div>
        {trend && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: trend.up !== false ? "var(--success)" : "var(--error)",
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            <Icon name={trend.up === false ? "trendDown" : "trendUp"} size={13} />
            {trend.value}
          </span>
        )}
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em" }}>{value}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}