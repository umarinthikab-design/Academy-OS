// EmptyState - friendly replacement for blank pages/lists. Icon, title,
// optional message and action button.

import { Icon } from "./Icon";

export function EmptyState({
  icon = "info",
  title,
  message,
  action,
}: {
  icon?: string;
  title: string;
  message?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px dashed var(--border)",
        borderRadius: "var(--radius)",
        padding: "36px 24px",
        textAlign: "center",
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "var(--surface-muted)",
          color: "var(--text-faint)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} size={20} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
      {message && <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", maxWidth: 380 }}>{message}</p>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}