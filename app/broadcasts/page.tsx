import { getUnreadCount, getInbox } from "@/lib/notifications";
import { getPermissions } from "@/lib/permissions";
import { markNotificationRead, markAllNotificationsRead } from "./actions";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

const CATEGORY_ICONS: Record<string, string> = {
  GENERAL: "bell",
  APPROVAL: "flag",
  ATTENDANCE: "attendance",
  DRILL: "drills",
  SESSION: "sessions",
  ANNOUNCEMENT: "alert",
};

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function BroadcastsPage() {
  const perms = await getPermissions();
  const userId = perms.userId ?? "";
  const [unread, items] = await Promise.all([getUnreadCount(userId), getInbox(userId)]);
  const canSend = perms.canSendNotifications;


  return (
    <div>
      <PageHeader
        title="Broadcasts"
        subtitle={unread > 0 ? `${unread} unread` : "You are all caught up"}
        actions={
          <>
            {unread > 0 && (
              <form action={markAllNotificationsRead}>
                <Button type="submit" variant="outline">
                  Mark all read
                </Button>
              </form>
            )}
            {canSend && <Button href="/broadcasts/new">Send a broadcast</Button>}
          </>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon="bell"
          title="No broadcasts yet"
          message="Announcements from your academy will appear here."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((item) => {
            const isUnread = item.readAt === null;
            return (
              <div

                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  flexWrap: "wrap",
                  padding: "16px 20px",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderLeft: isUnread ? "4px solid var(--text-brand)" : "4px solid var(--border)",
                  borderRadius: "var(--radius)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "var(--surface-muted)",
                    color: "var(--text-brand)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon name={CATEGORY_ICONS[item.category] ?? "bell"} size={20} />
                </div>

                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

                    {isUnread && (
                      <span
                        role="img"
                        aria-label="Unread"
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "var(--text-brand)",
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <h3
                      style={{
                        margin: 0,
                        fontSize: 15,
                        fontWeight: isUnread ? 700 : 600,
                        color: "var(--text-heading)",
                      }}
                    >
                      {item.title}
                    </h3>
                  </div>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: 14,
                      lineHeight: 1.5,
                      color: isUnread ? "var(--text)" : "var(--text-muted)",
                    }}
                  >

                    {item.body}
                  </p>
                  <div style={{ marginTop: 6, display: "flex", gap: 12, alignItems: "center", fontSize: 13, color: "var(--text-muted)" }}>
                    <span>{formatDate(item.createdAt)}</span>
                    {item.link && (
                      <a className="text-link" href={item.link} style={{ color: "var(--text-brand)", fontWeight: 600, textDecoration: "underline" }}>
                        View details
                      </a>
                    )}
                  </div>
                </div>

                <div style={{ width: 110, flexShrink: 0, display: "flex", justifyContent: "flex-end", marginLeft: "auto" }}>
                  {isUnread ? (
                    <form action={markNotificationRead}>
                      <input type="hidden" name="id" value={item.id} />
                      <Button type="submit" size="sm" variant="outline">
                        Mark read
                      </Button>
                    </form>
                  ) : (
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Read</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

