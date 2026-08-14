import { prisma } from "@/lib/prisma";
import { createPlayer, deletePlayer } from "./actions";
import { getPermissions } from "@/lib/permissions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { StatusBanner } from "@/components/StatusBanner";
import { PlayerRatingCard } from "@/components/PlayerRatingCard";
import { calculateAge } from "@/lib/skills";
import Link from "next/link";

// Filtering is in-memory via URLSearchParams read from searchParams - the
// Server Component reads them directly, no client state needed. This is the
// right call at current data volume; move to DB-level where clauses once
// player counts pass a few hundred.
export default async function SquadPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; age?: string; batch?: string; dobFrom?: string; dobTo?: string; joinedFrom?: string; joinedTo?: string }>;
}) {
  const params = await searchParams;
  const perms = await getPermissions();
  const canEdit = perms.isAdmin || perms.canEditSquad;

  const ageFilter = params.age ? Number(params.age) : null;
  const batchFilter = params.batch || null;
  const dobFrom = params.dobFrom ? new Date(params.dobFrom) : null;
  const dobTo = params.dobTo ? new Date(params.dobTo) : null;
  const joinedFrom = params.joinedFrom ? new Date(params.joinedFrom) : null;
  const joinedTo = params.joinedTo ? new Date(params.joinedTo) : null;

  const players = await prisma.player.findMany({
    include: { skills: true, batches: { include: { ageGroup: true } } },
    orderBy: { name: "asc" },
  });

  const filtered = players.filter((p) => {
    if (ageFilter !== null && calculateAge(p.dateOfBirth) !== ageFilter) return false;
    if (batchFilter && !p.batches.some((b) => b.id === batchFilter)) return false;
    if (dobFrom && p.dateOfBirth < dobFrom) return false;
    if (dobTo && p.dateOfBirth > dobTo) return false;
    if (joinedFrom && p.dateJoined < joinedFrom) return false;
    if (joinedTo && p.dateJoined > joinedTo) return false;
    return true;
  });

  const batches = await prisma.batch.findMany({ orderBy: { name: "asc" }, include: { ageGroup: true } });

  const hasFilters = !!params.age || !!params.batch || !!params.dobFrom || !!params.dobTo || !!params.joinedFrom || !!params.joinedTo;

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 28, margin: "8px 0 20px" }}>Squad</h1>

      <StatusBanner error={params.error} success={params.success} />

      {!canEdit && (
        <p style={{ fontSize: 13, color: "#6B7280", marginTop: -8, marginBottom: 20 }}>
          View only — squad editing is limited to admins and head coaches for now.
        </p>
      )}

      {canEdit && (
        <form
          action={createPlayer}
          style={{
            background: "#fff",
            border: "2px solid var(--pitch)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}
        >
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
              Name
            </label>
            <input
              name="name"
              required
              style={{ padding: 8, border: "1px solid #d1d5db", borderRadius: 6 }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
              Date of birth
            </label>
            <input
              name="dateOfBirth"
              type="date"
              required
              style={{ padding: 8, border: "1px solid #d1d5db", borderRadius: 6 }}
            />
          </div>
          <button
            type="submit"
            style={{
              padding: "8px 16px",
              background: "var(--pitch)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Add Player
          </button>
        </form>
      )}

      {/* Filter bar */}
      <form
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "flex-end",
          background: "#fff",
          border: "2px solid var(--turf)",
          borderRadius: 12,
          padding: 14,
          marginBottom: 20,
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Age</label>
          <input name="age" type="number" min={1} defaultValue={params.age ?? ""} style={{ width: 70, padding: 6, border: "1px solid #d1d5db", borderRadius: 6 }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Batch</label>
          <select name="batch" defaultValue={params.batch ?? ""} style={{ padding: 6, border: "1px solid #d1d5db", borderRadius: 6 }}>
            <option value="">All</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name} ({b.ageGroup.name})</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>DOB from</label>
          <input name="dobFrom" type="date" defaultValue={params.dobFrom ?? ""} style={{ padding: 6, border: "1px solid #d1d5db", borderRadius: 6 }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>DOB to</label>
          <input name="dobTo" type="date" defaultValue={params.dobTo ?? ""} style={{ padding: 6, border: "1px solid #d1d5db", borderRadius: 6 }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Joined from</label>
          <input name="joinedFrom" type="date" defaultValue={params.joinedFrom ?? ""} style={{ padding: 6, border: "1px solid #d1d5db", borderRadius: 6 }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Joined to</label>
          <input name="joinedTo" type="date" defaultValue={params.joinedTo ?? ""} style={{ padding: 6, border: "1px solid #d1d5db", borderRadius: 6 }} />
        </div>
        <button
          type="submit"
          style={{ padding: "6px 14px", border: "1px solid var(--turf)", background: "var(--turf)", color: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}
        >
          Filter
        </button>
        {hasFilters && (
          <a href="/squad" style={{ fontSize: 12, color: "#6B7280", padding: "6px 0" }}>
            Clear
          </a>
        )}
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {filtered.map((p) => (
          <div
            key={p.id}
            style={{
              background: "#fff",
              border: "2px solid var(--pitch)",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
              <div>
                <Link href={`/squad/${p.id}`} style={{ fontSize: 16, fontWeight: 800, color: "var(--pitch)", textDecoration: "none" }}>
                  {p.name}
                </Link>
                <span style={{ fontSize: 12, color: "#6B7280", marginLeft: 8 }}>
                  Age {calculateAge(p.dateOfBirth)}
                </span>
                {p.batches.length > 0 && (
                  <span style={{ fontSize: 12, color: "#6B7280", marginLeft: 8 }}>
                    · {p.batches.map((b) => b.name).join(", ")}
                  </span>
                )}
              </div>
              {canEdit && (
                <ConfirmDeleteButton
                  action={deletePlayer.bind(null, p.id)}
                  confirmMessage={`Remove ${p.name} from the squad? This deletes their skills and notes too and can't be undone.`}
                />
              )}
            </div>

            <PlayerRatingCard
              playerId={p.id}
              dateOfBirth={p.dateOfBirth.toISOString()}
              position={p.position}
              skills={p.skills.map((s) => ({ skillName: s.skillName, value: s.value, active: s.active }))}
              canEdit={canEdit}
            />
          </div>
        ))}
        {filtered.length === 0 && <p style={{ color: "#6B7280" }}>No players match the current filters.</p>}
        {!hasFilters && filtered.length === 0 && <p style={{ color: "#6B7280" }}>No players yet — add your first one above.</p>}
      </div>
    </main>
  );
}