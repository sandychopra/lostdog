import { Router, type Response } from "express";
import { createCatSchema, updateCatSchema, updateGroupedCatSchema } from "shared/schemas/cats.ts";
import { changeCatStatusSchema, returnToRccSchema } from "shared/schemas/catStatus.ts";
import { DewormerStatus } from "shared/constants/dewormerStatus.ts";
import { ActivityAction, ActivityEntityType } from "shared/constants/activityLog.ts";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.ts";
import { requireAdmin } from "../middleware/requireAdmin.ts";
import { validate } from "../lib/validate.ts";
import { prisma } from "../lib/prisma.ts";
import { parsePaging, reportsInvolvingCat, submittedOnly } from "../lib/reportQueries.ts";
import type { Cat, Prisma } from "../generated/prisma/client.ts";
import {
  changeCatStatus,
  confirmPickup,
  createCatWithArrivalAnnouncement,
  InvalidCatStatusTransitionError,
  InvalidPickupError,
  returnCatToRcc,
} from "../lib/catStatus.ts";
import { markKennelNeedsReset, markKennelOccupied } from "../lib/kennelResets.ts";
import { describeChanges, logActivity } from "../lib/activityLog.ts";
import {
  syncDewormerAnnouncement,
  syncProbioticAnnouncement,
  logProbioticDose,
} from "../lib/medicalAlerts.ts";

const router = Router();

const catInclude = {
  kennel: { select: { id: true, number: true } },
  group: {
    select: { id: true, bonded: true, kennel: { select: { id: true, number: true } } },
  },
  litter: { select: { id: true, cats: { select: { id: true, name: true } } } },
} as const;

const LOGGED_CAT_FIELDS = [
  "name",
  "ageYears",
  "ageMonths",
  "sex",
  "colorPattern",
  "collarColor",
  "microchipNumber",
  "kennelId",
  "dewormerStatus",
  "needsProbiotic",
] as const;

async function logCatEdit(
  tx: Prisma.TransactionClient,
  before: Cat,
  after: Cat,
  actorId: string,
): Promise<void> {
  const description = describeChanges(before, after, LOGGED_CAT_FIELDS);
  if (!description) return;
  await logActivity(tx, {
    entityType: ActivityEntityType.Cat,
    entityId: after.id,
    action: ActivityAction.Update,
    actorId,
    description,
  });
}

router.get("/", requireAuth, async (req, res: Response) => {
  const includeInactive = req.query.includeInactive === "true";
  const cats = await prisma.cat.findMany({
    where: includeInactive ? {} : { active: true },
    include: catInclude,
    orderBy: { name: "asc" },
  });

  res.json({ cats });
});

router.get("/:id", requireAuth, async (req, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(404).json({ error: "Cat not found" });
    return;
  }

  const cat = await prisma.cat.findUnique({ where: { id }, include: catInclude });
  if (!cat) {
    res.status(404).json({ error: "Cat not found" });
    return;
  }

  res.json({ cat });
});

// Per-cat view of Submitted shift reports, newest first: this cat's own entry
// (or its per-cat details within a group entry), meet & greets and play groups
// it was tagged in, and photos tagged with it. Inactive cats work too.
router.get("/:id/history", requireAuth, async (req, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(404).json({ error: "Cat not found" });
    return;
  }

  const cat = await prisma.cat.findUnique({ where: { id }, select: { id: true } });
  if (!cat) {
    res.status(404).json({ error: "Cat not found" });
    return;
  }

  const reports = await prisma.shiftReport.findMany({
    where: { AND: [submittedOnly, reportsInvolvingCat(id)] },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    ...parsePaging(req.query),
    select: {
      id: true,
      date: true,
      shiftType: true,
      author: { select: { id: true, name: true } },
      catEntries: {
        where: { OR: [{ catId: id }, { groupDetails: { some: { catId: id } } }] },
        include: {
          group: { select: { id: true, cats: { select: { id: true, name: true } } } },
          groupDetails: { where: { catId: id } },
        },
      },
      meetAndGreets: {
        where: { cats: { some: { catId: id } } },
        include: { cats: { include: { cat: { select: { id: true, name: true } } } } },
      },
      playGroups: {
        where: { cats: { some: { catId: id } } },
        include: { cats: { include: { cat: { select: { id: true, name: true } } } } },
      },
      photos: { where: { tags: { some: { catId: id } } }, select: { id: true } },
    },
  });

  res.json({ history: reports });
});

