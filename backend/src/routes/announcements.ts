import { Router, type Response } from "express";
import { AnnouncementType } from "shared/constants/announcementType.ts";
import { ChecklistActionType } from "shared/constants/checklistActionType.ts";
import {
  createManualAnnouncementSchema,
  updateManualAnnouncementSchema,
  announcementCommentSchema,
} from "shared/schemas/announcements.ts";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.ts";
import { requireAdmin } from "../middleware/requireAdmin.ts";
import { validate } from "../lib/validate.ts";
import { prisma } from "../lib/prisma.ts";
import { createChecklistTasks } from "../lib/kennelPrepChecklists.ts";
import { getProbioticDoseLog } from "../lib/medicalAlerts.ts";

const router = Router();

// Email-outbox bookkeeping (attempt count, raw SendGrid error) is internal and
// never sent to clients.
const outboxOmit = { emailAttempts: true, emailLastError: true } as const;

const announcementInclude = {
  cat: {
    select: {
      id: true,
      name: true,
      status: true,
      pickupAt: true,
      pickedUpAt: true,
      dewormerStatus: true,
      dewormerDueDate: true,
      needsProbiotic: true,
      kennel: { select: { id: true, number: true } },
    },
  },
  kennel: { select: { id: true, number: true } },
  checklist: {
    select: {
      id: true,
      actions: {
        orderBy: { order: "asc" as const },
        include: {
          kennel: { select: { id: true, number: true } },
          cat: { select: { id: true, name: true } },
          group: { select: { id: true, cats: { select: { id: true, name: true } } } },
          completedBy: { select: { id: true, name: true } },
        },
      },
    },
  },
  signTasks: {
    select: {
      id: true,
      action: true,
      state: true,
      completedAt: true,
      completedBy: { select: { id: true, name: true } },
      cat: { select: { id: true, name: true } },
      kennel: { select: { id: true, number: true } },
    },
  },
  kennelMoveRequests: {
    select: {
      id: true,
      state: true,
      completedAt: true,
      completedBy: { select: { id: true, name: true } },
      cat: { select: { id: true, name: true } },
      group: { select: { id: true, cats: { select: { id: true, name: true } } } },
      fromKennel: { select: { id: true, number: true } },
      toKennel: { select: { id: true, number: true } },
    },
  },
  resolvedBy: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  commentedBy: { select: { id: true, name: true } },
} as const;

router.get("/", requireAuth, async (req, res: Response) => {
  const activeOnly = req.query.activeOnly === "true";
  const from = typeof req.query.from === "string" ? new Date(req.query.from) : undefined;
  const to = typeof req.query.to === "string" ? new Date(req.query.to) : undefined;

  const announcements = await prisma.announcement.findMany({
    where: {
      ...(activeOnly ? { resolved: false } : {}),
      ...(from || to ? { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}),
    },
    include: announcementInclude,
    omit: outboxOmit,
    orderBy: { createdAt: "desc" },
  });

  // ProbioticNeeded rows carry a visible dose log — every probiotic-given entry
  // logged since this episode's announcement was created (or, if resolved,
  // until it was) — plus the precise last-dose timestamp the Overdue badge
  // needs, scoped the same way: per project-scope, "if no dose has ever been
  // logged since the flag was set, it's overdue from the moment the flag was
  // set," not from some earlier episode.
  const withDoseLogs = await Promise.all(
    announcements.map(async (announcement) => {
      if (announcement.type !== AnnouncementType.ProbioticNeeded || announcement.catId === null) {
        return { ...announcement, doses: [], lastProbioticGivenAt: null as Date | null };
      }
      const doses = await getProbioticDoseLog(prisma, {
        catId: announcement.catId,
        since: announcement.createdAt,
        until: announcement.resolvedAt ?? undefined,
      });
      const lastProbioticGivenAt = doses[0]?.loggedAt ?? null;
      return { ...announcement, doses, lastProbioticGivenAt };
    }),
  );

  res.json({ announcements: withDoseLogs });
});

