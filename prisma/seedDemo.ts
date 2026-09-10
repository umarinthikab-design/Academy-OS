import { PrismaClient, Designation, PlayerAttendanceStatus, CoachAttendanceStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { calculateAge, getSkillBandForAge, SKILL_BAND_META, type SkillBand } from "../lib/skills";

// Demo data generator. Run with `npm run seed:demo`. Safe to re-run: it first
// deletes everything it created previously (identified by the @demo.touchline.local
// email suffix, the "(Demo)" batch/location names, and drill/session ownership).

const prisma = new PrismaClient();

const DEMO_PASSWORD = "touchline123"; // same as the normal seed, so any demo account logs in easily

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};
const daysAhead = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};
const at = (d: Date, h: number, m = 0) => {
  const c = new Date(d);
  c.setHours(h, m, 0, 0);
  return c;
};

async function clean() {
  const demoUsers = await prisma.user.findMany({ where: { email: { endsWith: "@demo.touchline.local" } }, select: { id: true } });
  const demoUserIds = demoUsers.map((u) => u.id);
  const demoCoaches = demoUsers.length
    ? await prisma.coach.findMany({ where: { userId: { in: demoUserIds } }, select: { id: true } })
    : [];
  const demoCoachIds = demoCoaches.map((c) => c.id);

  if (demoCoachIds.length) {
    await prisma.activityLog.deleteMany({ where: { userId: { in: demoUserIds } } });
    await prisma.approvalRequest.deleteMany({ where: { OR: [{ requestedById: { in: demoCoachIds } }, { resolvedById: { in: demoCoachIds } }] } });
    await prisma.note.deleteMany({ where: { coachId: { in: demoCoachIds } } });
    await prisma.drillFeedback.deleteMany({ where: { authorId: { in: demoCoachIds } } });

    // Delete scheduled sessions created by demo coaches first: they may
    // reference a demo session plan (sessionId, RESTRICT) and demo locations.
    const demoSessions = await prisma.session.findMany({ where: { createdById: { in: demoCoachIds } }, select: { id: true } });
    const demoSessionIds = demoSessions.map((s) => s.id);
    if (demoSessionIds.length) {
      await prisma.scheduledSession.deleteMany({ where: { sessionId: { in: demoSessionIds } } });
    }
    // Sessions cascade their SessionDrill rows (sessionId onDelete: Cascade),
    // so sessions MUST go before drills - SessionDrill.drillId is RESTRICT.
    await prisma.session.deleteMany({ where: { id: { in: demoSessionIds } } });
    await prisma.drill.deleteMany({ where: { createdById: { in: demoCoachIds } } });
  }

  const demoLocations = await prisma.location.findMany({ where: { name: { endsWith: " (Demo)" } }, select: { id: true } });
  const demoLocationIds = demoLocations.map((l) => l.id);

  const demoBatches = await prisma.batch.findMany({ where: { name: { endsWith: " (Demo)" } }, select: { id: true } });
  const demoBatchIds = demoBatches.map((b) => b.id);

  if (demoBatchIds.length) {
    const demoPlayers = await prisma.player.findMany({ where: { batches: { some: { id: { in: demoBatchIds } } } }, select: { id: true } });
    const demoPlayerIds = demoPlayers.map((p) => p.id);
    if (demoPlayerIds.length) {
      await prisma.player.deleteMany({ where: { id: { in: demoPlayerIds } } });
    }
    await prisma.batch.deleteMany({ where: { id: { in: demoBatchIds } } });
  }

  if (demoLocationIds.length) {
    await prisma.scheduledSession.deleteMany({ where: { locationId: { in: demoLocationIds } } });
    await prisma.location.deleteMany({ where: { id: { in: demoLocationIds } } });
  }

  if (demoUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: demoUserIds } } });
  }
}

