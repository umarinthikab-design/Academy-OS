"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPermissions } from "@/lib/permissions";
import { logActivity } from "@/lib/logActivity";

export async function createLocation(formData: FormData) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditLocations)) redirect("/locations?error=no_permission");

  const name = formData.get("name") as string;
  if (!name) redirect("/locations?error=missing_fields");

  try {
    const location = await prisma.location.create({ data: { name } });
    if (perms.userId) await logActivity(perms.userId, "created_location", "Location", location.id, name);
  } catch {
    // Location.name is unique in the schema.
    redirect("/locations?error=duplicate_name");
  }

  revalidatePath("/locations");
  redirect(`/locations?success=${encodeURIComponent(`${name} added.`)}`);
}

export async function deleteLocation(id: string) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditLocations)) redirect("/locations?error=no_permission");

  // locationId is required (not optional) on ScheduledSession, so deleting a
  // location still referenced by a session would otherwise crash with an
  // unhandled database constraint error - check first, same pattern as
  // Age Groups and Batches.
  const sessionCount = await prisma.scheduledSession.count({ where: { locationId: id } });
  if (sessionCount > 0) redirect("/locations?error=in_use");

  await prisma.location.delete({ where: { id } });
  if (perms.userId) await logActivity(perms.userId, "deleted_location", "Location", id);
  revalidatePath("/locations");
  redirect("/locations?success=Location removed.");
}
