import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

interface BroadcastItem {
  id: string;
  title: string;
  body: string;
  sender: string | null;
  date: string;
  unread: boolean;
}

const iconTile: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  background: "var(--surface-muted)",
  color: "var(--text-brand)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

export default function BroadcastsCard({ items, unreadCount }: { items: BroadcastItem[]; unreadCount: number }) {
  return (
    <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20, boxShadow: "var(--shadow-sm)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--text-heading)" }}>Broadcasts</h2>
          {unreadCount > 0 && (
            <span style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", borderRadius: 999, padding: "2px 10px", fontSize: 13, fontWeight: 700 }}>
              {unreadCount} unread
            </span>
          )}
        </div>
        <Link className="text-link" href="/broadcasts" style={{ fontSize: 14, fontWeight: 600, color: "var(--text-brand)", textDecoration: "none" }}>
          View all
        </Link>
      </div>

      {items.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={iconTile}><Icon name="bell" size={18} /></div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-heading)" }}>No broadcasts yet</div>
            <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Announcements from your academy will appear here.</div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {items.map((item, i) => (
            <Link
              className="ui-hover"
              key={item.id}
              href="/broadcasts"
              style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0", borderTop: i === 0 ? "none" : "1px solid var(--border)", textDecoration: "none", color: "inherit" }}
            >
              <div style={iconTile}><Icon name="bell" size={18} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {item.unread && (
                    <span role="img" aria-label="Unread" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--text-brand)", flexShrink: 0 }} />
                  )}
                  <span style={{ fontSize: 15, fontWeight: item.unread ? 700 : 600, color: "var(--text-heading)" }}>{item.title}</span>
                </div>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: item.unread ? "var(--text)" : "var(--text-muted)",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {item.body}
                </p>
                <div style={{ marginTop: 4, fontSize: 13, color: "var(--text-muted)" }}>
                  {item.sender ? "From " + item.sender + " · " : ""}{item.date}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
