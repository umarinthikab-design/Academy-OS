"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPermissions } from "@/lib/permissions";
import { logActivity } from "@/lib/logActivity";

export async function createBatch(formData: FormData) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditBatches)) redirect("/batches?error=no_permission");

  const name = formData.get("name") as string;
  const ageGroupId = formData.get("ageGroupId") as string;
  const mainCoachIds = formData.getAll("mainCoaches") as string[];
  const supportingCoachIds = formData.getAll("supportingCoaches") as string[];
  const playerIds = formData.getAll("players") as string[];

  if (!name || !ageGroupId) redirect("/batches?error=missing_fields");

  const batch = await prisma.batch.create({
    data: {
      name,
      ageGroupId,
      mainCoaches: { connect: mainCoachIds.map((id) => ({ id })) },
      supportingCoaches: { connect: supportingCoachIds.map((id) => ({ id })) },
      players: { connect: playerIds.map((id) => ({ id })) },
    },
  });

  if (perms.userId) await logActivity(perms.userId, "created_batch", "Batch", batch.id, name);

  revalidatePath("/batches");
  redirect(`/batches?success=${encodeURIComponent(`${name} created.`)}`);
}

export async function deleteBatch(id: string) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditBatches)) redirect("/batches?error=no_permission");

  // If any ScheduledSession points at this batch, the delete would fail
  // (batchId isn't set to cascade). Checked first to avoid a crash.
  const sessionCount = await prisma.scheduledSession.count({ where: { batchId: id } });
  if (sessionCount > 0) redirect("/batches?error=in_use");

  await prisma.batch.delete({ where: { id } });
  if (perms.userId) await logActivity(perms.userId, "deleted_batch", "Batch", id);
  revalidatePath("/batches");
  redirect("/batches?success=Batch removed.");
}
