// QuickActions - role & permission aware shortcuts. Rendered from the
// dashboard for the logged-in role; only actions the user can actually
// perform are shown.

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { Permissions } from "@/lib/permissions";

type Action = {
  href: string;
  label: string;
  icon: string;
  desc: string;
};

export function QuickActions({
  perms,
  hasTeams,
}: {
  perms: Permissions;
  hasTeams: boolean;
}) {
  const actions: Action[] = [];

  if (perms.isAdmin) {
    actions.push(
      { href: "/squad", label: "Add Player", icon: "plus", desc: "Grow the squad" },
      { href: "/coaches", label: "Add Coach", icon: "plus", desc: "Build the roster" },
      { href: "/schedule", label: "Create Session", icon: "plus", desc: "Plan training" },
      { href: "/batches", label: "Manage Batches", icon: "batches", desc: "Group players" },
      { href: "/locations", label: "Locations", icon: "locations", desc: "Venues" },
      { href: "/age-groups", label: "Age Groups", icon: "target", desc: "Age bands" }
    );
  } else if (perms.isHeadCoach || perms.isAssistant) {
    if (hasTeams) {
      actions.push(
        { href: "/attendance", label: "Take Attendance", icon: "attendance", desc: "Mark who showed up" },
        { href: "/squad", label: "View Squad", icon: "squad", desc: "My players" },
        { href: "/sessions", label: "Session Plans", icon: "sessions", desc: "Build training" },
        { href: "/schedule", label: "View Schedule", icon: "calendar", desc: "Upcoming training" }
      );
    }
    if (perms.canEditSchedule) {
      actions.push({ href: "/schedule", label: "Create Session", icon: "plus", desc: "Plan training" });
    }
  } else if (perms.role === "PARENT") {
    actions.push(
      { href: "/schedule", label: "Schedule", icon: "calendar", desc: "My child's training" },
      { href: "/attendance", label: "Attendance", icon: "attendance", desc: "My child's sessions" }
    );
  }

  if (actions.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 12px" }}>Quick actions</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12 }}>
        {actions.map((a) => (
          <Link
            key={a.label}
            href={a.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 16px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              boxShadow: "var(--shadow-sm)",
              textDecoration: "none",
              color: "var(--text)",
              transition: "box-shadow var(--transition), transform var(--transition)",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "var(--success-bg)",
                color: "var(--secondary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon name={a.icon} size={18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{a.label}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{a.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
