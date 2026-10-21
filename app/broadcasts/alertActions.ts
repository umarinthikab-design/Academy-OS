"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPermissions } from "@/lib/permissions";
import { markRead } from "@/lib/notifications";

// Dismiss one alert. `back` says where to return to: the dashboard (default)
// or the Alerts tab.
export async function dismissAlert(formData: FormData) {
  const perms = await getPermissions();
  const id = String(formData.get("id") || "");
  if (perms.userId && id) await markRead(perms.userId, id);
  revalidatePath("/");
  revalidatePath("/broadcasts");
  redirect(formData.get("back") === "alerts" ? "/broadcasts?tab=alerts" : "/");
}

export async function markAllAlertsRead() {
  const perms = await getPermissions();
  if (perms.userId) {
    await prisma.notification.updateMany({ where: { userId: perms.userId, readAt: null, sentById: null }, data: { readAt: new Date() } });
  }
  revalidatePath("/");
  revalidatePath("/broadcasts");
  redirect("/broadcasts?tab=alerts");
}

export async function markAllBroadcastsRead() {
  const perms = await getPermissions();
  if (perms.userId) {
    await prisma.notification.updateMany({ where: { userId: perms.userId, readAt: null, sentById: { not: null } }, data: { readAt: new Date() } });
  }
  revalidatePath("/");
  revalidatePath("/broadcasts");
  redirect("/broadcasts");
}
