import { getAcademyTimeZone } from "@/lib/academyTime";
import { Button } from "@/components/ui/Button";
import { prisma } from "@/lib/prisma";
import { getPermissions } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { buildActivityWhere } from "@/lib/activityFilters";

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
  ActivityLog: "Activity log",
};

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; entityType?: string; userId?: string; action?: string; from?: string; to?: string }>;
}) {
  const academyTz = await getAcademyTimeZone();
  const params = await searchParams;
  const perms = await getPermissions();

  if (perms.role === "PARENT") {
    return (
      <PageHeader title="Activity" subtitle="This page is for coaching staff." />
    );
  }

  const canSeeAll = perms.isAdmin || perms.isClubManager;
  const page = Math.max(1, Number(params.page) || 1);
  const entityType = params.entityType?.trim() || null;
  const actionFilter = params.action?.trim() || null;
  const userFilter = canSeeAll ? params.userId?.trim() || null : null;
  const fromRaw = params.from?.trim() || null;
  const toRaw = params.to?.trim() || null;

  // Visibility: admins + club managers see every entry (optionally narrowed to
  // one person); coaches only ever see their own rows.
  const where = buildActivityWhere(
    perms,
    {
      entityType: entityType ?? undefined,
      action: actionFilter ?? undefined,
      userId: userFilter ?? undefined,
      from: fromRaw ?? undefined,
      to: toRaw ?? undefined,
    },
    academyTz
  );
  const scope = canSeeAll ? {} : { userId: perms.userId ?? "no-user" };

  const [logs, total, entityTypes, actions, people] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      include: { user: { select: { name: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.activityLog.count({ where }),
    prisma.activityLog.findMany({
      where: scope,
      select: { entityType: true },
      distinct: ["entityType"],
      orderBy: { entityType: "asc" },
    }),
    prisma.activityLog.findMany({
      where: scope,
      select: { action: true },
      distinct: ["action"],
      orderBy: { action: "asc" },
    }),
    canSeeAll
      ? prisma.user.findMany({ where: { activityLogs: { some: {} } }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([] as { id: string; name: string }[]),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const actionLabel = (action: string) =>
    action.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

  const fieldLabel: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4, color: "var(--text)" };
  const inputBase: React.CSSProperties = { padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)", fontSize: 13, color: "var(--text)" };

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const next = { ...params, ...overrides };
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
    }
    const s = sp.toString();
    return s ? `/activity?${s}` : "/activity";
  };

  const exportParams = new URLSearchParams();
  for (const [k, v] of Object.entries({ entityType, action: actionFilter, userId: userFilter, from: fromRaw, to: toRaw })) {
    if (v) exportParams.set(k, v);
  }
  const exportHref = exportParams.toString() ? `/activity/export?${exportParams.toString()}` : "/activity/export";

  const labelCaps: React.CSSProperties = {
    fontFamily: "var(--font-mono-label)",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
  };

  const anyFilter = !!(entityType || actionFilter || userFilter || fromRaw || toRaw);

  return (
    <>
      <PageHeader
        title="Activity"
        subtitle={canSeeAll ? "Audit log: who did what, and when. Filter it, then download the result as a spreadsheet." : "Your recent activity, newest first."}
      />

      {/* Filters - the real use case is "find who deleted this specific thing,"
          which is much faster with person + type + date filtering than by scrolling. */}
      <form method="GET" action="/activity" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-sm)", padding: 14 }}>
        {canSeeAll && (
          <div>
            <label style={fieldLabel}>Person</label>
            <select name="userId" defaultValue={userFilter ?? ""} style={inputBase}>
              <option value="">Everyone</option>
              {people.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label style={fieldLabel}>Action</label>
          <select name="action" defaultValue={actionFilter ?? ""} style={inputBase}>
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a.action} value={a.action}>{actionLabel(a.action)}</option>
            ))}
          </select>
        </div>
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
          <input name="from" type="date" defaultValue={fromRaw ?? ""} style={inputBase} />
        </div>
        <div>
          <label style={fieldLabel}>To</label>
          <input name="to" type="date" defaultValue={toRaw ?? ""} style={inputBase} />
        </div>
        <Button variant="secondary" size="sm">Filter</Button>
        {anyFilter && (
          <a className="text-link" href="/activity" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textDecoration: "none" }}>
            Clear
          </a>
        )}
        {canSeeAll && (
          <a
            href={exportHref}
            style={{ marginLeft: "auto", padding: "6px 12px", borderRadius: 8, border: "1px solid var(--secondary)", background: "var(--surface)", color: "var(--secondary)", fontWeight: 700, fontSize: 13, textDecoration: "none" }}
          >
            Download CSV
          </a>
        )}
      </form>

      {logs.length === 0 ? (
        <EmptyState
          icon="activity"
          title={total === 0 && !anyFilter ? "No activity logged yet" : "No entries match the current filters"}
          message={total === 0 && !anyFilter ? "Actions across the academy will show up here as they happen." : "Try removing a filter to see more results."}
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
              <div className="activity-row-meta" style={{ display: "flex", flexDirection: "column", gap: 1, fontSize: 13 }}>
                <span style={{ fontWeight: 700, color: "var(--text-heading)" }}>{l.user.name}</span>
                <span style={{ color: "var(--text-muted)" }}>
                  {l.createdAt.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: academyTz })}
                  <span style={{ color: "var(--text-faint)" }}>{" \u00b7 "}{l.createdAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", timeZone: academyTz })}</span>
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
                <a className="ui-btn" href={buildHref({ page: String(page - 1) })} aria-label="Previous page" style={{ width: 32, height: 32, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", textDecoration: "none", transition: "background var(--transition)" }}>
                  {"\u2190"}
                </a>
              )}
              {page < totalPages && (
                <a className="ui-btn" href={buildHref({ page: String(page + 1) })} aria-label="Next page" style={{ width: 32, height: 32, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", textDecoration: "none", transition: "background var(--transition)" }}>
                  {"\u2192"}
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