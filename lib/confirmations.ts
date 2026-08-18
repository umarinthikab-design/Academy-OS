// Pre-session coach confirmation (RSVP) resolution, shared by the dashboard
// sections and the self-service action.
//
// This is deliberately separate from the post-session CoachAttendance /
// PlayerAttendance approval flow. It answers "will you attend" ahead of time
// (self-service, no approval chain) rather than "did you attend" afterward.
// Window widths come from the AcademySettings singleton, never hardcoded.

import { prisma } from "./prisma";
import type { Permissions } from "./permissions";

function sessionStart(session: { date: Date; startTime: string }): Date {
  const [h, m] = session.startTime.split(":").map(Number);
  const start = new Date(session.date);
  start.setHours(h, m, 0, 0);
  return start;
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
};

// Confirmations awaiting THIS coach's RSVP, scoped to the confirmation window
// from AcademySettings. `priority` marks sessions within the priority window
// that are still PENDING, so they can get the visually distinct treatment.
export async function getMyConfirmations(perms: Permissions): Promise<MyConfirmation[]> {
  if (!perms.coachId) return [];

  const settings = await getAcademySettings();
  if (!settings.preSessionConfirmationEnabled) return [];

  const now = new Date();
  const windowEnd = new Date(now.getTime() + settings.confirmationWindowHours * 60 * 60 * 1000);
  const priorityEnd = new Date(now.getTime() + settings.priorityWindowHours * 60 * 60 * 1000);

  const rows = await prisma.sessionCoachConfirmation.findMany({
    where: {
      coachId: perms.coachId,
      status: "PENDING",
      scheduledSession: { date: { gte: now, lte: windowEnd }, status: "scheduled" },
    },
    include: { scheduledSession: { include: { ageGroup: true, location: true } } },
    orderBy: { scheduledSession: { date: "asc" } },
    take: 20,
  });

  return rows.map((r) => ({
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
    priority: sessionStart(r.scheduledSession) <= priorityEnd,
  }));
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
};

// The "someone needs to know" surface for admins and head coaches: sessions
// in the confirmation window where at least one assigned coach is still
// PENDING or has DECLINED. Scope is all sessions (admins) or sessions the
// head coach is assigned to (coaches who can approve requests).
export async function getStaffingAlerts(perms: Permissions): Promise<StaffingAlert[]> {
  if (!perms.isAdmin && !perms.isClubManager && !(perms.canApproveRequests && !!perms.coachId)) return [];

  const settings = await getAcademySettings();
  if (!settings.preSessionConfirmationEnabled) return [];

  const now = new Date();
  const windowEnd = new Date(now.getTime() + settings.confirmationWindowHours * 60 * 60 * 1000);

  const sessionWhere = {
    date: { gte: now, lte: windowEnd },
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
    take: 20,
  });

  const alerts: StaffingAlert[] = [];
  for (const s of sessions) {
    const pending = s.coachConfirmations.filter((c) => c.status === "PENDING").map((c) => c.coach.user.name);
    const declined = s.coachConfirmations.filter((c) => c.status === "DECLINED").map((c) => c.coach.user.name);
    if (pending.length === 0 && declined.length === 0) continue;

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
    });
  }

  return alerts;
}

export function confirmationsEnabled(): Promise<boolean> {
  return getAcademySettings().then((s) => s.preSessionConfirmationEnabled);
}
