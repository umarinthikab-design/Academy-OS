// CoachDashboard - everything is scoped to the logged-in coach's CURRENT
// database assignments (primary focus age groups + main batches, derived in
// lib/assignments.ts). Reassign the coach in the DB and this dashboard
// changes on the next render — no hardcoded teams anywhere.

import { prisma } from "@/lib/prisma";
import { DashboardHero } from "./DashboardHero";
import { TeamSelector } from "./TeamSelector";
import { QuickActions } from "./QuickActions";
import { ApprovalInbox } from "./ApprovalInbox";
import { MyRequests } from "./MyRequests";
import { SessionConfirmations } from "./SessionConfirmations";
import { StaffingAlerts } from "./StaffingAlerts";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { endTime } from "@/components/ui/SessionCard";
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
}: {
  scope: DashboardScope;
  perms: Permissions;
  userName: string;
  team: string | null;
}) {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const activeTeam = scope.teams.find((t) => t.id === team) ?? null;

  // ── Empty assignment state ───────────────────────────────────
  if (scope.ageGroupIds.length === 0 && scope.batchIds.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <DashboardHero
          name={userName}
          subtitle={<span>Welcome to Touchline{userName ? ", coach." : "."}</span>}
        />
        <EmptyState
          icon="squad"
          title="No squad or batch assignments yet"
          message="You don't currently have any squad or batch assignments. Once an administrator assigns you to a team, your sessions, players and schedule will appear here. Contact your club administrator if this is unexpected."
        />
        <SessionConfirmations perms={perms} />
        <ApprovalInbox perms={perms} />
        <MyRequests perms={perms} />
        {(perms.isAdmin || perms.isClubManager || (perms.canApproveRequests && !!perms.coachId)) && (
          <StaffingAlerts perms={perms} />
        )}
      </div>
    );
  }

  // ── Scoped where clauses ─────────────────────────────────────
  // Sessions relevant to this coach: belongs to one of their assigned age
  // groups/batches, OR they're explicitly assigned as head/assistant.
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

  // Players this coach is responsible for: members of any batch under their
  // assigned age groups, or members of their main batches.
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

  // Today's sessions for the "what do I need to do right now" card.
  const todaysSessions = mySessions.filter((s) => sessionStart(s.date, s.startTime) >= todayStart && s.date < new Date(todayStart.getTime() + 86400000));
  const nextSession = mySessions.find((s) => sessionStart(s.date, s.startTime) > now) ?? todaysSessions[0] ?? null;
  const priority = todaysSessions[0] ?? nextSession;

  // Per-team attendance (for My Squads cards).
  const teamStats = scope.teams.map((t) => {
    const rows = monthAttendance.filter((a) =>
      t.kind === "ageGroup" ? a.scheduledSession.ageGroupId === t.id : a.scheduledSession.batchId === t.id
    );
    const att = rows.filter((a) => a.status === "ATTENDED").length;
    return {
      team: t,
      attended: att,
      total: rows.length,
      rate: rows.length > 0 ? Math.round((att / rows.length) * 100) : null,
      players: myPlayers.filter((p) => t.kind === "ageGroup" ? p.batches.some((b) => b.ageGroupId === t.id) : true).length,
    };
  });

  const heroActions = (
    <a
      href="/schedule"
      style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", background: "#fff", color: "var(--primary)", borderRadius: 9, fontWeight: 700, fontSize: 13, textDecoration: "none" }}
    >
      <Icon name="calendar" size={16} /> View Schedule
    </a>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <DashboardHero
        name={userName}
        subtitle={
          <span>
            {priority
              ? `${priority.ageGroup.name} training ${priority.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} at ${priority.startTime}.`
              : "No upcoming sessions for your teams right now."}
          </span>
        }
        actions={heroActions}
      />

      {/* My Teams selector */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
            My Teams <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>({scope.teams.length})</span>
          </h2>
          <TeamSelector teams={scope.teams} current={team} />
        </div>
        {teamStats.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--text-faint)" }}>No assigned teams yet.</p>
        )}
      </section>

      {/* Pre-session RSVP - confirm/decline your upcoming sessions */}
      <SessionConfirmations perms={perms} />

      {/* Approvals */}
      <ApprovalInbox perms={perms} />

      {/* My requests */}
      <MyRequests perms={perms} />

      {/* Staffing alerts - sessions where a coach hasn't confirmed / declined */}
      {(perms.isAdmin || perms.isClubManager || (perms.canApproveRequests && !!perms.coachId)) && (
        <StaffingAlerts perms={perms} />
      )}

      {/* Priority card - today's / next session */}
      {priority && (
        <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)", padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--secondary)", marginBottom: 10 }}>
            {todaysSessions.includes(priority) ? "Today" : "Next session"}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 20, fontWeight: 800 }}>{priority.ageGroup.name}</span>
                {priority.batch && <Badge tone="blue">{priority.batch.name}</Badge>}
                {priority.session && <Badge tone="green">{priority.session.name}</Badge>}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>
                {priority.date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} ·{" "}
                {priority.startTime}–{endTime(priority.startTime, priority.durationMinutes)} · {priority.location.name}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                <Icon name="whistle" size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                {[...priority.headCoaches, ...priority.assistantCoaches].map((c) => c.user.name).join(", ") || "—"}
              </div>
              <div style={{ fontSize: 13, marginTop: 8 }}>
                <Icon name="squad" size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                <strong>{priority._count.playerAttendance}</strong> <span style={{ color: "var(--text-muted)" }}>players expected</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
              <a href="/attendance" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", background: "var(--primary)", color: "#fff", borderRadius: 9, fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
                <Icon name="attendance" size={15} /> Take Attendance
              </a>
              <a href="/schedule" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", background: "var(--surface)", color: "var(--secondary)", border: "1px solid var(--secondary)", borderRadius: 9, fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
                View Session
              </a>
            </div>
          </div>
        </section>
      )}

      {/* Stats */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        <StatCard label="My Players" value={myPlayers.length} icon="squad" tint="pitch" sub={team ? `filtered: ${activeTeam?.name}` : "across all my teams"} />
        <StatCard label="Attendance This Month" value={`${attendanceRate}%`} icon="attendance" tint="green" sub={`${attended} of ${monthAttendance.length}`} />
        <StatCard label="Upcoming Sessions" value={mySessions.length} icon="sessions" tint="accent" sub="for my teams" />
        <StatCard label="Teams Assigned" value={scope.teams.length} icon="batches" tint="blue" />
      </section>

      {/* My Squads */}
      {teamStats.length > 0 && (
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>My Squads</h2>
            <a href="/squad" style={{ fontSize: 13, fontWeight: 700, color: "var(--secondary)", textDecoration: "none" }}>
              View squad →
            </a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            {teamStats.map(({ team: t, players, rate, attended, total }) => (
              <div key={t.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, boxShadow: "var(--shadow-sm)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 800 }}>{t.name}</span>
                  {t.ageGroupName && <Badge tone="blue">{t.ageGroupName}</Badge>}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                  {players} {players === 1 ? "player" : "players"}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--surface-muted)", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 3, background: "var(--secondary)", width: `${rate ?? 0}%` }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>
                    {rate === null ? "—" : `${rate}%`}
                  </span>
                </div>
                {rate !== null && (
                  <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>{attended} of {total} attended this month</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming */}
      {mySessions.length > 0 && (
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>Upcoming for your teams</h2>
            <a href="/schedule" style={{ fontSize: 13, fontWeight: 700, color: "var(--secondary)", textDecoration: "none" }}>
              View all →
            </a>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {mySessions.slice(0, 5).map((s) => (
              <div key={s.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--primary)", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
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
                      {s.date.toLocaleDateString(undefined, { weekday: "long" })} · {s.startTime}–{endTime(s.startTime, s.durationMinutes)} · {s.location.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {s.headCoaches.map((c) => c.user.name).join(", ")}
                      {s.assistantCoaches.length > 0 && ` + ${s.assistantCoaches.length} assistant`}
                    </div>
                  </div>
                </div>
                {s.session && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--secondary)", background: "var(--success-bg)", padding: "4px 10px", borderRadius: 20 }}>
                    {s.session.name}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick actions */}
      <QuickActions perms={perms} hasTeams={scope.teams.length > 0} />
    </div>
  );
}
