import { prisma } from "@/lib/prisma";
import { getPermissions } from "@/lib/permissions";
import { StatusBanner } from "@/components/StatusBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { PromoteForm } from "@/components/ui/PromoteForm";

export default async function PromotePlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; batch?: string }>;
}) {
  const params = await searchParams;
  const perms = await getPermissions();

  // Admin/Club Manager-only: this is a structural/season decision, not one
  // of the six per-head-coach permission toggles.
  if (!perms.isAdmin && !perms.isClubManager) {
    return (
      <>
        <PageHeader title="Promote players" subtitle="Admin only — this moves players between batches in bulk." />
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>You don't have permission to use this tool.</p>
      </>
    );
  }

  const batches = await prisma.batch.findMany({
    include: { ageGroup: true, players: { orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });

  const sourceBatch = batches.find((b) => b.id === params.batch) ?? batches[0];
  const targetBatches = batches
    .filter((b) => b.id !== (sourceBatch?.id ?? ""))
    .map((b) => ({ id: b.id, name: `${b.name} (${b.ageGroup.name})` }));

  return (
    <>
      <PageHeader
        title="Promote players"
        subtitle="Season transition — move players from one batch to another in bulk. History stays with each player."
      />

      <StatusBanner error={params.error} success={params.success} />

      {!sourceBatch ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No batches yet. Create one on the <a href="/batches">Batches</a> page first.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            {batches.map((b) => (
              <a
                key={b.id}
                href={`/squad/promote?batch=${b.id}`}
                style={{
                  padding: "6px 12px",
                  borderRadius: "var(--radius-pill)",
                  border: `1px solid ${b.id === sourceBatch.id ? "var(--secondary)" : "var(--border)"}`,
                  background: b.id === sourceBatch.id ? "var(--secondary)" : "var(--surface)",
                  color: b.id === sourceBatch.id ? "#fff" : "var(--text)",
                  fontSize: 12,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                {b.name} ({b.players.length})
              </a>
            ))}
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 24, boxShadow: "var(--shadow-sm)" }}>
            <PromoteForm
              sourceBatch={{ id: sourceBatch.id, name: `${sourceBatch.name} (${sourceBatch.ageGroup.name})` }}
              targetBatchId={targetBatches[0]?.id ?? sourceBatch.id}
              targetBatches={targetBatches}
              players={sourceBatch.players.map((p) => ({ id: p.id, name: p.name }))}
            />
          </div>
        </div>
      )}
    </>
  );
}

export const dynamic = "force-dynamic";
