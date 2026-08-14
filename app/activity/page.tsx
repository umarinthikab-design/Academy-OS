import { prisma } from "@/lib/prisma";
import { getPermissions } from "@/lib/permissions";

export default async function ActivityPage() {
  const perms = await getPermissions();

  if (perms.role === "PARENT") {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px" }}>
        <h1 style={{ fontSize: 28, margin: "8px 0 20px" }}>Activity</h1>
        <p style={{ color: "#6B7280", fontSize: 13 }}>This page is for coaching staff.</p>
      </main>
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
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 28, margin: "8px 0 4px" }}>Activity</h1>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>
        {perms.isAdmin ? "Everything, newest first." : "Your activity, newest first."}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {logs.map((l) => (
          <div
            key={l.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 12,
              padding: "8px 12px",
              background: "#fff",
              border: "1px solid #E5E7EB",
              borderRadius: 8,
              fontSize: 13,
            }}
          >
            <div>
              <strong>{actionLabel(l.action)}</strong>{" "}
              <span style={{ color: "#6B7280" }}>
                · {l.entityType}
                {l.details ? ` · ${l.details}` : ""}
              </span>
            </div>
            <div style={{ textAlign: "right", fontSize: 11, color: "#9CA3AF", whiteSpace: "nowrap" }}>
              <div>{l.user.name}</div>
              <div>{l.createdAt.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
            </div>
          </div>
        ))}
        {logs.length === 0 && <p style={{ color: "#6B7280" }}>No activity logged yet.</p>}
      </div>
    </main>
  );
}