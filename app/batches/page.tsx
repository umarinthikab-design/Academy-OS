import { Button } from "@/components/ui/Button";
import { prisma } from "@/lib/prisma";
import { createBatch, deleteBatch } from "./actions";
import { getPermissions } from "@/lib/permissions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { StatusBanner } from "@/components/StatusBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CollapsibleCreate } from "@/components/ui/CollapsibleCreate";
import { SearchableMultiSelect } from "@/components/ui/SearchableMultiSelect";
import { inputBase } from "@/components/ui/Form";
import { calculateAge } from "@/lib/skills";

export default async function BatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const perms = await getPermissions();
  const canEdit = perms.isAdmin || perms.canEditBatches;
  const [batches, ageGroups, coaches, players] = await Promise.all([
    prisma.batch.findMany({
      include: { ageGroup: true, mainCoaches: { include: { user: true } }, supportingCoaches: { include: { user: true } }, players: true },
      orderBy: { name: "asc" },
    }),
    prisma.ageGroup.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.coach.findMany({ where: { user: { archivedAt: null } }, include: { user: true } }),
    prisma.player.findMany({ include: { batches: true }, orderBy: { name: "asc" } }),
  ]);

  const missingPrereqs = ageGroups.length === 0;
  const fieldLabel: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4, color: "var(--text)" };

  const coachOptions = coaches.map((c) => ({
    id: c.id,
    label: c.user.name,
    sublabel: c.designation === "HEAD" ? "Head coach" : "Assistant coach",
  }));

  // Player picker options carry age + current squad so the dropdown's filter
  // selects can narrow the list. A player's squad here means the batch they
  // currently belong to (if any).
  const playerOptions = players.map((p) => ({
    id: p.id,
    label: p.name,
    sublabel: `Age ${calculateAge(p.dateOfBirth)}`,
    filterValues: {
      age: String(calculateAge(p.dateOfBirth)),
      squad: p.batches[0]?.id ?? "none",
    },
  }));

  const ageChoices = Array.from(new Set(players.map((p) => String(calculateAge(p.dateOfBirth))))).sort((a, b) => Number(a) - Number(b));
  const squadChoices = [
    { value: "none", label: "Not in a batch" },
    ...batches.map((b) => ({ value: b.id, label: b.name })),
  ];

  return (
    <>
      <PageHeader
        title="Batches"
        subtitle={canEdit ? "Group players under a coach and age group." : "View only — you don't have edit access to batches."}
      />

      <StatusBanner error={params.error} success={params.success} />

      {missingPrereqs && canEdit && (
        <div style={{ background: "var(--warning-bg)", border: "1px solid #fde68a", borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 13, color: "#92400e" }}>
          Add an <a href="/age-groups" style={{ color: "inherit", fontWeight: 700 }}>age group</a> first.
        </div>
      )}

      {canEdit && !missingPrereqs && (
        <CollapsibleCreate title="Create a batch">
          <form action={createBatch}>
            <div className="form-grid-2col" style={{ gap: 12 }}>
              <div>
                <label style={fieldLabel}>Batch name</label>
                <input name="name" required style={inputBase} />
              </div>
              <div>
                <label style={fieldLabel}>Age group</label>
                <select name="ageGroupId" required style={inputBase}>
                  {ageGroups.map((ag) => (
                    <option key={ag.id} value={ag.id}>{ag.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={fieldLabel}>Main coaches</label>
                <SearchableMultiSelect
                  name="mainCoaches"
                  options={coachOptions}
                  placeholder="Search and select main coaches…"
                  emptyText="No coaches in the roster yet."
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={fieldLabel}>Supporting coaches</label>
                <SearchableMultiSelect
                  name="supportingCoaches"
                  options={coachOptions}
                  placeholder="Search and select supporting coaches…"
                  emptyText="No coaches in the roster yet."
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={fieldLabel}>Players</label>
                <SearchableMultiSelect
                  name="players"
                  options={playerOptions}
                  placeholder="Search and select players…"
                  emptyText="No players in the squad yet."
                  filters={[
                    { key: "age", label: "Age", choices: ageChoices.map((a) => ({ value: a, label: `Age ${a}` })) },
                    { key: "squad", label: "Squad", choices: squadChoices },
                  ]}
                />
              </div>
            </div>
            <Button style={{ marginTop: 14 }}>Create Batch</Button>
          </form>
        </CollapsibleCreate>
      )}

      {batches.length === 0 ? (
        <EmptyState
          icon="batches"
          title="No batches yet"
          message="Create your first batch above to group players and coaches."
        />
      ) : (
        <div className="bt-grid">
          {batches.map((b) => (
            <div key={b.id} className="ent-card bt">
              <div className="cc-id">
                <div className="cc-name">{b.name}</div>
                <div className="cc-tags">
                  <Badge tone="green">{b.ageGroup.name}</Badge>
                  <Badge tone="blue">{b.players.length} player{b.players.length === 1 ? "" : "s"}</Badge>
                </div>
              </div>
              <div className="bt-meta">
                <div className="bt-row"><span className="bt-label">Head coach</span><span className="bt-val">{b.mainCoaches.map((c) => c.user.name).join(", ") || <span style={{ color: "var(--text-faint)" }}>none assigned</span>}</span></div>
                {b.supportingCoaches.length > 0 && (
                  <div className="bt-row"><span className="bt-label">Support</span><span className="bt-val">{b.supportingCoaches.map((c) => c.user.name).join(", ")}</span></div>
                )}
              </div>
              {(b.players.length > 0 || canEdit) && (
                <div className="cc-bar">
                  {b.players.length > 0 && (
                    <details className="cc-drop">
                      <summary>Players <span className="cc-count">{b.players.length}</span></summary>
                      <div className="bt-players">{b.players.map((p) => (<Badge key={p.id} tone="muted">{p.name}</Badge>))}</div>
                    </details>
                  )}
                  {canEdit && (
                    <details className="cc-drop">
                      <summary>Manage</summary>
                      <div className="cc-del">
                        <ConfirmDeleteButton action={deleteBatch.bind(null, b.id)} label="Remove" confirmMessage={`Remove ${b.name}? This can't be undone.`} />
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
