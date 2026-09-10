"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPermissions } from "@/lib/permissions";
import { logActivity } from "@/lib/logActivity";
import { getSkillBandForAge, getSkillBandMetaForAge, PLAYER_POSITIONS, SKILL_BAND_META } from "@/lib/skills";
import { getSkillBands, getAllSkillNames } from "@/lib/skillDefinitions";
import { sanitizePhotoUrl } from "@/lib/photo";

function calculateAge(dob: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export async function createPlayer(formData: FormData) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditSquad)) redirect("/squad?error=no_permission");

  const name = formData.get("name") as string;
  const dobRaw = formData.get("dateOfBirth") as string;
  const genderRaw = formData.get("gender") as string;
  if (!name || !dobRaw || !genderRaw) redirect("/squad?error=missing_fields");

  const gender = genderRaw as "MALE" | "FEMALE" | "OTHER";
  if (!["MALE", "FEMALE", "OTHER"].includes(gender)) redirect("/squad?error=missing_fields");

  const dob = new Date(dobRaw);
  const photoUrl = sanitizePhotoUrl(formData.get("photoUrl") as string) || null;
  const bands = await getSkillBands();
  const band = getSkillBandForAge(bands, calculateAge(dob));
  const player = await prisma.player.create({
    data: {
      name,
      dateOfBirth: dob,
      gender,
      photoUrl,
      // New players start with their age-band skills active at a baseline
      // of 1, so the Squad page always has age-appropriate bars to show.
      skills: {
        create: band.skills.map((skillName) => ({ skillName, value: 1 })),
      },
    },
  });

  if (perms.userId) await logActivity(perms.userId, "created_player", "Player", player.id, name);

  revalidatePath("/squad");
  redirect(`/squad?success=${encodeURIComponent(`${name} added to the squad.`)}`);
}

export async function updateSkill(playerId: string, skillName: string, value: number) {
  const perms = await getPermissions();
  // No success redirect here on purpose - this fires on every single skill
  // click, and bouncing through a full page reload with a green banner every
  // time would be more annoying than helpful for something this frequent.
  if (!(perms.isAdmin || perms.canEditSquad)) redirect("/squad?error=no_permission");

  await prisma.playerSkill.upsert({
    where: { playerId_skillName: { playerId, skillName } },
    update: { value },
    create: { playerId, skillName, value },
  });
  // Append-only history so the player page can show a trend over time.
  await prisma.playerSkillHistory.create({ data: { playerId, skillName, value } });
  if (perms.userId) await logActivity(perms.userId, "updated_player_skill", "Player", playerId, `${skillName}=${value}`);
  revalidatePath("/squad");
  revalidatePath(`/squad/${playerId}`);
}

export async function updatePlayerPosition(playerId: string, position: string) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditSquad)) redirect("/squad?error=no_permission");

  if (!PLAYER_POSITIONS.includes(position as (typeof PLAYER_POSITIONS)[number])) {
    redirect(`/squad/${playerId}?error=invalid_position`);
  }

  await prisma.player.update({ where: { id: playerId }, data: { position } });
  if (perms.userId) await logActivity(perms.userId, "updated_player_position", "Player", playerId, position);
  revalidatePath("/squad");
  revalidatePath(`/squad/${playerId}`);
}

// Fast status flag on a player - settable from the squad list and the
// player page by anyone with squad-edit access. State is a small enum
// (ACTIVE / INJURED / SUSPENDED / INACTIVE) so it shows up as a pill
// everywhere.
export async function updatePlayerStatus(playerId: string, formData: FormData) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditSquad)) redirect("/squad?error=no_permission");

  const status = formData.get("status") as string;
  if (!["ACTIVE", "INJURED", "SUSPENDED", "INACTIVE"].includes(status)) {
    redirect(`/squad/${playerId}?error=invalid_status`);
  }

  await prisma.player.update({
    where: { id: playerId },
    data: { status: status as "ACTIVE" | "INJURED" | "SUSPENDED" | "INACTIVE", statusUpdatedAt: new Date() },
  });
  if (perms.userId) await logActivity(perms.userId, "updated_player_status", "Player", playerId, status);
  revalidatePath("/squad");
  revalidatePath(`/squad/${playerId}`);
}

