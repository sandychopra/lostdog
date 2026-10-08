import { Router, type Response } from "express";
import { createLitterSchema, addLitterCatSchema } from "shared/schemas/litters.ts";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.ts";
import { requireAdmin } from "../middleware/requireAdmin.ts";
import { validate } from "../lib/validate.ts";
import { prisma } from "../lib/prisma.ts";
import { logActivity } from "../lib/activityLog.ts";

const router = Router();

router.post("/", requireAuth, requireAdmin, async (req, res: Response) => {
  const actorId = (req as AuthedRequest).session.user.id;
  const data = validate(createLitterSchema, req.body, res);
  if (!data) return;

  const cats = await prisma.cat.findMany({ where: { id: { in: data.catIds }, active: true } });
  if (cats.length !== data.catIds.length) {
    res.status(404).json({ error: "One or more cats not found" });
    return;
  }
  if (cats.some((cat) => cat.litterId !== null)) {
    res.status(409).json({ error: "One or more cats already belong to a litter" });
    return;
  }

  const litter = await prisma.$transaction(async (tx) => {
    const created = await tx.litter.create({ data: {} });
    await tx.cat.updateMany({
      where: { id: { in: data.catIds } },
      data: { litterId: created.id },
    });
    for (const catId of data.catIds) {
      await logActivity(tx, {
        entityType: "Cat",
        entityId: catId,
        action: "Update",
        actorId,
        description: `Joined litter ${created.id}`,
      });
    }
    return created;
  });

  res.status(201).json({ litter });
});

router.post("/:id/cats", requireAuth, requireAdmin, async (req, res: Response) => {
  const id = Number(req.params.id);
  const actorId = (req as AuthedRequest).session.user.id;

  const data = validate(addLitterCatSchema, req.body, res);
  if (!data) return;

  const litter = await prisma.litter.findUnique({ where: { id } });
  if (!litter) {
    res.status(404).json({ error: "Litter not found" });
    return;
  }

  const cat = await prisma.cat.findUnique({ where: { id: data.catId } });
  if (!cat) {
    res.status(404).json({ error: "Cat not found" });
    return;
  }
  if (cat.litterId !== null) {
    res.status(409).json({ error: "This cat already belongs to a litter" });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.cat.update({ where: { id: data.catId }, data: { litterId: id } });
    await logActivity(tx, {
      entityType: "Cat",
      entityId: data.catId,
      action: "Update",
      actorId,
      description: `Joined litter ${id}`,
    });
  });

  res.json({ message: "Cat added to litter" });
});

router.delete("/:id/cats/:catId", requireAuth, requireAdmin, async (req, res: Response) => {
  const litterId = Number(req.params.id);
  const catId = Number(req.params.catId);
  const actorId = (req as AuthedRequest).session.user.id;

  const litter = await prisma.litter.findUnique({ where: { id: litterId } });
  if (!litter) {
    res.status(404).json({ error: "Litter not found" });
    return;
  }

  const cat = await prisma.cat.findUnique({ where: { id: catId } });
  if (!cat || cat.litterId !== litterId) {
    res.status(404).json({ error: "Cat not found in this litter" });
    return;
  }

  const otherCats = await prisma.cat.findMany({
    where: { litterId, id: { not: catId } },
  });

  await prisma.$transaction(async (tx) => {
    await tx.cat.update({ where: { id: catId }, data: { litterId: null } });
    await logActivity(tx, {
      entityType: "Cat",
      entityId: catId,
      action: "Update",
      actorId,
      description: `Removed from litter ${litterId}`,
    });

    if (otherCats.length === 1) {
      await tx.cat.update({ where: { id: otherCats[0]!.id }, data: { litterId: null } });
      await logActivity(tx, {
        entityType: "Cat",
        entityId: otherCats[0]!.id,
        action: "Update",
        actorId,
        description: `Litter ${litterId} dissolved`,
      });
      await tx.litter.delete({ where: { id: litterId } });
    }
  });

  res.json({ message: "Cat removed from litter" });
});

export default router;
