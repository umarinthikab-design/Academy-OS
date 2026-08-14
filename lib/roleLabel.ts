// Friendly display labels for user roles.

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  HEAD_COACH: "Head Coach",
  ASSISTANT_COACH: "Assistant Coach",
  PARENT: "Parent",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role.replace(/_/g, " ").toLowerCase();
}