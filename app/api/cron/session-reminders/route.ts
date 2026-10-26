// Vercel Cron target (see vercel.json). Two sweeps:
//  1. Reminders - pushes a notification to every coach who still hasn't
//     answered a pre-session confirmation inside the reminder window.
//  2. Overdue notices - once a coach's response deadline has passed with no
//     answer, tells admins/club managers and the session's head coaches (one
//     notice per session, stamped overdueNotifiedAt so it is sent only once).
//
// Runs once daily (Vercel's Hobby plan doesn't allow a tighter cron
// schedule), so both pushes can arrive later than the exact moment; the
// dashboard "Needs attention" flag is live regardless.
//
// Public route by necessity (Vercel Cron can't send a session cookie), so it
// must verify the request came from Vercel Cron before touching anything -
// Vercel sends `Authorization: Bearer $CRON_SECRET` on scheduled invocations
// when CRON_SECRET is set on the project.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getConfirmationsNeedingReminder, getOverdueConfirmationsToNotify } from "@/lib/confirmations";
import { sendPushToUser } from "@/lib/pushNotifications";
import { notifyUser } from "@/lib/notifications";
import { safeEqual } from "@/lib/safeEqual";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");

  // Fail closed: if CRON_SECRET is not configured, reject the request.
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Also validate using constant-time comparison via safeEqual, in case
  // the header format is slightly different but the token matches.
  const headerToken = authHeader?.replace("Bearer ", "") ?? "";
  if (!safeEqual(headerToken, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ---- 1. Reminders to coaches who haven't answered ----
  const targets = await getConfirmationsNeedingReminder();

  let sent = 0;
  for (const target of targets) {
    const title = target.priority ? "Confirm your session - priority" : "Confirm your upcoming session";
    const body = `${target.session.ageGroupName} \u00b7 ${target.session.date.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })} at ${target.session.startTime} - please confirm or decline.`;

    await sendPushToUser(target.userId, title, body, "/");
    sent++;
  }

  // Stamp lastRemindedAt on everything just notified, in one batch, so the
  // next run skips these until the cooldown passes.
  if (targets.length > 0) {
    await prisma.sessionCoachConfirmation.updateMany({
      where: { id: { in: targets.map((t) => t.confirmationId) } },
      data: { lastRemindedAt: new Date() },
    });
  }

  // ---- 2. Overdue notices to admins / head coaches (once each) ----
  const overdue = await getOverdueConfirmationsToNotify();
  if (overdue.length > 0) {
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "CLUB_MANAGER"] }, archivedAt: null },
      select: { id: true },
    });

    const bySession = new Map<string, typeof overdue>();
    for (const o of overdue) {
      const list = bySession.get(o.session.id) ?? [];
      list.push(o);
      bySession.set(o.session.id, list);
    }

    for (const group of bySession.values()) {
      const first = group[0];
      const names = group.map((g) => g.coachName).join(", ");
      const when = `${first.session.date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })} at ${first.session.startTime}`;
      const recipients = new Set<string>([...admins.map((a) => a.id), ...first.headCoachUserIds]);
      for (const g of group) recipients.delete(g.coachUserId);
      const day = first.session.date.toISOString().slice(0, 10);
      const link = `/schedule?ageGroup=${first.session.ageGroupId}&from=${day}&to=${day}`;

      await Promise.all(
        [...recipients].map((userId) =>
          notifyUser({
            userId,
            title: "Coach response overdue",
            body: `${names} did not respond for ${first.session.ageGroupName} on ${when} - the response deadline has passed.`,
            link,
            category: "ATTENDANCE",
          })
        )
      ).catch(() => {});
    }

    await prisma.sessionCoachConfirmation.updateMany({
      where: { id: { in: overdue.map((o) => o.confirmationId) } },
      data: { overdueNotifiedAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true, reminded: sent, overdueNotified: overdue.length });
}