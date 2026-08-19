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

  // Academy branding - name is required with a sane length cap; an empty logo
  // URL clears the logo and falls back to the text name everywhere.
  const academyName = String(formData.get("academyName") || "").trim().slice(0, 60) || "My Academy";
  const logoUrlRaw = formData.get("logoUrl");
  const logoUrl = typeof logoUrlRaw === "string" && logoUrlRaw.trim() ? logoUrlRaw.trim() : null;

  // Priority window must be narrower than the confirmation window - the
  // "escalates" threshold can't exceed when the item first appears.
  if (priorityWindowHours >= confirmationWindowHours) {
    redirect("/academy-settings?error=priority_window");
  }

  // "Club managers can author drills" is an admin-only decision - the form
  // field is hidden from club managers, so when they save we preserve the
  // current value instead of resetting it to off.
  const existing = await prisma.academySettings.findFirst();
  const clubManagersCanAuthorDrills = perms.isAdmin
    ? formData.get("clubManagersCanAuthorDrills") === "on"
    : (existing?.clubManagersCanAuthorDrills ?? true);

  await prisma.academySettings.upsert({
    where: { id: existing?.id ?? "__none__" },
    update: {
      preSessionConfirmationEnabled,
      confirmationWindowHours,
      priorityWindowHours,
      clubManagersCanAuthorDrills,
      academyName,
      logoUrl,
    },
    create: {
      preSessionConfirmationEnabled,
      confirmationWindowHours,
      priorityWindowHours,
      clubManagersCanAuthorDrills,
      academyName,
      logoUrl,
    },
  });

  if (perms.userId) await logActivity(perms.userId, "updated_academy_settings", "AcademySettings");
  revalidatePath("/academy-settings");
  revalidatePath("/");
  revalidatePath("/login");
  revalidatePath("/schedule");
  revalidatePath("/drills");
  redirect("/academy-settings?success=Club settings updated.");
}
