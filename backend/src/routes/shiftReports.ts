import { Router, type Response } from "express";
import {
  createShiftReportSchema,
  updateShiftReportSchema,
  type CreateShiftReportInput,
  type GroupEntryCatDetailInput,
} from "shared/schemas/shiftReports.ts";
import { CatEntryType } from "shared/constants/catEntryType.ts";
import { KennelState } from "shared/constants/kennelState.ts";
import { DewormerStatus } from "shared/constants/dewormerStatus.ts";
import { CatStatus } from "shared/constants/catStatus.ts";
import { TaskState } from "shared/constants/taskState.ts";
import { Role } from "shared/constants/role.ts";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.ts";
import { requireAdmin } from "../middleware/requireAdmin.ts";
import { validate } from "../lib/validate.ts";
import { prisma } from "../lib/prisma.ts";
import { storage } from "../lib/storage.ts";
import { completeSignTask, confirmPickup, InvalidPickupError } from "../lib/catStatus.ts";
import { completeKennelMoveRequest, InvalidKennelMoveError } from "../lib/kennelMoveRequests.ts";
import {
  completeChecklistAction,
  InvalidChecklistActionError,
} from "../lib/kennelPrepChecklists.ts";
import { Prisma } from "../generated/prisma/client.ts";

const router = Router();

const shiftReportInclude = {
  author: { select: { id: true, name: true } },
  catEntries: {
    orderBy: { id: "asc" },
    include: {
      cat: { select: { id: true, name: true } },
      group: { select: { id: true, bonded: true, cats: { select: { id: true, name: true } } } },
      groupDetails: { include: { cat: { select: { id: true, name: true } } } },
      photos: { include: { tags: { include: { cat: { select: { id: true, name: true } } } } } },
    },
  },
  meetAndGreets: {
    orderBy: { id: "asc" },
    include: { cats: { include: { cat: { select: { id: true, name: true } } } } },
  },
  playGroups: {
    orderBy: { id: "asc" },
    include: { cats: { include: { cat: { select: { id: true, name: true } } } } },
  },
  kennelsReset: { include: { kennel: { select: { id: true, number: true } } } },
  kennelsFlagged: { include: { kennel: { select: { id: true, number: true } } } },
  // Report-level photos only — cat-entry-scoped photos are nested under
  // catEntries above instead, so a photo never appears in both places.
  photos: {
    where: { catEntryId: null },
    include: {
      tags: { include: { cat: { select: { id: true, name: true } } } },
      uploadedBy: { select: { id: true, name: true } },
    },
  },
} as const;

function detailFields(detail: GroupEntryCatDetailInput) {
  return {
    wetFoodAmount: detail.wetFoodAmount,
    wetFoodBrand: detail.wetFoodBrand,
    snackTreat: detail.snackTreat,
    snackTreatNote: detail.snackTreatNote,
    foodNotes: detail.foodNotes,
    medicalNotes: detail.medicalNotes,
    dewormerGiven: detail.dewormerGiven,
    probioticGiven: detail.probioticGiven,
    behaviorNotes: detail.behaviorNotes,
    otherNotes: detail.otherNotes,
    nailTrim: detail.nailTrim,
  };
}

function buildCatEntryCreate(
  entry: CreateShiftReportInput["catEntries"][number],
): Prisma.CatEntryUncheckedCreateWithoutShiftReportInput {
  if (entry.entryType === CatEntryType.Individual) {
    return {
      entryType: entry.entryType,
      catId: entry.catId,
      fecalScore: entry.fecalScore ?? null,
      pee: entry.pee,
      peePooNotes: entry.peePooNotes,
      dryFoodAmount: entry.dryFoodAmount,
      wetFoodAmount: entry.wetFoodAmount,
      wetFoodBrand: entry.wetFoodBrand,
      foodNotes: entry.foodNotes,
      snackTreat: entry.snackTreat,
      snackTreatNote: entry.snackTreatNote,
      medicalNotes: entry.medicalNotes,
      dewormerGiven: entry.dewormerGiven,
      probioticGiven: entry.probioticGiven,
      behaviorNotes: entry.behaviorNotes,
      otherNotes: entry.otherNotes,
      nailTrim: entry.nailTrim,
    };
  }

  return {
    entryType: entry.entryType,
    groupId: entry.groupId,
    fecalScore: entry.fecalScore ?? null,
    pee: entry.pee,
    peePooNotes: entry.peePooNotes,
    dryFoodAmount: entry.dryFoodAmount,
    foodNotes: entry.foodNotes,
    otherNotes: entry.otherNotes,
    groupDetails: {
      create: entry.catDetails.map((detail) => ({
        catId: detail.catId,
        ...detailFields(detail),
      })),
    },
  };
}

