"use client";

import { Button } from "@/components/ui/Button";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PLAYER_POSITIONS, calculateAge, getSkillBandForAge, type SkillBand } from "@/lib/skills";
import { updateSkill, updatePlayerPosition, updatePlayerSkills } from "@/app/squad/actions";

type SkillRow = { skillName: string; value: number; active: boolean };

// The skills block used on the squad cards and the player detail page: position,
// average, one row per active skill with a 5-segment bar, and an "Edit skills"
// toggle that shows a checklist of every skill grouped by age band.
// Layout and colours live in the pr-* classes in globals.css.
export function PlayerRatingCard({
  playerId,
  dateOfBirth,
  position,
  skills,
  canEdit,
  skillBands,
}: {
  playerId: string;
  dateOfBirth: string;
  position: string;
  skills: SkillRow[];
  canEdit: boolean;
  skillBands: SkillBand[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [customizing, setCustomizing] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);

  const age = calculateAge(new Date(dateOfBirth));
  const band = getSkillBandForAge(skillBands, age);
  const allSkillNames = [...new Set(skillBands.flatMap((b) => b.skills))];

  const activeSkills = skills.filter((s) => s.active);
  // Legacy players may have no rows for their age band - fall back to the
  // band's skills so the card is never empty.
  const visibleSkills =
    (activeSkills.length > 0 ? activeSkills : band.skills.map((skillName) => ({ skillName, value: 0, active: true })))
      // Stable display order regardless of DB row order; unknown names last.
      .slice()
      .sort((a, b) => {
        const ia = allSkillNames.indexOf(a.skillName);
        const ib = allSkillNames.indexOf(b.skillName);
        if (ia === -1 && ib === -1) return 0;
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });

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

  const skillRow = (skillName: string, current: number) => (
    <div key={skillName} className="pr-skill" data-lv={current}>
      <div className="pr-skill-head">
        <span className="pr-skill-name">{skillName}</span>
        <span className="pr-skill-score">{current}/5</span>
      </div>
      <div className="pr-bar">
        {[1, 2, 3, 4, 5].map((n) =>
          canEdit ? (
            <button
              key={n}
              type="button"
              className={`pr-seg${n <= current ? " on" : ""}`}
              onClick={() => onSkillClick(skillName, n)}
              aria-label={`Set ${skillName} to ${n}`}
            />
          ) : (
            <div key={n} className={`pr-seg${n <= current ? " on" : ""}`} />
          )
        )}
      </div>
    </div>
  );

  return (
    <div className="pr-card">
      <div className="pr-top">
        <div className="pr-pos">
          <label>Position</label>
          {canEdit ? (
            <select value={position} disabled={pending} onChange={(e) => onPosition(e.target.value)}>
              {PLAYER_POSITIONS.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
          ) : (
            <span className="pr-pos-val">{position}</span>
          )}
        </div>
        <div className="pr-avg">
          Avg <b>{average > 0 ? average.toFixed(1) : "—"}</b>
          {average > 0 && <span>/ 5</span>}
        </div>
      </div>

      {customizing ? (
        <div className="pr-edit">
          <div className="pr-edit-title">
            Select skills to show for this player
            <span> — age band: {band.ageLabel} {band.label}</span>
          </div>
          {skillBands.map((b) => (
            <div key={b.label}>
              <div className="pr-band-label">{b.ageLabel} · {b.label}</div>
              <div className="pr-chips">
                {b.skills.map((skillName) => (
                  <label key={skillName} className="pr-chip" data-on={draft.includes(skillName) ? "1" : "0"}>
                    <input type="checkbox" checked={draft.includes(skillName)} onChange={() => toggleDraft(skillName)} />
                    {skillName}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div className="pr-edit-actions">
            <Button size="sm" type="button" onClick={saveCustomize} disabled={pending}>{pending ? "Saving..." : "Save skills"}</Button>
            <Button variant="outline" size="sm" type="button" onClick={() => setCustomizing(false)} style={{ color: "var(--text-muted)" }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="pr-grid">
          {visibleSkills.map((s) => skillRow(s.skillName, s.value))}
          {visibleSkills.length === 0 && <div className="pr-empty">No skills selected.</div>}
        </div>
      )}

      {canEdit && !customizing && (
        <div className="pr-foot">
          <Button variant="outline" size="sm" type="button" onClick={openCustomize} style={{ color: "var(--turf)", borderColor: "var(--turf)" }}>Edit skills</Button>
        </div>
      )}
    </div>
  );
}