import { prisma } from "@/lib/prisma";
import { getPermissions } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";

function endTime(time: string, durationMinutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + durationMinutes;
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
}

export default async function SessionHistoryPage() {
  const perms = await getPermissions();

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);

  const sessions = await prisma.scheduledSession.findMany({
    where: { date: { gte: cutoff } },
    include: {
      ageGroup: true,
      location: true,
      headCoaches: { include: { user: true } },
      assistantCoaches: { include: { user: true } },
      session: { select: { name: true } },
    },
    orderBy: [{ date: "desc" }, { startTime: "desc" }],
  });

  return (
    <>
      <PageHeader
        title="Session History"
        subtitle={`All sessions in the last 12 months (${sessions.length}).`}
        actions={
          <a
            href="/schedule/history/export"
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", background: "var(--primary)", color: "#fff", borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: "none" }}
          >
            <Icon name="export" size={15} /> Export CSV
          </a>
        }
      />

      {sessions.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No sessions in the last 12 months"
          message="Historical sessions will appear here once the season gets going."
        />
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
          {sessions.map((s) => (
            <div
              key={s.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                padding: "11px 16px",
                fontSize: 13,
                borderBottom: "1px solid var(--border)",
                flexWrap: "wrap",
              }}
            >
              <div>
                <strong>{s.date.toLocaleDateString()}</strong> · {s.startTime}–{endTime(s.startTime, s.durationMinutes)} · {s.ageGroup.name} · {s.location.name}
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  Head: {s.headCoaches.map((c) => c.user.name).join(", ") || "—"}
                  {s.assistantCoaches.length > 0 && <> · Assistant: {s.assistantCoaches.map((c) => c.user.name).join(", ")}</>}
                  {s.session && <> · Plan: {s.session.name}</>}
                </div>
              </div>
              {s.status !== "scheduled" && <Badge tone={s.status === "cancelled" ? "error" : "muted"}>{s.status}</Badge>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}