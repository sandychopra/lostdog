import { CatStatus } from "shared/constants/catStatus.ts";
import { SignAction } from "shared/constants/signAction.ts";
import { AnnouncementType } from "shared/constants/announcementType.ts";
import { TaskState } from "shared/constants/taskState.ts";
import { VALID_STATUS_TRANSITIONS } from "shared/constants/catStatusTransitions.ts";
import type { CreateCatInput } from "shared/schemas/cats.ts";
import type { Prisma } from "../generated/prisma/client.ts";
import { markKennelNeedsReset } from "./kennelResets.ts";
import { syncDewormerAnnouncement, syncProbioticAnnouncement } from "./medicalAlerts.ts";

export class InvalidCatStatusTransitionError extends Error {}
export class InvalidPickupError extends Error {}
export class SignTaskConflictError extends Error {}

type Tx = Prisma.TransactionClient;

// The Announcement types that a Cat's status directly drives — a new status
// change (or Returned to RCC) always supersedes whichever of these is still open.
const DRIVING_ANNOUNCEMENT_TYPES = [
  AnnouncementType.PendingAdoption,
  AnnouncementType.Adopted,
  AnnouncementType.BackAvailable,
];

async function cancelOpenSignTasks(tx: Tx, catId: number): Promise<void> {
  await tx.signTask.updateMany({
    where: { catId, state: TaskState.Open },
    data: { state: TaskState.Cancelled },
  });
}

// "Was a sign actually posted" — the most recent SignTask for this (catId, action)
// reached Done. If it's still Open (never checked off) or Cancelled, there's
// nothing physical to remove. SignTask has no createdAt column, so `id desc` is
// used as a safe recency proxy (autoincrement ids are monotonic with insertion).
async function wasSignPosted(
  tx: Tx,
  catId: number,
  action: (typeof SignAction)["PostPending" | "PostAdopted"],
): Promise<boolean> {
  const last = await tx.signTask.findFirst({
    where: { catId, action },
    orderBy: { id: "desc" },
  });
  return last?.state === TaskState.Done;
}

async function resolveDrivingAnnouncement(tx: Tx, catId: number, actorId: string): Promise<void> {
  await tx.announcement.updateMany({
    where: { catId, type: { in: DRIVING_ANNOUNCEMENT_TYPES }, resolved: false },
    data: { resolved: true, resolvedAt: new Date(), resolvedById: actorId },
  });
}

// The sign action a cat's *current* status implies is posted, if any — used by
// both a fallthrough-to-Available transition and Returned to RCC, so "was it
// actually posted" always checks the sign tied to the status being left.
function priorSignActionFor(
  status: CatStatus,
): (typeof SignAction)["PostPending" | "PostAdopted"] | null {
  if (status === CatStatus.PendingAdoption) return SignAction.PostPending;
  if (status === CatStatus.Adopted) return SignAction.PostAdopted;
  return null;
}

function removeActionFor(
  priorAction: (typeof SignAction)["PostPending" | "PostAdopted"],
): SignAction {
  return priorAction === SignAction.PostPending
    ? SignAction.RemovePending
    : SignAction.RemoveAdopted;
}

// Creates a remove-sign SignTask attached to `announcementId`, but only if the
// corresponding Post* sign was actually posted (see wasSignPosted) — shared by
// the Available fallthrough and Returned to RCC, which use identical logic.
async function maybeCreateRemoveSignTask(
  tx: Tx,
  args: {
    catId: number;
    kennelId: number | null;
    departingStatus: CatStatus;
    announcementId: number;
  },
): Promise<void> {
  const priorAction = priorSignActionFor(args.departingStatus);
  if (!priorAction || args.kennelId === null) return;
  if (!(await wasSignPosted(tx, args.catId, priorAction))) return;

  await tx.signTask.create({
    data: {
      catId: args.catId,
      kennelId: args.kennelId,
      action: removeActionFor(priorAction),
      announcementId: args.announcementId,
      state: TaskState.Open,
    },
  });
}

/**
 * Admin-driven Cat status changes: available <-> pending adoption (skippable) <->
 * adopted, plus the pending-adoption/adopted -> available fallthroughs. Does NOT
 * handle the adopted -> picked up transition — see confirmPickup.
 */
