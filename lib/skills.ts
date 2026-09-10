// Single source of truth for the player rating system's fixed structure:
// playing positions and the age-band boundaries. The skill dimensions
// within each band are admin-managed (see the SkillDefinition model in
// prisma/schema.prisma, and lib/skillDefinitions.ts for the DB-backed
// lookups that combine them with this metadata) - only the age ranges and
// band labels stay code-defined here.
//
// This file has no Prisma/DB import and stays that way: it's imported
// directly by the client component PlayerRatingCard, which can't hit the
// database itself and instead receives the resolved skill bands as a prop
// from its server-rendered parent page.

export const PLAYER_POSITIONS = [
  "Unassigned (Default)",
  "Goalkeeper",
  "Defender",
  "Midfielder",
  "Forward",
] as const;

export type PlayerPosition = (typeof PLAYER_POSITIONS)[number];

export type SkillBandMeta = {
  label: string;
  ageLabel: string;
  minAge: number;
  maxAge: number;
};

export type SkillBand = SkillBandMeta & { skills: string[] };

// Age-band boundaries. `minAge`/`maxAge` are inclusive ages used to map a
// player's date of birth onto a band; `label` is the value stored in
// SkillDefinition.band. Order matters - it's the display/customize order.
export const SKILL_BAND_META: SkillBandMeta[] = [
  { label: "Foundation", ageLabel: "U4–U6", minAge: 3, maxAge: 6 },
  { label: "Skill Acquisition", ageLabel: "U7–U10", minAge: 7, maxAge: 10 },
  { label: "Youth Development", ageLabel: "U11–U16", minAge: 11, maxAge: 16 },
];

export function getSkillBandMetaForAge(age: number): SkillBandMeta {
  return SKILL_BAND_META.find((band) => age >= band.minAge && age <= band.maxAge) ?? SKILL_BAND_META[SKILL_BAND_META.length - 1];
}

// Resolves the full band (metadata + its current admin-managed skill list)
// for an age, given an already-fetched `bands` array - see
// lib/skillDefinitions.ts's getSkillBands(). Kept pure/DB-free so client
// components can call it with server-fetched data passed down as a prop.
export function getSkillBandForAge(bands: SkillBand[], age: number): SkillBand {
  return bands.find((band) => age >= band.minAge && age <= band.maxAge) ?? bands[bands.length - 1];
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
