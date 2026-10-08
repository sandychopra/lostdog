import { Router, type Response } from "express";
import { ActivityEntityType } from "shared/constants/activityLog.ts";
import { requireAuth } from "../middleware/requireAuth.ts";
import { requireAdmin } from "../middleware/requireAdmin.ts";
import { prisma } from "../lib/prisma.ts";
import { parseIdParam, parsePaging } from "../lib/reportQueries.ts";

const router = Router();

// Admin-only audit trail for a single Cat or Kennel, newest first.
router.get("/", requireAuth, requireAdmin, async (req, res: Response) => {
  const entityType = req.query.entityType;
  const entityId = parseIdParam(req.query.entityId);
  if (
    (entityType !== ActivityEntityType.Cat && entityType !== ActivityEntityType.Kennel) ||
    !entityId
  ) {
    res.status(400).json({ error: "entityType (Cat or Kennel) and entityId are required" });
    return;
  }

  const activity = await prisma.activityLog.findMany({
    where: { entityType, entityId },
    include: { actor: { select: { id: true, name: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...parsePaging(req.query),
  });

  res.json({ activity });
});

export default router;
