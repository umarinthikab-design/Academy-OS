// PlayerStatusBadge - pill for a player's status flag. Used wherever a
// player card appears (squad list, player page, attendance) so the state is
// always visible in the same place. Tone matches the state: green when
// active, warning for injured/suspended, muted-out for inactive.

import { Badge } from "./Badge";

export function playerStatusLabel(status: string): string {
  switch (status) {
    case "INJURED":
      return "Injured";
    case "SUSPENDED":
      return "Suspended";
    case "INACTIVE":
      return "Inactive";
    default:
      return "Active";
  }
}

export function PlayerStatusBadge({ status }: { status: string }) {
  const tone = status === "INJURED" || status === "SUSPENDED" ? "warning" : status === "INACTIVE" ? "muted" : "green";
  return <Badge tone={tone}>{playerStatusLabel(status)}</Badge>;
}
