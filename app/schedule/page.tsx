import { prisma } from "@/lib/prisma";
import { createScheduledSession, deleteScheduledSession, attachSessionPlan, detachSessionPlan } from "./actions";
import { getPermissions } from "@/lib/permissions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { StatusBanner } from "@/components/StatusBanner";

function endTime(time: string, durationMinutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + durationMinutes;
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const perms = await getPermissions();
  const canEdit = perms.isAdmin || perms.canEditSchedule;

  // DB-level date filtering instead of loading every session and splitting
  // client-side. Coaches without schedule-edit access only see the current
  // calendar month (they're planning near-term, not months ahead); admins
  // and editors see everything from today onward so they can manage
  // recurring plans well in advance. Past sessions live on the history
  // page (/schedule/history) rather than this view.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const dateFilter: { gte: Date; lt?: Date } = canEdit
    ? { gte: today }
    : { gte: startOfMonth, lt: new Date(today.getFullYear(), today.getMonth() + 1, 1) };

  const [ageGroups, locations, headCoaches, assistantCoaches, sessions, sessionPlans] = await Promise.all([
    prisma.ageGroup.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    prisma.coach.findMany({ where: { designation: "HEAD" }, include: { user: true } }),
    prisma.coach.findMany({ where: { designation: "ASSISTANT" }, include: { user: true } }),
    prisma.scheduledSession.findMany({
      where: { date: dateFilter },
      include: {
        ageGroup: true,
        location: true,
        headCoaches: { include: { user: true } },
        assistantCoaches: { include: { user: true } },
        session: { include: { drills: { include: { drill: true }, orderBy: { order: "asc" } }, createdBy: { include: { user: true } } } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    prisma.session.findMany({
      where: perms.coachId ? { OR: [{ createdById: perms.coachId }, { shareStatus: "APPROVED" }] } : { shareStatus: "APPROVED" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const missingPrereqs = locations.length === 0 || headCoaches.length === 0;

  // The 72h attach/edit window starts at the session's end time. Within the
  // window a past session can still be given a plan; after it, both
  // attaching and editing are locked.
  const SIXTY_TWO_MS = 72 * 60 * 60 * 1000;
  const inAttachWindow = (s: (typeof sessions)[number]) => {
    const [h, m] = s.startTime.split(":").map(Number);
    const start = new Date(s.date);
    start.setHours(h, m, 0, 0);
    const end = new Date(start.getTime() + s.durationMinutes * 60 * 1000);
    return new Date().getTime() <= end.getTime() + SIXTY_TWO_MS;
  };

  return (
    <main style={{ maxWidth: 780, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 28, margin: "8px 0 20px" }}>Schedule</h1>

      <a
        href="/schedule/history"
        style={{ display: "inline-block", marginBottom: 16, fontSize: 13, fontWeight: 700, color: "var(--turf)", textDecoration: "none" }}
      >
        Session history (12 months) →
      </a>

      <StatusBanner error={params.error} success={params.success} />

      {!canEdit && (
        <p style={{ fontSize: 13, color: "#6B7280", marginTop: -8, marginBottom: 20 }}>
          View only — you don't have edit access to the schedule.
        </p>
      )}

      {canEdit && missingPrereqs && (
        <div
          style={{
            background: "#FFF3CD",
            border: "2px solid var(--amber)",
            borderRadius: 10,
            padding: 14,
            marginBottom: 20,
            fontSize: 13,
          }}
        >
          {locations.length === 0 && <p style={{ margin: "0 0 4px" }}>Add a <a href="/locations">location</a> first.</p>}
          {headCoaches.length === 0 && <p style={{ margin: 0 }}>Add a <a href="/coaches">head coach</a> first — every session needs at least one.</p>}
        </div>
      )}

      {canEdit && !missingPrereqs && (
        <form
          action={createScheduledSession}
          style={{
            background: "#fff",
            border: "2px solid var(--pitch)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
          }}
        >
          <div className="form-grid-2col" style={{ marginBottom: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Date</label>
              <input name="date" type="date" required style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Start time</label>
              <input name="time" type="time" required style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Duration (minutes)</label>
              <input name="duration" type="number" defaultValue={60} required style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Age group</label>
              <select name="ageGroupId" required style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }}>
                {ageGroups.map((ag) => (
                  <option key={ag.id} value={ag.id}>{ag.name}</option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Location</label>
              <select name="locationId" required style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }}>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Head coach(es)</label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {headCoaches.map((c) => (
                  <label key={c.id} style={{ fontSize: 13 }}>
                    <input type="checkbox" name="headCoaches" value={c.id} /> {c.user.name}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Assistant coach(es)</label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {assistantCoaches.length === 0 && <span style={{ fontSize: 12, color: "#9CA3AF" }}>None in the roster yet.</span>}
                {assistantCoaches.map((c) => (
                  <label key={c.id} style={{ fontSize: 13 }}>
                    <input type="checkbox" name="assistantCoaches" value={c.id} /> {c.user.name}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ fontSize: 13, fontWeight: 700 }}>
                <input type="checkbox" name="recurring" /> Weekly recurring
              </label>
              <div>
                <label style={{ fontSize: 11, color: "#6B7280", marginRight: 6 }}>
                  Weeks (only used if recurring is checked):
                </label>
                <input name="weeks" type="number" defaultValue={8} min={1} max={26} style={{ width: 60, padding: 6, border: "1px solid #d1d5db", borderRadius: 6 }} />
              </div>
            </div>
          </div>
          <button
            type="submit"
            style={{ padding: "8px 16px", background: "var(--pitch)", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}
          >
            Schedule Session
          </button>
        </form>
      )}

      <h3 style={{ fontSize: 16 }}>
        {canEdit ? "Upcoming" : "This month"} ({sessions.length})
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {sessions.map((s) => (
          <div key={s.id} style={{ background: "#fff", border: "2px solid var(--pitch)", borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
              <div>
                <strong>
                  {s.date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })} · {s.startTime}–{endTime(s.startTime, s.durationMinutes)}
                </strong>
                {s.recurring && (
                  <span style={{ fontSize: 10, fontWeight: 700, marginLeft: 8, padding: "2px 8px", borderRadius: 20, background: "var(--amber)", color: "var(--pitch)" }}>
                    WEEKLY
                  </span>
                )}
                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                  {s.ageGroup.name} · {s.location.name} · Head: {s.headCoaches.map((c) => c.user.name).join(", ") || "—"}
                  {s.assistantCoaches.length > 0 && <> · Assistant: {s.assistantCoaches.map((c) => c.user.name).join(", ")}</>}
                </div>
              </div>
              {canEdit && (
                <ConfirmDeleteButton
                  action={deleteScheduledSession.bind(null, s.id)}
                  confirmMessage="Remove this session? This can't be undone."
                />
              )}
            </div>

            {/* Attached session plan + attach control */}
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #E5E7EB", fontSize: 12 }}>
              {s.session ? (
                <div>
                  <strong style={{ color: "var(--turf)" }}>Plan: {s.session.name}</strong>{" "}
                  <span style={{ color: "#6B7280" }}>· by {s.session.createdBy.user.name}</span>
                  <div style={{ marginTop: 4, color: "#374151" }}>
                    {s.session.drills.map((sd, i) => (
                      <div key={sd.id} style={{ padding: "1px 0" }}>
                        <span style={{ color: "#9CA3AF", marginRight: 4 }}>{i + 1}.</span> {sd.drill.name}
                      </div>
                    ))}
                  </div>
                  {canEdit && inAttachWindow(s) && (
                    <form action={detachSessionPlan.bind(null, s.id)} style={{ marginTop: 6 }}>
                      <button type="submit" style={{ fontSize: 11, padding: "4px 10px", border: "1px solid #d1d5db", background: "#fff", borderRadius: 6, cursor: "pointer", color: "#6B7280" }}>
                        Remove plan
                      </button>
                    </form>
                  )}
                </div>
              ) : canEdit && inAttachWindow(s) && (
                <form action={attachSessionPlan.bind(null, s.id)}>
                  <select name="sessionId" required style={{ padding: 6, border: "1px solid #d1d5db", borderRadius: 6, fontSize: 12 }}>
                    <option value="">Attach a session plan…</option>
                    {sessionPlans.map((sp) => (
                      <option key={sp.id} value={sp.id}>{sp.name}</option>
                    ))}
                  </select>
                  <button type="submit" style={{ marginLeft: 6, padding: "6px 12px", background: "var(--pitch)", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                    Attach
                  </button>
                </form>
              )}
            </div>
          </div>
        ))}
        {sessions.length === 0 && <p style={{ color: "#6B7280" }}>Nothing scheduled yet.</p>}
      </div>

      {!canEdit && (
        <p style={{ fontSize: 12, color: "#9CA3AF" }}>
          Showing this calendar month only. Past sessions are available on the history page.
        </p>
      )}
    </main>
  );
}
