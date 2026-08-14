"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { getPermissions } from "@/lib/permissions";
import { logActivity } from "@/lib/logActivity";

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
    await prisma.scheduledSession.create({
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
  }

  if (perms.userId) await logActivity(perms.userId, "scheduled_session", "ScheduledSession", undefined, `${weeks} x ${date} ${time}`);

  revalidatePath("/schedule");
  redirect(`/schedule?success=${encodeURIComponent(weeks > 1 ? `${weeks} weekly sessions scheduled.` : "Session scheduled.")}`);
}

export async function deleteScheduledSession(id: string) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditSchedule)) redirect("/schedule?error=no_permission");

  // Deletes only this one instance, not the whole recurring series.
  // Deleting an entire recurring series at once isn't built yet.
  await prisma.scheduledSession.delete({ where: { id } });
  if (perms.userId) await logActivity(perms.userId, "deleted_scheduled_session", "ScheduledSession", id);
  revalidatePath("/schedule");
  redirect("/schedule?success=Session removed.");
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

function sessionEnd(s: { date: Date; startTime: string; durationMinutes: number }): Date {
  const [h, m] = s.startTime.split(":").map(Number);
  const start = new Date(s.date);
  start.setHours(h, m, 0, 0);
  return new Date(start.getTime() + s.durationMinutes * 60 * 1000);
}
