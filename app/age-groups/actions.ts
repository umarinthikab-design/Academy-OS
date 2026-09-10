"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPermissions } from "@/lib/permissions";
import { logActivity } from "@/lib/logActivity";

export async function createAgeGroup(formData: FormData) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditAgeGroups)) redirect("/age-groups?error=no_permission");

  const name = formData.get("name") as string;
  const categoryId = formData.get("categoryId") as string;
  if (!name || !categoryId) redirect("/age-groups?error=missing_fields");

  const category = await prisma.ageGroupCategoryOption.findUnique({ where: { id: categoryId } });
  if (!category) redirect("/age-groups?error=missing_fields");

  const count = await prisma.ageGroup.count();
  try {
    const ageGroup = await prisma.ageGroup.create({
      data: { name, categoryId, sortOrder: count },
    });
    if (perms.userId) await logActivity(perms.userId, "created_age_group", "AgeGroup", ageGroup.id, name);
  } catch {
    // AgeGroup.name is unique in the schema.
    redirect("/age-groups?error=duplicate_name");
  }
  revalidatePath("/age-groups");
  redirect(`/age-groups?success=${encodeURIComponent(`${name} added.`)}`);
}

// Category management (add/rename/delete the AgeGroupCategoryOption rows
// themselves) is a structural, academy-wide decision - gated to
// isAdmin/isClubManager only, not the canEditAgeGroups toggle that governs
// day-to-day age group creation above.
export async function createAgeGroupCategory(formData: FormData) {
  const perms = await getPermissions();
  if (!perms.isAdmin && !perms.isClubManager) redirect("/age-groups?error=no_permission");

  const name = formData.get("name") as string;
  if (!name?.trim()) redirect("/age-groups?error=missing_fields");

  const count = await prisma.ageGroupCategoryOption.count();
  try {
    const category = await prisma.ageGroupCategoryOption.create({
      data: { name: name.trim(), sortOrder: count },
    });
    if (perms.userId) await logActivity(perms.userId, "created_age_group_category", "AgeGroupCategoryOption", category.id, category.name);
  } catch {
    redirect("/age-groups?error=duplicate_name");
  }
  revalidatePath("/age-groups");
  redirect(`/age-groups?success=${encodeURIComponent(`${name.trim()} category added.`)}`);
}

export async function renameAgeGroupCategory(id: string, formData: FormData) {
  const perms = await getPermissions();
  if (!perms.isAdmin && !perms.isClubManager) redirect("/age-groups?error=no_permission");

  const name = formData.get("name") as string;
  if (!name?.trim()) redirect("/age-groups?error=missing_fields");

  try {
    await prisma.ageGroupCategoryOption.update({ where: { id }, data: { name: name.trim() } });
  } catch {
    redirect("/age-groups?error=duplicate_name");
  }
  if (perms.userId) await logActivity(perms.userId, "renamed_age_group_category", "AgeGroupCategoryOption", id, name.trim());
  revalidatePath("/age-groups");
  redirect("/age-groups?success=Category renamed.");
}

export async function deleteAgeGroupCategory(id: string) {
  const perms = await getPermissions();
  if (!perms.isAdmin && !perms.isClubManager) redirect("/age-groups?error=no_permission");

  const inUse = await prisma.ageGroup.count({ where: { categoryId: id } });
  if (inUse > 0) redirect("/age-groups?error=in_use");

  await prisma.ageGroupCategoryOption.delete({ where: { id } });
  if (perms.userId) await logActivity(perms.userId, "deleted_age_group_category", "AgeGroupCategoryOption", id);
  revalidatePath("/age-groups");
  redirect("/age-groups?success=Category removed.");
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
