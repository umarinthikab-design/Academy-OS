import { prisma } from "@/lib/prisma";
import { createAgeGroup, deleteAgeGroup } from "./actions";
import { getPermissions } from "@/lib/permissions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { StatusBanner } from "@/components/StatusBanner";

const CATEGORY_LABELS: Record<string, string> = {
  LITTLE_LEAGUE: "Little League",
  JUNIOR_VARSITY: "Junior Varsity",
};

export default async function AgeGroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const perms = await getPermissions();
  const canEdit = perms.isAdmin || perms.canEditAgeGroups;
  const ageGroups = await prisma.ageGroup.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    include: {
      _count: { select: { batches: true, scheduledSessions: true } },
    },
  });

  const littleLeague = ageGroups.filter((ag) => ag.category === "LITTLE_LEAGUE");
  const juniorVarsity = ageGroups.filter((ag) => ag.category === "JUNIOR_VARSITY");

  function groupSection(title: string, groups: typeof ageGroups) {
    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 8 }}>{title}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {groups.map((ag) => {
            const inUse = ag._count.batches > 0 || ag._count.scheduledSessions > 0;
            return (
              <div
                key={ag.id}
                style={{
                  background: "#fff",
                  border: "2px solid var(--pitch)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong>{ag.name}</strong>
                  {inUse && (
                    <span style={{ fontSize: 11, color: "#6B7280", marginLeft: 8 }}>
                      In use ({ag._count.batches} batch{ag._count.batches === 1 ? "" : "es"}, {ag._count.scheduledSessions} session{ag._count.scheduledSessions === 1 ? "" : "s"}) — can't delete until removed from those
                    </span>
                  )}
                </div>
                {canEdit && !inUse && (
                  <ConfirmDeleteButton
                    action={deleteAgeGroup.bind(null, ag.id)}
                    confirmMessage={`Remove ${ag.name}? This can't be undone.`}
                  />
                )}
              </div>
            );
          })}
          {groups.length === 0 && <p style={{ color: "#9CA3AF", fontSize: 13 }}>None yet.</p>}
        </div>
      </div>
    );
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 28, margin: "8px 0 20px" }}>Age Groups</h1>

      <StatusBanner error={params.error} success={params.success} />

      {!canEdit && (
        <p style={{ fontSize: 13, color: "#6B7280", marginTop: -8, marginBottom: 20 }}>
          View only — you don't have edit access to age groups.
        </p>
      )}

      {canEdit && (
        <form
          action={createAgeGroup}
          style={{
            background: "#fff",
            border: "2px solid var(--pitch)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
            display: "flex",
            gap: 10,
          }}
        >
          <input
            name="name"
            placeholder="e.g. U17"
            required
            style={{ flex: 1, padding: 8, border: "1px solid #d1d5db", borderRadius: 6 }}
          />
          <select name="category" required defaultValue="JUNIOR_VARSITY" style={{ padding: 8, border: "1px solid #d1d5db", borderRadius: 6 }}>
            <option value="LITTLE_LEAGUE">Little League</option>
            <option value="JUNIOR_VARSITY">Junior Varsity</option>
          </select>
          <button
            type="submit"
            style={{ padding: "8px 16px", background: "var(--pitch)", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}
          >
            Add Age Group
          </button>
        </form>
      )}

      {groupSection("Little League", littleLeague)}
      {groupSection("Junior Varsity", juniorVarsity)}
      {ageGroups.length === 0 && <p style={{ color: "#6B7280" }}>No age groups yet.</p>}
    </main>
  );
}
