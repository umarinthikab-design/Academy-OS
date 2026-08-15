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
import { StatusBanner } from "@/components/StatusBanner";
import { CoachDashboard } from "@/components/dashboard/CoachDashboard";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { ParentDashboard } from "@/components/dashboard/ParentDashboard";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  const perms = await getPermissions();
  const scope = await getDashboardScope();

  const team = params.team ?? null;
  const userName = session?.name ?? "";

  return (
    <>
      <StatusBanner error={params.error} success={params.success} />
      {scope.role === "ADMIN" ? (
        <AdminDashboard perms={perms} userName={userName} />
      ) : scope.role === "HEAD_COACH" || scope.role === "ASSISTANT_COACH" ? (
        <CoachDashboard scope={scope} perms={perms} userName={userName} team={team} />
      ) : scope.role === "PARENT" ? (
        <ParentDashboard scope={scope} userName={userName} />
      ) : null}
    </>
  );
}

export const dynamic = "force-dynamic";
