import { Router, type Response } from "express";
import {
  createShiftReportSchema,
  updateShiftReportSchema,
  type CreateShiftReportInput,
  type GroupEntryCatDetailInput,
} from "shared/schemas/shiftReports.ts";
import { CatEntryType } from "shared/constants/catEntryType.ts";
import { Role } from "shared/constants/role.ts";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.ts";
import { requireAdmin } from "../middleware/requireAdmin.ts";
import { validate } from "../lib/validate.ts";
import { prisma } from "../lib/prisma.ts";
import { storage } from "../lib/storage.ts";
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
  kennelsStatus: { include: { kennel: { select: { id: true, number: true } } } },
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

// Runs every existence/membership check before any write — returns false (and
// has already written the error response) if something doesn't check out.
async function validateReferences(data: CreateShiftReportInput, res: Response): Promise<boolean> {
  const catIds = collectReferencedCatIds(data);
  const groupIds = collectReferencedGroupIds(data);
  const kennelIds = [...new Set(data.kennelsStatus.map((k) => k.kennelId))];

  const [cats, groups, kennels] = await Promise.all([
    catIds.length > 0 ? prisma.cat.findMany({ where: { id: { in: catIds } } }) : [],
    groupIds.length > 0
      ? prisma.group.findMany({ where: { id: { in: groupIds } }, include: { cats: true } })
      : [],
    kennelIds.length > 0 ? prisma.kennel.findMany({ where: { id: { in: kennelIds } } }) : [],
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

  const shiftReport = await prisma.$transaction(async (tx) => {
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
        kennelsStatus: {
          create: data.kennelsStatus.map((k) => ({
            kennelId: k.kennelId,
            reportedState: k.reportedState,
          })),
        },
      },
    });

    return tx.shiftReport.findUniqueOrThrow({
      where: { id: created.id },
      include: shiftReportInclude,
    });
  });

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

      await tx.shiftReportKennelStatus.deleteMany({ where: { shiftReportId: id } });
      if (data.kennelsStatus.length > 0) {
        await tx.shiftReportKennelStatus.createMany({
          data: data.kennelsStatus.map((k) => ({
            shiftReportId: id,
            kennelId: k.kennelId,
            reportedState: k.reportedState,
          })),
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
    },
    { timeout: 15_000 },
  );

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
