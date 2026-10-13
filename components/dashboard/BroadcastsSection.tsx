import BroadcastsCard from "./BroadcastsCard";
import { getPermissions } from "@/lib/permissions";
import { getSession } from "@/lib/getSession";
import { getInbox, getUnreadCount } from "@/lib/notifications";

interface MappedInboxItem {
  id: string;
  title: string;
  body: string;
  date: string;
  readAt: string | null;
}

export async function BroadcastsSection() {
  const perms = await getPermissions();
  const session = await getSession();
  const userId = perms.userId ?? session?.userId ?? "";

  if (!userId) {
    return null;
  }

  const rawItems = await getInbox(userId, 3);
  const items: MappedInboxItem[] = rawItems.map((item) => ({
    id: item.id,
    title: item.title,
    body: item.body,
    date: item.createdAt.toDateString(),
    readAt: item.readAt ? item.readAt.toISOString().split("T")[0] : null,
  }));

  const unreadCount = await getUnreadCount(userId);

  return <BroadcastsCard items={items} unreadCount={unreadCount} />;
}