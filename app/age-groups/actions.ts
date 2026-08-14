"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPermissions } from "@/lib/permissions";
import { logActivity } from "@/lib/logActivity";
import { AgeGroupCategory } from "@prisma/client";

export async function createAgeGroup(formData: FormData) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditAgeGroups)) redirect("/age-groups?error=no_permission");

  const name = formData.get("name") as string;
  const category = formData.get("category") as string;
  if (!name) redirect("/age-groups?error=missing_fields");
  if (!Object.values(AgeGroupCategory).includes(category as AgeGroupCategory)) {
    redirect("/age-groups?error=missing_fields");
  }

  const count = await prisma.ageGroup.count();
  try {
    const ageGroup = await prisma.ageGroup.create({
      data: { name, category: category as AgeGroupCategory, sortOrder: count },
    });
    if (perms.userId) await logActivity(perms.userId, "created_age_group", "AgeGroup", ageGroup.id, name);
  } catch {
    // AgeGroup.name is unique in the schema.
    redirect("/age-groups?error=duplicate_name");
  }
  revalidatePath("/age-groups");
  redirect(`/age-groups?success=${encodeURIComponent(`${name} added.`)}`);
}

export async function deleteAgeGroup(id: string) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditAgeGroups)) redirect("/age-groups?error=no_permission");

  // Batches and Schedule entries require an age group (it's not optional in
  // the schema), so deleting one that's in use would fail with a database
  // error. Checked first to avoid that.
  const [batchCount, sessionCount] = await Promise.all([
    prisma.batch.count({ where: { ageGroupId: id } }),
    prisma.scheduledSession.count({ where: { ageGroupId: id } }),
  ]);
  if (batchCount > 0 || sessionCount > 0) redirect("/age-groups?error=in_use");

  await prisma.ageGroup.delete({ where: { id } });
  if (perms.userId) await logActivity(perms.userId, "deleted_age_group", "AgeGroup", id);
  revalidatePath("/age-groups");
  redirect("/age-groups?success=Age group removed.");
}
