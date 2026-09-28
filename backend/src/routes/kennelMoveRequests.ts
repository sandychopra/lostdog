import { Router, type Response, type Request } from "express";
import { createKennelMoveRequestSchema } from "shared/schemas/kennelMoveRequests.ts";
import { TaskState } from "shared/constants/taskState.ts";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.ts";
import { requireAdmin } from "../middleware/requireAdmin.ts";
import { validate } from "../lib/validate.ts";
import { prisma } from "../lib/prisma.ts";
import {
  createKennelMoveRequest,
  cancelKennelMoveRequest,
  InvalidKennelMoveError,
} from "../lib/kennelMoveRequests.ts";

const router = Router();

const kennelMoveRequestInclude = {
  cat: { select: { id: true, name: true } },
  group: { select: { id: true, cats: { select: { id: true, name: true } } } },
  fromKennel: { select: { id: true, number: true } },
  toKennel: { select: { id: true, number: true } },
} as const;

router.get("/", requireAuth, async (_req, res: Response) => {
  const kennelMoveRequests = await prisma.kennelMoveRequest.findMany({
    where: { state: TaskState.Open },
    include: kennelMoveRequestInclude,
  });

  res.json({ kennelMoveRequests });
});

router.post("/", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const data = validate(createKennelMoveRequestSchema, req.body, res);
  if (!data) return;

  const toKennel = await prisma.kennel.findUnique({ where: { id: data.toKennelId } });
  if (!toKennel) {
    res.status(404).json({ error: "Destination kennel not found" });
    return;
  }

  if (data.catId !== undefined) {
    const cat = await prisma.cat.findUnique({ where: { id: data.catId } });
    if (!cat || !cat.active) {
      res.status(404).json({ error: "Cat not found" });
      return;
    }
    if (cat.kennelId !== data.fromKennelId) {
      res.status(409).json({ error: "Cat is not currently in that kennel" });
      return;
    }
  } else {
    const group = await prisma.group.findUnique({ where: { id: data.groupId! } });
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }
    if (group.kennelId !== data.fromKennelId) {
      res.status(409).json({ error: "Group is not currently in that kennel" });
      return;
    }
  }

  const requestedById = (req as AuthedRequest).session.user.id;

  const kennelMoveRequest = await prisma.$transaction((tx) =>
    createKennelMoveRequest(tx, { ...data, requestedById }),
  );

  res.status(201).json({ kennelMoveRequest });
});

router.patch("/:id/cancel", requireAuth, requireAdmin, async (req, res: Response) => {
  const id = Number(req.params.id);

  const existing = await prisma.kennelMoveRequest.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Kennel move request not found" });
    return;
  }

  try {
    await prisma.$transaction((tx) => cancelKennelMoveRequest(tx, { kennelMoveRequestId: id }));
  } catch (err) {
    if (err instanceof InvalidKennelMoveError) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }

  res.json({ message: "Kennel move request cancelled" });
});

export default router;
