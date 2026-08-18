// Server-side assignment resolver. THE source of truth for "what can this
// user see on the dashboard" is the database relationships below — never a
// hardcoded list in the frontend:
//
//   Coach  → primaryFocus AgeGroup[]   (coach-to-age-group assignment)
//   Coach  → mainBatches  Batch[]      (coach-to-batch assignment)
//   Parent → players      Player[]     (parent-to-player assignment)
//   Batch  → ageGroup     AgeGroup     (batch belongs to an age group)
//   Player → batches      Batch[]      (player belongs to one+ batches)
//
// Admin sees the whole club (no scoping). Every query in the dashboard
// components is scoped to the ids returned here, so reassigning a coach in
// the DB automatically changes what their dashboard shows — no code change.

import { getSession } from "./getSession";
import { getPermissions } from "./permissions";
import { prisma } from "./prisma";

export type DashboardTeam = {
  id: string;
  name: string;
  kind: "ageGroup" | "batch";
  ageGroupName?: string;
};

export type DashboardScope = {
  role: "ADMIN" | "CLUB_MANAGER" | "HEAD_COACH" | "ASSISTANT_COACH" | "PARENT" | null;
  isAdmin: boolean;
  coachId: string | null;
  // Teams the coach is assigned to (primary focus age groups + main batches).
  teams: DashboardTeam[];
  // Age group ids the coach can access (their primary focus).
  ageGroupIds: string[];
  // Batch ids the coach can access (their main batches + every batch under a
  // primary-focus age group). "Under a focus age group" matters: a coach who
  // focuses on U12 should see all of U12's batches, not just ones explicitly
  // listed as main batches.
  batchIds: string[];
  // Linked players (PARENT role).
  parentPlayerIds: string[];
};

const EMPTY: DashboardScope = {
  role: null,
  isAdmin: false,
  coachId: null,
  teams: [],
  ageGroupIds: [],
  batchIds: [],
  parentPlayerIds: [],
};

export async function getDashboardScope(): Promise<DashboardScope> {
  const session = await getSession();
  const perms = await getPermissions();
  if (!session) return EMPTY;

  if (perms.role === "ADMIN") {
    return { ...EMPTY, role: "ADMIN", isAdmin: true };
  }

  // Club managers see the whole club like admins (they land on
  // AdminDashboard), but are NOT flagged isAdmin - that flag drives
  // admin-only account surfaces.
  if (perms.role === "CLUB_MANAGER") {
    return { ...EMPTY, role: "CLUB_MANAGER" };
  }

  if (perms.role === "HEAD_COACH" || perms.role === "ASSISTANT_COACH") {
    const coach = await prisma.coach.findUnique({
      where: { userId: session.userId },
      select: {
        id: true,
        primaryFocus: {
          select: { id: true, name: true, batches: { select: { id: true } } },
        },
        mainBatches: {
          select: { id: true, name: true, ageGroup: { select: { id: true, name: true } } },
        },
      },
    });
    if (!coach) return { ...EMPTY, role: perms.role };

    const ageGroupIds = coach.primaryFocus.map((a) => a.id);
    // Unique set: main batches + batches under focus age groups.
    const batchIds = [
      ...new Set([
        ...coach.mainBatches.map((b) => b.id),
        ...coach.primaryFocus.flatMap((a) => a.batches.map((b) => b.id)),
      ]),
    ];

    const teams: DashboardTeam[] = [
      ...coach.primaryFocus.map((a) => ({ id: a.id, name: a.name, kind: "ageGroup" as const })),
      ...coach.mainBatches.map((b) => ({
        id: b.id,
        name: b.name,
        kind: "batch" as const,
        ageGroupName: b.ageGroup.name,
      })),
    ];

    return {
      role: perms.role,
      isAdmin: false,
      coachId: coach.id,
      teams,
      ageGroupIds,
      batchIds,
      parentPlayerIds: [],
    };
  }

  if (perms.role === "PARENT") {
    const parent = await prisma.parent.findUnique({
      where: { userId: session.userId },
      select: { players: { select: { id: true } } },
    });
    return {
      ...EMPTY,
      role: "PARENT",
      parentPlayerIds: parent?.players.map((p) => p.id) ?? [],
    };
  }

  return { ...EMPTY, role: perms.role };
}
