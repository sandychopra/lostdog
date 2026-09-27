import { Router, type Response } from "express";
import { createCatSchema, updateCatSchema } from "shared/schemas/cats.ts";
import { DewormerStatus } from "shared/constants/dewormerStatus.ts";
import { KennelState } from "shared/constants/kennelState.ts";
import { requireAuth } from "../middleware/requireAuth.ts";
import { requireAdmin } from "../middleware/requireAdmin.ts";
import { validate } from "../lib/validate.ts";
import { prisma } from "../lib/prisma.ts";

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

  res.json({ cats });
});

router.post("/", requireAuth, requireAdmin, async (req, res: Response) => {
  const data = validate(createCatSchema, req.body, res);
  if (!data) return;

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

  const [cat] = await prisma.$transaction([
    prisma.cat.create({ data, include: catInclude }),
    prisma.kennel.update({ where: { id: data.kennelId }, data: { state: KennelState.Occupied } }),
  ]);

  res.status(201).json({ cat });
});

router.put("/:id", requireAuth, requireAdmin, async (req, res: Response) => {
  const id = Number(req.params.id);

  const existing = await prisma.cat.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Cat not found" });
    return;
  }
  if (existing.groupId !== null) {
    res.status(409).json({ error: "This cat is part of a group and can't be edited here" });
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

  const [cat] = await prisma.$transaction([
    prisma.cat.update({ where: { id }, data, include: catInclude }),
    prisma.kennel.update({ where: { id: data.kennelId }, data: { state: KennelState.Occupied } }),
    ...(kennelChanged && existing.kennelId !== null
      ? [
          prisma.kennel.update({
            where: { id: existing.kennelId },
            data: { state: KennelState.NeedsReset },
          }),
        ]
      : []),
  ]);

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

  await prisma.$transaction([
    prisma.cat.delete({ where: { id } }),
    ...(existing.kennelId !== null
      ? [
          prisma.kennel.update({
            where: { id: existing.kennelId },
            data: { state: KennelState.NeedsReset },
          }),
        ]
      : []),
  ]);

  res.json({ message: "Cat deleted" });
});

router.patch("/:id/dewormer", requireAuth, async (req, res: Response) => {
  const id = Number(req.params.id);

  const existing = await prisma.cat.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Cat not found" });
    return;
  }

  const cat = await prisma.cat.update({
    where: { id },
    data: { dewormerStatus: DewormerStatus.Given },
    include: catInclude,
  });

  res.json({ cat });
});

export default router;