function collectReferencedCatIds(data: CreateShiftReportInput): number[] {
  const ids = new Set<number>();
  for (const entry of data.catEntries) {
    if (entry.entryType === CatEntryType.Individual) {
      ids.add(entry.catId);
    } else {
      for (const detail of entry.catDetails) ids.add(detail.catId);
    }
  }
  for (const meetAndGreet of data.meetAndGreets) {
    for (const id of meetAndGreet.catIds) ids.add(id);
  }
  for (const playGroup of data.playGroups) {
    for (const id of playGroup.catIds) ids.add(id);
  }
  return [...ids];
}

function collectReferencedGroupIds(data: CreateShiftReportInput): number[] {
  return [
    ...new Set(
      data.catEntries
        .filter((entry) => entry.entryType === CatEntryType.Group)
        .map((entry) => entry.groupId),
    ),
  ];
}

function collectDewormerGivenCatIds(data: CreateShiftReportInput): number[] {
  const ids = new Set<number>();
  for (const entry of data.catEntries) {
    if (entry.entryType === CatEntryType.Individual) {
      if (entry.dewormerGiven) ids.add(entry.catId);
    } else {
      for (const detail of entry.catDetails) {
        if (detail.dewormerGiven) ids.add(detail.catId);
      }
    }
  }
  return [...ids];
}

// The four completion helpers (completeSignTask/confirmPickup/completeKennelMoveRequest/
// completeChecklistAction) each throw their own error class for a business-rule violation
// that validateReferences can't catch up front (e.g. state changed underneath the request
// between validation and the transaction) — surfaced here as a 409 rather than an
// unhandled 500, the same pattern cats.ts uses for InvalidCatStatusTransitionError.
function isCompletionError(err: unknown): err is Error {
  return (
    err instanceof InvalidPickupError ||
    err instanceof InvalidKennelMoveError ||
    err instanceof InvalidChecklistActionError
  );
}

// Runs every existence/membership check before any write — returns false (and
// has already written the error response) if something doesn't check out.
async function validateReferences(data: CreateShiftReportInput, res: Response): Promise<boolean> {
  const catIds = [...new Set([...collectReferencedCatIds(data), ...data.pickupsConfirmedIds])];
  const groupIds = collectReferencedGroupIds(data);
  const kennelIds = [...new Set([...data.kennelsResetIds, ...data.kennelsFlaggedIds])];

  const [cats, groups, kennels, signTasks, kennelMoveRequests, checklistActions] =
    await Promise.all([
      catIds.length > 0 ? prisma.cat.findMany({ where: { id: { in: catIds } } }) : [],
      groupIds.length > 0
        ? prisma.group.findMany({ where: { id: { in: groupIds } }, include: { cats: true } })
        : [],
      kennelIds.length > 0 ? prisma.kennel.findMany({ where: { id: { in: kennelIds } } }) : [],
      data.signTasksCompletedIds.length > 0
        ? prisma.signTask.findMany({ where: { id: { in: data.signTasksCompletedIds } } })
        : [],
      data.kennelMoveRequestsCompletedIds.length > 0
        ? prisma.kennelMoveRequest.findMany({
            where: { id: { in: data.kennelMoveRequestsCompletedIds } },
          })
        : [],
      data.checklistActionsCompletedIds.length > 0
        ? prisma.checklistAction.findMany({
            where: { id: { in: data.checklistActionsCompletedIds } },
          })
        : [],
    ]);

  if (cats.length !== catIds.length) {
    res.status(404).json({ error: "One or more cats not found" });
    return false;
  }
  if (groups.length !== groupIds.length) {
    res.status(404).json({ error: "One or more groups not found" });
    return false;
  }
  if (kennels.length !== kennelIds.length) {
    res.status(404).json({ error: "One or more kennels not found" });
    return false;
  }
  if (signTasks.length !== data.signTasksCompletedIds.length) {
    res.status(404).json({ error: "One or more sign tasks not found" });
    return false;
  }
  if (signTasks.some((task) => task.state !== TaskState.Open)) {
    res.status(409).json({ error: "One or more sign tasks are no longer open" });
    return false;
  }
  if (kennelMoveRequests.length !== data.kennelMoveRequestsCompletedIds.length) {
    res.status(404).json({ error: "One or more kennel move requests not found" });
    return false;
  }
  if (kennelMoveRequests.some((request) => request.state !== TaskState.Open)) {
    res.status(409).json({ error: "One or more kennel move requests are no longer open" });
    return false;
  }
  if (checklistActions.length !== data.checklistActionsCompletedIds.length) {
    res.status(404).json({ error: "One or more checklist actions not found" });
    return false;
  }
  if (checklistActions.some((action) => action.completed)) {
    res.status(409).json({ error: "One or more checklist actions are already completed" });
    return false;
  }

  const catById = new Map(cats.map((cat) => [cat.id, cat]));
  for (const catId of data.pickupsConfirmedIds) {
    const cat = catById.get(catId)!;
    if (cat.status !== CatStatus.Adopted || cat.pickupAt === null) {
      res.status(409).json({ error: "One or more cats are not adopted with a scheduled pickup" });
      return false;
    }
  }

  const groupById = new Map(groups.map((group) => [group.id, group]));
  for (const entry of data.catEntries) {
    if (entry.entryType !== CatEntryType.Group) continue;
    const group = groupById.get(entry.groupId)!;
    const memberIds = new Set(group.cats.map((cat) => cat.id));
    for (const detail of entry.catDetails) {
      if (!memberIds.has(detail.catId)) {
        res.status(409).json({ error: "One or more cats are not members of this group" });
        return false;
      }
    }
  }

  return true;
}

