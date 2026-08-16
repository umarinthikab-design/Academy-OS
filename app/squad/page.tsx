import { prisma } from "@/lib/prisma";
import { createPlayer, deletePlayer, updatePlayerStatus, promotePlayers } from "./actions";
import { getPermissions } from "@/lib/permissions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { StatusBanner } from "@/components/StatusBanner";
import { PlayerRatingCard } from "@/components/PlayerRatingCard";
import { calculateAge } from "@/lib/skills";
import { PageHeader } from "@/components/ui/PageHeader";
import { EntityHero } from "@/components/ui/EntityHero";
import { Badge } from "@/components/ui/Badge";
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
  searchParams: Promise<{ error?: string; success?: string; age?: string; batch?: string; dobFrom?: string; dobTo?: string; joinedFrom?: string; joinedTo?: string }>;
}) {
  const params = await searchParams;
  const perms = await getPermissions();
  const canEdit = perms.isAdmin || perms.canEditSquad;

  const ageFilter = params.age ? Number(params.age) : null;
  const batchFilter = params.batch || null;
  const dobFrom = params.dobFrom ? new Date(params.dobFrom) : null;
  const dobTo = params.dobTo ? new Date(params.dobTo) : null;
  const joinedFrom = params.joinedFrom ? new Date(params.joinedFrom) : null;
  const joinedTo = params.joinedTo ? new Date(params.joinedTo) : null;

  const players = await prisma.player.findMany({
    include: { skills: true, batches: { include: { ageGroup: true } } },
    orderBy: { name: "asc" },
  });

  const filtered = players.filter((p) => {
    if (ageFilter !== null && calculateAge(p.dateOfBirth) !== ageFilter) return false;
    if (batchFilter && !p.batches.some((b) => b.id === batchFilter)) return false;
    if (dobFrom && p.dateOfBirth < dobFrom) return false;
    if (dobTo && p.dateOfBirth > dobTo) return false;
    if (joinedFrom && p.dateJoined < joinedFrom) return false;
    if (joinedTo && p.dateJoined > joinedTo) return false;
    return true;
  });

  const batches = await prisma.batch.findMany({ orderBy: { name: "asc" }, include: { ageGroup: true } });

  const hasFilters = !!params.age || !!params.batch || !!params.dobFrom || !!params.dobTo || !!params.joinedFrom || !!params.joinedTo;

  const fieldLabel: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--text)" };

  return (
    <>
      <PageHeader
        title="Squad"
        subtitle={canEdit ? "Add players and rate their skills. Every player gets an age-matched rating sheet." : "View only — squad editing is limited to admins and head coaches for now."}
        actions={
          canEdit ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {perms.isAdmin && (
                <a
                  href="/squad/promote"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--secondary)", textDecoration: "none" }}
                >
                  <Icon name="trendUp" size={15} /> Promote players
                </a>
              )}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
                <Icon name="squad" size={15} /> {filtered.length} {filtered.length === 1 ? "player" : "players"}
              </span>
            </span>
          ) : undefined
        }
      />

      <StatusBanner error={params.error} success={params.success} />

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
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ ...fieldLabel, marginBottom: 8 }}>Photo (optional)</label>
                <PhotoUpload name="photoUrl" label="Upload photo" />
              </div>
            </div>
            <button
              type="submit"
              style={{ marginTop: 14, padding: "9px 18px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >
              Add Player
            </button>
          </form>
        </CollapsibleCreate>
      )}

      {/* Filter bar - collapsed by default so the player list stays the focus;
          auto-opens when filters are active so the active state is visible. */}
      <details
        open={hasFilters}
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: 14,
          marginBottom: 20,
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
          <Icon name="filter" size={15} style={{ color: "var(--secondary)" }} />
          Filters
          {hasFilters && (
            <a href="/squad" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textDecoration: "none", marginLeft: 4 }}>
              Clear
            </a>
          )}
        </summary>
        <form
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "flex-end",
            paddingTop: 14,
          }}
        >
        <div>
          <label style={fieldLabel}>Age</label>
          <input name="age" type="number" min={1} defaultValue={params.age ?? ""} style={{ width: 70, padding: 6, border: "1px solid var(--border)", borderRadius: 6 }} />
        </div>
        <div>
          <label style={fieldLabel}>Batch</label>
          <select name="batch" defaultValue={params.batch ?? ""} style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 6 }}>
            <option value="">All</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name} ({b.ageGroup.name})</option>
            ))}
          </select>
        </div>
        <div>
          <label style={fieldLabel}>DOB from</label>
          <input name="dobFrom" type="date" defaultValue={params.dobFrom ?? ""} style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 6 }} />
        </div>
        <div>
          <label style={fieldLabel}>DOB to</label>
          <input name="dobTo" type="date" defaultValue={params.dobTo ?? ""} style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 6 }} />
        </div>
        <div>
          <label style={fieldLabel}>Joined from</label>
          <input name="joinedFrom" type="date" defaultValue={params.joinedFrom ?? ""} style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 6 }} />
        </div>
        <div>
          <label style={fieldLabel}>Joined to</label>
          <input name="joinedTo" type="date" defaultValue={params.joinedTo ?? ""} style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 6 }} />
        </div>
        <button type="submit" style={{ padding: "7px 16px", border: "none", background: "var(--secondary)", color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
          Filter
        </button>
        </form>
      </details>

      {filtered.length === 0 ? (
        <EmptyState
          icon="squad"
          title={hasFilters ? "No players match the current filters" : "No players yet"}
          message={hasFilters ? "Try removing a filter to see more results." : "Add your first player above to start building the squad."}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((p) => (
            <div
              key={p.id}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                boxShadow: "var(--shadow-sm)",
                padding: 16,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <EntityHero
                  name={p.name}
                  href={`/squad/${p.id}`}
                  src={p.photoUrl}
                  badges={
                    <>
                      <PlayerStatusBadge status={p.status} />
                      <Badge tone="muted">Age {calculateAge(p.dateOfBirth)}</Badge>
                      {p.gender && <Badge tone="accent">{p.gender === "MALE" ? "Male" : p.gender === "FEMALE" ? "Female" : "Other"}</Badge>}
                      {p.position && p.position !== "Unassigned (Default)" && <Badge tone="green">{p.position}</Badge>}
                      {p.batches.map((b) => (
                        <Badge key={b.id} tone="blue">{b.name}</Badge>
                      ))}
                    </>
                  }
                  actions={
                    canEdit ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <PlayerStatusSelect
                          action={updatePlayerStatus.bind(null, p.id)}
                          status={p.status}
                        />
                        <ConfirmDeleteButton
                          action={deletePlayer.bind(null, p.id)}
                          confirmMessage={`Remove ${p.name} from the squad? This deletes their skills and notes too and can't be undone.`}
                        />
                      </div>
                    ) : undefined
                  }
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <PlayerRatingCard
                  playerId={p.id}
                  dateOfBirth={p.dateOfBirth.toISOString()}
                  position={p.position}
                  skills={p.skills.map((s) => ({ skillName: s.skillName, value: s.value, active: s.active }))}
                  canEdit={canEdit}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}