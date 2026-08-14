// Shared approval resolution for the dashboard inbox. The same chain rules
// that gate the per-page approve/reject actions (attendance + sessions) must
// gate what appears here, so a user never sees a request they can't act on:
//
//   - Admins approve everything.
//   - A head coach with canApproveRequests can approve:
//       • SESSION_SHARE proposals (any coach)
//       • ATTENDANCE_CONFIRM proposals from ASSISTANT coaches — and only for
//         sessions where they are the head coach.
//   - Never your own proposal.
//   - A head coach's proposal is admin-only (nothing in the inbox outranks it).
//
// Apply logic is shared with the dashboard approve/reject actions; the page
// actions under app/attendance and app/sessions are left untouched.

import { prisma } from "./prisma";
import { logActivity } from "./logActivity";
import { PlayerAttendanceStatus } from "@prisma/client";
import type { Permissions } from "./permissions";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

function sessionStart(session: { date: Date; startTime: string }): Date {
  const [h, m] = session.startTime.split(":").map(Number);
  const start = new Date(session.date);
  start.setHours(h, m, 0, 0);
  return start;
}

function sessionDeadline(session: { date: Date; startTime: string }): Date {
  return new Date(sessionStart(session).getTime() - SIX_HOURS_MS);
}

export type InboxRequest = {
  id: string;
  type: "ATTENDANCE_CONFIRM" | "SESSION_SHARE";
  requesterName: string;
  detail: string;
  summary?: string;
  createdAt: Date;
};

// Which pending requests can THIS user approve? Scoped to their role and
// permissions — the same authorization the approve action re-checks. Only
// admins and head coaches ever get canApproveRequests (see permissions.ts),
// so this gate matches the per-page actions exactly.
export async function getApprovalInbox(perms: Permissions): Promise<InboxRequest[]> {
  const canApprove = perms.isAdmin || (perms.canApproveRequests && !!perms.coachId);
  if (!canApprove) return [];

  const requests = await prisma.approvalRequest.findMany({
    where: { status: "PENDING" },
    include: { requestedBy: { include: { user: { select: { name: true } } } } },
    orderBy: { createdAt: "asc" },
  });

  // Batch-load the referenced sessions + plans for display.
  const attendancePayloads = requests
    .filter((r) => r.type === "ATTENDANCE_CONFIRM")
    .map((r) => r.payload as { scheduledSessionId?: string });
  const sharePayloads = requests
    .filter((r) => r.type === "SESSION_SHARE")
    .map((r) => r.payload as { sessionId?: string });

  const sessionIds = [...new Set(attendancePayloads.map((p) => p.scheduledSessionId).filter(Boolean))] as string[];
  const planIds = [...new Set(sharePayloads.map((p) => p.sessionId).filter(Boolean))] as string[];

  const [sessions, plans] = await Promise.all([
    prisma.scheduledSession.findMany({
      where: { id: { in: sessionIds } },
      include: { ageGroup: true, headCoaches: { select: { id: true } } },
    }),
    prisma.session.findMany({
      where: { id: { in: planIds } },
      select: { id: true, name: true, drills: { select: { drill: { select: { name: true } } } } },
    }),
  ]);
  const sessionMap = new Map(sessions.map((s) => [s.id, s]));
  const planMap = new Map(plans.map((s) => [s.id, s]));

  const inbox: InboxRequest[] = [];
  for (const r of requests) {
    if (r.requestedById === perms.coachId) continue; // never your own

    if (r.type === "ATTENDANCE_CONFIRM") {
      const payload = r.payload as { scheduledSessionId?: string };
      const session = payload.scheduledSessionId ? sessionMap.get(payload.scheduledSessionId) : undefined;
      if (!session) continue;
      const requesterIsHead = r.requestedBy.designation === "HEAD";
      const isHeadOfSession = session.headCoaches.some((c) => c.id === perms.coachId);
      if (!perms.isAdmin && (requesterIsHead || !isHeadOfSession || !perms.canApproveRequests)) continue;

      const payloadStatuses = r.payload as { statuses?: { playerId: string; status: string }[] };
      const attended = payloadStatuses.statuses?.filter((s) => s.status === "ATTENDED").length ?? 0;
      const absent = payloadStatuses.statuses?.filter((s) => s.status === "ABSENT").length ?? 0;
      const when = session.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
      inbox.push({
        id: r.id,
        type: "ATTENDANCE_CONFIRM",
        requesterName: r.requestedBy.user.name,
        detail: `${session.ageGroup.name} · ${when} ${session.startTime}`,
        summary: `Attendance: ${attended} attended · ${absent} absent`,
        createdAt: r.createdAt,
      });
    } else if (r.type === "SESSION_SHARE") {
      const payload = r.payload as { sessionId?: string };
      const plan = payload.sessionId ? planMap.get(payload.sessionId) : undefined;
      if (!plan) continue;
      inbox.push({
        id: r.id,
        type: "SESSION_SHARE",
        requesterName: r.requestedBy.user.name,
        detail: plan.name,
        summary: `${plan.drills.length} ${plan.drills.length === 1 ? "drill" : "drills"}`,
        createdAt: r.createdAt,
      });
    }
  }

  return inbox;
}

