"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { getPermissions } from "@/lib/permissions";
import { logActivity } from "@/lib/logActivity";
import { notifyUser } from "@/lib/notifications";

// Pushes an in-app notification (and push if subscribed) to every coach
// whose userId we can look up from their Coach row. Best-effort: a
// notification failure must never break the schedule change that triggered it.
async function notifyCoaches(coachIds: string[], title: string, body: string, url: string) {
  if (coachIds.length === 0) return;
  try {
    const coaches = await prisma.coach.findMany({ where: { id: { in: coachIds } }, select: { userId: true } });
    await Promise.all(
      coaches.map((c) =>
        notifyUser({ userId: c.userId, title, body, link: url, category: "GENERAL" })
      )
    );
  } catch {
    // Best-effort - see above.
  }
}

function formatSessionWhen(date: Date, startTime: string): string {
  return `${date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} at ${startTime}`;
}

function sameCoachSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}

// Only notify when something a coach would actually care about changed -
// date, time, location, or who's assigned. Editing an unrelated field
// (duration, age group) doesn't fire this. Notifies the NEW (post-edit)
// coach list - the people who need to know their session just changed.
async function notifySessionChangeIfRelevant(
  before: { date: Date; startTime: string; locationId: string; headCoaches: { id: string }[]; assistantCoaches: { id: string }[] },
  after: { date: Date; startTime: string; locationId: string; coachIds: string[] }
) {
  const beforeCoachIds = [...before.headCoaches.map((c) => c.id), ...before.assistantCoaches.map((c) => c.id)];
  const changed =
    before.date.getTime() !== after.date.getTime() ||
    before.startTime !== after.startTime ||
    before.locationId !== after.locationId ||
    !sameCoachSet(beforeCoachIds, after.coachIds);
  if (!changed) return;

  await notifyCoaches(
    after.coachIds,
    "Session details changed",
    `Your session on ${formatSessionWhen(after.date, after.startTime)} was updated - check the schedule for details.`,
    "/schedule"
  );
}

export async function createScheduledSession(formData: FormData) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditSchedule)) redirect("/schedule?error=no_permission");

  const date = formData.get("date") as string;
  const time = formData.get("time") as string;
  const duration = Number(formData.get("duration"));
  const ageGroupId = formData.get("ageGroupId") as string;
  const locationId = formData.get("locationId") as string;
  const headCoachIds = formData.getAll("headCoaches") as string[];
  const assistantCoachIds = formData.getAll("assistantCoaches") as string[];
  const recurring = formData.get("recurring") === "on";
  const weeks = recurring ? Math.max(1, Number(formData.get("weeks")) || 1) : 1;

  if (!date || !time || !duration || !ageGroupId || !locationId || headCoachIds.length === 0) {
    redirect("/schedule?error=missing_fields");
  }

  // Recurring sessions share this ID so we can identify "the same slot,
  // different weeks" later, even though each week is its own row and can
  // eventually be edited independently (e.g. different coaches some weeks).
  const recurrenceGroupId = recurring ? randomUUID() : null;

  const baseDate = new Date(date + "T00:00:00");
  const dates = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i * 7);
    return d;
  });

  for (const d of dates) {
    const session = await prisma.scheduledSession.create({
      data: {
        date: d,
        startTime: time,
        durationMinutes: duration,
        ageGroupId,
        locationId,
        recurring,
        recurrenceGroupId,
        headCoaches: { connect: headCoachIds.map((id) => ({ id })) },
        assistantCoaches: { connect: assistantCoachIds.map((id) => ({ id })) },
      },
    });

    // Pre-session RSVP rows - one per assigned coach, PENDING. Only created
    // when the academy-wide confirmation feature is enabled (checked lazily
    // via the singleton so a brand-new DB without settings still works).
    const settings = await prisma.academySettings.findFirst();
    if (settings?.preSessionConfirmationEnabled !== false) {
      const coachIds = [...headCoachIds, ...assistantCoachIds];
      if (coachIds.length > 0) {
        await prisma.sessionCoachConfirmation.createMany({
          data: coachIds.map((coachId) => ({
            scheduledSessionId: session.id,
            coachId,
            status: "PENDING",
          })),
          skipDuplicates: true,
        });
      }
    }

    await notifyCoaches(
      [...headCoachIds, ...assistantCoachIds],
      "You've been added to a session",
      `A session on ${formatSessionWhen(d, time)} has been scheduled with you.`,
      "/schedule"
    );
  }

  if (perms.userId) await logActivity(perms.userId, "scheduled_session", "ScheduledSession", undefined, `${weeks} x ${date} ${time}`);

  revalidatePath("/schedule");
  redirect(`/schedule?success=${encodeURIComponent(weeks > 1 ? `${weeks} weekly sessions scheduled.` : "Session scheduled.")}`);
}

