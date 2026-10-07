import { prisma } from "@/lib/prisma";
import { getPermissions } from "@/lib/permissions";
import { broadcastNotification } from "@/lib/notifications";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { StatusBanner } from "@/components/StatusBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import NotificationBroadcastForm from "@/components/NotificationBroadcastForm";
import Link from "next/link";

export default async function NotificationsNewPage() {
  const permissions = await getPermissions();
  if (!permissions.isAdmin && !permissions.isClubManager) {
    return <p style={{ color: "var(--error)" }}>You don't have permission to send broadcasts.</p>;
  }

  return (
    <div className="p-6 max-w-2xl">
      <PageHeader title="Send Broadcast Notification" subtitle="Admin & club manager only" />

      <StatusBanner />

      <NotificationBroadcastForm
        onSuccess={() => {
          // Success handled by form component
        }}
        onError={(error) => {
          // Error handled by form component
        }}
      />
    </div>
  );
}