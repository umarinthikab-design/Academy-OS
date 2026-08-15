// SessionConfirmations - "Confirm your upcoming sessions" section on the
// coach dashboard. Self-service pre-session RSVP: the coach confirms or
// declines attendance ahead of time (no approval chain). Sessions whose
// start is within the priority window get a distinct priority badge.

import { getMyConfirmations } from "@/lib/confirmations";
import type { Permissions } from "@/lib/permissions";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { endTime } from "@/components/ui/SessionCard";
import { confirmSessionParticipation } from "./actions";

export async function SessionConfirmations({ perms }: { perms: Permissions }) {
  const items = await getMyConfirmations(perms);
  if (items.length === 0) return null;

  return (
    <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "4px 0", boxShadow: "var(--shadow-sm)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px" }}>
        <h2 style={{ fontSize: 17, fontWeight: 700 }}>Confirm your upcoming sessions</h2>
        <Badge tone="warning">{items.length} pending</Badge>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {items.map((r) => (
          <div key={r.id} style={{ padding: "12px 18px", borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: r.priority ? "var(--error-bg)" : "var(--warning-bg)",
                    color: r.priority ? "var(--error)" : "#92400e",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon name="calendar" size={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{r.session.ageGroupName}</span>
                    {r.priority && <Badge tone="error">Priority</Badge>}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                    {r.session.date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} ·{" "}
                    {r.session.startTime}–{endTime(r.session.startTime, r.session.durationMinutes)} · {r.session.locationName}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <form action={confirmSessionParticipation.bind(null, r.id, "CONFIRMED")}>
                  <button
                    type="submit"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", background: "var(--primary)", color: "#fff", borderRadius: 8, fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer" }}
                  >
                    <Icon name="check" size={14} /> Confirm
                  </button>
                </form>
                <form action={confirmSessionParticipation.bind(null, r.id, "DECLINED")}>
                  <button
                    type="submit"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", background: "var(--surface-muted)", color: "var(--text-muted)", borderRadius: 8, fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer" }}
                  >
                    Can't make it
                  </button>
                </form>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
