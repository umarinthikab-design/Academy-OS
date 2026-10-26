// Pre-session coach confirmation (RSVP) resolution, shared by the dashboard
// sections and the self-service action.
//
// This is deliberately separate from the post-session CoachAttendance /
// PlayerAttendance approval flow. It answers "will you attend" ahead of time
// (self-service, no approval chain) rather than "did you attend" afterward.
// Window widths and the response deadline come from the AcademySettings
// singleton, never hardcoded. The deadline is FLAG-ONLY: a late answer is
// still accepted, an unanswered one is surfaced to admins / head coaches.

import { prisma } from "./prisma";
import type { Permissions } from "./permissions";
import { sessionStartInstant, startOfTodayInZone } from "./time";

const HOUR = 60 * 60 * 1000;

export function sessionStart(session: { date: Date; startTime: string }, timeZone: string): Date {
  return sessionStartInstant(session.date, session.startTime, timeZone);
}

// The moment by which a coach should have answered: session start minus the
// configured number of hours.
export function confirmationDeadline(
  session: { date: Date; startTime: string },
  settings: { timeZone?: string | null; coachConfirmationDeadlineHours: number }
): Date {
  const start = sessionStart(session, settings.timeZone || "UTC");
  return new Date(start.getTime() - settings.coachConfirmationDeadlineHours * HOUR);
}

// The confirmation/priority window edges, shared by every reader of these
// thresholds (dashboard sections and the reminder cron) so the math only
// lives in one place.
function getConfirmationWindows(settings: { confirmationWindowHours: number; priorityWindowHours: number }, now: Date) {
  return {
    windowEnd: new Date(now.getTime() + settings.confirmationWindowHours * HOUR),
    priorityEnd: new Date(now.getTime() + settings.priorityWindowHours * HOUR),
  };
}

// The AcademySettings singleton. Prisma has no "exactly one row" constraint,
// so the row is created lazily here with defaults if it doesn't exist yet and
// only ever updated (never a second insert) by the admin action.
export async function getAcademySettings() {
  const existing = await prisma.academySettings.findFirst();
  if (existing) return existing;
  return prisma.academySettings.create({ data: {} });
}

export type MyConfirmation = {
  id: string;
  scheduledSessionId: string;
  status: "PENDING" | "CONFIRMED" | "DECLINED";
  session: {
    id: string;
    date: Date;
    startTime: string;
    durationMinutes: number;
    ageGroupName: string;
    locationName: string;
  };
  priority: boolean;
  deadlineAt: Date;
  overdue: boolean;
};

// Confirmations awaiting THIS coach's RSVP, scoped to the confirmation window
// from AcademySettings. `priority` marks sessions within the priority window
// that are still PENDING; `overdue` marks ones past the response deadline.
// Sessions are matched by their real start instant, so a session later today
// is included (the stored date is midnight, which is already "in the past").
export async function getMyConfirmations(perms: Permissions): Promise<MyConfirmation[]> {
  if (!perms.coachId) return [];

  const settings = await getAcademySettings();
  if (!settings.preSessionConfirmationEnabled) return [];

  const tz = settings.timeZone || "UTC";
  const now = new Date();
  const { windowEnd, priorityEnd } = getConfirmationWindows(settings, now);

  const rows = await prisma.sessionCoachConfirmation.findMany({
    where: {
      coachId: perms.coachId,
      status: "PENDING",
      scheduledSession: { date: { gte: startOfTodayInZone(tz, now), lte: windowEnd }, status: "scheduled" },
    },
    include: { scheduledSession: { include: { ageGroup: true, location: true } } },
    orderBy: { scheduledSession: { date: "asc" } },
    take: 50,
  });

  const items: { start: Date; item: MyConfirmation }[] = [];
  for (const r of rows) {
    const start = sessionStart(r.scheduledSession, tz);
    if (start < now || start > windowEnd) continue;
    const deadlineAt = confirmationDeadline(r.scheduledSession, settings);
    items.push({
      start,
      item: {
        id: r.id,
        scheduledSessionId: r.scheduledSessionId,
        status: r.status,
        session: {
          id: r.scheduledSession.id,
          date: r.scheduledSession.date,
          startTime: r.scheduledSession.startTime,
          durationMinutes: r.scheduledSession.durationMinutes,
          ageGroupName: r.scheduledSession.ageGroup.name,
          locationName: r.scheduledSession.location.name,
        },
        priority: start <= priorityEnd,
        deadlineAt,
        overdue: deadlineAt < now,
      },
    });
  }
  items.sort((a, b) => a.start.getTime() - b.start.getTime());
  return items.slice(0, 20).map((x) => x.item);
}

