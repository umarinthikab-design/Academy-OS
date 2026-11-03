"use client";

// Clickable heading for a collapsible sidebar group (secondary menu items).
export function NavGroupHeader({
  label,
  isOpen,
  hasBadge,
  padding,
  onToggle,
}: {
  label: string;
  isOpen: boolean;
  hasBadge: boolean;
  padding: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        minHeight: 40,
        background: "none",
        border: "none",
        cursor: "pointer",
        textAlign: "left",

        fontSize: 13,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        padding,
        color: "var(--sidebar-text)",
        opacity: 0.85,
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        {label}
        {!isOpen && hasBadge && <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }} />}
      </span>
      <span aria-hidden="true" style={{ display: "inline-block", transition: "transform 150ms", transform: isOpen ? "rotate(180deg)" : "none" }}>{"\u25BE"}</span>
    </button>
  );
}