import { CardView } from "@/components/ui/CardView";
import { SquadPlayerLink, SquadScrollRestore } from "@/components/SquadNavigation";
import { Button } from "@/components/ui/Button";
import { prisma } from "@/lib/prisma";
import { createPlayer, deletePlayer, updatePlayerStatus, promotePlayers, createSkillDefinition, renameSkillDefinition, deleteSkillDefinition } from "./actions";
import { getPermissions } from "@/lib/permissions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { StatusBanner } from "@/components/StatusBanner";
import { PlayerRatingCard } from "@/components/PlayerRatingCard";
import { calculateAge, SKILL_BAND_META } from "@/lib/skills";
import { getSkillBands } from "@/lib/skillDefinitions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { PlayerStatusBadge } from "@/components/ui/PlayerStatusBadge";
import { PlayerStatusSelect } from "@/components/ui/PlayerStatusSelect";
import { EmptyState } from "@/components/ui/EmptyState";
import { CollapsibleCreate } from "@/components/ui/CollapsibleCreate";
import { inputBase } from "@/components/ui/Form";
import { PhotoUpload } from "@/components/ui/PhotoUpload";
import { Icon } from "@/components/ui/Icon";

// Filtering is in-memory via URLSearchParams read from searchParams - the
// Server Component reads them directly, no client state needed. This is the
// right call at current data volume; move to DB-level where clauses once
// player counts pass a few hundred.
export default async function SquadPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; age?: string; ageGroup?: string; batch?: string; status?: string; dobFrom?: string; dobTo?: string; joinedFrom?: string; joinedTo?: string }>;
}) {
  const params = await searchParams;
  const perms = await getPermissions();
  const canEdit = perms.isAdmin || perms.canEditSquad;
  // Managing skill dimensions themselves (add/rename/delete) is a
  // structural, academy-wide decision - gated to isAdmin/isClubManager only,
  // not the canEditSquad rule that governs day-to-day rating above.
  const canManageSkills = perms.isAdmin || perms.isClubManager;
  const skillBands = await getSkillBands();

  const ageFilter = params.age ? Number(params.age) : null;
  const batchFilter = params.batch || null;
  const statusFilter = params.status || null;
  const dobFrom = params.dobFrom ? new Date(params.dobFrom) : null;
  const dobTo = params.dobTo ? new Date(params.dobTo) : null;
  const joinedFrom = params.joinedFrom ? new Date(params.joinedFrom) : null;
  const joinedTo = params.joinedTo ? new Date(params.joinedTo) : null;

  const players = await prisma.player.findMany({
    include: { ageGroup: true, skills: true, batches: { include: { ageGroup: true } } },
    orderBy: { name: "asc" },
  });

  const filtered = players.filter((p) => {
    if (ageFilter !== null && calculateAge(p.dateOfBirth) !== ageFilter) return false;
    if (params.ageGroup && p.ageGroupId !== params.ageGroup && !p.batches.some(b => b.ageGroupId === params.ageGroup)) return false;
    if (batchFilter && !p.batches.some((b) => b.id === batchFilter)) return false;
    if (statusFilter && p.status !== statusFilter) return false;
    if (dobFrom && p.dateOfBirth < dobFrom) return false;
    if (dobTo && p.dateOfBirth > dobTo) return false;
    if (joinedFrom && p.dateJoined < joinedFrom) return false;
    if (joinedTo && p.dateJoined > joinedTo) return false;
    return true;
  });

  const settings = await prisma.academySettings.findFirst();
  const ageGroups = await prisma.ageGroup.findMany({ orderBy: { sortOrder: "asc" } });
  const batches = await prisma.batch.findMany({ orderBy: { name: "asc" }, include: { ageGroup: true } });

  // No foreign key from PlayerSkill/PlayerSkillHistory to SkillDefinition
  // (see the model comment), so "in use" for the manager below is computed
  // by matching the string value rather than a relation count. Only fetched
  // when the manager is actually visible.
  const [skillDefinitions, skillRatingCounts, historyNames] = canManageSkills
    ? await Promise.all([
        prisma.skillDefinition.findMany({ orderBy: [{ band: "asc" }, { sortOrder: "asc" }] }),
        prisma.playerSkill.groupBy({ by: ["skillName"], _count: { _all: true } }),
        prisma.playerSkillHistory.findMany({ select: { skillName: true }, distinct: ["skillName"] }),
      ])
    : [[], [], []];
  const skillRatingCountByName = new Map(skillRatingCounts.map((s) => [s.skillName, s._count._all]));
  const skillInUseNames = new Set([...skillRatingCounts.map((s) => s.skillName), ...historyNames.map((h) => h.skillName)]);

  const hasFilters = !!params.ageGroup || !!params.age || !!params.batch || !!params.status || !!params.dobFrom || !!params.dobTo || !!params.joinedFrom || !!params.joinedTo;

  const fieldLabel: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4, color: "var(--text)" };

  return (
    <>
      <PageHeader
        title="Squad"
        subtitle={canEdit ? "Add players and rate their skills. Every player gets an age-matched rating sheet." : "View only — squad editing is limited to admins and head coaches for now."}
        actions={
          canEdit ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {(perms.isAdmin || perms.isClubManager) && (
                <a className="text-link"
                  href="/squad/promote"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--secondary)", textDecoration: "none" }}
                >
                  <Icon name="trendUp" size={15} /> Promote players
                </a>
              )}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)" }}>
                <Icon name="squad" size={15} /> {filtered.length} {filtered.length === 1 ? "player" : "players"}
              </span>
            </span>
          ) : undefined
        }
      />

      <StatusBanner error={params.error} success={params.success} />
      <SquadScrollRestore />

      {canManageSkills && (
        <CollapsibleCreate title="Manage skill dimensions" subtitle={`${skillDefinitions.length}`}>
          <form
            action={createSkillDefinition}
            style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap" }}
          >
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={fieldLabel}>New skill name</label>
              <input name="name" placeholder="e.g. Heading" required style={inputBase} />
            </div>
            <div>
              <label style={fieldLabel}>Age band</label>
              <select name="band" required defaultValue={SKILL_BAND_META[0].label} style={inputBase}>
                {SKILL_BAND_META.map((b) => (
                  <option key={b.label} value={b.label}>{b.ageLabel} · {b.label}</option>
                ))}
              </select>
            </div>
            <Button>Add Skill</Button>
          </form>

          {SKILL_BAND_META.map((bandMeta) => {
            const bandSkills = skillDefinitions.filter((s) => s.band === bandMeta.label);
            return (
              <div key={bandMeta.label} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                  {bandMeta.ageLabel} · {bandMeta.label}
                </div>
                {bandSkills.length === 0 ? (
                  <p style={{ color: "var(--text-faint)", fontSize: 13 }}>No skills yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {bandSkills.map((s) => {
                      const inUse = skillInUseNames.has(s.name);
                      const ratingCount = skillRatingCountByName.get(s.name) ?? 0;
                      return (
                        <div
                          key={s.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 12px",
                            background: "var(--surface-muted)",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: 13 }}>{s.name}</span>
                            <Badge tone={inUse ? "warning" : "muted"}>
                              {inUse ? `In use · ${ratingCount} player${ratingCount === 1 ? "" : "s"}` : "Not in use"}
                            </Badge>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <details>
                              <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700, color: "var(--secondary)", outline: "none", listStyle: "none" }}>Rename</summary>
                              <form action={renameSkillDefinition.bind(null, s.id)} style={{ display: "flex", gap: 6, marginTop: 8 }}>
                                <input name="name" defaultValue={s.name} required style={{ ...inputBase, fontSize: 13, padding: "6px 9px", width: 180 }} />
                                <Button size="sm">Save</Button>
                              </form>
                            </details>
                            {!inUse && (
                              <ConfirmDeleteButton
                                action={deleteSkillDefinition.bind(null, s.id)}
                                confirmMessage={`Remove "${s.name}"? This can't be undone.`}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </CollapsibleCreate>
      )}

      {canEdit && (
        <CollapsibleCreate title="Add a player">
          <form action={createPlayer}>
            <div className="form-grid-2col" style={{ gap: 12 }}>
              <div>
                <label style={fieldLabel}>Name</label>
                <input name="name" required style={inputBase} />
              </div>
              <div>
                <label style={fieldLabel}>Date of birth</label>
                <input name="dateOfBirth" type="date" required style={inputBase} />
              </div>
              <div>
                <label style={fieldLabel}>Gender</label>
                <select name="gender" required defaultValue="" style={inputBase}>
                  <option value="" disabled>Select gender</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              </div>
              <div>
                <label style={fieldLabel}>Age group</label>
                {settings?.autoAssignPlayerAgeGroup ? (
                  <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Assigned automatically from the club's date-of-birth rules.</p>
                ) : (
                  <select name="ageGroupId" defaultValue="" required style={inputBase}>
                    <option value="" disabled>Select age group</option>
                    {ageGroups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
                  </select>
                )}
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ ...fieldLabel, marginBottom: 8 }}>Photo (optional)</label>
                <PhotoUpload name="photoUrl" label="Upload photo" />
              </div>
            </div>
            <Button style={{ marginTop: 14 }}>Add Player</Button>
          </form>
        </CollapsibleCreate>
      )}

      {/* Filter bar - always visible, matches Stitch: filter icon + label on
          left, batch/status/age controls, Clear action on the right. */}
      <div
        style={{
          background: "var(--surface-muted)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "12px 16px",
          marginBottom: 20,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, marginRight: "auto", fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          <Icon name="filter" size={16} />
          Filters
        </span>
        <form
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <select name="ageGroup" aria-label="Age group" defaultValue={params.ageGroup ?? ""} style={{ ...inputBase, width: "auto" }}>
            <option value="">All age groups</option>
            {ageGroups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
          <select aria-label="Batch" name="batch" defaultValue={params.batch ?? ""} style={{ padding: "6px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", fontSize: 13 }}>
            <option value="">All Batches</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name} ({b.ageGroup.name})</option>
            ))}
          </select>
          <select aria-label="Player status" name="status" defaultValue={params.status ?? ""} style={{ padding: "6px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", fontSize: 13 }}>
            <option value="">Status: All</option>
            <option value="ACTIVE">Available</option>
            <option value="INJURED">Injured</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <input aria-label="Player age" name="age" type="number" min={1} defaultValue={params.age ?? ""} placeholder="Age (e.g. 16)" style={{ width: 96, padding: "6px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", fontSize: 13 }} />
          <Button variant="secondary" size="sm">Filter</Button>
          <a className="text-link" href="/squad" style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--secondary)", textDecoration: "none" }}>
            Clear
          </a>
        </form>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="squad"
          title={hasFilters ? "No players match the current filters" : "No players yet"}
          message={hasFilters ? "Try removing a filter to see more results." : "Add your first player above to start building the squad."}
        />
      ) : (
        <CardView storageKey="touchline-squad-view" defaultView="tiles" className="squad-grid" cssTiles label="Squad display">
          {filtered.map((p) => {
            const tone = p.name.split("").reduce((n, ch) => n + ch.charCodeAt(0), 0) % 6;
            return (
              <div key={p.id} id={`player-card-${p.id}`} className="ent-card" data-status={p.status}>
                <div className="cc-head">
                  <span className={`eh-avatar eh-av-${tone}`}>
                    <Avatar name={p.name} src={p.photoUrl} size={44} />
                  </span>
                  <div className="cc-id">
                    <div className="cc-name"><SquadPlayerLink playerId={p.id} appearance="name">{p.name}</SquadPlayerLink></div>
                    <div className="cc-tags">
                      <PlayerStatusBadge status={p.status} statusUpdatedAt={p.statusUpdatedAt} />
                      <Badge tone="muted">Age {calculateAge(p.dateOfBirth)}</Badge>
                      {p.gender && <Badge tone="accent">{p.gender === "MALE" ? "Male" : p.gender === "FEMALE" ? "Female" : "Other"}</Badge>}
                      {p.position && p.position !== "Unassigned (Default)" && <Badge tone="green">{p.position}</Badge>}
                    </div>
                  </div>
                </div>

                {(p.ageGroup || p.batches.length > 0) && (
                  <div className="cc-focus">
                    <span className="cc-focus-label">Groups</span>
                    {p.ageGroup && <Badge tone="green">{p.ageGroup.name}</Badge>}
                    {p.batches.map((b) => (<Badge key={b.id} tone="blue">{b.name}</Badge>))}
                  </div>
                )}

                <div className="cc-bar">
                  <details className="cc-drop">
                    <summary>Skills</summary>
                    <div style={{ marginTop: 10 }}>

                      <PlayerRatingCard
                        playerId={p.id}
                        dateOfBirth={p.dateOfBirth.toISOString()}
                        position={p.position}
                        skills={p.skills.map((s) => ({ skillName: s.skillName, value: s.value, active: s.active }))}
                        canEdit={canEdit}
                        skillBands={skillBands}
                      />
                    </div>
                  </details>
                  {canEdit && (
                    <details className="cc-drop">
                      <summary>Manage</summary>
                      <div className="cc-form">
                        <label style={{ fontSize: 13, fontWeight: 700 }}>Status</label>
                        <PlayerStatusSelect action={updatePlayerStatus.bind(null, p.id)} status={p.status} />
                      </div>
                      {(perms.isAdmin || perms.isClubManager) && (
                        <div className="cc-del">
                          <ConfirmDeleteButton
                            action={deletePlayer.bind(null, p.id)}
                            confirmMessage={`Remove ${p.name} from the squad? This deletes their skills and notes too and can't be undone.`}
                          />
                        </div>
                      )}
                    </details>
                  )}
                  <div className="cc-view"><SquadPlayerLink playerId={p.id}>View player</SquadPlayerLink></div>
                </div>
              </div>
            );
          })}
        </CardView>
      )}
    </>
  );
}
