"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { getPermissions } from "@/lib/permissions";

export async function createScheduledSession(formData: FormData) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditSchedule)) return;

  const date = formData.get("date") as string;
  const time = formData.get("time") as string;
  const duration = Number(formData.get("duration"));
  const ageGroupId = formData.get("ageGroupId") as string;
  const locationId = formData.get("locationId") as string;
  const headCoachIds = formData.getAll("headCoaches") as string[];
  const assistantCoachIds = formData.getAll("assistantCoaches") as string[];
  const recurring = formData.get("recurring") === "on";
  const weeks = recurring ? Math.max(1, Number(formData.get("weeks")) || 1) : 1;

  if (!date || !time || !duration || !ageGroupId || !locationId || headCoachIds.length === 0) return;

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

  revalidatePath("/schedule");
}

export async function deleteScheduledSession(id: string) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canEditSchedule)) return;

  // Deletes only this one instance, not the whole recurring series.
  // Deleting an entire recurring series at once isn't built yet.
  await prisma.scheduledSession.delete({ where: { id } });
  revalidatePath("/schedule");
}
