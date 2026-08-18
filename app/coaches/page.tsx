import { prisma } from "@/lib/prisma";
import { createCoach, deleteCoach, updateCoachPermission, revokeSessions, promoteCoach, resetCoachPassword, archiveCoach, reactivateCoach, archiveStaffMember, reactivateStaffMember } from "./actions";
import { getPermissions } from "@/lib/permissions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { StatusBanner } from "@/components/StatusBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { EntityHero } from "@/components/ui/EntityHero";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CollapsibleCreate } from "@/components/ui/CollapsibleCreate";
import { CoachCreateFields } from "@/components/ui/CoachCreateFields";
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
  const canManageStaff = perms.isAdmin || perms.isClubManager;
  const [coaches, staff, ageGroups] = await Promise.all([
    prisma.coach.findMany({
      include: { user: true, primaryFocus: true },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.user.findMany({
      where: { role: "CLUB_MANAGER" },
      orderBy: { name: "asc" },
    }),
    prisma.ageGroup.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  // Which coaches are blocked from deletion (they've created drills, left
  // feedback, or authored session plans)? Those get "Archive" as their action
  // instead of "Remove".
  const inUseByCoach = new Map<string, boolean>();
  if (coaches.length > 0) {
    const ids = coaches.map((c) => c.id);
    const [drillRows, feedbackRows, sessionRows] = await Promise.all([
      prisma.drill.findMany({ where: { createdById: { in: ids } }, select: { createdById: true } }),
      prisma.drillFeedback.findMany({ where: { authorId: { in: ids } }, select: { authorId: true } }),
      prisma.session.findMany({ where: { createdById: { in: ids } }, select: { createdById: true } }),
    ]);
    for (const c of coaches) {
      inUseByCoach.set(
        c.id,
        drillRows.some((r) => r.createdById === c.id) ||
          feedbackRows.some((r) => r.authorId === c.id) ||
          sessionRows.some((r) => r.createdById === c.id)
      );
    }
  }

  const active = coaches.filter((c) => !c.user.archivedAt);
  const archived = coaches.filter((c) => c.user.archivedAt);
  const staffActive = staff.filter((s) => !s.archivedAt);
  const staffArchived = staff.filter((s) => s.archivedAt);

  const canEdit = perms.isAdmin || perms.canEditRoster;

  return (
    <>
      <PageHeader
        title="Coach Roster"
        subtitle={canEdit ? "Add coaches, set designations, and manage permissions." : "View only — you don't have edit access to the roster. Ask an administrator if you need it."}
      />

      <StatusBanner error={params.error} success={params.success} />

      {canEdit && (
        <CollapsibleCreate title="Add a coach">
          <form action={createCoach}>
            <CoachCreateFields ageGroups={ageGroups} />
            <button type="submit" style={{ marginTop: 14, padding: "9px 18px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              Add Coach
            </button>
          </form>
        </CollapsibleCreate>
      )}

      {coaches.length === 0 ? (
        <EmptyState
          icon="coaches"
          title="No coaches yet"
          message="Add your first coach above to build the roster."
        />
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {active.length === 0 && (
              <EmptyState icon="coaches" title="No active coaches" message="Archived coaches are listed below." />
            )}
            {active.map((c) => (
              <div key={c.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <EntityHero
                    name={c.user.name}
                    src={c.user.photoUrl}
                    size={38}
                    badges={
                      <>
                        <Badge tone={c.designation === "HEAD" ? "green" : "blue"}>
                          {c.designation === "HEAD" ? "Head Coach" : "Assistant Coach"}
                        </Badge>
                        {c.gender && <Badge tone="accent">{c.gender === "MALE" ? "Male" : c.gender === "FEMALE" ? "Female" : "Other"}</Badge>}
                      </>
                    }
                    subtitle={
                      c.primaryFocus.length > 0 ? (
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                          Focus: {c.primaryFocus.map((a) => a.name).join(", ")}
                        </div>
                      ) : undefined
                    }
                    actions={
                      canEdit ? (
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {canManageStaff && (
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
                          {inUseByCoach.get(c.id) ? (
                            <ConfirmDeleteButton
                              action={archiveCoach.bind(null, c.id)}
                              label="Archive"
                              confirmMessage={`Archive ${c.user.name}? They'll be logged out and removed from active scheduling, but their history stays intact.`}
                            />
                          ) : (
                            <ConfirmDeleteButton
                              action={deleteCoach.bind(null, c.id)}
                              confirmMessage={`Remove ${c.user.name} from the roster? This can't be undone.`}
                            />
                          )}
                        </div>
                      ) : undefined
                    }
                  />
                </div>

                {canManageStaff && c.designation === "HEAD" && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 8 }}>
                      Permissions
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginLeft: -12 }}>
                      {PERMISSION_TOGGLES.map((t) => (
                        <form key={t.field} action={updateCoachPermission.bind(null, c.id, t.field, !c[t.field])}>
                          <button
                            type="submit"
                            style={{
                              fontSize: 11,
                              padding: "5px 12px",
                              borderRadius: 20,
                              border: `1px solid ${c[t.field] ? "var(--secondary)" : "var(--border)"}`,
                              background: c[t.field] ? "var(--secondary)" : "var(--surface)",
                              color: c[t.field] ? "#fff" : "var(--text)",
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

                {canManageStaff && c.designation === "ASSISTANT" && (
                  <CollapsibleCreate
                    title="Promote to head coach"
                    style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", boxShadow: "none", marginBottom: 0 }}
                  >
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
                  </CollapsibleCreate>
                )}
              </div>
            ))}
          </div>

          {archived.length > 0 && (
            <details style={{ marginTop: 28, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 14 }}>
              <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 800, userSelect: "none" }}>
                <Icon name="coaches" size={15} style={{ color: "var(--text-muted)" }} />
                Archived coaches
                <Badge tone="muted">{archived.length}</Badge>
              </summary>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
                {archived.map((c) => (
                  <div key={c.id} style={{ background: "var(--surface-muted)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 14, opacity: 0.75 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <EntityHero
                        name={c.user.name}
                        src={c.user.photoUrl}
                        size={38}
                        badges={
                          <>
                            <Badge tone="muted">Archived</Badge>
                            <Badge tone={c.designation === "HEAD" ? "green" : "blue"}>
                              {c.designation === "HEAD" ? "Head Coach" : "Assistant Coach"}
                            </Badge>
                          </>
                        }
                        subtitle={
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                            Archived {c.user.archivedAt?.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                            {c.primaryFocus.length > 0 && ` · Focus: ${c.primaryFocus.map((a) => a.name).join(", ")}`}
                          </div>
                        }
                        actions={
                          canManageStaff ? (
                            <ConfirmDeleteButton
                              action={reactivateCoach.bind(null, c.id)}
                              label="Reactivate"
                              confirmMessage={`Reactivate ${c.user.name}? Their history was preserved, so they'll reappear on the active roster with everything intact.`}
                              buttonStyle={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                background: "var(--primary)",
                                border: "1px solid var(--primary)",
                                color: "#fff",
                                borderRadius: 8,
                                cursor: "pointer",
                                fontWeight: 700,
                                fontSize: 12,
                                padding: "5px 12px",
                              }}
                            />
                          ) : undefined
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}

          {canManageStaff && staff.length > 0 && (
            <details style={{ marginTop: 28, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 14 }}>
              <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 800, userSelect: "none" }}>
                <Icon name="coaches" size={15} style={{ color: "var(--text-muted)" }} />
                Staff · Club Managers
                <Badge tone="accent">{staffActive.length}</Badge>
              </summary>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
                {staffActive.map((s) => (
                  <div key={s.id} style={{ background: "var(--surface-muted)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <EntityHero
                        name={s.name}
                        src={s.photoUrl}
                        size={38}
                        badges={<Badge tone="accent">Club Manager</Badge>}
                        actions={
                          <ConfirmDeleteButton
                            action={archiveStaffMember.bind(null, s.id)}
                            label="Archive"
                            confirmMessage={`Archive ${s.name}? They'll be logged out immediately and can't log back in.`}
                          />
                        }
                      />
                    </div>
                  </div>
                ))}
                {staffArchived.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginTop: 4 }}>
                      Archived
                    </div>
                    {staffArchived.map((s) => (
                      <div key={s.id} style={{ background: "var(--surface-muted)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 14, opacity: 0.75 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <EntityHero
                            name={s.name}
                            src={s.photoUrl}
                            size={38}
                            badges={
                              <>
                                <Badge tone="muted">Archived</Badge>
                                <Badge tone="accent">Club Manager</Badge>
                              </>
                            }
                            subtitle={
                              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                                Archived {s.archivedAt?.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                              </div>
                            }
                            actions={
                              <ConfirmDeleteButton
                                action={reactivateStaffMember.bind(null, s.id)}
                                label="Reactivate"
                                confirmMessage={`Reactivate ${s.name}? They'll regain access on next login.`}
                                buttonStyle={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  background: "var(--primary)",
                                  border: "1px solid var(--primary)",
                                  color: "#fff",
                                  borderRadius: 8,
                                  cursor: "pointer",
                                  fontWeight: 700,
                                  fontSize: 12,
                                  padding: "5px 12px",
                                }}
                              />
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>
          )}
        </>
      )}
    </>
  );
}