router.get("/", requireAuth, async (_req, res: Response) => {
  const shiftReports = await prisma.shiftReport.findMany({
    include: shiftReportInclude,
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });

  res.json({ shiftReports });
});

router.get("/:id", requireAuth, async (req, res: Response) => {
  const id = Number(req.params.id);

  const shiftReport = await prisma.shiftReport.findUnique({
    where: { id },
    include: shiftReportInclude,
  });
  if (!shiftReport) {
    res.status(404).json({ error: "Shift report not found" });
    return;
  }

  res.json({ shiftReport });
});

router.post("/", requireAuth, async (req, res: Response) => {
  const data = validate(createShiftReportSchema, req.body, res);
  if (!data) return;

  if (!(await validateReferences(data, res))) return;

  const authorId = (req as AuthedRequest).session.user.id;

  let shiftReport;
  try {
    shiftReport = await prisma.$transaction(async (tx) => {
      const created = await tx.shiftReport.create({
        data: {
          authorId,
          shiftType: data.shiftType,
          date: data.date,
          isSplitShift: data.isSplitShift,
          splitShiftPosition: data.splitShiftPosition ?? null,
          cleaningNotes: data.cleaningNotes,
          suppliesNotes: data.suppliesNotes,
          kennelNotes: data.kennelNotes,
          otherNotes: data.otherNotes,
          catEntries: { create: data.catEntries.map(buildCatEntryCreate) },
          meetAndGreets: {
            create: data.meetAndGreets.map((meetAndGreet) => ({
              note: meetAndGreet.note,
              cats: { create: meetAndGreet.catIds.map((catId) => ({ catId })) },
            })),
          },
          playGroups: {
            create: data.playGroups.map((playGroup) => ({
              note: playGroup.note,
              cats: { create: playGroup.catIds.map((catId) => ({ catId })) },
            })),
          },
          kennelsReset: { create: data.kennelsResetIds.map((kennelId) => ({ kennelId })) },
          kennelsFlagged: { create: data.kennelsFlaggedIds.map((kennelId) => ({ kennelId })) },
        },
      });

      if (data.kennelsResetIds.length > 0) {
        await tx.kennel.updateMany({
          where: { id: { in: data.kennelsResetIds } },
          data: { state: KennelState.Ready },
        });
      }
      if (data.kennelsFlaggedIds.length > 0) {
        await tx.kennel.updateMany({
          where: { id: { in: data.kennelsFlaggedIds } },
          data: { state: KennelState.NeedsReset },
        });
      }

      const dewormerCatIds = collectDewormerGivenCatIds(data);
      if (dewormerCatIds.length > 0) {
        await tx.cat.updateMany({
          where: { id: { in: dewormerCatIds } },
          data: { dewormerStatus: DewormerStatus.Given },
        });
      }

      for (const signTaskId of data.signTasksCompletedIds) {
        await completeSignTask(tx, { signTaskId, actorId: authorId, shiftReportId: created.id });
      }
      for (const catId of data.pickupsConfirmedIds) {
        await confirmPickup(tx, { catId, actorId: authorId, shiftReportId: created.id });
      }
      for (const kennelMoveRequestId of data.kennelMoveRequestsCompletedIds) {
        await completeKennelMoveRequest(tx, {
          kennelMoveRequestId,
          actorId: authorId,
          shiftReportId: created.id,
        });
      }
      const actionsToComplete = await tx.checklistAction.findMany({
        where: { id: { in: data.checklistActionsCompletedIds } },
        orderBy: [{ order: "asc" }, { id: "asc" }],
      });
      for (const action of actionsToComplete) {
        await completeChecklistAction(tx, { checklistActionId: action.id, actorId: authorId });
      }

      return tx.shiftReport.findUniqueOrThrow({
        where: { id: created.id },
        include: shiftReportInclude,
      });
    });
  } catch (err) {
    if (isCompletionError(err)) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }

  res.status(201).json({ shiftReport });
});

