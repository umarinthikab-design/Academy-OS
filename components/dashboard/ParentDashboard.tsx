// ParentDashboard - based entirely on the parent's linked children in the DB
// (Parent.players). If a child is transferred between squads/batches, the
// next render reflects the new relationship automatically.

import { prisma } from "@/lib/prisma";
import { DashboardHero } from "./DashboardHero";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { endTime } from "@/components/ui/SessionCard";
import type { DashboardScope } from "@/lib/assignments";

export async function ParentDashboard({ scope, userName }: { scope: DashboardScope; userName: string }) {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const children = await prisma.player.findMany({
    where: { id: { in: scope.parentPlayerIds } },
    include: {
      batches: { include: { ageGroup: true } },
      attendance: {
        select: {
          status: true,
          scheduledSession: {
            select: { date: true, startTime: true, durationMinutes: true, location: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  if (children.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <DashboardHero name={userName} subtitle={<span>Welcome to Touchline{userName ? ", parent." : "."}</span>} />
        <EmptyState
          icon="squad"
          title="No linked players yet"
          message="Once your club administrator links players to your account, their schedule, attendance and squad info will appear here."
        />
      </div>
    );
  }

  const monthAttendance = children.flatMap((c) => c.attendance).filter((a) => a.status === "ATTENDED" || a.status === "ABSENT");
  const attended = monthAttendance.filter((a) => a.status === "ATTENDED").length;
  const attendanceRate = monthAttendance.length > 0 ? Math.round((attended / monthAttendance.length) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <DashboardHero
        name={userName}
        subtitle={<span>Here's how your children are getting on at the academy.</span>}
      />

      {/* My Children */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>
            My Children <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>({children.length})</span>
          </h2>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Attendance: <strong style={{ color: "var(--secondary)" }}>{attendanceRate}%</strong>
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {children.map((child) => {
            const next = child.attendance
              .filter((a) => a.status === "NO_RESPONSE" || a.status === "ATTENDING")
              .map((a) => a.scheduledSession)
              .filter((s) => s.date >= todayStart)
              .sort((a, b) => a.date.getTime() - b.date.getTime())[0];
            return (
              <div key={child.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 18, boxShadow: "var(--shadow-sm)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, flexShrink: 0 }}>
                    {child.name.charAt(0)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{child.name}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4, marginLeft: -9 }}>
                      {child.batches.map((b) => (
                        <Badge key={b.id} tone="blue">{b.ageGroup.name} · {b.name}</Badge>
                      ))}
                      {child.batches.length === 0 && <Badge tone="muted">No squad assigned</Badge>}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                  {next ? (
                    <div style={{ fontSize: 13 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--secondary)", marginBottom: 4 }}>Next session</div>
                      <div style={{ fontWeight: 700 }}>
                        {next.date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                      </div>
                      <div style={{ color: "var(--text-muted)" }}>
                        {next.startTime}–{endTime(next.startTime, next.durationMinutes)}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--text-faint)" }}>No upcoming sessions scheduled.</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
