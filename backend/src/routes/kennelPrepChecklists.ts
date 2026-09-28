import { Router, type Response } from "express";
import { createChecklistSchema } from "shared/schemas/kennelPrepChecklists.ts";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.ts";
import { requireAdmin } from "../middleware/requireAdmin.ts";
import { validate } from "../lib/validate.ts";
import { prisma } from "../lib/prisma.ts";
import { createChecklist } from "../lib/kennelPrepChecklists.ts";

const router = Router();

const checklistInclude = {
  actions: {
    orderBy: { order: "asc" as const },
    include: {
      kennel: { select: { id: true, number: true } },
      cat: { select: { id: true, name: true } },
      group: { select: { id: true, cats: { select: { id: true, name: true } } } },
    },
  },
} as const;

router.get("/", requireAuth, async (_req, res: Response) => {
  const checklists = await prisma.kennelPrepChecklist.findMany({
    where: { actions: { some: { completed: false } } },
    include: checklistInclude,
  });

  res.json({ checklists });
});

router.post("/", requireAuth, requireAdmin, async (req, res: Response) => {
  const data = validate(createChecklistSchema, req.body, res);
  if (!data) return;

  const kennelIds = [...new Set(data.actions.map((action) => action.kennelId))];
  const catIds = [
    ...new Set(data.actions.map((action) => action.catId).filter((id): id is number => !!id)),
  ];
  const groupIds = [
    ...new Set(data.actions.map((action) => action.groupId).filter((id): id is number => !!id)),
  ];

  const [kennels, cats, groups] = await Promise.all([
    prisma.kennel.findMany({ where: { id: { in: kennelIds } } }),
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

  const checklist = await prisma.$transaction((tx) =>
    createChecklist(tx, { actions: data.actions, createdById }),
  );

  res.status(201).json({ checklist });
});

export default router;
