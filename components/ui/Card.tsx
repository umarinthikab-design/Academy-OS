// Card - the standard surface for content blocks. `tone` tints the border
// (pitch = default, turf = secondary, warning, error, muted) so pages can
// differentiate sections without introducing random colours.

import type { CSSProperties } from "react";

const TONES: Record<string, CSSProperties> = {
  default: { borderColor: "var(--border)", background: "var(--surface)" },
  pitch: { borderColor: "var(--primary)", background: "var(--surface)" },
  turf: { borderColor: "var(--secondary)", background: "var(--surface)" },
  warning: { borderColor: "var(--warning)", background: "var(--warning-bg)" },
  error: { borderColor: "var(--error)", background: "var(--error-bg)" },
  muted: { borderColor: "var(--border)", background: "var(--surface-muted)" },
};

export function Card({
  children,
  tone = "default",
  pad = "md",
  style,
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONES | string;
  pad?: "none" | "sm" | "md" | "lg";
  style?: CSSProperties;
}) {
  const pads: Record<string, CSSProperties> = {
    none: { padding: 0 },
    sm: { padding: 12 },
    md: { padding: 16 },
    lg: { padding: 20 },
  };
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        background: "var(--surface)",
        boxShadow: "var(--shadow-sm)",
        ...TONES[tone],
        ...pads[pad],
        ...style,
      }}
    >
      {children}
    </div>
  );
}