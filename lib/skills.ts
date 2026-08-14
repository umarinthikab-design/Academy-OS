// Single source of truth for the player rating system: playing positions and
// the age-band skill taxonomy. The schema stores Player.position and
// PlayerSkill.skillName as plain strings; these lists constrain what the UI
// offers, so nothing gets scattered across the DB.

export const PLAYER_POSITIONS = [
  "Unassigned (Default)",
  "Goalkeeper",
  "Defender",
  "Midfielder",
  "Forward",
] as const;

export type PlayerPosition = (typeof PLAYER_POSITIONS)[number];

export type SkillBand = {
  label: string;
  ageLabel: string;
  minAge: number;
  maxAge: number;
  skills: string[];
};

// Age-band skill categories. `minAge`/`maxAge` are inclusive ages used to
// map a player's date of birth onto a band. Every player starts with the
// skills of their band active on their card; the "customize skills" toggle
// lets a coach add or remove skills from there.
export const SKILL_BANDS: SkillBand[] = [
  {
    label: "Foundation",
    ageLabel: "U4–U6",
    minAge: 3,
    maxAge: 6,
    skills: ["Movement & Agility", "Ball Comfort", "Focus & Energy", "Social Sharing"],
  },
  {
    label: "Skill Acquisition",
    ageLabel: "U7–U10",
    minAge: 7,
    maxAge: 10,
    skills: ["Dribbling & 1v1", "First Touch", "Short Passing", "Shooting", "Coachability"],
  },
  {
    label: "Youth Development",
    ageLabel: "U11–U16",
    minAge: 11,
    maxAge: 16,
    skills: ["First Touch", "Passing Range", "Decision Making", "Tactical Awareness", "Physical Stamina", "Defending", "Shooting"],
  },
];

// Every skill across all bands, deduplicated (First Touch and Shooting appear
// in two bands). Used for the customize-skills checklist and for validating
// submitted skill names server-side.
export const ALL_SKILLS = [...new Set(SKILL_BANDS.flatMap((band) => band.skills))];

// The default active skill set for a player of a given birth date - the
// skills of their age band. Falls back to the youngest band for under-3s and
// the oldest for over-16s (which covers odd birth dates in demo data).
export function getSkillBandForAge(age: number): SkillBand {
  return SKILL_BANDS.find((band) => age >= band.minAge && age <= band.maxAge) ?? SKILL_BANDS[SKILL_BANDS.length - 1];
}

export function defaultSkillsForAge(age: number): string[] {
  return getSkillBandForAge(age).skills;
}

export function calculateAge(dob: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}
