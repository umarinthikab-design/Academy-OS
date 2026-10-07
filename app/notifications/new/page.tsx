import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPermissions } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import NotificationBroadcastForm from "@/components/NotificationBroadcastForm";

export default async function NotificationsNewPage() {
  const permissions = await getPermissions();
  if (!permissions.isAdmin && !permissions.isClubManager) redirect("/");

  const ageGroups = await prisma.ageGroup.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="p-6 max-w-2xl">
      <PageHeader title="Send Broadcast Notification" subtitle="Admin & club manager only" />
      <NotificationBroadcastForm ageGroups={ageGroups} />
    </div>
  );
}