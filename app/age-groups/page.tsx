import { prisma } from "@/lib/prisma";
import { createAgeGroup, deleteAgeGroup } from "./actions";
import { getPermissions } from "@/lib/permissions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { StatusBanner } from "@/components/StatusBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { inputBase } from "@/components/ui/Form";

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
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 8 }}>{title}</div>
        {groups.length === 0 ? (
          <p style={{ color: "var(--text-faint)", fontSize: 13 }}>None yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {groups.map((ag) => {
              const inUse = ag._count.batches > 0 || ag._count.scheduledSessions > 0;
              return (
                <div
                  key={ag.id}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    padding: "12px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <strong style={{ fontSize: 14 }}>{ag.name}</strong>
                    {inUse && (
                      <Badge tone="warning">
                        In use · {ag._count.batches} batch{ag._count.batches === 1 ? "" : "es"}, {ag._count.scheduledSessions} session{ag._count.scheduledSessions === 1 ? "" : "s"}
                      </Badge>
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
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Age Groups"
        subtitle={canEdit ? "The age bands that structure your batches and sessions." : "View only — you don't have edit access to age groups."}
      />

      <StatusBanner error={params.error} success={params.success} />

      {canEdit && (
        <form
          action={createAgeGroup}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-sm)",
            padding: 18,
            marginBottom: 24,
            display: "flex",
            gap: 10,
            alignItems: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Name</label>
            <input name="name" placeholder="e.g. U17" required style={inputBase} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Category</label>
            <select name="category" required defaultValue="JUNIOR_VARSITY" style={inputBase}>
              <option value="LITTLE_LEAGUE">Little League</option>
              <option value="JUNIOR_VARSITY">Junior Varsity</option>
            </select>
          </div>
          <button type="submit" style={{ padding: "9px 18px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Add Age Group
          </button>
        </form>
      )}

      {groupSection("Little League", littleLeague)}
      {groupSection("Junior Varsity", juniorVarsity)}
      {ageGroups.length === 0 && <p style={{ color: "var(--text-muted)" }}>No age groups yet.</p>}
    </>
  );
}