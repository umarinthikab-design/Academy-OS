import { prisma } from "@/lib/prisma";
import { createSession, deleteSession, shareSession, approveSessionShare, rejectSessionShare, reorderSessionDrill } from "./actions";
import { getPermissions } from "@/lib/permissions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { StatusBanner } from "@/components/StatusBanner";

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const perms = await getPermissions();
  const canSuggest = perms.canSuggestDrills;
  const canApprove = perms.isAdmin || perms.canApproveRequests;

  // Visible plans: your own (all of them) plus team-shared ones from other
  // coaches. Private plans from other coaches are never shown.
  const sessions = await prisma.session.findMany({
    where: perms.coachId
      ? { OR: [{ createdById: perms.coachId }, { shareStatus: "APPROVED" }] }
      : { shareStatus: "APPROVED" },
    include: {
      createdBy: { include: { user: true } },
      drills: { include: { drill: true }, orderBy: { order: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  const approvedDrills = await prisma.drill.findMany({
    where: { status: "APPROVED" },
    orderBy: { name: "asc" },
  });

  // Pending share requests this user can act on.
  const pendingShares = canApprove
    ? await prisma.approvalRequest.findMany({
        where: { type: "SESSION_SHARE", status: "PENDING" },
        include: { requestedBy: { include: { user: true } } },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const statusLabel = (s: (typeof sessions)[number]) => {
    if (s.isPrivate === false || s.shareStatus === "APPROVED") return { label: "Team", color: "#2D6A4F" };
    if (s.shareStatus === "PENDING") return { label: "Share pending", color: "#B45309" };
    if (s.shareStatus === "REJECTED") return { label: "Share rejected", color: "#9CA3AF" };
    return { label: "Private", color: "#6B7280" };
  };

  const mySessions = perms.coachId ? sessions.filter((s) => s.createdById === perms.coachId) : [];
  const teamSessions = sessions.filter((s) => s.createdById !== perms.coachId);

  return (
    <main style={{ maxWidth: 780, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 28, margin: "8px 0 20px" }}>My Sessions</h1>

      <StatusBanner error={params.error} success={params.success} />

      {!canSuggest && (
        <p style={{ fontSize: 13, color: "#6B7280", marginTop: -8, marginBottom: 20 }}>
          Only coaches can create session plans. You can still view shared ones below.
        </p>
      )}

      {canSuggest && (
        <form
          action={createSession}
          style={{ background: "#fff", border: "2px solid var(--pitch)", borderRadius: 12, padding: 16, marginBottom: 28 }}
        >
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Plan name</label>
          <input name="name" required placeholder="e.g. Passing patterns - warmup" style={{ width: "100%", padding: 8, marginBottom: 12, border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }} />

          <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Drills (in order)</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto", border: "1px solid #E5E7EB", borderRadius: 8, padding: 10, marginBottom: 12 }}>
            {approvedDrills.map((d) => (
              <label key={d.id} style={{ fontSize: 13 }}>
                <input type="checkbox" name="drillIds" value={d.id} /> {d.name} <span style={{ color: "#9CA3AF" }}>· {d.category} · {d.duration}m</span>
              </label>
            ))}
            {approvedDrills.length === 0 && <span style={{ fontSize: 12, color: "#9CA3AF" }}>No approved drills in the library yet.</span>}
          </div>

          <button type="submit" style={{ padding: "8px 16px", background: "var(--pitch)", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>
            Create Plan
          </button>
          <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 8 }}>Plans start private to you. Use “Share” to request team visibility.</p>
        </form>
      )}

      {/* Pending share approvals */}
      {pendingShares.length > 0 && (
        <>
          <h3 style={{ fontSize: 16 }}>Share requests pending review ({pendingShares.length})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
            {pendingShares.map((r) => {
              const payload = r.payload as { sessionId?: string };
              const session = sessions.find((s) => s.id === payload.sessionId);
              return (
                <div key={r.id} style={{ background: "#FFF3CD", border: "2px solid var(--amber)", borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <span style={{ fontSize: 13 }}>
                    <strong>{session?.name ?? "Unknown plan"}</strong> <span style={{ color: "#6B7280" }}>· shared by {r.requestedBy.user.name}</span>
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <form action={approveSessionShare.bind(null, r.id)}>
                      <button type="submit" style={{ padding: "5px 10px", background: "var(--turf)", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                        Approve
                      </button>
                    </form>
                    <form action={rejectSessionShare.bind(null, r.id)}>
                      <button type="submit" style={{ padding: "5px 10px", background: "#fff", color: "#E63946", border: "2px solid #E63946", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* My plans */}
      <h3 style={{ fontSize: 16 }}>My plans ({mySessions.length})</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
        {mySessions.map((s) => {
          const st = statusLabel(s);
          return (
            <div key={s.id} style={{ background: "#fff", border: "2px solid var(--pitch)", borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <strong>{s.name}</strong>{" "}
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: st.color, color: "#fff" }}>{st.label}</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {s.shareStatus === null && (
                    <form action={shareSession.bind(null, s.id)}>
                      <button type="submit" style={{ padding: "5px 10px", border: "1px solid var(--turf)", background: "#fff", color: "var(--turf)", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                        Share
                      </button>
                    </form>
                  )}
                  {s.shareStatus === "REJECTED" && (
                    <form action={shareSession.bind(null, s.id)}>
                      <button type="submit" style={{ padding: "5px 10px", border: "1px solid var(--turf)", background: "#fff", color: "var(--turf)", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                        Resubmit
                      </button>
                    </form>
                  )}
                  <ConfirmDeleteButton
                    action={deleteSession.bind(null, s.id)}
                    confirmMessage={`Delete "${s.name}"? This can't be undone.`}
                    label="Delete"
                    buttonStyle={{ padding: "5px 10px", background: "#fff", color: "#E63946", border: "2px solid #E63946", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                  />
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                {s.drills.map((sd, i) => (
                  <div key={sd.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "3px 0" }}>
                    <span style={{ color: "#9CA3AF", width: 18 }}>{i + 1}.</span>
                    <span style={{ flex: 1 }}>{sd.drill.name}</span>
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>{sd.drill.category} · {sd.drill.duration}m</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <form action={reorderSessionDrill.bind(null, s.id, sd.drillId, "up")}>
                        <button type="submit" disabled={i === 0} style={{ padding: "2px 8px", fontSize: 12, border: "1px solid #d1d5db", background: "#fff", borderRadius: 5, cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.4 : 1 }}>↑</button>
                      </form>
                      <form action={reorderSessionDrill.bind(null, s.id, sd.drillId, "down")}>
                        <button type="submit" disabled={i === s.drills.length - 1} style={{ padding: "2px 8px", fontSize: 12, border: "1px solid #d1d5db", background: "#fff", borderRadius: 5, cursor: i === s.drills.length - 1 ? "default" : "pointer", opacity: i === s.drills.length - 1 ? 0.4 : 1 }}>↓</button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {mySessions.length === 0 && <p style={{ color: "#6B7280" }}>No plans yet — create your first one above.</p>}
      </div>

      {/* Team-shared plans (view-only) */}
      {teamSessions.length > 0 && (
        <>
          <h3 style={{ fontSize: 16 }}>Team plans ({teamSessions.length})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {teamSessions.map((s) => (
              <div key={s.id} style={{ background: "#fff", border: "2px solid var(--turf)", borderRadius: 10, padding: "10px 14px" }}>
                <strong>{s.name}</strong>
                <span style={{ fontSize: 11, color: "#6B7280", marginLeft: 8 }}>· by {s.createdBy.user.name}</span>
                <div style={{ marginTop: 6, fontSize: 13 }}>
                  {s.drills.map((sd, i) => (
                    <div key={sd.id} style={{ padding: "2px 0" }}>
                      <span style={{ color: "#9CA3AF", marginRight: 4 }}>{i + 1}.</span> {sd.drill.name}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}