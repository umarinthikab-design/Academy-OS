"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPermissions } from "@/lib/permissions";
import { logActivity } from "@/lib/logActivity";

// Club-wide configuration update. Admin/Club Manager-only (this is academy
// policy, not a per-head-coach permission toggle). The singleton row is
// created lazily by getAcademySettings in lib/confirmations.ts; here we just
// update it.
export async function updateAcademySettings(formData: FormData) {
  const perms = await getPermissions();
  if (!perms.isAdmin && !perms.isClubManager) redirect("/academy-settings?error=no_permission");

  const preSessionConfirmationEnabled = formData.get("preSessionConfirmationEnabled") === "on";
  const confirmationWindowHours = Math.max(1, Math.min(720, Number(formData.get("confirmationWindowHours")) || 72));
  const priorityWindowHours = Math.max(1, Math.min(720, Number(formData.get("priorityWindowHours")) || 48));

  // Priority window must be narrower than the confirmation window - the
  // "escalates" threshold can't exceed when the item first appears.
  if (priorityWindowHours >= confirmationWindowHours) {
    redirect("/academy-settings?error=priority_window");
  }

  await prisma.academySettings.upsert({
    where: { id: (await prisma.academySettings.findFirst())?.id ?? "__none__" },
    update: { preSessionConfirmationEnabled, confirmationWindowHours, priorityWindowHours },
    create: { preSessionConfirmationEnabled, confirmationWindowHours, priorityWindowHours },
  });

  if (perms.userId) await logActivity(perms.userId, "updated_academy_settings", "AcademySettings");
  revalidatePath("/academy-settings");
  revalidatePath("/");
  revalidatePath("/schedule");
  redirect("/academy-settings?success=Club settings updated.");
}
