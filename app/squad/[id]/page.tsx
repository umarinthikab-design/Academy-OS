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

  const activeSkills = player.skills.filter((s) => s.active);
  const visibleSkillNames = activeSkills.length > 0 ? activeSkills.map((s) => s.skillName) : band.skills;

  const skillTrend = visibleSkillNames.map((skillName) => {
    const history = player.skillHistory.filter((h) => h.skillName === skillName);
    const current = player.skills.find((s) => s.skillName === skillName)?.value ?? 0;
    return { skillName, current, history };
  });

  const rated = activeSkills.filter((s) => s.value > 0);
  const average = rated.length ? rated.reduce((sum, s) => sum + s.value, 0) / rated.length : 0;

  const card: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    padding: 24,
    boxShadow: "var(--shadow-sm)",
  };

  const labelCaps: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono-label)",
  };

  return (
    <>
      <StatusBanner error={p.error} success={p.success} />

      {/* Hero card */}
      <div style={{ ...card, display: "flex", gap: 24, position: "relative", overflow: "hidden", marginBottom: 24 }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: "var(--secondary)" }} />
        <div style={{ marginLeft: 12, flexShrink: 0 }}>
          <Avatar name={player.name} src={player.photoUrl} size={120} style={{ borderRadius: "var(--radius)" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: "var(--font-headline)", fontSize: 32, fontWeight: 600, color: "var(--primary)", letterSpacing: "-0.02em", margin: "0 0 8px" }}>{player.name}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            <PlayerStatusBadge status={player.status} statusUpdatedAt={player.statusUpdatedAt} />
            <Badge tone="muted">Age {age}</Badge>
            {player.gender && <Badge tone="accent">{player.gender === "MALE" ? "Male" : player.gender === "FEMALE" ? "Female" : "Other"}</Badge>}
            {player.batches.map((b) => (
              <Badge key={b.id} tone="blue">{b.name}</Badge>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <div>
              <div style={labelCaps}>Position</div>
              <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "var(--font-headline)", color: "var(--text)" }}>{player.position}</div>
            </div>
            <div>
              <div style={labelCaps}>Average Rating</div>
              <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "var(--font-headline)", color: average > 0 ? "var(--secondary)" : "var(--text-faint)" }}>{average > 0 ? `${average.toFixed(1)} / 5` : "—"}</div>
            </div>
            <div>
              <div style={labelCaps}>Joined</div>
              <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "var(--font-headline)", color: "var(--text)" }}>{player.dateJoined.toLocaleDateString(undefined, { month: "short", year: "numeric" })}</div>
            </div>
          </div>
          {canEdit && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>Status:</span>
              <PlayerStatusSelect action={updatePlayerStatus.bind(null, player.id)} status={player.status} />
            </div>
          )}
        </div>
      </div>

      {/* Two-column: Skills + Coach Notes */}
      <div className="detail-grid" style={{ marginBottom: 20 }}>
        <section style={card}>
          <SectionHeader title="Skill Ratings" />
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

        <section style={{ ...card, display: "flex", flexDirection: "column" }}>
          <SectionHeader title="Coach Notes" />
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {player.notes.map((n) => (
              <div key={n.id} style={{ fontSize: 13, padding: "8px 10px", background: "var(--surface-muted)", borderRadius: "var(--radius-sm)", borderLeft: "3px solid var(--secondary)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ ...labelCaps, fontSize: 10 }}>{n.coach.user.name}</span>
                  <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{n.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                </div>
                <div>{n.content}</div>
              </div>
            ))}
            {player.notes.length === 0 && <p style={{ fontSize: 12, color: "var(--text-faint)" }}>No notes yet.</p>}
          </div>
          {canEdit && (
            <form action={createNote.bind(null, player.id)} style={{ display: "flex", gap: 6 }}>
              <input name="content" placeholder="Add a note..." required style={{ ...inputBase, flex: 1, fontSize: 13 }} />
              <button type="submit" style={{ padding: "9px 14px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Add</button>
            </form>
          )}
        </section>
      </div>

      {/* Sessions attended */}
      <section style={{ ...card, marginBottom: 20 }}>
        <SectionHeader title={`Sessions attended (${player.attendance.length})`} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          {player.attendance.map((att) => {
            const s = att.scheduledSession;
            return (
              <div key={att.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <strong>{s.date.toLocaleDateString()}</strong>
                  <span style={{ color: "var(--text-muted)" }}> · {s.ageGroup.name} · {s.location.name}</span>
                  {s.session && <span style={{ color: "var(--secondary)" }}> · Plan: {s.session.name}</span>}
                </div>
              </div>
            );
          })}
          {player.attendance.length === 0 && <p style={{ fontSize: 12, color: "var(--text-faint)", padding: "8px 0" }}>No attended sessions recorded yet.</p>}
        </div>
      </section>

      {/* Areas trained most */}
      {topAreas.length > 0 && (
        <section style={{ ...card, marginBottom: 20 }}>
          <SectionHeader title="Areas trained most" />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {topAreas.map(([category, count]) => (
              <Badge key={category} tone="green">{category} ×{count}</Badge>
            ))}
          </div>
        </section>
      )}

      {/* Emergency / medical */}
      <section style={{ ...card, background: "var(--warning-bg)", border: "1px solid #fde68a" }}>
        <SectionHeader title="Emergency & medical" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }} className="form-grid-2col">
          <div>
            <div style={labelCaps}>Emergency contact</div>
            <div style={{ fontWeight: 600 }}>{player.emergencyContactName || "—"}</div>
          </div>
          <div>
            <div style={labelCaps}>Phone</div>
            <div style={{ fontWeight: 600 }}>{player.emergencyContactPhone || "—"}</div>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={labelCaps}>Medical notes</div>
            <div style={{ fontWeight: 600 }}>{player.medicalNotes || "—"}</div>
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
            <button type="submit" style={{ alignSelf: "flex-start", padding: "9px 16px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Save details</button>
          </form>
        )}
      </section>
    </>
  );
}
