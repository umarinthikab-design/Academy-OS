import type { Prisma } from "@prisma/client";

export type RosterSession = { batchId: string | null; ageGroupId: string };
// A batch-specific session uses that batch only. An age-group session includes
// direct assignments and existing batch memberships, deduplicated by Player.
export function sessionRosterWhere(session: RosterSession): Prisma.PlayerWhereInput {
  return session.batchId
    ? { batches: { some: { id: session.batchId } } }
    : { OR: [{ ageGroupId: session.ageGroupId }, { batches: { some: { ageGroupId: session.ageGroupId } } }] };
}
export function playerBelongsToSession(player: { ageGroupId: string | null; batches: { id: string; ageGroupId: string }[] }, session: RosterSession): boolean {
  return session.batchId ? player.batches.some(b => b.id === session.batchId)
    : player.ageGroupId === session.ageGroupId || player.batches.some(b => b.ageGroupId === session.ageGroupId);
}
