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
        <div style={{ fontFamily: "var(--font-headline)", fontSize: 20, fontWeight: 600, color: "var(--primary)", marginBottom: 12 }}>{title}</div>
        {groups.length === 0 ? (
          <p style={{ color: "var(--text-faint)", fontSize: 13 }}>None yet.</p>
        ) : (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
            {groups.map((ag, idx) => {
              const inUse = ag._count.batches > 0 || ag._count.scheduledSessions > 0;
              return (
                <div
                  key={ag.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    padding: "14px 16px",
                    ...(idx > 0 ? { borderTop: "1px solid var(--border)" } : {}),
                    background: idx % 2 === 1 ? "var(--surface-muted)" : "var(--surface)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        background: "var(--surface-container)",
                        color: "var(--primary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: 12,
                        fontFamily: "var(--font-headline)",
                        flexShrink: 0,
                      }}
                    >
                      {ag.name.toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontFamily: "var(--font-headline)", fontSize: 16, fontWeight: 600, color: "var(--primary)" }}>{ag.name}</div>
                      {inUse ? (
                        <Badge tone="warning" style={{ marginTop: 4 }}>
                          In use · {ag._count.batches} batch{ag._count.batches === 1 ? "" : "es"}, {ag._count.scheduledSessions} session{ag._count.scheduledSessions === 1 ? "" : "s"}
                        </Badge>
                      ) : (
                        <Badge tone="muted" style={{ marginTop: 4 }}>Not in use</Badge>
                      )}
                    </div>
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