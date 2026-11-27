import { TaskState } from "shared/constants/taskState.ts";
import { ActivityAction, ActivityEntityType } from "shared/constants/activityLog.ts";
import type { Prisma } from "../generated/prisma/client.ts";
import { logActivity } from "./activityLog.ts";

type Tx = Prisma.TransactionClient;

export interface RemoveCatFromGroupResult {
  /** The group's kennel at the time of removal. */
  groupKennelId: number | null;
  /** Cats still in the kennel after removal (0 means the kennel is now empty). */
  catsLeftInKennel: number;
}

/**
 * Ends a group that no longer has cats sharing a kennel. Open move requests for
 * it are cancelled first. The row is only deleted when nothing references it:
 * shift-report entries, checklist steps and move requests keep their group
 * (their check constraints require a cat or a group), so a group with history
 * is retired instead — it keeps its id but no longer holds a kennel.
 */
async function retireGroup(tx: Tx, groupId: number, actorId: string): Promise<void> {
  const openMoves = await tx.kennelMoveRequest.findMany({
    where: { groupId, state: TaskState.Open },
  });
  for (const move of openMoves) {
    await tx.kennelMoveRequest.update({
      where: { id: move.id },
      data: { state: TaskState.Cancelled },
    });
    if (move.notificationId !== null) {
      await tx.notification.update({
        where: { id: move.notificationId },
        data: { resolved: true, resolvedAt: new Date(), resolvedById: actorId },
      });
    }
  }

  const [entries, checklistSteps, moves] = await Promise.all([
    tx.catEntry.count({ where: { groupId } }),
    tx.checklistAction.count({ where: { groupId } }),
    tx.kennelMoveRequest.count({ where: { groupId } }),
  ]);
  if (entries + checklistSteps + moves > 0) {
    await tx.group.update({ where: { id: groupId }, data: { kennelId: null, bonded: false } });
  } else {
    await tx.group.delete({ where: { id: groupId } });
  }
}

/**
 * Takes a cat out of its group (the cat ends up with no group and no kennel).
 * A group left with one cat dissolves — that cat takes the group's kennel — and
 * a group left with none is retired (see retireGroup). Shared by the Admin "Remove from Group"
 * action and Confirm Pickup.
 */
export async function removeCatFromGroup(
  tx: Tx,
  args: { catId: number; groupId: number; actorId: string; reason?: string },
): Promise<RemoveCatFromGroupResult> {
  const group = await tx.group.findUniqueOrThrow({ where: { id: args.groupId } });

  await tx.cat.update({ where: { id: args.catId }, data: { groupId: null, kennelId: null } });
  await logActivity(tx, {
    entityType: ActivityEntityType.Cat,
    entityId: args.catId,
    action: ActivityAction.Update,
    actorId: args.actorId,
    description: args.reason
      ? `Removed from group ${args.groupId} (${args.reason})`
      : `Removed from group ${args.groupId}`,
  });

  const otherCats = await tx.cat.findMany({ where: { groupId: args.groupId } });

  if (otherCats.length === 1) {
    const lastCat = otherCats[0]!;
    await tx.cat.update({
      where: { id: lastCat.id },
      data: { groupId: null, kennelId: group.kennelId },
    });
    await logActivity(tx, {
      entityType: ActivityEntityType.Cat,
      entityId: lastCat.id,
      action: ActivityAction.Update,
      actorId: args.actorId,
      description: `Group ${args.groupId} dissolved`,
    });
    await retireGroup(tx, args.groupId, args.actorId);
  } else if (otherCats.length === 0) {
    await retireGroup(tx, args.groupId, args.actorId);
  }

  return { groupKennelId: group.kennelId, catsLeftInKennel: otherCats.length };
}
