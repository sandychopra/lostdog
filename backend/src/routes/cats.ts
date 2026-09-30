import { Router, type Response } from "express";
import { createCatSchema, updateCatSchema, updateGroupedCatSchema } from "shared/schemas/cats.ts";
import { changeCatStatusSchema, returnToRccSchema } from "shared/schemas/catStatus.ts";
import { DewormerStatus } from "shared/constants/dewormerStatus.ts";
import { KennelState } from "shared/constants/kennelState.ts";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.ts";
import { requireAdmin } from "../middleware/requireAdmin.ts";
import { validate } from "../lib/validate.ts";
import { prisma } from "../lib/prisma.ts";
import {
  changeCatStatus,
  confirmPickup,
  createCatWithArrivalAnnouncement,
  InvalidCatStatusTransitionError,
  InvalidPickupError,
  returnCatToRcc,
} from "../lib/catStatus.ts";
import { markKennelNeedsReset } from "../lib/kennelResets.ts";
import { syncDewormerAnnouncement, syncProbioticAnnouncement } from "../lib/medicalAlerts.ts";

const router = Router();

const catInclude = {
  kennel: { select: { id: true, number: true } },
  group: {
    select: { id: true, bonded: true, kennel: { select: { id: true, number: true } } },
  },
  litter: { select: { id: true, cats: { select: { id: true, name: true } } } },
} as const;

router.get("/", requireAuth, async (_req, res: Response) => {
  const cats = await prisma.cat.findMany({
    where: { active: true },
    include: catInclude,
    orderBy: { name: "asc" },
  });

  // "Last probiotic given" has no dedicated dose-log table — it's derived from
  // the most recent probiotic-given CatEntry/GroupEntryCatDetail per cat.
  // GroupEntryCatDetail has no timestamp of its own, so its parent CatEntry's
  // createdAt is the timestamp used for a group dose too.
  const doses = await prisma.$queryRaw<{ catId: number; lastGivenAt: Date }[]>`
    SELECT cat_id AS "catId", MAX(given_at) AS "lastGivenAt" FROM (
      SELECT cat_id, created_at AS given_at
      FROM cat_entry
      WHERE entry_type = 'Individual' AND probiotic_given = true
      UNION ALL
      SELECT gd.cat_id, ce.created_at AS given_at
      FROM group_entry_cat_detail gd
      JOIN cat_entry ce ON ce.id = gd.cat_entry_id
      WHERE gd.probiotic_given = true
    ) doses
    GROUP BY cat_id
  `;
  const lastGivenByCatId = new Map(doses.map((dose) => [dose.catId, dose.lastGivenAt]));

  res.json({
    cats: cats.map((cat) => ({
      ...cat,
      lastProbioticGivenAt: lastGivenByCatId.get(cat.id) ?? null,
    })),
  });
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
    if (data.kennelId !== undefined) {
      await tx.kennel.update({
        where: { id: data.kennelId },
        data: { state: KennelState.Occupied },
      });
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
    await tx.kennel.update({
      where: { id: data.kennelId },
      data: { state: KennelState.Occupied },
    });
    if (kennelChanged && existing.kennelId !== null) {
      await markKennelNeedsReset(tx, existing.kennelId);
    }
    await syncDewormerAnnouncement(tx, { catId: id, actorId });
    await syncProbioticAnnouncement(tx, { catId: id, actorId });
    return updated;
  });

  res.json({ cat });
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res: Response) => {
  const id = Number(req.params.id);

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
    if (existing.kennelId !== null) {
      await markKennelNeedsReset(tx, existing.kennelId);
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
    await syncDewormerAnnouncement(tx, { catId: id, actorId });
    return updated;
  });

  res.json({ cat });
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
