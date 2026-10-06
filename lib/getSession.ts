import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { verifySessionToken, SessionPayload, SESSION_COOKIE_NAME } from "./session";

// Use this inside Server Components and Server Actions to find out who's
// logged in. Do NOT import this into middleware.ts - cookies() from
// "next/headers" combined with this file's dependency chain is meant for
// the Node runtime, not Edge.
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  // Revocation check: the DB row is the source of truth for "is this
  // session still valid". The version was baked into the JWT at login
  // time, so a mismatch means the session was revoked after the fact.
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { sessionVersion: true, name: true, role: true },
  });
  if (!user) return null;
  if (user.sessionVersion !== payload.sessionVersion) {
    // Go via /auth/revoked which DELETES the stale cookie, then bounces to
    // login. Redirecting to /login directly would loop forever: the layout
    // calls getSession() on /login too, the cookie is still present, and the
    // mismatch just re-triggers this redirect.
    redirect("/auth/revoked");
  }

  // Always reflect the current DB name/role rather than the snapshot baked
  // into the JWT at login time, so a profile rename shows up immediately.
  return { ...payload, name: user.name, role: user.role };
}