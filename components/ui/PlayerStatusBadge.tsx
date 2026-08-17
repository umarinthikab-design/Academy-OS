// PlayerStatusBadge - pill for a player's status flag. Used wherever a
// player card appears (squad list, player page, attendance) so the state is
// always visible in the same place. Tone matches the state: green when
// active, warning for injured/suspended, muted-out for inactive.
//
// For a non-ACTIVE status, when it hasn't been touched in STATUS_STALE_DAYS
// or more, a subtle "flagged N days ago" hint renders next to the badge - a
// gentle nudge for the coach to double-check, not an alert. The status is
// never cleared automatically; a human always makes that call.

import { Badge } from "./Badge";

export const STATUS_STALE_DAYS = 30;

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

export function playerStatusStaleDays(statusUpdatedAt: Date | null | undefined): number | null {
  if (!statusUpdatedAt) return null;
  const days = Math.floor((Date.now() - statusUpdatedAt.getTime()) / (24 * 60 * 60 * 1000));
  return days >= STATUS_STALE_DAYS ? days : null;
}

export function PlayerStatusBadge({ status, statusUpdatedAt }: { status: string; statusUpdatedAt?: Date | null }) {
  const tone = status === "INJURED" || status === "SUSPENDED" ? "warning" : status === "INACTIVE" ? "muted" : "green";
  const staleDays = status !== "ACTIVE" ? playerStatusStaleDays(statusUpdatedAt) : null;
  return (
    <>
      <Badge tone={tone}>{playerStatusLabel(status)}</Badge>
      {staleDays !== null && (
        <span style={{ fontSize: 11, color: "var(--text-faint)" }}>· flagged {staleDays} days ago</span>
      )}
    </>
  );
}