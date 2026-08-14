"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPermissions } from "@/lib/permissions";
import { logActivity } from "@/lib/logActivity";

export async function createDrill(formData: FormData) {
  const perms = await getPermissions();
  // Only actual coaches (head or assistant) submit drills - admins approve,
  // they don't author. This also removes the old "Submitted by" dropdown
  // workaround from before real login existed - the server knows who's
  // asking now.
  if (!perms.canSuggestDrills || !perms.coachId) redirect("/drills?error=no_permission");

  const name = formData.get("name") as string;
  const category = formData.get("category") as string;
  const duration = Number(formData.get("duration"));
  const playerRange = formData.get("playerRange") as string;
  const description = formData.get("description") as string;
  const ageGroupIds = formData.getAll("ageGroups") as string[];

  if (!name || !category || !duration) redirect("/drills?error=missing_fields");

  // Every new drill starts PENDING and needs an explicit approval - see the
  // note on the Drill Library page about why this applies uniformly right
  // now instead of only to assistant-coach submissions.
  const drill = await prisma.drill.create({
    data: {
      name,
      category,
      duration,
      playerRange,
      description,
      createdById: perms.coachId,
      status: "PENDING",
      ageGroups: { connect: ageGroupIds.map((id) => ({ id })) },
    },
  });

  if (perms.userId) await logActivity(perms.userId, "created_drill", "Drill", drill.id, name);

  revalidatePath("/drills");
  redirect(`/drills?success=${encodeURIComponent(`${name} submitted for approval.`)}`);
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

  await prisma.drill.update({ where: { id }, data: { status: "APPROVED" } });
  if (perms.userId) await logActivity(perms.userId, "approved_drill", "Drill", id);
  revalidatePath("/drills");
  redirect("/drills?success=Drill approved and added to the library.");
}

export async function rejectDrill(id: string) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canApproveRequests)) redirect("/drills?error=no_permission");

  // DrillFeedback cascades on delete, so this cleanly removes the thread too.
  await prisma.drill.delete({ where: { id } });
  if (perms.userId) await logActivity(perms.userId, "rejected_drill", "Drill", id);
  revalidatePath("/drills");
  redirect("/drills?success=Drill rejected.");
}
