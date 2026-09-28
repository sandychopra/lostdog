import { Router, type Response } from "express";
import { AnnouncementType } from "shared/constants/announcementType.ts";
import { requireAuth } from "../middleware/requireAuth.ts";
import { prisma } from "../lib/prisma.ts";

const router = Router();

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const announcementInclude = {
  cat: {
    select: {
      id: true,
      name: true,
      status: true,
      kennel: { select: { id: true, number: true } },
    },
  },
  signTasks: { select: { id: true } },
} as const;

// Default-view membership per type (see requirements.md FR-83–FR-89):
// - NewArrival / ReturnedToRcc: purely informational — visible for 24h regardless
//   of `resolved` (which these two types never write).
// - PendingAdoption / Adopted: `resolved` is written authoritatively by
//   confirmPickup, the only path that satisfies all 3 of FR-85's conditions in
//   one transaction — no re-derivation needed here.
// - BackAvailable: resolved by completeSignTask when its remove-sign task (if
//   any) finishes; if no such task was ever created (nothing had been posted),
//   it just follows the 24h rule instead, per FR-88.
// - ChecklistAssigned / KennelMoveRequested: Slice 2 — never produced yet, so
//   `resolved` alone is a safe placeholder until that slice implements their
//   real resolution rules.
function isVisibleInDefaultView(announcement: {
  type: AnnouncementType;
  resolved: boolean;
  createdAt: Date;
  signTasks: { id: number }[];
}): boolean {
  const withinLastDay = Date.now() - announcement.createdAt.getTime() < TWENTY_FOUR_HOURS_MS;

  switch (announcement.type) {
    case AnnouncementType.NewArrival:
    case AnnouncementType.ReturnedToRcc:
      return withinLastDay;
    case AnnouncementType.BackAvailable:
      return announcement.signTasks.length > 0 ? !announcement.resolved : withinLastDay;
    default:
      return !announcement.resolved;
  }
}

router.get("/", requireAuth, async (req, res: Response) => {
  const viewAll = req.query.all === "true";

  const announcements = await prisma.announcement.findMany({
    include: announcementInclude,
    orderBy: { createdAt: "desc" },
  });

  const visible = viewAll ? announcements : announcements.filter(isVisibleInDefaultView);

  res.json({ announcements: visible });
});

export default router;
