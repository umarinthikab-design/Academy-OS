"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getPermissions } from "@/lib/permissions";

export async function createBatch(formData: FormData) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditBatches)) return;

  const name = formData.get("name") as string;
  const ageGroupId = formData.get("ageGroupId") as string;
  const coachIds = formData.getAll("mainCoaches") as string[];
  const playerIds = formData.getAll("players") as string[];

  if (!name || !ageGroupId) return;

  await prisma.batch.create({
    data: {
      name,
      ageGroupId,
      mainCoaches: { connect: coachIds.map((id) => ({ id })) },
      players: { connect: playerIds.map((id) => ({ id })) },
    },
  });

  revalidatePath("/batches");
}

export async function deleteBatch(id: string) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditBatches)) return;

  // If any ScheduledSession points at this batch, the delete will fail
  // (batchId isn't set to cascade). Same limitation as Age Groups - checked
  // first to avoid a crash, silently no-ops if in use.
  const sessionCount = await prisma.scheduledSession.count({ where: { batchId: id } });
  if (sessionCount > 0) return;

  await prisma.batch.delete({ where: { id } });
  revalidatePath("/batches");
}