export async function changeCatStatus(
  tx: Tx,
  args: { catId: number; targetStatus: CatStatus; pickupAt?: Date | null; actorId: string },
) {
  const cat = await tx.cat.findUniqueOrThrow({ where: { id: args.catId } });

  // Same-status call while pending/adopted: just reschedule pickupAt, no
  // side effects — this is the one legal "no-op" transition.
  if (
    args.targetStatus === cat.status &&
    (cat.status === CatStatus.PendingAdoption || cat.status === CatStatus.Adopted)
  ) {
    return tx.cat.update({
      where: { id: args.catId },
      data: { pickupAt: args.pickupAt ?? cat.pickupAt },
    });
  }

  const validTargets: readonly CatStatus[] = VALID_STATUS_TRANSITIONS[cat.status];
  if (!validTargets.includes(args.targetStatus)) {
    throw new InvalidCatStatusTransitionError(
      `Cannot change status from ${cat.status} to ${args.targetStatus}`,
    );
  }

  await cancelOpenSignTasks(tx, args.catId);

  // PendingAdoption -> Adopted is forward progress within the same adoption
  // attempt, not a new one — per FR-85, both announcements stay open together
  // until pickup resolves them jointly (see confirmPickup). Every other
  // transition here (entering Pending/Adopted fresh from Available, or falling
  // through to Available) closes out whatever was still open for this cat.
  const isPendingToAdoptedForwardStep =
    cat.status === CatStatus.PendingAdoption && args.targetStatus === CatStatus.Adopted;
  if (!isPendingToAdoptedForwardStep) {
    await resolveDrivingAnnouncement(tx, args.catId, args.actorId);
  }

  if (args.targetStatus === CatStatus.PendingAdoption || args.targetStatus === CatStatus.Adopted) {
    const announcementType =
      args.targetStatus === CatStatus.PendingAdoption
        ? AnnouncementType.PendingAdoption
        : AnnouncementType.Adopted;
    const signAction =
      args.targetStatus === CatStatus.PendingAdoption
        ? SignAction.PostPending
        : SignAction.PostAdopted;

    const announcement = await tx.announcement.create({
      data: { type: announcementType, catId: args.catId },
    });
    if (cat.kennelId !== null) {
      await tx.signTask.create({
        data: {
          catId: args.catId,
          kennelId: cat.kennelId,
          action: signAction,
          announcementId: announcement.id,
          state: TaskState.Open,
        },
      });
    }

    return tx.cat.update({
      where: { id: args.catId },
      data: { status: args.targetStatus, pickupAt: args.pickupAt ?? null },
    });
  }

  // targetStatus === Available: fallthrough from PendingAdoption or (per amendment) Adopted.
  const announcement = await tx.announcement.create({
    data: { type: AnnouncementType.BackAvailable, catId: args.catId },
  });
  await maybeCreateRemoveSignTask(tx, {
    catId: args.catId,
    kennelId: cat.kennelId,
    departingStatus: cat.status,
    announcementId: announcement.id,
  });

  return tx.cat.update({
    where: { id: args.catId },
    data: { status: CatStatus.Available, pickupAt: null },
  });
}

/**
 * The one Volunteer-triggerable transition (adopted -> picked up), completed
 * directly from the Announcements page.
 */
export async function confirmPickup(tx: Tx, args: { catId: number; actorId: string }) {
  const cat = await tx.cat.findUniqueOrThrow({ where: { id: args.catId } });
  if (cat.status !== CatStatus.Adopted || cat.pickupAt === null) {
    throw new InvalidPickupError(`Cat ${args.catId} is not adopted with a scheduled pickup`);
  }

  await cancelOpenSignTasks(tx, args.catId); // defensive — normally none open on this path

  // This transaction is exactly what satisfies FR-85's 3-condition rule for the
  // PendingAdoption/Adopted announcement(s) still open on this cat (picked up +
  // kennel reset + no open sign task, all set right here) — so resolving them
  // now is authoritative; the announcements feed never needs to re-derive this
  // at read time.
  await resolveDrivingAnnouncement(tx, args.catId, args.actorId);

  if (cat.kennelId !== null) {
    await markKennelNeedsReset(tx, cat.kennelId);
  }

  // No new SignTask here — the Adopted sign's removal is implied by the kennel
  // reset above, never tracked as its own task on this path.
  return tx.cat.update({
    where: { id: args.catId },
    data: {
      status: CatStatus.PickedUp,
      pickedUpById: args.actorId,
      pickedUpAt: new Date(),
    },
  });
}

