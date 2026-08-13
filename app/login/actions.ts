"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;

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

  if (!user || !valid) {
    redirect("/login?error=1");
  }

  const token = await createSessionToken({ userId: user.id, name: user.name, role: user.role });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  redirect("/");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
