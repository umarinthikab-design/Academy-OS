import { getAcademyTimeZone } from "@/lib/academyTime";
import { inputBase } from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import { CardView } from "@/components/ui/CardView";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createCoach, deleteCoach, updateCoachPermission, revokeSessions, promoteCoach, resetCoachPassword, archiveCoach, reactivateCoach, archiveStaffMember, reactivateStaffMember } from "./actions";
import { getPermissions } from "@/lib/permissions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { StatusBanner } from "@/components/StatusBanner";
import { TempPasswordReveal } from "@/components/TempPasswordReveal";
import { PageHeader } from "@/components/ui/PageHeader";
import { EntityHero } from "@/components/ui/EntityHero";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
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
  { field: "canSendBroadcasts", label: "Send Broadcasts" },
] as const;

export default async function CoachesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const academyTz = await getAcademyTimeZone();
  const params = await searchParams;
  const perms = await getPermissions();
  const canManageStaff = perms.isAdmin || perms.isClubManager;

  const tempPwdCookie = (await cookies()).get("tl_temp_pwd")?.value;
  let tempPwd: { email: string; password: string } | null = null;
  if (tempPwdCookie) {
    try {
      tempPwd = JSON.parse(tempPwdCookie);
    } catch {
      tempPwd = null;
    }
  }
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
        title="Coaches Roster"
        subtitle={canEdit ? "Manage technical staff, designations, and system permissions." : "View only — you don't have edit access to the roster. Ask an administrator if you need it."}
      />

      <StatusBanner error={params.error} success={params.success} />
      {tempPwd && <TempPasswordReveal email={tempPwd.email} password={tempPwd.password} />}

      {canEdit && (
        <CollapsibleCreate title="Add a coach">
          <form action={createCoach}>
            <CoachCreateFields ageGroups={ageGroups} />
            <Button style={{ marginTop: 14 }}>Add Coach</Button>
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
          <CardView storageKey="touchline-coaches-view" defaultView="list" minTile={380} className="coach-grid" label="Coach display">
              {active.length === 0 && (
                <EmptyState icon="coaches" title="No active coaches" message="Archived coaches are listed below." />
              )}
              {active.map((c) => {
                const onCount = PERMISSION_TOGGLES.filter((t) => c[t.field]).length;
                const tone = c.user.name.split("").reduce((n, ch) => n + ch.charCodeAt(0), 0) % 6;
                return (
                  <div key={c.id} className="coach-card" data-role={c.designation}>
                    <div className="cc-head">
                      <span className={`eh-avatar eh-av-${tone}`}>
                        <Avatar name={c.user.name} src={c.user.photoUrl} size={44} />
                      </span>
                      <div className="cc-id">
                        <div className="cc-name">{c.user.name}</div>
                        <div className="cc-tags">
                          <Badge tone={c.designation === "HEAD" ? "green" : "blue"}>{c.designation === "HEAD" ? "Head Coach" : "Assistant Coach"}</Badge>
                          <Badge tone="green">Active</Badge>
                          {c.gender && <Badge tone="accent">{c.gender === "MALE" ? "Male" : c.gender === "FEMALE" ? "Female" : "Other"}</Badge>}
                        </div>
                      </div>
                    </div>

                    {c.primaryFocus.length > 0 && (
                      <div className="cc-focus">
                        <span className="cc-focus-label">Age groups</span>
                        {c.primaryFocus.map((a) => (<Badge key={a.name} tone="accent">{a.name}</Badge>))}
                      </div>
                    )}

                    {(canManageStaff || canEdit) && (
                      <div className="cc-bar">
                        {canManageStaff && c.designation === "HEAD" && (
                          <details className="cc-drop">
                            <summary>Permissions <span className="cc-count">{onCount}/{PERMISSION_TOGGLES.length}</span></summary>

                            <div className="cc-pills">
                              {PERMISSION_TOGGLES.map((t) => (
                                <form key={t.field} action={updateCoachPermission.bind(null, c.id, t.field, !c[t.field])}>
                                  <button type="submit" className="cc-pill" data-on={c[t.field] ? "1" : "0"}>{t.label}{c[t.field] ? " ✓" : ""}</button>
                                </form>
                              ))}
                            </div>
                          </details>
                        )}
                        {canManageStaff && c.designation === "ASSISTANT" && (
                          <details className="cc-drop">
                            <summary>Promote to head</summary>
                            <form action={promoteCoach.bind(null, c.id)} className="cc-promote">
                              <p>Pick which head-coach permissions they should inherit, then promote. Their focus areas are kept.</p>
                              {PERMISSION_TOGGLES.map((t) => (
                                <label key={t.field}><input type="checkbox" name={t.field} defaultChecked={c[t.field]} /> {t.label}</label>
                              ))}
                              <Button size="sm">Promote to Head Coach</Button>
                            </form>
                          </details>
                        )}
                        {canEdit && (
                          <details className="cc-drop">
                            <summary>Account access</summary>
                            {canManageStaff && (
                              <>
                                <form action={resetCoachPassword.bind(null, c.id)} className="cc-form">
                                  <label style={{ fontSize: 13 }}>Login email
                                    <input name="email" type="email" required defaultValue={c.user.email} style={inputBase} />
                                  </label>
                                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Saves the email and resets the password together. Existing sessions are revoked.</span>
                                  <Button variant="outline" size="sm">Save email &amp; reset password</Button>

                                </form>
                                <form action={revokeSessions.bind(null, c.id)} className="cc-form">
                                  <Button variant="outline" size="sm" title="Invalidate all of this coach's active sessions so they must log in again" style={{ color: "var(--text-muted)" }}>Revoke sessions</Button>
                                </form>
                              </>
                            )}
                            <div className="cc-del">
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
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </CardView>

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
                          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>
                            Archived {c.user.archivedAt?.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: academyTz })}
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
                                fontSize: 13,
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
                    <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginTop: 4 }}>
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
                              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>
                                Archived {s.archivedAt?.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: academyTz })}
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
                                  fontSize: 13,
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