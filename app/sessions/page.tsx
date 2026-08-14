import { prisma } from "@/lib/prisma";
import { createSession, deleteSession, shareSession, approveSessionShare, rejectSessionShare, reorderSessionDrill } from "./actions";
import { getPermissions } from "@/lib/permissions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { StatusBanner } from "@/components/StatusBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { inputBase } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";

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

  const statusBadge = (s: (typeof sessions)[number]) => {
    if (s.isPrivate === false || s.shareStatus === "APPROVED") return <Badge tone="green">Team</Badge>;
    if (s.shareStatus === "PENDING") return <Badge tone="warning">Share pending</Badge>;
    if (s.shareStatus === "REJECTED") return <Badge tone="muted">Share rejected</Badge>;
    return <Badge tone="muted">Private</Badge>;
  };

  const mySessions = perms.coachId ? sessions.filter((s) => s.createdById === perms.coachId) : [];
  const teamSessions = sessions.filter((s) => s.createdById !== perms.coachId);

  return (
    <>
      <PageHeader
        title="Sessions"
        subtitle={canSuggest ? "Build training plans from the approved drill library." : "Only coaches can create session plans. You can still view shared ones below."}
      />

      <StatusBanner error={params.error} success={params.success} />

      {canSuggest && (
        <form
          action={createSession}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-sm)",
            padding: 18,
            marginBottom: 28,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Icon name="plus" size={16} style={{ color: "var(--secondary)" }} />
            <span style={{ fontSize: 14, fontWeight: 800 }}>Create a session plan</span>
          </div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Plan name</label>
          <input name="name" required placeholder="e.g. Passing patterns - warmup" style={{ ...inputBase, marginBottom: 12 }} />

          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Drills (in order)</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginBottom: 12 }}>
            {approvedDrills.map((d) => (
              <label key={d.id} style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" name="drillIds" value={d.id} /> {d.name} <span style={{ color: "var(--text-faint)" }}>· {d.category} · {d.duration}m</span>
              </label>
            ))}
            {approvedDrills.length === 0 && <span style={{ fontSize: 12, color: "var(--text-faint)" }}>No approved drills in the library yet.</span>}
          </div>

          <button type="submit" style={{ padding: "9px 18px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Create Plan
          </button>
          <p style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 8 }}>Plans start private to you. Use “Share” to request team visibility.</p>
        </form>
      )}

      {/* Pending share approvals */}
      {pendingShares.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 16, margin: "0 0 12px" }}>
            Share requests pending review <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>({pendingShares.length})</span>
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pendingShares.map((r) => {
              const payload = r.payload as { sessionId?: string };
              const session = sessions.find((s) => s.id === payload.sessionId);
              return (
                <div key={r.id} style={{ background: "var(--warning-bg)", border: "1px solid #fde68a", borderRadius: "var(--radius)", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13 }}>
                    <strong>{session?.name ?? "Unknown plan"}</strong> <span style={{ color: "var(--text-muted)" }}>· shared by {r.requestedBy.user.name}</span>
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <form action={approveSessionShare.bind(null, r.id)}>
                      <button type="submit" style={{ padding: "6px 12px", background: "var(--secondary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                        Approve
                      </button>
                    </form>
                    <form action={rejectSessionShare.bind(null, r.id)}>
                      <button type="submit" style={{ padding: "6px 12px", background: "var(--surface)", color: "var(--error)", border: "1px solid var(--error)", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* My plans */}
      <h3 style={{ fontSize: 16, margin: "0 0 12px" }}>
        My plans <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>({mySessions.length})</span>
      </h3>

      {mySessions.length === 0 ? (
        <div style={{ marginBottom: 28 }}>
          <EmptyState
            icon="plan"
            title="No plans yet"
            message="Create your first session plan above from the approved drill library."
          />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
          {mySessions.map((s) => (
            <div key={s.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, boxShadow: "var(--shadow-sm)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <strong style={{ fontSize: 15 }}>{s.name}</strong>
                  {statusBadge(s)}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {s.shareStatus === null && (
                    <form action={shareSession.bind(null, s.id)}>
                      <button type="submit" style={{ padding: "6px 12px", border: "1px solid var(--secondary)", background: "var(--surface)", color: "var(--secondary)", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                        Share
                      </button>
                    </form>
                  )}
                  {s.shareStatus === "REJECTED" && (
                    <form action={shareSession.bind(null, s.id)}>
                      <button type="submit" style={{ padding: "6px 12px", border: "1px solid var(--secondary)", background: "var(--surface)", color: "var(--secondary)", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                        Resubmit
                      </button>
                    </form>
                  )}
                  <ConfirmDeleteButton
                    action={deleteSession.bind(null, s.id)}
                    confirmMessage={`Delete "${s.name}"? This can't be undone.`}
                    label="Delete"
                  />
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                {s.drills.map((sd, i) => (
                  <div key={sd.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "3px 0" }}>
                    <span style={{ color: "var(--text-faint)", width: 18 }}>{i + 1}.</span>
                    <span style={{ flex: 1 }}>{sd.drill.name}</span>
                    <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{sd.drill.category} · {sd.drill.duration}m</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <form action={reorderSessionDrill.bind(null, s.id, sd.drillId, "up")}>
                        <button type="submit" disabled={i === 0} style={{ padding: "2px 8px", fontSize: 12, border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 5, cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.4 : 1 }}>↑</button>
                      </form>
                      <form action={reorderSessionDrill.bind(null, s.id, sd.drillId, "down")}>
                        <button type="submit" disabled={i === s.drills.length - 1} style={{ padding: "2px 8px", fontSize: 12, border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 5, cursor: i === s.drills.length - 1 ? "default" : "pointer", opacity: i === s.drills.length - 1 ? 0.4 : 1 }}>↓</button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Team-shared plans (view-only) */}
      {teamSessions.length > 0 && (
        <div>
          <h3 style={{ fontSize: 16, margin: "0 0 12px" }}>
            Team plans <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>({teamSessions.length})</span>
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {teamSessions.map((s) => (
              <div key={s.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 16px" }}>
                <strong>{s.name}</strong>
                <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>· by {s.createdBy.user.name}</span>
                <div style={{ marginTop: 6, fontSize: 13 }}>
                  {s.drills.map((sd, i) => (
                    <div key={sd.id} style={{ padding: "2px 0" }}>
                      <span style={{ color: "var(--text-faint)", marginRight: 4 }}>{i + 1}.</span> {sd.drill.name}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}