"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPermissions } from "@/lib/permissions";
import { logActivity } from "@/lib/logActivity";
import { calculateAge, getSkillBandForAge } from "@/lib/skills";
import { getSkillBands } from "@/lib/skillDefinitions";

// Let the admin correct any mapped field before it becomes a real Player -
// the webhook's field mapping is best-effort (see app/api/webhooks/jotform),
// so nothing here should be trusted blindly. batchId is optional: a
// registration can be approved into the squad without an immediate batch
// assignment, same as createPlayer in app/squad/actions.ts doesn't require
// one either.
export async function approveRegistration(id: string, formData: FormData) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.isClubManager)) redirect("/registrations?error=no_permission");

  const name = formData.get("playerName") as string;
  const dobRaw = formData.get("dateOfBirth") as string;
  const emergencyContactName = (formData.get("emergencyContactName") as string) || null;
  const emergencyContactPhone = (formData.get("emergencyContactPhone") as string) || null;
  const batchId = (formData.get("batchId") as string) || null;
  if (!name || !dobRaw) redirect("/registrations?error=missing_fields");

  const dateOfBirth = new Date(dobRaw);

  // Same age-band -> default skill rows logic as createPlayer - pulled from
  // the live SkillDefinition data, never hardcoded here, so a registration
  // approval and a manually-added player end up with identical starting
  // skill rows for their band.
  const bands = await getSkillBands();
  const band = getSkillBandForAge(bands, calculateAge(dateOfBirth));

  const player = await prisma.player.create({
    data: {
      name,
      dateOfBirth,
      emergencyContactName,
      emergencyContactPhone,
      batches: batchId ? { connect: { id: batchId } } : undefined,
      skills: {
        create: band.skills.map((skillName) => ({ skillName, value: 1 })),
      },
    },
  });

  await prisma.pendingRegistration.update({
    where: { id },
    data: { status: "APPROVED", reviewedAt: new Date(), reviewedById: perms.userId },
  });

  if (perms.userId) await logActivity(perms.userId, "approved_registration", "PendingRegistration", id, name);

  revalidatePath("/registrations");
  revalidatePath("/squad");
  redirect(`/registrations?success=${encodeURIComponent(`${name} added to the squad.`)}`);
}

// Rejected registrations keep their row (status REJECTED) rather than being
// deleted, so there's a permanent record of what was submitted and declined.
export async function rejectRegistration(id: string) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.isClubManager)) redirect("/registrations?error=no_permission");

  await prisma.pendingRegistration.update({
    where: { id },
    data: { status: "REJECTED", reviewedAt: new Date(), reviewedById: perms.userId },
  });

  if (perms.userId) await logActivity(perms.userId, "rejected_registration", "PendingRegistration", id);

  revalidatePath("/registrations");
  redirect("/registrations?success=Registration rejected.");
}
