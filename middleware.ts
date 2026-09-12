import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Duplicated deliberately instead of importing from lib/session.ts, to keep
// this file's dependency chain minimal and Edge-safe. If in doubt about
// what's allowed in middleware, less is safer.
const SESSION_COOKIE_NAME = "touchline_session";
const PUBLIC_PATHS = ["/login", "/auth/revoked"];
const CHANGE_PASSWORD_PATH = "/change-password";

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
    const { payload } = await jwtVerify(token, secret);

    // Users flagged mustChangePassword are locked to /change-password until
    // they set a real password. The login action already bounces them there;
    // this catches manual navigation elsewhere too.
    if (payload.mustChangePassword && pathname !== CHANGE_PASSWORD_PATH) {
      return NextResponse.redirect(new URL(CHANGE_PASSWORD_PATH, request.url));
    }
    if (!payload.mustChangePassword && pathname === CHANGE_PASSWORD_PATH) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  // api/cron/* is excluded the same way api/upload-photo already is: it has
  // its own auth (the Vercel Cron secret header, checked inside the route),
  // not the session cookie this middleware enforces - a Vercel Cron
  // invocation carries no session cookie and would otherwise get redirected
  // to /login instead of ever running.
  matcher: ["/((?!_next/static|_next/image|favicon\\.(?:ico|png)|sw.js|manifest.webmanifest|icon-.*\\.png|apple-touch-icon\\.png|api/upload-photo|api/cron).*)"],
};
