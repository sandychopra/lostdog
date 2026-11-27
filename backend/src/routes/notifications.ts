import { Router, type Response } from "express";
import { NotificationType } from "shared/constants/notificationType.ts";
import { ChecklistActionType } from "shared/constants/checklistActionType.ts";
import {
  createManualNotificationSchema,
  updateManualNotificationSchema,
  notificationCommentSchema,
  dismissNotificationSchema,
} from "shared/schemas/notifications.ts";
import { TaskState } from "shared/constants/taskState.ts";
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

const notificationInclude = {
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
      collarColor: true,
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

  const notifications = await prisma.notification.findMany({
    where: {
      ...(activeOnly ? { resolved: false } : {}),
      ...(from || to ? { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}),
    },
    include: notificationInclude,
    omit: outboxOmit,
    orderBy: { createdAt: "desc" },
  });

  // ProbioticNeeded rows carry a visible dose log — every probiotic-given entry
  // logged since this episode's notification was created (or, if resolved,
  // until it was) — plus the precise last-dose timestamp the Overdue badge
  // needs, scoped the same way: per project-scope, "if no dose has ever been
  // logged since the flag was set, it's overdue from the moment the flag was
  // set," not from some earlier episode.
  const withDoseLogs = await Promise.all(
    notifications.map(async (notification) => {
      if (notification.type !== NotificationType.ProbioticNeeded || notification.catId === null) {
        return { ...notification, doses: [], lastProbioticGivenAt: null as Date | null };
      }
      const doses = await getProbioticDoseLog(prisma, {
        catId: notification.catId,
        since: notification.createdAt,
        until: notification.resolvedAt ?? undefined,
      });
      const lastProbioticGivenAt = doses[0]?.loggedAt ?? null;
      return { ...notification, doses, lastProbioticGivenAt };
    }),
  );

  res.json({ notifications: withDoseLogs });
});

router.post("/", requireAuth, requireAdmin, async (req, res: Response) => {
  const data = validate(createManualNotificationSchema, req.body, res);
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
    kennelIds.length > 0
      ? prisma.kennel.findMany({ where: { id: { in: kennelIds }, deletedAt: null } })
      : [],
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

  const notification = await prisma.$transaction(async (tx) => {
    let checklistId: number | undefined;
    if (data.tasks.length > 0) {
      const checklist = await createChecklistTasks(tx, { actions: data.tasks, createdById });
      checklistId = checklist.id;
    }
    return tx.notification.create({
      data: {
        type: NotificationType.Manual,
        title: data.title,
        message: data.message ?? null,
        createdById,
        checklistId,
      },
      include: notificationInclude,
      omit: outboxOmit,
    });
  });

  res.status(201).json({ notification });
});

router.put("/:id", requireAuth, requireAdmin, async (req, res: Response) => {
  const id = Number(req.params.id);

  const existing = await prisma.notification.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  if (existing.type !== NotificationType.Manual) {
    res.status(409).json({ error: "Only manual notifications can be edited" });
    return;
  }

  const data = validate(updateManualNotificationSchema, req.body, res);
  if (!data) return;

  if (existing.checklistId === null && !data.message) {
    res.status(400).json({ error: "Message is required when there are no tasks" });
    return;
  }

  const notification = await prisma.notification.update({
    where: { id },
    data: { title: data.title, message: data.message ?? null },
    include: notificationInclude,
    omit: outboxOmit,
  });

  res.json({ notification });
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res: Response) => {
  const id = Number(req.params.id);

  const existing = await prisma.notification.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  if (existing.type !== NotificationType.Manual) {
    res.status(409).json({ error: "Only manual notifications can be deleted" });
    return;
  }

  await prisma.notification.delete({ where: { id } });

  res.json({ message: "Notification deleted" });
});

router.patch("/:id/resolve", requireAuth, requireAdmin, async (req, res: Response) => {
  const id = Number(req.params.id);

  const existing = await prisma.notification.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  if (existing.type !== NotificationType.Manual) {
    res.status(409).json({ error: "Only manual notifications can be manually resolved" });
    return;
  }
  if (existing.resolved) {
    res.status(409).json({ error: "Notification is already resolved" });
    return;
  }

  const resolvedById = (req as AuthedRequest).session.user.id;

  const notification = await prisma.notification.update({
    where: { id },
    data: { resolved: true, resolvedAt: new Date(), resolvedById },
    include: notificationInclude,
    omit: outboxOmit,
  });

  res.json({ notification });
});

// "Not relevant": any Volunteer or Admin can close any open notification
// without doing it, with an optional note. Its open sign tasks and kennel move
// request are cancelled with it; the cat/kennel itself is left unchanged
// (dewormer/probiotic flags, status, kennel state).
router.patch("/:id/dismiss", requireAuth, async (req, res: Response) => {
  const id = Number(req.params.id);

  const existing = await prisma.notification.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  const data = validate(dismissNotificationSchema, req.body ?? {}, res);
  if (!data) return;

  if (existing.resolved) {
    res.status(409).json({ error: "Notification is already resolved" });
    return;
  }

  const actorId = (req as AuthedRequest).session.user.id;

  const notification = await prisma.$transaction(async (tx) => {
    await tx.signTask.updateMany({
      where: { notificationId: id, state: TaskState.Open },
      data: { state: TaskState.Cancelled },
    });
    await tx.kennelMoveRequest.updateMany({
      where: { notificationId: id, state: TaskState.Open },
      data: { state: TaskState.Cancelled },
    });
    return tx.notification.update({
      where: { id },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedById: actorId,
        dismissed: true,
        dismissNote: data.note ?? null,
      },
      include: notificationInclude,
      omit: outboxOmit,
    });
  });

  res.json({ notification });
});

// Admin-only undo of "Not relevant". Cancelled sign tasks / move requests are
// not restored — the card comes back without them.
router.patch("/:id/reopen", requireAuth, requireAdmin, async (req, res: Response) => {
  const id = Number(req.params.id);

  const existing = await prisma.notification.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  if (!existing.dismissed) {
    res.status(409).json({ error: "Only notifications marked not relevant can be reopened" });
    return;
  }

  const notification = await prisma.notification.update({
    where: { id },
    data: {
      resolved: false,
      resolvedAt: null,
      resolvedById: null,
      dismissed: false,
      dismissNote: null,
    },
    include: notificationInclude,
    omit: outboxOmit,
  });

  res.json({ notification });
});

// Any Volunteer or Admin can leave a note on any notification type.
router.patch("/:id/comment", requireAuth, async (req, res: Response) => {
  const id = Number(req.params.id);

  const existing = await prisma.notification.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  const data = validate(notificationCommentSchema, req.body, res);
  if (!data) return;

  const cleared = data.comment.length === 0;
  const commentedById = (req as AuthedRequest).session.user.id;

  const notification = await prisma.notification.update({
    where: { id },
    data: cleared
      ? { comment: null, commentedAt: null, commentedById: null }
      : { comment: data.comment, commentedAt: new Date(), commentedById },
    include: notificationInclude,
    omit: outboxOmit,
  });

  res.json({ notification });
});

export default router;