router.post("/", requireAuth, requireAdmin, async (req, res: Response) => {
  const data = validate(createCatSchema, req.body, res);
  if (!data) return;

  if (data.kennelId !== undefined) {
    const kennel = await prisma.kennel.findUnique({ where: { id: data.kennelId } });
    if (!kennel) {
      res.status(404).json({ error: "Kennel not found" });
      return;
    }

    const [catCount, groupCount] = await Promise.all([
      prisma.cat.count({ where: { kennelId: data.kennelId } }),
      prisma.group.count({ where: { kennelId: data.kennelId } }),
    ]);
    if (catCount > 0 || groupCount > 0) {
      res.status(409).json({ error: "That kennel is already occupied" });
      return;
    }
  }

  const actorId = (req as AuthedRequest).session.user.id;

  const cat = await prisma.$transaction(async (tx) => {
    const created = await createCatWithArrivalAnnouncement(tx, data, { actorId });
    await logActivity(tx, {
      entityType: ActivityEntityType.Cat,
      entityId: created.id,
      action: ActivityAction.Create,
      actorId,
      description: `Cat "${created.name}" created`,
    });
    if (data.kennelId !== undefined) {
      await markKennelOccupied(tx, data.kennelId, actorId);
    }
    return tx.cat.findUniqueOrThrow({ where: { id: created.id }, include: catInclude });
  });

  res.status(201).json({ cat });
});

router.put("/:id", requireAuth, requireAdmin, async (req, res: Response) => {
  const id = Number(req.params.id);

  const existing = await prisma.cat.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Cat not found" });
    return;
  }

  const actorId = (req as AuthedRequest).session.user.id;

  if (existing.groupId !== null) {
    const data = validate(updateGroupedCatSchema, req.body, res);
    if (!data) return;

    const cat = await prisma.$transaction(async (tx) => {
      const updated = await tx.cat.update({ where: { id }, data, include: catInclude });
      await logCatEdit(tx, existing, updated, actorId);
      await syncDewormerAnnouncement(tx, { catId: id, actorId });
      await syncProbioticAnnouncement(tx, { catId: id, actorId });
      return updated;
    });
    res.json({ cat });
    return;
  }

  const data = validate(updateCatSchema, req.body, res);
  if (!data) return;

  const kennelChanged = data.kennelId !== existing.kennelId;

  if (kennelChanged) {
    const kennel = await prisma.kennel.findUnique({ where: { id: data.kennelId } });
    if (!kennel) {
      res.status(404).json({ error: "Kennel not found" });
      return;
    }

    const [catCount, groupCount] = await Promise.all([
      prisma.cat.count({ where: { kennelId: data.kennelId } }),
      prisma.group.count({ where: { kennelId: data.kennelId } }),
    ]);
    if (catCount > 0 || groupCount > 0) {
      res.status(409).json({ error: "That kennel is already occupied" });
      return;
    }
  }

  const cat = await prisma.$transaction(async (tx) => {
    const updated = await tx.cat.update({ where: { id }, data, include: catInclude });
    await logCatEdit(tx, existing, updated, actorId);
    await markKennelOccupied(tx, data.kennelId, actorId);
    if (kennelChanged && existing.kennelId !== null) {
      await markKennelNeedsReset(tx, existing.kennelId, actorId);
    }
    await syncDewormerAnnouncement(tx, { catId: id, actorId });
    await syncProbioticAnnouncement(tx, { catId: id, actorId });
    return updated;
  });

  res.json({ cat });
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res: Response) => {
  const id = Number(req.params.id);
  const actorId = (req as AuthedRequest).session.user.id;

  const existing = await prisma.cat.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Cat not found" });
    return;
  }
  if (existing.groupId !== null) {
    res.status(409).json({ error: "This cat is part of a group and can't be deleted here" });
    return;
  }

  await prisma.$transaction(async (tx) => {
    // SignTask.catId is a required FK with ON DELETE RESTRICT (unlike Announcement's,
    // which is SET NULL) — a hard delete has to clear these explicitly first.
    await tx.signTask.deleteMany({ where: { catId: id } });
    await tx.cat.delete({ where: { id } });
    await logActivity(tx, {
      entityType: ActivityEntityType.Cat,
      entityId: id,
      action: ActivityAction.Delete,
      actorId,
      description: `Cat "${existing.name}" deleted`,
    });
    if (existing.kennelId !== null) {
      await markKennelNeedsReset(tx, existing.kennelId, actorId);
    }
  });

  res.json({ message: "Cat deleted" });
});

