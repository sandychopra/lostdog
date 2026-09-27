import { Router, type Response } from "express";
import { createKennelSchema, updateKennelSchema } from "shared/schemas/kennels.ts";
import { KennelState } from "shared/constants/kennelState.ts";
import { requireAuth } from "../middleware/requireAuth.ts";
import { requireAdmin } from "../middleware/requireAdmin.ts";
import { validate } from "../lib/validate.ts";
import { prisma } from "../lib/prisma.ts";

const router = Router();

const kennelInclude = {
  cats: { select: { id: true, name: true } },
  groups: { select: { id: true, bonded: true, cats: { select: { id: true, name: true } } } },
} as const;

router.get("/", requireAuth, async (_req, res: Response) => {
  const kennels = await prisma.kennel.findMany({
    include: kennelInclude,
    orderBy: { number: "asc" },
  });

  res.json({ kennels });
});

router.post("/", requireAuth, requireAdmin, async (req, res: Response) => {
  const data = validate(createKennelSchema, req.body, res);
  if (!data) return;

  const existing = await prisma.kennel.findUnique({ where: { number: data.number } });
  if (existing) {
    res.status(409).json({ error: "A kennel with that number already exists" });
    return;
  }

  const kennel = await prisma.kennel.create({
    data: { number: data.number, state: KennelState.Ready },
    include: kennelInclude,
  });

  res.status(201).json({ kennel });
});

router.put("/:id", requireAuth, requireAdmin, async (req, res: Response) => {
  const id = Number(req.params.id);

  const data = validate(updateKennelSchema, req.body, res);
  if (!data) return;

  const existing = await prisma.kennel.findUnique({ where: { number: data.number } });
  if (existing && existing.id !== id) {
    res.status(409).json({ error: "A kennel with that number already exists" });
    return;
  }

  const kennel = await prisma.kennel.update({
    where: { id },
    data: { number: data.number, state: data.state },
    include: kennelInclude,
  });

  res.json({ kennel });
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res: Response) => {
  const id = Number(req.params.id);

  const kennel = await prisma.kennel.findUnique({ where: { id } });
  if (!kennel) {
    res.status(404).json({ error: "Kennel not found" });
    return;
  }

  const [catCount, groupCount] = await Promise.all([
    prisma.cat.count({ where: { kennelId: id } }),
    prisma.group.count({ where: { kennelId: id } }),
  ]);
  if (catCount > 0 || groupCount > 0) {
    res.status(409).json({ error: "Cannot delete an occupied kennel" });
    return;
  }

  await prisma.kennel.delete({ where: { id } });

  res.json({ message: "Kennel deleted" });
});

export default router;
