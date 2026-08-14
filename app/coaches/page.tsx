import { prisma } from "@/lib/prisma";
import { createCoach, deleteCoach, updateCoachPermission, revokeSessions, promoteCoach, resetCoachPassword } from "./actions";
import { getPermissions } from "@/lib/permissions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { StatusBanner } from "@/components/StatusBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { inputBase } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";

const PERMISSION_TOGGLES = [
  { field: "canEditRoster", label: "Edit Coach Roster" },
  { field: "canEditDrills", label: "Edit Drills" },
  { field: "canApproveRequests", label: "Approve Drill Suggestions" },
  { field: "canEditSchedule", label: "Edit Schedule" },
  { field: "canEditLocations", label: "Edit Locations" },
  { field: "canEditAgeGroups", label: "Edit Age Groups" },
] as const;

export default async function CoachesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const perms = await getPermissions();
  const [coaches, ageGroups] = await Promise.all([
    prisma.coach.findMany({
      include: { user: true, primaryFocus: true },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.ageGroup.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const canEdit = perms.isAdmin || perms.canEditRoster;
  const fieldLabel: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--text)" };

  return (
    <>
      <PageHeader
        title="Coach Roster"
        subtitle={canEdit ? "Add coaches, set designations, and manage permissions." : "View only — you don't have edit access to the roster. Ask an administrator if you need it."}
      />

      <StatusBanner error={params.error} success={params.success} />

      {canEdit && (
        <form
          action={createCoach}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-sm)",
            padding: 18,
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Icon name="plus" size={16} style={{ color: "var(--secondary)" }} />
            <span style={{ fontSize: 14, fontWeight: 800 }}>Add a coach</span>
          </div>
          <div className="form-grid-2col" style={{ gap: 12 }}>
            <div>
              <label style={fieldLabel}>Name</label>
              <input name="name" required style={inputBase} />
            </div>
            <div>
              <label style={fieldLabel}>Email (this is what they'll log in with)</label>
              <input name="email" type="email" required style={inputBase} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={fieldLabel}>Temporary password</label>
              <input name="password" type="text" required placeholder="Share this with them - they must change it on first login" style={inputBase} />
            </div>
            <div>
              <label style={fieldLabel}>Gender</label>
              <select name="gender" required defaultValue="" style={inputBase}>
                <option value="" disabled>Select gender</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label style={fieldLabel}>Designation</label>
              <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
                <label style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <input type="radio" name="designation" value="HEAD" defaultChecked /> Head Coach
                </label>
                <label style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <input type="radio" name="designation" value="ASSISTANT" /> Assistant Coach
                </label>
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={fieldLabel}>Primary focus</label>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
                {ageGroups.map((ag) => (
                  <label key={ag.id} style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <input type="checkbox" name="primaryFocus" value={ag.id} /> {ag.name}
                  </label>
                ))}
                {ageGroups.length === 0 && <span style={{ fontSize: 12, color: "var(--text-faint)" }}>No age groups seeded yet.</span>}
              </div>
            </div>
          </div>
          <button type="submit" style={{ marginTop: 14, padding: "9px 18px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Add Coach
          </button>
        </form>
      )}

      {coaches.length === 0 ? (
        <EmptyState
          icon="coaches"
          title="No coaches yet"
          message="Add your first coach above to build the roster."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {coaches.map((c) => (
            <div key={c.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <Avatar name={c.user.name} size={38} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 14 }}>{c.user.name}</strong>
                      <Badge tone={c.designation === "HEAD" ? "green" : "blue"}>
                        {c.designation === "HEAD" ? "Head Coach" : "Assistant Coach"}
                      </Badge>
                      {c.gender && <Badge tone="accent">{c.gender === "MALE" ? "Male" : c.gender === "FEMALE" ? "Female" : "Other"}</Badge>}
                    </div>
                    {c.primaryFocus.length > 0 && (
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                        Focus: {c.primaryFocus.map((a) => a.name).join(", ")}
                      </div>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {perms.isAdmin && (
                      <>
                        <form action={resetCoachPassword.bind(null, c.id)}>
                          <button
                            type="submit"
                            title="Reset this coach's password to a temporary value they must change on next login"
                            style={{
                              fontSize: 11,
                              padding: "6px 12px",
                              borderRadius: 8,
                              border: "1px solid var(--border)",
                              background: "var(--surface)",
                              color: "var(--text-muted)",
                              cursor: "pointer",
                            }}
                          >
                            Reset password
                          </button>
                        </form>
                        <form action={revokeSessions.bind(null, c.id)}>
                          <button
                            type="submit"
                            title="Invalidate all of this coach's active sessions so they must log in again"
                            style={{
                              fontSize: 11,
                              padding: "6px 12px",
                              borderRadius: 8,
                              border: "1px solid var(--border)",
                              background: "var(--surface)",
                              color: "var(--text-muted)",
                              cursor: "pointer",
                            }}
                          >
                            Revoke sessions
                          </button>
                        </form>
                      </>
                    )}
                    <ConfirmDeleteButton
                      action={deleteCoach.bind(null, c.id)}
                      confirmMessage={`Remove ${c.user.name} from the roster? This can't be undone.`}
                    />
                  </div>
                )}
              </div>

              {perms.isAdmin && c.designation === "HEAD" && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 8 }}>
                    Permissions
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {PERMISSION_TOGGLES.map((t) => (
                      <form key={t.field} action={updateCoachPermission.bind(null, c.id, t.field, !c[t.field])}>
                        <button
                          type="submit"
                          style={{
                            fontSize: 11,
                            padding: "5px 12px",
                            borderRadius: 20,
                            border: `1px solid ${c[t.field] ? "var(--secondary)" : "var(--border)"}`,
                            background: c[t.field] ? "var(--secondary)" : "#fff",
                            color: c[t.field] ? "#fff" : "var(--text-muted)",
                            cursor: "pointer",
                          }}
                        >
                          {t.label} {c[t.field] ? "✓" : ""}
                        </button>
                      </form>
                    ))}
                  </div>
                </div>
              )}

              {perms.isAdmin && c.designation === "ASSISTANT" && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 4 }}>
                    Promote to head coach
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 10px" }}>
                    Pick which head-coach permissions they should inherit, then promote. Their focus areas are kept.
                  </p>
                  <form action={promoteCoach.bind(null, c.id)} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    {PERMISSION_TOGGLES.map((t) => (
                      <label key={t.field} style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <input type="checkbox" name={t.field} defaultChecked={c[t.field]} /> {t.label}
                      </label>
                    ))}
                    <button
                      type="submit"
                      style={{
                        fontSize: 12,
                        padding: "6px 14px",
                        borderRadius: 8,
                        border: "none",
                        background: "var(--primary)",
                        color: "#fff",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Promote to Head Coach
                    </button>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}