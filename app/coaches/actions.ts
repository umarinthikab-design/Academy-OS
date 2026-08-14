"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Designation, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { getPermissions } from "@/lib/permissions";
import { logActivity } from "@/lib/logActivity";

export async function createCoach(formData: FormData) {
  const perms = await getPermissions();
  if (!perms || !(perms.isAdmin || perms.canEditRoster)) redirect("/coaches?error=no_permission");

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const designation = formData.get("designation") as string; // "HEAD" | "ASSISTANT"
  const focusIds = formData.getAll("primaryFocus") as string[];

  if (!name || !email || !password || !designation) redirect("/coaches?error=missing_fields");

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: designation === "HEAD" ? Role.HEAD_COACH : Role.ASSISTANT_COACH,
        coach: {
          create: {
            designation: designation as Designation,
            primaryFocus: {
              connect: focusIds.map((id) => ({ id })),
            },
          },
        },
      },
    });
  } catch {
    // Most likely a duplicate email (the unique constraint on User.email).
    redirect("/coaches?error=duplicate_email");
  }

  if (perms.userId) await logActivity(perms.userId, "created_coach", "User", undefined, name);
  revalidatePath("/coaches");
  redirect(`/coaches?success=${encodeURIComponent(`${name} added to the roster.`)}`);
}

export async function deleteCoach(id: string) {
  const perms = await getPermissions();
  if (!perms || !(perms.isAdmin || perms.canEditRoster)) redirect("/coaches?error=no_permission");

  const coach = await prisma.coach.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!coach) redirect("/coaches");

  // Several tables reference a Coach with a required (non-nullable) field:
  // drills they created, feedback they left, drill plans (Session) they
  // authored. Deleting a coach who's touched any of these would otherwise
  // crash with an unhandled database constraint error.
  const [drillCount, feedbackCount, sessionCount] = await Promise.all([
    prisma.drill.count({ where: { createdById: id } }),
    prisma.drillFeedback.count({ where: { authorId: id } }),
    prisma.session.count({ where: { createdById: id } }),
  ]);
  if (drillCount > 0 || feedbackCount > 0 || sessionCount > 0) {
    redirect("/coaches?error=in_use");
  }

  // Deleting the User cascades to delete the linked Coach row too
  // (see onDelete: Cascade on Coach.user in schema.prisma).
  await prisma.user.delete({ where: { id: coach.userId } });

  if (perms.userId) await logActivity(perms.userId, "deleted_coach", "User", coach.userId);
  revalidatePath("/coaches");
  redirect("/coaches?success=Coach removed.");
}

// Only these six field names are ever writable through this action - the
// whitelist matters because formData field names are technically
// user-controlled input, and we don't want an arbitrary Coach column
// writable through this endpoint.
const PERMISSION_FIELDS = [
  "canEditRoster",
  "canEditDrills",
  "canApproveRequests",
  "canEditSchedule",
  "canEditLocations",
  "canEditAgeGroups",
] as const;
type PermissionField = (typeof PERMISSION_FIELDS)[number];

export async function updateCoachPermission(coachId: string, field: PermissionField, value: boolean) {
  const perms = await getPermissions();
  // Only admins can grant or revoke a head coach's permission overrides -
  // deliberately not extended to canEditRoster-holding head coaches too,
  // since permissions-over-permissions gets confusing fast.
  if (!perms || !perms.isAdmin) redirect("/coaches?error=no_permission");
  if (!PERMISSION_FIELDS.includes(field)) redirect("/coaches?error=missing_fields");

  await prisma.coach.update({
    where: { id: coachId },
    data: { [field]: value },
  });

  if (perms.userId) await logActivity(perms.userId, "updated_coach_permission", "Coach", coachId, field);
  revalidatePath("/coaches");
}

export async function revokeSessions(coachId: string) {
  const perms = await getPermissions();
  if (!perms || !perms.isAdmin) redirect("/coaches?error=no_permission");

  const coach = await prisma.coach.findUnique({
    where: { id: coachId },
    select: { userId: true },
  });
  if (!coach) redirect("/coaches");

  // Bumping sessionVersion invalidates every existing JWT for this user -
  // getSession() compares the value baked into the token against this
  // column and bounces mismatches back to the login page.
  await prisma.user.update({
    where: { id: coach.userId },
    data: { sessionVersion: { increment: 1 } },
  });

  if (perms.userId) await logActivity(perms.userId, "revoked_sessions", "User", coach.userId);
  revalidatePath("/coaches");
  redirect("/coaches?success=Active sessions revoked — this coach must log in again.");
}
