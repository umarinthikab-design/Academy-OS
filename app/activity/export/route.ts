import { prisma } from "@/lib/prisma";
import { getPermissions } from "@/lib/permissions";
import { getAcademyTimeZone } from "@/lib/academyTime";
import { buildActivityWhere } from "@/lib/activityFilters";
import { logActivity } from "@/lib/logActivity";

export const dynamic = "force-dynamic";

const MAX_ROWS = 20000;

// RFC 4180 quoting, plus protection against spreadsheet formula injection
// (a cell starting with = + - @ would otherwise run as a formula in Excel).
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const perms = await getPermissions();
  if (!perms.isAdmin && !perms.isClubManager) return new Response("Forbidden", { status: 403 });

  const tz = await getAcademyTimeZone();
  const url = new URL(request.url);
  const q = (key: string) => url.searchParams.get(key)?.trim() || undefined;
  const where = buildActivityWhere(
    perms,
    { entityType: q("entityType"), action: q("action"), userId: q("userId"), from: q("from"), to: q("to") },
    tz
  );

  const rows = await prisma.activityLog.findMany({
    where,
    include: { user: { select: { name: true, email: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
  });

  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const header = ["When (" + tz + ")", "Person", "Email", "Role", "Action", "Entity type", "Entity ID", "Details"];
  const lines = rows.map((l) =>
    [fmt.format(l.createdAt), l.user.name, l.user.email, l.user.role, l.action, l.entityType, l.entityId ?? "", l.details ?? ""]
      .map(cell)
      .join(",")
  );
  const csv = "\uFEFF" + [header.map(cell).join(","), ...lines].join("\r\n");

  if (perms.userId) await logActivity(perms.userId, "exported_activity_log", "ActivityLog", undefined, rows.length + " rows");

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="touchline-activity-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}