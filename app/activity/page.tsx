import { prisma } from "@/lib/prisma";
import { getPermissions } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

const PAGE_SIZE = 50;

// Friendly display labels for entityType values (raw values come from
// logActivity call sites in lib/logActivity.ts). Anything not listed here
// falls back to its raw value.
const ENTITY_LABELS: Record<string, string> = {
  AcademySettings: "Academy Settings",
  Drill: "Drill",
  Player: "Player",
  Coach: "Coach",
  ScheduledSession: "Session",
  Batch: "Batch",
  Location: "Location",
  AgeGroup: "Age Group",
  ApprovalRequest: "Approval",
  User: "User",
  Session: "Session Plan",
  SessionCoachConfirmation: "Confirmation",
};

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
    // Visibility: admins + club managers see every entry; coaches see their
    // own plus anything tied to entities they're connected to. For a
    // grassroots club the coach's own rows are the meaningful slice, so we
    // start with those.
    ...(perms.isAdmin || perms.isClubManager ? {} : { userId: perms.userId ?? "no-user" }),
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
      where: perms.isAdmin || perms.isClubManager ? {} : { userId: perms.userId ?? "no-user" },
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

  const labelCaps: React.CSSProperties = {
    fontFamily: "var(--font-mono-label)",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
  };

  return (
    <>
      <PageHeader
        title="Activity"
        subtitle="System-wide activity log, reverse-chronological order."
      />

      {/* Filters - the real use case is "find who deleted this specific thing,"
          which is much faster with type + date filtering than by scrolling. */}
      <form method="GET" action="/activity" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-sm)", padding: 14 }}>
        <div>
          <label style={fieldLabel}>Entity type</label>
          <select name="entityType" defaultValue={entityType ?? ""} style={inputBase}>
            <option value="">All types</option>
            {entityTypes.map((e) => (
              <option key={e.entityType} value={e.entityType}>{ENTITY_LABELS[e.entityType] ?? e.entityType}</option>
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
        <button type="submit" style={{ padding: "7px 16px", border: "none", background: "var(--secondary)", color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, boxShadow: "var(--shadow-sm)" }}>
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
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(150px, 200px) minmax(160px, 1fr) auto",
              gap: 12,
              alignItems: "center",
              padding: "10px 16px",
              background: "var(--surface-muted)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span style={labelCaps}>Actor</span>
            <span style={labelCaps}>Action</span>
            <span style={{ ...labelCaps, textAlign: "right" }}>Entity</span>
          </div>
          {logs.map((l) => (
            <div
              key={l.id}
              className="activity-row"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(150px, 200px) minmax(160px, 1fr) auto",
                gap: 12,
                alignItems: "center",
                padding: "12px 16px",
                fontSize: 13,
                borderBottom: "1px solid var(--border)",
                transition: "background var(--transition)",
              }}
            >
              <div className="activity-row-meta" style={{ display: "flex", flexDirection: "column", gap: 1, fontSize: 11 }}>
                <span style={{ fontWeight: 700, color: "var(--primary)" }}>{l.user.name}</span>
                <span style={{ color: "var(--text-muted)" }}>
                  {l.createdAt.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  <span style={{ color: "var(--text-faint)" }}>{" · "}{l.createdAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
                </span>
              </div>
              <div className="activity-row-main" style={{ minWidth: 0, display: "flex", alignItems: "baseline", gap: 6 }}>
                <strong style={{ fontWeight: 600 }}>{actionLabel(l.action)}</strong>
                {l.details && <span style={{ color: "var(--text-muted)" }}>{l.details}</span>}
              </div>
              <div style={{ textAlign: "right", color: "var(--text-muted)" }}>
                {ENTITY_LABELS[l.entityType] ?? l.entityType}
              </div>
            </div>
          ))}
          <div style={{ background: "var(--surface-muted)", borderTop: "1px solid var(--border)", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, color: "var(--text-muted)" }}>
            <span>Showing {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} of {total} {total === 1 ? "log" : "logs"}</span>
            <div style={{ display: "flex", gap: 4 }}>
              {page > 1 && (
                <a href={buildHref({ page: String(page - 1) })} aria-label="Previous page" style={{ width: 32, height: 32, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", textDecoration: "none", transition: "background var(--transition)" }}>
                  ←
                </a>
              )}
              {page < totalPages && (
                <a href={buildHref({ page: String(page + 1) })} aria-label="Next page" style={{ width: 32, height: 32, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", textDecoration: "none", transition: "background var(--transition)" }}>
                  →
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export const dynamic = "force-dynamic";