export async function deleteScheduledSession(id: string) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditSchedule)) redirect("/schedule?error=no_permission");

  // Read who was assigned before deleting - there's nothing left to read
  // from afterward.
  const existing = await prisma.scheduledSession.findUnique({
    where: { id },
    select: { date: true, startTime: true, headCoaches: { select: { id: true } }, assistantCoaches: { select: { id: true } } },
  });

  // Deletes only this one instance, not the whole recurring series.
  // Deleting an entire recurring series at once isn't built yet.
  await prisma.scheduledSession.delete({ where: { id } });
  if (perms.userId) await logActivity(perms.userId, "deleted_scheduled_session", "ScheduledSession", id);

  if (existing) {
    await notifyCoaches(
      [...existing.headCoaches.map((c) => c.id), ...existing.assistantCoaches.map((c) => c.id)],
      "Session cancelled",
      `A session you were assigned to on ${formatSessionWhen(existing.date, existing.startTime)} was cancelled.`,
      "/schedule"
    );
  }

  revalidatePath("/schedule");
  redirect("/schedule?success=Session removed.");
}

// Edit a scheduled session. Recurring sessions can be edited one instance at
// a time ("this"), or this instance plus every future instance in the same
// series ("this and future"). Coach changes are reconciled with the pre-
// session confirmation rows: newly added coaches get a PENDING row, removed
// coaches get theirs cleared.
export async function updateScheduledSession(scheduledSessionId: string, formData: FormData) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditSchedule)) redirect("/schedule?error=no_permission");

  const date = formData.get("date") as string;
  const time = formData.get("time") as string;
  const duration = Number(formData.get("duration"));
  const ageGroupId = formData.get("ageGroupId") as string;
  const locationId = formData.get("locationId") as string;
  const headCoachIds = formData.getAll("headCoaches") as string[];
  const assistantCoachIds = formData.getAll("assistantCoaches") as string[];
  const scope = formData.get("scope") as string;

  if (!date || !time || !duration || !ageGroupId || !locationId || headCoachIds.length === 0) {
    redirect("/schedule?error=missing_fields");
  }
  if (scope !== "this" && scope !== "all_future") redirect("/schedule?error=missing_fields");

  const session = await prisma.scheduledSession.findUnique({
    where: { id: scheduledSessionId },
    include: { headCoaches: { select: { id: true } }, assistantCoaches: { select: { id: true } } },
  });
  if (!session) redirect("/schedule");

  const coachIds = [...headCoachIds, ...assistantCoachIds];
  const data = {
    date: new Date(date + "T00:00:00"),
    startTime: time,
    durationMinutes: duration,
    ageGroupId,
    locationId,
    headCoaches: { set: headCoachIds.map((id) => ({ id })) },
    assistantCoaches: { set: assistantCoachIds.map((id) => ({ id })) },
  };

  if (scope === "all_future" && session.recurrenceGroupId) {
    // This instance and every later instance in the series move together. If
    // the date changed, future weeks shift by the same number of days so the
    // weekly cadence holds.
    const delta = data.date.getTime() - session.date.getTime();
    const siblings = await prisma.scheduledSession.findMany({
      where: { recurrenceGroupId: session.recurrenceGroupId, date: { gte: session.date } },
      include: { headCoaches: { select: { id: true } }, assistantCoaches: { select: { id: true } } },
    });
    for (const s of siblings) {
      const newDate = new Date(s.date.getTime() + delta);
      await prisma.scheduledSession.update({
        where: { id: s.id },
        data: { ...data, date: newDate },
      });
      await syncConfirmations(s.id, coachIds);
      await notifySessionChangeIfRelevant(s, { date: newDate, startTime: time, locationId, coachIds });
    }
  } else {
    await prisma.scheduledSession.update({ where: { id: scheduledSessionId }, data });
    await syncConfirmations(scheduledSessionId, coachIds);
    await notifySessionChangeIfRelevant(session, { date: data.date, startTime: time, locationId, coachIds });
  }

  if (perms.userId) await logActivity(perms.userId, "updated_scheduled_session", "ScheduledSession", scheduledSessionId, `${date} ${time}`);
  revalidatePath("/schedule");
  redirect("/schedule?success=Session updated.");
}

