"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPermissions } from "@/lib/permissions";
import { logActivity } from "@/lib/logActivity";
import { sanitizePhotoUrl } from "@/lib/photo";
import { sendPushToUser } from "@/lib/pushNotifications";
import { notifyApprovers } from "@/lib/notifyApprovers";

// Coaches who approve requests can also attach photos. URLs come through as
// downscaled data URLs from DrillPhotoUpload (one hidden input per photo).
function cleanPhotoUrls(formData: FormData): string[] {
  const urls = (formData.getAll("photoUrls") as string[])
    .map((u) => sanitizePhotoUrl(u))
    .filter((u): u is string => !!u);
  // De-dupe (a photo kept through an edit round-trips as the same data URL)
  // while preserving order.
  return Array.from(new Set(urls));
}

function createPhotoRows(urls: string[]) {
  return urls.map((url, i) => ({ url, sortOrder: i }));
}

export async function createDrill(formData: FormData) {
  const perms = await getPermissions();
  // Coaches always author drills; admins always; club managers when the
  // admin allows it (Club Settings). createdById is nullable because admins
  // and club managers have no Coach row.
  if (!perms.canAuthorDrills) redirect("/drills?error=no_permission");

  const name = formData.get("name") as string;
  const categoryId = formData.get("categoryId") as string;
  const duration = Number(formData.get("duration"));
  const playerRange = formData.get("playerRange") as string;
  const description = formData.get("description") as string;
  const ageGroupIds = formData.getAll("ageGroups") as string[];

  if (!name || !categoryId || !duration) redirect("/drills?error=missing_fields");

  // Coaches who can approve requests publish straight into the library (no
  // approval round-trip on their own suggestion). Everyone else submits a
  // suggestion that starts PENDING and needs an explicit approval.
  const status = perms.isAdmin || perms.isClubManager || perms.canApproveRequests ? "APPROVED" : "PENDING";
  const drill = await prisma.drill.create({
    data: {
      name,
      categoryId,
      duration,
      playerRange,
      description,
      createdById: perms.coachId,
      status,
      ageGroups: { connect: ageGroupIds.map((id) => ({ id })) },
      photos: { create: createPhotoRows(cleanPhotoUrls(formData)) },
    },
  });

  if (perms.userId) await logActivity(perms.userId, "created_drill", "Drill", drill.id, name);

  // Only worth notifying anyone when this actually needs someone's approval -
  // a drill published straight to the library (by someone who can already
  // approve, or an admin/CM) has nothing pending. Awaited (not
  // fire-and-forget) because a serverless function invocation can end as
  // soon as redirect() responds, which would abandon an un-awaited promise
  // mid-flight; wrapped in try/catch so a push failure never breaks drill
  // creation itself.
  if (status === "PENDING") {
    try {
      await notifyApprovers({ type: "DRILL" }, "New drill suggestion", `"${name}" is waiting for approval.`, "/drills");
    } catch {
      // See above - notification delivery is best-effort.
    }
  }

  revalidatePath("/drills");
  redirect(`/drills?success=${encodeURIComponent(status === "APPROVED" ? `${name} published to the library.` : `${name} submitted for approval.`)}`);
}

