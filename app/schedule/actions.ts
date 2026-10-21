"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { getPermissions } from "@/lib/permissions";
import { logActivity } from "@/lib/logActivity";
import { notifyUser } from "@/lib/notifications";
import { sessionStartAt } from "@/lib/academyTime";

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
  return `${date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })} at ${startTime}`;
}

function sameCoachSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}

// True when any of these coaches already has a session that overlaps this
// time window on one of these calendar dates.
async function hasConflict(opts: { dates: Date[]; time: string; duration: number; coachIds: string[]; excludeId?: string }): Promise<boolean> {
  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const start = toMin(opts.time);
  const end = start + opts.duration;
  const others = await prisma.scheduledSession.findMany({
    where: {
      date: { in: opts.dates },
      status: { not: "cancelled" },
      ...(opts.excludeId ? { id: { not: opts.excludeId } } : {}),
      OR: [
        { headCoaches: { some: { id: { in: opts.coachIds } } } },
        { assistantCoaches: { some: { id: { in: opts.coachIds } } } },
      ],
    },
    select: { startTime: true, durationMinutes: true },
  });
  return others.some((o) => { const st = toMin(o.startTime); return start < st + o.durationMinutes && st < end; });
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
  const weeks = recurring ? Math.min(52, Math.max(1, Number(formData.get("weeks")) || 1)) : 1;

  if (!date || !time || !duration || !ageGroupId || !locationId || headCoachIds.length === 0) {
    redirect("/schedule?error=missing_fields");
  }

  // Recurring sessions share this ID so we can identify "the same slot,
  // different weeks" later, even though each week is its own row and can
  // eventually be edited independently (e.g. different coaches some weeks).
  const recurrenceGroupId = recurring ? randomUUID() : null;

  const baseDate = new Date(date + "T00:00:00Z");
  const dates = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(baseDate);
    d.setUTCDate(d.getUTCDate() + i * 7);
    return d;
  });

  if (await hasConflict({ dates, time, duration, coachIds: [...headCoachIds, ...assistantCoachIds] })) redirect("/schedule?error=schedule_conflict");

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

  const recorded = await prisma.playerAttendance.count({ where: { scheduledSessionId: id, status: { not: "NO_RESPONSE" } } });
  const resolvedRow = await prisma.scheduledSession.findUnique({ where: { id }, select: { resolvedAt: true } });
  if (recorded > 0 || resolvedRow?.resolvedAt) redirect("/schedule?error=session_has_records");

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
    date: new Date(date + "T00:00:00Z"),
    startTime: time,
    durationMinutes: duration,
    ageGroupId,
    locationId,
    headCoaches: { set: headCoachIds.map((id) => ({ id })) },
    assistantCoaches: { set: assistantCoachIds.map((id) => ({ id })) },
  };

  if (scope === "this" && (await hasConflict({ dates: [data.date], time, duration, coachIds, excludeId: scheduledSessionId }))) redirect("/schedule?error=schedule_conflict");

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

  const endTime = await sessionEnd(scheduledSession);
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

  const endTime = await sessionEnd(scheduledSession);
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

async function sessionEnd(s: { date: Date; startTime: string; durationMinutes: number }): Promise<Date> {
  const start = await sessionStartAt(s);
  return new Date(start.getTime() + s.durationMinutes * 60 * 1000);
}

// Cancel (not delete): the session stays on record, coaches are told, and it
// drops out of attendance, reminders and dashboards.
export async function cancelScheduledSession(id: string) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditSchedule)) redirect("/schedule?error=no_permission");

  const s = await prisma.scheduledSession.findUnique({
    where: { id },
    select: { date: true, startTime: true, resolvedAt: true, headCoaches: { select: { id: true } }, assistantCoaches: { select: { id: true } } },
  });
  if (!s) redirect("/schedule");
  if (s.resolvedAt) redirect("/schedule?error=session_has_records");

  await prisma.scheduledSession.update({ where: { id }, data: { status: "cancelled" } });
  if (perms.userId) await logActivity(perms.userId, "cancelled_scheduled_session", "ScheduledSession", id);
  await notifyCoaches(
    [...s.headCoaches.map((c) => c.id), ...s.assistantCoaches.map((c) => c.id)],
    "Session cancelled",
    "A session you were assigned to on " + formatSessionWhen(s.date, s.startTime) + " was cancelled.",
    "/schedule"
  );
  revalidatePath("/schedule");
  redirect("/schedule?success=" + encodeURIComponent("Session cancelled."));
}

export async function reinstateScheduledSession(id: string) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditSchedule)) redirect("/schedule?error=no_permission");
  await prisma.scheduledSession.updateMany({ where: { id, status: "cancelled" }, data: { status: "scheduled" } });
  if (perms.userId) await logActivity(perms.userId, "reinstated_scheduled_session", "ScheduledSession", id);
  revalidatePath("/schedule");
  redirect("/schedule?success=" + encodeURIComponent("Session reinstated."));
}

// Closure day (Poya, public holiday, bad weather): cancels every scheduled,
// not-yet-finalized session on one calendar date and tells the coaches.
export async function closeDay(formData: FormData) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditSchedule)) redirect("/schedule?error=no_permission");

  const date = String(formData.get("date") || "");
  const reason = String(formData.get("reason") || "").trim().slice(0, 100);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect("/schedule?error=missing_fields");
  const day = new Date(date + "T00:00:00Z");
  if (Number.isNaN(day.getTime())) redirect("/schedule?error=missing_fields");

  const sessions = await prisma.scheduledSession.findMany({
    where: { date: day, status: "scheduled", resolvedAt: null },
    select: { id: true, headCoaches: { select: { id: true } }, assistantCoaches: { select: { id: true } } },
  });
  if (sessions.length === 0) redirect("/schedule?error=no_sessions");

  await prisma.scheduledSession.updateMany({ where: { id: { in: sessions.map((x) => x.id) } }, data: { status: "cancelled" } });
  const coachIds = Array.from(new Set(sessions.flatMap((x) => [...x.headCoaches.map((c) => c.id), ...x.assistantCoaches.map((c) => c.id)])));
  const label = day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  if (perms.userId) await logActivity(perms.userId, "closed_day", "ScheduledSession", undefined, date + " (" + sessions.length + " sessions)" + (reason ? " - " + reason : ""));
  await notifyCoaches(coachIds, "Training cancelled", "All sessions on " + label + " are cancelled." + (reason ? " Reason: " + reason : ""), "/schedule");
  revalidatePath("/schedule");
  redirect("/schedule?success=" + encodeURIComponent("Closure day applied."));
}
