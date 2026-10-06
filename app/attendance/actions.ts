"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPermissions } from "@/lib/permissions";
import { logActivity } from "@/lib/logActivity";
import { notifyApprovers } from "@/lib/notifyApprovers";
import { notifyUser } from "@/lib/notifications";
import {
  CoachAttendanceStatus,
  PlayerAttendanceStatus,
} from "@prisma/client";

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

function sessionEnd(session: { date: Date; startTime: string; durationMinutes: number }): Date {
  return new Date(sessionStart(session).getTime() + session.durationMinutes * 60 * 1000);
}

// ── Post-session attendance marking ──────────────────────────────────

// Assistant coaches (and head coaches marking themselves) propose player
// statuses. The proposal becomes an ApprovalRequest instead of writing
// PlayerAttendance directly. Admins skip the chain and write straight to
// PlayerAttendance (admin is the top of the approval chain).
export async function submitAttendance(formData: FormData) {
  const perms = await getPermissions();
  if (!perms.role || perms.role === "PARENT") redirect("/attendance?error=no_permission");

  const scheduledSessionId = formData.get("scheduledSessionId") as string;
  const playerIds = formData.getAll("playerId") as string[];
  const statuses = formData.getAll("status") as string[];
  if (!scheduledSessionId || playerIds.length === 0) redirect("/attendance?error=missing_fields");

  const session = await prisma.scheduledSession.findUnique({
    where: { id: scheduledSessionId },
    include: { headCoaches: true, assistantCoaches: true, ageGroup: true },
  });
  if (!session) redirect("/attendance");
  if (session.resolvedAt) redirect("/attendance?error=already_resolved");

  const pairs = playerIds
    .map((playerId, i) => ({ playerId, status: statuses[i] }))
    .filter((p) => p.status === "ATTENDED" || p.status === "ABSENT");

  if (perms.isAdmin) {
    for (const { playerId, status } of pairs) {
      await prisma.playerAttendance.upsert({
        where: { playerId_scheduledSessionId: { playerId, scheduledSessionId } },
        update: { status: status as PlayerAttendanceStatus, confirmedAt: new Date() },
        create: {
          playerId,
          scheduledSessionId,
          status: status as PlayerAttendanceStatus,
          deadline: sessionDeadline(session),
          confirmedAt: new Date(),
        },
      });
    }
    revalidatePath("/attendance");
    if (perms.userId) await logActivity(perms.userId, "recorded_attendance", "ScheduledSession", scheduledSessionId, `${pairs.length} players`);
    redirect("/attendance?success=Attendance recorded.");
  }

  const isHead = session.headCoaches.some((c) => c.id === perms.coachId);
  const isAssistant = session.assistantCoaches.some((c) => c.id === perms.coachId);
  if (!isHead && !isAssistant) redirect("/attendance?error=no_permission");

  const payload = {
    scheduledSessionId,
    statuses: pairs.map((p) => ({ playerId: p.playerId, status: p.status })),
  };

  // A PENDING proposal from this coach for this session can be updated in
  // place (correcting a mistake). A REJECTED one is cleared so the coach can
  // resubmit fresh.
  const sessionFilter = { path: ["scheduledSessionId"], equals: scheduledSessionId } as const;

  const existing = await prisma.approvalRequest.findFirst({
    where: {
      requestedById: perms.coachId!,
      type: "ATTENDANCE_CONFIRM",
      status: "PENDING",
      payload: sessionFilter,
    },
  });

  if (existing) {
    await prisma.approvalRequest.update({
      where: { id: existing.id },
      data: { payload },
    });
    revalidatePath("/attendance");
    redirect("/attendance?success=Attendance proposal updated.");
  }

  await prisma.approvalRequest.deleteMany({
    where: {
      requestedById: perms.coachId!,
      type: "ATTENDANCE_CONFIRM",
      status: "REJECTED",
      payload: sessionFilter,
    },
  });

  await prisma.approvalRequest.create({
    data: {
      type: "ATTENDANCE_CONFIRM",
      payload,
      requestedById: perms.coachId!,
    },
  });

  try {
    await notifyApprovers(
      { type: "ATTENDANCE_CONFIRM", requestedByCoachId: perms.coachId!, scheduledSessionId },
      "Attendance needs your approval",
      `${pairs.length} player${pairs.length === 1 ? "" : "s"} proposed for ${session.ageGroup.name}.`,
      "/requests"
    );
  } catch {
    // Notification delivery is best-effort - never break the actual proposal.
  }

  if (perms.userId) await logActivity(perms.userId, "proposed_attendance", "ScheduledSession", scheduledSessionId, `${pairs.length} players`);
  revalidatePath("/attendance");
  redirect("/attendance?success=Attendance proposal submitted for approval.");
}

