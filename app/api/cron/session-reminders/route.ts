// Vercel Cron target (see vercel.json) - sweeps every still-pending
// session confirmation inside the reminder window and pushes a notification
// to whichever coach hasn't answered yet. Nothing here is triggerable by a
// user action, which is exactly why it has to be time-based/cron rather than
// event-driven like the drill-suggestion trigger.
//
// Public route by necessity (Vercel Cron can't send a session cookie), so it
// must verify the request came from Vercel Cron before touching anything -
// Vercel sends `Authorization: Bearer $CRON_SECRET` on scheduled invocations
// when CRON_SECRET is set on the project.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getConfirmationsNeedingReminder } from "@/lib/confirmations";
import { sendPushToUser } from "@/lib/pushNotifications";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const targets = await getConfirmationsNeedingReminder();

  let sent = 0;
  for (const target of targets) {
    const title = target.priority ? "Confirm your session - priority" : "Confirm your upcoming session";
    const body = `${target.session.ageGroupName} · ${target.session.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} at ${target.session.startTime} - please confirm or decline.`;

    await sendPushToUser(target.userId, title, body, "/");
    sent++;
  }

  // Stamp lastRemindedAt on everything just notified, in one batch, so the
  // next run (an hour from now) skips these until the cooldown passes.
  if (targets.length > 0) {
    await prisma.sessionCoachConfirmation.updateMany({
      where: { id: { in: targets.map((t) => t.confirmationId) } },
      data: { lastRemindedAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true, reminded: sent });
}
