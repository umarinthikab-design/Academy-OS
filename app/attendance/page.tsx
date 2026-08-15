import { prisma } from "@/lib/prisma";
import { getPermissions } from "@/lib/permissions";
import { StatusBanner } from "@/components/StatusBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { AvailabilityBadge } from "@/components/ui/AvailabilityBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import {
  submitAttendance,
  approveAttendanceRequest,
  rejectAttendanceRequest,
  finalizeAttendance,
  checkInCoach,
  overrideCoachAttendance,
} from "./actions";

function endTime(time: string, durationMinutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + durationMinutes;
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
}

function sessionStart(date: Date, startTime: string): Date {
  const [h, m] = startTime.split(":").map(Number);
  const start = new Date(date);
  start.setHours(h, m, 0, 0);
  return start;
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; range?: string }>;
}) {
  const params = await searchParams;
  const perms = await getPermissions();

  const range = params.range === "term" ? "term" : "month";
  const now = new Date();
  const rangeStart =
    range === "term"
      ? new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      : new Date(now.getFullYear(), now.getMonth(), 1);

  const [sessions, pendingRequests, allBatches] = await Promise.all([
    prisma.scheduledSession.findMany({
      where: { date: { lte: now }, status: { not: "cancelled" }, resolvedAt: null },
      include: {
        ageGroup: true,
        location: true,
        headCoaches: { include: { user: true } },
        assistantCoaches: { include: { user: true } },
        playerAttendance: true,
        coachAttendance: true,
        batch: true,
      },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
    }),
    prisma.approvalRequest.findMany({
      where: { type: "ATTENDANCE_CONFIRM", status: "PENDING" },
      include: { requestedBy: { include: { user: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.batch.findMany({ include: { players: { orderBy: { name: "asc" } } } }),
  ]);

  const requestsBySession = new Map<string, (typeof pendingRequests)[number]>();
  for (const r of pendingRequests) {
    const payload = r.payload as { scheduledSessionId?: string };
    if (payload.scheduledSessionId) {
      requestsBySession.set(payload.scheduledSessionId, r);
    }
  }

  function playersForSession(s: (typeof sessions)[number]) {
    if (s.batchId) {
      const batch = allBatches.find((b) => b.id === s.batchId);
      return batch ? batch.players : [];
    }
    return allBatches.filter((b) => b.ageGroupId === s.ageGroupId).flatMap((b) => b.players);
  }

  const isAdmin = perms.isAdmin;
  const coachId = perms.coachId;
  const isAssigned = (s: (typeof sessions)[number]) =>
    !!coachId && (s.headCoaches.some((c) => c.id === coachId) || s.assistantCoaches.some((c) => c.id === coachId));
  const isHeadOfSession = (s: (typeof sessions)[number]) => !!coachId && s.headCoaches.some((c) => c.id === coachId);
  const canMark = (s: (typeof sessions)[number]) => isAdmin || isAssigned(s);
  const canFinalize = (s: (typeof sessions)[number]) => isAdmin || (perms.canApproveRequests && isHeadOfSession(s));
  const canApprove = (s: (typeof sessions)[number], r: (typeof pendingRequests)[number]) => {
    if (r.requestedById === coachId) return false; // never approve your own proposal
    if (isAdmin) return true;
    if (r.requestedBy.designation === "HEAD") return false; // a head's proposal is admin-only
    return perms.canApproveRequests && isHeadOfSession(s);
  };

  // ── Rollup data ──────────────────────────────────────────────────
  const attendanceRows = await prisma.playerAttendance.findMany({
    where: {
      status: { in: ["ATTENDED", "ABSENT"] },
      scheduledSession: { date: { gte: rangeStart } },
    },
    include: { player: true, scheduledSession: { include: { batch: true, ageGroup: true } } },
    orderBy: { player: { name: "asc" } },
  });

  const playerMisses = new Map<string, { name: string; attended: number; absent: number }>();
  const batchStats = new Map<string, { name: string; attended: number; absent: number }>();
  for (const row of attendanceRows) {
    const miss = playerMisses.get(row.playerId) ?? { name: row.player.name, attended: 0, absent: 0 };
    if (row.status === "ATTENDED") miss.attended++;
    else miss.absent++;
    playerMisses.set(row.playerId, miss);

    if (row.scheduledSession.batch) {
      const stat = batchStats.get(row.scheduledSession.batchId!) ?? {
        name: row.scheduledSession.batch.name,
        attended: 0,
        absent: 0,
      };
      if (row.status === "ATTENDED") stat.attended++;
      else stat.absent++;
      batchStats.set(row.scheduledSession.batchId!, stat);
    }
  }
  const playerMissList = [...playerMisses.values()].sort((a, b) => b.absent - a.absent);
  const batchStatList = [...batchStats.values()].sort((a, b) => b.name.localeCompare(a.name));

  const btnPrimary: React.CSSProperties = { padding: "7px 14px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" };
  const btnOutline: React.CSSProperties = { padding: "6px 12px", borderRadius: 8, border: "1px solid var(--secondary)", background: "var(--surface)", color: "var(--secondary)", cursor: "pointer", fontWeight: 700, fontSize: 12 };
  const btnDanger: React.CSSProperties = { padding: "6px 12px", borderRadius: 8, border: "1px solid var(--error)", background: "var(--surface)", color: "var(--error)", cursor: "pointer", fontWeight: 700, fontSize: 12 };

  return (
    <>
      <PageHeader title="Attendance" subtitle="Mark who showed up, review finalization, and track rates." />

      <StatusBanner error={params.error} success={params.success} />

      {perms.role === "PARENT" && (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>This page is for coaching staff.</p>
      )}

      <h3 style={{ fontSize: 16, margin: "0 0 4px" }}>
        Needs review <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>({sessions.length})</span>
      </h3>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 16px" }}>
        Past sessions whose attendance hasn't been finalized yet.
      </p>

      {sessions.length === 0 ? (
        <div style={{ marginBottom: 36 }}>
          <EmptyState
            icon="attendance"
            title="All caught up"
            message="No sessions need attendance review right now."
          />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {sessions.map((s) => {
            const players = playersForSession(s);
            const requests = requestsBySession.get(s.id);
            const marked = new Set(s.playerAttendance.filter((p) => p.status === "ATTENDED" || p.status === "ABSENT").map((p) => p.playerId));
            const selfCheckIn = s.coachAttendance.find((c) => c.coachId === coachId);
            const started = coachId ? new Date() >= sessionStart(s.date, s.startTime) : false;

            return (
              <div key={s.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, boxShadow: "var(--shadow-sm)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                  <div>
                    <strong style={{ fontSize: 15 }}>
                      {s.date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })} · {s.startTime}–{endTime(s.startTime, s.durationMinutes)}
                    </strong>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      {s.ageGroup.name} · {s.location.name} · Head: {s.headCoaches.map((c) => c.user.name).join(", ") || "—"}
                      {s.assistantCoaches.length > 0 && <> · Assistant: {s.assistantCoaches.map((c) => c.user.name).join(", ")}</>}
                    </div>
                  </div>
                  {canFinalize(s) && (
                    <form action={finalizeAttendance.bind(null, s.id)}>
                      <button type="submit" style={btnOutline}>Finalize</button>
                    </form>
                  )}
                </div>

                {/* Coach self check-in */}
                {isAssigned(s) && started && (
                  <div style={{ marginTop: 12, padding: "8px 10px", background: "var(--surface-muted)", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, color: "var(--text)" }}>
                      <Icon name="whistle" size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                      Coach check-in:{" "}
                      {selfCheckIn?.status === "CHECKED_IN" ? (
                        <strong style={{ color: "var(--success)" }}>Checked in at {selfCheckIn.confirmedAt?.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) || "—"}</strong>
                      ) : selfCheckIn?.status === "ABSENT" ? (
                        <strong style={{ color: "var(--error)" }}>Marked absent</strong>
                      ) : (
                        "Not yet checked in"
                      )}
                    </span>
                    {selfCheckIn?.status !== "CHECKED_IN" && (
                      <form action={checkInCoach.bind(null, s.id)}>
                        <button type="submit" style={btnPrimary}>Check in</button>
                      </form>
                    )}
                  </div>
                )}

                {/* Admin override for coach attendance */}
                {isAdmin && (
                  <details style={{ marginTop: 10, fontSize: 12 }}>
                    <summary style={{ color: "var(--text-muted)", cursor: "pointer", fontWeight: 600 }}>Admin — override coach attendance</summary>
                    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                      {[...s.headCoaches, ...s.assistantCoaches].map((c) => (
                        <form
                          key={c.id}
                          action={overrideCoachAttendance.bind(null, s.id, c.id)}
                          style={{ display: "flex", gap: 6, alignItems: "center", background: "var(--surface-muted)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px" }}
                        >
                          <span>{c.user.name}</span>
                          <select name="status" defaultValue={s.coachAttendance.find((ca) => ca.coachId === c.id)?.status ?? "NOT_YET"} style={{ border: "1px solid var(--border)", borderRadius: 5, fontSize: 11 }}>
                            <option value="NOT_YET">Not yet</option>
                            <option value="CHECKED_IN">Checked in</option>
                            <option value="ABSENT">Absent</option>
                          </select>
                          <button type="submit" style={{ padding: "3px 8px", fontSize: 11, borderRadius: 5, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer" }}>
                            Set
                          </button>
                        </form>
                      ))}
                    </div>
                  </details>
                )}

                {/* Pending request needing this user's action */}
                {requests && canApprove(s, requests) && (
                  <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--warning-bg)", border: "1px solid #fde68a", borderRadius: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                      Pending proposal from {requests.requestedBy.user.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text)", marginBottom: 8 }}>
                      {(requests.payload as { statuses?: { playerId: string; status: string }[] }).statuses?.map((p) => {
                        const player = players.find((pl) => pl.id === p.playerId);
                        return (
                          <span key={p.playerId} style={{ marginRight: 10, display: "inline-block" }}>
                            {player?.name || "?"}: <strong>{p.status === "ATTENDED" ? "Attended" : "Absent"}</strong>
                          </span>
                        );
                      })}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <form action={approveAttendanceRequest.bind(null, requests.id)}>
                        <button type="submit" style={btnPrimary}>Approve</button>
                      </form>
                      <form action={rejectAttendanceRequest.bind(null, requests.id)}>
                        <button type="submit" style={btnDanger}>Reject</button>
                      </form>
                    </div>
                  </div>
                )}

                {/* Marking form */}
                {canMark(s) && players.length > 0 && (
                  <form action={submitAttendance} style={{ marginTop: 12 }}>
                    <input type="hidden" name="scheduledSessionId" value={s.id} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {players.map((p) => (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                          <input type="hidden" name="playerId" value={p.id} />
                          <span style={{ width: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                          {p.availability !== "AVAILABLE" && (
                            <AvailabilityBadge availability={p.availability} />
                          )}
                          <select name="status" defaultValue="" style={{ padding: "4px 6px", border: "1px solid var(--border)", borderRadius: 5, fontSize: 12 }}>
                            <option value="">—</option>
                            <option value="ATTENDED">Attended</option>
                            <option value="ABSENT">Absent</option>
                          </select>
                          {marked.has(p.id) && <span style={{ fontSize: 11, color: "var(--success)", fontWeight: 700 }}>✓ recorded</span>}
                        </div>
                      ))}
                    </div>
                    <button type="submit" style={{ ...btnPrimary, marginTop: 10 }}>
                      {isAdmin ? "Record attendance" : "Submit for approval"}
                    </button>
                    <p style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 6 }}>
                      {isAdmin
                        ? "Records directly — no approval needed."
                        : "Your marking goes to " + (isHeadOfSession(s) ? "an administrator for approval." : "the session's head coach for approval.")}
                    </p>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Rollup ─────────────────────────────────────────────────── */}
      <div style={{ marginTop: 36, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h3 style={{ fontSize: 16, margin: 0 }}>Rollup</h3>
          <form style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select name="range" defaultValue={range} style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 6 }}>
              <option value="month">This month</option>
              <option value="term">Last 90 days</option>
            </select>
            <button type="submit" style={btnOutline}>Apply</button>
          </form>
        </div>

        <div className="rollup-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 8 }}>Misses by player</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {playerMissList.map((p) => (
                <div key={p.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                  <span>{p.name}</span>
                  <span style={{ fontWeight: 700, color: p.absent > 0 ? "var(--error)" : "var(--success)" }}>
                    {p.absent} absent / {p.attended + p.absent}
                  </span>
                </div>
              ))}
              {playerMissList.length === 0 && <span style={{ fontSize: 12, color: "var(--text-faint)" }}>No attendance recorded in this window.</span>}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 8 }}>Attendance rate by batch</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {batchStatList.map((b) => {
                const rate = b.attended + b.absent > 0 ? Math.round((b.attended / (b.attended + b.absent)) * 100) : 0;
                return (
                  <div key={b.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                    <span>{b.name}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700 }}>{rate}%</span>
                      <span style={{ fontSize: 11, color: "var(--text-faint)" }}>({b.attended}/{b.attended + b.absent})</span>
                    </span>
                  </div>
                );
              })}
              {batchStatList.length === 0 && <span style={{ fontSize: 12, color: "var(--text-faint)" }}>No attendance recorded in this window.</span>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}