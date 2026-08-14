// SessionCard - football-event style card for scheduled sessions. Used on the
// Schedule and Attendance pages. All props are plain data; the page passes in
// any action forms as `footer` or via `actions`.

import { Icon } from "./Icon";

export function endTime(time: string, durationMinutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + durationMinutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function SessionCard({
  date,
  startTime,
  durationMinutes,
  ageGroupName,
  locationName,
  headCoaches,
  assistantCoaches,
  badge,
  status,
  actions,
  footer,
  onEdit,
}: {
  date: Date;
  startTime: string;
  durationMinutes: number;
  ageGroupName: string;
  locationName: string;
  headCoaches: string[];
  assistantCoaches: string[];
  badge?: React.ReactNode;
  status?: string;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  onEdit?: () => void;
}) {
  const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
  const dateStr = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "16px 18px",
        boxShadow: "var(--shadow-sm)",
        transition: "box-shadow var(--transition), transform var(--transition)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 14, minWidth: 0 }}>
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 14,
              background: "var(--primary)",
              color: "#fff",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", opacity: 0.7, lineHeight: 1 }}>{weekday.slice(0, 3)}</span>
            <span style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.15 }}>{date.getDate()}</span>
            <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.75, lineHeight: 1 }}>{dateStr}</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{ageGroupName}</span>
              {badge}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {startTime}–{endTime(startTime, durationMinutes)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
                <Icon name="pin" size={13} style={{ color: "var(--text-faint)" }} /> {locationName}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
                <Icon name="whistle" size={13} style={{ color: "var(--text-faint)" }} />
                {headCoaches.join(", ") || "—"}
                {assistantCoaches.length > 0 && ` · + ${assistantCoaches.length} asst.`}
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {status && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                padding: "4px 10px",
                borderRadius: 20,
                background: status === "cancelled" ? "var(--error-bg)" : status === "completed" ? "var(--success-bg)" : "var(--surface-muted)",
                color: status === "cancelled" ? "var(--error)" : status === "completed" ? "var(--success)" : "var(--text-muted)",
              }}
            >
              {status}
            </span>
          )}
          {actions}
        </div>
      </div>

      {footer && <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>{footer}</div>}
    </div>
  );
}