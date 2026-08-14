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
  const isApprover = perms.isAdmin || (perms.canApproveRequests && !!perms.coachId);
  if (!isRequester && !isApprover) redirect("/?error=no_permission");

  await prisma.approvalMessage.create({
    data: { approvalRequestId: requestId, authorId: perms.userId, message: message.trim() },
  });

  if (perms.userId) await logActivity(perms.userId, "added_approval_feedback", "ApprovalRequest", requestId);
  revalidatePath("/");
  revalidatePath("/requests");
  redirect("/requests?success=Feedback sent.");
}
