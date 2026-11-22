import { Router, type Response } from "express";
import { createKennelSchema, updateKennelSchema } from "shared/schemas/kennels.ts";
import { KennelState } from "shared/constants/kennelState.ts";
import { TaskState } from "shared/constants/taskState.ts";
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

// Archived kennels are left out unless ?includeArchived=true (kennel history
// pages and the shift-report kennel filter still need to find them).
router.get("/", requireAuth, async (req, res: Response) => {
  const includeArchived = req.query.includeArchived === "true";
  const kennels = await prisma.kennel.findMany({
    where: includeArchived ? {} : { deletedAt: null },
    include: kennelInclude,
    orderBy: { number: "asc" },
  });

  res.json({ kennels });
});

router.post("/", requireAuth, requireAdmin, async (req, res: Response) => {
  const data = validate(createKennelSchema, req.body, res);
  if (!data) return;

  const existing = await prisma.kennel.findUnique({ where: { number: data.number } });
  if (existing && !existing.deletedAt) {
    res.status(409).json({ error: "A kennel with that number already exists" });
    return;
  }

  const actorId = (req as AuthedRequest).session.user.id;

  // Re-adding an archived kennel's number brings that kennel back, history and all.
  if (existing) {
    const restored = await prisma.$transaction(async (tx) => {
      const updated = await tx.kennel.update({
        where: { id: existing.id },
        data: { deletedAt: null, state: KennelState.Ready },
        include: kennelInclude,
      });
      await logActivity(tx, {
        entityType: "Kennel",
        entityId: existing.id,
        action: "Update",
        actorId,
        description: `Kennel ${existing.number} restored`,
      });
      return updated;
    });
    res.status(201).json({ kennel: restored });
    return;
  }

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
    res.status(409).json({
      error: existing.deletedAt
        ? "An archived kennel already has that number; re-add it to restore it instead"
        : "A kennel with that number already exists",
    });
    return;
  }

  const before = await prisma.kennel.findUnique({ where: { id, deletedAt: null } });
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

// Archives rather than deletes: past shift reports, sign tasks, and move requests
// reference the kennel (with RESTRICT foreign keys), so a hard delete would fail
// for any kennel that has ever been used.
router.delete("/:id", requireAuth, requireAdmin, async (req, res: Response) => {
  const id = Number(req.params.id);

  const kennel = await prisma.kennel.findUnique({ where: { id, deletedAt: null } });
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

  // Open work tied to this kennel would be stranded on the Announcements page
  // once the kennel disappears from the roster, so it has to be finished first.
  const [openSignTasks, openMoveRequests, openAnnouncements, openChecklistActions] =
    await Promise.all([
      prisma.signTask.count({ where: { kennelId: id, state: TaskState.Open } }),
      prisma.kennelMoveRequest.count({
        where: { state: TaskState.Open, OR: [{ fromKennelId: id }, { toKennelId: id }] },
      }),
      prisma.announcement.count({ where: { kennelId: id, resolved: false } }),
      prisma.checklistAction.count({ where: { kennelId: id, completed: false } }),
    ]);
  const openItems = [
    openSignTasks > 0 && "sign tasks",
    openMoveRequests > 0 && "kennel move requests",
    openAnnouncements > 0 && "announcements",
    openChecklistActions > 0 && "checklist steps",
  ].filter(Boolean);
  if (openItems.length > 0) {
    res.status(409).json({
      error: `Kennel ${kennel.number} still has open ${openItems.join(", ")}. Complete or cancel them on the Announcements page first.`,
    });
    return;
  }

  const actorId = (req as AuthedRequest).session.user.id;
  await prisma.$transaction(async (tx) => {
    await tx.kennel.update({ where: { id }, data: { deletedAt: new Date() } });
    await logActivity(tx, {
      entityType: "Kennel",
      entityId: id,
      action: "Delete",
      actorId,
      description: `Kennel ${kennel.number} archived`,
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
