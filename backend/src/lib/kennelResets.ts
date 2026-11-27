import { KennelState } from "shared/constants/kennelState.ts";
import { NotificationType } from "shared/constants/notificationType.ts";
import { ActivityAction, ActivityEntityType } from "shared/constants/activityLog.ts";
import type { Prisma } from "../generated/prisma/client.ts";
import { logActivity } from "./activityLog.ts";

export class KennelResetNotFoundError extends Error {}
export class KennelResetConflictError extends Error {}

type Tx = Prisma.TransactionClient;

/** True when an active cat or a group is assigned to the kennel. Cats that have
 * left (picked up / returned to RCC) have no kennel, so they never count. */
export async function isKennelOccupied(db: Tx, kennelId: number): Promise<boolean> {
  const [catCount, groupCount] = await Promise.all([
    db.cat.count({ where: { kennelId, active: true } }),
    db.group.count({ where: { kennelId } }),
  ]);
  return catCount > 0 || groupCount > 0;
}

/**
 * Flips a kennel to NeedsReset and ensures exactly one open KennelNeedsReset
 * notification exists for it. Every place in the app that sets a kennel to
 * NeedsReset must go through this (rather than a raw kennel.update) so the
 * kennel always has a completable action on the Notifications page — there's
 * no other way to bring a kennel back to Ready now that the shift report's
 * generic "Kennels reset this shift" checklist is gone.
 */
export async function markKennelNeedsReset(
  tx: Tx,
  kennelId: number,
  actorId?: string | null,
): Promise<void> {
  const before = await tx.kennel.findUniqueOrThrow({ where: { id: kennelId } });
  await tx.kennel.update({ where: { id: kennelId }, data: { state: KennelState.NeedsReset } });
  await logActivity(tx, {
    entityType: ActivityEntityType.Kennel,
    entityId: kennelId,
    action: ActivityAction.Update,
    actorId,
    description: `State changed from ${before.state} to ${KennelState.NeedsReset}`,
  });

  const alreadyOpen = await tx.notification.findFirst({
    where: { type: NotificationType.KennelNeedsReset, kennelId, resolved: false },
  });
  if (alreadyOpen) return;

  await tx.notification.create({ data: { type: NotificationType.KennelNeedsReset, kennelId } });
}

/** Completes a kennel's reset from the Notifications page: flips it back to
 * Ready and resolves its open KennelNeedsReset notification. */
export async function completeKennelReset(
  tx: Tx,
  args: { kennelId: number; actorId: string },
): Promise<void> {
  const notification = await tx.notification.findFirst({
    where: { type: NotificationType.KennelNeedsReset, kennelId: args.kennelId, resolved: false },
  });
  if (!notification) {
    throw new KennelResetNotFoundError(`No open reset notification for kennel ${args.kennelId}`);
  }

  await tx.kennel.update({ where: { id: args.kennelId }, data: { state: KennelState.Ready } });
  await logActivity(tx, {
    entityType: ActivityEntityType.Kennel,
    entityId: args.kennelId,
    action: ActivityAction.Update,
    actorId: args.actorId,
    description: `State changed from ${KennelState.NeedsReset} to ${KennelState.Ready} (reset completed)`,
  });
  await tx.notification.update({
    where: { id: notification.id },
    data: { resolved: true, resolvedAt: new Date(), resolvedById: args.actorId },
  });
}

/** Reverts a completed kennel reset: flips the kennel back to NeedsReset and
 * reopens the notification completeKennelReset resolved. */
export async function uncompleteKennelReset(
  tx: Tx,
  args: { kennelId: number; actorId: string },
): Promise<void> {
  const kennel = await tx.kennel.findUniqueOrThrow({ where: { id: args.kennelId } });
  if (kennel.state !== KennelState.Ready) {
    throw new KennelResetConflictError(
      `Cannot undo — kennel ${args.kennelId} is no longer Ready (state: ${kennel.state})`,
    );
  }

  const notification = await tx.notification.findFirst({
    where: { type: NotificationType.KennelNeedsReset, kennelId: args.kennelId, resolved: true },
    orderBy: [{ resolvedAt: "desc" }, { id: "desc" }],
  });
  if (!notification) {
    throw new KennelResetNotFoundError(
      `No resolved reset notification for kennel ${args.kennelId}`,
    );
  }

  await tx.kennel.update({ where: { id: args.kennelId }, data: { state: KennelState.NeedsReset } });
  await logActivity(tx, {
    entityType: ActivityEntityType.Kennel,
    entityId: args.kennelId,
    action: ActivityAction.Update,
    actorId: args.actorId,
    description: `State changed from ${KennelState.Ready} to ${KennelState.NeedsReset} (reset undone)`,
  });
  await tx.notification.update({
    where: { id: notification.id },
    data: { resolved: false, resolvedAt: null, resolvedById: null },
  });
}

/** Flips a kennel to Occupied, logging the state change when it actually changes. */
export async function markKennelOccupied(
  tx: Tx,
  kennelId: number,
  actorId?: string | null,
): Promise<void> {
  const before = await tx.kennel.findUniqueOrThrow({ where: { id: kennelId } });
  if (before.state === KennelState.Occupied) return;

  await tx.kennel.update({ where: { id: kennelId }, data: { state: KennelState.Occupied } });
  await logActivity(tx, {
    entityType: ActivityEntityType.Kennel,
    entityId: kennelId,
    action: ActivityAction.Update,
    actorId,
    description: `State changed from ${before.state} to ${KennelState.Occupied}`,
  });
}

/** Flips a kennel to Ready (checklist reset step), logging the state change when it changes. */
export async function markKennelReady(
  tx: Tx,
  kennelId: number,
  actorId?: string | null,
): Promise<void> {
  const before = await tx.kennel.findUniqueOrThrow({ where: { id: kennelId } });
  if (before.state === KennelState.Ready) return;

  await tx.kennel.update({ where: { id: kennelId }, data: { state: KennelState.Ready } });
  await logActivity(tx, {
    entityType: ActivityEntityType.Kennel,
    entityId: kennelId,
    action: ActivityAction.Update,
    actorId,
    description: `State changed from ${before.state} to ${KennelState.Ready}`,
  });
}
