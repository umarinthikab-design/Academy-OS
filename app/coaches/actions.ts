"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Designation, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { getPermissions } from "@/lib/permissions";

export async function createCoach(formData: FormData) {
  const perms = await getPermissions();
  if (!perms || !(perms.isAdmin || perms.canEditRoster)) return;

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const designation = formData.get("designation") as string; // "HEAD" | "ASSISTANT"
  const focusIds = formData.getAll("primaryFocus") as string[];

  if (!name || !email || !password || !designation) return;

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
    // Silently no-ops for now - showing a real "that email is taken"
    // message needs a client component with form state, not built yet.
    return;
  }

  // Tells Next.js the /coaches page's data is stale, so it re-fetches
  // instead of showing a cached list without the new coach.
  revalidatePath("/coaches");
}

export async function deleteCoach(id: string) {
  const perms = await getPermissions();
  if (!perms || !(perms.isAdmin || perms.canEditRoster)) return;

  const coach = await prisma.coach.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!coach) return;

  // Deleting the User cascades to delete the linked Coach row too
  // (see onDelete: Cascade on Coach.user in schema.prisma).
  await prisma.user.delete({ where: { id: coach.userId } });

  revalidatePath("/coaches");
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
  if (!perms || !perms.isAdmin) return;
  if (!PERMISSION_FIELDS.includes(field)) return;

  await prisma.coach.update({
    where: { id: coachId },
    data: { [field]: value },
  });

  revalidatePath("/coaches");
}