router.put("/:id", requireAuth, async (req, res: Response) => {
  const id = Number(req.params.id);
  const session = (req as AuthedRequest).session;

  const existing = await prisma.shiftReport.findUnique({
    where: { id },
    include: { catEntries: { select: { id: true, entryType: true } } },
  });
  if (!existing) {
    res.status(404).json({ error: "Shift report not found" });
    return;
  }
  if (existing.authorId !== session.user.id && session.user.role !== Role.Admin) {
    res.status(403).json({ error: "Only the report's author or an Admin can edit it" });
    return;
  }

  const data = validate(updateShiftReportSchema, req.body, res);
  if (!data) return;

  if (!(await validateReferences(data, res))) return;

  const existingEntryById = new Map(existing.catEntries.map((entry) => [entry.id, entry]));
  for (const entry of data.catEntries) {
    if (entry.id === undefined) continue;
    const existingEntry = existingEntryById.get(entry.id);
    if (!existingEntry) {
      res.status(404).json({ error: "Cat entry not found on this report" });
      return;
    }
    if (existingEntry.entryType !== entry.entryType) {
      res
        .status(409)
        .json({ error: "Cannot change a cat entry's type — remove and re-add instead" });
      return;
    }
  }

  const incomingIds = new Set(
    data.catEntries
      .map((entry) => entry.id)
      .filter((entryId): entryId is number => entryId !== undefined),
  );
  const removedEntryIds = existing.catEntries
    .map((entry) => entry.id)
    .filter((entryId) => !incomingIds.has(entryId));

  try {
    await prisma.$transaction(
      async (tx) => {
        if (removedEntryIds.length > 0) {
          await tx.catEntry.deleteMany({ where: { id: { in: removedEntryIds } } });
        }

        for (const entry of data.catEntries) {
          if (entry.id === undefined) {
            await tx.catEntry.create({
              data: { ...buildCatEntryCreate(entry), shiftReportId: id },
            });
            continue;
          }

          if (entry.entryType === CatEntryType.Individual) {
            await tx.catEntry.update({
              where: { id: entry.id },
              data: {
                catId: entry.catId,
                fecalScore: entry.fecalScore ?? null,
                pee: entry.pee,
                peePooNotes: entry.peePooNotes,
                dryFoodAmount: entry.dryFoodAmount,
                wetFoodAmount: entry.wetFoodAmount,
                wetFoodBrand: entry.wetFoodBrand,
                foodNotes: entry.foodNotes,
                snackTreat: entry.snackTreat,
                snackTreatNote: entry.snackTreatNote,
                medicalNotes: entry.medicalNotes,
                dewormerGiven: entry.dewormerGiven,
                probioticGiven: entry.probioticGiven,
                behaviorNotes: entry.behaviorNotes,
                otherNotes: entry.otherNotes,
                nailTrim: entry.nailTrim,
              },
            });
            continue;
          }

          await tx.catEntry.update({
            where: { id: entry.id },
            data: {
              groupId: entry.groupId,
              fecalScore: entry.fecalScore ?? null,
              pee: entry.pee,
              peePooNotes: entry.peePooNotes,
              dryFoodAmount: entry.dryFoodAmount,
              foodNotes: entry.foodNotes,
              otherNotes: entry.otherNotes,
            },
          });

          const currentDetails = await tx.groupEntryCatDetail.findMany({
            where: { catEntryId: entry.id },
            select: { catId: true },
          });
          const incomingCatIds = new Set(entry.catDetails.map((detail) => detail.catId));
          const droppedCatIds = currentDetails
            .map((detail) => detail.catId)
            .filter((catId) => !incomingCatIds.has(catId));

          if (droppedCatIds.length > 0) {
            await tx.groupEntryCatDetail.deleteMany({
              where: { catEntryId: entry.id, catId: { in: droppedCatIds } },
            });
          }

          for (const detail of entry.catDetails) {
            await tx.groupEntryCatDetail.upsert({
              where: { catEntryId_catId: { catEntryId: entry.id, catId: detail.catId } },
              create: { catEntryId: entry.id, catId: detail.catId, ...detailFields(detail) },
              update: detailFields(detail),
            });
          }
        }

        await tx.meetAndGreet.deleteMany({ where: { shiftReportId: id } });
        for (const meetAndGreet of data.meetAndGreets) {
          await tx.meetAndGreet.create({
            data: {
              shiftReportId: id,
              note: meetAndGreet.note,
              cats: { create: meetAndGreet.catIds.map((catId) => ({ catId })) },
            },
          });
        }

        await tx.playGroup.deleteMany({ where: { shiftReportId: id } });
        for (const playGroup of data.playGroups) {
          await tx.playGroup.create({
            data: {
              shiftReportId: id,
              note: playGroup.note,
              cats: { create: playGroup.catIds.map((catId) => ({ catId })) },
            },
          });
        }

        await tx.shiftReportKennelReset.deleteMany({ where: { shiftReportId: id } });
        if (data.kennelsResetIds.length > 0) {
          await tx.shiftReportKennelReset.createMany({
            data: data.kennelsResetIds.map((kennelId) => ({ shiftReportId: id, kennelId })),
          });
        }

        await tx.shiftReportKennelFlag.deleteMany({ where: { shiftReportId: id } });
        if (data.kennelsFlaggedIds.length > 0) {
          await tx.shiftReportKennelFlag.createMany({
            data: data.kennelsFlaggedIds.map((kennelId) => ({ shiftReportId: id, kennelId })),
          });
        }

        await tx.shiftReport.update({
          where: { id },
          data: {
            shiftType: data.shiftType,
            date: data.date,
            isSplitShift: data.isSplitShift,
            splitShiftPosition: data.splitShiftPosition ?? null,
            cleaningNotes: data.cleaningNotes,
            suppliesNotes: data.suppliesNotes,
            kennelNotes: data.kennelNotes,
            otherNotes: data.otherNotes,
          },
        });

        if (data.kennelsResetIds.length > 0) {
          await tx.kennel.updateMany({
            where: { id: { in: data.kennelsResetIds } },
            data: { state: KennelState.Ready },
          });
        }
        if (data.kennelsFlaggedIds.length > 0) {
          await tx.kennel.updateMany({
            where: { id: { in: data.kennelsFlaggedIds } },
            data: { state: KennelState.NeedsReset },
          });
        }

        const dewormerCatIds = collectDewormerGivenCatIds(data);
        if (dewormerCatIds.length > 0) {
          await tx.cat.updateMany({
            where: { id: { in: dewormerCatIds } },
            data: { dewormerStatus: DewormerStatus.Given },
          });
        }

        // Both arrays only ever list currently-open/eligible items in the first
        // place (validateReferences already re-checked that above), so this is
        // naturally additive-only — a previously-completed id won't reappear here.
        for (const signTaskId of data.signTasksCompletedIds) {
          await completeSignTask(tx, { signTaskId, actorId: session.user.id, shiftReportId: id });
        }
        for (const catId of data.pickupsConfirmedIds) {
          await confirmPickup(tx, { catId, actorId: session.user.id, shiftReportId: id });
        }
        for (const kennelMoveRequestId of data.kennelMoveRequestsCompletedIds) {
          await completeKennelMoveRequest(tx, {
            kennelMoveRequestId,
            actorId: session.user.id,
            shiftReportId: id,
          });
        }
        const actionsToComplete = await tx.checklistAction.findMany({
          where: { id: { in: data.checklistActionsCompletedIds } },
          orderBy: [{ order: "asc" }, { id: "asc" }],
        });
        for (const action of actionsToComplete) {
          await completeChecklistAction(tx, {
            checklistActionId: action.id,
            actorId: session.user.id,
          });
        }
      },
      { timeout: 15_000 },
    );
  } catch (err) {
    if (isCompletionError(err)) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }

  const shiftReport = await prisma.shiftReport.findUniqueOrThrow({
    where: { id },
    include: shiftReportInclude,
  });

  res.json({ shiftReport });
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res: Response) => {
  const id = Number(req.params.id);

  const existing = await prisma.shiftReport.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Shift report not found" });
    return;
  }

  const photos = await prisma.photo.findMany({
    where: { shiftReportId: id },
    select: { storageKey: true },
  });

  await prisma.shiftReport.delete({ where: { id } });

  // Storage isn't transactional with Postgres — best-effort cleanup after commit.
  await Promise.all(photos.map((photo) => storage.delete(photo.storageKey)));

  res.json({ message: "Shift report deleted" });
});

export default router;
