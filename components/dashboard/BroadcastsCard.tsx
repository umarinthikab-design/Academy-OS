
import Link from "next/link";

interface BroadcastItem {
  id: string;
  title: string;
  body: string;
  date: string;
  readAt: string | null;
}

interface BroadcastsCardProps {
  items: BroadcastItem[];
  unreadCount: number;
}

export default function BroadcastsCard({
  items,
  unreadCount,
}: BroadcastsCardProps) {
  return (
    <div style={{ marginTop: 24, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontFamily: "var(--font-headline)", fontSize: 20, fontWeight: 600, color: "var(--text-heading)" }}>Broadcasts</h3>
        <nav>
          <Link
            href="/broadcasts"
            style={{ fontSize: 13, fontWeight: 500, color: "var(--text-brand)", textDecoration: "none" }}
          >
            View all
          </Link>
        </nav>
      </div>
      {items.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No broadcasts yet.</p>
      ) : (
        <div style={{ marginTop: 12 }}>
          {items.slice(0, 3).map((item) => {
            const isUnread = item.readAt === null;
            const dot = isUnread && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  background: "var(--primary)",
                  marginRight: 8,
                }}
              />
            );
            return (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 8,
                  padding: "8px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                {dot}
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    background: "var(--surface)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    width={20}
                    height={20}
                    style={{ color: "var(--primary)" }}
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 4l-1.41 1.41M12 4l1.41 1.41M12 4h8v2h-8v-2zM4 12h4v2H4v-2zM12 12h4v2h-8v-2zM12 16h4v2h-4v-2z" />
                  </svg>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "var(--font-headline)",
                      fontSize: 12,
                      fontWeight: 600,
                      color: isUnread ? "var(--text-heading)" : "var(--text)",
                      marginBottom: 2,
                    }}
                  >
                    {item.title}
                  </div>
                  <p
                    style={{
                      fontSize: 8,
                      color: "var(--text-muted)",
                      margin: "0 0 2px",
                    }}
                  >
                    {item.body?.substring(0, 90) + (item.body.length > 90 ? "..." : "")}
                  </p>
                  <p style={{ fontSize: 7, color: "var(--text-muted)" }}>{item.date}</p>
                </div>
                <Link
                  href="/broadcasts"
                  style={{ fontSize: 8, color: "var(--text-brand)", textDecoration: "none" }}
                >
                  View
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}