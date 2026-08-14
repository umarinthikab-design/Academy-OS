const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
async function main() {
  const demoUsers = await p.user.findMany({
    where: { OR: [{ email: { endsWith: "@demo.touchline.local" } }, { email: { endsWith: "@touchline.local" }, email: { startsWith: "demo." } }] },
    select: { id: true, email: true },
  });
  console.log("Purge target users:", demoUsers.map((u) => u.email));
  const userIds = demoUsers.map((u) => u.id);
  const coaches = await p.coach.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
  const coachIds = coaches.map((c) => c.id);
  console.log("Purge target coaches:", coachIds.length);

  if (coachIds.length) {
    await p.activityLog.deleteMany({ where: { userId: { in: userIds } } });
    await p.approvalRequest.deleteMany({ where: { OR: [{ requestedById: { in: coachIds } }, { resolvedById: { in: coachIds } }] } });
    await p.note.deleteMany({ where: { coachId: { in: coachIds } } });
    await p.drillFeedback.deleteMany({ where: { authorId: { in: coachIds } } });
    await p.session.deleteMany({ where: { createdById: { in: coachIds } } });
    await p.drill.deleteMany({ where: { createdById: { in: coachIds } } });
    await p.playerAttendance.deleteMany({ where: { scheduledSession: { OR: [{ headCoaches: { some: { id: { in: coachIds } } } }, { assistantCoaches: { some: { id: { in: coachIds } } } }] } } });
    await p.coachAttendance.deleteMany({ where: { scheduledSession: { OR: [{ headCoaches: { some: { id: { in: coachIds } } } }, { assistantCoaches: { some: { id: { in: coachIds } } } }] } } });
    await p.scheduledSession.deleteMany({ where: { OR: [{ headCoaches: { some: { id: { in: coachIds } } } }, { assistantCoaches: { some: { id: { in: coachIds } } } }] } });
  }

  const demoLocations = await p.location.findMany({ where: { name: { endsWith: " (Demo)" } }, select: { id: true } });
  await p.scheduledSession.deleteMany({ where: { locationId: { in: demoLocations.map((l) => l.id) } } });
  await p.location.deleteMany({ where: { id: { in: demoLocations.map((l) => l.id) } } });

  const demoBatches = await p.batch.findMany({ where: { name: { endsWith: " (Demo)" } }, select: { id: true } });
  const batchIds = demoBatches.map((b) => b.id);
  const demoPlayers = await p.player.findMany({ where: { batches: { some: { id: { in: batchIds } } } }, select: { id: true } });
  await p.player.deleteMany({ where: { id: { in: demoPlayers.map((x) => x.id) } } });
  await p.batch.deleteMany({ where: { id: { in: batchIds } } });

  if (userIds.length) {
    await p.user.deleteMany({ where: { id: { in: userIds } } });
  }

  console.log("Purge complete.");
  await p.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });