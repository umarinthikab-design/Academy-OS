import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { createNote, updatePlayerInfo, updatePlayerStatus } from "../actions";
import { getPermissions } from "@/lib/permissions";
import { StatusBanner } from "@/components/StatusBanner";
import { PlayerRatingCard } from "@/components/PlayerRatingCard";
import { calculateAge, getSkillBandForAge } from "@/lib/skills";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { PlayerStatusBadge } from "@/components/ui/PlayerStatusBadge";
import { PlayerStatusSelect } from "@/components/ui/PlayerStatusSelect";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { inputBase } from "@/components/ui/Form";
import { PhotoUpload } from "@/components/ui/PhotoUpload";

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

  const sectionStyle: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: 16,
    marginBottom: 20,
    boxShadow: "var(--shadow-sm)",
  };

  return (
    <>
      <StatusBanner error={p.error} success={p.success} />

      {/* Player hero */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <Avatar name={player.name} src={player.photoUrl} size={72} />
        <div>
          <h1 style={{ fontSize: 26, margin: "0 0 4px", letterSpacing: "-0.02em" }}>{player.name}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: -9, flexWrap: "wrap" }}>
            <PlayerStatusBadge status={player.status} />
            <Badge tone="muted">Age {age}</Badge>
            {player.gender && <Badge tone="accent">{player.gender === "MALE" ? "Male" : player.gender === "FEMALE" ? "Female" : "Other"}</Badge>}
            <Badge tone="muted">Born {player.dateOfBirth.toLocaleDateString()}</Badge>
            <Badge tone="muted">Joined {player.dateJoined.toLocaleDateString()}</Badge>
            {player.batches.map((b) => (
              <Badge key={b.id} tone="blue">{b.name}</Badge>
            ))}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Position: <strong style={{ color: "var(--text)" }}>{player.position}</strong>
            {average > 0 && (
              <>
                {" "}· Average: <strong style={{ color: "var(--secondary)" }}>{average.toFixed(1)}</strong>/5
              </>
            )}
          </div>
          {canEdit && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Status:</label>
              <PlayerStatusSelect
                action={updatePlayerStatus.bind(null, player.id)}
                status={player.status}
              />
            </div>
          )}
        </div>
      </div>

      {/* Skill history / trend */}
      <section style={sectionStyle}>
        <SectionHeader title="Skills" />
        <PlayerRatingCard
          playerId={player.id}
          dateOfBirth={player.dateOfBirth.toISOString()}
          position={player.position}
          skills={player.skills.map((s) => ({ skillName: s.skillName, value: s.value, active: s.active }))}
          canEdit={canEdit}
        />
        <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          {skillTrend.map(({ skillName, current, history }) => (
            <div key={skillName} style={{ marginBottom: 6, fontSize: 12, color: "var(--text-muted)" }}>
              <strong style={{ color: "var(--text)" }}>{skillName}</strong>
              {history.length > 1 && (
                <span>
                  {" "}· Trend: {history.map((h) => `${h.value}@${h.recordedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`).join(" → ")}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Attended sessions */}
      <section style={sectionStyle}>
        <SectionHeader title={`Sessions attended (${player.attendance.length})`} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {player.attendance.map((att) => {
            const s = att.scheduledSession;
            return (
              <div key={att.id} style={{ fontSize: 13, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                <strong>{s.date.toLocaleDateString()}</strong> · {s.ageGroup.name} · {s.location.name}
                {s.session && <span style={{ color: "var(--secondary)" }}> · Plan: {s.session.name}</span>}
              </div>
            );
          })}
          {player.attendance.length === 0 && <p style={{ fontSize: 12, color: "var(--text-faint)" }}>No attended sessions recorded yet.</p>}
        </div>
      </section>

      {/* Areas trained most */}
      {topAreas.length > 0 && (
        <section style={sectionStyle}>
          <SectionHeader title="Areas trained most" />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginLeft: -9 }}>
            {topAreas.map(([category, count]) => (
              <Badge key={category} tone="green">{category} ×{count}</Badge>
            ))}
          </div>
        </section>
      )}

      {/* Coach notes */}
      <section style={sectionStyle}>
        <SectionHeader title="Coach notes" />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {player.notes.map((n) => (
            <div key={n.id} style={{ fontSize: 13, padding: "8px 10px", background: "var(--surface-muted)", borderRadius: 8 }}>
              <div>{n.content}</div>
              <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>
                {n.coach.user.name} · {n.createdAt.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          ))}
          {player.notes.length === 0 && <p style={{ fontSize: 12, color: "var(--text-faint)" }}>No notes yet.</p>}
        </div>
        {canEdit && (
          <form action={createNote.bind(null, player.id)} style={{ display: "flex", gap: 6 }}>
            <input name="content" placeholder="Add a note..." required style={{ ...inputBase, flex: 1, fontSize: 13 }} />
            <button type="submit" style={{ padding: "9px 14px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              Add
            </button>
          </form>
        )}
      </section>

      {/* Emergency / medical — safety-relevant, readable by any coach with
          squad view access, not gated behind edit permissions. */}
      <section style={{ ...sectionStyle, background: "var(--warning-bg)", border: "1px solid #fde68a" }}>
        <SectionHeader title="Emergency & medical" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 13 }} className="form-grid-2col">
          <div>
            <span style={{ color: "var(--text-muted)" }}>Emergency contact: </span>
            <strong>{player.emergencyContactName || "—"}</strong>
          </div>
          <div>
            <span style={{ color: "var(--text-muted)" }}>Phone: </span>
            <strong>{player.emergencyContactPhone || "—"}</strong>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <span style={{ color: "var(--text-muted)" }}>Medical notes: </span>
            <strong>{player.medicalNotes || "—"}</strong>
          </div>
        </div>

        {canEdit && (
          <form action={updatePlayerInfo.bind(null, player.id)} style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            <PhotoUpload name="photoUrl" current={player.photoUrl} label="Upload photo from device" />
            <div style={{ display: "flex", gap: 8 }}>
              <input name="emergencyContactName" placeholder="Emergency contact name" defaultValue={player.emergencyContactName ?? ""} style={{ ...inputBase, flex: 1, fontSize: 13 }} />
              <input name="emergencyContactPhone" placeholder="Emergency contact phone" defaultValue={player.emergencyContactPhone ?? ""} style={{ ...inputBase, flex: 1, fontSize: 13 }} />
            </div>
            <textarea name="medicalNotes" placeholder="Medical notes (allergies, conditions...)" defaultValue={player.medicalNotes ?? ""} style={{ ...inputBase, minHeight: 50, fontSize: 13 }} />
            <button type="submit" style={{ alignSelf: "flex-start", padding: "9px 16px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              Save details
            </button>
          </form>
        )}
      </section>
    </>
  );
}