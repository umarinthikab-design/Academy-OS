"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

// Window (ms) and cap for failed attempts per email before we lock the
// login out for the remainder of the window.
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ATTEMPTS = 5;
// Second, broader layer: caps failures per source IP regardless of which
// email was tried. The per-email limit alone doesn't stop a single attacker
// spraying one guessed password across many different addresses - no one
// email ever fails enough times to trip its own limit. Set well above the
// per-email cap so it only kicks in for spraying, not for normal traffic
// from a shared IP (an office or school NAT, for instance).
const MAX_FAILED_ATTEMPTS_PER_IP = 20;
// Rows older than this are dead weight; pruned lazily on each attempt.
const PRUNE_OLDER_THAN_MS = 60 * 60 * 1000; // 1 hour

async function getClientIp(): Promise<string> {
  const h = await headers();
  // Vercel (and most reverse proxies) set x-forwarded-for as a
  // client-first, comma-separated chain; only the first hop is meaningful,
  // everything after it is attacker-controlled if not already trusted by
  // the platform's edge.
  const forwardedFor = h.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return h.get("x-real-ip") || "unknown";
}

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const now = new Date();
  const normalizedEmail = (email || "").trim().toLowerCase();
  const ip = await getClientIp();

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

  if (ip !== "unknown") {
    const failedFromIpInWindow = await prisma.loginAttempt.count({
      where: {
        ipAddress: ip,
        success: false,
        createdAt: { gte: new Date(now.getTime() - ATTEMPT_WINDOW_MS) },
      },
    });
    if (failedFromIpInWindow >= MAX_FAILED_ATTEMPTS_PER_IP) {
      redirect("/login?error=rate_limited");
    }
  }

  const user = normalizedEmail ? await prisma.user.findUnique({ where: { email: normalizedEmail } }) : null;

  // An archived user's login is rejected with a distinct message rather than
  // the generic wrong-password one - the account still exists (history is
  // preserved), so they should know the block is deliberate.
  if (user?.archivedAt) {
    await prisma.loginAttempt.create({
      data: { email: normalizedEmail, ipAddress: ip, success: false },
    });
    redirect("/login?error=account_archived");
  }

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
    data: { email: normalizedEmail || "(empty)", ipAddress: ip, success: valid },
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
