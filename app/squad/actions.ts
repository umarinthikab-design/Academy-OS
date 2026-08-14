"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPermissions } from "@/lib/permissions";
import { logActivity } from "@/lib/logActivity";

const DEFAULT_SKILLS = ["Passing", "Dribbling", "Shooting", "Defending"];

export async function createPlayer(formData: FormData) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditSquad)) redirect("/squad?error=no_permission");

  const name = formData.get("name") as string;
  const dobRaw = formData.get("dateOfBirth") as string;
  if (!name || !dobRaw) redirect("/squad?error=missing_fields");

  const player = await prisma.player.create({
    data: {
      name,
      dateOfBirth: new Date(dobRaw),
      // Every player starts with the four core skills at a baseline of 1,
      // so the Squad page always has something to show and update.
      skills: {
        create: DEFAULT_SKILLS.map((skillName) => ({ skillName, value: 1 })),
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
