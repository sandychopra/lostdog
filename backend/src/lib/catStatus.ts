import { CatStatus } from "shared/constants/catStatus.ts";
import { SignAction } from "shared/constants/signAction.ts";
import { NotificationType } from "shared/constants/notificationType.ts";
import { TaskState } from "shared/constants/taskState.ts";
import { VALID_STATUS_TRANSITIONS } from "shared/constants/catStatusTransitions.ts";
import type { CreateCatInput } from "shared/schemas/cats.ts";
import type { Prisma } from "../generated/prisma/client.ts";
import { ActivityAction, ActivityEntityType } from "shared/constants/activityLog.ts";
import { logActivity } from "./activityLog.ts";
import { markKennelNeedsReset } from "./kennelResets.ts";
import { syncDewormerNotification, syncProbioticNotification } from "./medicalAlerts.ts";
import { removeCatFromGroup } from "./groups.ts";

export class InvalidCatStatusTransitionError extends Error {}
export class InvalidPickupError extends Error {}
export class SignTaskConflictError extends Error {}

type Tx = Prisma.TransactionClient;

function logCatActivity(tx: Tx, catId: number, actorId: string, description: string) {
  return logActivity(tx, {
    entityType: ActivityEntityType.Cat,
    entityId: catId,
    action: ActivityAction.Update,
    actorId,
    description,
  });
}

// The Notification types that a Cat's status directly drives — a new status
// change (or Returned to RCC) always supersedes whichever of these is still open.
const DRIVING_NOTIFICATION_TYPES = [
  NotificationType.PendingAdoption,
  NotificationType.Adopted,
  NotificationType.BackAvailable,
];

// A grouped cat has no kennelId of its own — it lives in its group's kennel.
async function effectiveKennelId(
  tx: Tx,
  cat: { kennelId: number | null; groupId: number | null },
): Promise<number | null> {
  if (cat.kennelId !== null || cat.groupId === null) return cat.kennelId;
  const group = await tx.group.findUniqueOrThrow({ where: { id: cat.groupId } });
  return group.kennelId;
}

/**
 * A cat leaving the shelter (picked up or returned to RCC) closes out
 * everything still open about it: every unresolved cat notification and any
 * open kennel move request for the cat. Sign tasks are handled separately by
 * cancelOpenSignTasks.
 */
async function closeOpenCatNotifications(tx: Tx, catId: number, actorId: string): Promise<void> {
  await tx.kennelMoveRequest.updateMany({
    where: { catId, state: TaskState.Open },
    data: { state: TaskState.Cancelled },
  });
  await tx.notification.updateMany({
    where: { catId, resolved: false },
    data: { resolved: true, resolvedAt: new Date(), resolvedById: actorId },
  });
}

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

