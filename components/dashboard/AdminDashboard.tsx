// AdminDashboard - club-wide operational overview. Admins have no assignment
// scoping; they see the whole academy. Queries stay lean (counts + recent
// items), consistent with the rest of the dashboard.

import { prisma } from "@/lib/prisma";
import { DashboardHero } from "./DashboardHero";
import { QuickActions } from "./QuickActions";
import { ApprovalInbox } from "./ApprovalInbox";
import { StaffingAlerts } from "./StaffingAlerts";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { endTime } from "@/components/ui/SessionCard";
import type { Permissions } from "@/lib/permissions";

export async function AdminDashboard({ perms, userName }: { perms: Permissions; userName: string }) {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const [playerCount, coachCount, squadCount, locationCount, todaysSessions, upcomingSessions, monthAttendance, recentLogs, ageGroups] =
    await Promise.all([
      prisma.player.count(),
      prisma.coach.count(),
      prisma.ageGroup.count(),
      prisma.location.count(),
      prisma.scheduledSession.findMany({
        where: { date: { gte: todayStart, lt: new Date(todayStart.getTime() + 86400000) }, status: "scheduled" },
        include: { ageGroup: true, location: true, headCoaches: { include: { user: true } }, assistantCoaches: { include: { user: true } }, session: { select: { name: true } } },
        orderBy: [{ startTime: "asc" }],
      }),
      prisma.scheduledSession.findMany({
        where: { date: { gte: todayStart }, status: "scheduled" },
        include: { ageGroup: true, location: true, headCoaches: { include: { user: true } }, assistantCoaches: { include: { user: true } }, session: { select: { name: true } } },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        take: 6,
      }),
      prisma.playerAttendance.findMany({
        where: { status: { in: ["ATTENDED", "ABSENT"] }, scheduledSession: { date: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } } },
        select: { status: true },
      }),
      prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { user: { select: { name: true } } } }),
      prisma.ageGroup.findMany({
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { batches: true, scheduledSessions: true } } },
      }),
    ]);

  const attended = monthAttendance.filter((a) => a.status === "ATTENDED").length;
  const attendanceRate = monthAttendance.length > 0 ? Math.round((attended / monthAttendance.length) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <DashboardHero
        name={userName}
        subtitle={
          <span>
            Here's what's happening across Touchline today — {todaysSessions.length} {todaysSessions.length === 1 ? "session" : "sessions"},{" "}
            {attendanceRate}% attendance this month.
          </span>
        }
        actions={
          <a
            href="/schedule"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", background: "#fff", color: "var(--primary)", borderRadius: 9, fontWeight: 700, fontSize: 13, textDecoration: "none" }}
          >
            <Icon name="calendar" size={16} /> View Schedule
          </a>
        }
      />

      {/* Approvals */}
      <ApprovalInbox perms={perms} />

      {/* Staffing alerts - sessions where a coach hasn't confirmed / declined */}
      <StaffingAlerts perms={perms} />

      {/* Stats */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        <StatCard label="Active Players" value={playerCount} icon="squad" tint="pitch" />
        <StatCard label="Coaches" value={coachCount} icon="coaches" tint="green" />
        <StatCard label="Squads (Age Groups)" value={squadCount} icon="batches" tint="blue" />
        <StatCard label="Locations" value={locationCount} icon="locations" tint="accent" />
      </section>

      {/* Today's sessions */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>Today&apos;s Activity</h2>
          <a href="/schedule" style={{ fontSize: 13, fontWeight: 700, color: "var(--secondary)", textDecoration: "none" }}>
            View all →
          </a>
        </div>
        {todaysSessions.length === 0 ? (
          <EmptyState icon="calendar" title="No sessions today" message="The calendar is clear today. Next sessions will appear here." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {todaysSessions.map((s) => (
              <div key={s.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--primary)", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", opacity: 0.7, lineHeight: 1 }}>{s.startTime}</span>
                    <span style={{ fontSize: 10, fontWeight: 800, lineHeight: 1.1 }}>{endTime(s.startTime, s.durationMinutes)}</span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{s.ageGroup.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {s.location.name} · {s.headCoaches.map((c) => c.user.name).join(", ") || "—"}
                      {s.assistantCoaches.length > 0 && ` + ${s.assistantCoaches.length} asst.`}
                    </div>
                  </div>
                </div>
                {s.session && <Badge tone="green">{s.session.name}</Badge>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Club overview by age group */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>Club Overview</h2>
          <a href="/batches" style={{ fontSize: 13, fontWeight: 700, color: "var(--secondary)", textDecoration: "none" }}>
            Manage →
          </a>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {ageGroups.map((ag) => (
            <div key={ag.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, boxShadow: "var(--shadow-sm)" }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{ag.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                {ag._count.batches} {ag._count.batches === 1 ? "batch" : "batches"} · {ag._count.scheduledSessions} sessions
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Upcoming */}
      {upcomingSessions.length > 0 && (
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>Upcoming</h2>
            <a href="/schedule" style={{ fontSize: 13, fontWeight: 700, color: "var(--secondary)", textDecoration: "none" }}>
              View all →
            </a>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {upcomingSessions.map((s) => (
              <div key={s.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--primary)", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", opacity: 0.7, lineHeight: 1 }}>
                      {s.date.toLocaleDateString(undefined, { month: "short" })}
                    </span>
                    <span style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.1 }}>{s.date.getDate()}</span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{s.ageGroup.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {s.date.toLocaleDateString(undefined, { weekday: "long" })} · {s.startTime}–{endTime(s.startTime, s.durationMinutes)} · {s.location.name}
                    </div>
                  </div>
                </div>
                {s.session && <Badge tone="green">{s.session.name}</Badge>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Attendance overview */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>Attendance Overview</h2>
          <a href="/attendance" style={{ fontSize: 13, fontWeight: 700, color: "var(--secondary)", textDecoration: "none" }}>
            Open →
          </a>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 18, boxShadow: "var(--shadow-sm)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 120, height: 120, borderRadius: "50%", background: `conic-gradient(var(--secondary) ${attendanceRate}%, var(--surface-muted) 0)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <div style={{ width: 84, height: 84, borderRadius: "50%", background: "var(--surface)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{attendanceRate}%</span>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>this month</span>
              </div>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              <strong style={{ color: "var(--text)" }}>{attended}</strong> of {monthAttendance.length} recorded attendance entries this month.
            </div>
          </div>
        </div>
      </section>

      {/* Recent activity */}
      {recentLogs.length > 0 && (
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>Recent Activity</h2>
            <a href="/activity" style={{ fontSize: 13, fontWeight: 700, color: "var(--secondary)", textDecoration: "none" }}>
              View all →
            </a>
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
            {recentLogs.map((l, i) => (
              <div key={l.id} className="activity-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "10px 16px", fontSize: 13, borderBottom: i < recentLogs.length - 1 ? "1px solid var(--border)" : "none" }}>
                <div className="activity-row-main" style={{ minWidth: 0 }}>
                  <strong>{l.action.replace(/_/g, " ")}</strong>
                  <span style={{ color: "var(--text-muted)" }}> · {l.entityType}</span>
                </div>
                <div className="activity-row-meta" style={{ textAlign: "right", fontSize: 11, color: "var(--text-faint)" }}>
                  {l.user.name} · {l.createdAt.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <QuickActions perms={perms} hasTeams />
    </div>
  );
}
