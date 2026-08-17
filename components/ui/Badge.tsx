// Badge - small status/label pill. `tone` maps to a soft background + strong
// text pair that stays readable. Used for statuses, categories, and tags.

import type { CSSProperties } from "react";

const TONES: Record<string, { bg: string; fg: string; border?: string }> = {
  primary: { bg: "var(--success-bg)", fg: "var(--primary)" },
  green: { bg: "var(--success-bg)", fg: "var(--secondary)" },
  accent: { bg: "#f4fae3", fg: "#4d7c0f", border: "1px solid #d9f99d" },
  warning: { bg: "var(--warning-bg)", fg: "#92400e", border: "1px solid #fde68a" },
  error: { bg: "var(--error-bg)", fg: "#b91c1c" },
  muted: { bg: "var(--surface-muted)", fg: "var(--text-muted)" },
  blue: { bg: "var(--info-bg)", fg: "#1d4ed8" },
};

export function Badge({
  children,
  tone = "muted",
  style,
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONES | string;
  style?: CSSProperties;
}) {
  const t = TONES[tone] ?? TONES.muted;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1,
        padding: "4px 9px",
        borderRadius: "var(--radius-pill)",
        whiteSpace: "nowrap",
        flexShrink: 0,
        ...t,
        ...style,
      }}
    >
      {children}
    </span>
  );
}