async function resolveDrivingNotification(tx: Tx, catId: number, actorId: string): Promise<void> {
  await tx.notification.updateMany({
    where: { catId, type: { in: DRIVING_NOTIFICATION_TYPES }, resolved: false },
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

// Creates a remove-sign SignTask attached to `notificationId`, but only if the
// corresponding Post* sign was actually posted (see wasSignPosted) — shared by
// the Available fallthrough and Returned to RCC, which use identical logic.
async function maybeCreateRemoveSignTask(
  tx: Tx,
  args: {
    catId: number;
    kennelId: number | null;
    departingStatus: CatStatus;
    notificationId: number;
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
      notificationId: args.notificationId,
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
    await logCatActivity(tx, args.catId, args.actorId, "Pickup time rescheduled");
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
  const kennelId = await effectiveKennelId(tx, cat);

  // PendingAdoption -> Adopted is forward progress within the same adoption
  // attempt, not a new one — per FR-85, both notifications stay open together
  // until pickup resolves them jointly (see confirmPickup). Every other
  // transition here (entering Pending/Adopted fresh from Available, or falling
  // through to Available) closes out whatever was still open for this cat.
  const isPendingToAdoptedForwardStep =
    cat.status === CatStatus.PendingAdoption && args.targetStatus === CatStatus.Adopted;
  if (!isPendingToAdoptedForwardStep) {
    await resolveDrivingNotification(tx, args.catId, args.actorId);
  }

  if (args.targetStatus === CatStatus.PendingAdoption || args.targetStatus === CatStatus.Adopted) {
    const notificationType =
      args.targetStatus === CatStatus.PendingAdoption
        ? NotificationType.PendingAdoption
        : NotificationType.Adopted;
    const signAction =
      args.targetStatus === CatStatus.PendingAdoption
        ? SignAction.PostPending
        : SignAction.PostAdopted;

    const notification = await tx.notification.create({
      data: { type: notificationType, catId: args.catId },
    });
    if (kennelId !== null) {
      await tx.signTask.create({
        data: {
          catId: args.catId,
          kennelId,
          action: signAction,
          notificationId: notification.id,
          state: TaskState.Open,
        },
      });
    }

    await logCatActivity(
      tx,
      args.catId,
      args.actorId,
      `Status changed from ${cat.status} to ${args.targetStatus}`,
    );
    return tx.cat.update({
      where: { id: args.catId },
      data: { status: args.targetStatus, pickupAt: args.pickupAt ?? null },
    });
  }

  // targetStatus === Available: fallthrough from PendingAdoption or (per amendment) Adopted.
  const notification = await tx.notification.create({
    data: { type: NotificationType.BackAvailable, catId: args.catId },
  });
  await maybeCreateRemoveSignTask(tx, {
    catId: args.catId,
    kennelId,
    departingStatus: cat.status,
    notificationId: notification.id,
  });

  await logCatActivity(
    tx,
    args.catId,
    args.actorId,
    `Status changed from ${cat.status} to ${CatStatus.Available}`,
  );
  return tx.cat.update({
    where: { id: args.catId },
    data: { status: CatStatus.Available, pickupAt: null },
  });
}

/**
 * The one Volunteer-triggerable transition (adopted -> picked up), completed
 * directly from the Notifications page. The cat leaves the shelter: it becomes
 * inactive (off the Cats page), leaves its kennel and group, everything still
 * open about it is closed, and a single PickedUp notification replaces it.
 */
export async function confirmPickup(tx: Tx, args: { catId: number; actorId: string }) {
  const cat = await tx.cat.findUniqueOrThrow({ where: { id: args.catId } });
  if (cat.status !== CatStatus.Adopted || cat.pickupAt === null) {
    throw new InvalidPickupError(`Cat ${args.catId} is not adopted with a scheduled pickup`);
  }

  const kennelId = await effectiveKennelId(tx, cat);
  // Checked before cancelOpenSignTasks, which doesn't touch Done tasks anyway.
  const adoptedSignPosted = await wasSignPosted(tx, args.catId, SignAction.PostAdopted);

  await cancelOpenSignTasks(tx, args.catId);

  // Closes the PendingAdoption/Adopted notification(s) — FR-85's 3-condition
  // rule (picked up + kennel reset/sign removal + no open sign task) is
  // satisfied right here — along with every other open item about this cat
  // (New Arrival, dewormer, probiotic, move requests).
  await closeOpenCatNotifications(tx, args.catId, args.actorId);

  const pickedUp = await tx.notification.create({
    data: { type: NotificationType.PickedUp, catId: args.catId },
  });

  await logCatActivity(
    tx,
    args.catId,
    args.actorId,
    `Status changed from ${cat.status} to ${CatStatus.PickedUp} (pickup confirmed)`,
  );

  // Leaving the kennel: a solo cat empties it, so it needs a reset (which also
  // covers taking the Adopted sign down). A cat leaving a group leaves its
  // kennel-mates behind — no reset, but the Adopted sign still has to come
  // down, tracked as its own task on the PickedUp card.
  let kennelNowEmpty = true;
  if (cat.groupId !== null) {
    const result = await removeCatFromGroup(tx, {
      catId: args.catId,
      groupId: cat.groupId,
      actorId: args.actorId,
      reason: "picked up",
    });
    kennelNowEmpty = result.catsLeftInKennel === 0;
  }

  if (kennelId !== null) {
    if (kennelNowEmpty) {
      await markKennelNeedsReset(tx, kennelId, args.actorId);
    } else if (adoptedSignPosted) {
      await tx.signTask.create({
        data: {
          catId: args.catId,
          kennelId,
          action: SignAction.RemoveAdopted,
          notificationId: pickedUp.id,
          state: TaskState.Open,
        },
      });
    }
  }

  return tx.cat.update({
    where: { id: args.catId },
    data: {
      status: CatStatus.PickedUp,
      pickedUpById: args.actorId,
      pickedUpAt: new Date(),
      active: false,
      kennelId: null,
      groupId: null,
    },
  });
}

/** Returns a Cat to the RCC: deactivates it and mirrors the same sign-task/notification rules as a status change. */
export async function returnCatToRcc(
  tx: Tx,
  args: { catId: number; reason?: string; actorId: string },
) {
  const cat = await tx.cat.findUniqueOrThrow({ where: { id: args.catId } });

  await cancelOpenSignTasks(tx, args.catId);
  // Leaving the active roster closes everything still open about this cat
  // (status, dewormer/probiotic reminders, move requests) — without touching
  // the underlying dewormerStatus/needsProbiotic flags themselves.
  await closeOpenCatNotifications(tx, args.catId, args.actorId);

  const notification = await tx.notification.create({
    data: { type: NotificationType.ReturnedToRcc, catId: args.catId },
  });
  await maybeCreateRemoveSignTask(tx, {
    catId: args.catId,
    kennelId: cat.kennelId,
    departingStatus: cat.status,
    notificationId: notification.id,
  });

  if (cat.kennelId !== null) {
    await markKennelNeedsReset(tx, cat.kennelId, args.actorId);
  }

  await logCatActivity(
    tx,
    args.catId,
    args.actorId,
    args.reason ? `Returned to RCC: ${args.reason}` : "Returned to RCC",
  );

  return tx.cat.update({
    where: { id: args.catId },
    data: { active: false, inactiveReason: args.reason ?? null, kennelId: null },
  });
}

/** Creates a new Cat (always `Available`) and its NewArrival Notification together,
 * plus a DewormerDue/ProbioticNeeded notification if it arrives already needing either. */
export async function createCatWithArrivalNotification(
  tx: Tx,
  data: CreateCatInput,
  args?: { actorId?: string },
) {
  const cat = await tx.cat.create({ data });
  await tx.notification.create({ data: { type: NotificationType.NewArrival, catId: cat.id } });
  await syncDewormerNotification(tx, { catId: cat.id, actorId: args?.actorId });
  await syncProbioticNotification(tx, { catId: cat.id, actorId: args?.actorId });
  return cat;
}

/** Completes an open SignTask, from the Notifications page. */
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
  // come down" means for a BackAvailable (or ReturnedToRcc) notification (FR-88's
  // one remaining resolution condition) — flip it here since this is the only
  // place that happens, rather than re-deriving it at read time.
  if (updated.action === SignAction.RemovePending || updated.action === SignAction.RemoveAdopted) {
    await tx.notification.update({
      where: { id: updated.notificationId },
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
    await tx.notification.update({
      where: { id: updated.notificationId },
      data: { resolved: false, resolvedAt: null, resolvedById: null },
    });
  }

  return updated;
}
