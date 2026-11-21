import { Router, type Response } from "express";
import { createKennelSchema, updateKennelSchema } from "shared/schemas/kennels.ts";
import { KennelState } from "shared/constants/kennelState.ts";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.ts";
import { requireAdmin } from "../middleware/requireAdmin.ts";
import { validate } from "../lib/validate.ts";
import { prisma } from "../lib/prisma.ts";
import { describeChanges, logActivity } from "../lib/activityLog.ts";
import {
  completeKennelReset,
  uncompleteKennelReset,
  KennelResetNotFoundError,
  KennelResetConflictError,
} from "../lib/kennelResets.ts";

const router = Router();

const kennelInclude = {
  cats: { select: { id: true, name: true, collarColor: true } },
  groups: {
    select: {
      id: true,
      bonded: true,
      cats: { select: { id: true, name: true, collarColor: true } },
    },
  },
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

  const actorId = (req as AuthedRequest).session.user.id;
  const kennel = await prisma.$transaction(async (tx) => {
    const created = await tx.kennel.create({
      data: { number: data.number, state: KennelState.Ready },
      include: kennelInclude,
    });
    await logActivity(tx, {
      entityType: "Kennel",
      entityId: created.id,
      action: "Create",
      actorId,
      description: `Kennel ${created.number} created`,
    });
    return created;
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

  const before = await prisma.kennel.findUnique({ where: { id } });
  if (!before) {
    res.status(404).json({ error: "Kennel not found" });
    return;
  }

  const actorId = (req as AuthedRequest).session.user.id;
  const kennel = await prisma.$transaction(async (tx) => {
    const updated = await tx.kennel.update({
      where: { id },
      data: { number: data.number, state: data.state },
      include: kennelInclude,
    });
    const description = describeChanges(before, updated, ["number", "state"]);
    if (description) {
      await logActivity(tx, {
        entityType: "Kennel",
        entityId: id,
        action: "Update",
        actorId,
        description,
      });
    }
    return updated;
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

  const actorId = (req as AuthedRequest).session.user.id;
  await prisma.$transaction(async (tx) => {
    await tx.kennel.delete({ where: { id } });
    await logActivity(tx, {
      entityType: "Kennel",
      entityId: id,
      action: "Delete",
      actorId,
      description: `Kennel ${kennel.number} deleted`,
    });
  });

  res.json({ message: "Kennel deleted" });
});

// Completed directly from the Announcements page — any authenticated user.
router.patch("/:id/complete-reset", requireAuth, async (req, res: Response) => {
  const id = Number(req.params.id);
  const actorId = (req as AuthedRequest).session.user.id;

  const existing = await prisma.kennel.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Kennel not found" });
    return;
  }

  try {
    await prisma.$transaction((tx) => completeKennelReset(tx, { kennelId: id, actorId }));
  } catch (err) {
    if (err instanceof KennelResetNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    throw err;
  }

  const kennel = await prisma.kennel.findUniqueOrThrow({ where: { id }, include: kennelInclude });
  res.json({ kennel });
});

// Undoes a mistaken complete-reset — any authenticated user.
router.patch("/:id/uncomplete-reset", requireAuth, async (req, res: Response) => {
  const id = Number(req.params.id);
  const actorId = (req as AuthedRequest).session.user.id;

  const existing = await prisma.kennel.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Kennel not found" });
    return;
  }

  try {
    await prisma.$transaction((tx) => uncompleteKennelReset(tx, { kennelId: id, actorId }));
  } catch (err) {
    if (err instanceof KennelResetNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof KennelResetConflictError) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }

  const kennel = await prisma.kennel.findUniqueOrThrow({ where: { id }, include: kennelInclude });
  res.json({ kennel });
});

export default router;
