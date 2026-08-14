import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export const dynamic = "force-dynamic";

// getSession() bounces a revoked/stale session here so the offending cookie
// actually gets deleted. Redirecting straight to /login would loop forever,
// because the root layout calls getSession() on /login too and the still-
// present cookie would just re-trigger the mismatch.
export async function GET(request: Request) {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  return NextResponse.redirect(new URL("/login?error=session_revoked", request.url));
}
