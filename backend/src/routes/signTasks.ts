import { Router, type Response } from "express";
import { TaskState } from "shared/constants/taskState.ts";
import { requireAuth } from "../middleware/requireAuth.ts";
import { prisma } from "../lib/prisma.ts";

const router = Router();

// No create/complete-by-id endpoint here — SignTasks are system-created only
// (see catStatus.ts), and completion only happens via a ShiftReport submission
// (see shiftReports.ts's signTasksCompletedIds), the same "carries forward until
// checked off on a report" model as kennelsResetIds.
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

export default router;