export async function approveAttendanceRequest(requestId: string) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canApproveRequests)) redirect("/attendance?error=no_permission");

  const request = await prisma.approvalRequest.findUnique({
    where: { id: requestId },
    include: { requestedBy: true },
  });
  if (!request || request.type !== "ATTENDANCE_CONFIRM" || request.status !== "PENDING") {
    redirect("/attendance");
  }

  const payload = request.payload as { scheduledSessionId: string; statuses: { playerId: string; status: string }[] };
  const session = await prisma.scheduledSession.findUnique({
    where: { id: payload.scheduledSessionId },
    include: { headCoaches: true },
  });
  if (!session) redirect("/attendance");

  // The chain direction matters: an assistant's proposal is approved by a
  // head coach of that session; a head coach's own proposal goes one level
  // up to admin. Admins can approve anything.
  const requesterIsHead = request.requestedBy.designation === "HEAD";
  const isHeadOfSession = session.headCoaches.some((c) => c.id === perms.coachId);
  if (perms.isAdmin) {
    // admins approve everything
  } else if (requesterIsHead) {
    redirect("/attendance?error=no_permission"); // only admin outranks a head coach
  } else if (!isHeadOfSession || !perms.canApproveRequests) {
    redirect("/attendance?error=no_permission");
  }

  const deadline = sessionDeadline(session);
  for (const { playerId, status } of payload.statuses) {
    await prisma.playerAttendance.upsert({
      where: { playerId_scheduledSessionId: { playerId, scheduledSessionId: session.id } },
      update: { status: status as PlayerAttendanceStatus, confirmedAt: new Date() },
      create: {
        playerId,
        scheduledSessionId: session.id,
        status: status as PlayerAttendanceStatus,
        deadline,
        confirmedAt: new Date(),
      },
    });
  }

  await prisma.approvalRequest.update({
    where: { id: requestId },
    data: { status: "APPROVED", resolvedById: perms.coachId, resolvedAt: new Date() },
  });

  if (perms.userId) await logActivity(perms.userId, "approved_request", "ApprovalRequest", requestId, "attendance");
  await notifyUser({
      userId: request.requestedBy.userId,
      title: "Attendance proposal approved",
      body: "Your attendance proposal was approved.",
      link: "/requests",
      category: "ATTENDANCE",
    });
  revalidatePath("/attendance");
  redirect("/attendance?success=Attendance approved.");
}

export async function rejectAttendanceRequest(requestId: string) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canApproveRequests)) redirect("/attendance?error=no_permission");

  const request = await prisma.approvalRequest.findUnique({
    where: { id: requestId },
    include: { requestedBy: true },
  });
  if (!request || request.type !== "ATTENDANCE_CONFIRM" || request.status !== "PENDING") {
    redirect("/attendance");
  }

  // Same chain-direction rules as approve: heads' own proposals are only
  // reversible by admin; assistants' proposals by their session's head coach.
  const payload = request.payload as { scheduledSessionId?: string };
  const session = payload.scheduledSessionId
    ? await prisma.scheduledSession.findUnique({
        where: { id: payload.scheduledSessionId },
        include: { headCoaches: true },
      })
    : null;

  const requesterIsHead = request.requestedBy.designation === "HEAD";
  const isHeadOfSession = session ? session.headCoaches.some((c) => c.id === perms.coachId) : false;
  if (perms.isAdmin) {
    // admins can reject anything
  } else if (requesterIsHead) {
    redirect("/attendance?error=no_permission");
  } else if (!isHeadOfSession || !perms.canApproveRequests) {
    redirect("/attendance?error=no_permission");
  }

  await prisma.approvalRequest.update({
    where: { id: requestId },
    data: { status: "REJECTED", resolvedById: perms.coachId, resolvedAt: new Date() },
  });

  if (perms.userId) await logActivity(perms.userId, "rejected_request", "ApprovalRequest", requestId, "attendance");
  await notifyUser({
      userId: request.requestedBy.userId,
      title: "Attendance proposal rejected",
      body: "Your attendance proposal was rejected - you can resubmit.",
      link: "/requests",
      category: "ATTENDANCE",
    });
  revalidatePath("/attendance");
  redirect(`/attendance?success=${encodeURIComponent("Attendance proposal rejected — the assistant can resubmit.")}`);
}

