import { KennelState } from "shared/constants/kennelState.ts";
import { AnnouncementType } from "shared/constants/announcementType.ts";
import type { Prisma } from "../generated/prisma/client.ts";

export class KennelResetNotFoundError extends Error {}
export class KennelResetConflictError extends Error {}

type Tx = Prisma.TransactionClient;

/**
 * Flips a kennel to NeedsReset and ensures exactly one open KennelNeedsReset
 * announcement exists for it. Every place in the app that sets a kennel to
 * NeedsReset must go through this (rather than a raw kennel.update) so the
 * kennel always has a completable action on the Announcements page — there's
 * no other way to bring a kennel back to Ready now that the shift report's
 * generic "Kennels reset this shift" checklist is gone.
 */
export async function markKennelNeedsReset(tx: Tx, kennelId: number): Promise<void> {
  await tx.kennel.update({ where: { id: kennelId }, data: { state: KennelState.NeedsReset } });

  const alreadyOpen = await tx.announcement.findFirst({
    where: { type: AnnouncementType.KennelNeedsReset, kennelId, resolved: false },
  });
  if (alreadyOpen) return;

  await tx.announcement.create({ data: { type: AnnouncementType.KennelNeedsReset, kennelId } });
}

/** Completes a kennel's reset from the Announcements page: flips it back to
 * Ready and resolves its open KennelNeedsReset announcement. */
export async function completeKennelReset(
  tx: Tx,
  args: { kennelId: number; actorId: string },
): Promise<void> {
  const announcement = await tx.announcement.findFirst({
    where: { type: AnnouncementType.KennelNeedsReset, kennelId: args.kennelId, resolved: false },
  });
  if (!announcement) {
    throw new KennelResetNotFoundError(`No open reset announcement for kennel ${args.kennelId}`);
  }

  await tx.kennel.update({ where: { id: args.kennelId }, data: { state: KennelState.Ready } });
  await tx.announcement.update({
    where: { id: announcement.id },
    data: { resolved: true, resolvedAt: new Date(), resolvedById: args.actorId },
  });
}

/** Reverts a completed kennel reset: flips the kennel back to NeedsReset and
 * reopens the announcement completeKennelReset resolved. */
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

  const announcement = await tx.announcement.findFirst({
    where: { type: AnnouncementType.KennelNeedsReset, kennelId: args.kennelId, resolved: true },
    orderBy: [{ resolvedAt: "desc" }, { id: "desc" }],
  });
  if (!announcement) {
    throw new KennelResetNotFoundError(
      `No resolved reset announcement for kennel ${args.kennelId}`,
    );
  }

  await tx.kennel.update({ where: { id: args.kennelId }, data: { state: KennelState.NeedsReset } });
  await tx.announcement.update({
    where: { id: announcement.id },
    data: { resolved: false, resolvedAt: null, resolvedById: null },
  });
}
