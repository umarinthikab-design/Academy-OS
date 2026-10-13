import { prisma } from "@/lib/prisma";
import type { Permissions } from "@/lib/permissions";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";

// Shown only when at least one registration is pending review. Renders nothing
// at zero, so it costs no space on the dashboard the rest of the time.
export async function RegistrationsInbox({ perms }: { perms: Permissions }) {
  if (!(perms.isAdmin || perms.isClubManager)) return null;

  const [count, latest] = await Promise.all([
    prisma.pendingRegistration.count({ where: { status: "PENDING" } }),
    prisma.pendingRegistration.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, playerName: true },
    }),
  ]);
  if (count === 0) return null;

  const names = latest.map((r) => r.playerName || "Unmapped submission");
  const more = count - names.length;
  const summary = names.join(", ") + (more > 0 ? " and " + more + " more" : "");

  return (
    <section
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,

        flexWrap: "wrap",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderLeft: "4px solid var(--warning)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-sm)",
        padding: "16px 20px",
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
        <Icon name="squad" size={20} />
      </div>
      <div style={{ flex: "1 1 240px", minWidth: 0 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-heading)" }}>
          {count === 1 ? "1 new registration awaiting review" : count + " new registrations awaiting review"}
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--text-muted)" }}>{summary}</p>
      </div>
      <Button href="/registrations">Review</Button>
    </section>

  );
}
