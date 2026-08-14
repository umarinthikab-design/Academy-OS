// Dashboard — role + permission + assignment-aware dispatcher.
//
// The flow is:
//   getSession → role → permissions → current DB assignments (lib/assignments.ts)
//   → role-specific dashboard component that queries the DB scoped to those
//   assignments.
//
// Nothing here hardcodes a coach's teams. Reassigning a coach in the DB
// automatically changes what their dashboard returns on the next render.

import { getSession } from "@/lib/getSession";
import { getPermissions } from "@/lib/permissions";
import { getDashboardScope } from "@/lib/assignments";
import { CoachDashboard } from "@/components/dashboard/CoachDashboard";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { ParentDashboard } from "@/components/dashboard/ParentDashboard";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  const perms = await getPermissions();
  const scope = await getDashboardScope();

  const team = params.team ?? null;
  const userName = session?.name ?? "";

  if (scope.role === "ADMIN") {
    return <AdminDashboard perms={perms} userName={userName} />;
  }

  if (scope.role === "HEAD_COACH" || scope.role === "ASSISTANT_COACH") {
    return <CoachDashboard scope={scope} perms={perms} userName={userName} team={team} />;
  }

  if (scope.role === "PARENT") {
    return <ParentDashboard scope={scope} userName={userName} />;
  }

  // Fallback (no role resolved) — should not normally be reachable since
  // middleware requires a valid session.
  return null;
}

export const dynamic = "force-dynamic";
