import { prisma } from "@/lib/prisma";
import { createPlayer, updateSkill, deletePlayer } from "./actions";
import { getPermissions } from "@/lib/permissions";

const SKILLS = ["Passing", "Dribbling", "Shooting", "Defending"];

function calculateAge(dob: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export default async function SquadPage() {
  const perms = await getPermissions();
  const canEdit = perms.isAdmin || perms.canEditSquad;
  const players = await prisma.player.findMany({
    include: { skills: true },
    orderBy: { name: "asc" },
  });

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 28, margin: "8px 0 20px" }}>Squad</h1>

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

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {players.map((p) => (
          <div
            key={p.id}
            style={{
              background: "#fff",
              border: "2px solid var(--pitch)",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <strong style={{ fontSize: 16 }}>{p.name}</strong>
                <span style={{ fontSize: 12, color: "#6B7280", marginLeft: 8 }}>
                  Age {calculateAge(p.dateOfBirth)}
                </span>
              </div>
              {canEdit && (
                <form action={deletePlayer.bind(null, p.id)}>
                  <button
                    type="submit"
                    style={{ background: "none", border: "none", color: "#E63946", cursor: "pointer", fontWeight: 700, fontSize: 12 }}
                  >
                    Remove
                  </button>
                </form>
              )}
            </div>

            <div style={{ marginTop: 10 }}>
              {SKILLS.map((skillName) => {
                const current = p.skills.find((s) => s.skillName === skillName)?.value ?? 0;
                return (
                  <div key={skillName} style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 2 }}>
                      {skillName} — {current}/5
                    </div>
                    <div style={{ display: "flex", gap: 3 }}>
                      {[1, 2, 3, 4, 5].map((n) =>
                        canEdit ? (
                          <form key={n} action={updateSkill.bind(null, p.id, skillName, n)}>
                            <button
                              type="submit"
                              style={{
                                width: 32,
                                height: 20,
                                border: "none",
                                borderRadius: 4,
                                cursor: "pointer",
                                background: n <= current ? "var(--turf)" : "#E5E7EB",
                              }}
                              aria-label={`Set ${skillName} to ${n}`}
                            />
                          </form>
                        ) : (
                          <div
                            key={n}
                            style={{
                              width: 32,
                              height: 20,
                              borderRadius: 4,
                              background: n <= current ? "var(--turf)" : "#E5E7EB",
                            }}
                          />
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {players.length === 0 && <p style={{ color: "#6B7280" }}>No players yet — add your first one above.</p>}
      </div>
    </main>
  );
}