// Keep the pre-session confirmation rows in step with a session's assigned
// coaches: add PENDING rows for coaches who don't have one yet, clear rows
// for coaches no longer on the session. No-op when the confirmation feature
// is disabled.
async function syncConfirmations(scheduledSessionId: string, coachIds: string[]) {
  const settings = await prisma.academySettings.findFirst();
  if (settings?.preSessionConfirmationEnabled === false) return;

  const existing = await prisma.sessionCoachConfirmation.findMany({
    where: { scheduledSessionId },
    select: { coachId: true },
  });
  const existingIds = new Set(existing.map((c) => c.coachId));
  const newCoachIds = coachIds.filter((id) => !existingIds.has(id));

  if (newCoachIds.length > 0) {
    await prisma.sessionCoachConfirmation.createMany({
      data: newCoachIds.map((coachId) => ({ scheduledSessionId, coachId, status: "PENDING" })),
      skipDuplicates: true,
    });
  }

  const removedIds = existing.filter((c) => !coachIds.includes(c.coachId)).map((c) => c.coachId);
  if (removedIds.length > 0) {
    await prisma.sessionCoachConfirmation.deleteMany({
      where: { scheduledSessionId, coachId: { in: removedIds } },
    });
  }
}

// Attach a drill plan (Session) to a calendar slot. The window for doing so
// is 72 hours after the session's end time - after that, both attaching and
// editing the attached plan are locked (confirmed product decision; the
// 72h cutoff gates editing, and the attach control is hidden too).
export async function attachSessionPlan(scheduledSessionId: string, formData: FormData) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditSchedule)) redirect("/schedule?error=no_permission");

  const sessionId = formData.get("sessionId") as string;
  if (!sessionId) redirect("/schedule?error=missing_fields");

  const scheduledSession = await prisma.scheduledSession.findUnique({
    where: { id: scheduledSessionId },
  });
  if (!scheduledSession) redirect("/schedule");

  const endTime = sessionEnd(scheduledSession);
  if (new Date() > new Date(endTime.getTime() + 72 * 60 * 60 * 1000)) {
    redirect("/schedule?error=attach_window_closed");
  }

  // Attacher must own the plan or have team visibility into it.
  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      OR: [{ createdById: perms.coachId ?? "" }, { shareStatus: "APPROVED" }],
    },
  });
  if (!session) redirect("/schedule?error=no_permission");

  await prisma.scheduledSession.update({
    where: { id: scheduledSessionId },
    data: { sessionId },
  });

  if (perms.userId) await logActivity(perms.userId, "attached_session_plan", "ScheduledSession", scheduledSessionId, session.name);
  revalidatePath("/schedule");
  redirect("/schedule?success=Session plan attached.");
}

// Detach an attached plan while still within the 72h window.
export async function detachSessionPlan(scheduledSessionId: string) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditSchedule)) redirect("/schedule?error=no_permission");

  const scheduledSession = await prisma.scheduledSession.findUnique({
    where: { id: scheduledSessionId },
  });
  if (!scheduledSession || !scheduledSession.sessionId) redirect("/schedule");

  const endTime = sessionEnd(scheduledSession);
  if (new Date() > new Date(endTime.getTime() + 72 * 60 * 60 * 1000)) {
    redirect("/schedule?error=attach_window_closed");
  }

  await prisma.scheduledSession.update({
    where: { id: scheduledSessionId },
    data: { sessionId: null },
  });

  if (perms.userId) await logActivity(perms.userId, "detached_session_plan", "ScheduledSession", scheduledSessionId);
  revalidatePath("/schedule");
  redirect("/schedule?success=Session plan removed.");
}

function sessionEnd(s: { date: Date; startTime: string; durationMinutes: number; timeZone?: string }): Date {
  return sessionEnd(s);
}
