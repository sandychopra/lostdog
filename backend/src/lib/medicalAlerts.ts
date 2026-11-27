import { NotificationType } from "shared/constants/notificationType.ts";
import { DewormerStatus } from "shared/constants/dewormerStatus.ts";
import type { Prisma } from "../generated/prisma/client.ts";

type Tx = Prisma.TransactionClient;

async function resolveOpenNotifications(
  tx: Tx,
  args: { type: NotificationType; catId: number; actorId?: string },
): Promise<void> {
  await tx.notification.updateMany({
    where: { type: args.type, catId: args.catId, resolved: false },
    data: { resolved: true, resolvedAt: new Date(), resolvedById: args.actorId ?? null },
  });
}

function dateKey(date: Date | null | undefined): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

/**
 * Keeps a Cat's DewormerDue notification in step with its dewormer fields: one
 * opens when the dewormer becomes Due with a due date, and any open one is
 * resolved once it's no longer Due (Not needed / Given). Call this after any
 * write that can change dewormerStatus/dewormerDueDate (cat creation, cat edit,
 * marking given) rather than touching the Notification table directly.
 *
 * `previous` is the cat's dewormer fields before the write (omit for a new
 * cat). A new notification is only opened when those fields actually changed,
 * so a card someone marked "Not relevant" doesn't reappear on an unrelated
 * edit. The feed itself hides the card until the due date.
 */
export async function syncDewormerNotification(
  tx: Tx,
  args: {
    catId: number;
    actorId?: string;
    previous?: { dewormerStatus: string; dewormerDueDate: Date | null };
  },
): Promise<void> {
  const cat = await tx.cat.findUniqueOrThrow({ where: { id: args.catId } });

  if (cat.dewormerStatus !== DewormerStatus.Due || cat.dewormerDueDate === null) {
    await resolveOpenNotifications(tx, {
      type: NotificationType.DewormerDue,
      catId: args.catId,
      actorId: args.actorId,
    });
    return;
  }

  const changed =
    !args.previous ||
    args.previous.dewormerStatus !== cat.dewormerStatus ||
    dateKey(args.previous.dewormerDueDate) !== dateKey(cat.dewormerDueDate);
  if (!changed) return;

  const alreadyOpen = await tx.notification.findFirst({
    where: { type: NotificationType.DewormerDue, catId: args.catId, resolved: false },
  });
  if (alreadyOpen) return;

  await tx.notification.create({
    data: { type: NotificationType.DewormerDue, catId: args.catId },
  });
}

/**
 * Keeps a Cat's ProbioticNeeded notification in step with its needsProbiotic
 * flag: one opens when the flag is turned on, and it's resolved once an Admin
 * clears it. Same `previous` rule as syncDewormerNotification.
 */
export async function syncProbioticNotification(
  tx: Tx,
  args: { catId: number; actorId?: string; previous?: { needsProbiotic: boolean } },
): Promise<void> {
  const cat = await tx.cat.findUniqueOrThrow({ where: { id: args.catId } });

  if (!cat.needsProbiotic) {
    await resolveOpenNotifications(tx, {
      type: NotificationType.ProbioticNeeded,
      catId: args.catId,
      actorId: args.actorId,
    });
    return;
  }

  if (args.previous && args.previous.needsProbiotic === cat.needsProbiotic) return;

  const alreadyOpen = await tx.notification.findFirst({
    where: { type: NotificationType.ProbioticNeeded, catId: args.catId, resolved: false },
  });
  if (alreadyOpen) return;

  await tx.notification.create({
    data: { type: NotificationType.ProbioticNeeded, catId: args.catId },
  });
}

export interface ProbioticDoseLogEntry {
  loggedAt: Date;
  loggedBy: string;
}

/** Logs a probiotic dose for a Cat, from the "Log dose" action on its
 * ProbioticNeeded notification. Doesn't touch needsProbiotic or the
 * notification itself — only an Admin clearing the flag resolves that. */
export async function logProbioticDose(
  tx: Tx,
  args: { catId: number; actorId: string },
): Promise<void> {
  await tx.probioticDose.create({
    data: { catId: args.catId, loggedById: args.actorId },
  });
}

/**
 * Every logged probiotic dose for a cat within [since, until] (inclusive),
 * newest first.
 */
export async function getProbioticDoseLog(
  tx: Tx,
  args: { catId: number; since: Date; until?: Date },
): Promise<ProbioticDoseLogEntry[]> {
  const doses = await tx.probioticDose.findMany({
    where: {
      catId: args.catId,
      loggedAt: { gte: args.since, ...(args.until && { lte: args.until }) },
    },
    select: { loggedAt: true, loggedBy: { select: { name: true } } },
    orderBy: { loggedAt: "desc" },
  });

  return doses.map((dose) => ({ loggedAt: dose.loggedAt, loggedBy: dose.loggedBy.name }));
}
