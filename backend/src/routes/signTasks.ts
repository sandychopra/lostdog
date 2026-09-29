import { Router, type Response } from "express";
import { TaskState } from "shared/constants/taskState.ts";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.ts";
import { prisma } from "../lib/prisma.ts";
import { completeSignTask } from "../lib/catStatus.ts";

const router = Router();

// SignTasks are still system-created only (see catStatus.ts) — no POST here —
// but completion now happens directly from the Announcements page rather than
// via a ShiftReport submission.
router.get("/", requireAuth, async (_req, res: Response) => {
  const signTasks = await prisma.signTask.findMany({
    where: { state: TaskState.Open },
    include: {
      cat: { select: { id: true, name: true } },
      kennel: { select: { id: true, number: true } },
    },
    orderBy: { id: "asc" },
  });

  res.json({ signTasks });
});

router.patch("/:id/complete", requireAuth, async (req, res: Response) => {
  const id = Number(req.params.id);
  const actorId = (req as AuthedRequest).session.user.id;

  const existing = await prisma.signTask.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Sign task not found" });
    return;
  }
  if (existing.state !== TaskState.Open) {
    res.status(409).json({ error: "Sign task is not open" });
    return;
  }

  const signTask = await prisma.$transaction((tx) =>
    completeSignTask(tx, { signTaskId: id, actorId }),
  );

  res.json({ signTask });
});

export default router;
