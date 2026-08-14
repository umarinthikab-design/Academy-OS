"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPermissions } from "@/lib/permissions";
import { logActivity } from "@/lib/logActivity";
import { defaultSkillsForAge, ALL_SKILLS, PLAYER_POSITIONS } from "@/lib/skills";

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
  if (!name || !dobRaw) redirect("/squad?error=missing_fields");

  const dob = new Date(dobRaw);
  const player = await prisma.player.create({
    data: {
      name,
      dateOfBirth: dob,
      // New players start with their age-band skills active at a baseline
      // of 1, so the Squad page always has age-appropriate bars to show.
      skills: {
        create: defaultSkillsForAge(calculateAge(dob)).map((skillName) => ({ skillName, value: 1 })),
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

// Customize which skills appear on a player's card. `activeSkills` is the
// full set of skill names that should be visible; anything else the player
// has a row for gets its `active` flag flipped off (the row and its history
// are kept, just hidden).
export async function updatePlayerSkills(playerId: string, activeSkills: string[]) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditSquad)) redirect("/squad?error=no_permission");

  const activeSet = new Set(activeSkills.filter((s) => ALL_SKILLS.includes(s)));
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

  const photoUrl = formData.get("photoUrl") as string;
  const emergencyContactName = formData.get("emergencyContactName") as string;
  const emergencyContactPhone = formData.get("emergencyContactPhone") as string;
  const medicalNotes = formData.get("medicalNotes") as string;

  await prisma.player.update({
    where: { id: playerId },
    data: {
      photoUrl: photoUrl || null,
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
