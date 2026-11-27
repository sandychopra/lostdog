import { Router, type Response } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.ts";
import { prisma } from "../lib/prisma.ts";
import {
  completeChecklistAction,
  InvalidChecklistActionError,
} from "../lib/kennelPrepChecklists.ts";

const checklistActionInclude = {
  kennel: { select: { id: true, number: true } },
  cat: { select: { id: true, name: true } },
  group: { select: { id: true, cats: { select: { id: true, name: true } } } },
} as const;

const router = Router();

// Checklist creation happens via POST /api/notifications (an ad-hoc Manual
// notification can carry a task list) — this router only completes tasks.
router.patch("/actions/:id/complete", requireAuth, async (req, res: Response) => {
  const id = Number(req.params.id);
  const actorId = (req as AuthedRequest).session.user.id;

  const existing = await prisma.checklistAction.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Checklist action not found" });
    return;
  }

  try {
    await prisma.$transaction((tx) =>
      completeChecklistAction(tx, { checklistActionId: id, actorId }),
    );
  } catch (err) {
    if (err instanceof InvalidChecklistActionError) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }

  const action = await prisma.checklistAction.findUniqueOrThrow({
    where: { id },
    include: checklistActionInclude,
  });
  res.json({ action });
});

export default router;
