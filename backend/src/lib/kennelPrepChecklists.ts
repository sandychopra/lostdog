import { ChecklistActionType } from "shared/constants/checklistActionType.ts";
import { NotificationType } from "shared/constants/notificationType.ts";
import type { Prisma } from "../generated/prisma/client.ts";
import { logOccupantMoved } from "./activityLog.ts";
import { isKennelOccupied, markKennelOccupied, markKennelReady } from "./kennelResets.ts";

export class InvalidChecklistActionError extends Error {}

type Tx = Prisma.TransactionClient;

interface TaskInput {
  actionType: ChecklistActionType;
  description?: string;
  kennelId?: number;
  catId?: number;
  groupId?: number;
}

/** Creates a KennelPrepChecklist with its ordered tasks — no Notification of
 * its own; the caller (an ad-hoc Manual notification) owns that. */
export async function createChecklistTasks(
  tx: Tx,
  args: { actions: TaskInput[]; createdById: string },
) {
  const checklist = await tx.kennelPrepChecklist.create({
    data: { createdById: args.createdById },
  });

  await tx.checklistAction.createMany({
    data: args.actions.map((action, index) => ({
      checklistId: checklist.id,
      order: index,
      actionType: action.actionType,
      kennelId: action.kennelId ?? null,
      catId: action.catId ?? null,
      groupId: action.groupId ?? null,
      description: action.description ?? null,
    })),
  });

  return tx.kennelPrepChecklist.findUniqueOrThrow({
    where: { id: checklist.id },
    include: { actions: { orderBy: { order: "asc" } } },
  });
}

/** Completes the next-in-order ChecklistAction, from the Notifications page. */
export async function completeChecklistAction(
  tx: Tx,
  args: { checklistActionId: number; actorId: string },
) {
  const action = await tx.checklistAction.findUniqueOrThrow({
    where: { id: args.checklistActionId },
  });
  if (action.completed) {
    throw new InvalidChecklistActionError(`Checklist action ${action.id} is already completed`);
  }

  const earlierIncomplete = await tx.checklistAction.count({
    where: { checklistId: action.checklistId, order: { lt: action.order }, completed: false },
  });
  if (earlierIncomplete > 0) {
    throw new InvalidChecklistActionError(
      `Checklist action ${action.id} has an earlier step that isn't done yet`,
    );
  }

  if (action.actionType === ChecklistActionType.ResetKennel) {
    // A kennel is Ready only when it's empty, so the occupant must be moved out
    // first (an earlier move step, or an Admin reassignment).
    if (await isKennelOccupied(tx, action.kennelId!)) {
      throw new InvalidChecklistActionError(
        "This kennel is still occupied — move its occupant out before resetting it",
      );
    }
    await markKennelReady(tx, action.kennelId!, args.actorId);
    // The reset is done, so the kennel's "needs reset" notification is too.
    await tx.notification.updateMany({
      where: {
        type: NotificationType.KennelNeedsReset,
        kennelId: action.kennelId!,
        resolved: false,
      },
      data: { resolved: true, resolvedAt: new Date(), resolvedById: args.actorId },
    });
  } else if (action.actionType === ChecklistActionType.MoveCat) {
    // Re-check the occupant at completion time: the cat may have been picked up
    // or returned to RCC (or the group retired) since the checklist was posted.
    let fromKennelId: number | null;
    if (action.catId !== null) {
      const cat = await tx.cat.findUniqueOrThrow({ where: { id: action.catId } });
      if (!cat.active) {
        throw new InvalidChecklistActionError("This cat is no longer on the active roster");
      }
      fromKennelId = cat.kennelId;
    } else {
      const group = await tx.group.findUniqueOrThrow({ where: { id: action.groupId! } });
      if (group.kennelId === null) {
        throw new InvalidChecklistActionError("This group no longer has a kennel");
      }
      fromKennelId = group.kennelId;
    }

    if (await isKennelOccupied(tx, action.kennelId!)) {
      throw new InvalidChecklistActionError("Destination kennel is already occupied");
    }

    if (action.catId !== null) {
      await tx.cat.update({ where: { id: action.catId! }, data: { kennelId: action.kennelId! } });
    } else {
      await tx.group.update({
        where: { id: action.groupId! },
        data: { kennelId: action.kennelId! },
      });
    }
    await markKennelOccupied(tx, action.kennelId!, args.actorId);
    await logOccupantMoved(tx, {
      catId: action.catId,
      groupId: action.groupId,
      fromKennelId,
      toKennelId: action.kennelId!,
      actorId: args.actorId,
    });
  }
  // FreeText: no side effect beyond marking it completed below.

  await tx.checklistAction.update({
    where: { id: action.id },
    data: { completed: true, completedById: args.actorId, completedAt: new Date() },
  });

  const remainingIncomplete = await tx.checklistAction.count({
    where: { checklistId: action.checklistId, completed: false },
  });
  if (remainingIncomplete === 0) {
    await tx.notification.updateMany({
      where: { checklistId: action.checklistId },
      data: { resolved: true, resolvedAt: new Date(), resolvedById: args.actorId },
    });
  }
}
