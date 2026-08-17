import { prisma } from "@/lib/prisma";
import { getPermissions } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

const PAGE_SIZE = 50;

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; entityType?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const perms = await getPermissions();

  if (perms.role === "PARENT") {
    return (
      <PageHeader title="Activity" subtitle="This page is for coaching staff." />
    );
  }

  const page = Math.max(1, Number(params.page) || 1);
  const entityType = params.entityType?.trim() || null;
  const from = params.from ? new Date(params.from) : null;
  const to = params.to ? new Date(params.to) : null;

  const where = {
    // Visibility: admins see every entry; coaches see their own plus anything
    // tied to entities they're connected to. For a grassroots club the coach's
    // own rows are the meaningful slice, so we start with those.
    ...(perms.isAdmin ? {} : { userId: perms.userId ?? "no-user" }),
    ...(entityType ? { entityType } : {}),
    ...(from ? { createdAt: { gte: from } } : {}),
    ...(to ? { createdAt: { lte: new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1) } } : {}),
  };

  const [logs, total, entityTypes] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      include: { user: { select: { name: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.activityLog.count({ where }),
    prisma.activityLog.findMany({
      where: perms.isAdmin ? {} : { userId: perms.userId ?? "no-user" },
      select: { entityType: true },
      distinct: ["entityType"],
      orderBy: { entityType: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const actionLabel = (action: string) =>
    action.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

  const fieldLabel: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--text)" };
  const inputBase: React.CSSProperties = { padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)", fontSize: 12, color: "var(--text)" };

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const next = { ...params, ...overrides };
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
    }
    const s = sp.toString();
    return s ? `/activity?${s}` : "/activity";
  };

  return (
    <>
      <PageHeader
        title="Activity"
        subtitle={perms.isAdmin ? "Everything, newest first." : "Your activity, newest first."}
      />

      {/* Filters - the real use case is "find who deleted this specific thing,"
          which is much faster with type + date filtering than by scrolling. */}
      <form method="GET" action="/activity" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 14 }}>
        <div>
          <label style={fieldLabel}>Entity type</label>
          <select name="entityType" defaultValue={entityType ?? ""} style={inputBase}>
            <option value="">All types</option>
            {entityTypes.map((e) => (
              <option key={e.entityType} value={e.entityType}>{e.entityType}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={fieldLabel}>From</label>
          <input name="from" type="date" defaultValue={params.from ?? ""} style={inputBase} />
        </div>
        <div>
          <label style={fieldLabel}>To</label>
          <input name="to" type="date" defaultValue={params.to ?? ""} style={inputBase} />
        </div>
        <button type="submit" style={{ padding: "7px 16px", border: "none", background: "var(--secondary)", color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
          Filter
        </button>
        {(entityType || from || to) && (
          <a href="/activity" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textDecoration: "none" }}>
            Clear
          </a>
        )}
      </form>

      {logs.length === 0 ? (
        <EmptyState
          icon="activity"
          title={total === 0 ? "No activity logged yet" : "No entries match the current filters"}
          message={total === 0 ? "Actions across the academy will show up here as they happen." : "Try removing a filter to see more results."}
        />
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
          {logs.map((l) => (
            <div
              key={l.id}
              className="activity-row"
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
              <div className="activity-row-main" style={{ minWidth: 0 }}>
                <strong>{actionLabel(l.action)}</strong>{" "}
                <span style={{ color: "var(--text-muted)" }}>
                  · {l.entityType}
                  {l.details ? ` · ${l.details}` : ""}
                </span>
              </div>
              <div className="activity-row-meta" style={{ textAlign: "right", fontSize: 11, color: "var(--text-faint)" }}>
                <div>{l.user.name}</div>
                <div>{l.createdAt.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Offset pagination - simple Prev/Next, sufficient for one academy's
          data volume. */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 16 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Page {page} of {totalPages} · {total} {total === 1 ? "entry" : "entries"}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {page > 1 && (
              <a href={buildHref({ page: String(page - 1) })} style={{ padding: "7px 14px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                ← Prev
              </a>
            )}
            {page < totalPages && (
              <a href={buildHref({ page: String(page + 1) })} style={{ padding: "7px 14px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                Next →
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export const dynamic = "force-dynamic";
