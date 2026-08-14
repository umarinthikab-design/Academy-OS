import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/getSession";

export const dynamic = "force-dynamic";

function endTime(time: string, durationMinutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + durationMinutes;
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
}

function csvCell(value: string | number | Date): string {
  const raw = value instanceof Date ? value.toLocaleDateString() : String(value);
  // Escape commas, quotes, and newlines per RFC 4180.
  return `"${raw.replace(/"/g, '""')}"`;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);

  const rows = await prisma.scheduledSession.findMany({
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

  const header = ["Date", "Time", "End", "Age group", "Location", "Head coach(es)", "Assistant coach(es)", "Status", "Session plan"];
  const lines = rows.map((s) =>
    [
      csvCell(s.date),
      csvCell(s.startTime),
      csvCell(endTime(s.startTime, s.durationMinutes)),
      csvCell(s.ageGroup.name),
      csvCell(s.location.name),
      csvCell(s.headCoaches.map((c) => c.user.name).join(", ")),
      csvCell(s.assistantCoaches.map((c) => c.user.name).join(", ")),
      csvCell(s.status),
      csvCell(s.session?.name ?? ""),
    ].join(",")
  );

  const csv = [header.join(","), ...lines].join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="touchline-session-history.csv"',
    },
  });
}