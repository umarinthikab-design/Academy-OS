"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/getSession";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { cookies } from "next/headers";
import { logActivity } from "@/lib/logActivity";
import { sanitizePhotoUrl } from "@/lib/photo";

// Re-issue the session cookie after a change that alters what's baked into
// the JWT (name, or sessionVersion after a password change). Without this,
// the sidebar would keep showing the old name, and a bumped sessionVersion
// would log the current user out too.
async function refreshSessionCookie(user: { id: string; name: string; role: "ADMIN" | "CLUB_MANAGER" | "HEAD_COACH" | "ASSISTANT_COACH" | "PARENT"; sessionVersion: number; mustChangePassword?: boolean }) {
  const token = await createSessionToken({
    userId: user.id,
    name: user.name,
    role: user.role,
    sessionVersion: user.sessionVersion,
    mustChangePassword: user.mustChangePassword ?? false,
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function updateProfile(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");

  const name = formData.get("name") as string;
  const photoUrl = sanitizePhotoUrl(formData.get("photoUrl") as string);

  if (!name?.trim()) redirect("/settings?error=missing_fields");

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: { name: name.trim(), photoUrl },
  });

  await refreshSessionCookie(user);
  if (session.userId) await logActivity(session.userId, "updated_profile", "User", user.id, user.name);
  redirect("/settings?success=Profile updated.");
}

export async function setTheme(theme: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  const normalized = theme === "dark" ? "dark" : "light";
  await prisma.user.update({
    where: { id: session.userId },
    data: { theme: normalized },
  });
}

export async function changePassword(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!currentPassword || !newPassword) redirect("/settings?error=missing_fields");
  if (newPassword.length < 8) redirect("/settings?error=password_too_short");
  if (newPassword !== confirmPassword) redirect("/settings?error=password_mismatch");

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) redirect("/login");

  let valid = false;
  try {
    valid = await bcrypt.compare(currentPassword, user.password);
  } catch {
    valid = false;
  }
  if (!valid) redirect("/settings?error=wrong_password");

  const hashed = await bcrypt.hash(newPassword, 10);
  // Bump sessionVersion so every other device's session dies, then re-issue
  // a fresh cookie so the current device stays logged in. Clearing the
  // mustChangePassword flag covers the forced-change path (if a flagged user
  // reaches the settings form directly).
  const updated = await prisma.user.update({
    where: { id: session.userId },
    data: { password: hashed, sessionVersion: user.sessionVersion + 1, mustChangePassword: false },
  });

  await refreshSessionCookie(updated);
  if (session.userId) await logActivity(session.userId, "changed_password", "User", user.id);
  redirect("/settings?success=Password changed. Other devices signed out.");
}