export type StaffingAlert = {
  scheduledSessionId: string;
  session: {
    id: string;
    date: Date;
    startTime: string;
    durationMinutes: number;
    ageGroupName: string;
    locationName: string;
  };
  pending: string[];
  declined: string[];
  // Coaches who are still PENDING after the response deadline passed.
  overdue: string[];
  deadlineAt: Date;
};

// The "someone needs to know" surface for admins and head coaches: sessions
// in the confirmation window where at least one assigned coach is still
// PENDING or has DECLINED. Scope is all sessions (admins) or sessions the
// head coach is assigned to (coaches who can approve requests).
export async function getStaffingAlerts(perms: Permissions): Promise<StaffingAlert[]> {
  if (!perms.isAdmin && !perms.isClubManager && !(perms.canApproveRequests && !!perms.coachId)) return [];

  const settings = await getAcademySettings();
  if (!settings.preSessionConfirmationEnabled) return [];

  const tz = settings.timeZone || "UTC";
  const now = new Date();
  const { windowEnd } = getConfirmationWindows(settings, now);

  const sessionWhere = {
    date: { gte: startOfTodayInZone(tz, now), lte: windowEnd },
    status: "scheduled" as const,
    ...(!perms.isAdmin && !perms.isClubManager
      ? { OR: [
          { headCoaches: { some: { id: perms.coachId ?? "__none__" } } },
          { assistantCoaches: { some: { id: perms.coachId ?? "__none__" } } },
        ] }
      : {}),
  };

  const sessions = await prisma.scheduledSession.findMany({
    where: sessionWhere,
    include: {
      ageGroup: true,
      location: true,
      coachConfirmations: { include: { coach: { include: { user: { select: { name: true } } } } } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    take: 50,
  });

  const alerts: StaffingAlert[] = [];
  for (const s of sessions) {
    const start = sessionStart(s, tz);
    if (start < now || start > windowEnd) continue;

    const pending = s.coachConfirmations.filter((c) => c.status === "PENDING").map((c) => c.coach.user.name);
    const declined = s.coachConfirmations.filter((c) => c.status === "DECLINED").map((c) => c.coach.user.name);
    if (pending.length === 0 && declined.length === 0) continue;

    const deadlineAt = confirmationDeadline(s, settings);
    alerts.push({
      scheduledSessionId: s.id,
      session: {
        id: s.id,
        date: s.date,
        startTime: s.startTime,
        durationMinutes: s.durationMinutes,
        ageGroupName: s.ageGroup.name,
        locationName: s.location.name,
      },
      pending,
      declined,
      overdue: deadlineAt < now ? pending : [],
      deadlineAt,
    });
    if (alerts.length >= 20) break;
  }

  return alerts;
}

export function confirmationsEnabled(): Promise<boolean> {
  return getAcademySettings().then((s) => s.preSessionConfirmationEnabled);
}

// A reminder isn't re-sent to the same still-pending confirmation more
// often than this, regardless of how frequently the cron runs.
const REMINDER_COOLDOWN_HOURS = 6;

export type ReminderTarget = {
  confirmationId: string;
  userId: string;
  priority: boolean;
  session: {
    id: string;
    date: Date;
    startTime: string;
    durationMinutes: number;
    ageGroupName: string;
    locationName: string;
  };
};

// Every still-PENDING confirmation inside the confirmation window that
// hasn't been reminded (or was reminded too long ago) - the set the
// reminder cron should push a notification for. Same window math as
// getMyConfirmations/getStaffingAlerts above, just unscoped by coach since
// the cron needs to sweep every coach, not one logged-in user's view.
export async function getConfirmationsNeedingReminder(): Promise<ReminderTarget[]> {
  const settings = await getAcademySettings();
  if (!settings.preSessionConfirmationEnabled) return [];

  const tz = settings.timeZone || "UTC";
  const now = new Date();
  const { windowEnd, priorityEnd } = getConfirmationWindows(settings, now);
  const cooldownCutoff = new Date(now.getTime() - REMINDER_COOLDOWN_HOURS * HOUR);

  const rows = await prisma.sessionCoachConfirmation.findMany({
    where: {
      status: "PENDING",
      scheduledSession: { date: { gte: startOfTodayInZone(tz, now), lte: windowEnd }, status: "scheduled" },
      OR: [{ lastRemindedAt: null }, { lastRemindedAt: { lt: cooldownCutoff } }],
    },
    include: {
      scheduledSession: { include: { ageGroup: true, location: true } },
      coach: { select: { userId: true } },
    },
  });

  return rows
    .filter((r) => {
      const start = sessionStart(r.scheduledSession, tz);
      return start >= now && start <= windowEnd;
    })
    .map((r) => ({
      confirmationId: r.id,
      userId: r.coach.userId,
      priority: sessionStart(r.scheduledSession, tz) <= priorityEnd,
      session: {
        id: r.scheduledSession.id,
        date: r.scheduledSession.date,
        startTime: r.scheduledSession.startTime,
        durationMinutes: r.scheduledSession.durationMinutes,
        ageGroupName: r.scheduledSession.ageGroup.name,
        locationName: r.scheduledSession.location.name,
      },
    }));
}

export type OverdueTarget = {
  confirmationId: string;
  coachUserId: string;
  coachName: string;
  headCoachUserIds: string[];
  session: {
    id: string;
    date: Date;
    startTime: string;
    ageGroupId: string;
    ageGroupName: string;
  };
};

// PENDING confirmations whose response deadline has passed (and whose session
// hasn't started) that admins / head coaches haven't been told about yet.
// The cron stamps overdueNotifiedAt so each one is announced exactly once.
export async function getOverdueConfirmationsToNotify(): Promise<OverdueTarget[]> {
  const settings = await getAcademySettings();
  if (!settings.preSessionConfirmationEnabled) return [];

  const tz = settings.timeZone || "UTC";
  const now = new Date();

  const rows = await prisma.sessionCoachConfirmation.findMany({
    where: {
      status: "PENDING",
      overdueNotifiedAt: null,
      scheduledSession: { date: { gte: startOfTodayInZone(tz, now) }, status: "scheduled" },
    },
    include: {
      scheduledSession: { include: { ageGroup: true, headCoaches: { select: { userId: true } } } },
      coach: { select: { userId: true, user: { select: { name: true } } } },
    },
  });

  return rows
    .filter((r) => {
      const start = sessionStart(r.scheduledSession, tz);
      return start > now && confirmationDeadline(r.scheduledSession, settings) <= now;
    })
    .map((r) => ({
      confirmationId: r.id,
      coachUserId: r.coach.userId,
      coachName: r.coach.user.name,
      headCoachUserIds: r.scheduledSession.headCoaches.map((c) => c.userId),
      session: {
        id: r.scheduledSession.id,
        date: r.scheduledSession.date,
        startTime: r.scheduledSession.startTime,
        ageGroupId: r.scheduledSession.ageGroupId,
        ageGroupName: r.scheduledSession.ageGroup.name,
      },
    }));
}