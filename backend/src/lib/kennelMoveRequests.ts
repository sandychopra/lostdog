import { TaskState } from "shared/constants/taskState.ts";
import { AnnouncementType } from "shared/constants/announcementType.ts";
import type { Prisma } from "../generated/prisma/client.ts";
import { isKennelOccupied, markKennelNeedsReset, markKennelOccupied } from "./kennelResets.ts";
import { logOccupantMoved } from "./activityLog.ts";

export class InvalidKennelMoveError extends Error {}

type Tx = Prisma.TransactionClient;

/** Creates a KennelMoveRequest and its triggering Announcement together. */
export async function createKennelMoveRequest(
  tx: Tx,
  args: {
    catId?: number;
    groupId?: number;
    fromKennelId: number;
    toKennelId: number;
    reason?: string;
    requestedById: string;
  },
) {
  const announcement = await tx.announcement.create({
    data: { type: AnnouncementType.KennelMoveRequested, catId: args.catId ?? null },
  });

  return tx.kennelMoveRequest.create({
    data: {
      catId: args.catId ?? null,
      groupId: args.groupId ?? null,
      fromKennelId: args.fromKennelId,
      toKennelId: args.toKennelId,
      reason: args.reason ?? null,
      requestedById: args.requestedById,
      announcementId: announcement.id,
      state: TaskState.Open,
    },
  });
}

/** Performs the requested move, from the Announcements page, and resolves its Announcement. */
export async function completeKennelMoveRequest(
  tx: Tx,
  args: { kennelMoveRequestId: number; actorId: string },
) {
  const request = await tx.kennelMoveRequest.findUniqueOrThrow({
    where: { id: args.kennelMoveRequestId },
  });
  if (request.state !== TaskState.Open) {
    throw new InvalidKennelMoveError(`Kennel move request ${request.id} is not open`);
  }

  const currentKennelId =
    request.catId !== null
      ? (await tx.cat.findUniqueOrThrow({ where: { id: request.catId } })).kennelId
      : (await tx.group.findUniqueOrThrow({ where: { id: request.groupId! } })).kennelId;
  if (currentKennelId !== request.fromKennelId) {
    throw new InvalidKennelMoveError(
      `Kennel move request ${request.id}'s occupant is no longer in the source kennel`,
    );
  }

  if (await isKennelOccupied(tx, request.toKennelId)) {
    throw new InvalidKennelMoveError("Destination kennel is already occupied");
  }

  if (request.catId !== null) {
    await tx.cat.update({ where: { id: request.catId }, data: { kennelId: request.toKennelId } });
  } else {
    await tx.group.update({
      where: { id: request.groupId! },
      data: { kennelId: request.toKennelId },
    });
  }

  await markKennelNeedsReset(tx, request.fromKennelId, args.actorId);
  await markKennelOccupied(tx, request.toKennelId, args.actorId);
  await logOccupantMoved(tx, {
    catId: request.catId,
    groupId: request.groupId,
    fromKennelId: request.fromKennelId,
    toKennelId: request.toKennelId,
    actorId: args.actorId,
  });

  await tx.kennelMoveRequest.update({
    where: { id: request.id },
    data: {
      state: TaskState.Done,
      completedById: args.actorId,
      completedAt: new Date(),
    },
  });

  if (request.announcementId !== null) {
    await tx.announcement.update({
      where: { id: request.announcementId },
      data: { resolved: true, resolvedAt: new Date(), resolvedById: args.actorId },
    });
  }
}

/** Cancels an open KennelMoveRequest and resolves its Announcement. */
export async function cancelKennelMoveRequest(
  tx: Tx,
  args: { kennelMoveRequestId: number; actorId: string },
) {
  const request = await tx.kennelMoveRequest.findUniqueOrThrow({
    where: { id: args.kennelMoveRequestId },
  });
  if (request.state !== TaskState.Open) {
    throw new InvalidKennelMoveError(`Kennel move request ${request.id} is not open`);
  }

  await tx.kennelMoveRequest.update({
    where: { id: request.id },
    data: { state: TaskState.Cancelled },
  });

  if (request.announcementId !== null) {
    await tx.announcement.update({
      where: { id: request.announcementId },
      data: { resolved: true, resolvedAt: new Date(), resolvedById: args.actorId },
    });
  }
}
