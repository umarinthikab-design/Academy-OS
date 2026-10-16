// SessionConfirmations - "Confirm your upcoming sessions" section on the
// coach dashboard. Self-service pre-session RSVP: the coach confirms or
// declines attendance ahead of time (no approval chain). Each row shows the
// response deadline; past it the row is marked Overdue (still answerable).

import { Button } from "@/components/ui/Button";
import { getMyConfirmations } from "@/lib/confirmations";
import { getAcademyTimeZone } from "@/lib/academyTime";
import type { Permissions } from "@/lib/permissions";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { endTime } from "@/components/ui/SessionCard";
import { confirmSessionParticipation } from "./actions";

export async function SessionConfirmations({ perms }: { perms: Permissions }) {
  const items = await getMyConfirmations(perms);
  if (items.length === 0) return null;
  const tz = await getAcademyTimeZone();
  const fmtDeadline = (d: Date) =>
    d.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: tz });

  return (
    <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "4px 0", boxShadow: "var(--shadow-sm)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px" }}>
        <h2 style={{ fontSize: 17, fontWeight: 700 }}>Confirm your upcoming sessions</h2>
        <Badge tone="warning">{items.length} pending</Badge>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {items.map((r) => {
          const urgent = r.priority || r.overdue;
          return (
            <div key={r.id} style={{ padding: "12px 18px", borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: urgent ? "var(--error-bg)" : "var(--warning-bg)",
                      color: urgent ? "var(--error)" : "#92400e",
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
                      {r.overdue ? <Badge tone="error">Overdue</Badge> : r.priority && <Badge tone="error">Priority</Badge>}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                      {r.session.date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })} {"\u00b7"}{" "}
                      {r.session.startTime}{"\u2013"}{endTime(r.session.startTime, r.session.durationMinutes)} {"\u00b7"} {r.session.locationName}
                    </div>
                    <div style={{ fontSize: 12, color: r.overdue ? "var(--error)" : "var(--text-faint)", marginTop: 2 }}>
                      {r.overdue ? `Response was due ${fmtDeadline(r.deadlineAt)} - please answer now` : `Respond by ${fmtDeadline(r.deadlineAt)}`}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <form action={confirmSessionParticipation.bind(null, r.id, "CONFIRMED")}>
                    <Button size="sm"><Icon name="check" size={14} /> Confirm</Button>
                  </form>
                  <form action={confirmSessionParticipation.bind(null, r.id, "DECLINED")}>
                    <Button variant="outline" size="sm" style={{ color: "var(--text-muted)" }}>Can't make it</Button>
                  </form>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}