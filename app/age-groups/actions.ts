"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getPermissions } from "@/lib/permissions";

export async function createAgeGroup(formData: FormData) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditAgeGroups)) return;

  const name = formData.get("name") as string;
  if (!name) return;

  const count = await prisma.ageGroup.count();
  await prisma.ageGroup.create({ data: { name, sortOrder: count } });
  revalidatePath("/age-groups");
}

export async function deleteAgeGroup(id: string) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditAgeGroups)) return;

  // Batches and Schedule entries require an age group (it's not optional in
  // the schema), so deleting one that's in use would fail with a database
  // error. We check first and silently skip the delete instead of crashing -
  // a friendlier "can't delete, here's why" message needs a client component,
  // which isn't built yet.
  const [batchCount, sessionCount] = await Promise.all([
    prisma.batch.count({ where: { ageGroupId: id } }),
    prisma.scheduledSession.count({ where: { ageGroupId: id } }),
  ]);
  if (batchCount > 0 || sessionCount > 0) return;

  await prisma.ageGroup.delete({ where: { id } });
  revalidatePath("/age-groups");
}
