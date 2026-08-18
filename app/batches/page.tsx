import { prisma } from "@/lib/prisma";
import { createBatch, deleteBatch } from "./actions";
import { getPermissions } from "@/lib/permissions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { StatusBanner } from "@/components/StatusBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { CollapsibleCreate } from "@/components/ui/CollapsibleCreate";
import { SearchableMultiSelect } from "@/components/ui/SearchableMultiSelect";
import { inputBase } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
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
  const fieldLabel: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--text)" };

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
            <button type="submit" style={{ marginTop: 14, padding: "9px 18px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              Create Batch
            </button>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {batches.map((b) => (
            <div key={b.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 15 }}>{b.name}</strong>
                    <Badge tone="blue">{b.ageGroup.name}</Badge>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                    <Icon name="whistle" size={13} style={{ verticalAlign: "-2px", marginRight: 3 }} />
                    Main coaches: {b.mainCoaches.map((c) => c.user.name).join(", ") || "none assigned"}
                  </div>
                  {b.supportingCoaches.length > 0 && (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      <Icon name="users" size={13} style={{ verticalAlign: "-2px", marginRight: 3 }} />
                      Supporting: {b.supportingCoaches.map((c) => c.user.name).join(", ")}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    <Icon name="squad" size={13} style={{ verticalAlign: "-2px", marginRight: 3 }} />
                    Players ({b.players.length}): {b.players.map((p) => p.name).join(", ") || "none yet"}
                  </div>
                </div>
                {canEdit && (
                  <ConfirmDeleteButton
                    action={deleteBatch.bind(null, b.id)}
                    confirmMessage={`Remove ${b.name}? This can't be undone.`}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
