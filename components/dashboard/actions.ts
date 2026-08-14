// Dashboard approve/reject actions. These delegate to the shared approval
// logic in lib/approvals.ts (same chain-direction authorization as the
// attendance/sessions pages) but stay on the dashboard instead of
// redirecting to a per-page route.

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPermissions } from "@/lib/permissions";
import { applyDecision } from "@/lib/approvals";

export async function approveRequest(requestId: string) {
  const perms = await getPermissions();
  const result = await applyDecision(requestId, perms, true);
  if (!result.ok) redirect("/?error=no_permission");

  revalidatePath("/");
  revalidatePath("/attendance");
  revalidatePath("/sessions");
  redirect("/?success=Request approved.");
}

export async function rejectRequest(requestId: string) {
  const perms = await getPermissions();
  const result = await applyDecision(requestId, perms, false);
  if (!result.ok) redirect("/?error=no_permission");

  revalidatePath("/");
  revalidatePath("/attendance");
  revalidatePath("/sessions");
  redirect("/?success=Request rejected.");
}
