// MyRequests - "My requests" section on the coach dashboard. Lists requests
// the logged-in coach submitted (any status), shows what they contain, the
// feedback conversation, and lets them reply to approver feedback until the
// request is resolved.

import { getMyRequests, requestCategory } from "@/lib/approvals";
import type { Permissions } from "@/lib/permissions";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { StatusPill } from "@/components/ui/StatusPill";
import { addApprovalMessage } from "./actions";

const TYPE_ICON: Record<string, string> = {
  ATTENDANCE_CONFIRM: "attendance",
  SESSION_SHARE: "sessions",
  DRILL_ADD: "drills",
  DRILL_EDIT: "drills",
  SCHEDULE_CREATE: "calendar",
  SKILL_UPDATE: "trendUp",
};

const STATUS_TONE: Record<string, "pending" | "approved" | "rejected"> = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
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
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-headline)", fontSize: 22, fontWeight: 600, color: "var(--primary)" }}>My requests</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-muted)" }}>Track the status of your submitted requests and reply to feedback.</p>
        </div>
        <Badge tone="muted">{requests.length}</Badge>
      </div>

      {requests.length === 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 18px", fontSize: 13, color: "var(--text-muted)" }}>
          No requests yet. When you suggest a drill, confirm attendance, or request to share a session plan, it will show up here with its status and any feedback from approvers.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {requests.map((r) => (
          <div key={r.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <Icon name={TYPE_ICON[r.type] ?? "attendance"} size={16} style={{ color: "var(--text-muted)" }} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                  {requestCategory(r.type)}
                </span>
              </div>
              <StatusPill tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</StatusPill>
            </div>

            <div>
              <h3 style={{ fontFamily: "var(--font-headline)", fontSize: 18, fontWeight: 600, lineHeight: 1.2, color: "var(--primary)", margin: 0 }}>{r.detail}</h3>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0" }}>
                Submitted {r.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                {r.resolvedAt ? ` · resolved ${r.resolvedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}
              </p>
            </div>

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
              <details style={{ borderRadius: 8 }}>
                <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, color: "var(--secondary)", outline: "none" }}>
                  View content & conversation {r.messages.length > 0 ? `(${r.messages.length})` : ""}
                </summary>
                <div style={{ padding: "12px 0 0", fontSize: 13 }}>
                  <ul style={{ margin: "0 0 12px", paddingLeft: 18 }}>
                    {r.content.map((line, i) => (
                      <li key={i} style={{ marginBottom: 3 }}>{line}</li>
                    ))}
                  </ul>

                  {r.messages.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                      {r.messages.map((m) => (
                        <div key={m.id} style={{ fontSize: 12.5, background: "var(--surface-muted)", borderRadius: 8, padding: "7px 10px" }}>
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
                      <button type="submit" style={{ padding: "8px 14px", background: "var(--secondary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>
                        Reply
                      </button>
                    </form>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--text-faint)" }}>This request is {STATUS_LABEL[r.status].toLowerCase()} — no further replies.</div>
                  )}
                </div>
              </details>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
