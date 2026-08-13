import { cookies } from "next/headers";
import { verifySessionToken, SessionPayload, SESSION_COOKIE_NAME } from "./session";

// Use this inside Server Components and Server Actions to find out who's
// logged in. Do NOT import this into middleware.ts - cookies() from
// "next/headers" combined with this file's dependency chain is meant for
// the Node runtime, not Edge.
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
