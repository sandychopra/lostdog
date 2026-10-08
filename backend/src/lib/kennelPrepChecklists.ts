import { ChecklistActionType } from "shared/constants/checklistActionType.ts";
import type { Prisma } from "../generated/prisma/client.ts";
import { logOccupantMoved } from "./activityLog.ts";
import { markKennelOccupied, markKennelReady } from "./kennelResets.ts";

export class InvalidChecklistActionError extends Error {}

type Tx = Prisma.TransactionClient;

interface TaskInput {
  actionType: ChecklistActionType;
  description?: string;
  kennelId?: number;
  catId?: number;
  groupId?: number;
}

/** Creates a KennelPrepChecklist with its ordered tasks — no Announcement of
 * its own; the caller (an ad-hoc Manual announcement) owns that. */
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

/** Completes the next-in-order ChecklistAction, from the Announcements page. */
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
    await markKennelReady(tx, action.kennelId!, args.actorId);
  } else if (action.actionType === ChecklistActionType.MoveCat) {
    const [catCount, groupCount] = await Promise.all([
      tx.cat.count({ where: { kennelId: action.kennelId! } }),
      tx.group.count({ where: { kennelId: action.kennelId! } }),
    ]);
    if (catCount > 0 || groupCount > 0) {
      throw new InvalidChecklistActionError("Destination kennel is already occupied");
    }

    const fromKennelId =
      action.catId !== null
        ? (await tx.cat.findUniqueOrThrow({ where: { id: action.catId } })).kennelId
        : (await tx.group.findUniqueOrThrow({ where: { id: action.groupId! } })).kennelId;

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
    await tx.announcement.updateMany({
      where: { checklistId: action.checklistId },
      data: { resolved: true, resolvedAt: new Date(), resolvedById: args.actorId },
    });
  }
}