router.patch("/:id/dewormer", requireAuth, async (req, res: Response) => {
  const id = Number(req.params.id);
  const actorId = (req as AuthedRequest).session.user.id;

  const existing = await prisma.cat.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Cat not found" });
    return;
  }

  const cat = await prisma.$transaction(async (tx) => {
    const updated = await tx.cat.update({
      where: { id },
      data: { dewormerStatus: DewormerStatus.Given },
      include: catInclude,
    });
    await logActivity(tx, {
      entityType: ActivityEntityType.Cat,
      entityId: id,
      action: ActivityAction.Update,
      actorId,
      description: "Dewormer marked as given",
    });
    await syncDewormerAnnouncement(tx, { catId: id, actorId });
    return updated;
  });

  res.json({ cat });
});

router.post("/:id/probiotic-dose", requireAuth, async (req, res: Response) => {
  const id = Number(req.params.id);
  const actorId = (req as AuthedRequest).session.user.id;

  const existing = await prisma.cat.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Cat not found" });
    return;
  }

  await prisma.$transaction((tx) => logProbioticDose(tx, { catId: id, actorId }));

  res.status(201).json({ message: "Dose logged" });
});

router.patch("/:id/status", requireAuth, requireAdmin, async (req, res: Response) => {
  const id = Number(req.params.id);

  const data = validate(changeCatStatusSchema, req.body, res);
  if (!data) return;

  const existing = await prisma.cat.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Cat not found" });
    return;
  }
  if (existing.groupId !== null) {
    res
      .status(409)
      .json({ error: "This cat is part of a group and can't have its status changed here" });
    return;
  }

  const actorId = (req as AuthedRequest).session.user.id;

  try {
    const cat = await prisma.$transaction(async (tx) => {
      await changeCatStatus(tx, {
        catId: id,
        targetStatus: data.status,
        pickupAt: data.pickupAt,
        actorId,
      });
      return tx.cat.findUniqueOrThrow({ where: { id }, include: catInclude });
    });
    res.json({ cat });
  } catch (err) {
    if (err instanceof InvalidCatStatusTransitionError) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.patch("/:id/returned-to-rcc", requireAuth, requireAdmin, async (req, res: Response) => {
  const id = Number(req.params.id);

  const data = validate(returnToRccSchema, req.body, res);
  if (!data) return;

  const existing = await prisma.cat.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Cat not found" });
    return;
  }
  if (!existing.active) {
    res.status(409).json({ error: "Cat is already inactive" });
    return;
  }
  if (existing.groupId !== null) {
    res
      .status(409)
      .json({ error: "This cat is part of a group and can't be returned to RCC here" });
    return;
  }

  const actorId = (req as AuthedRequest).session.user.id;

  const cat = await prisma.$transaction(async (tx) => {
    await returnCatToRcc(tx, { catId: id, reason: data.reason, actorId });
    return tx.cat.findUniqueOrThrow({ where: { id }, include: catInclude });
  });

  res.json({ cat });
});

// Completed directly from the Announcements page — any authenticated user.
router.patch("/:id/confirm-pickup", requireAuth, async (req, res: Response) => {
  const id = Number(req.params.id);
  const actorId = (req as AuthedRequest).session.user.id;

  const existing = await prisma.cat.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Cat not found" });
    return;
  }

  try {
    const cat = await prisma.$transaction(async (tx) => {
      await confirmPickup(tx, { catId: id, actorId });
      return tx.cat.findUniqueOrThrow({ where: { id }, include: catInclude });
    });
    res.json({ cat });
  } catch (err) {
    if (err instanceof InvalidPickupError) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }
});

export default router;
