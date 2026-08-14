import { prisma } from "@/lib/prisma";
import { getPermissions } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function ActivityPage() {
  const perms = await getPermissions();

  if (perms.role === "PARENT") {
    return (
      <PageHeader title="Activity" subtitle="This page is for coaching staff." />
    );
  }

  // Visibility: admins see every entry; coaches see their own plus anything
  // tied to entities they're connected to (sessions they're assigned to,
  // players, batches, drills they authored). For a grassroots club the
  // coach's own rows are the meaningful slice, so we start with those.
  const logs = await prisma.activityLog.findMany({
    where: perms.isAdmin ? {} : { userId: perms.userId ?? "no-user" },
    include: { user: { select: { name: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const actionLabel = (action: string) =>
    action.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

  return (
    <>
      <PageHeader
        title="Activity"
        subtitle={perms.isAdmin ? "Everything, newest first." : "Your activity, newest first."}
      />

      {logs.length === 0 ? (
        <EmptyState
          icon="activity"
          title="No activity logged yet"
          message="Actions across the academy will show up here as they happen."
        />
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
          {logs.map((l) => (
            <div
              key={l.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 12,
                padding: "11px 16px",
                fontSize: 13,
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <strong>{actionLabel(l.action)}</strong>{" "}
                <span style={{ color: "var(--text-muted)" }}>
                  · {l.entityType}
                  {l.details ? ` · ${l.details}` : ""}
                </span>
              </div>
              <div style={{ textAlign: "right", fontSize: 11, color: "var(--text-faint)", whiteSpace: "nowrap" }}>
                <div>{l.user.name}</div>
                <div>{l.createdAt.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}