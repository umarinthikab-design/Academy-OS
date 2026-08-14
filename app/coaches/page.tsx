import { prisma } from "@/lib/prisma";
import { createCoach, deleteCoach, updateCoachPermission, revokeSessions } from "./actions";
import { getPermissions } from "@/lib/permissions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { StatusBanner } from "@/components/StatusBanner";

const PERMISSION_TOGGLES = [
  { field: "canEditRoster", label: "Edit Coach Roster" },
  { field: "canEditDrills", label: "Edit Drills" },
  { field: "canApproveRequests", label: "Approve Drill Suggestions" },
  { field: "canEditSchedule", label: "Edit Schedule" },
  { field: "canEditLocations", label: "Edit Locations" },
  { field: "canEditAgeGroups", label: "Edit Age Groups" },
] as const;

export default async function CoachesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const perms = await getPermissions();
  const [coaches, ageGroups] = await Promise.all([
    prisma.coach.findMany({
      include: { user: true, primaryFocus: true },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.ageGroup.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const canEdit = perms.isAdmin || perms.canEditRoster;

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 28, margin: "8px 0 20px" }}>Coach Roster</h1>

      <StatusBanner error={params.error} success={params.success} />

      {!canEdit && (
        <p style={{ fontSize: 13, color: "#6B7280", marginTop: -8, marginBottom: 20 }}>
          View only — you don't have edit access to the roster. Ask an administrator if you need it.
        </p>
      )}

      {canEdit && (
        <form
          action={createCoach}
          style={{
            background: "#fff",
            border: "2px solid var(--pitch)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
          }}
        >
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
            Name
          </label>
          <input
            name="name"
            required
            style={{ width: "100%", padding: 8, marginBottom: 12, border: "1px solid #d1d5db", borderRadius: 6 }}
          />

          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
            Email (this is what they'll log in with)
          </label>
          <input
            name="email"
            type="email"
            required
            style={{ width: "100%", padding: 8, marginBottom: 12, border: "1px solid #d1d5db", borderRadius: 6 }}
          />

          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
            Temporary password
          </label>
          <input
            name="password"
            type="text"
            required
            placeholder="Share this with them - they can log in immediately"
            style={{ width: "100%", padding: 8, marginBottom: 12, border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }}
          />

          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
            Designation
          </label>
          <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
            <label style={{ fontSize: 13 }}>
              <input type="radio" name="designation" value="HEAD" defaultChecked /> Head Coach
            </label>
            <label style={{ fontSize: 13 }}>
              <input type="radio" name="designation" value="ASSISTANT" /> Assistant Coach
            </label>
          </div>

          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
            Primary Focus
          </label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            {ageGroups.map((ag) => (
              <label key={ag.id} style={{ fontSize: 13 }}>
                <input type="checkbox" name="primaryFocus" value={ag.id} /> {ag.name}
              </label>
            ))}
            {ageGroups.length === 0 && (
              <span style={{ fontSize: 12, color: "#9CA3AF" }}>No age groups seeded yet.</span>
            )}
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
            Add Coach
          </button>
        </form>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {coaches.map((c) => (
          <div
            key={c.id}
            style={{
              background: "#fff",
              border: "2px solid var(--pitch)",
              borderRadius: 10,
              padding: "10px 14px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <strong>{c.user.name}</strong>{" "}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 20,
                    background: c.designation === "HEAD" ? "var(--pitch)" : "#457B9D",
                    color: "#fff",
                  }}
                >
                  {c.designation === "HEAD" ? "Head Coach" : "Assistant Coach"}
                </span>
                {c.primaryFocus.length > 0 && (
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                    Primary focus: {c.primaryFocus.map((a) => a.name).join(", ")}
                  </div>
                )}
              </div>
              {canEdit && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {perms.isAdmin && (
                    <form action={revokeSessions.bind(null, c.id)}>
                      <button
                        type="submit"
                        title="Invalidate all of this coach's active sessions so they must log in again"
                        style={{
                          fontSize: 11,
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: "1px solid #d1d5db",
                          background: "#fff",
                          color: "#6B7280",
                          cursor: "pointer",
                        }}
                      >
                        Revoke sessions
                      </button>
                    </form>
                  )}
                  <ConfirmDeleteButton
                    action={deleteCoach.bind(null, c.id)}
                    confirmMessage={`Remove ${c.user.name} from the roster? This can't be undone.`}
                  />
                </div>
              )}
            </div>

            {perms.isAdmin && c.designation === "HEAD" && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #E5E7EB" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 6 }}>
                  PERMISSIONS FOR THIS HEAD COACH
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {PERMISSION_TOGGLES.map((t) => (
                    <form key={t.field} action={updateCoachPermission.bind(null, c.id, t.field, !c[t.field])}>
                      <button
                        type="submit"
                        style={{
                          fontSize: 11,
                          padding: "4px 10px",
                          borderRadius: 20,
                          border: `1px solid ${c[t.field] ? "var(--turf)" : "#d1d5db"}`,
                          background: c[t.field] ? "var(--turf)" : "#fff",
                          color: c[t.field] ? "#fff" : "#6B7280",
                          cursor: "pointer",
                        }}
                      >
                        {t.label} {c[t.field] ? "✓" : ""}
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {coaches.length === 0 && <p style={{ color: "#6B7280" }}>No coaches yet — add your first one above.</p>}
      </div>
    </main>
  );
}
