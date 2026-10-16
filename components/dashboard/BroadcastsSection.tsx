import { getAcademyTimeZone } from "@/lib/academyTime";
import BroadcastsCard from "./BroadcastsCard";
import { getPermissions } from "@/lib/permissions";
import { getInbox, getUnreadCount } from "@/lib/notifications";

function formatDate(d: Date, tz: string) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: tz,
  });
}

// Server component: reads the logged-in user's own inbox. Only UNREAD items are
// shown, so marking a broadcast read removes it from this user's dashboard
// without affecting anyone else (read state is stored per recipient).
export async function BroadcastsSection() {
  const perms = await getPermissions();
  const academyTz = await getAcademyTimeZone();
  const userId = perms.userId ?? "";
  if (!userId) return null;


  const [rawItems, unreadCount] = await Promise.all([getInbox(userId, 50), getUnreadCount(userId)]);

  const items = rawItems
    .filter((item) => item.readAt === null)
    .slice(0, 3)
    .map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      date: formatDate(item.createdAt, academyTz),
      readAt: null,
    }));

  return <BroadcastsCard items={items} unreadCount={unreadCount} />;
}
