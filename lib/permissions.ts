import { getSession } from "./getSession";
import { prisma } from "./prisma";

export type Permissions = {
  role: "ADMIN" | "CLUB_MANAGER" | "HEAD_COACH" | "ASSISTANT_COACH" | "PARENT" | null;
  isAdmin: boolean;
  isClubManager: boolean;
  isHeadCoach: boolean;
  isAssistant: boolean;
  // The logged-in User's id (ActivityLog.userId) - null when not signed in.
  userId: string | null;
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
  // Who can author drills into the library. Coaches always can. Admins always
  // can (they have no Coach row, so they don't show up in canSuggestDrills).
  // Club managers can unless the admin turns it off in Club Settings.
  canAuthorDrills: boolean;
  // Who may compose and send a club-wide broadcast from /notifications/new.
  // Deliberately not a coach permission - broadcasting to the whole club is a
  // management action, so it's gated on role here rather than on a schema
  // toggle. Everyone with an account can *receive* notifications regardless.
  canSendNotifications: boolean;
};

const EMPTY: Permissions = {
  role: null,
  isAdmin: false,
  isClubManager: false,
  isHeadCoach: false,
  isAssistant: false,
  userId: null,
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
  canAuthorDrills: false,
  canSendNotifications: false,
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
      userId: session.userId,
      canEditRoster: true,
      canEditDrills: true,
      canApproveRequests: true,
      canEditSchedule: true,
      canEditLocations: true,
      canEditAgeGroups: true,
      canEditSquad: true,
      canEditBatches: true,
      canSuggestDrills: true,
      canAuthorDrills: true,
      canSendNotifications: true,
    };
  }

  // Club Manager: an operational super-user without the Admin escalation
  // powers (no account-creation of admins, no Coach identity for attendance
  // chains). Same broad edit access as Admin, but flagged as a distinct role
  // so Admin-only surfaces (account management) stay admin-gated. No Coach
  // lookup - club managers have no coach record.
  if (session.role === "CLUB_MANAGER") {
    const settings = await prisma.academySettings.findFirst();
    return {
      ...EMPTY,
      role: "CLUB_MANAGER",
      isClubManager: true,
      userId: session.userId,
      canEditRoster: true,
      canEditDrills: true,
      canApproveRequests: true,
      canEditSchedule: true,
      canEditLocations: true,
      canEditAgeGroups: true,
      canEditSquad: true,
      canEditBatches: true,
      canSuggestDrills: true,
      // Admins decide whether club managers can author drills (Club Settings).
      canAuthorDrills: settings?.clubManagersCanAuthorDrills ?? true,
      canSendNotifications: true,
    };
  }

  if (session.role === "HEAD_COACH") {
    const coach = await prisma.coach.findUnique({ where: { userId: session.userId } });
    return {
      ...EMPTY,
      role: "HEAD_COACH",
      isHeadCoach: true,
      userId: session.userId,
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
      canAuthorDrills: true,
    };
  }

  if (session.role === "ASSISTANT_COACH") {
    const coach = await prisma.coach.findUnique({ where: { userId: session.userId } });
    return {
      ...EMPTY,
      role: "ASSISTANT_COACH",
      isAssistant: true,
      userId: session.userId,
      coachId: coach?.id ?? null,
      canSuggestDrills: true,
      canAuthorDrills: true,
    };
  }

  // PARENT - no admin/coach pages are built for this role yet.
  return { ...EMPTY, role: "PARENT", userId: session.userId };
}
