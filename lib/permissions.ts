import { getSession } from "./getSession";
import { prisma } from "./prisma";

export type Permissions = {
  role: "ADMIN" | "HEAD_COACH" | "ASSISTANT_COACH" | "PARENT" | null;
  isAdmin: boolean;
  isHeadCoach: boolean;
  isAssistant: boolean;
  coachId: string | null;
  canEditRoster: boolean;
  canEditDrills: boolean;
  canApproveRequests: boolean;
  canEditSchedule: boolean;
  canEditLocations: boolean;
  canEditAgeGroups: boolean;
  // Squad and Batches don't have dedicated toggle fields in the schema -
  // that wasn't part of the original permission design. For now, any head
  // coach can edit these (same as admin); only assistants are locked out.
  // If per-head-coach control over these is needed later, that requires a
  // schema migration to add the fields.
  canEditSquad: boolean;
  canEditBatches: boolean;
  // Anyone who's an actual coach (head or assistant) can suggest a drill -
  // approval is what's gated, not submission.
  canSuggestDrills: boolean;
};

const EMPTY: Permissions = {
  role: null,
  isAdmin: false,
  isHeadCoach: false,
  isAssistant: false,
  coachId: null,
  canEditRoster: false,
  canEditDrills: false,
  canApproveRequests: false,
  canEditSchedule: false,
  canEditLocations: false,
  canEditAgeGroups: false,
  canEditSquad: false,
  canEditBatches: false,
  canSuggestDrills: false,
};

// The single source of truth for "what can the logged-in user do." Every
// action and page should call this instead of checking session.role
// directly, so the rules only live in one place.
export async function getPermissions(): Promise<Permissions> {
  const session = await getSession();
  if (!session) return EMPTY;

  if (session.role === "ADMIN") {
    return {
      ...EMPTY,
      role: "ADMIN",
      isAdmin: true,
      canEditRoster: true,
      canEditDrills: true,
      canApproveRequests: true,
      canEditSchedule: true,
      canEditLocations: true,
      canEditAgeGroups: true,
      canEditSquad: true,
      canEditBatches: true,
      canSuggestDrills: true,
    };
  }

  if (session.role === "HEAD_COACH") {
    const coach = await prisma.coach.findUnique({ where: { userId: session.userId } });
    return {
      ...EMPTY,
      role: "HEAD_COACH",
      isHeadCoach: true,
      coachId: coach?.id ?? null,
      canEditRoster: coach?.canEditRoster ?? false,
      canEditDrills: coach?.canEditDrills ?? false,
      canApproveRequests: coach?.canApproveRequests ?? false,
      canEditSchedule: coach?.canEditSchedule ?? false,
      canEditLocations: coach?.canEditLocations ?? false,
      canEditAgeGroups: coach?.canEditAgeGroups ?? false,
      canEditSquad: true,
      canEditBatches: true,
      canSuggestDrills: true,
    };
  }

  if (session.role === "ASSISTANT_COACH") {
    const coach = await prisma.coach.findUnique({ where: { userId: session.userId } });
    return {
      ...EMPTY,
      role: "ASSISTANT_COACH",
      isAssistant: true,
      coachId: coach?.id ?? null,
      canSuggestDrills: true,
    };
  }

  // PARENT - no admin/coach pages are built for this role yet.
  return { ...EMPTY, role: "PARENT" };
}
