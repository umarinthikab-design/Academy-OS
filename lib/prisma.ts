import { PrismaClient } from "@prisma/client";

// Next.js dev mode hot-reloads modules, which would normally create a new
// PrismaClient (and a new DB connection) on every file save. Stashing it on
// `globalThis` in development keeps one connection alive across reloads.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
