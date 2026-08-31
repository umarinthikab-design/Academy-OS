import { prisma } from "@/lib/prisma";
import { createBatch, deleteBatch } from "./actions";
import { getPermissions } from "@/lib/permissions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { StatusBanner } from "@/components/StatusBanner";
import { PageHeader } from "@/components/ui/PageHeader";
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
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-muted)" }}>
                  <th style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>Batch Name</th>
                  <th style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>Age Group</th>
                  <th style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>Head Coach</th>
                  <th style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", textAlign: "right" }}>Players</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b, idx) => (
                  <tr key={b.id} style={{ borderTop: "1px solid var(--border)", background: idx % 2 === 1 ? "var(--surface-muted)" : "var(--surface)" }}>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ fontFamily: "var(--font-headline)", fontSize: 16, fontWeight: 600, color: "var(--primary)" }}>{b.name}</div>
                      {b.supportingCoaches.length > 0 && (
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                          Supporting: {b.supportingCoaches.map((c) => c.user.name).join(", ")}
                        </div>
                      )}
                      {canEdit && (
                        <div style={{ marginTop: 8 }}>
                          <ConfirmDeleteButton
                            action={deleteBatch.bind(null, b.id)}
                            label="Remove"
                            confirmMessage={`Remove ${b.name}? This can't be undone.`}
                          />
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "14px 16px", color: "var(--text-muted)", fontSize: 13 }}>{b.ageGroup.name}</td>
                    <td style={{ padding: "14px 16px", fontSize: 13 }}>{b.mainCoaches.map((c) => c.user.name).join(", ") || <span style={{ color: "var(--text-faint)" }}>none assigned</span>}</td>
                    <td style={{ padding: "14px 16px", textAlign: "right", fontSize: 12, color: "var(--text-muted)" }}>
                      <div>{b.players.length} player{b.players.length === 1 ? "" : "s"}</div>
                      {b.players.length > 0 && (
                        <div style={{ marginTop: 2, maxWidth: 200, fontSize: 11, color: "var(--text-faint)" }}>
                          {b.players.map((p) => p.name).join(", ")}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
