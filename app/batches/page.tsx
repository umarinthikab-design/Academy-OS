import { prisma } from "@/lib/prisma";
import { createBatch, deleteBatch } from "./actions";
import { getPermissions } from "@/lib/permissions";

export default async function BatchesPage() {
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

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 28, margin: "8px 0 20px" }}>Batches</h1>

      {!canEdit && (
        <p style={{ fontSize: 13, color: "#6B7280", marginTop: -8, marginBottom: 20 }}>
          View only — you don't have edit access to batches.
        </p>
      )}

      {missingPrereqs && canEdit && (
        <div style={{ background: "#FFF3CD", border: "2px solid var(--amber)", borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 13 }}>
          Add an <a href="/age-groups">age group</a> first.
        </div>
      )}

      {canEdit && !missingPrereqs && (
        <form
          action={createBatch}
          style={{ background: "#fff", border: "2px solid var(--pitch)", borderRadius: 12, padding: 16, marginBottom: 24 }}
        >
          <div className="form-grid-2col" style={{ marginBottom: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Batch name</label>
              <input name="name" required style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Age group</label>
              <select name="ageGroupId" required style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }}>
                {ageGroups.map((ag) => (
                  <option key={ag.id} value={ag.id}>{ag.name}</option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Main coaches</label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {coaches.length === 0 && <span style={{ fontSize: 12, color: "#9CA3AF" }}>No coaches in the roster yet.</span>}
                {coaches.map((c) => (
                  <label key={c.id} style={{ fontSize: 13 }}>
                    <input type="checkbox" name="mainCoaches" value={c.id} /> {c.user.name}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Players</label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", maxHeight: 140, overflowY: "auto" }}>
                {players.length === 0 && <span style={{ fontSize: 12, color: "#9CA3AF" }}>No players in the squad yet.</span>}
                {players.map((p) => (
                  <label key={p.id} style={{ fontSize: 13 }}>
                    <input type="checkbox" name="players" value={p.id} /> {p.name}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <button type="submit" style={{ padding: "8px 16px", background: "var(--pitch)", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>
            Create Batch
          </button>
        </form>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {batches.map((b) => (
          <div key={b.id} style={{ background: "#fff", border: "2px solid var(--pitch)", borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
              <div>
                <strong>{b.name}</strong>
                <span style={{ fontSize: 11, color: "#6B7280", marginLeft: 8 }}>{b.ageGroup.name}</span>
                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                  Coaches: {b.mainCoaches.map((c) => c.user.name).join(", ") || "none assigned"}
                </div>
                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                  Players ({b.players.length}): {b.players.map((p) => p.name).join(", ") || "none yet"}
                </div>
              </div>
              {canEdit && (
                <form action={deleteBatch.bind(null, b.id)}>
                  <button type="submit" style={{ background: "none", border: "none", color: "#E63946", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
                    Remove
                  </button>
                </form>
              )}
            </div>
          </div>
        ))}
        {batches.length === 0 && <p style={{ color: "#6B7280" }}>No batches yet.</p>}
      </div>
    </main>
  );
}
