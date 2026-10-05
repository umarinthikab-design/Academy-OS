import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/getSession";
import { getUnreadCount, getInbox, markAllRead, markRead } from "@/lib/notifications";
import { getPermissions } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export default async function NotificationsPage() {
  const perms = await getPermissions();
  const userId = perms.userId ?? "";
  const unread = await getUnreadCount(userId);
  const items = await getInbox(userId);

  function categoryIcon(cat: string) {
    const map: Record<string, string> = {
      GENERAL: "bell",
      APPROVAL: "flag",
      ATTENDANCE: "attendance",
      DRILL: "drills",
      SESSION: "sessions",
      ANNOUNCEMENT: "alert",
    };
    return map[cat] ?? "bell";
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : "No new notifications"}
      />

      {items.length === 0 ? (
        <EmptyState
          icon="bell"
          title="No notifications"
          message={unread === 0 ? "All caught up!" : "No unread notifications"}>
        </EmptyState>
      ) : (
        <div style={{ marginTop: 24 }}>
          {items.map((item) => {
            const isRead = item.readAt !== null;
            const icon = categoryIcon(item.category);
            return (
              <div
                key={item.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: 16,
                  marginBottom: 12,
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Icon name={icon} size={18} style={{ color: "var(--primary)" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--primary)", margin: 0 }}>
                        {item.title}
                      </h3>
                      {item.readAt === null && (
                        <span style={{ fontSize: 10, color: "var(--secondary)", marginLeft: 4 }}>
                          unread
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text)", margin: "4px 0 0" }}>
                      {item.body}
                    </p>
                  </div>
                  {item.readAt === null && (
                    <button
                      onClick={() => markRead(userId, item.id)}
                      style={{
                        marginLeft: 8,
                        padding: "6px 10px",
                        background: "var(--primary)",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      Mark read
                    </button>
                  )}
                </div>
                {item.link && (
                  <a
                    href={item.link}
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: "var(--secondary)",
                      textDecoration: "underline",
                    }}
                  >
                    View details
                  </a>
                )}
              </div>
            );
          })}
          <button
            onClick={() => markAllRead(userId)}
            style={{
              marginTop: 24,
              marginLeft: -16,
              padding: "8px 16px",
              background: "var(--primary)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Mark all read
          </button>
        </div>
      )}
    </div>
  );
}