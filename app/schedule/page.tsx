import { prisma } from "@/lib/prisma";
import { createScheduledSession, deleteScheduledSession } from "./actions";
import { getPermissions } from "@/lib/permissions";

function endTime(time: string, durationMinutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + durationMinutes;
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
}

export default async function SchedulePage() {
  const perms = await getPermissions();
  const canEdit = perms.isAdmin || perms.canEditSchedule;
  const [ageGroups, locations, headCoaches, assistantCoaches, sessions] = await Promise.all([
    prisma.ageGroup.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    prisma.coach.findMany({ where: { designation: "HEAD" }, include: { user: true } }),
    prisma.coach.findMany({ where: { designation: "ASSISTANT" }, include: { user: true } }),
    prisma.scheduledSession.findMany({
      include: { ageGroup: true, location: true, headCoaches: { include: { user: true } }, assistantCoaches: { include: { user: true } } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = sessions.filter((s) => s.date >= today);
  const past = sessions.filter((s) => s.date < today);

  const missingPrereqs = locations.length === 0 || headCoaches.length === 0;

  return (
    <main style={{ maxWidth: 780, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 28, margin: "8px 0 20px" }}>Schedule</h1>

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

      <h3 style={{ fontSize: 16 }}>Upcoming ({upcoming.length})</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {upcoming.map((s) => (
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
                <form action={deleteScheduledSession.bind(null, s.id)}>
                  <button type="submit" style={{ background: "none", border: "none", color: "#E63946", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
                    Remove
                  </button>
                </form>
              )}
            </div>
          </div>
        ))}
        {upcoming.length === 0 && <p style={{ color: "#6B7280" }}>Nothing scheduled yet.</p>}
      </div>

      {past.length > 0 && (
        <>
          <h4 style={{ fontSize: 13, color: "#6B7280" }}>Past</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {past.map((s) => (
              <div key={s.id} style={{ fontSize: 12, color: "#9CA3AF" }}>
                {s.date.toLocaleDateString()} · {s.ageGroup.name} · {s.location.name}
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
