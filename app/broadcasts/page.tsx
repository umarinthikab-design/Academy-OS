import Link from "next/link";
import { getPermissions } from "@/lib/permissions";
import { getBroadcasts, getAlerts, getUnreadSplit, type InboxItem } from "@/lib/notifications";
import { getAcademyTimeZone } from "@/lib/academyTime";
import { markNotificationRead } from "./actions";
import { markAllBroadcastsRead, markAllAlertsRead, dismissAlert } from "./alertActions";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

function formatDate(d: Date, tz: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: tz });
}

const tabStyle = (active: boolean): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 16px",
  borderRadius: 999,
  fontSize: 14,
  fontWeight: 700,
  textDecoration: "none",
  border: "1px solid var(--border)",
  background: active ? "var(--primary)" : "var(--surface)",
  color: active ? "#fff" : "var(--text)",
});

const countPill = (active: boolean): React.CSSProperties => ({
  minWidth: 20,
  padding: "0 7px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  textAlign: "center",
  background: active ? "rgba(255,255,255,0.25)" : "var(--btn-primary-bg)",
  color: active ? "#fff" : "var(--btn-primary-text)",
});

function ItemCard({ item, kind, tz }: { item: InboxItem; kind: "broadcast" | "alert"; tz: string }) {
  const isUnread = item.readAt === null;
  const accent = kind === "alert" ? "#d97706" : "var(--text-brand)";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
        padding: "16px 20px",
        background: kind === "alert" && isUnread ? "var(--warning-bg)" : "var(--surface)",
        border: "1px solid var(--border)",
        borderLeft: isUnread ? "4px solid " + accent : "4px solid var(--border)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--surface-muted)", color: accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon name={kind === "alert" ? "alert" : "bell"} size={20} />
      </div>
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: isUnread ? 700 : 600, color: "var(--text-heading)" }}>{item.title}</h3>
        <p style={{ margin: "4px 0 0", fontSize: 14, lineHeight: 1.5, color: isUnread ? "var(--text)" : "var(--text-muted)" }}>{item.body}</p>
        <div style={{ marginTop: 6, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", fontSize: 13, color: "var(--text-muted)" }}>
          {kind === "broadcast" && item.senderName && <span>From {item.senderName}</span>}
          <span>{formatDate(item.createdAt, tz)}</span>
          {item.link && (
            <a className="text-link" href={item.link} style={{ color: "var(--text-brand)", fontWeight: 600, textDecoration: "underline" }}>
              View details
            </a>
          )}
        </div>
      </div>
      <div style={{ flexShrink: 0, display: "flex", justifyContent: "flex-end", marginLeft: "auto" }}>
        {isUnread ? (
          kind === "alert" ? (
            <form action={dismissAlert}>
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="back" value="alerts" />
              <Button type="submit" size="sm" variant="outline">Dismiss</Button>
            </form>
          ) : (
            <form action={markNotificationRead}>
              <input type="hidden" name="id" value={item.id} />
              <Button type="submit" size="sm" variant="outline">Mark read</Button>
            </form>
          )
        ) : (
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{kind === "alert" ? "Dismissed" : "Read"}</span>
        )}
      </div>
    </div>
  );
}

export default async function BroadcastsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const params = await searchParams;
  const tab: "broadcasts" | "alerts" = params.tab === "alerts" ? "alerts" : "broadcasts";
  const perms = await getPermissions();
  const userId = perms.userId ?? "";
  const tz = await getAcademyTimeZone();
  const [split, items] = await Promise.all([
    getUnreadSplit(userId),
    tab === "alerts" ? getAlerts(userId, 100) : getBroadcasts(userId, 100),
  ]);
  const canSend = perms.canSendNotifications;
  const unread = tab === "alerts" ? split.alerts : split.broadcasts;

  return (
    <div>
      <PageHeader
        title="Broadcasts"
        subtitle={
          tab === "alerts"
            ? unread > 0 ? `${unread} alert${unread === 1 ? "" : "s"} need your attention` : "No alerts need your attention"
            : unread > 0 ? `${unread} unread` : "You are all caught up"
        }
        actions={
          <>
            {unread > 0 && (
              <form action={tab === "alerts" ? markAllAlertsRead : markAllBroadcastsRead}>
                <Button type="submit" variant="outline">Mark all read</Button>
              </form>
            )}
            {canSend && <Button href="/broadcasts/new">Send a broadcast</Button>}
          </>
        }
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <Link href="/broadcasts" style={tabStyle(tab === "broadcasts")}>
          Broadcasts {split.broadcasts > 0 && <span style={countPill(tab === "broadcasts")}>{split.broadcasts}</span>}
        </Link>
        <Link href="/broadcasts?tab=alerts" style={tabStyle(tab === "alerts")}>
          Alerts {split.alerts > 0 && <span style={countPill(tab === "alerts")}>{split.alerts}</span>}
        </Link>
      </div>

      {items.length === 0 ? (
        tab === "alerts" ? (
          <EmptyState icon="bell" title="No alerts" message="Important notices, such as overdue coach responses and approvals, appear here." />
        ) : (
          <EmptyState icon="bell" title="No broadcasts yet" message="Announcements from your academy will appear here." />
        )
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((item) => (
            <ItemCard key={item.id} item={item} kind={tab === "alerts" ? "alert" : "broadcast"} tz={tz} />
          ))}
        </div>
      )}
    </div>
  );
}
