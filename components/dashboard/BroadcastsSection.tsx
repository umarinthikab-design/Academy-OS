import { getPermissions } from "@/lib/permissions";
import { getBroadcasts, getAlerts, getUnreadSplit } from "@/lib/notifications";
import { getAcademyTimeZone } from "@/lib/academyTime";
import BroadcastsCard from "./BroadcastsCard";
import AlertsCard from "./AlertsCard";

// Server component for every role's dashboard. Broadcasts: the latest five,
// read or unread. Alerts: automatic messages that still need attention.
export async function BroadcastsSection() {
  const perms = await getPermissions();
  const userId = perms.userId ?? "";
  if (!userId) return null;
  const tz = await getAcademyTimeZone();
  const fmt = (d: Date) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: tz });

  const [broadcasts, alerts, split] = await Promise.all([
    getBroadcasts(userId, 5),
    getAlerts(userId, 5, true),
    getUnreadSplit(userId),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <AlertsCard
        total={split.alerts}
        items={alerts.map((a) => ({ id: a.id, title: a.title, body: a.body, link: a.link, date: fmt(a.createdAt) }))}
      />
      <BroadcastsCard
        unreadCount={split.broadcasts}
        items={broadcasts.map((b) => ({ id: b.id, title: b.title, body: b.body, sender: b.senderName, date: fmt(b.createdAt), unread: b.readAt === null }))}
      />
    </div>
  );
}
