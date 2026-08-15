// AvailabilityBadge - pill for a player's availability flag. Used wherever a
// player card appears (squad list, player page, attendance) so the state is
// always visible in the same place. Tone matches the state: green when
// available, warning for injured, muted-out for inactive.

import { Badge } from "./Badge";

export function availabilityLabel(availability: string): string {
  switch (availability) {
    case "INJURED":
      return "Injured";
    case "INACTIVE":
      return "Inactive";
    default:
      return "Available";
  }
}

export function AvailabilityBadge({ availability }: { availability: string }) {
  const tone = availability === "INJURED" ? "warning" : availability === "INACTIVE" ? "muted" : "green";
  return <Badge tone={tone}>{availabilityLabel(availability)}</Badge>;
}
