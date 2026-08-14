import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { createNote, updatePlayerInfo } from "../actions";
import { getPermissions } from "@/lib/permissions";
import { StatusBanner } from "@/components/StatusBanner";
import { PlayerRatingCard } from "@/components/PlayerRatingCard";
import { calculateAge, getSkillBandForAge } from "@/lib/skills";

export default async function PlayerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { id } = await params;
  const p = await searchParams;
  const perms = await getPermissions();
  const canEdit = perms.isAdmin || perms.canEditSquad;

  const player = await prisma.player.findUnique({
    where: { id },
    include: {
      batches: { include: { ageGroup: true } },
      skills: true,
      skillHistory: { orderBy: { recordedAt: "asc" } },
      notes: { include: { coach: { include: { user: true } } }, orderBy: { createdAt: "desc" } },
      attendance: {
        where: { status: "ATTENDED" },
        include: {
          scheduledSession: {
            include: {
              ageGroup: true,
              location: true,
              session: { include: { drills: { include: { drill: true }, orderBy: { order: "asc" } } } },
            },
          },
        },
        orderBy: { scheduledSession: { date: "desc" } },
      },
    },
  });

  if (!player) notFound();

  // Drills trained on, derived from attended sessions → attached plan →
  // SessionDrill → Drill. Count per category to show "areas trained most".
  const categoryCounts = new Map<string, number>();
  for (const att of player.attendance) {
    const plan = att.scheduledSession.session;
    if (!plan) continue;
    for (const sd of plan.drills) {
      categoryCounts.set(sd.drill.category, (categoryCounts.get(sd.drill.category) ?? 0) + 1);
    }
  }
  const topAreas = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const age = calculateAge(player.dateOfBirth);
  const band = getSkillBandForAge(age);

  // Same visible-skill logic as the squad card: show the player's active
  // skills, falling back to their age band's skills if none are active yet.
  const activeSkills = player.skills.filter((s) => s.active);
  const visibleSkillNames = activeSkills.length > 0 ? activeSkills.map((s) => s.skillName) : band.skills;

  const skillTrend = visibleSkillNames.map((skillName) => {
    const history = player.skillHistory.filter((h) => h.skillName === skillName);
    const current = player.skills.find((s) => s.skillName === skillName)?.value ?? 0;
    return { skillName, current, history };
  });

  const rated = activeSkills.filter((s) => s.value > 0);
  const average = rated.length ? rated.reduce((sum, s) => sum + s.value, 0) / rated.length : 0;

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px" }}>
      <StatusBanner error={p.error} success={p.success} />

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        {player.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={player.photoUrl}
            alt={player.name}
            style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--pitch)" }}
          />
        ) : (
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "var(--turf)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              fontWeight: 800,
            }}
          >
            {player.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h1 style={{ fontSize: 26, margin: "0 0 4px" }}>{player.name}</h1>
          <div style={{ fontSize: 13, color: "#6B7280" }}>
            Age {age} · Born {player.dateOfBirth.toLocaleDateString()} · Joined{" "}
            {player.dateJoined.toLocaleDateString()}
          </div>
          {player.batches.length > 0 && (
            <div style={{ fontSize: 13, color: "#6B7280" }}>
              {player.batches.map((b) => `${b.name} (${b.ageGroup.name})`).join(", ")}
            </div>
          )}
          <div style={{ fontSize: 13, color: "#6B7280" }}>
            Position: <strong>{player.position}</strong>
            {average > 0 && (
              <span>
                {" "}
                · Average: <strong style={{ color: "var(--turf)" }}>{average.toFixed(1)}</strong>/5
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Skill history / trend */}
      <section style={{ background: "#fff", border: "2px solid var(--pitch)", borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>Skills</h2>
        <PlayerRatingCard
          playerId={player.id}
          dateOfBirth={player.dateOfBirth.toISOString()}
          position={player.position}
          skills={player.skills.map((s) => ({ skillName: s.skillName, value: s.value, active: s.active }))}
          canEdit={canEdit}
        />
        <div style={{ marginTop: 12, borderTop: "1px solid #F3F4F6", paddingTop: 10 }}>
          {skillTrend.map(({ skillName, current, history }) => (
            <div key={skillName} style={{ marginBottom: 6, fontSize: 12, color: "#6B7280" }}>
              <strong style={{ color: "#374151" }}>{skillName}</strong>
              {history.length > 1 && (
                <span>
                  {" "}
                  · Trend: {history.map((h) => `${h.value}@${h.recordedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`).join(" → ")}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Attended sessions */}
      <section style={{ background: "#fff", border: "2px solid var(--pitch)", borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>Sessions attended ({player.attendance.length})</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {player.attendance.map((att) => {
            const s = att.scheduledSession;
            return (
              <div key={att.id} style={{ fontSize: 13, padding: "4px 0", borderBottom: "1px solid #F3F4F6" }}>
                <strong>{s.date.toLocaleDateString()}</strong> · {s.ageGroup.name} · {s.location.name}
                {s.session && <span style={{ color: "var(--turf)" }}> · Plan: {s.session.name}</span>}
              </div>
            );
          })}
          {player.attendance.length === 0 && <p style={{ fontSize: 12, color: "#9CA3AF" }}>No attended sessions recorded yet.</p>}
        </div>
      </section>

      {/* Areas trained most */}
      {topAreas.length > 0 && (
        <section style={{ background: "#fff", border: "2px solid var(--pitch)", borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>Areas trained most</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {topAreas.map(([category, count]) => (
              <span key={category} style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20, background: "var(--turf)", color: "#fff" }}>
                {category} ×{count}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Coach notes */}
      <section style={{ background: "#fff", border: "2px solid var(--pitch)", borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>Coach notes</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {player.notes.map((n) => (
            <div key={n.id} style={{ fontSize: 13, padding: "8px 10px", background: "#F9FAFB", borderRadius: 8 }}>
              <div>{n.content}</div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                {n.coach.user.name} · {n.createdAt.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          ))}
          {player.notes.length === 0 && <p style={{ fontSize: 12, color: "#9CA3AF" }}>No notes yet.</p>}
        </div>
        {canEdit && (
          <form action={createNote.bind(null, player.id)} style={{ display: "flex", gap: 6 }}>
            <input name="content" placeholder="Add a note..." required style={{ flex: 1, padding: 8, border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 }} />
            <button type="submit" style={{ padding: "8px 14px", background: "var(--pitch)", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              Add
            </button>
          </form>
        )}
      </section>

      {/* Emergency / medical — safety-relevant, readable by any coach with
          squad view access, not gated behind edit permissions. */}
      <section style={{ background: "#FFF3CD", border: "2px solid var(--amber)", borderRadius: 12, padding: 16 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>Emergency & medical</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 13 }}>
          <div>
            <span style={{ color: "#6B7280" }}>Emergency contact: </span>
            <strong>{player.emergencyContactName || "—"}</strong>
          </div>
          <div>
            <span style={{ color: "#6B7280" }}>Phone: </span>
            <strong>{player.emergencyContactPhone || "—"}</strong>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <span style={{ color: "#6B7280" }}>Medical notes: </span>
            <strong>{player.medicalNotes || "—"}</strong>
          </div>
        </div>

        {canEdit && (
          <form
            action={updatePlayerInfo.bind(null, player.id)}
            style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}
          >
            <input name="photoUrl" placeholder="Photo URL (e.g. hosted avatar link)" defaultValue={player.photoUrl ?? ""} style={{ padding: 8, border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <input name="emergencyContactName" placeholder="Emergency contact name" defaultValue={player.emergencyContactName ?? ""} style={{ flex: 1, padding: 8, border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 }} />
              <input name="emergencyContactPhone" placeholder="Emergency contact phone" defaultValue={player.emergencyContactPhone ?? ""} style={{ flex: 1, padding: 8, border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 }} />
            </div>
            <textarea name="medicalNotes" placeholder="Medical notes (allergies, conditions...)" defaultValue={player.medicalNotes ?? ""} style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, minHeight: 50, boxSizing: "border-box" }} />
            <button type="submit" style={{ alignSelf: "flex-start", padding: "8px 14px", background: "var(--pitch)", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              Save details
            </button>
          </form>
        )}
      </section>
    </main>
  );
}