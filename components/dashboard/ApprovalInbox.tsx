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
import { StatusPill } from "@/components/ui/StatusPill";
import { approveRequest, rejectRequest, addApprovalMessage } from "./actions";

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
    <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "18px 20px", borderBottom: "1px solid var(--border)" }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-headline)", fontSize: 22, fontWeight: 600, color: "var(--primary)" }}>Requests awaiting approval</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-muted)" }}>Review and manage academy requests.</p>
        </div>
        <StatusPill tone="pending">{total} pending</StatusPill>
      </div>
      {groups.map((group) => (
        <div key={group.label} style={{ borderTop: "1px solid var(--border)" }}>
          <div style={{ padding: "10px 20px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-faint)", background: "var(--surface-muted)" }}>
            {group.label} <span style={{ fontWeight: 600 }}>({group.items.length})</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {group.items.map((r) => (
              <div key={r.id} style={{ padding: "14px 20px", borderTop: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 14, minWidth: 0, flex: "1 1 280px" }}>
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 10,
                        background: "var(--surface-muted)",
                        color: "var(--secondary)",
                        border: "1px solid var(--border)",
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
                        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                          {requestCategory(r.type)}
                        </span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginTop: 2 }}>{r.detail}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                        <span
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            background: "var(--primary)",
                            color: "#fff",
                            fontSize: 9,
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {(r.requesterName.match(/\b\w/g) ?? []).slice(0, 2).join("").toUpperCase()}
                        </span>
                        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{r.requesterName}</span>
                        <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
                          · {r.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      {r.summary ? <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginTop: 4 }}>{r.summary}</div> : null}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <StatusPill tone="pending">Pending</StatusPill>
                    <form action={approveRequest.bind(null, r.id)}>
                      <button
                        type="submit"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "7px 14px",
                          background: "var(--secondary)",
                          color: "#fff",
                          borderRadius: 8,
                          fontWeight: 600,
                          fontSize: 12.5,
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
                          color: "var(--error)",
                          borderRadius: 8,
                          fontWeight: 600,
                          fontSize: 12.5,
                          border: "1px solid var(--border)",
                          cursor: "pointer",
                        }}
                      >
                        <Icon name="x" size={14} /> Reject
                      </button>
                    </form>
                  </div>
                </div>

                {r.full && (
                  <details style={{ marginTop: 12, borderRadius: 8, background: "var(--surface-muted)", padding: "0 12px" }}>
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
                        <button type="submit" style={{ padding: "8px 14px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>
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
