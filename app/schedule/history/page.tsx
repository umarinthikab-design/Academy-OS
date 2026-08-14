import { prisma } from "@/lib/prisma";
import { getPermissions } from "@/lib/permissions";

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
    <main style={{ maxWidth: 780, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 28, margin: "8px 0 4px" }}>Session History</h1>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>
        All sessions in the last 12 months ({sessions.length}).
      </p>

      <a
        href="/schedule/history/export"
        style={{ display: "inline-block", marginBottom: 20, padding: "8px 14px", background: "var(--pitch)", color: "#fff", borderRadius: 6, fontWeight: 700, fontSize: 13, textDecoration: "none", cursor: "pointer" }}
      >
        Export CSV
      </a>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sessions.map((s) => (
          <div
            key={s.id}
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
              <strong>{s.date.toLocaleDateString()}</strong> · {s.startTime}–{endTime(s.startTime, s.durationMinutes)} · {s.ageGroup.name} · {s.location.name}
              <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>
                Head: {s.headCoaches.map((c) => c.user.name).join(", ") || "—"}
                {s.assistantCoaches.length > 0 && <> · Assistant: {s.assistantCoaches.map((c) => c.user.name).join(", ")}</>}
                {s.session && <> · Plan: {s.session.name}</>}
                {s.status !== "scheduled" && <> · <strong>{s.status}</strong></>}
              </div>
            </div>
          </div>
        ))}
        {sessions.length === 0 && <p style={{ color: "#6B7280" }}>No sessions in the last 12 months.</p>}
      </div>
    </main>
  );
}