"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getPermissions } from "@/lib/permissions";

const DEFAULT_SKILLS = ["Passing", "Dribbling", "Shooting", "Defending"];

export async function createPlayer(formData: FormData) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditSquad)) return;

  const name = formData.get("name") as string;
  const dobRaw = formData.get("dateOfBirth") as string;
  if (!name || !dobRaw) return;

  await prisma.player.create({
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

  revalidatePath("/squad");
}

export async function updateSkill(playerId: string, skillName: string, value: number) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditSquad)) return;

  await prisma.playerSkill.upsert({
    where: { playerId_skillName: { playerId, skillName } },
    update: { value },
    create: { playerId, skillName, value },
  });
  revalidatePath("/squad");
}

export async function deletePlayer(id: string) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditSquad)) return;

  // PlayerSkill, Note, and PlayerAttendance rows are set to cascade in the
  // schema, and Prisma manages the implicit batch/parent join tables itself,
  // so this cleanly removes everything tied to the player.
  await prisma.player.delete({ where: { id } });
  revalidatePath("/squad");
}
