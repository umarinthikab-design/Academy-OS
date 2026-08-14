// MyRequests - "My requests" section on the coach dashboard. Lists requests
// the logged-in coach submitted (any status), shows what they contain, the
// feedback conversation, and lets them reply to approver feedback until the
// request is resolved.

import { getMyRequests } from "@/lib/approvals";
import type { Permissions } from "@/lib/permissions";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { addApprovalMessage } from "./actions";

const TYPE_LABEL: Record<string, string> = {
  ATTENDANCE_CONFIRM: "Attendance proposal",
  SESSION_SHARE: "Session plan share",
};

const STATUS_TONE: Record<string, string> = {
  PENDING: "warning",
  APPROVED: "green",
  REJECTED: "error",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export async function MyRequests({ perms }: { perms: Permissions }) {
  const requests = await getMyRequests(perms);
  // Only coaches submit requests - admins and parents have no coach row.
  if (!perms.coachId) return null;

  return (
    <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "4px 0", boxShadow: "var(--shadow-sm)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px" }}>
        <h2 style={{ fontSize: 17, fontWeight: 700 }}>My requests</h2>
        <Badge tone="muted">{requests.length}</Badge>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {requests.length === 0 && (
          <div style={{ padding: "14px 18px", borderTop: "1px solid var(--border)", fontSize: 12.5, color: "var(--text-muted)" }}>
            No requests yet. When you suggest a drill, confirm attendance, or request to share a session plan, it will show up here with its status and any feedback from approvers.
          </div>
        )}
        {requests.map((r) => (
          <div key={r.id} style={{ padding: "12px 18px", borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: r.status === "APPROVED" ? "var(--success-bg)" : r.status === "REJECTED" ? "var(--error-bg)" : "var(--warning-bg)",
                    color: r.status === "APPROVED" ? "var(--secondary)" : r.status === "REJECTED" ? "#b91c1c" : "#92400e",
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
                    <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                    <strong style={{ color: "var(--text)" }}>{r.detail}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>
                    Submitted {r.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    {r.resolvedAt ? ` · resolved ${r.resolvedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}
                  </div>
                </div>
              </div>
            </div>

            <details style={{ marginTop: 10, borderRadius: 8, background: "var(--surface-muted)", padding: "0 12px" }}>
              <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "var(--secondary)", padding: "9px 0", outline: "none" }}>
                View content & conversation {r.messages.length > 0 ? `(${r.messages.length})` : ""}
              </summary>
              <div style={{ padding: "0 0 12px", fontSize: 13 }}>
                <ul style={{ margin: "0 0 12px", paddingLeft: 18 }}>
                  {r.content.map((line, i) => (
                    <li key={i} style={{ marginBottom: 3 }}>{line}</li>
                  ))}
                </ul>

                {r.messages.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                    {r.messages.map((m) => (
                      <div key={m.id} style={{ fontSize: 12.5, background: "var(--surface)", borderRadius: 8, padding: "7px 10px" }}>
                        <strong>{m.authorName}:</strong> {m.message}
                        <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
                          {m.createdAt.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {r.status === "PENDING" ? (
                  <form action={addApprovalMessage.bind(null, r.id)} style={{ display: "flex", gap: 6 }}>
                    <input name="message" placeholder="Reply to feedback..." required style={{ flex: 1, fontSize: 12.5, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)" }} />
                    <button type="submit" style={{ padding: "8px 14px", background: "var(--secondary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
                      Reply
                    </button>
                  </form>
                ) : (
                  <div style={{ fontSize: 12, color: "var(--text-faint)" }}>This request is {STATUS_LABEL[r.status].toLowerCase()} — no further replies.</div>
                )}
              </div>
            </details>
          </div>
        ))}
      </div>
    </section>
  );
}