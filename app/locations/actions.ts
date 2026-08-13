"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getPermissions } from "@/lib/permissions";

export async function createLocation(formData: FormData) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditLocations)) return;

  const name = formData.get("name") as string;
  if (!name) return;

  await prisma.location.create({ data: { name } });
  revalidatePath("/locations");
}

export async function deleteLocation(id: string) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditLocations)) return;

  await prisma.location.delete({ where: { id } });
  revalidatePath("/locations");
}