/** Returns a Cat to the RCC: deactivates it and mirrors the same sign-task/announcement rules as a status change. */
export async function returnCatToRcc(
  tx: Tx,
  args: { catId: number; reason?: string; actorId: string },
) {
  const cat = await tx.cat.findUniqueOrThrow({ where: { id: args.catId } });

  await cancelOpenSignTasks(tx, args.catId);
  await resolveDrivingAnnouncement(tx, args.catId, args.actorId);

  const announcement = await tx.announcement.create({
    data: { type: AnnouncementType.ReturnedToRcc, catId: args.catId },
  });
  await maybeCreateRemoveSignTask(tx, {
    catId: args.catId,
    kennelId: cat.kennelId,
    departingStatus: cat.status,
    announcementId: announcement.id,
  });

  if (cat.kennelId !== null) {
    await markKennelNeedsReset(tx, cat.kennelId);
  }

  // Leaving the active roster makes any open dewormer/probiotic reminder about
  // this cat unactionable noise — close both out, without touching the
  // underlying dewormerStatus/needsProbiotic flags themselves.
  await tx.announcement.updateMany({
    where: {
      catId: args.catId,
      type: { in: [AnnouncementType.DewormerDue, AnnouncementType.ProbioticNeeded] },
      resolved: false,
    },
    data: { resolved: true, resolvedAt: new Date(), resolvedById: args.actorId },
  });

  return tx.cat.update({
    where: { id: args.catId },
    data: { active: false, inactiveReason: args.reason ?? null },
  });
}

/** Creates a new Cat (always `Available`) and its NewArrival Announcement together,
 * plus a DewormerDue/ProbioticNeeded announcement if it arrives already needing either. */
export async function createCatWithArrivalAnnouncement(
  tx: Tx,
  data: CreateCatInput,
  args?: { actorId?: string },
) {
  const cat = await tx.cat.create({ data });
  await tx.announcement.create({ data: { type: AnnouncementType.NewArrival, catId: cat.id } });
  await syncDewormerAnnouncement(tx, { catId: cat.id, actorId: args?.actorId });
  await syncProbioticAnnouncement(tx, { catId: cat.id, actorId: args?.actorId });
  return cat;
}

/** Completes an open SignTask, from the Announcements page. */
export async function completeSignTask(tx: Tx, args: { signTaskId: number; actorId: string }) {
  const task = await tx.signTask.findUniqueOrThrow({ where: { id: args.signTaskId } });
  if (task.state !== TaskState.Open) {
    throw new Error(`Sign task ${args.signTaskId} is not open`);
  }

  const updated = await tx.signTask.update({
    where: { id: args.signTaskId },
    data: {
      state: TaskState.Done,
      completedById: args.actorId,
      completedAt: new Date(),
    },
  });

  // A RemovePending/RemoveAdopted task completing is exactly what "the sign has
  // come down" means for a BackAvailable (or ReturnedToRcc) announcement (FR-88's
  // one remaining resolution condition) — flip it here since this is the only
  // place that happens, rather than re-deriving it at read time.
  if (updated.action === SignAction.RemovePending || updated.action === SignAction.RemoveAdopted) {
    await tx.announcement.update({
      where: { id: updated.announcementId },
      data: { resolved: true, resolvedAt: new Date(), resolvedById: args.actorId },
    });
  }

  return updated;
}

/** Reverts a completed SignTask back to Open, undoing whatever completeSignTask did.
 * Only legal if nothing has happened for this cat since — see the conflict check below. */
export async function uncompleteSignTask(tx: Tx, args: { signTaskId: number; actorId: string }) {
  const task = await tx.signTask.findUniqueOrThrow({ where: { id: args.signTaskId } });
  if (task.state !== TaskState.Done) {
    throw new Error(`Sign task ${args.signTaskId} is not completed`);
  }

  // A newer SignTask row for this cat (any state) means the cat has gone
  // through a further status transition since — undoing now would misrepresent
  // reality (mirrors the cancelOpenSignTasks/wasSignPosted invariant above).
  const newer = await tx.signTask.findFirst({
    where: { catId: task.catId, id: { gt: task.id } },
    select: { id: true },
  });
  if (newer) {
    throw new SignTaskConflictError(
      `Cannot undo — cat ${task.catId} has had further sign activity since this task was completed`,
    );
  }

  const updated = await tx.signTask.update({
    where: { id: args.signTaskId },
    data: { state: TaskState.Open, completedById: null, completedAt: null },
  });

  // Mirror image of completeSignTask's resolution side effect.
  if (updated.action === SignAction.RemovePending || updated.action === SignAction.RemoveAdopted) {
    await tx.announcement.update({
      where: { id: updated.announcementId },
      data: { resolved: false, resolvedAt: null, resolvedById: null },
    });
  }

  return updated;
}
