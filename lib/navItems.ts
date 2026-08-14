// Navigation is role + permission aware. The dashboard layout resolves which
// links the logged-in user can actually reach (via getPermissions) and passes
// the filtered list to both the desktop sidebar and mobile drawer — the same
// source for both, so they never drift.

import type { Permissions } from "./permissions";

export type NavItem = { href: string; label: string; icon: string };

export function getNavItems(perms: Permissions): NavItem[] {
  const items: NavItem[] = [{ href: "/", label: "Dashboard", icon: "dashboard" }];

  if (perms.role === "PARENT") {
    items.push({ href: "/settings", label: "Settings", icon: "settings" });
    return items;
  }

  // Coaching staff (head + assistant) and admins share the football-ops pages.
  items.push(
    { href: "/schedule", label: "Schedule", icon: "calendar" },
    { href: "/sessions", label: "Sessions", icon: "sessions" },
    { href: "/attendance", label: "Attendance", icon: "attendance" }
  );

  if (perms.isAdmin || perms.isHeadCoach || perms.isAssistant) {
    items.push({ href: "/squad", label: "Squad", icon: "squad" });
  }

  // Roster & structure pages: admins always; head coaches when they hold the
  // matching permission. Assistants stay on the player-facing tools.
  if (perms.isAdmin || (perms.isHeadCoach && perms.canEditRoster)) {
    items.push({ href: "/coaches", label: "Coaches", icon: "coaches" });
  }
  if (perms.isAdmin || perms.isHeadCoach) {
    items.push({ href: "/batches", label: "Batches", icon: "batches" });
  }
  if (perms.isAdmin || (perms.isHeadCoach && perms.canEditLocations)) {
    items.push({ href: "/locations", label: "Locations", icon: "locations" });
  }
  if (perms.isAdmin || (perms.isHeadCoach && perms.canEditAgeGroups)) {
    items.push({ href: "/age-groups", label: "Age Groups", icon: "target" });
  }

  if (perms.canSuggestDrills) {
    items.push({ href: "/drills", label: "Drill Library", icon: "drills" });
  }

  items.push({ href: "/activity", label: "Activity", icon: "activity" });
  items.push({ href: "/settings", label: "Settings", icon: "settings" });

  return items;
}
