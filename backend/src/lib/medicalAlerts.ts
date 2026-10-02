import { AnnouncementType } from "shared/constants/announcementType.ts";
import { DewormerStatus } from "shared/constants/dewormerStatus.ts";
import type { Prisma } from "../generated/prisma/client.ts";

type Tx = Prisma.TransactionClient;

async function resolveOpenAnnouncements(
  tx: Tx,
  args: { type: AnnouncementType; catId: number; actorId?: string },
): Promise<void> {
  await tx.announcement.updateMany({
    where: { type: args.type, catId: args.catId, resolved: false },
    data: { resolved: true, resolvedAt: new Date(), resolvedById: args.actorId ?? null },
  });
}

/**
 * Ensures a Cat's DewormerDue announcement matches its current dewormerStatus:
 * exactly one open announcement while Due, resolved once Given. Call this after
 * any write that can change dewormerStatus (cat creation, cat edit, marking
 * given from the announcement) rather than touching the Announcement table
 * directly, mirroring markKennelNeedsReset's guarded-create pattern in
 * kennelResets.ts.
 */
export async function syncDewormerAnnouncement(
  tx: Tx,
  args: { catId: number; actorId?: string },
): Promise<void> {
  const cat = await tx.cat.findUniqueOrThrow({ where: { id: args.catId } });

  if (cat.dewormerStatus !== DewormerStatus.Due) {
    await resolveOpenAnnouncements(tx, {
      type: AnnouncementType.DewormerDue,
      catId: args.catId,
      actorId: args.actorId,
    });
    return;
  }

  const alreadyOpen = await tx.announcement.findFirst({
    where: { type: AnnouncementType.DewormerDue, catId: args.catId, resolved: false },
  });
  if (alreadyOpen) return;

  await tx.announcement.create({
    data: { type: AnnouncementType.DewormerDue, catId: args.catId },
  });
}

/**
 * Ensures a Cat's ProbioticNeeded announcement matches its current
 * needsProbiotic flag: exactly one open announcement while set, resolved once
 * an Admin clears it. Same guarded-create shape as syncDewormerAnnouncement.
 */
export async function syncProbioticAnnouncement(
  tx: Tx,
  args: { catId: number; actorId?: string },
): Promise<void> {
  const cat = await tx.cat.findUniqueOrThrow({ where: { id: args.catId } });

  if (!cat.needsProbiotic) {
    await resolveOpenAnnouncements(tx, {
      type: AnnouncementType.ProbioticNeeded,
      catId: args.catId,
      actorId: args.actorId,
    });
    return;
  }

  const alreadyOpen = await tx.announcement.findFirst({
    where: { type: AnnouncementType.ProbioticNeeded, catId: args.catId, resolved: false },
  });
  if (alreadyOpen) return;

  await tx.announcement.create({
    data: { type: AnnouncementType.ProbioticNeeded, catId: args.catId },
  });
}

export interface ProbioticDoseLogEntry {
  loggedAt: Date;
  loggedBy: string;
}

/** Logs a probiotic dose for a Cat, from the "Log dose" action on its
 * ProbioticNeeded announcement. Doesn't touch needsProbiotic or the
 * announcement itself — only an Admin clearing the flag resolves that. */
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
