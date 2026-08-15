// ApprovalInbox - "Requests awaiting approval" section for the dashboard.
// Shown to admins and head coaches who can approve requests. Only surfaces
// requests the current user is actually authorized to act on (chain rules in
// lib/approvals.ts), and the approve/reject actions re-check on submit.
//
// Requests are grouped by type into named sections (see REQUEST_CATEGORIES) -
// a section only renders when it has at least one item. Each item can be
// expanded to see the full content being approved plus the feedback
// conversation. Approvers can leave suggestions/changes feedback on the
// thread; the requester replies from their "My Requests" section.

import { getApprovalInbox, REQUEST_CATEGORIES, requestCategory } from "@/lib/approvals";
import type { Permissions } from "@/lib/permissions";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { approveRequest, rejectRequest, addApprovalMessage } from "./actions";

const TYPE_LABEL: Record<string, string> = {
  ATTENDANCE_CONFIRM: "Attendance proposal",
  SESSION_SHARE: "Session plan share",
  DRILL_ADD: "Drill suggestion",
  DRILL_EDIT: "Drill edit",
  SCHEDULE_CREATE: "Schedule change",
  SKILL_UPDATE: "Skill update",
};

const TYPE_ICON: Record<string, string> = {
  ATTENDANCE_CONFIRM: "attendance",
  SESSION_SHARE: "sessions",
  DRILL_ADD: "drills",
  DRILL_EDIT: "drills",
  SCHEDULE_CREATE: "calendar",
  SKILL_UPDATE: "trendUp",
};

export async function ApprovalInbox({ perms }: { perms: Permissions }) {
  const requests = await getApprovalInbox(perms);
  if (requests.length === 0) return null;

  const groups = REQUEST_CATEGORIES.map((cat) => ({
    label: cat.label,
    items: requests.filter((r) => cat.types.includes(r.type)),
  })).filter((g) => g.items.length > 0);

  const total = requests.length;

  return (
    <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "4px 0", boxShadow: "var(--shadow-sm)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px" }}>
        <h2 style={{ fontSize: 17, fontWeight: 700 }}>Requests awaiting approval</h2>
        <Badge tone="warning">{total} pending</Badge>
      </div>
      {groups.map((group) => (
        <div key={group.label} style={{ borderTop: "1px solid var(--border)" }}>
          <div style={{ padding: "10px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-faint)", background: "var(--surface-muted)" }}>
            {group.label} <span style={{ fontWeight: 600 }}>({group.items.length})</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {group.items.map((r) => (
              <div key={r.id} style={{ padding: "12px 18px", borderTop: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: "var(--warning-bg)",
                        color: "#92400e",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon name={TYPE_ICON[r.type] ?? "attendance"} size={18} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{TYPE_LABEL[r.type] ?? requestCategory(r.type)}</span>
                        <Badge tone={r.type === "SESSION_SHARE" ? "blue" : r.type === "ATTENDANCE_CONFIRM" ? "green" : "accent"}>
                          {requestCategory(r.type)}
                        </Badge>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                        <strong style={{ color: "var(--text)" }}>{r.detail}</strong>
                        {r.summary ? <span> · {r.summary}</span> : null}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>
                        Requested by {r.requesterName} · {r.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <form action={approveRequest.bind(null, r.id)}>
                      <button
                        type="submit"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "7px 14px",
                          background: "var(--primary)",
                          color: "#fff",
                          borderRadius: 8,
                          fontWeight: 700,
                          fontSize: 13,
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        <Icon name="check" size={14} /> Approve
                      </button>
                    </form>
                    <form action={rejectRequest.bind(null, r.id)}>
                      <button
                        type="submit"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "7px 14px",
                          background: "var(--surface-muted)",
                          color: "var(--text-muted)",
                          borderRadius: 8,
                          fontWeight: 700,
                          fontSize: 13,
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Reject
                      </button>
                    </form>
                  </div>
                </div>

                {/* Expandable detail + conversation */}
                {r.full && (
                  <details style={{ marginTop: 10, borderRadius: 8, background: "var(--surface-muted)", padding: "0 12px" }}>
                    <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "var(--secondary)", padding: "9px 0", outline: "none" }}>
                      View content & conversation {r.full.messages.length > 0 ? `(${r.full.messages.length})` : ""}
                    </summary>
                    <div style={{ padding: "0 0 12px", fontSize: 13 }}>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>What's being approved</div>
                      <ul style={{ margin: "0 0 12px", paddingLeft: 18 }}>
                        {r.full.content.map((line, i) => (
                          <li key={i} style={{ marginBottom: 3 }}>{line}</li>
                        ))}
                      </ul>

                      {r.full.messages.length > 0 && (
                        <>
                          <div style={{ fontWeight: 700, marginBottom: 6 }}>Conversation</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                            {r.full.messages.map((m) => (
                              <div key={m.id} style={{ fontSize: 12.5, background: "var(--surface)", borderRadius: 8, padding: "7px 10px" }}>
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
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
