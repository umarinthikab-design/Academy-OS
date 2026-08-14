"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/getSession";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { cookies } from "next/headers";
import { logActivity } from "@/lib/logActivity";

// Forced password change for users flagged mustChangePassword (admin-created
// accounts and admin resets). Unlike the settings change-password flow there
// is no "current password" step - the user is already authenticated and the
// whole point is to replace the temporary/admin-set value.
export async function changePasswordOnFirstLogin(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");

  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!newPassword || newPassword.length < 8) redirect("/change-password?error=password_too_short");
  if (newPassword !== confirmPassword) redirect("/change-password?error=password_mismatch");

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) redirect("/login");

  const hashed = await bcrypt.hash(newPassword, 10);
  // Clear the flag and bump sessionVersion so the new (unchanged) JWT is
  // re-issued without mustChangePassword; also invalidates other sessions.
  const updated = await prisma.user.update({
    where: { id: session.userId },
    data: { password: hashed, mustChangePassword: false, sessionVersion: user.sessionVersion + 1 },
  });

  const token = await createSessionToken({
    userId: updated.id,
    name: updated.name,
    role: updated.role,
    sessionVersion: updated.sessionVersion,
    mustChangePassword: false,
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  if (session.userId) await logActivity(session.userId, "changed_password", "User", user.id);
  redirect("/?success=Password set. Welcome to Touchline.");
}