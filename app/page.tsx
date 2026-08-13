import { prisma } from "@/lib/prisma";

export default async function Home() {
  // This runs on the server and hits your real Postgres database via Prisma.
  // If this page loads without an error, your whole chain - Next.js, Prisma,
  // and the database - is wired correctly.
  const ageGroups = await prisma.ageGroup.findMany({
    orderBy: { sortOrder: "asc" },
  });
  const locations = await prisma.location.findMany();
  const coachCount = await prisma.coach.count();

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 28, margin: "0 0 20px" }}>Dashboard</h1>

      <div
        style={{
          background: "#fff",
          border: "2px solid var(--pitch)",
          borderRadius: 12,
          padding: 20,
        }}
      >
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Database connection check</h2>
        <p>
          Age groups seeded: <strong>{ageGroups.map((a) => a.name).join(", ") || "none yet"}</strong>
        </p>
        <p>
          Locations seeded: <strong>{locations.map((l) => l.name).join(", ") || "none yet"}</strong>
        </p>
        <p>
          Coaches in the roster: <strong>{coachCount}</strong>
        </p>
        <p style={{ color: "#6B7280", fontSize: 13 }}>
          If you're seeing real numbers above (not an error page), your database is connected
          and working.
        </p>
      </div>
    </main>
  );
}
