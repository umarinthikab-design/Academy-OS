import type { CSSProperties } from "react";

// Shared status pill — one component, three tones, used identically for
// drill approval status, attendance state, player availability, and request
// status. Tones map to the officiating metaphor from DESIGN.md:
//   pending  → "yellow card"  (amber background, dark text)
//   approved → "active"       (grass-green background, white text)
//   rejected → "red card"     (red background, white text)
// Always pill-shaped with label-caps type so status metadata never looks
// like an interactive button.

const TONES: Record<"pending" | "approved" | "rejected", CSSProperties> = {
  pending: { background: "var(--warning)", color: "#3d2b00" },
  approved: { background: "var(--secondary)", color: "#ffffff" },
  rejected: { background: "var(--error)", color: "#ffffff" },
};

export function StatusPill({
  tone,
  children,
}: {
  tone: "pending" | "approved" | "rejected";
  children: ReactNodeLike;
}) {
  return (
    <span
      className="label-caps"
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: "var(--radius-pill)",
        whiteSpace: "nowrap",
        ...TONES[tone],
      }}
    >
      {children}
    </span>
  );
}

type ReactNodeLike = React.ReactNode;