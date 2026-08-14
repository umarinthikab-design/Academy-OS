"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPermissions } from "@/lib/permissions";
import { logActivity } from "@/lib/logActivity";

// A Session is a reusable drill PLAN (name + an ordered list of drills) -
// distinct from ScheduledSession, the calendar slot. All coaches can create
// them; they start private to the author and can be shared to the team via
// an approval request (SESSION_SHARE).

export async function createSession(formData: FormData) {
  const perms = await getPermissions();
  if (!perms.canSuggestDrills || !perms.coachId) redirect("/sessions?error=no_permission");

  const name = formData.get("name") as string;
  const drillIds = formData.getAll("drillIds") as string[];
  if (!name || drillIds.length === 0) redirect("/sessions?error=missing_fields");

  await prisma.session.create({
    data: {
      name,
      createdById: perms.coachId,
      isPrivate: true,
      drills: {
        create: drillIds.map((drillId, i) => ({ drillId, order: i })),
      },
    },
  });

  if (perms.userId) await logActivity(perms.userId, "created_session_plan", "Session", undefined, name);
  revalidatePath("/sessions");
  redirect(`/sessions?success=${encodeURIComponent(`${name} created.`)}`);
}

export async function deleteSession(id: string) {
  const perms = await getPermissions();
  if (!perms.coachId) redirect("/sessions?error=no_permission");

  const session = await prisma.session.findUnique({ where: { id } });
  if (!session || session.createdById !== perms.coachId) redirect("/sessions?error=no_permission");

  // SessionDrill rows cascade on delete.
  await prisma.session.delete({ where: { id } });
  if (perms.userId) await logActivity(perms.userId, "deleted_session_plan", "Session", id);
  revalidatePath("/sessions");
  redirect("/sessions?success=Session plan removed.");
}

// Owner requests that the plan become visible to the team. Creates a
// SESSION_SHARE ApprovalRequest; a head coach/admin must approve before the
// plan leaves "private".
export async function shareSession(id: string) {
  const perms = await getPermissions();
  if (!perms.canSuggestDrills || !perms.coachId) redirect("/sessions?error=no_permission");

  const session = await prisma.session.findUnique({ where: { id } });
  if (!session || session.createdById !== perms.coachId) redirect("/sessions?error=no_permission");

  // Not shareable if it's already shared/approved or has a share request in
  // flight.
  if (session.isPrivate === false || session.shareStatus === "APPROVED" || session.shareStatus === "PENDING") {
    redirect("/sessions?error=already_shared");
  }

  await prisma.session.update({ where: { id }, data: { shareStatus: "PENDING" } });
  await prisma.approvalRequest.create({
    data: {
      type: "SESSION_SHARE",
      payload: { sessionId: id },
      requestedById: perms.coachId,
    },
  });

  if (perms.userId) await logActivity(perms.userId, "requested_session_share", "Session", id);
  revalidatePath("/sessions");
  redirect("/sessions?success=Share request sent for approval.");
}

export async function approveSessionShare(requestId: string) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canApproveRequests)) redirect("/sessions?error=no_permission");

  const request = await prisma.approvalRequest.findUnique({ where: { id: requestId } });
  if (!request || request.type !== "SESSION_SHARE" || request.status !== "PENDING") redirect("/sessions");

  const payload = request.payload as { sessionId?: string };
  if (!payload.sessionId) redirect("/sessions");

  await prisma.session.update({
    where: { id: payload.sessionId },
    data: { isPrivate: false, shareStatus: "APPROVED" },
  });
  await prisma.approvalRequest.update({
    where: { id: requestId },
    data: { status: "APPROVED", resolvedById: perms.coachId, resolvedAt: new Date() },
  });

  if (perms.userId) await logActivity(perms.userId, "approved_request", "ApprovalRequest", requestId, "session_share");
  revalidatePath("/sessions");
  redirect("/sessions?success=Session plan shared with the team.");
}

export async function rejectSessionShare(requestId: string) {
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.canApproveRequests)) redirect("/sessions?error=no_permission");

  const request = await prisma.approvalRequest.findUnique({ where: { id: requestId } });
  if (!request || request.type !== "SESSION_SHARE" || request.status !== "PENDING") redirect("/sessions");

  const payload = request.payload as { sessionId?: string };
  if (!payload.sessionId) redirect("/sessions");

  await prisma.session.update({
    where: { id: payload.sessionId },
    data: { shareStatus: "REJECTED" },
  });
  await prisma.approvalRequest.update({
    where: { id: requestId },
    data: { status: "REJECTED", resolvedById: perms.coachId, resolvedAt: new Date() },
  });

  if (perms.userId) await logActivity(perms.userId, "rejected_request", "ApprovalRequest", requestId, "session_share");
  revalidatePath("/sessions");
  redirect("/sessions?success=Share request rejected - the plan stays private.");
}

// Simple up/down reordering of the drills within a plan. Only the owner can
// reorder. SessionDrill.order values are swapped between neighbors.
export async function reorderSessionDrill(sessionId: string, drillId: string, direction: "up" | "down") {
  const perms = await getPermissions();
  if (!perms.coachId) redirect("/sessions?error=no_permission");

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session || session.createdById !== perms.coachId) redirect("/sessions?error=no_permission");

  const current = await prisma.sessionDrill.findFirst({
    where: { sessionId, drillId },
  });
  if (!current) redirect("/sessions");

  const neighbor = await prisma.sessionDrill.findFirst({
    where:
      direction === "up"
        ? { sessionId, order: { lt: current.order } }
        : { sessionId, order: { gt: current.order } },
    orderBy: direction === "up" ? { order: "desc" } : { order: "asc" },
  });
  if (!neighbor) redirect("/sessions");

  const currentOrder = current.order;
  await prisma.sessionDrill.update({ where: { id: current.id }, data: { order: neighbor.order } });
  await prisma.sessionDrill.update({ where: { id: neighbor.id }, data: { order: currentOrder } });

  revalidatePath("/sessions");
}