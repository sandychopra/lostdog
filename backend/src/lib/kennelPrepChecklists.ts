import { ChecklistActionType } from "shared/constants/checklistActionType.ts";
import { KennelState } from "shared/constants/kennelState.ts";
import { AnnouncementType } from "shared/constants/announcementType.ts";
import type { CreateChecklistInput } from "shared/schemas/kennelPrepChecklists.ts";
import type { Prisma } from "../generated/prisma/client.ts";

export class InvalidChecklistActionError extends Error {}

type Tx = Prisma.TransactionClient;

/** Creates a KennelPrepChecklist with its ordered actions and triggering Announcement together. */
export async function createChecklist(
  tx: Tx,
  args: { actions: CreateChecklistInput["actions"]; createdById: string },
) {
  const checklist = await tx.kennelPrepChecklist.create({
    data: { createdById: args.createdById },
  });

  await tx.checklistAction.createMany({
    data: args.actions.map((action, index) => ({
      checklistId: checklist.id,
      order: index,
      actionType: action.actionType,
      kennelId: action.kennelId,
      catId: action.catId ?? null,
      groupId: action.groupId ?? null,
    })),
  });

  await tx.announcement.create({
    data: { type: AnnouncementType.ChecklistAssigned, checklistId: checklist.id },
  });

  return tx.kennelPrepChecklist.findUniqueOrThrow({
    where: { id: checklist.id },
    include: { actions: { orderBy: { order: "asc" } } },
  });
}

/** Completes the next-in-order ChecklistAction (from a ShiftReport's "Kennel prep" section). */
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
    await tx.kennel.update({ where: { id: action.kennelId }, data: { state: KennelState.Ready } });
  } else {
    const [catCount, groupCount] = await Promise.all([
      tx.cat.count({ where: { kennelId: action.kennelId } }),
      tx.group.count({ where: { kennelId: action.kennelId } }),
    ]);
    if (catCount > 0 || groupCount > 0) {
      throw new InvalidChecklistActionError("Destination kennel is already occupied");
    }

    if (action.catId !== null) {
      await tx.cat.update({ where: { id: action.catId }, data: { kennelId: action.kennelId } });
    } else {
      await tx.group.update({
        where: { id: action.groupId! },
        data: { kennelId: action.kennelId },
      });
    }
    await tx.kennel.update({
      where: { id: action.kennelId },
      data: { state: KennelState.Occupied },
    });
  }

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
      data: { resolved: true },
    });
  }
}
