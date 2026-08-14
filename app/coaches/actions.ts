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
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const designation = formData.get("designation") as string; // "HEAD" | "ASSISTANT"
  const genderRaw = formData.get("gender") as string;
  const focusIds = formData.getAll("primaryFocus") as string[];

  if (!name || !email || !password || !designation) redirect("/coaches?error=missing_fields");

  const gender = genderRaw as "MALE" | "FEMALE" | "OTHER" | null;
  if (genderRaw && !["MALE", "FEMALE", "OTHER"].includes(genderRaw)) redirect("/coaches?error=missing_fields");

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: designation === "HEAD" ? Role.HEAD_COACH : Role.ASSISTANT_COACH,
        // New accounts must pick their own password on first login.
        mustChangePassword: true,
        coach: {
          create: {
            designation: designation as Designation,
            gender,
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

// Promote an assistant coach to head coach. The admin picks which of the
// permission overrides the promoted coach should carry (the "characteristics
// of a head coach" - roster editing, drill editing, approval, etc.). Role and
// designation flip to HEAD; existing focus areas are kept.
export async function promoteCoach(coachId: string, formData: FormData) {
  const perms = await getPermissions();
  if (!perms || !perms.isAdmin) redirect("/coaches?error=no_permission");

  const coach = await prisma.coach.findUnique({
    where: { id: coachId },
    select: { userId: true, designation: true },
  });
  if (!coach) redirect("/coaches");
  if (coach.designation !== "ASSISTANT") redirect("/coaches?error=not_assistant");

  const flags: Record<string, boolean> = {};
  for (const field of PERMISSION_FIELDS) {
    flags[field] = formData.get(field) === "on";
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: coach.userId }, data: { role: Role.HEAD_COACH } }),
    prisma.coach.update({
      where: { id: coachId },
      data: { designation: Designation.HEAD, ...flags },
    }),
  ]);

  if (perms.userId) await logActivity(perms.userId, "promoted_coach", "Coach", coachId);
  revalidatePath("/coaches");
  redirect("/coaches?success=Coach promoted to head coach.");
}

// Admin-only password reset. Generates a fresh temporary password, forces a
// change on next login, and invalidates any existing sessions. The temporary
// password is shown to the admin in the success banner so they can pass it on.
export async function resetCoachPassword(coachId: string) {
  const perms = await getPermissions();
  if (!perms || !perms.isAdmin) redirect("/coaches?error=no_permission");

  const coach = await prisma.coach.findUnique({
    where: { id: coachId },
    select: { userId: true, user: { select: { email: true } } },
  });
  if (!coach) redirect("/coaches");

  const temporary = `tl-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(10).slice(2, 6)}`;
  const hashed = await bcrypt.hash(temporary, 10);
  await prisma.user.update({
    where: { id: coach.userId },
    data: {
      password: hashed,
      mustChangePassword: true,
      sessionVersion: { increment: 1 },
    },
  });

  if (perms.userId) await logActivity(perms.userId, "reset_password", "User", coach.userId);
  revalidatePath("/coaches");
  redirect(`/coaches?success=${encodeURIComponent(`Password reset for ${coach.user.email} — temporary password: ${temporary} (must change on next login).`)}`);
}
