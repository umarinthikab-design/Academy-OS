// Requests — a single home for approval traffic. Approvers (admins + head
// coaches with canApproveRequests) act on pending proposals here; every coach
// also sees their own submissions with the feedback conversation. The sidebar
// badge highlights how many pending requests matter to the current user.
// Assistant coaches - who only ever submit requests, never approve them - see
// this page (and the nav label) as "Approvals".

import { getPermissions } from "@/lib/permissions";
import { getApprovalInbox } from "@/lib/approvals";
import { getMyRequests } from "@/lib/approvals";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBanner } from "@/components/StatusBanner";
import { ApprovalInbox } from "@/components/dashboard/ApprovalInbox";
import { MyRequests } from "@/components/dashboard/MyRequests";

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const perms = await getPermissions();

  return (
    <>
      <PageHeader
        title={perms.isAssistant ? "Approvals" : "Requests"}
        subtitle={
          perms.isAssistant
            ? "Track the status of your submissions and reply to feedback."
            : "Approve pending proposals and track your own submissions."
        }
      />
      <StatusBanner error={params.error} success={params.success} />

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {perms.isAdmin || perms.isClubManager || (perms.canApproveRequests && !!perms.coachId) ? (
          <ApprovalInbox perms={perms} />
        ) : null}
        <MyRequests perms={perms} />
      </div>
    </>
  );
}

export const dynamic = "force-dynamic";