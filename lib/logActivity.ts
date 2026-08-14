import { prisma } from "./prisma";

// Append a row to the activity log. Called from every mutating server
// action so there's a full audit trail of who did what. `action` strings
// are kept consistent and snake_case, e.g. "created_drill",
// "approved_request" — matches the example comment on the ActivityLog
// model in prisma/schema.prisma.
export async function logActivity(
  userId: string,
  action: string,
  entityType: string,
  entityId?: string,
  details?: string
) {
  try {
    await prisma.activityLog.create({
      data: { userId, action, entityType, entityId, details },
    });
  } catch {
    // Logging must never break the action that triggered it. A failed log
    // write is swallowed rather than bubbling up as a 500.
  }
}