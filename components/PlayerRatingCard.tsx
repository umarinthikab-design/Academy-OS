"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PLAYER_POSITIONS, SKILL_BANDS, calculateAge, getSkillBandForAge } from "@/lib/skills";
import { updateSkill, updatePlayerPosition, updatePlayerSkills } from "@/app/squad/actions";

type SkillRow = { skillName: string; value: number; active: boolean };

// The rating block on each squad card (and used by the player detail page):
// position selector, the 1-5 bars for active skills in a 2-column grid, the
// average rating, and an "edit / customize skills" toggle that shows a
// checklist of every skill in the taxonomy grouped by age band.
export function PlayerRatingCard({
  playerId,
  dateOfBirth,
  position,
  skills,
  canEdit,
}: {
  playerId: string;
  dateOfBirth: string;
  position: string;
  skills: SkillRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [customizing, setCustomizing] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);

  const age = calculateAge(new Date(dateOfBirth));
  const band = getSkillBandForAge(age);

  const activeSkills = skills.filter((s) => s.active);
  // Legacy players (created before the taxonomy) may have no rows for their
  // age band - fall back to the band's skills so the card is never empty.
  const visibleSkills =
    activeSkills.length > 0
      ? activeSkills
      : band.skills.map((skillName) => ({ skillName, value: 0, active: true }));

  const rated = visibleSkills.filter((s) => s.value > 0);
  const average = rated.length ? rated.reduce((sum, s) => sum + s.value, 0) / rated.length : 0;

  const openCustomize = () => {
    setDraft(activeSkills.length > 0 ? activeSkills.map((s) => s.skillName) : band.skills);
    setCustomizing(true);
  };

  const saveCustomize = () => {
    startTransition(async () => {
      await updatePlayerSkills(playerId, draft);
      setCustomizing(false);
      router.refresh();
    });
  };

  const toggleDraft = (skillName: string) => {
    setDraft((prev) => (prev.includes(skillName) ? prev.filter((s) => s !== skillName) : [...prev, skillName]));
  };

  const onPosition = (value: string) => {
    startTransition(async () => {
      await updatePlayerPosition(playerId, value);
      router.refresh();
    });
  };

  const onSkillClick = (skillName: string, value: number) => {
    startTransition(async () => {
      await updateSkill(playerId, skillName, value);
      router.refresh();
    });
  };

  const skillBar = (skillName: string, current: number, fullWidth: boolean) => (
    <div key={skillName} style={fullWidth ? { gridColumn: "1 / -1", marginBottom: 4 } : { marginBottom: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 2 }}>
        {skillName} — {current}/5
      </div>
      <div style={{ display: "flex", gap: 3 }}>
        {[1, 2, 3, 4, 5].map((n) =>
          canEdit ? (
            <button
              key={n}
              type="button"
              onClick={() => onSkillClick(skillName, n)}
              style={{
                width: 32,
                height: 20,
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                background: n <= current ? "var(--turf)" : "var(--border)",
              }}
              aria-label={`Set ${skillName} to ${n}`}
            />
          ) : (
            <div
              key={n}
              style={{
                width: 32,
                height: 20,
                borderRadius: 4,
                background: n <= current ? "var(--turf)" : "var(--border)",
              }}
            />
          )
        )}
      </div>
    </div>
  );

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>Position</label>
          {canEdit ? (
            <select
              value={position}
              disabled={pending}
              onChange={(e) => onPosition(e.target.value)}
              style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, background: "var(--surface)", color: "var(--text)" }}
            >
              {PLAYER_POSITIONS.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{position}</span>
          )}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--pitch)" }}>
          Average <span style={{ color: "var(--turf)" }}>{average > 0 ? average.toFixed(1) : "—"}</span>
          {average > 0 && <span style={{ color: "var(--text-muted)", fontWeight: 500 }}> / 5</span>}
        </div>
        {canEdit && !customizing && (
          <button
            type="button"
            onClick={openCustomize}
            style={{ fontSize: 12, fontWeight: 700, padding: "5px 10px", border: "1px solid var(--turf)", background: "var(--surface)", color: "var(--turf)", borderRadius: 6, cursor: "pointer" }}
          >
            Edit / Customize Skills
          </button>
        )}
      </div>

      {customizing ? (
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10, background: "var(--surface-muted)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>
            Select skills to show for this player
            <span style={{ fontWeight: 500, color: "var(--text-faint)" }}> — age band: {band.ageLabel} {band.label}</span>
          </div>
          {SKILL_BANDS.map((b) => (
            <div key={b.label} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                {b.ageLabel} · {b.label}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {b.skills.map((skillName) => (
                  <label key={skillName} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer", padding: "3px 8px", borderRadius: 6, background: draft.includes(skillName) ? "var(--turf)" : "var(--surface)", color: draft.includes(skillName) ? "#fff" : "var(--text)", border: "1px solid var(--border)" }}>
                    <input
                      type="checkbox"
                      checked={draft.includes(skillName)}
                      onChange={() => toggleDraft(skillName)}
                      style={{ display: "none" }}
                    />
                    {skillName}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" onClick={saveCustomize} disabled={pending} style={{ fontSize: 12, fontWeight: 700, padding: "6px 14px", background: "var(--pitch)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
              {pending ? "Saving..." : "Save skills"}
            </button>
            <button type="button" onClick={() => setCustomizing(false)} style={{ fontSize: 12, fontWeight: 700, padding: "6px 14px", background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
          {visibleSkills.map((s, i) => skillBar(s.skillName, s.value, visibleSkills.length % 2 === 1 && i === visibleSkills.length - 1))}
          {visibleSkills.length === 0 && <div style={{ fontSize: 12, color: "var(--text-faint)" }}>No skills selected.</div>}
        </div>
      )}
    </div>
  );
}