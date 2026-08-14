import { prisma } from "@/lib/prisma";
import { getPermissions } from "@/lib/permissions";
import { StatusBanner } from "@/components/StatusBanner";
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

  return (
    <main style={{ maxWidth: 780, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 28, margin: "8px 0 20px" }}>Attendance</h1>

      <StatusBanner error={params.error} success={params.success} />

      {perms.role === "PARENT" && (
        <p style={{ fontSize: 13, color: "#6B7280" }}>This page is for coaching staff.</p>
      )}

      <h3 style={{ fontSize: 16 }}>Needs review ({sessions.length})</h3>
      <p style={{ fontSize: 12, color: "#6B7280", marginTop: -6, marginBottom: 16 }}>
        Past sessions whose attendance hasn't been finalized yet.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {sessions.map((s) => {
          const players = playersForSession(s);
          const requests = requestsBySession.get(s.id);
          const marked = new Set(s.playerAttendance.filter((p) => p.status === "ATTENDED" || p.status === "ABSENT").map((p) => p.playerId));
          const selfCheckIn = s.coachAttendance.find((c) => c.coachId === coachId);
          const started = coachId ? new Date() >= sessionStart(s.date, s.startTime) : false;

          return (
            <div key={s.id} style={{ background: "#fff", border: "2px solid var(--pitch)", borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <strong style={{ fontSize: 15 }}>
                    {s.date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })} · {s.startTime}–{endTime(s.startTime, s.durationMinutes)}
                  </strong>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                    {s.ageGroup.name} · {s.location.name} · Head: {s.headCoaches.map((c) => c.user.name).join(", ") || "—"}
                    {s.assistantCoaches.length > 0 && <> · Assistant: {s.assistantCoaches.map((c) => c.user.name).join(", ")}</>}
                  </div>
                </div>
                {canFinalize(s) && (
                  <form action={finalizeAttendance.bind(null, s.id)}>
                    <button
                      type="submit"
                      style={{ fontSize: 11, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--turf)", background: "#fff", color: "var(--turf)", cursor: "pointer", fontWeight: 700 }}
                    >
                      Finalize
                    </button>
                  </form>
                )}
              </div>

              {/* Coach self check-in */}
              {isAssigned(s) && started && (
                <div style={{ marginTop: 12, padding: "8px 10px", background: "#F3F4F6", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "#4B5563" }}>
                    Coach check-in:{" "}
                    {selfCheckIn?.status === "CHECKED_IN" ? (
                      <strong style={{ color: "var(--turf)" }}>Checked in at {selfCheckIn.confirmedAt?.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) || "—"}</strong>
                    ) : selfCheckIn?.status === "ABSENT" ? (
                      <strong style={{ color: "var(--clay)" }}>Marked absent</strong>
                    ) : (
                      "Not yet checked in"
                    )}
                  </span>
                  {selfCheckIn?.status !== "CHECKED_IN" && (
                    <form action={checkInCoach.bind(null, s.id)}>
                      <button
                        type="submit"
                        style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "none", background: "var(--turf)", color: "#fff", cursor: "pointer", fontWeight: 700 }}
                      >
                        Check in
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Admin override for coach attendance */}
              {isAdmin && (
                <details style={{ marginTop: 10, fontSize: 12 }}>
                  <summary style={{ color: "#6B7280", cursor: "pointer" }}>Admin — override coach attendance</summary>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    {[...s.headCoaches, ...s.assistantCoaches].map((c) => (
                      <form
                        key={c.id}
                        action={overrideCoachAttendance.bind(null, s.id, c.id)}
                        style={{ display: "flex", gap: 6, alignItems: "center", background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 8, padding: "6px 8px" }}
                      >
                        <span>{c.user.name}</span>
                        <select name="status" defaultValue={s.coachAttendance.find((ca) => ca.coachId === c.id)?.status ?? "NOT_YET"}>
                          <option value="NOT_YET">Not yet</option>
                          <option value="CHECKED_IN">Checked in</option>
                          <option value="ABSENT">Absent</option>
                        </select>
                        <button type="submit" style={{ padding: "3px 8px", fontSize: 11, borderRadius: 5, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}>
                          Set
                        </button>
                      </form>
                    ))}
                  </div>
                </details>
              )}

              {/* Pending request needing this user's action */}
              {requests && canApprove(s, requests) && (
                <div style={{ marginTop: 12, padding: "10px 12px", background: "#FFF7ED", border: "1px solid var(--amber)", borderRadius: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    Pending proposal from {requests.requestedBy.user.name}
                  </div>
                  <div style={{ fontSize: 12, color: "#374151", marginBottom: 8 }}>
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
                      <button
                        type="submit"
                        style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "none", background: "var(--turf)", color: "#fff", cursor: "pointer", fontWeight: 700 }}
                      >
                        Approve
                      </button>
                    </form>
                    <form action={rejectAttendanceRequest.bind(null, requests.id)}>
                      <button
                        type="submit"
                        style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "1px solid var(--clay)", background: "#fff", color: "var(--clay)", cursor: "pointer", fontWeight: 700 }}
                      >
                        Reject
                      </button>
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
                        <select name="status" defaultValue="">
                          <option value="">—</option>
                          <option value="ATTENDED">Attended</option>
                          <option value="ABSENT">Absent</option>
                        </select>
                        {marked.has(p.id) && <span style={{ fontSize: 11, color: "var(--turf)", fontWeight: 700 }}>✓ recorded</span>}
                      </div>
                    ))}
                  </div>
                  <button
                    type="submit"
                    style={{ marginTop: 10, padding: "7px 14px", background: "var(--pitch)", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 13 }}
                  >
                    {isAdmin ? "Record attendance" : "Submit for approval"}
                  </button>
                  <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6 }}>
                    {isAdmin
                      ? "Records directly — no approval needed."
                      : "Your marking goes to " + (isHeadOfSession(s) ? "an administrator for approval." : "the session's head coach for approval.")}
                  </p>
                </form>
              )}
            </div>
          );
        })}
        {sessions.length === 0 && <p style={{ color: "#6B7280" }}>No sessions need attendance review right now.</p>}
      </div>

      {/* ── Rollup ─────────────────────────────────────────────────── */}
      <div style={{ marginTop: 36, paddingTop: 24, borderTop: "2px solid #E5E7EB" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h3 style={{ fontSize: 16, margin: 0 }}>Rollup</h3>
          <form style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select name="range" defaultValue={range} style={{ padding: 6, border: "1px solid #d1d5db", borderRadius: 6 }}>
              <option value="month">This month</option>
              <option value="term">Last 90 days</option>
            </select>
            <button
              type="submit"
              style={{ padding: "6px 12px", border: "1px solid var(--turf)", background: "#fff", color: "var(--turf)", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}
            >
              Apply
            </button>
          </form>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 16 }} className="rollup-grid">
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 8 }}>MISSES BY PLAYER</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {playerMissList.map((p) => (
                <div key={p.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", borderBottom: "1px solid #F3F4F6" }}>
                  <span>{p.name}</span>
                  <span style={{ fontWeight: 700, color: p.absent > 0 ? "var(--clay)" : "var(--turf)" }}>
                    {p.absent} absent / {p.attended + p.absent}
                  </span>
                </div>
              ))}
              {playerMissList.length === 0 && <span style={{ fontSize: 12, color: "#9CA3AF" }}>No attendance recorded in this window.</span>}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 8 }}>ATTENDANCE RATE BY BATCH</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {batchStatList.map((b) => {
                const rate = b.attended + b.absent > 0 ? Math.round((b.attended / (b.attended + b.absent)) * 100) : 0;
                return (
                  <div key={b.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "4px 0", borderBottom: "1px solid #F3F4F6" }}>
                    <span>{b.name}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700 }}>{rate}%</span>
                      <span style={{ fontSize: 11, color: "#9CA3AF" }}>({b.attended}/{b.attended + b.absent})</span>
                    </span>
                  </div>
                );
              })}
              {batchStatList.length === 0 && <span style={{ fontSize: 12, color: "#9CA3AF" }}>No attendance recorded in this window.</span>}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}