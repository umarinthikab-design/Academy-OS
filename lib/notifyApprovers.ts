// Shared "who can act on this" recipient resolution + push notification,
// reused by every pending-approval creation point (drill suggestions,
// attendance proposals, session share requests). Recipient rules mirror
// lib/approvals.ts's getApprovalInbox/loadActionable exactly, so a coach is
// never notified about something they in fact can't act on:
//
//   - ATTENDANCE_CONFIRM: chain-scoped. A head coach's own proposal only
//     goes to admins/club managers (nothing but admin outranks a head
//     coach); an assistant's proposal goes to that specific session's head
//     coach(es) who hold canApproveRequests, plus admins/club managers.
//   - SESSION_SHARE and DRILL: any coach with canApproveRequests, plus
//     every admin/club manager - there's no chain direction to these, any
//     approver can act.
//
// Drill suggestions don't create an ApprovalRequest row at all (Drill.status
// is its own simpler PENDING/APPROVED field - see app/drills/actions.ts), so
// this takes a small discriminated input rather than a literal
// ApprovalRequest, while still sharing one recipient-resolution code path
// for all three.

import { prisma } from "./prisma";
import { sendPushToUser } from "./pushNotifications";

export type NotifyApproversInput =
  | { type: "ATTENDANCE_CONFIRM"; requestedByCoachId: string; scheduledSessionId: string }
  | { type: "SESSION_SHARE" }
  | { type: "DRILL" };

async function adminAndClubManagerUserIds(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "CLUB_MANAGER"] }, archivedAt: null },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

async function anyApproverUserIds(): Promise<string[]> {
  const [coaches, admins] = await Promise.all([
    prisma.coach.findMany({ where: { canApproveRequests: true, user: { archivedAt: null } }, select: { userId: true } }),
    adminAndClubManagerUserIds(),
  ]);
  return [...new Set([...coaches.map((c) => c.userId), ...admins])];
}

async function resolveApproverUserIds(input: NotifyApproversInput): Promise<string[]> {
  if (input.type === "ATTENDANCE_CONFIRM") {
    const [requester, session, admins] = await Promise.all([
      prisma.coach.findUnique({ where: { id: input.requestedByCoachId }, select: { designation: true } }),
      prisma.scheduledSession.findUnique({
        where: { id: input.scheduledSessionId },
        select: { headCoaches: { where: { canApproveRequests: true }, select: { userId: true } } },
      }),
      adminAndClubManagerUserIds(),
    ]);
    const requesterIsHead = requester?.designation === "HEAD";
    const headIds = requesterIsHead ? [] : (session?.headCoaches.map((c) => c.userId) ?? []);
    return [...new Set([...headIds, ...admins])];
  }

  return anyApproverUserIds();
}

export async function notifyApprovers(input: NotifyApproversInput, title: string, body: string, url: string) {
  const userIds = await resolveApproverUserIds(input);
  await Promise.all(userIds.map((userId) => sendPushToUser(userId, title, body, url)));
}
