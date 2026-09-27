import { Router, type Response } from "express";
import { createGroupSchema, updateGroupSchema } from "shared/schemas/groups.ts";
import { KennelState } from "shared/constants/kennelState.ts";
import { requireAuth } from "../middleware/requireAuth.ts";
import { requireAdmin } from "../middleware/requireAdmin.ts";
import { validate } from "../lib/validate.ts";
import { prisma } from "../lib/prisma.ts";

const router = Router();

router.post("/", requireAuth, requireAdmin, async (req, res: Response) => {
  const data = validate(createGroupSchema, req.body, res);
  if (!data) return;

  const cats = await prisma.cat.findMany({ where: { id: { in: data.catIds }, active: true } });
  if (cats.length !== data.catIds.length) {
    res.status(404).json({ error: "One or more cats not found" });
    return;
  }
  if (cats.some((cat) => cat.groupId !== null)) {
    res.status(409).json({ error: "One or more cats already belong to a group" });
    return;
  }

  const kennel = await prisma.kennel.findUnique({ where: { id: data.kennelId } });
  if (!kennel) {
    res.status(404).json({ error: "Kennel not found" });
    return;
  }

  const currentKennelIds = new Set(
    cats.map((cat) => cat.kennelId).filter((id): id is number => id !== null),
  );
  const destinationIsOwnKennel = currentKennelIds.has(data.kennelId);

  if (!destinationIsOwnKennel) {
    const [catCount, groupCount] = await Promise.all([
      prisma.cat.count({ where: { kennelId: data.kennelId } }),
      prisma.group.count({ where: { kennelId: data.kennelId } }),
    ]);
    if (catCount > 0 || groupCount > 0) {
      res.status(409).json({ error: "That kennel is already occupied" });
      return;
    }
  }

  const kennelsToVacate = [...currentKennelIds].filter((id) => id !== data.kennelId);

  const group = await prisma.$transaction(async (tx) => {
    const created = await tx.group.create({
      data: { kennelId: data.kennelId, bonded: data.bonded },
    });

    await tx.cat.updateMany({
      where: { id: { in: data.catIds } },
      data: { groupId: created.id, kennelId: null },
    });

    await tx.kennel.update({
      where: { id: data.kennelId },
      data: { state: KennelState.Occupied },
    });

    for (const kennelId of kennelsToVacate) {
      await tx.kennel.update({
        where: { id: kennelId },
        data: { state: KennelState.NeedsReset },
      });
    }

    return created;
  });

  res.status(201).json({ group });
});

router.put("/:id", requireAuth, requireAdmin, async (req, res: Response) => {
  const id = Number(req.params.id);

  const data = validate(updateGroupSchema, req.body, res);
  if (!data) return;

  const group = await prisma.group.findUnique({ where: { id } });
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  if (data.bonded) {
    const catCount = await prisma.cat.count({ where: { groupId: id } });
    if (catCount !== 2) {
      res.status(400).json({ error: "Bonded can only be set on a group of exactly two cats" });
      return;
    }
  }

  const updated = await prisma.group.update({ where: { id }, data: { bonded: data.bonded } });

  res.json({ group: updated });
});

router.delete("/:id/cats/:catId", requireAuth, requireAdmin, async (req, res: Response) => {
  const groupId = Number(req.params.id);
  const catId = Number(req.params.catId);

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  const cat = await prisma.cat.findUnique({ where: { id: catId } });
  if (!cat || cat.groupId !== groupId) {
    res.status(404).json({ error: "Cat not found in this group" });
    return;
  }

  const otherCats = await prisma.cat.findMany({
    where: { groupId, id: { not: catId } },
  });

  await prisma.$transaction(async (tx) => {
    await tx.cat.update({ where: { id: catId }, data: { groupId: null, kennelId: null } });

    if (otherCats.length === 1) {
      await tx.cat.update({
        where: { id: otherCats[0]!.id },
        data: { groupId: null, kennelId: group.kennelId },
      });
      await tx.group.delete({ where: { id: groupId } });
    }
  });

  res.json({ message: "Cat removed from group" });
});

export default router;
