// StaffingAlerts - the "someone needs to know" surface for admins and head
// coaches. Surfaces upcoming sessions in the confirmation window where at
// least one assigned coach has DECLINED, is still PENDING, or has missed the
// response deadline ("No response, deadline passed").

import { getStaffingAlerts } from "@/lib/confirmations";
import { getAcademyTimeZone } from "@/lib/academyTime";
import type { Permissions } from "@/lib/permissions";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { endTime } from "@/components/ui/SessionCard";

export async function StaffingAlerts({ perms }: { perms: Permissions }) {
  const alerts = await getStaffingAlerts(perms);
  if (alerts.length === 0) return null;
  const tz = await getAcademyTimeZone();
  const fmtDeadline = (d: Date) =>
    d.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: tz });

  return (
    <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "4px 0", boxShadow: "var(--shadow-sm)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px" }}>
        <h2 style={{ fontSize: 17, fontWeight: 700 }}>Needs attention</h2>
        <Badge tone="error">{alerts.length}</Badge>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {alerts.map((a) => {
          const red = a.declined.length > 0 || a.overdue.length > 0;
          return (
            <div key={a.scheduledSessionId} style={{ padding: "12px 18px", borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: red ? "var(--error-bg)" : "var(--warning-bg)",
                    color: red ? "var(--error)" : "#92400e",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon name="alert" size={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{a.session.ageGroupName}</span>
                    {a.declined.length > 0 && <Badge tone="error">Declined</Badge>}
                    {a.overdue.length > 0 && <Badge tone="error">No response, deadline passed</Badge>}
                    {a.pending.length > 0 && a.overdue.length === 0 && <Badge tone="warning">Awaiting reply</Badge>}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                    {a.session.date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })} {"\u00b7"}{" "}
                    {a.session.startTime}{"\u2013"}{endTime(a.session.startTime, a.session.durationMinutes)} {"\u00b7"} {a.session.locationName}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-faint)", marginTop: 2 }}>
                    {a.declined.length > 0 && <span>Declined: {a.declined.join(", ")}</span>}
                    {a.declined.length > 0 && a.pending.length > 0 && <span> {"\u00b7"} </span>}
                    {a.pending.length > 0 && (
                      <span>
                        {a.overdue.length > 0 ? `No response (due ${fmtDeadline(a.deadlineAt)}): ` : "Awaiting: "}
                        {a.pending.join(", ")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}