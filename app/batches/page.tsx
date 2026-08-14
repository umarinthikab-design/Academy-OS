import { prisma } from "@/lib/prisma";
import { createBatch, deleteBatch } from "./actions";
import { getPermissions } from "@/lib/permissions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { StatusBanner } from "@/components/StatusBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { inputBase } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";

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
      include: { ageGroup: true, mainCoaches: { include: { user: true } }, players: true },
      orderBy: { name: "asc" },
    }),
    prisma.ageGroup.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.coach.findMany({ include: { user: true } }),
    prisma.player.findMany({ orderBy: { name: "asc" } }),
  ]);

  const missingPrereqs = ageGroups.length === 0;
  const fieldLabel: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--text)" };

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
        <form
          action={createBatch}
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
            <span style={{ fontSize: 14, fontWeight: 800 }}>Create a batch</span>
          </div>
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
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
                {coaches.length === 0 && <span style={{ fontSize: 12, color: "var(--text-faint)" }}>No coaches in the roster yet.</span>}
                {coaches.map((c) => (
                  <label key={c.id} style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <input type="checkbox" name="mainCoaches" value={c.id} /> {c.user.name}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={fieldLabel}>Players</label>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", maxHeight: 150, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginTop: 4 }}>
                {players.length === 0 && <span style={{ fontSize: 12, color: "var(--text-faint)" }}>No players in the squad yet.</span>}
                {players.map((p) => (
                  <label key={p.id} style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <input type="checkbox" name="players" value={p.id} /> {p.name}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <button type="submit" style={{ marginTop: 14, padding: "9px 18px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Create Batch
          </button>
        </form>
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
                    Coaches: {b.mainCoaches.map((c) => c.user.name).join(", ") || "none assigned"}
                  </div>
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