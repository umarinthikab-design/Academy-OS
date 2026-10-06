// Dashboard approve/reject actions. These delegate to the shared approval
// logic in lib/approvals.ts (same chain-direction authorization as the
// attendance/sessions pages) but stay on the dashboard instead of
// redirecting to a per-page route.

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPermissions } from "@/lib/permissions";
import { applyDecision } from "@/lib/approvals";
import { logActivity } from "@/lib/logActivity";
import { notifyUser } from "@/lib/notifications";

export async function approveRequest(requestId: string) {
  const perms = await getPermissions();
  const result = await applyDecision(requestId, perms, true);
  if (!result.ok) redirect("/requests?error=no_permission");

  revalidatePath("/");
  revalidatePath("/requests");
  revalidatePath("/attendance");
  revalidatePath("/sessions");
  redirect("/requests?success=Request approved.");
}

export async function rejectRequest(requestId: string) {
  const perms = await getPermissions();
  const result = await applyDecision(requestId, perms, false);
  if (!result.ok) redirect("/requests?error=no_permission");

  revalidatePath("/");
  revalidatePath("/requests");
  revalidatePath("/attendance");
  revalidatePath("/sessions");
  redirect("/requests?success=Request rejected.");
}

// Post a message on a request's thread - either side of the conversation.
// The requester can reply to feedback; anyone who could approve the request
// can suggest changes. Both are gated here so a stray form can't post to a
// thread the user has no business touching. Authors are Users (admins have no
// Coach row, so the message is attached by userId).
export async function addApprovalMessage(requestId: string, formData: FormData) {
  const perms = await getPermissions();
  const message = formData.get("message") as string;
  if (!perms.userId || !message?.trim()) redirect("/?error=missing_fields");

  const request = await prisma.approvalRequest.findUnique({ where: { id: requestId } });
  if (!request || request.status !== "PENDING") redirect("/?error=no_permission");

  const isRequester = request.requestedById === perms.coachId;
  const isApprover = perms.isAdmin || perms.isClubManager || (perms.canApproveRequests && !!perms.coachId);
  if (!isRequester && !isApprover) redirect("/?error=no_permission");

  await prisma.approvalMessage.create({
    data: { approvalRequestId: requestId, authorId: perms.userId, message: message.trim() },
  });

  if (perms.userId) await logActivity(perms.userId, "added_approval_feedback", "ApprovalRequest", requestId);
  revalidatePath("/");
  revalidatePath("/requests");
  redirect("/requests?success=Feedback sent.");
}

// Self-service pre-session RSVP. The coach confirms or declines their own
// attendance row - no approval chain, no admin/head gate. Only the coach who
// owns the row can act on it. A DECLINED answer is surfaced to admins/heads
// via the dashboard "Needs attention" section AND an immediate push (the
// session may now be short-staffed) - event-driven, not the 72h/48h
// reminder cron, since this can't wait for the next hourly sweep.
export async function confirmSessionParticipation(
  confirmationId: string,
  status: "CONFIRMED" | "DECLINED"
) {
  const perms = await getPermissions();
  if (!perms.coachId) redirect("/?error=no_permission");

  const row = await prisma.sessionCoachConfirmation.findUnique({
    where: { id: confirmationId },
    include: {
      coach: { select: { user: { select: { name: true } } } },
      scheduledSession: { select: { date: true, startTime: true, ageGroup: { select: { name: true } }, headCoaches: { select: { id: true, userId: true } } } },
    },
  });
  if (!row || row.coachId !== perms.coachId || row.status !== "PENDING") {
    redirect("/?error=no_permission");
  }

  await prisma.sessionCoachConfirmation.update({
    where: { id: confirmationId },
    data: { status, confirmedAt: new Date() },
  });

  if (perms.userId) {
    await logActivity(perms.userId, status === "CONFIRMED" ? "confirmed_session_participation" : "declined_session_participation", "SessionCoachConfirmation", confirmationId, row.scheduledSessionId);
  }

  if (status === "DECLINED") {
    const admins = await prisma.user.findMany({ where: { role: { in: ["ADMIN", "CLUB_MANAGER"] }, archivedAt: null }, select: { id: true } });
    // The session's head coach(es), excluding the coach who just declined
    // (relevant if a head coach declines their own session).
    const headUserIds = row.scheduledSession.headCoaches.filter((c) => c.id !== perms.coachId).map((c) => c.userId);
    const recipientUserIds = [...new Set([...admins.map((u) => u.id), ...headUserIds])];

    const when = `${row.scheduledSession.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} at ${row.scheduledSession.startTime}`;
    await Promise.all(
      recipientUserIds.map((userId) =>
        notifyUser({
          userId,
          title: "Coach declined a session",
          body: `${row.coach.user.name} declined ${row.scheduledSession.ageGroup.name} on ${when} - may need re-staffing.`,
          link: "/",
          category: "ATTENDANCE",
        })
      )
    ).catch(() => {});
  }

  revalidatePath("/");
  revalidatePath("/schedule");
  redirect(status === "CONFIRMED" ? "/?success=You're confirmed for this session." : "/?success=You declined - the club has been notified.");
}
