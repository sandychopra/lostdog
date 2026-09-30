import { AnnouncementType } from "shared/constants/announcementType.ts";
import { DewormerStatus } from "shared/constants/dewormerStatus.ts";
import { CatEntryType } from "shared/constants/catEntryType.ts";
import { ShiftType } from "shared/constants/shiftType.ts";
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
 * given, a shift report's dewormer-given checkbox) rather than touching the
 * Announcement table directly, mirroring markKennelNeedsReset's guarded-create
 * pattern in kennelResets.ts.
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
  date: Date;
  shiftType: ShiftType;
  submittedBy: string;
  // The CatEntry's own createdAt — precise to the second, unlike `date` (the
  // shift report's calendar date) — used for the 24h-since-last-dose Overdue
  // rule, same precision cats.ts's existing lastProbioticGivenAt query uses.
  givenAt: Date;
}

// Morning/MidDay/Evening in chronological shift order, for sorting doses given
// on the same date — ShiftType's declaration order already matches this, but
// spelling it out here doesn't depend on that staying true.
const SHIFT_ORDER: Record<ShiftType, number> = {
  [ShiftType.Morning]: 0,
  [ShiftType.MidDay]: 1,
  [ShiftType.Evening]: 2,
};

function startOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function endOfDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Every logged probiotic dose for a cat within [since, until] (inclusive),
 * merged from the Individual CatEntry and GroupEntryCatDetail variants (a
 * group entry's per-cat "probiotic given" checkbox), each read off its parent
 * ShiftReport's date/shift/author — there's no separate dose-log table, same
 * as the existing lastProbioticGivenAt derivation in routes/cats.ts. `since`/
 * `until` are widened to whole calendar days before filtering, since
 * ShiftReport.date is date-only — comparing it directly against `since`'s exact
 * time of day would wrongly drop a dose logged earlier the same day the flag
 * was turned on.
 */
export async function getProbioticDoseLog(
  tx: Tx,
  args: { catId: number; since: Date; until?: Date },
): Promise<ProbioticDoseLogEntry[]> {
  const dateFilter = {
    gte: startOfDay(args.since),
    ...(args.until && { lte: endOfDay(args.until) }),
  };

  const [individualEntries, groupDetails] = await Promise.all([
    tx.catEntry.findMany({
      where: {
        catId: args.catId,
        entryType: CatEntryType.Individual,
        probioticGiven: true,
        shiftReport: { date: dateFilter },
      },
      select: {
        createdAt: true,
        shiftReport: { select: { date: true, shiftType: true, author: { select: { name: true } } } },
      },
    }),
    tx.groupEntryCatDetail.findMany({
      where: {
        catId: args.catId,
        probioticGiven: true,
        catEntry: { shiftReport: { date: dateFilter } },
      },
      select: {
        catEntry: {
          select: {
            createdAt: true,
            shiftReport: { select: { date: true, shiftType: true, author: { select: { name: true } } } },
          },
        },
      },
    }),
  ]);

  const doses: ProbioticDoseLogEntry[] = [
    ...individualEntries.map((entry) => ({
      date: entry.shiftReport.date,
      shiftType: entry.shiftReport.shiftType,
      submittedBy: entry.shiftReport.author.name,
      givenAt: entry.createdAt,
    })),
    ...groupDetails.map((detail) => ({
      date: detail.catEntry.shiftReport.date,
      shiftType: detail.catEntry.shiftReport.shiftType,
      submittedBy: detail.catEntry.shiftReport.author.name,
      givenAt: detail.catEntry.createdAt,
    })),
  ];

  return doses.sort((a, b) => {
    const dateDiff = a.date.getTime() - b.date.getTime();
    return dateDiff !== 0 ? dateDiff : SHIFT_ORDER[a.shiftType] - SHIFT_ORDER[b.shiftType];
  });
}
