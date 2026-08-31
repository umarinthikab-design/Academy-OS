import { prisma } from "@/lib/prisma";
import { SessionConfirmations } from "./SessionConfirmations";
import { ApprovalInbox } from "./ApprovalInbox";
import { MyRequests } from "./MyRequests";
import { StaffingAlerts } from "./StaffingAlerts";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/StatusPill";
import { Icon } from "@/components/ui/Icon";
import { endTime } from "@/components/ui/SessionCard";
import { CoachDashboardClient } from "./CoachDashboardClient";
import type { DashboardScope } from "@/lib/assignments";
import type { Permissions } from "@/lib/permissions";

function sessionStart(date: Date, startTime: string): Date {
  const [h, m] = startTime.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

export async function CoachDashboard({
  scope,
  perms,
  userName,
  team,
  academyName,
}: {
  scope: DashboardScope;
  perms: Permissions;
  userName: string;
  team: string | null;
  academyName: string;
}) {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const activeTeam = scope.teams.find((t) => t.id === team) ?? null;

  if (scope.ageGroupIds.length === 0 && scope.batchIds.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <EmptyState
          icon="squad"
          title="No squad or batch assignments yet"
          message="You don't currently have any squad or batch assignments. Once an administrator assigns you to a team, your sessions, players and schedule will appear here."
        />
        <SessionConfirmations perms={perms} />
        <ApprovalInbox perms={perms} />
        <MyRequests perms={perms} />
      </div>
    );
  }

  const teamScopedAgeGroups = activeTeam && activeTeam.kind === "ageGroup" ? [activeTeam.id] : scope.ageGroupIds;
  const teamScopedBatches = activeTeam && activeTeam.kind === "batch" ? [activeTeam.id] : scope.batchIds;

  const sessionWhere = {
    status: "scheduled" as const,
    date: { gte: todayStart },
    OR: [
      { ageGroupId: { in: teamScopedAgeGroups } },
      { batchId: { in: teamScopedBatches } },
      { headCoaches: { some: { id: scope.coachId ?? "__none__" } } },
      { assistantCoaches: { some: { id: scope.coachId ?? "__none__" } } },
    ],
  };

  const playerWhere = {
    OR: [
      { batches: { some: { ageGroupId: { in: teamScopedAgeGroups } } } },
      { batches: { some: { id: { in: teamScopedBatches } } } },
    ],
  };

  const [mySessions, myPlayers, monthAttendance] = await Promise.all([
    prisma.scheduledSession.findMany({
      where: sessionWhere,
      include: {
        ageGroup: true,
        location: true,
        batch: true,
        headCoaches: { include: { user: true } },
        assistantCoaches: { include: { user: true } },
        session: { select: { name: true } },
        _count: { select: { playerAttendance: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 10,
    }),
    prisma.player.findMany({
      where: playerWhere,
      select: { id: true, name: true, position: true, photoUrl: true, batches: { select: { ageGroupId: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.playerAttendance.findMany({
      where: {
        status: { in: ["ATTENDED", "ABSENT"] },
        player: playerWhere,
        scheduledSession: { date: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } },
      },
      select: { status: true, scheduledSession: { select: { ageGroupId: true, batchId: true } } },
    }),
  ]);

  const attended = monthAttendance.filter((a) => a.status === "ATTENDED").length;
  const attendanceRate = monthAttendance.length > 0 ? Math.round((attended / monthAttendance.length) * 100) : 0;

  const todaysSessions = mySessions.filter(
    (s) => sessionStart(s.date, s.startTime) >= todayStart && s.date < new Date(todayStart.getTime() + 86400000)
  );
  const nextSession = mySessions.find((s) => sessionStart(s.date, s.startTime) > now) ?? todaysSessions[0] ?? null;
  const priority = todaysSessions[0] ?? nextSession;

  const cardStyle: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    padding: 16,
    position: "relative",
    overflow: "hidden",
  };

  const sectionHeadingStyle: React.CSSProperties = {
    fontFamily: "var(--font-headline)",
    fontSize: 20,
    fontWeight: 600,
    color: "var(--primary)",
    marginBottom: 12,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingBottom: 80 }}>
      {priority && (
        <section style={cardStyle}>
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: 4,
              height: "100%",
              background: "var(--error)",
              borderRadius: "var(--radius-lg) 0 0 var(--radius-lg)",
            }}
          />
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16, paddingLeft: 4 }}>
            <div
              style={{
                background: "var(--error-bg)",
                padding: 8,
                borderRadius: "50%",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="alert" size={20} style={{ color: "var(--error)" }} />
            </div>
            <div>
              <h3 style={{ fontFamily: "var(--font-headline)", fontSize: 20, fontWeight: 600, color: "var(--primary)", margin: 0 }}>
                Action Required
              </h3>
              <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "4px 0 0" }}>
                {todaysSessions.includes(priority)
                  ? `Confirm you're coaching today's ${priority.ageGroup.name} session (${priority.startTime}).`
                  : `Next session: ${priority.ageGroup.name} on ${priority.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} at ${priority.startTime}.`}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, paddingLeft: 4 }}>
            <a
              href="/attendance"
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "12px 16px",
                background: "var(--secondary)",
                color: "var(--on-secondary)",
                borderRadius: "var(--radius)",
                fontWeight: 600,
                fontSize: 14,
                textDecoration: "none",
                transition: "opacity var(--transition)",
              }}
            >
              <Icon name="check" size={18} />
              Confirm
            </a>
            <button
              type="button"
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "12px 16px",
                background: "var(--surface)",
                color: "var(--error)",
                border: "1px solid var(--error)",
                borderRadius: "var(--radius)",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
                transition: "background var(--transition)",
              }}
            >
              <Icon name="x" size={18} />
              Can&apos;t Attend
            </button>
          </div>
        </section>
      )}

      <section>
        <h2 style={sectionHeadingStyle}>Today&apos;s Sessions</h2>
        {todaysSessions.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {todaysSessions.map((s) => (
              <div key={s.id} style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span className="label-caps" style={{ background: "var(--surface-muted)", color: "var(--text-muted)", padding: "3px 8px", borderRadius: 4 }}>
                        {s.ageGroup.name}{s.batch ? ` ${s.batch.name}` : ""}
                      </span>
                      <StatusPill tone="approved">UPCOMING</StatusPill>
                    </div>
                    <h4 style={{ fontFamily: "var(--font-headline)", fontSize: 20, fontWeight: 600, color: "var(--primary)", margin: 0 }}>
                      {s.session?.name ?? "Training Session"}
                    </h4>
                  </div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: 8,
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: "1px solid var(--border)",
                    fontSize: 13,
                    color: "var(--text-muted)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon name="clock" size={16} style={{ flexShrink: 0 }} />
                    {s.startTime} – {endTime(s.startTime, s.durationMinutes)}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon name="pin" size={16} style={{ flexShrink: 0 }} />
                    {s.location.name}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, gridColumn: "span 2" }}>
                    <Icon name="users" size={16} style={{ flexShrink: 0 }} />
                    {s._count.playerAttendance} Players Expected
                  </div>
                </div>
                <a
                  href="/attendance"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    width: "100%",
                    padding: "12px 16px",
                    marginTop: 12,
                    background: "var(--surface-muted)",
                    color: "var(--primary)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    fontWeight: 600,
                    fontSize: 14,
                    textDecoration: "none",
                    transition: "background var(--transition)",
                  }}
                >
                  <Icon name="attendance" size={16} />
                  Mark Attendance
                </a>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ ...cardStyle, textAlign: "center", padding: 24 }}>
            <Icon name="calendar" size={24} style={{ color: "var(--text-faint)", marginBottom: 8 }} />
            <p style={{ fontSize: 13, color: "var(--text-faint)" }}>No sessions scheduled for today.</p>
          </div>
        )}
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <div
          style={{
            ...cardStyle,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: 128,
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Icon name="drills" size={22} style={{ color: "var(--secondary)" }} />
            <span
              style={{
                background: "var(--error)",
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "var(--radius-pill)",
                lineHeight: "18px",
              }}
            >
              3
            </span>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-headline)", fontSize: 20, fontWeight: 600, color: "var(--primary)" }}>
              Drill Suggestions
            </div>
          </div>
        </div>
        <div
          style={{
            ...cardStyle,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: 128,
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Icon name="user" size={22} style={{ color: "var(--primary-container)" }} />
            <span
              style={{
                background: "var(--surface-muted)",
                color: "var(--text-muted)",
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "var(--radius-pill)",
                lineHeight: "18px",
              }}
            >
              0
            </span>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-headline)", fontSize: 20, fontWeight: 600, color: "var(--primary)" }}>
              Leave Requests
            </div>
          </div>
        </div>
      </section>

      <SessionConfirmations perms={perms} />
      <ApprovalInbox perms={perms} />
      <MyRequests perms={perms} />
      {(perms.isAdmin || perms.isClubManager || (perms.canApproveRequests && !!perms.coachId)) && (
        <StaffingAlerts perms={perms} />
      )}

      {mySessions.length > 1 && (
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={sectionHeadingStyle}>Upcoming Sessions</h2>
            <a href="/schedule" style={{ fontSize: 13, fontWeight: 700, color: "var(--secondary)", textDecoration: "none" }}>
              View all
            </a>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {mySessions.slice(1, 5).map((s) => (
              <div key={s.id} style={{ ...cardStyle, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: "var(--primary)",
                      color: "#fff",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", opacity: 0.7, lineHeight: 1 }}>
                      {s.date.toLocaleDateString(undefined, { month: "short" })}
                    </span>
                    <span style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.1 }}>{s.date.getDate()}</span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {s.ageGroup.name}
                      {s.batch && <span style={{ color: "var(--text-muted)", fontWeight: 500 }}> · {s.batch.name}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {s.startTime} – {endTime(s.startTime, s.durationMinutes)} · {s.location.name}
                    </div>
                  </div>
                </div>
                {s.session && <StatusPill tone="approved">{s.session.name}</StatusPill>}
              </div>
            ))}
          </div>
        </section>
      )}

      <CoachDashboardClient />
    </div>
  );
}
