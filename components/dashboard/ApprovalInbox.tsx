// ApprovalInbox - "Requests awaiting approval" section for the dashboard.
// Shown to admins and head coaches who can approve requests. Only surfaces
// requests the current user is actually authorized to act on (chain rules in
// lib/approvals.ts), and the approve/reject actions re-check on submit.
//
// Each item can be expanded to see the full content being approved plus the
// feedback conversation. Approvers can leave suggestions/changes feedback on
// the thread; the requester replies from their "My Requests" section.

import { getApprovalInbox } from "@/lib/approvals";
import type { Permissions } from "@/lib/permissions";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { approveRequest, rejectRequest, addApprovalMessage } from "./actions";

const TYPE_LABEL: Record<string, string> = {
  ATTENDANCE_CONFIRM: "Attendance proposal",
  SESSION_SHARE: "Session plan share",
};

export async function ApprovalInbox({ perms }: { perms: Permissions }) {
  const requests = await getApprovalInbox(perms);
  if (requests.length === 0) return null;

  return (
    <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "4px 0", boxShadow: "var(--shadow-sm)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px" }}>
        <h2 style={{ fontSize: 17, fontWeight: 700 }}>Requests awaiting approval</h2>
        <Badge tone="warning">{requests.length} pending</Badge>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {requests.map((r) => (
          <div
            key={r.id}
            style={{ padding: "12px 18px", borderTop: "1px solid var(--border)" }}
          >
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
                  <Icon name={r.type === "SESSION_SHARE" ? "sessions" : "attendance"} size={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{TYPE_LABEL[r.type]}</span>
                    <Badge tone={r.type === "SESSION_SHARE" ? "blue" : "green"}>{r.type === "SESSION_SHARE" ? "Share" : "Attendance"}</Badge>
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
    </section>
  );
}