// Edit an existing drill's details. Allowed for anyone with canEditDrills
// (admins and club managers always, head coaches via permission override).
// Editing an approved drill keeps it approved; editing a pending suggestion
// keeps it pending. No Coach row required - admin/CM edits aren't tied to a
// coach identity.
export async function updateDrill(drillId: string, formData: FormData) {
  const perms = await getPermissions();
  if (!perms.canEditDrills) redirect("/drills?error=no_permission");

  const name = formData.get("name") as string;
  const categoryId = formData.get("categoryId") as string;
  const duration = Number(formData.get("duration"));
  const playerRange = formData.get("playerRange") as string;
  const description = formData.get("description") as string;
  const ageGroupIds = formData.getAll("ageGroups") as string[];

  if (!name || !categoryId || !duration) redirect("/drills?error=missing_fields");

  await prisma.drill.update({
    where: { id: drillId },
    data: {
      name,
      categoryId,
      duration,
      playerRange,
      description,
      ageGroups: { set: ageGroupIds.map((id) => ({ id })) },
      photos: {
        // The edit form round-trips every kept photo (existing + new) as a
        // hidden input, so the cleanest update is replace: drop the stored
        // rows and recreate in submitted order.
        deleteMany: {},
        create: createPhotoRows(cleanPhotoUrls(formData)),
      },
    },
  });

  if (perms.userId) await logActivity(perms.userId, "updated_drill", "Drill", drillId, name);

  revalidatePath("/drills");
  redirect("/drills?success=Drill updated.");
}

export async function addFeedback(drillId: string, formData: FormData) {
  const perms = await getPermissions();
  if (!perms.canSuggestDrills || !perms.coachId) redirect("/drills?error=no_permission");

  const message = formData.get("message") as string;
  if (!message) redirect("/drills?error=missing_fields");

  await prisma.drillFeedback.create({
    data: { drillId, authorId: perms.coachId, message },
  });

  if (perms.userId) await logActivity(perms.userId, "added_drill_feedback", "Drill", drillId);
  revalidatePath("/drills");
  redirect("/drills?success=Feedback added.");
}

export async function approveDrill(id: string) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canApproveRequests)) redirect("/drills?error=no_permission");

  const drill = await prisma.drill.update({
    where: { id },
    data: { status: "APPROVED" },
    select: { name: true, createdBy: { select: { userId: true } } },
  });
  if (perms.userId) await logActivity(perms.userId, "approved_drill", "Drill", id);
  if (drill.createdBy) {
    await sendPushToUser(drill.createdBy.userId, "Drill suggestion approved", `"${drill.name}" was approved and added to the library.`, "/drills").catch(() => {});
  }
  revalidatePath("/drills");
  redirect("/drills?success=Drill approved and added to the library.");
}

export async function rejectDrill(id: string) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canApproveRequests)) redirect("/drills?error=no_permission");

  // Read the submitter before deleting - DrillFeedback cascades on delete,
  // so this cleanly removes the thread too, but the drill's own row (and
  // its createdBy) is gone after this, so there'd be nothing left to
  // notify from.
  const drill = await prisma.drill.findUnique({ where: { id }, select: { name: true, createdBy: { select: { userId: true } } } });
  await prisma.drill.delete({ where: { id } });
  if (perms.userId) await logActivity(perms.userId, "rejected_drill", "Drill", id);
  if (drill?.createdBy) {
    await sendPushToUser(drill.createdBy.userId, "Drill suggestion rejected", `"${drill.name}" was not approved.`, "/drills").catch(() => {});
  }
  revalidatePath("/drills");
  redirect("/drills?success=Drill rejected.");
}

// Archive a drill: admin / club manager cleanup that keeps history (photos,
// feedback, any session plans referencing it) intact. Archived drills leave
// the library and the session-plan picker, but can be brought back.
export async function archiveDrill(id: string) {
  const perms = await getPermissions();
  if (!perms.isAdmin && !perms.isClubManager) redirect("/drills?error=no_permission");

  const drill = await prisma.drill.findUnique({ where: { id }, select: { name: true } });
  if (!drill) redirect("/drills");

  await prisma.drill.update({ where: { id }, data: { archivedAt: new Date() } });
  if (perms.userId) await logActivity(perms.userId, "archived_drill", "Drill", id, drill.name);
  revalidatePath("/drills");
  revalidatePath("/sessions");
  redirect("/drills?success=Drill archived.");
}

