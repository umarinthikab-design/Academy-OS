import type { Prisma } from "@prisma/client";
import { sessionStartInstant } from "./time";

export type ActivityParams = {
  entityType?: string;
  userId?: string;
  action?: string;
  from?: string;
  to?: string;
};

// Midnight (academy time zone) at the start of a calendar day given as
// "YYYY-MM-DD", optionally shifted forward by whole days.
function localDayStart(raw: string | undefined, tz: string, addDays = 0): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(raw + "T00:00:00Z");
  if (isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + addDays);
  return sessionStartInstant(d, "00:00", tz);
}

// Shared by the Activity page and its CSV download so both always agree.
// Admins and club managers see everyone (optionally narrowed to one person);
// everyone else only ever sees their own entries.
export function buildActivityWhere(
  perms: { isAdmin: boolean; isClubManager: boolean; userId?: string | null },
  params: ActivityParams,
  tz: string
): Prisma.ActivityLogWhereInput {
  const canSeeAll = perms.isAdmin || perms.isClubManager;
  const from = localDayStart(params.from, tz);
  const toExclusive = localDayStart(params.to, tz, 1);
  const createdAt: Prisma.DateTimeFilter = {};
  if (from) createdAt.gte = from;
  if (toExclusive) createdAt.lt = toExclusive;

  const where: Prisma.ActivityLogWhereInput = {};
  if (canSeeAll) {
    if (params.userId) where.userId = params.userId;
  } else {
    where.userId = perms.userId ?? "no-user";
  }
  if (params.entityType) where.entityType = params.entityType;
  if (params.action) where.action = params.action;
  if (from || toExclusive) where.createdAt = createdAt;
  return where;
}