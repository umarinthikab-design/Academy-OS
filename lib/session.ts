import { SignJWT, jwtVerify } from "jose";

// This file must stay free of Node-only imports (like Prisma) because
// middleware.ts runs in Next.js's lightweight "Edge" runtime, which can't
// use Prisma's engine. jose works fine there, which is exactly why we're
// using it instead of a heavier auth library.

const secret = new TextEncoder().encode(process.env.SESSION_SECRET);

export type SessionPayload = {
  userId: string;
  name: string;
  role: "ADMIN" | "HEAD_COACH" | "ASSISTANT_COACH" | "PARENT";
};

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    // Any failure (expired, tampered, wrong secret) just means "not logged in."
    return null;
  }
}

export const SESSION_COOKIE_NAME = "touchline_session";
