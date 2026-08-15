import { prisma } from "@/lib/prisma";
import { createDrill, updateDrill, addFeedback, approveDrill, rejectDrill } from "./actions";
import { getPermissions } from "@/lib/permissions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { StatusBanner } from "@/components/StatusBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { inputBase } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";

const CATEGORIES = ["Warm-up", "Passing", "Dribbling", "Shooting", "Defending", "Fun Game"];

export default async function DrillsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const perms = await getPermissions();
  const canSuggest = perms.canSuggestDrills;
  const canApprove = perms.isAdmin || perms.canApproveRequests;
  const canPublishEdit = perms.canEditDrills;

  const [drills, ageGroups] = await Promise.all([
    prisma.drill.findMany({
      include: { createdBy: { include: { user: true } }, ageGroups: true, feedback: { include: { author: { include: { user: true } } }, orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.ageGroup.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const approved = drills.filter((d) => d.status === "APPROVED");
  const pending = drills.filter((d) => d.status === "PENDING");

  const fieldLabel: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--text)" };

  return (
    <>
      <PageHeader
        title="Drill Library"
        subtitle={canPublishEdit ? "Publish drills straight into the library and edit existing ones." : canSuggest ? "Suggest drills for the team library." : "Only coaches can suggest drills. You can still view the library and pending queue below."}
      />

      <StatusBanner error={params.error} success={params.success} />

      {canSuggest && (
        <details
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-sm)",
            padding: 14,
            marginBottom: 28,
          }}
        >
          <summary
            style={{
              cursor: "pointer",
              listStyle: "none",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              fontWeight: 800,
              userSelect: "none",
            }}
          >
            <Icon name="plus" size={16} style={{ color: "var(--secondary)" }} />
            {canPublishEdit ? "Add a drill" : "Suggest a drill"}
          </summary>
          <form
            action={createDrill}
            style={{
              paddingTop: 14,
            }}
          >
          <div className="form-grid-2col" style={{ gap: 12 }}>
            <div>
              <label style={fieldLabel}>Name</label>
              <input name="name" required style={inputBase} />
            </div>
            <div>
              <label style={fieldLabel}>Category</label>
              <select name="category" required style={inputBase}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={fieldLabel}>Duration (minutes)</label>
              <input name="duration" type="number" defaultValue={10} required style={inputBase} />
            </div>
            <div>
              <label style={fieldLabel}>Player range</label>
              <input name="playerRange" placeholder="e.g. 4-12" style={inputBase} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={fieldLabel}>Description</label>
              <textarea name="description" style={{ ...inputBase, minHeight: 70, resize: "vertical" }} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={fieldLabel}>Age groups</label>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
                {ageGroups.map((ag) => (
                  <label key={ag.id} style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <input type="checkbox" name="ageGroups" value={ag.id} /> {ag.name}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <button type="submit" style={{ marginTop: 14, padding: "9px 18px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            {canPublishEdit ? "Publish Drill" : "Suggest Drill"}
          </button>
          <p style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 8 }}>
            {canPublishEdit
              ? "Published drills join the library immediately."
              : "All new drills go to Pending Approval below — nothing joins the library automatically."}
          </p>
          </form>
        </details>
      )}

      <h3 style={{ fontSize: 16, margin: "0 0 12px" }}>
        Pending Approval <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>({pending.length})</span>
      </h3>

      {pending.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 28 }}>Nothing waiting on review.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
          {pending.map((d) => (
            <div key={d.id} style={{ background: "var(--warning-bg)", border: "1px solid #fde68a", borderRadius: "var(--radius)", padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 14 }}>{d.name}</strong>
                    <Badge tone="warning">Pending</Badge>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                    {d.category} · {d.duration}m · submitted by {d.createdBy.user.name}
                    {d.ageGroups.length > 0 && ` · ${d.ageGroups.map((a) => a.name).join(", ")}`}
                  </div>
                  {d.description && <p style={{ fontSize: 13, margin: "6px 0 0", color: "var(--text)" }}>{d.description}</p>}
                </div>
                {canApprove && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <form action={approveDrill.bind(null, d.id)}>
                      <button type="submit" style={{ padding: "6px 12px", background: "var(--secondary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                        Approve
                      </button>
                    </form>
                    <ConfirmDeleteButton
                      action={rejectDrill.bind(null, d.id)}
                      confirmMessage={`Reject "${d.name}"? This deletes the suggestion and its feedback thread permanently.`}
                      label="Reject"
                    />
                  </div>
                )}
              </div>

              {d.feedback.length > 0 && (
                <div style={{ marginTop: 10, background: "var(--surface)", borderRadius: 8, padding: 10 }}>
                  {d.feedback.map((f) => (
                    <div key={f.id} style={{ fontSize: 12, marginBottom: 4 }}>
                      <strong>{f.author.user.name}:</strong> {f.message}
                    </div>
                  ))}
                </div>
              )}

              {canSuggest && (
                <form action={addFeedback.bind(null, d.id)} style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <input name="message" placeholder="Add feedback..." required style={{ ...inputBase, flex: 1, fontSize: 12 }} />
                  <button type="submit" style={{ padding: "7px 14px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                    Send
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      <h3 style={{ fontSize: 16, margin: "0 0 12px" }}>
        Library <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>({approved.length})</span>
      </h3>

      {approved.length === 0 ? (
        <EmptyState
          icon="drills"
          title="No approved drills yet"
          message="Approved suggestions will appear here and become available in session plans."
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
          {approved.map((d) => (
            <div key={d.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--surface-muted)", color: "var(--secondary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon name="drills" size={15} />
                </span>
                <strong style={{ fontSize: 13.5 }}>{d.name}</strong>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                {d.category} · {d.duration}m · {d.ageGroups.map((a) => a.name).join(", ")}
              </div>
              {canPublishEdit && (
                <details style={{ marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                  <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, color: "var(--secondary)", outline: "none" }}>Edit</summary>
                  <form action={updateDrill.bind(null, d.id)} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                    <input name="name" defaultValue={d.name} required style={{ ...inputBase, fontSize: 12.5, padding: "6px 9px" }} />
                    <div style={{ display: "flex", gap: 6 }}>
                      <select name="category" defaultValue={d.category} required style={{ ...inputBase, fontSize: 12.5, padding: "6px 9px", flex: 1 }}>
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <input name="duration" type="number" defaultValue={d.duration} required style={{ ...inputBase, fontSize: 12.5, padding: "6px 9px", width: 70 }} />
                    </div>
                    <input name="playerRange" defaultValue={d.playerRange ?? ""} placeholder="Player range" style={{ ...inputBase, fontSize: 12.5, padding: "6px 9px" }} />
                    <textarea name="description" defaultValue={d.description ?? ""} placeholder="Description" style={{ ...inputBase, fontSize: 12.5, padding: "6px 9px", minHeight: 54, resize: "vertical" }} />
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {ageGroups.map((ag) => (
                        <label key={ag.id} style={{ fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <input type="checkbox" name="ageGroups" value={ag.id} defaultChecked={d.ageGroups.some((a) => a.id === ag.id)} /> {ag.name}
                        </label>
                      ))}
                    </div>
                    <button type="submit" style={{ alignSelf: "flex-start", padding: "6px 14px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                      Save
                    </button>
                  </form>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}