// Customize which skills appear on a player's card. `activeSkills` is the
// full set of skill names that should be visible; anything else the player
// has a row for gets its `active` flag flipped off (the row and its history
// are kept, just hidden).
export async function updatePlayerSkills(playerId: string, activeSkills: string[]) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditSquad)) redirect("/squad?error=no_permission");

  const allSkillNames = await getAllSkillNames();
  const activeSet = new Set(activeSkills.filter((s) => allSkillNames.includes(s)));
  const existing = await prisma.playerSkill.findMany({ where: { playerId } });

  const existingBySkill = new Map(existing.map((s) => [s.skillName, s]));
  const updates = [...activeSet].map((skillName) => {
    const row = existingBySkill.get(skillName);
    if (row) {
      return prisma.playerSkill.update({ where: { id: row.id }, data: { active: true } });
    }
    return prisma.playerSkill.create({ data: { playerId, skillName, value: 1, active: true } });
  });
  for (const row of existing) {
    if (!activeSet.has(row.skillName) && row.active) {
      updates.push(prisma.playerSkill.update({ where: { id: row.id }, data: { active: false } }));
    }
  }
  await prisma.$transaction(updates);

  if (perms.userId) await logActivity(perms.userId, "updated_player_skills", "Player", playerId, [...activeSet].join(", "));
  revalidatePath("/squad");
  revalidatePath(`/squad/${playerId}`);
}

export async function createNote(playerId: string, formData: FormData) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditSquad)) redirect(`/squad/${playerId}?error=no_permission`);
  if (!perms.coachId) redirect(`/squad/${playerId}?error=no_permission`);

  const content = formData.get("content") as string;
  if (!content) redirect(`/squad/${playerId}?error=missing_fields`);

  const note = await prisma.note.create({
    data: { playerId, coachId: perms.coachId, content },
  });
  if (perms.userId) await logActivity(perms.userId, "added_player_note", "Player", playerId, note.id);
  revalidatePath(`/squad/${playerId}`);
  redirect(`/squad/${playerId}?success=Note added.`);
}

export async function updatePlayerInfo(playerId: string, formData: FormData) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditSquad)) redirect(`/squad/${playerId}?error=no_permission`);

  const photoUrl = sanitizePhotoUrl(formData.get("photoUrl") as string);
  const emergencyContactName = formData.get("emergencyContactName") as string;
  const emergencyContactPhone = formData.get("emergencyContactPhone") as string;
  const medicalNotes = formData.get("medicalNotes") as string;

  await prisma.player.update({
    where: { id: playerId },
    data: {
      photoUrl,
      emergencyContactName: emergencyContactName || null,
      emergencyContactPhone: emergencyContactPhone || null,
      medicalNotes: medicalNotes || null,
    },
  });

  if (perms.userId) await logActivity(perms.userId, "updated_player_profile", "Player", playerId);
  revalidatePath(`/squad/${playerId}`);
  redirect(`/squad/${playerId}?success=Player details updated.`);
}

export async function deletePlayer(id: string) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditSquad)) redirect("/squad?error=no_permission");

  // PlayerSkill, Note, and PlayerAttendance rows are set to cascade in the
  // schema, and Prisma manages the implicit batch/parent join tables itself,
  // so this cleanly removes everything tied to the player.
  await prisma.player.delete({ where: { id } });
  if (perms.userId) await logActivity(perms.userId, "deleted_player", "Player", id);
  revalidatePath("/squad");
  redirect("/squad?success=Player removed.");
}

// Season transition: bulk-move players from their current batch(es) to a
// target batch. Admin/Club Manager-only - this is a structural/season
// decision, not one of the six permission toggles, so it deliberately can't
// be delegated to a head coach. Only the batch membership join rows are
// touched: skills, skill history, notes, and attendance all stay attached to
// the player regardless of their current batch.
export async function promotePlayers(formData: FormData) {
  const perms = await getPermissions();
  if (!perms.isAdmin && !perms.isClubManager) redirect("/squad?error=no_permission");

  const targetBatchId = formData.get("targetBatchId") as string;
  const playerIds = formData.getAll("playerIds") as string[];
  if (!targetBatchId || playerIds.length === 0) redirect("/squad/promote?error=missing_fields");

  const targetBatch = await prisma.batch.findUnique({ where: { id: targetBatchId }, select: { name: true } });
  if (!targetBatch) redirect("/squad/promote?error=missing_fields");

  // Disconnect from all current batches, then connect to the target. Using a
  // transaction so a partial failure can't leave players half-moved.
  await prisma.$transaction(
    playerIds.map((playerId) =>
      prisma.player.update({
        where: { id: playerId },
        data: {
          batches: { set: [{ id: targetBatchId }] },
        },
      })
    )
  );

  if (perms.userId) await logActivity(perms.userId, "promoted_players", "Player", targetBatchId, `${playerIds.length} players to ${targetBatch.name}`);
  revalidatePath("/squad");
  revalidatePath("/squad/promote");
  redirect(`/squad/promote?success=${encodeURIComponent(`Moved ${playerIds.length} ${playerIds.length === 1 ? "player" : "players"} to ${targetBatch.name}.`)}`);
}

