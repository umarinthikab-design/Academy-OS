import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { dismissAlert } from "@/app/broadcasts/alertActions";

interface AlertItem {
  id: string;
  title: string;
  body: string;
  link: string | null;
  date: string;
}

// "Needs your attention": automatic messages (overdue coach responses,
// approvals, session changes) kept apart from manual broadcasts. Renders
// nothing when there is nothing to act on.
export default function AlertsCard({ items, total }: { items: AlertItem[]; total: number }) {
  if (items.length === 0) return null;
  const hidden = Math.max(0, total - items.length);
  return (
    <section
      style={{
        background: "var(--warning-bg)",
        border: "1px solid #fde68a",
        borderLeft: "4px solid #d97706",
        borderRadius: "var(--radius)",
        padding: 18,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="alert" size={18} style={{ color: "#d97706" }} />
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--text-heading)" }}>Needs your attention</h2>
          <span style={{ background: "#d97706", color: "#fff", borderRadius: 999, padding: "2px 10px", fontSize: 13, fontWeight: 700 }}>{total}</span>
        </div>
        <Link className="text-link" href="/broadcasts?tab=alerts" style={{ fontSize: 14, fontWeight: 600, color: "var(--text-brand)", textDecoration: "none" }}>
          View all
        </Link>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {items.map((item, i) => (
          <div key={item.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", padding: "10px 0", borderTop: i === 0 ? "none" : "1px solid #fde68a" }}>
            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-heading)" }}>{item.title}</div>
              <p style={{ margin: "3px 0 0", fontSize: 14, lineHeight: 1.5, color: "var(--text)" }}>{item.body}</p>
              <div style={{ marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap", fontSize: 13, color: "var(--text-muted)" }}>
                <span>{item.date}</span>
                {item.link && (
                  <Link className="text-link" href={item.link} style={{ color: "var(--text-brand)", fontWeight: 600, textDecoration: "underline" }}>
                    Open
                  </Link>
                )}
              </div>
            </div>
            <form action={dismissAlert}>
              <input type="hidden" name="id" value={item.id} />
              <button
                type="submit"
                className="ui-btn"
                style={{ padding: "5px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                Dismiss
              </button>
            </form>
          </div>
        ))}
        {hidden > 0 && (
          <Link className="text-link" href="/broadcasts?tab=alerts" style={{ paddingTop: 10, fontSize: 14, fontWeight: 600, color: "var(--text-brand)", textDecoration: "none" }}>
            {"+ " + hidden + " more"}
          </Link>
        )}
      </div>
    </section>
  );
}
