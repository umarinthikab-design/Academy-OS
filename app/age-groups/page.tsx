import { prisma } from "@/lib/prisma";
import { createAgeGroup, deleteAgeGroup, createAgeGroupCategory, renameAgeGroupCategory, deleteAgeGroupCategory } from "./actions";
import { getPermissions } from "@/lib/permissions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { StatusBanner } from "@/components/StatusBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CollapsibleCreate } from "@/components/ui/CollapsibleCreate";
import { inputBase } from "@/components/ui/Form";

export default async function AgeGroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const perms = await getPermissions();
  const canEdit = perms.isAdmin || perms.canEditAgeGroups;
  // Managing the categories themselves (add/rename/delete) is a structural,
  // academy-wide decision - gated to isAdmin/isClubManager, separate from
  // canEditAgeGroups which governs day-to-day age group creation below.
  const canManageCategories = perms.isAdmin || perms.isClubManager;

  const [ageGroups, categories] = await Promise.all([
    prisma.ageGroup.findMany({
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      include: {
        category: true,
        _count: { select: { batches: true, scheduledSessions: true } },
      },
    }),
    prisma.ageGroupCategoryOption.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { ageGroups: true } } },
    }),
  ]);

  function groupSection(key: string, title: string, groups: typeof ageGroups) {
    return (
      <div key={key} style={{ marginBottom: 20 }}>
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

      {canManageCategories && (
        <CollapsibleCreate title="Manage categories" subtitle={`${categories.length}`}>
          <form
            action={createAgeGroupCategory}
            style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 16 }}
          >
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>New category name</label>
              <input name="name" placeholder="e.g. Elite Academy" required style={inputBase} />
            </div>
            <button type="submit" style={{ padding: "9px 18px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
              Add Category
            </button>
          </form>

          {categories.length === 0 ? (
            <p style={{ color: "var(--text-faint)", fontSize: 13 }}>No categories yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {categories.map((c) => {
                const inUse = c._count.ageGroups > 0;
                return (
                  <div
                    key={c.id}
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
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{c.name}</span>
                      <Badge tone={inUse ? "warning" : "muted"}>
                        {inUse ? `In use · ${c._count.ageGroups} age group${c._count.ageGroups === 1 ? "" : "s"}` : "Not in use"}
                      </Badge>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <details>
                        <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, color: "var(--secondary)", outline: "none", listStyle: "none" }}>Rename</summary>
                        <form action={renameAgeGroupCategory.bind(null, c.id)} style={{ display: "flex", gap: 6, marginTop: 8 }}>
                          <input name="name" defaultValue={c.name} required style={{ ...inputBase, fontSize: 12.5, padding: "6px 9px", width: 180 }} />
                          <button type="submit" style={{ padding: "6px 12px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                            Save
                          </button>
                        </form>
                      </details>
                      {!inUse && (
                        <ConfirmDeleteButton
                          action={deleteAgeGroupCategory.bind(null, c.id)}
                          confirmMessage={`Remove the "${c.name}" category? This can't be undone.`}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CollapsibleCreate>
      )}

      {canEdit && categories.length > 0 && (
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
            <select name="categoryId" required defaultValue={categories[0]?.id ?? ""} style={inputBase}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" style={{ padding: "9px 18px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Add Age Group
          </button>
        </form>
      )}

      {categories.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No categories yet"
          message={canManageCategories ? "Add a category above before creating age groups." : "Ask an administrator to set up age group categories."}
        />
      ) : (
        <>
          {categories.map((c) => groupSection(c.id, c.name, ageGroups.filter((ag) => ag.categoryId === c.id)))}
          {ageGroups.length === 0 && <p style={{ color: "var(--text-muted)" }}>No age groups yet.</p>}
        </>
      )}
    </>
  );
}