async function main() {
  console.log("Cleaning up any previous demo data...");
  await clean();

  const ageGroups = await prisma.ageGroup.findMany({ orderBy: { sortOrder: "asc" } });
  const byName = Object.fromEntries(ageGroups.map((ag) => [ag.name, ag.id]));
  const locId = (await prisma.location.findUnique({ where: { name: "CR7, Colombo 03" } }))?.id;

  const skillDefs = await prisma.skillDefinition.findMany({ orderBy: { sortOrder: "asc" } });
  const skillBands: SkillBand[] = SKILL_BAND_META.map((meta) => ({
    ...meta,
    skills: skillDefs.filter((d) => d.band === meta.label).map((d) => d.name),
  }));

  console.log("Creating demo users...");
  const hashed = await bcrypt.hash(DEMO_PASSWORD, 10);

  const mkUser = async (email: string, name: string, role: "HEAD_COACH" | "ASSISTANT_COACH", extra: Record<string, unknown> = {}) => {
    return await prisma.user.create({
      data: {
        email,
        password: hashed,
        name,
        role,
        coach: { create: { designation: role === "HEAD_COACH" ? Designation.HEAD : Designation.ASSISTANT, ...extra } },
      },
    });
  };

  const headCoach = await mkUser("demo.head@demo.touchline.local", "Fernando Perera", "HEAD_COACH", {
    canApproveRequests: true,
    canEditSchedule: true,
    canEditDrills: true,
    canEditRoster: true,
    primaryFocus: { connect: [{ id: byName["U10"] }, { id: byName["U12"] }] },
  });
  const secondHead = await mkUser("demo.head2@demo.touchline.local", "Saman Silva", "HEAD_COACH", {
    canApproveRequests: true,
    primaryFocus: { connect: [{ id: byName["U14"] }] },
  });
  const assistant = await mkUser("demo.assist@demo.touchline.local", "Nadeesha Fernando", "ASSISTANT_COACH", {
    primaryFocus: { connect: [{ id: byName["U10"] }] },
  });

  const headCoachId = (await prisma.coach.findUnique({ where: { userId: headCoach.id } }))!.id;
  const secondHeadId = (await prisma.coach.findUnique({ where: { userId: secondHead.id } }))!.id;
  const assistantId = (await prisma.coach.findUnique({ where: { userId: assistant.id } }))!.id;

  console.log("Creating demo locations...");
  const mainGround = await prisma.location.create({ data: { name: "CR7 Academy Turf (Demo)" } });
  const trainingGround = await prisma.location.create({ data: { name: "Sugathadasa Mini Pitch (Demo)" } });

  console.log("Creating demo batches...");
  const mkBatch = async (name: string, ageGroupName: string, coachIds: string[]) => {
    return await prisma.batch.create({
      data: { name: `${name} (Demo)`, ageGroupId: byName[ageGroupName], mainCoaches: { connect: coachIds.map((id) => ({ id })) } },
    });
  };
  const batchU6 = await mkBatch("U6 Foundation", "U6", [headCoachId]);
  const batchU8 = await mkBatch("U8 Little League", "U8", [assistantId]);
  const batchU10A = await mkBatch("U10 Academy A", "U10", [headCoachId, assistantId]);
  const batchU10B = await mkBatch("U10 Academy B", "U10", [secondHeadId]);
  const batchU12 = await mkBatch("U12 Elite", "U12", [headCoachId]);
  const batchU14 = await mkBatch("U14 Development", "U14", [secondHeadId]);

  console.log("Creating demo players...");
  const mkPlayer = async (name: string, dob: Date, batchId: string, opts: { joinedDaysAgo?: number; emergency?: [string, string]; medical?: string; position?: string; skills?: [string, number][] } = {}) => {
    // Skills default to the player's age band, matching the createPlayer
    // action so the demo roster behaves like a real one.
    const skills = opts.skills ?? getSkillBandForAge(skillBands, calculateAge(dob)).skills.map((skillName) => [skillName, 2] as [string, number]);
    return await prisma.player.create({
      data: {
        name,
        dateOfBirth: dob,
        dateJoined: daysAgo(opts.joinedDaysAgo ?? 120),
        position: opts.position ?? "Unassigned (Default)",
        emergencyContactName: opts.emergency?.[0],
        emergencyContactPhone: opts.emergency?.[1],
        medicalNotes: opts.medical,
        batches: { connect: [{ id: batchId }] },
        skills: { create: skills.map(([skillName, value]) => ({ skillName, value })) },
        skillHistory: {
          create: skills.map(([skillName, value]) => ({
            skillName,
            value: Math.max(1, value - 1),
            recordedAt: daysAgo(90),
          })),
        },
      },
    });
  };

  const pU6a = await mkPlayer("Kevin Wickramasinghe", new Date("2020-03-14"), batchU6.id);
  const pU6b = await mkPlayer("Adam De Silva", new Date("2020-07-02"), batchU6.id);
  const pU8a = await mkPlayer("Tharindu Perera", new Date("2018-02-20"), batchU8.id);
  const pU8b = await mkPlayer("Mohamed Fahad", new Date("2018-09-11"), batchU8.id, { emergency: ["Fahad's Mother", "077-555-1122"] });
  const pU10a = await mkPlayer("Amila Jayasinghe", new Date("2016-01-05"), batchU10A.id, {
    joinedDaysAgo: 210,
    emergency: ["Amila's Father", "071-555-8844"],
    medical: "Asthma — inhaler in kit bag.",
    position: "Midfielder",
    skills: [["Dribbling & 1v1", 5], ["First Touch", 4], ["Short Passing", 4], ["Shooting", 3], ["Coachability", 4]],
  });
  const pU10b = await mkPlayer("Ruwan Abeysekara", new Date("2016-06-18"), batchU10A.id, { position: "Defender", skills: [["Dribbling & 1v1", 3], ["First Touch", 4], ["Short Passing", 3], ["Shooting", 4], ["Coachability", 3]] });
  const pU10c = await mkPlayer("Shanaka Ranatunga", new Date("2016-11-30"), batchU10B.id, { position: "Forward", skills: [["Dribbling & 1v1", 3], ["First Touch", 2], ["Short Passing", 3], ["Shooting", 4], ["Coachability", 2]] });
  const pU10d = await mkPlayer("Dilshan Wijesuriya", new Date("2017-04-22"), batchU10B.id);
  const pU12a = await mkPlayer("Lasith Kumarasiri", new Date("2014-03-08"), batchU12.id, {
    joinedDaysAgo: 400,
    emergency: ["Lasith's Mother", "070-555-9910"],
    position: "Goalkeeper",
    skills: [["First Touch", 4], ["Passing Range", 5], ["Decision Making", 4], ["Tactical Awareness", 5], ["Physical Stamina", 4], ["Defending", 4], ["Shooting", 3]],
  });
  const pU12b = await mkPlayer("Chamika Silva", new Date("2014-08-15"), batchU12.id, { position: "Midfielder", skills: [["First Touch", 5], ["Passing Range", 4], ["Decision Making", 4], ["Tactical Awareness", 3], ["Physical Stamina", 4], ["Defending", 3], ["Shooting", 4]] });
  const pU12c = await mkPlayer("Nuwan Bandara", new Date("2015-01-27"), batchU12.id, { medical: "Allergic to penicillin.", skills: [["First Touch", 3], ["Passing Range", 3], ["Decision Making", 3], ["Tactical Awareness", 4], ["Physical Stamina", 4], ["Defending", 3], ["Shooting", 3]] });
  const pU14a = await mkPlayer("Ishan Gunaratne", new Date("2012-05-12"), batchU14.id, { joinedDaysAgo: 600, emergency: ["Ishan's Father", "076-555-4421"], position: "Forward", skills: [["First Touch", 5], ["Passing Range", 4], ["Decision Making", 4], ["Tactical Awareness", 4], ["Physical Stamina", 4], ["Defending", 3], ["Shooting", 5]] });
  const pU14b = await mkPlayer("Kavindu Herath", new Date("2012-10-03"), batchU14.id, { position: "Defender", skills: [["First Touch", 3], ["Passing Range", 4], ["Decision Making", 3], ["Tactical Awareness", 3], ["Physical Stamina", 5], ["Defending", 4], ["Shooting", 3]] });

  const players = [pU6a, pU6b, pU8a, pU8b, pU10a, pU10b, pU10c, pU10d, pU12a, pU12b, pU12c, pU14a, pU14b];

  console.log("Creating demo drills...");
  const drillCategories = await prisma.drillCategory.findMany();
  const drillCategoryIdByName = Object.fromEntries(drillCategories.map((c) => [c.name, c.id]));
  const mkDrill = (name: string, categoryName: string, duration: number, ageNames: string[], createdById: string, extra: { status?: "APPROVED" | "PENDING"; playerRange?: string; description?: string } = {}) => {
    return prisma.drill.create({
      data: {
        name,
        categoryId: drillCategoryIdByName[categoryName],
        duration,
        playerRange: extra.playerRange,
        description: extra.description,
        status: extra.status ?? "APPROVED",
        createdById,
        ageGroups: { connect: ageNames.map((n) => ({ id: byName[n] })) },
      },
    });
  };

  const d1 = await mkDrill("Cone Dribble Gates", "Dribbling", 10, ["U8", "U10", "U12"], headCoachId, { description: "Weave through cones, keep the ball close." });
  const d2 = await mkDrill("Two-Touch Passing Square", "Passing", 12, ["U10", "U12", "U14"], headCoachId, { playerRange: "6-12" });
  const d3 = await mkDrill("Shooting Rondo", "Shooting", 15, ["U12", "U14"], headCoachId, { playerRange: "8-16" });
  const d4 = await mkDrill("Defending 1v1 Box", "Defending", 10, ["U10", "U12"], secondHeadId, { playerRange: "4-8" });
  const d5 = await mkDrill("Ladder Agility Race", "Warm-up", 8, ["U8", "U10", "U12", "U14"], assistantId);
  const d6 = await mkDrill("Sharks & Minnows", "Fun Game", 10, ["U6", "U8"], assistantId, { status: "PENDING", description: "Tag game to teach dribbling under pressure." });
  const d7 = await mkDrill("Pig in the Middle", "Passing", 8, ["U6", "U8", "U10"], headCoachId, { status: "PENDING", description: "Keep-away in a small triangle." });

  if (d6) {
    await prisma.drillFeedback.create({ data: { drillId: d6.id, authorId: headCoachId, message: "Good for the little ones — maybe make the square bigger." } });
  }

  console.log("Creating demo session plans...");
  const mkPlan = async (name: string, createdById: string, drillIds: string[], extra: { isPrivate?: boolean; shareStatus?: "APPROVED" | "PENDING" | "REJECTED" } = {}) => {
    return await prisma.session.create({
      data: {
        name,
        createdById,
        isPrivate: extra.isPrivate ?? true,
        shareStatus: extra.shareStatus ?? null,
        drills: { create: drillIds.map((drillId, order) => ({ drillId, order })) },
      },
    });
  };

  const planWarmup = await mkPlan("Pre-Match Warmup", headCoachId, [d1.id, d5.id], { isPrivate: false, shareStatus: "APPROVED" });
  const planPressing = await mkPlan("Pressing Patterns", headCoachId, [d2.id, d4.id]);
  const planFinishing = await mkPlan("Finishing Session", secondHeadId, [d3.id, d2.id], { isPrivate: false, shareStatus: "APPROVED" });
  const planRondo = await mkPlan("Possession Rondo", assistantId, [d2.id, d1.id], { shareStatus: "PENDING" });

  console.log("Creating demo scheduled sessions + attendance...");
  const mkScheduled = async (data: {
    date: Date;
    startTime: string;
    durationMinutes?: number;
    ageGroupName: string;
    batchId?: string;
    locationId: string;
    headIds?: string[];
    assistantIds?: string[];
    recurring?: boolean;
    recurrenceGroupId?: string;
    status?: string;
    resolvedAt?: Date | null;
    sessionId?: string;
    playerAttendance?: [string, PlayerAttendanceStatus][];
    coachAttendance?: [string, CoachAttendanceStatus][];
  }) => {
    const s = await prisma.scheduledSession.create({
      data: {
        date: data.date,
        startTime: data.startTime,
        durationMinutes: data.durationMinutes ?? 60,
        ageGroupId: byName[data.ageGroupName],
        batchId: data.batchId ?? null,
        locationId: data.locationId,
        headCoaches: { connect: (data.headIds ?? [headCoachId]).map((id) => ({ id })) },
        assistantCoaches: { connect: (data.assistantIds ?? []).map((id) => ({ id })) },
        recurring: data.recurring ?? false,
        recurrenceGroupId: data.recurrenceGroupId ?? null,
        status: data.status ?? "scheduled",
        resolvedAt: data.resolvedAt === undefined ? null : data.resolvedAt,
        sessionId: data.sessionId ?? null,
      },
    });

    if (data.playerAttendance) {
      for (const [playerId, status] of data.playerAttendance) {
        const [h, m] = data.startTime.split(":").map(Number);
        const start = new Date(data.date);
        start.setHours(h, m, 0, 0);
        const deadline = new Date(start.getTime() - 6 * 60 * 60 * 1000);
        await prisma.playerAttendance.create({
          data: { playerId, scheduledSessionId: s.id, status, deadline, confirmedAt: status === "NO_RESPONSE" ? null : data.date },
        });
      }
    }
    if (data.coachAttendance) {
      for (const [coachId, status] of data.coachAttendance) {
        await prisma.coachAttendance.create({
          data: { coachId, scheduledSessionId: s.id, status, method: status === "CHECKED_IN" ? "self" : "admin_override", confirmedAt: new Date() },
        });
      }
    }
    return s;
  };

  const u12Players = [pU12a.id, pU12b.id, pU12c.id];
  const u10Players = [pU10a.id, pU10b.id, pU10c.id, pU10d.id];

  // History: resolved sessions with attendance, going back a few weeks.
  await mkScheduled({
    date: at(daysAgo(21), 16, 0),
    startTime: "16:00",
    ageGroupName: "U12",
    batchId: batchU12.id,
    locationId: mainGround.id,
    headIds: [headCoachId],
    status: "completed",
    resolvedAt: daysAgo(20),
    sessionId: planPressing.id,
    playerAttendance: u12Players.map((id) => [id, "ATTENDED"] as [string, PlayerAttendanceStatus]),
    coachAttendance: [[headCoachId, "CHECKED_IN"] as [string, CoachAttendanceStatus]],
  });
  await mkScheduled({
    date: at(daysAgo(14), 15, 30),
    startTime: "15:30",
    ageGroupName: "U10",
    batchId: batchU10A.id,
    locationId: mainGround.id,
    headIds: [headCoachId],
    assistantIds: [assistantId],
    status: "completed",
    resolvedAt: daysAgo(13),
    sessionId: planWarmup.id,
    playerAttendance: u10Players.slice(0, 3).map((id) => [id, "ATTENDED"] as [string, PlayerAttendanceStatus]),
    coachAttendance: [[headCoachId, "CHECKED_IN"] as [string, CoachAttendanceStatus], [assistantId, "ABSENT"] as [string, CoachAttendanceStatus]],
  });
  await mkScheduled({
    date: at(daysAgo(7), 17, 0),
    startTime: "17:00",
    ageGroupName: "U12",
    batchId: batchU12.id,
    locationId: mainGround.id,
    headIds: [secondHeadId],
    status: "completed",
    resolvedAt: daysAgo(6),
    sessionId: planFinishing.id,
    playerAttendance: u12Players.map((id, i) => [id, i === 2 ? "ABSENT" : "ATTENDED"] as [string, PlayerAttendanceStatus]),
    coachAttendance: [[secondHeadId, "CHECKED_IN"] as [string, CoachAttendanceStatus]],
  });
  await mkScheduled({
    date: at(daysAgo(7), 16, 0),
    startTime: "16:00",
    ageGroupName: "U14",
    batchId: batchU14.id,
    locationId: trainingGround.id,
    headIds: [secondHeadId],
    status: "completed",
    resolvedAt: daysAgo(5),
    playerAttendance: [[pU14a.id, "ATTENDED"], [pU14b.id, "ABSENT"]] as [string, PlayerAttendanceStatus][],
    coachAttendance: [[secondHeadId, "CHECKED_IN"] as [string, CoachAttendanceStatus]],
  });

  // Needs-review: one unresolved with a pending assistant proposal, one with no data yet.
  const reviewSession = await mkScheduled({
    date: at(daysAgo(2), 16, 30),
    startTime: "16:30",
    ageGroupName: "U10",
    batchId: batchU10A.id,
    locationId: mainGround.id,
    headIds: [headCoachId],
    assistantIds: [assistantId],
    playerAttendance: u10Players.slice(0, 3).map((id) => [id, "ATTENDED"] as [string, PlayerAttendanceStatus]),
  });
  await mkScheduled({
    date: at(daysAgo(2), 15, 0),
    startTime: "15:00",
    ageGroupName: "U12",
    batchId: batchU12.id,
    locationId: mainGround.id,
    headIds: [secondHeadId],
    assistantIds: [assistantId],
  });

  // Attendance proposal from the assistant coach for the U10 review session.
  await prisma.approvalRequest.create({
    data: {
      type: "ATTENDANCE_CONFIRM",
      payload: {
        scheduledSessionId: reviewSession.id,
        statuses: u10Players.slice(0, 3).map((id, i) => ({ playerId: id, status: i === 0 ? "ABSENT" : "ATTENDED" })),
      },
      requestedById: assistantId,
    },
  });

  // Share request (from the assistant's PENDING rondo plan).
  await prisma.approvalRequest.create({
    data: { type: "SESSION_SHARE", payload: { sessionId: planRondo.id }, requestedById: assistantId },
  });

  // Upcoming: today, this week, recurring series.
  const recurrenceGroupId = crypto.randomUUID();
  for (let i = 0; i < 4; i++) {
    await mkScheduled({
      date: at(daysAhead(3 + i * 7), 16, 0),
      startTime: "16:00",
      ageGroupName: "U10",
      batchId: batchU10A.id,
      locationId: mainGround.id,
      headIds: [headCoachId],
      assistantIds: [assistantId],
      recurring: true,
      recurrenceGroupId,
      playerAttendance: [],
    });
  }
  await mkScheduled({
    date: at(daysAhead(1), 15, 30),
    startTime: "15:30",
    ageGroupName: "U12",
    batchId: batchU12.id,
    locationId: mainGround.id,
    headIds: [headCoachId],
    playerAttendance: [],
  });
  await mkScheduled({
    date: at(daysAhead(2), 17, 0),
    startTime: "17:00",
    ageGroupName: "U14",
    batchId: batchU14.id,
    locationId: trainingGround.id,
    headIds: [secondHeadId],
    playerAttendance: [],
  });
  await mkScheduled({
    date: at(daysAhead(8), 16, 0),
    startTime: "16:00",
    ageGroupName: "U12",
    batchId: batchU12.id,
    locationId: mainGround.id,
    headIds: [headCoachId],
    sessionId: planFinishing.id,
    playerAttendance: [],
  });

  console.log("Creating demo activity logs...");
  const log = (userId: string, action: string, entityType: string, entityId?: string, details?: string, createdAt = new Date()) =>
    prisma.activityLog.create({ data: { userId, action, entityType, entityId, details, createdAt } });
  await log(headCoach.id, "scheduled_session", "ScheduledSession", undefined, "4 x weekly U10", daysAgo(30));
  await log(headCoach.id, "created_drill", "Drill", d1.id, "Cone Dribble Gates", daysAgo(28));
  await log(assistant.id, "suggested_drill", "Drill", d6.id, "Sharks & Minnows", daysAgo(10));
  await log(headCoach.id, "approved_request", "ApprovalRequest", d6.id, "drill", daysAgo(9));
  await log(headCoach.id, "attached_session_plan", "ScheduledSession", undefined, "Pre-Match Warmup", daysAgo(13));
  await log(headCoach.id, "recorded_attendance", "ScheduledSession", undefined, "3 players", daysAgo(6));
  await log(secondHead.id, "created_session_plan", "Session", planFinishing.id, "Finishing Session", daysAgo(15));
  await log(assistant.id, "requested_session_share", "Session", planRondo.id, "Possession Rondo", daysAgo(2));
  await log(headCoach.id, "updated_player_skill", "Player", pU10a.id, "Dribbling=5", daysAgo(3));
  await log(headCoach.id, "added_player_note", "Player", pU12a.id, undefined, daysAgo(4));

  console.log("Adding a demo note to a player...");
  await prisma.note.create({
    data: { playerId: pU12a.id, coachId: headCoachId, content: "Great vision in training this week — keep pushing in the final third." },
  });

  console.log("Done.");
  console.log("");
  console.log("Demo accounts (password for all: " + DEMO_PASSWORD + ")");
  console.log("  Admin (view everything):   admin@touchline.local");
  console.log("  Head coach + approvals:    demo.head@demo.touchline.local  (Fernando Perera)");
  console.log("  Head coach (U14):          demo.head2@demo.touchline.local (Saman Silva)");
  console.log("  Assistant coach:           demo.assist@demo.touchline.local (Nadeesha Fernando)");
  console.log("");
  console.log(`Players seeded: ${players.length} · batches: 6 · drills: 7 · plans: 4 · sessions: 10`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
