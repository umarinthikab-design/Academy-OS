import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Duplicated deliberately instead of importing from lib/session.ts, to keep
// this file's dependency chain minimal and Edge-safe. If in doubt about
// what's allowed in middleware, less is safer.
const SESSION_COOKIE_NAME = "touchline_session";
const PUBLIC_PATHS = ["/login", "/auth/revoked"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