// A head coach (or admin) confirms a session's attendance is done, dropping
// it out of the "needs review" list. Explicit rather than automatic so a
// session isn't accidentally finalized while a proposal is still in flight.
export async function finalizeAttendance(scheduledSessionId: string) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canApproveRequests)) redirect("/attendance?error=no_permission");

  const session = await prisma.scheduledSession.findUnique({
    where: { id: scheduledSessionId },
    include: { headCoaches: true },
  });
  if (!session) redirect("/attendance");

  const isHeadOfSession = session.headCoaches.some((c) => c.id === perms.coachId);
  if (!perms.isAdmin && !isHeadOfSession) redirect("/attendance?error=no_permission");

  await prisma.scheduledSession.update({
    where: { id: scheduledSessionId },
    data: { resolvedAt: new Date() },
  });

  if (perms.userId) await logActivity(perms.userId, "finalized_attendance", "ScheduledSession", scheduledSessionId);
  revalidatePath("/attendance");
  redirect("/attendance?success=Attendance finalized for this session.");
}

// ── Coach self check-in ──────────────────────────────────────────────

export async function checkInCoach(scheduledSessionId: string) {
  const perms = await getPermissions();
  if (!perms.coachId) redirect("/attendance?error=no_permission");

  const session = await prisma.scheduledSession.findUnique({
    where: { id: scheduledSessionId },
    include: { headCoaches: true, assistantCoaches: true },
  });
  if (!session) redirect("/attendance");

  const assigned = [...session.headCoaches, ...session.assistantCoaches].some((c) => c.id === perms.coachId);
  if (!assigned) redirect("/attendance?error=no_permission");
  if (new Date() < sessionStart(session)) redirect("/attendance?error=not_started");

  await prisma.coachAttendance.upsert({
    where: { coachId_scheduledSessionId: { coachId: perms.coachId!, scheduledSessionId } },
    update: { status: "CHECKED_IN", method: "self", confirmedAt: new Date() },
    create: {
      coachId: perms.coachId!,
      scheduledSessionId,
      status: "CHECKED_IN",
      method: "self",
      confirmedAt: new Date(),
    },
  });

  if (perms.userId) await logActivity(perms.userId, "coach_checked_in", "ScheduledSession", scheduledSessionId);
  revalidatePath("/attendance");
  redirect("/attendance?success=Checked in.");
}

export async function overrideCoachAttendance(scheduledSessionId: string, coachId: string, formData: FormData) {
  const perms = await getPermissions();
  if (!perms.isAdmin && !perms.isClubManager) redirect("/attendance?error=no_permission");

  const status = formData.get("status") as string;
  if (!["CHECKED_IN", "ABSENT", "NOT_YET"].includes(status)) redirect("/attendance?error=missing_fields");

  await prisma.coachAttendance.upsert({
    where: { coachId_scheduledSessionId: { coachId, scheduledSessionId } },
    update: { status: status as CoachAttendanceStatus, method: "admin_override", confirmedAt: new Date() },
    create: {
      coachId,
      scheduledSessionId,
      status: status as CoachAttendanceStatus,
      method: "admin_override",
      confirmedAt: new Date(),
    },
  });

  if (perms.userId) await logActivity(perms.userId, "overrode_coach_attendance", "ScheduledSession", scheduledSessionId, coachId);
  revalidatePath("/attendance");
  redirect("/attendance?success=Coach attendance updated.");
}

export { sessionEnd };