// Server-only DB-backed lookups for the skill rating taxonomy. Combines the
// fixed band metadata (lib/skills.ts) with the current admin-managed skill
// lists (SkillDefinition). Never import this from a client component -
// pass its results down as props instead (see PlayerRatingCard).

import { prisma } from "./prisma";
import { SKILL_BAND_META, type SkillBand } from "./skills";

export async function getSkillBands(): Promise<SkillBand[]> {
  const definitions = await prisma.skillDefinition.findMany({ orderBy: { sortOrder: "asc" } });
  return SKILL_BAND_META.map((meta) => ({
    ...meta,
    skills: definitions.filter((d) => d.band === meta.label).map((d) => d.name),
  }));
}

// Every skill name across all bands, deduplicated (a name can appear in more
// than one band, e.g. "Shooting"). Used to validate a submitted skill name
// and to sort a player's skill bars into a stable, taxonomy-driven order.
export async function getAllSkillNames(): Promise<string[]> {
  const definitions = await prisma.skillDefinition.findMany({ orderBy: { sortOrder: "asc" } });
  return [...new Set(definitions.map((d) => d.name))];
}
