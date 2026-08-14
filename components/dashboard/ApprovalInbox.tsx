// ApprovalInbox - "Requests awaiting approval" section for the dashboard.
// Shown to admins and head coaches who can approve requests. Only surfaces
// requests the current user is actually authorized to act on (chain rules in
// lib/approvals.ts), and the approve/reject actions re-check on submit.

import { getApprovalInbox } from "@/lib/approvals";
import type { Permissions } from "@/lib/permissions";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { approveRequest, rejectRequest } from "./actions";

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
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 18px", borderTop: "1px solid var(--border)" }}
          >
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
        ))}
      </div>
    </section>
  );
}