// Skill dimension management (add/rename/delete the SkillDefinition rows
// themselves) is a structural, academy-wide decision - gated to
// isAdmin/isClubManager only, not the canEditSquad rule that governs
// day-to-day skill rating above.
export async function createSkillDefinition(formData: FormData) {
  const perms = await getPermissions();
  if (!perms.isAdmin && !perms.isClubManager) redirect("/squad?error=no_permission");

  const name = formData.get("name") as string;
  const band = formData.get("band") as string;
  if (!name?.trim() || !SKILL_BAND_META.some((b) => b.label === band)) redirect("/squad?error=missing_fields");

  const count = await prisma.skillDefinition.count({ where: { band } });
  let skill;
  try {
    skill = await prisma.skillDefinition.create({ data: { name: name.trim(), band, sortOrder: count } });
  } catch {
    // (name, band) is unique in the schema.
    redirect("/squad?error=duplicate_name");
  }

  // Backfill a baseline rating of 1 for every existing player currently in
  // this skill's age band, the same way a newly-created player already gets
  // baseline rows for their band's skills (see createPlayer above) - without
  // this, the new dimension would silently be missing from every in-band
  // player already on the roster.
  const players = await prisma.player.findMany({ select: { id: true, dateOfBirth: true } });
  const playersInBand = players.filter((p) => getSkillBandMetaForAge(calculateAge(p.dateOfBirth)).label === band);
  if (playersInBand.length > 0) {
    await prisma.playerSkill.createMany({
      data: playersInBand.map((p) => ({ playerId: p.id, skillName: skill.name, value: 1 })),
      skipDuplicates: true,
    });
  }

  if (perms.userId) await logActivity(perms.userId, "created_skill_definition", "SkillDefinition", skill.id, `${skill.name} (${band})`);
  revalidatePath("/squad");
  redirect(`/squad?success=${encodeURIComponent(`${name.trim()} added to ${band}.`)}`);
}

// Renaming a dimension does NOT rename existing PlayerSkill/PlayerSkillHistory
// rows - this table isn't a foreign key for exactly that reason (see the
// comment on SkillDefinition in prisma/schema.prisma). Existing ratings keep
// their old name; the new name only applies going forward.
export async function renameSkillDefinition(id: string, formData: FormData) {
  const perms = await getPermissions();
  if (!perms.isAdmin && !perms.isClubManager) redirect("/squad?error=no_permission");

  const name = formData.get("name") as string;
  if (!name?.trim()) redirect("/squad?error=missing_fields");

  try {
    await prisma.skillDefinition.update({ where: { id }, data: { name: name.trim() } });
  } catch {
    redirect("/squad?error=duplicate_name");
  }
  if (perms.userId) await logActivity(perms.userId, "renamed_skill_definition", "SkillDefinition", id, name.trim());
  revalidatePath("/squad");
  redirect("/squad?success=Skill renamed.");
}

export async function deleteSkillDefinition(id: string) {
  const perms = await getPermissions();
  if (!perms.isAdmin && !perms.isClubManager) redirect("/squad?error=no_permission");

  const skill = await prisma.skillDefinition.findUnique({ where: { id } });
  if (!skill) redirect("/squad");

  // No foreign key here (see the model comment), so "in use" is checked
  // against the string value rather than a relation count.
  const [ratingCount, historyCount] = await Promise.all([
    prisma.playerSkill.count({ where: { skillName: skill.name } }),
    prisma.playerSkillHistory.count({ where: { skillName: skill.name } }),
  ]);
  if (ratingCount > 0 || historyCount > 0) redirect("/squad?error=skill_in_use");

  await prisma.skillDefinition.delete({ where: { id } });
  if (perms.userId) await logActivity(perms.userId, "deleted_skill_definition", "SkillDefinition", id, skill.name);
  revalidatePath("/squad");
  redirect("/squad?success=Skill removed.");
}
