"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Window (ms) and cap for failed attempts per email before we lock the
// login out for the remainder of the window.
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ATTEMPTS = 5;
// Rows older than this are dead weight; pruned lazily on each attempt.
const PRUNE_OLDER_THAN_MS = 60 * 60 * 1000; // 1 hour

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const now = new Date();
  const normalizedEmail = (email || "").trim().toLowerCase();

  // Keep the attempts table small. Runs on every login attempt, which is
  // rare enough that a single DELETE per login is not worth optimizing.
  await prisma.loginAttempt.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - PRUNE_OLDER_THAN_MS) } },
  });

  if (normalizedEmail) {
    const failedInWindow = await prisma.loginAttempt.count({
      where: {
        email: normalizedEmail,
        success: false,
        createdAt: { gte: new Date(now.getTime() - ATTEMPT_WINDOW_MS) },
      },
    });
    if (failedInWindow >= MAX_FAILED_ATTEMPTS) {
      redirect("/login?error=rate_limited");
    }
  }

  const user = normalizedEmail ? await prisma.user.findUnique({ where: { email: normalizedEmail } }) : null;

  let valid = false;
  if (user) {
    try {
      valid = await bcrypt.compare(password || "", user.password);
    } catch {
      // A malformed/placeholder password hash (like the old "CHANGE_ME"
      // seed values) shouldn't crash the login page - just treat it as a
      // failed login.
      valid = false;
    }
  }

  // Record the attempt for rate limiting. Failed attempts against a
  // nonexistent email are still recorded so the limiter can't be bypassed
  // by rotating through unknown addresses.
  await prisma.loginAttempt.create({
    data: { email: normalizedEmail || "(empty)", success: valid },
  });

  if (!user || !valid) {
    redirect("/login?error=1");
  }

  const token = await createSessionToken({
    userId: user.id,
    name: user.name,
    role: user.role,
    sessionVersion: user.sessionVersion,
    mustChangePassword: user.mustChangePassword,
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  // First-time users (admin-created accounts, or a password reset) have to
  // pick their own password before they can use the app. The token carries
  // the flag so middleware enforces /change-password on every navigation.
  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  redirect("/");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