router.post("/", requireAuth, requireAdmin, async (req, res: Response) => {
  const data = validate(createManualAnnouncementSchema, req.body, res);
  if (!data) return;

  const kennelIds = [
    ...new Set(
      data.tasks
        .map((t) => (t.actionType === ChecklistActionType.FreeText ? undefined : t.kennelId))
        .filter((id): id is number => id !== undefined),
    ),
  ];
  const catIds = [
    ...new Set(
      data.tasks
        .map((t) => (t.actionType === ChecklistActionType.MoveCat ? t.catId : undefined))
        .filter((id): id is number => id !== undefined),
    ),
  ];
  const groupIds = [
    ...new Set(
      data.tasks
        .map((t) => (t.actionType === ChecklistActionType.MoveCat ? t.groupId : undefined))
        .filter((id): id is number => id !== undefined),
    ),
  ];

  const [kennels, cats, groups] = await Promise.all([
    kennelIds.length > 0 ? prisma.kennel.findMany({ where: { id: { in: kennelIds } } }) : [],
    catIds.length > 0 ? prisma.cat.findMany({ where: { id: { in: catIds }, active: true } }) : [],
    groupIds.length > 0 ? prisma.group.findMany({ where: { id: { in: groupIds } } }) : [],
  ]);
  if (kennels.length !== kennelIds.length) {
    res.status(404).json({ error: "One or more kennels not found" });
    return;
  }
  if (cats.length !== catIds.length) {
    res.status(404).json({ error: "One or more cats not found" });
    return;
  }
  if (groups.length !== groupIds.length) {
    res.status(404).json({ error: "One or more groups not found" });
    return;
  }

  const createdById = (req as AuthedRequest).session.user.id;

  const announcement = await prisma.$transaction(async (tx) => {
    let checklistId: number | undefined;
    if (data.tasks.length > 0) {
      const checklist = await createChecklistTasks(tx, { actions: data.tasks, createdById });
      checklistId = checklist.id;
    }
    return tx.announcement.create({
      data: {
        type: AnnouncementType.Manual,
        title: data.title,
        message: data.message ?? null,
        createdById,
        checklistId,
      },
      include: announcementInclude,
      omit: outboxOmit,
    });
  });

  res.status(201).json({ announcement });
});

router.put("/:id", requireAuth, requireAdmin, async (req, res: Response) => {
  const id = Number(req.params.id);

  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Announcement not found" });
    return;
  }
  if (existing.type !== AnnouncementType.Manual) {
    res.status(409).json({ error: "Only manual announcements can be edited" });
    return;
  }

  const data = validate(updateManualAnnouncementSchema, req.body, res);
  if (!data) return;

  if (existing.checklistId === null && !data.message) {
    res.status(400).json({ error: "Message is required when there are no tasks" });
    return;
  }

  const announcement = await prisma.announcement.update({
    where: { id },
    data: { title: data.title, message: data.message ?? null },
    include: announcementInclude,
    omit: outboxOmit,
  });

  res.json({ announcement });
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res: Response) => {
  const id = Number(req.params.id);

  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Announcement not found" });
    return;
  }
  if (existing.type !== AnnouncementType.Manual) {
    res.status(409).json({ error: "Only manual announcements can be deleted" });
    return;
  }

  await prisma.announcement.delete({ where: { id } });

  res.json({ message: "Announcement deleted" });
});

router.patch("/:id/resolve", requireAuth, requireAdmin, async (req, res: Response) => {
  const id = Number(req.params.id);

  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Announcement not found" });
    return;
  }
  if (existing.type !== AnnouncementType.Manual) {
    res.status(409).json({ error: "Only manual announcements can be manually resolved" });
    return;
  }
  if (existing.resolved) {
    res.status(409).json({ error: "Announcement is already resolved" });
    return;
  }

  const resolvedById = (req as AuthedRequest).session.user.id;

  const announcement = await prisma.announcement.update({
    where: { id },
    data: { resolved: true, resolvedAt: new Date(), resolvedById },
    include: announcementInclude,
    omit: outboxOmit,
  });

  res.json({ announcement });
});

// Any Volunteer or Admin can leave a note on any announcement type.
router.patch("/:id/comment", requireAuth, async (req, res: Response) => {
  const id = Number(req.params.id);

  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Announcement not found" });
    return;
  }

  const data = validate(announcementCommentSchema, req.body, res);
  if (!data) return;

  const cleared = data.comment.length === 0;
  const commentedById = (req as AuthedRequest).session.user.id;

  const announcement = await prisma.announcement.update({
    where: { id },
    data: cleared
      ? { comment: null, commentedAt: null, commentedById: null }
      : { comment: data.comment, commentedAt: new Date(), commentedById },
    include: announcementInclude,
    omit: outboxOmit,
  });

  res.json({ announcement });
});

export default router;
