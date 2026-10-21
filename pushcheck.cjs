const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
(async () => {
  let host = "unknown";
  try { host = new URL(process.env.DATABASE_URL || "").host; } catch {}
  console.log("Database host: " + host + "\n");
  const users = await prisma.user.findMany({
    where: { archivedAt: null, role: { in: ["ADMIN", "CLUB_MANAGER", "HEAD_COACH", "ASSISTANT_COACH"] } },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
  const subs = await prisma.pushSubscription.findMany({ select: { userId: true } });
  const counts = new Map();
  for (const s of subs) counts.set(s.userId, (counts.get(s.userId) || 0) + 1);
  const rows = users.map((u) => ({ Name: u.name, Role: u.role, Email: u.email, Devices: counts.get(u.id) || 0 }));
  console.table(rows);
  const missing = rows.filter((r) => r.Devices === 0);
  console.log("Staff with push enabled: " + (rows.length - missing.length) + " of " + rows.length);
  if (missing.length) console.log("No push yet: " + missing.map((m) => m.Name).join(", "));
})().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