export async function reactivateDrill(id: string) {
  const perms = await getPermissions();
  if (!perms.isAdmin && !perms.isClubManager) redirect("/drills?error=no_permission");

  const drill = await prisma.drill.findUnique({ where: { id }, select: { name: true } });
  if (!drill) redirect("/drills");

  await prisma.drill.update({ where: { id }, data: { archivedAt: null } });
  if (perms.userId) await logActivity(perms.userId, "reactivated_drill", "Drill", id, drill.name);
  revalidatePath("/drills");
  revalidatePath("/sessions");
  redirect("/drills?success=Drill restored to the library.");
}

// Permanent removal, admin / club manager only. Blocked while the drill is
// used in any session plan (SessionDrill.drillId is ON DELETE RESTRICT).
export async function deleteDrill(id: string) {
  const perms = await getPermissions();
  if (!perms.isAdmin && !perms.isClubManager) redirect("/drills?error=no_permission");

  const drill = await prisma.drill.findUnique({ where: { id }, select: { name: true } });
  if (!drill) redirect("/drills");

  // "drill_in_use", not the generic "in_use" - deleteDrillCategory below
  // uses a different code (category_in_use) for the same reason: StatusBanner
  // resolves each code to its own specific message, and these two blocks
  // mean different things to the person reading the banner.
  const inUse = await prisma.sessionDrill.count({ where: { drillId: id } });
  if (inUse > 0) redirect("/drills?error=drill_in_use");

  await prisma.drill.delete({ where: { id } });
  if (perms.userId) await logActivity(perms.userId, "deleted_drill", "Drill", id, drill.name);
  revalidatePath("/drills");
  revalidatePath("/sessions");
  redirect("/drills?success=Drill deleted permanently.");
}

// Category management (add/rename/delete the DrillCategory rows themselves)
// is a structural, academy-wide decision - gated to isAdmin/isClubManager
// only, not the canSuggestDrills/canAuthorDrills rules that govern day-to-day
// drill creation above.
export async function createDrillCategory(formData: FormData) {
  const perms = await getPermissions();
  if (!perms.isAdmin && !perms.isClubManager) redirect("/drills?error=no_permission");

  const name = formData.get("name") as string;
  if (!name?.trim()) redirect("/drills?error=missing_fields");

  const count = await prisma.drillCategory.count();
  try {
    const category = await prisma.drillCategory.create({ data: { name: name.trim(), sortOrder: count } });
    if (perms.userId) await logActivity(perms.userId, "created_drill_category", "DrillCategory", category.id, category.name);
  } catch {
    redirect("/drills?error=duplicate_name");
  }
  revalidatePath("/drills");
  redirect(`/drills?success=${encodeURIComponent(`${name.trim()} category added.`)}`);
}

export async function renameDrillCategory(id: string, formData: FormData) {
  const perms = await getPermissions();
  if (!perms.isAdmin && !perms.isClubManager) redirect("/drills?error=no_permission");

  const name = formData.get("name") as string;
  if (!name?.trim()) redirect("/drills?error=missing_fields");

  try {
    await prisma.drillCategory.update({ where: { id }, data: { name: name.trim() } });
  } catch {
    redirect("/drills?error=duplicate_name");
  }
  if (perms.userId) await logActivity(perms.userId, "renamed_drill_category", "DrillCategory", id, name.trim());
  revalidatePath("/drills");
  redirect("/drills?success=Category renamed.");
}

export async function deleteDrillCategory(id: string) {
  const perms = await getPermissions();
  if (!perms.isAdmin && !perms.isClubManager) redirect("/drills?error=no_permission");

  // Distinct error code from deleteDrill's "in_use" - drills/page.tsx maps
  // that one to a drill-specific message ("used in a session plan"), which
  // would be wrong here.
  const inUse = await prisma.drill.count({ where: { categoryId: id } });
  if (inUse > 0) redirect("/drills?error=category_in_use");

  await prisma.drillCategory.delete({ where: { id } });
  if (perms.userId) await logActivity(perms.userId, "deleted_drill_category", "DrillCategory", id);
  revalidatePath("/drills");
  redirect("/drills?success=Category removed.");
}
