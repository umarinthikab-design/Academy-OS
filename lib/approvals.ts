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
import type { RequestType } from "@prisma/client";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

// Categorization for the Requests page: requests are grouped by type into
// named sections, and a section only renders when it has at least one item.
// Order here is the render order on the page.
export const REQUEST_CATEGORIES: { label: string; types: RequestType[] }[] = [
  { label: "Drill Suggestions", types: ["DRILL_ADD", "DRILL_EDIT"] },
  { label: "Session Attendance", types: ["ATTENDANCE_CONFIRM"] },
  { label: "Session Sharing", types: ["SESSION_SHARE"] },
  { label: "Schedule Changes", types: ["SCHEDULE_CREATE"] },
  { label: "Skill Updates", types: ["SKILL_UPDATE"] },
];

export function requestCategory(type: RequestType): string {
  const cat = REQUEST_CATEGORIES.find((c) => c.types.includes(type));
  return cat?.label ?? type;
}

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
  type: RequestType;
  requesterName: string;
  detail: string;
  summary?: string;
  createdAt: Date;
};

// Full content + conversation thread for a request, used by both the
// approver's inbox and the requester's "My Requests" section.
export type ApprovalDetail = {
  id: string;
  type: RequestType;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requesterName: string;
  requesterId: string;
  detail: string;
  // Human-readable lines describing exactly what is being approved.
  content: string[];
  createdAt: Date;
  resolvedAt: Date | null;
  messages: { id: string; authorName: string; authorId: string; message: string; createdAt: Date }[];
};

// Load the full detail (content + thread) for a single request. Used by the
// expanded inbox items and the requester's My Requests. Returns null if the
// request (or its referenced session/plan) is gone.
export async function getApprovalDetail(requestId: string): Promise<ApprovalDetail | null> {
  const request = await prisma.approvalRequest.findUnique({
    where: { id: requestId },
    include: {
      requestedBy: { include: { user: { select: { name: true } } } },
      messages: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!request) return null;

  const base = {
    id: request.id,
    type: request.type as RequestType,
    status: request.status,
    requesterName: request.requestedBy.user.name,
    requesterId: request.requestedById,
    detail: "",
    content: [] as string[],
    createdAt: request.createdAt,
    resolvedAt: request.resolvedAt,
    messages: request.messages.map((m) => ({
      id: m.id,
      authorName: m.author.name,
      authorId: m.authorId,
      message: m.message,
      createdAt: m.createdAt,
    })),
  };

  if (request.type === "ATTENDANCE_CONFIRM") {
    const payload = request.payload as { scheduledSessionId?: string; statuses?: { playerId: string; status: string }[] };
    const session = payload.scheduledSessionId
      ? await prisma.scheduledSession.findUnique({
          where: { id: payload.scheduledSessionId },
          include: { ageGroup: true },
        })
      : null;
    if (!session) return null;
    const statuses = payload.statuses ?? [];
    const players = await prisma.player.findMany({
      where: { id: { in: statuses.map((s) => s.playerId) } },
      select: { id: true, name: true },
    });
    const playerMap = new Map(players.map((p) => [p.id, p.name]));
    const when = session.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    base.detail = `${session.ageGroup.name} · ${when} ${session.startTime}`;
    base.content = statuses.map((s) => `${playerMap.get(s.playerId) ?? "Unknown player"} — ${s.status === "ATTENDED" ? "attended" : s.status === "ABSENT" ? "absent" : s.status}`);
    return base;
  }

  if (request.type === "SESSION_SHARE") {
    const payload = request.payload as { sessionId?: string };
    const plan = payload.sessionId
      ? await prisma.session.findUnique({
          where: { id: payload.sessionId },
          include: { drills: { include: { drill: true }, orderBy: { order: "asc" } } },
        })
      : null;
    if (!plan) return null;
    base.detail = plan.name;
    base.content = plan.drills.map((sd, i) => `${i + 1}. ${sd.drill.name}`);
    return base;
  }

  return null;
}

// Which pending requests can THIS user approve? Scoped to their role and
// permissions — the same authorization the approve action re-checks. Only
// admins and head coaches ever get canApproveRequests (see permissions.ts),
// so this gate matches the per-page actions exactly.
export async function getApprovalInbox(perms: Permissions): Promise<(InboxRequest & { full: ApprovalDetail | null })[]> {
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

  const inbox: (InboxRequest & { full: ApprovalDetail | null })[] = [];
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
        full: null,
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
        full: null,
      });
    }
  }

  // Enrich each item with the full content + conversation thread for the
  // expandable view. Pending counts are small, so a query per request is fine.
  for (const item of inbox) {
    item.full = await getApprovalDetail(item.id);
  }

  return inbox;
}

// Requests the logged-in user submitted, newest first, any status. Powers the
// "My Requests" section on the coach dashboard where they can see feedback and
// reply to the back-and-forth.
export async function getMyRequests(perms: Permissions): Promise<ApprovalDetail[]> {
  if (!perms.coachId) return [];

  const requests = await prisma.approvalRequest.findMany({
    where: { requestedById: perms.coachId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const details: ApprovalDetail[] = [];
  for (const r of requests) {
    const detail = await getApprovalDetail(r.id);
    if (detail) details.push(detail);
  }
  return details;
}

// Badge count for the nav "Requests" item — how many pending requests matter
// to this user. Approvers see the requests they can act on (excluding their
// own); every coach also sees their own pending proposals, so nothing is
// silently stuck awaiting feedback.
export async function getRequestsBadge(perms: Permissions): Promise<number> {
  let count = 0;

  if (perms.coachId) {
    count += await prisma.approvalRequest.count({
      where: { requestedById: perms.coachId, status: "PENDING" },
    });
  }

  const canApprove = perms.isAdmin || (perms.canApproveRequests && !!perms.coachId);
  if (!canApprove) return count;

  const pending = await prisma.approvalRequest.findMany({
    where: { status: "PENDING" },
    include: { requestedBy: true },
  });

  for (const r of pending) {
    if (r.requestedById === perms.coachId) continue;
    if (r.type === "SESSION_SHARE") {
      count++;
      continue;
    }
    if (r.type === "ATTENDANCE_CONFIRM") {
      if (perms.isAdmin) {
        count++;
        continue;
      }
      const payload = r.payload as { scheduledSessionId?: string };
      const session = payload.scheduledSessionId
        ? await prisma.scheduledSession.findUnique({
            where: { id: payload.scheduledSessionId },
            include: { headCoaches: { select: { id: true } } },
          })
        : null;
      if (!session) continue;
      const requesterIsHead = r.requestedBy.designation === "HEAD";
      const isHeadOfSession = session.headCoaches.some((c) => c.id === perms.coachId);
      if (!requesterIsHead && isHeadOfSession) count++;
    }
  }

  return count;
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