// Re-check authorization at apply time (never trust the inbox — the request
// may have been resolved since render). Returns the loaded request plus its
// session or plan when the user may act, or null.
export async function loadActionable(requestId: string, perms: Permissions) {
  const canApprove = perms.isAdmin || (perms.canApproveRequests && !!perms.coachId);
  if (!canApprove) return null;

  const request = await prisma.approvalRequest.findUnique({
    where: { id: requestId },
    include: { requestedBy: true },
  });
  if (!request || request.status !== "PENDING") return null;
  if (request.requestedById === perms.coachId) return null;

  if (request.type === "ATTENDANCE_CONFIRM") {
    const payload = request.payload as { scheduledSessionId?: string };
    const session = payload.scheduledSessionId
      ? await prisma.scheduledSession.findUnique({
          where: { id: payload.scheduledSessionId },
          include: { headCoaches: true },
        })
      : null;
    if (!session) return null;
    const requesterIsHead = request.requestedBy.designation === "HEAD";
    const isHeadOfSession = session.headCoaches.some((c) => c.id === perms.coachId);
    if (!perms.isAdmin && (requesterIsHead || !isHeadOfSession || !perms.canApproveRequests)) return null;
    return { request, session };
  }

  if (request.type === "SESSION_SHARE") {
    const payload = request.payload as { sessionId?: string };
    const plan = payload.sessionId ? await prisma.session.findUnique({ where: { id: payload.sessionId } }) : null;
    if (!plan) return null;
    return { request, session: null };
  }

  return null;
}

// Apply an approval decision. `approve` false means reject. Returns a human
// label for activity logging; the caller handles redirect/revalidate.
export async function applyDecision(
  requestId: string,
  perms: Permissions,
  approve: boolean
): Promise<{ ok: true; label: string } | { ok: false }> {
  const loaded = await loadActionable(requestId, perms);
  if (!loaded) return { ok: false };

  const { request, session } = loaded;
  const status = approve ? "APPROVED" : "REJECTED";

  if (request.type === "ATTENDANCE_CONFIRM" && session) {
    if (approve) {
      const payload = request.payload as { statuses?: { playerId: string; status: string }[] };
      const deadline = sessionDeadline(session);
      for (const { playerId, status: s } of payload.statuses ?? []) {
        await prisma.playerAttendance.upsert({
          where: { playerId_scheduledSessionId: { playerId, scheduledSessionId: session.id } },
          update: { status: s as PlayerAttendanceStatus, confirmedAt: new Date() },
          create: {
            playerId,
            scheduledSessionId: session.id,
            status: s as PlayerAttendanceStatus,
            deadline,
            confirmedAt: new Date(),
          },
        });
      }
    }
    await prisma.approvalRequest.update({ where: { id: requestId }, data: { status, resolvedById: perms.coachId, resolvedAt: new Date() } });
    if (perms.userId) await logActivity(perms.userId, approve ? "approved_request" : "rejected_request", "ApprovalRequest", requestId, "attendance");
    return { ok: true, label: "attendance" };
  }

  if (request.type === "SESSION_SHARE") {
    const payload = request.payload as { sessionId?: string };
    if (payload.sessionId) {
      await prisma.session.update({
        where: { id: payload.sessionId },
        data: approve ? { isPrivate: false, shareStatus: "APPROVED" } : { shareStatus: "REJECTED" },
      });
    }
    await prisma.approvalRequest.update({ where: { id: requestId }, data: { status, resolvedById: perms.coachId, resolvedAt: new Date() } });
    if (perms.userId) await logActivity(perms.userId, approve ? "approved_request" : "rejected_request", "ApprovalRequest", requestId, "session_share");
    return { ok: true, label: "session_share" };
  }

  return { ok: false };
}
