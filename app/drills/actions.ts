"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getPermissions } from "@/lib/permissions";

export async function createDrill(formData: FormData) {
  const perms = await getPermissions();
  // Only actual coaches (head or assistant) submit drills - admins approve,
  // they don't author. This also removes the old "Submitted by" dropdown
  // workaround from before real login existed - the server knows who's
  // asking now.
  if (!perms.canSuggestDrills || !perms.coachId) return;

  const name = formData.get("name") as string;
  const category = formData.get("category") as string;
  const duration = Number(formData.get("duration"));
  const playerRange = formData.get("playerRange") as string;
  const description = formData.get("description") as string;
  const ageGroupIds = formData.getAll("ageGroups") as string[];

  if (!name || !category || !duration) return;

  // Every new drill starts PENDING and needs an explicit approval - see the
  // note on the Drill Library page about why this applies uniformly right
  // now instead of only to assistant-coach submissions.
  await prisma.drill.create({
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

  revalidatePath("/drills");
}

export async function addFeedback(drillId: string, formData: FormData) {
  const perms = await getPermissions();
  if (!perms.canSuggestDrills || !perms.coachId) return;

  const message = formData.get("message") as string;
  if (!message) return;

  await prisma.drillFeedback.create({
    data: { drillId, authorId: perms.coachId, message },
  });

  revalidatePath("/drills");
}

export async function approveDrill(id: string) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canApproveRequests)) return;

  await prisma.drill.update({ where: { id }, data: { status: "APPROVED" } });
  revalidatePath("/drills");
}

export async function rejectDrill(id: string) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canApproveRequests)) return;

  // DrillFeedback cascades on delete, so this cleanly removes the thread too.
  await prisma.drill.delete({ where: { id } });
  revalidatePath("/drills");
}
