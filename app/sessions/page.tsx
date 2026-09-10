import { prisma } from "@/lib/prisma";
import { createSession, deleteSession, shareSession, approveSessionShare, rejectSessionShare, reorderSessionDrill } from "./actions";
import { getPermissions } from "@/lib/permissions";
import { getApprovalDetail } from "@/lib/approvals";
import { addApprovalMessage } from "@/components/dashboard/actions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { StatusBanner } from "@/components/StatusBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CollapsibleCreate } from "@/components/ui/CollapsibleCreate";
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
      drills: { include: { drill: { include: { category: true } } }, orderBy: { order: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  const approvedDrills = await prisma.drill.findMany({
    where: { status: "APPROVED", archivedAt: null },
    include: { category: true },
    orderBy: { name: "asc" },
  });

  // Pending share requests this user can act on. Each one is enriched with
  // the plan content + conversation via getApprovalDetail - that resolves the
  // plan straight from the payload, so a plan that's still PENDING (and thus
  // filtered out of the "sessions" list above) shows its real name and drills
  // instead of "Unknown plan".
  const pendingShares = canApprove
    ? await Promise.all(
        (
          await prisma.approvalRequest.findMany({
            where: { type: "SESSION_SHARE", status: "PENDING" },
            include: { requestedBy: { include: { user: true } } },
            orderBy: { createdAt: "asc" },
          })
        ).map(async (r) => ({ request: r, detail: await getApprovalDetail(r.id) }))
      )
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
        title="Session Plans"
        subtitle={canSuggest ? "Build training plans from the approved drill library." : "Only coaches can create session plans. You can still view shared ones below."}
      />

      <StatusBanner error={params.error} success={params.success} />

      {canSuggest && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <CollapsibleCreate title="Create a session plan" style={{ width: "100%", maxWidth: 640, marginBottom: 0 }}>
            <form action={createSession}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 5 }}>Plan name</label>
              <input name="name" required placeholder="e.g. Passing patterns - warmup" style={{ ...inputBase, marginBottom: 14 }} />

              <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 5 }}>Drills (in order)</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginBottom: 12, background: "var(--surface-muted)" }}>
                {approvedDrills.map((d) => (
                  <label key={d.id} style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <input type="checkbox" name="drillIds" value={d.id} /> {d.name} <span style={{ color: "var(--text-faint)" }}>· {d.category.name} · {d.duration}m</span>
                  </label>
                ))}
                {approvedDrills.length === 0 && <span style={{ fontSize: 12, color: "var(--text-faint)" }}>No approved drills in the library yet.</span>}
              </div>

              <button type="submit" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "var(--shadow-sm)" }}>
                <Icon name="plus" size={15} /> Create Plan
              </button>
              <p style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 8 }}>Plans start private to you. Use “Share” to request team visibility.</p>
            </form>
          </CollapsibleCreate>
        </div>
      )}

      {/* Pending share approvals */}
      {pendingShares.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
            <h3 style={{ fontFamily: "var(--font-headline)", fontSize: 22, fontWeight: 600, color: "var(--primary)", margin: 0 }}>
              Share requests pending review
            </h3>
            <span style={{ fontSize: 13, color: "var(--text-faint)", fontWeight: 600 }}>({pendingShares.length})</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pendingShares.map(({ request: r, detail }) => {
              if (!detail) return null;
              return (
                <div key={r.id} style={{ background: "var(--warning-bg)", border: "1px solid #fde68a", borderRadius: "var(--radius-lg)", padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13 }}>
                      <strong>{detail.detail}</strong> <span style={{ color: "var(--text-muted)" }}>· shared by {r.requestedBy.user.name}</span>
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

                  {/* Expandable plan content + conversation */}
                  <details style={{ marginTop: 10, borderRadius: 8, background: "var(--surface)", padding: "0 12px" }}>
                    <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "var(--secondary)", padding: "9px 0", outline: "none" }}>
                      View plan & conversation {detail.messages.length > 0 ? `(${detail.messages.length})` : ""}
                    </summary>
                    <div style={{ padding: "0 0 12px", fontSize: 13 }}>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>Drills in this plan</div>
                      <ul style={{ margin: "0 0 12px", paddingLeft: 18 }}>
                        {detail.content.map((line, i) => (
                          <li key={i} style={{ marginBottom: 3 }}>{line}</li>
                        ))}
                      </ul>

                      {detail.messages.length > 0 && (
                        <>
                          <div style={{ fontWeight: 700, marginBottom: 6 }}>Conversation</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                            {detail.messages.map((m) => (
                              <div key={m.id} style={{ fontSize: 12.5, background: "var(--surface-muted)", borderRadius: 8, padding: "7px 10px" }}>
                                <strong>{m.authorName}:</strong> {m.message}
                                <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
                                  {m.createdAt.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      <form action={addApprovalMessage.bind(null, r.id)} style={{ display: "flex", gap: 6 }}>
                        <input name="message" placeholder="Suggest changes or send feedback..." required style={{ flex: 1, fontSize: 12.5, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)" }} />
                        <button type="submit" style={{ padding: "8px 14px", background: "var(--secondary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
                          Send
                        </button>
                      </form>
                    </div>
                  </details>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* My plans */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
        <h3 style={{ fontFamily: "var(--font-headline)", fontSize: 24, fontWeight: 600, color: "var(--primary)", margin: 0 }}>
          My plans
        </h3>
        <span style={{ fontSize: 13, color: "var(--text-faint)", fontWeight: 600 }}>({mySessions.length})</span>
      </div>

      {mySessions.length === 0 ? (
        <div style={{ marginBottom: 28 }}>
          <EmptyState
            icon="plan"
            title="No plans yet"
            message="Create your first session plan above from the approved drill library."
          />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16, marginBottom: 28 }}>
          {mySessions.map((s) => {
            const totalMins = s.drills.reduce((sum, sd) => sum + sd.drill.duration, 0);
            return (
            <div key={s.id} style={{ position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 18, boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column" }}>
              <div style={{ position: "absolute", top: 0, right: 0, width: 96, height: 96, background: "var(--surface-muted)", borderBottomLeftRadius: Math.round(96 / 2), opacity: 0.6 }} aria-hidden="true" />
              <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <div>{statusBadge(s)}</div>
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

              <h4 style={{ fontFamily: "var(--font-headline)", fontSize: 20, fontWeight: 600, color: "var(--primary)", lineHeight: 1.2, marginBottom: 6, position: "relative" }}>{s.name}</h4>

              <div style={{ display: "flex", alignItems: "center", gap: 16, color: "var(--text-muted)", marginBottom: 12, position: "relative", fontSize: 13 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Icon name="clock" size={15} /> {totalMins}m
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Icon name="drills" size={15} /> {s.drills.length} Drill{s.drills.length === 1 ? "" : "s"}
                </span>
              </div>

              <div style={{ width: "100%", height: 6, background: "var(--surface-high)", borderRadius: 999, overflow: "hidden", display: "flex", gap: 4, marginBottom: 12, position: "relative" }}>
                {s.drills.length > 0 ? (
                  s.drills.map((sd, i) => (
                    <div key={sd.id} style={{ flex: 1, background: i % 3 === 1 ? "var(--secondary-fixed-dim)" : "var(--surface-tint)", height: "100%", borderRadius: 999 }} />
                  ))
                ) : (
                  <div style={{ flex: 1, background: "var(--surface-highest)", height: "100%" }} />
                )}
              </div>

              <div style={{ marginTop: "auto", borderTop: "1px solid var(--border)", paddingTop: 10, position: "relative" }}>
                {s.drills.map((sd, i) => (
                  <div key={sd.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "4px 0" }}>
                    <span style={{ color: "var(--text-faint)", width: 18, fontFamily: "var(--font-mono-label)", fontWeight: 700 }}>{i + 1}.</span>
                    <span style={{ flex: 1 }}>{sd.drill.name}</span>
                    <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{sd.drill.category.name} · {sd.drill.duration}m</span>
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
            );
          })}
        </div>
      )}

      {/* Team-shared plans (view-only) */}
      {teamSessions.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
            <h3 style={{ fontFamily: "var(--font-headline)", fontSize: 24, fontWeight: 600, color: "var(--primary)", margin: 0 }}>
              Team plans
            </h3>
            <span style={{ fontSize: 13, color: "var(--text-faint)", fontWeight: 600 }}>({teamSessions.length})</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {teamSessions.map((s) => (
              <div key={s.id} style={{ position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 18, boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column" }}>
                <div style={{ position: "absolute", top: 0, right: 0, width: 80, height: 80, background: "var(--surface-muted)", borderBottomLeftRadius: 40, opacity: 0.6 }} aria-hidden="true" />
                <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                  <Badge tone="green">Team</Badge>
                  <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>by {s.createdBy.user.name}</span>
                </div>
                <h4 style={{ fontFamily: "var(--font-headline)", fontSize: 20, fontWeight: 600, color: "var(--primary)", lineHeight: 1.2, marginBottom: 8, position: "relative" }}>{s.name}</h4>
                <div style={{ marginTop: "auto", borderTop: "1px solid var(--border)", paddingTop: 10, position: "relative" }}>
                  {s.drills.map((sd, i) => (
                    <div key={sd.id} style={{ padding: "3px 0", fontSize: 13 }}>
                      <span style={{ color: "var(--text-faint)", marginRight: 6, fontFamily: "var(--font-mono-label)", fontWeight: 700 }}>{i + 1}.</span> {sd.drill.name}
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