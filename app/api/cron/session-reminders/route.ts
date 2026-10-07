// Vercel Cron target (see vercel.json) - sweeps every still-pending
// session confirmation inside the reminder window and pushes a notification
// to whichever coach hasn't answered yet. Nothing here is triggerable by a
// user action, which is exactly why it has to be time-based/cron rather than
// event-driven like the drill-suggestion trigger.
//
// Runs once daily (Vercel's Hobby plan doesn't allow a tighter cron
// schedule) - this trades reminder precision for cost. A coach may not be
// nudged until well into the 72h/48h window rather than within an hour of
// crossing it, but getConfirmationsNeedingReminder's 6h cooldown still
// prevents a double-send if the schedule is ever tightened later.
//
// Public route by necessity (Vercel Cron can't send a session cookie), so it
// must verify the request came from Vercel Cron before touching anything -
// Vercel sends `Authorization: Bearer $CRON_SECRET` on scheduled invocations
// when CRON_SECRET is set on the project.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getConfirmationsNeedingReminder } from "@/lib/confirmations";
import { sendPushToUser } from "@/lib/pushNotifications";
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

  const targets = await getConfirmationsNeedingReminder();

  let sent = 0;
  for (const target of targets) {
    const title = target.priority ? "Confirm your session - priority" : "Confirm your upcoming session";
    const body = `${target.session.ageGroupName} · ${target.session.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} at ${target.session.startTime} - please confirm or decline.`;

    await sendPushToUser(target.userId, title, body, "/");
    sent++;
  }

  // Stamp lastRemindedAt on everything just notified, in one batch, so the
  // next run (a day from now) skips these until the cooldown passes.
  if (targets.length > 0) {
    await prisma.sessionCoachConfirmation.updateMany({
      where: { id: { in: targets.map((t) => t.confirmationId) } },
      data: { lastRemindedAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true, reminded: sent });
}
