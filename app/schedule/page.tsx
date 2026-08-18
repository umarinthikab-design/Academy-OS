import { prisma } from "@/lib/prisma";
import { createScheduledSession, deleteScheduledSession, updateScheduledSession, attachSessionPlan, detachSessionPlan } from "./actions";
import { getPermissions } from "@/lib/permissions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { StatusBanner } from "@/components/StatusBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { SessionCard } from "@/components/ui/SessionCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CollapsibleCreate } from "@/components/ui/CollapsibleCreate";
import { inputBase } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";

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
    prisma.coach.findMany({ where: { designation: "HEAD", user: { archivedAt: null } }, include: { user: true } }),
    prisma.coach.findMany({ where: { designation: "ASSISTANT", user: { archivedAt: null } }, include: { user: true } }),
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

  const fieldLabel: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--text)" };
  const smallBtn: React.CSSProperties = { padding: "6px 12px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" };

  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle={
          canEdit ? (
            "Schedule training sessions on the calendar, assign coaches, and attach a session plan."
          ) : (
            "View only — you don't have edit access to the schedule."
          )
        }
        actions={
          <a href="/schedule/history" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--secondary)", textDecoration: "none" }}>
            Session history <span aria-hidden="true">→</span>
          </a>
        }
      />

      <StatusBanner error={params.error} success={params.success} />

      {canEdit && missingPrereqs && (
        <div
          style={{
            background: "var(--warning-bg)",
            border: "1px solid #fde68a",
            borderRadius: 10,
            padding: 14,
            marginBottom: 20,
            fontSize: 13,
            color: "#92400e",
          }}
        >
          {locations.length === 0 && <p style={{ margin: "0 0 4px" }}>Add a <a href="/locations" style={{ color: "inherit", fontWeight: 700 }}>location</a> first.</p>}
          {headCoaches.length === 0 && <p style={{ margin: 0 }}>Add a <a href="/coaches" style={{ color: "inherit", fontWeight: 700 }}>head coach</a> first — every session needs at least one.</p>}
        </div>
      )}

      {canEdit && !missingPrereqs && (
        <CollapsibleCreate title="Schedule a new session">
          <form action={createScheduledSession}>
            <div className="form-grid-2col" style={{ gap: 12 }}>
              <div>
                <label style={fieldLabel}>Date</label>
                <input name="date" type="date" required style={inputBase} />
              </div>
              <div>
                <label style={fieldLabel}>Start time</label>
                <input name="time" type="time" required style={inputBase} />
              </div>
              <div>
                <label style={fieldLabel}>Duration (minutes)</label>
                <input name="duration" type="number" defaultValue={60} required style={inputBase} />
              </div>
              <div>
                <label style={fieldLabel}>Age group</label>
                <select name="ageGroupId" required style={inputBase}>
                  {ageGroups.map((ag) => (
                    <option key={ag.id} value={ag.id}>{ag.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={fieldLabel}>Location</label>
                <select name="locationId" required style={inputBase}>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={fieldLabel}>Head coach(es)</label>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 4 }}>
                  {headCoaches.map((c) => (
                    <label key={c.id} style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <input type="checkbox" name="headCoaches" value={c.id} /> {c.user.name}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={fieldLabel}>Assistant coach(es)</label>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 4 }}>
                  {assistantCoaches.length === 0 && <span style={{ fontSize: 12, color: "var(--text-faint)" }}>None in the roster yet.</span>}
                  {assistantCoaches.map((c) => (
                    <label key={c.id} style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <input type="checkbox" name="assistantCoaches" value={c.id} /> {c.user.name}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <input type="checkbox" name="recurring" /> Weekly recurring
                </label>
                <div>
                  <label style={{ fontSize: 11, color: "var(--text-muted)", marginRight: 6 }}>Weeks (only if recurring):</label>
                  <input name="weeks" type="number" defaultValue={8} min={1} max={26} style={{ width: 64, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 6 }} />
                </div>
              </div>
            </div>
            <button type="submit" style={{ ...smallBtn, marginTop: 14, padding: "9px 18px" }}>
              Schedule Session
            </button>
          </form>
        </CollapsibleCreate>
      )}

      <h3 style={{ fontSize: 16, margin: "0 0 12px" }}>
        {canEdit ? "Upcoming" : "This month"} <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>({sessions.length})</span>
      </h3>

      {sessions.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="Nothing scheduled yet"
          message="Create your first session above and it will show up here."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          {sessions.map((s) => (
            <div key={s.id}>
              <SessionCard
                date={s.date}
                startTime={s.startTime}
                durationMinutes={s.durationMinutes}
                ageGroupName={s.ageGroup.name}
                locationName={s.location.name}
                headCoaches={s.headCoaches.map((c) => c.user.name)}
                assistantCoaches={s.assistantCoaches.map((c) => c.user.name)}
                badge={s.recurring ? <Badge tone="accent">Weekly</Badge> : undefined}
                actions={
                  canEdit ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <details style={{ position: "relative" }}>
                        <summary
                          style={{
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 700,
                            padding: "5px 12px",
                            borderRadius: 8,
                            border: "1px solid var(--border)",
                            background: "var(--surface)",
                            color: "var(--text)",
                            listStyle: "none",
                            userSelect: "none",
                          }}
                        >
                          Edit
                        </summary>
                        <div
                          style={{
                            position: "absolute",
                            right: 0,
                            top: "calc(100% + 6px)",
                            zIndex: 20,
                            width: 420,
                            maxWidth: "80vw",
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius)",
                            boxShadow: "var(--shadow-md)",
                            padding: 16,
                          }}
                        >
                          <form action={updateScheduledSession.bind(null, s.id)}>
                            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>Edit session</div>
                            <div className="form-grid-2col" style={{ gap: 10 }}>
                              <div>
                                <label style={fieldLabel}>Date</label>
                                <input name="date" type="date" defaultValue={s.date.toISOString().slice(0, 10)} required style={inputBase} />
                              </div>
                              <div>
                                <label style={fieldLabel}>Start time</label>
                                <input name="time" type="time" defaultValue={s.startTime} required style={inputBase} />
                              </div>
                              <div>
                                <label style={fieldLabel}>Duration (min)</label>
                                <input name="duration" type="number" defaultValue={s.durationMinutes} required style={inputBase} />
                              </div>
                              <div>
                                <label style={fieldLabel}>Age group</label>
                                <select name="ageGroupId" defaultValue={s.ageGroupId} required style={inputBase}>
                                  {ageGroups.map((ag) => (
                                    <option key={ag.id} value={ag.id}>{ag.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div style={{ gridColumn: "1 / -1" }}>
                                <label style={fieldLabel}>Location</label>
                                <select name="locationId" defaultValue={s.locationId} required style={inputBase}>
                                  {locations.map((l) => (
                                    <option key={l.id} value={l.id}>{l.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div style={{ gridColumn: "1 / -1" }}>
                                <label style={fieldLabel}>Head coach(es)</label>
                                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 4 }}>
                                  {headCoaches.map((c) => (
                                    <label key={c.id} style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 5 }}>
                                      <input type="checkbox" name="headCoaches" value={c.id} defaultChecked={s.headCoaches.some((hc) => hc.id === c.id)} /> {c.user.name}
                                    </label>
                                  ))}
                                </div>
                              </div>
                              <div style={{ gridColumn: "1 / -1" }}>
                                <label style={fieldLabel}>Assistant coach(es)</label>
                                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 4 }}>
                                  {assistantCoaches.map((c) => (
                                    <label key={c.id} style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 5 }}>
                                      <input type="checkbox" name="assistantCoaches" value={c.id} defaultChecked={s.assistantCoaches.some((ac) => ac.id === c.id)} /> {c.user.name}
                                    </label>
                                  ))}
                                </div>
                              </div>
                              <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6, marginTop: 2 }}>
                                <label style={{ fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
                                  <input type="radio" name="scope" value="this" defaultChecked /> This session only
                                </label>
                                {s.recurring && (
                                  <label style={{ fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
                                    <input type="radio" name="scope" value="all_future" /> This and all future weeks
                                  </label>
                                )}
                              </div>
                            </div>
                            <button
                              type="submit"
                              style={{ marginTop: 12, padding: "9px 18px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                            >
                              Save changes
                            </button>
                          </form>
                        </div>
                      </details>
                      <ConfirmDeleteButton
                        action={deleteScheduledSession.bind(null, s.id)}
                        confirmMessage="Remove this session? This can't be undone."
                      />
                    </div>
                  ) : undefined
                }
              footer={
                s.session ? (
                  <div>
                    <strong style={{ color: "var(--secondary)" }}>
                      <Icon name="plan" size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                      Plan: {s.session.name}
                    </strong>{" "}
                    <span style={{ color: "var(--text-muted)" }}>· by {s.session.createdBy.user.name}</span>
                    <div style={{ marginTop: 4, color: "var(--text)", fontSize: 12 }}>
                      {s.session.drills.map((sd, i) => (
                        <div key={sd.id} style={{ padding: "1px 0" }}>
                          <span style={{ color: "var(--text-faint)", marginRight: 4 }}>{i + 1}.</span> {sd.drill.name}
                        </div>
                      ))}
                    </div>
                    {canEdit && inAttachWindow(s) && (
                      <form action={detachSessionPlan.bind(null, s.id)} style={{ marginTop: 6 }}>
                        <button type="submit" style={{ fontSize: 11, padding: "4px 10px", border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 6, cursor: "pointer", color: "var(--text-muted)" }}>
                          Remove plan
                        </button>
                      </form>
                    )}
                  </div>
                ) : canEdit && inAttachWindow(s) ? (
                  <form action={attachSessionPlan.bind(null, s.id)} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <select name="sessionId" required style={{ ...inputBase, width: "auto", minWidth: 220, fontSize: 12, padding: "6px 10px" }}>
                      <option value="">Attach a session plan…</option>
                      {sessionPlans.map((sp) => (
                        <option key={sp.id} value={sp.id}>{sp.name}</option>
                      ))}
                    </select>
                    <button type="submit" style={smallBtn}>Attach</button>
                  </form>
                ) : undefined
              }
              />
            </div>
          ))}
        </div>
      )}

      {!canEdit && (
        <p style={{ fontSize: 12, color: "var(--text-faint)" }}>
          Showing this calendar month only. Past sessions are available on the history page.
        </p>
      )}
    </>
  );
}