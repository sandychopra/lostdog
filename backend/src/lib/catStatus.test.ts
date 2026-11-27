import { beforeEach, describe, expect, test } from "bun:test";
import { CatStatus } from "shared/constants/catStatus.ts";
import { KennelState } from "shared/constants/kennelState.ts";
import { NotificationType } from "shared/constants/notificationType.ts";
import { SignAction } from "shared/constants/signAction.ts";
import { TaskState } from "shared/constants/taskState.ts";
import { DewormerStatus } from "shared/constants/dewormerStatus.ts";
import type { CreateCatInput } from "shared/schemas/cats.ts";
import { createFakeDb, type FakeDb, type Row } from "../test/fakeDb.ts";
import {
  changeCatStatus,
  completeSignTask,
  confirmPickup,
  createCatWithArrivalNotification,
  InvalidCatStatusTransitionError,
  InvalidPickupError,
  returnCatToRcc,
  SignTaskConflictError,
  uncompleteSignTask,
} from "./catStatus.ts";

const ADMIN = "admin-1";
const VOLUNTEER = "volunteer-1";

let db: FakeDb;
let kennel: Row;

function seedCat(overrides: Partial<Row> = {}): Row {
  return db.insert("cat", {
    name: "Pepsi",
    status: CatStatus.Available,
    kennelId: kennel.id,
    groupId: null,
    pickupAt: null,
    active: true,
    dewormerStatus: DewormerStatus.NotNeeded,
    dewormerDueDate: null,
    needsProbiotic: false,
    ...overrides,
  });
}

const signTasks = (catId: number) => db.where("signTask", { catId });
const openNotifications = (catId: number) => db.where("notification", { catId, resolved: false });
const activity = (entityType: string, entityId: number) =>
  db.where("activityLog", { entityType, entityId });

// Drives a cat through a status change and checks off the sign task it created.
async function changeAndPostSign(catId: number, target: CatStatus) {
  await changeCatStatus(db.tx, { catId, targetStatus: target, actorId: ADMIN });
  const task = db.where("signTask", { catId, state: TaskState.Open }).at(-1)!;
  await completeSignTask(db.tx, { signTaskId: task.id, actorId: VOLUNTEER });
  return task;
}

const openRemoveTasks = (catId: number, action: SignAction) =>
  db.where("signTask", { catId, action, state: TaskState.Open });

// Pending sign posted, then Adopted — but the Adopted sign never went up, so the
// Pending sign is still physically on the kennel.
async function pendingPostedThenAdoptedUnposted(catId: number) {
  await changeAndPostSign(catId, CatStatus.PendingAdoption);
  await changeCatStatus(db.tx, { catId, targetStatus: CatStatus.Adopted, actorId: ADMIN });
}

beforeEach(() => {
  db = createFakeDb();
  kennel = db.insert("kennel", { number: 3, state: KennelState.Occupied });
});

describe("changeCatStatus — entering an adoption status", () => {
  test("available → pending adoption posts a Pending notification and an open Post Pending sign task", async () => {
    const cat = seedCat();
    const pickupAt = new Date("2026-12-05T17:00:00Z");

    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.PendingAdoption,
      pickupAt,
      actorId: ADMIN,
    });

    const [notification] = openNotifications(cat.id);
    expect(notification?.type).toBe(NotificationType.PendingAdoption);
    expect(signTasks(cat.id)).toEqual([
      expect.objectContaining({
        action: SignAction.PostPending,
        kennelId: kennel.id,
        notificationId: notification!.id,
        state: TaskState.Open,
      }),
    ]);
    expect(cat.status).toBe(CatStatus.PendingAdoption);
    expect(cat.pickupAt).toEqual(pickupAt);
  });

  test("available → adopted (fast track) posts only the Adopted sign task", async () => {
    const cat = seedCat();

    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.Adopted,
      actorId: ADMIN,
    });

    expect(signTasks(cat.id).map((t) => t.action)).toEqual([SignAction.PostAdopted]);
    expect(openNotifications(cat.id).map((n) => n.type)).toEqual([NotificationType.Adopted]);
  });

  test("a grouped cat's sign task targets its group's kennel", async () => {
    const groupKennel = db.insert("kennel", { number: 7, state: KennelState.Occupied });
    const group = db.insert("group", { kennelId: groupKennel.id });
    const cat = seedCat({ kennelId: null, groupId: group.id });

    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.PendingAdoption,
      actorId: ADMIN,
    });

    expect(signTasks(cat.id)[0]?.kennelId).toBe(groupKennel.id);
  });

  test("a cat with no kennel gets the notification but no sign task", async () => {
    const cat = seedCat({ kennelId: null });

    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.Adopted,
      actorId: ADMIN,
    });

    expect(openNotifications(cat.id)).toHaveLength(1);
    expect(signTasks(cat.id)).toHaveLength(0);
  });

  test("pending → adopted cancels the unposted Pending sign task and keeps the Pending notification open", async () => {
    const cat = seedCat();
    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.PendingAdoption,
      actorId: ADMIN,
    });

    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.Adopted,
      actorId: ADMIN,
    });

    expect(signTasks(cat.id).map((t) => [t.action, t.state])).toEqual([
      [SignAction.PostPending, TaskState.Cancelled],
      [SignAction.PostAdopted, TaskState.Open],
    ]);
    expect(openNotifications(cat.id).map((n) => n.type)).toEqual([
      NotificationType.PendingAdoption,
      NotificationType.Adopted,
    ]);
  });

  test("every status change writes an activity log row for the cat", async () => {
    const cat = seedCat();

    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.Adopted,
      actorId: ADMIN,
    });

    expect(activity("Cat", cat.id)).toEqual([
      expect.objectContaining({
        actorId: ADMIN,
        description: "Status changed from Available to Adopted",
      }),
    ]);
  });
});

describe("changeCatStatus — fallthrough to available", () => {
  test("pending → available after the Pending sign went up creates a Remove Pending task on a Back Available notification", async () => {
    const cat = seedCat({ pickupAt: new Date("2026-12-05T17:00:00Z") });
    await changeAndPostSign(cat.id, CatStatus.PendingAdoption);

    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.Available,
      actorId: ADMIN,
    });

    const open = openNotifications(cat.id);
    expect(open.map((n) => n.type)).toEqual([NotificationType.BackAvailable]);
    const removeTask = db.where("signTask", { catId: cat.id, action: SignAction.RemovePending });
    expect(removeTask).toEqual([
      expect.objectContaining({ state: TaskState.Open, notificationId: open[0]!.id }),
    ]);
    expect(cat.status).toBe(CatStatus.Available);
    expect(cat.pickupAt).toBeNull();
  });

  // Regression: only the Adopted sign used to be checked, leaving the Pending sign up with no task.
  test("adopted → available while the Pending sign is still up creates a Remove Pending task", async () => {
    const cat = seedCat();
    await pendingPostedThenAdoptedUnposted(cat.id);

    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.Available,
      actorId: ADMIN,
    });

    const backAvailable = db.where("notification", {
      catId: cat.id,
      type: NotificationType.BackAvailable,
    })[0]!;
    expect(openRemoveTasks(cat.id, SignAction.RemovePending)).toEqual([
      expect.objectContaining({ notificationId: backAvailable.id }),
    ]);
    expect(openRemoveTasks(cat.id, SignAction.RemoveAdopted)).toHaveLength(0);
  });

  test("a Remove Pending task cancelled by a re-pend is re-created on the next fallthrough", async () => {
    const cat = seedCat();
    await changeAndPostSign(cat.id, CatStatus.PendingAdoption);
    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.Available,
      actorId: ADMIN,
    });
    // Back to Pending before anyone took the sign down: the remove task is cancelled.
    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.PendingAdoption,
      actorId: ADMIN,
    });

    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.Available,
      actorId: ADMIN,
    });

    expect(openRemoveTasks(cat.id, SignAction.RemovePending)).toHaveLength(1);
  });

  test("no remove-sign task once the sign has already been taken down", async () => {
    const cat = seedCat();
    await changeAndPostSign(cat.id, CatStatus.PendingAdoption);
    await changeAndPostSign(cat.id, CatStatus.Available); // completes the Remove Pending task
    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.PendingAdoption,
      actorId: ADMIN,
    });

    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.Available,
      actorId: ADMIN,
    });

    expect(db.where("signTask", { catId: cat.id, state: TaskState.Open })).toHaveLength(0);
  });

  test("pending → available before the Pending sign went up just cancels the task", async () => {
    const cat = seedCat();
    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.PendingAdoption,
      actorId: ADMIN,
    });

    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.Available,
      actorId: ADMIN,
    });

    expect(signTasks(cat.id).map((t) => [t.action, t.state])).toEqual([
      [SignAction.PostPending, TaskState.Cancelled],
    ]);
  });

  test("adopted → available after the Adopted sign went up creates a Remove Adopted task", async () => {
    const cat = seedCat();
    await changeAndPostSign(cat.id, CatStatus.Adopted);

    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.Available,
      actorId: ADMIN,
    });

    expect(
      db.where("signTask", {
        catId: cat.id,
        action: SignAction.RemoveAdopted,
        state: TaskState.Open,
      }),
    ).toHaveLength(1);
  });

  test("falling through from adopted resolves both the Pending and Adopted notifications", async () => {
    const cat = seedCat();
    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.PendingAdoption,
      actorId: ADMIN,
    });
    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.Adopted,
      actorId: ADMIN,
    });

    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.Available,
      actorId: ADMIN,
    });

    const resolved = db.where("notification", { catId: cat.id, resolved: true });
    expect(resolved.map((n) => n.type).sort()).toEqual(
      [NotificationType.Adopted, NotificationType.PendingAdoption].sort(),
    );
    expect(resolved.every((n) => n.resolvedById === ADMIN)).toBe(true);
  });

  test("a fallthrough leaves the cat's New Arrival notification open", async () => {
    const cat = seedCat();
    db.insert("notification", { type: NotificationType.NewArrival, catId: cat.id });
    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.Adopted,
      actorId: ADMIN,
    });

    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.Available,
      actorId: ADMIN,
    });

    expect(openNotifications(cat.id).map((n) => n.type)).toContain(NotificationType.NewArrival);
  });
});

describe("changeCatStatus — illegal and no-op transitions", () => {
  test.each([
    [CatStatus.Adopted, CatStatus.PendingAdoption],
    [CatStatus.Available, CatStatus.Available],
    [CatStatus.PickedUp, CatStatus.Available],
    [CatStatus.PickedUp, CatStatus.Adopted],
  ] as const)("rejects %s → %s without side effects", async (from, to) => {
    const cat = seedCat({ status: from });

    await expect(
      changeCatStatus(db.tx, { catId: cat.id, targetStatus: to, actorId: ADMIN }),
    ).rejects.toBeInstanceOf(InvalidCatStatusTransitionError);

    expect(cat.status).toBe(from);
    expect(db.rows("notification")).toHaveLength(0);
    expect(db.rows("signTask")).toHaveLength(0);
    expect(db.rows("activityLog")).toHaveLength(0);
  });

  test("a same-status change while adopted only reschedules the pickup", async () => {
    const cat = seedCat({ status: CatStatus.Adopted, pickupAt: new Date("2026-12-05T17:00:00Z") });
    const later = new Date("2026-12-07T17:00:00Z");

    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.Adopted,
      pickupAt: later,
      actorId: ADMIN,
    });

    expect(cat.pickupAt).toEqual(later);
    expect(db.rows("notification")).toHaveLength(0);
    expect(db.rows("signTask")).toHaveLength(0);
    expect(activity("Cat", cat.id).map((a) => a.description)).toEqual(["Pickup time rescheduled"]);
  });

  test("a same-status change without a pickup time keeps the scheduled one", async () => {
    const scheduled = new Date("2026-12-05T17:00:00Z");
    const cat = seedCat({ status: CatStatus.PendingAdoption, pickupAt: scheduled });

    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.PendingAdoption,
      actorId: ADMIN,
    });

    expect(cat.pickupAt).toEqual(scheduled);
  });

  // Regression: an explicit null used to be treated as "not provided".
  test("a same-status change with pickupAt null clears the scheduled pickup", async () => {
    const cat = seedCat({ status: CatStatus.Adopted, pickupAt: new Date("2026-12-05T17:00:00Z") });

    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.Adopted,
      pickupAt: null,
      actorId: ADMIN,
    });

    expect(cat.pickupAt).toBeNull();
  });
});

describe("confirmPickup", () => {
  test("rejects a cat that isn't adopted", async () => {
    const cat = seedCat({ status: CatStatus.PendingAdoption, pickupAt: new Date() });

    await expect(
      confirmPickup(db.tx, { catId: cat.id, actorId: VOLUNTEER }),
    ).rejects.toBeInstanceOf(InvalidPickupError);
  });

  test("rejects an adopted cat with no scheduled pickup", async () => {
    const cat = seedCat({ status: CatStatus.Adopted, pickupAt: null });

    await expect(
      confirmPickup(db.tx, { catId: cat.id, actorId: VOLUNTEER }),
    ).rejects.toBeInstanceOf(InvalidPickupError);
  });

  test("a solo cat leaves the roster, its kennel needs a reset, and every open item about it closes", async () => {
    const cat = seedCat();
    db.insert("notification", { type: NotificationType.NewArrival, catId: cat.id });
    db.insert("notification", { type: NotificationType.DewormerDue, catId: cat.id });
    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.Adopted,
      pickupAt: new Date("2026-12-05T17:00:00Z"),
      actorId: ADMIN,
    });
    const move = db.insert("kennelMoveRequest", {
      catId: cat.id,
      fromKennelId: kennel.id,
      toKennelId: 99,
      state: TaskState.Open,
    });

    await confirmPickup(db.tx, { catId: cat.id, actorId: VOLUNTEER });

    expect(cat).toMatchObject({
      status: CatStatus.PickedUp,
      active: false,
      kennelId: null,
      groupId: null,
      pickedUpById: VOLUNTEER,
    });
    expect(cat.pickedUpAt).toBeInstanceOf(Date);
    expect(openNotifications(cat.id).map((n) => n.type)).toEqual([NotificationType.PickedUp]);
    expect(move.state).toBe(TaskState.Cancelled);
    expect(signTasks(cat.id).every((t) => t.state !== TaskState.Open)).toBe(true);
    expect(kennel.state).toBe(KennelState.NeedsReset);
    expect(
      db.where("notification", { type: NotificationType.KennelNeedsReset, kennelId: kennel.id }),
    ).toHaveLength(1);
  });

  test("a cat leaving a group of three leaves no kennel reset but a Remove Adopted task if the sign went up", async () => {
    const group = db.insert("group", { kennelId: kennel.id });
    const cat = seedCat({ kennelId: null, groupId: group.id });
    seedCat({ name: "Sprite", kennelId: null, groupId: group.id });
    seedCat({ name: "Nehi", kennelId: null, groupId: group.id });
    await changeAndPostSign(cat.id, CatStatus.Adopted);
    cat.pickupAt = new Date("2026-12-05T17:00:00Z");

    await confirmPickup(db.tx, { catId: cat.id, actorId: VOLUNTEER });

    expect(kennel.state).toBe(KennelState.Occupied);
    expect(db.where("notification", { type: NotificationType.KennelNeedsReset })).toHaveLength(0);
    const pickedUp = db.where("notification", {
      catId: cat.id,
      type: NotificationType.PickedUp,
    })[0]!;
    expect(
      db.where("signTask", {
        catId: cat.id,
        action: SignAction.RemoveAdopted,
        state: TaskState.Open,
      }),
    ).toEqual([expect.objectContaining({ notificationId: pickedUp.id, kennelId: kennel.id })]);
  });

  test("a cat leaving a group before the Adopted sign went up creates no remove-sign task", async () => {
    const group = db.insert("group", { kennelId: kennel.id });
    const cat = seedCat({ kennelId: null, groupId: group.id });
    seedCat({ name: "Sprite", kennelId: null, groupId: group.id });
    seedCat({ name: "Nehi", kennelId: null, groupId: group.id });
    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.Adopted,
      pickupAt: new Date(),
      actorId: ADMIN,
    });

    await confirmPickup(db.tx, { catId: cat.id, actorId: VOLUNTEER });

    expect(db.where("signTask", { catId: cat.id, action: SignAction.RemoveAdopted })).toHaveLength(
      0,
    );
  });

  test("a cat leaving a group with only the Pending sign up gets a Remove Pending task", async () => {
    const group = db.insert("group", { kennelId: kennel.id });
    const cat = seedCat({ kennelId: null, groupId: group.id });
    seedCat({ name: "Sprite", kennelId: null, groupId: group.id });
    seedCat({ name: "Nehi", kennelId: null, groupId: group.id });
    await pendingPostedThenAdoptedUnposted(cat.id);
    cat.pickupAt = new Date("2026-12-05T17:00:00Z");

    await confirmPickup(db.tx, { catId: cat.id, actorId: VOLUNTEER });

    expect(openRemoveTasks(cat.id, SignAction.RemovePending)).toEqual([
      expect.objectContaining({ kennelId: kennel.id }),
    ]);
  });

  test("picking up one of a pair dissolves the group and leaves the other cat in the kennel", async () => {
    const group = db.insert("group", { kennelId: kennel.id });
    const cat = seedCat({ kennelId: null, groupId: group.id });
    const mate = seedCat({ name: "Sprite", kennelId: null, groupId: group.id });
    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.Adopted,
      pickupAt: new Date(),
      actorId: ADMIN,
    });

    await confirmPickup(db.tx, { catId: cat.id, actorId: VOLUNTEER });

    expect(mate).toMatchObject({ groupId: null, kennelId: kennel.id });
    expect(kennel.state).toBe(KennelState.Occupied);
  });

  test("picking up the last cat of a group empties the kennel and needs a reset", async () => {
    const group = db.insert("group", { kennelId: kennel.id });
    const cat = seedCat({ kennelId: null, groupId: group.id });
    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.Adopted,
      pickupAt: new Date(),
      actorId: ADMIN,
    });

    await confirmPickup(db.tx, { catId: cat.id, actorId: VOLUNTEER });

    expect(kennel.state).toBe(KennelState.NeedsReset);
  });
});

describe("returnCatToRcc", () => {
  test("deactivates the cat, records the reason, empties its kennel and posts Returned to RCC", async () => {
    const cat = seedCat();
    db.insert("notification", { type: NotificationType.ProbioticNeeded, catId: cat.id });

    await returnCatToRcc(db.tx, { catId: cat.id, reason: "for observation", actorId: ADMIN });

    expect(cat).toMatchObject({ active: false, inactiveReason: "for observation", kennelId: null });
    expect(openNotifications(cat.id).map((n) => n.type)).toEqual([NotificationType.ReturnedToRcc]);
    expect(kennel.state).toBe(KennelState.NeedsReset);
    expect(activity("Cat", cat.id).at(-1)?.description).toBe("Returned to RCC: for observation");
  });

  test("creates a remove-sign task only when a sign is currently posted", async () => {
    const cat = seedCat();
    await changeAndPostSign(cat.id, CatStatus.PendingAdoption);

    await returnCatToRcc(db.tx, { catId: cat.id, actorId: ADMIN });

    const returned = db.where("notification", { type: NotificationType.ReturnedToRcc })[0]!;
    expect(
      db.where("signTask", {
        catId: cat.id,
        action: SignAction.RemovePending,
        state: TaskState.Open,
      }),
    ).toEqual([expect.objectContaining({ notificationId: returned.id })]);
  });

  test("removes the Pending sign when the Adopted sign never went up", async () => {
    const cat = seedCat();
    await pendingPostedThenAdoptedUnposted(cat.id);

    await returnCatToRcc(db.tx, { catId: cat.id, actorId: ADMIN });

    expect(openRemoveTasks(cat.id, SignAction.RemovePending)).toHaveLength(1);
  });

  test("cancels a still-open sign task instead of creating a remove-sign task", async () => {
    const cat = seedCat();
    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.Adopted,
      actorId: ADMIN,
    });

    await returnCatToRcc(db.tx, { catId: cat.id, actorId: ADMIN });

    expect(signTasks(cat.id).map((t) => [t.action, t.state])).toEqual([
      [SignAction.PostAdopted, TaskState.Cancelled],
    ]);
  });
});

describe("createCatWithArrivalNotification", () => {
  const input = {
    name: "Biscuit",
    sex: "Male",
    colorPattern: "Tabby",
    dewormerStatus: DewormerStatus.Due,
    dewormerDueDate: new Date("2026-12-01T00:00:00Z"),
    needsProbiotic: true,
  } as CreateCatInput;

  test("posts New Arrival plus Dewormer Due and Probiotic Needed when the cat arrives needing them", async () => {
    const cat = await createCatWithArrivalNotification(db.tx, input, { actorId: ADMIN });

    expect(openNotifications(cat.id).map((n) => n.type)).toEqual([
      NotificationType.NewArrival,
      NotificationType.DewormerDue,
      NotificationType.ProbioticNeeded,
    ]);
  });

  test("posts only New Arrival for a cat with nothing due", async () => {
    const cat = await createCatWithArrivalNotification(db.tx, {
      ...input,
      dewormerStatus: DewormerStatus.NotNeeded,
      dewormerDueDate: undefined,
      needsProbiotic: false,
    });

    expect(openNotifications(cat.id).map((n) => n.type)).toEqual([NotificationType.NewArrival]);
  });
});

describe("completeSignTask / uncompleteSignTask", () => {
  test("completing a post-sign task records who and when but leaves its notification open", async () => {
    const cat = seedCat();
    const task = await changeAndPostSign(cat.id, CatStatus.PendingAdoption);

    const done = db.get("signTask", task.id);
    expect(done).toMatchObject({ state: TaskState.Done, completedById: VOLUNTEER });
    expect(done.completedAt).toBeInstanceOf(Date);
    expect(db.get("notification", done.notificationId as number).resolved).toBe(false);
  });

  test("completing a remove-sign task resolves its Back Available notification", async () => {
    const cat = seedCat();
    await changeAndPostSign(cat.id, CatStatus.PendingAdoption);
    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.Available,
      actorId: ADMIN,
    });
    const remove = db.where("signTask", { action: SignAction.RemovePending })[0]!;

    await completeSignTask(db.tx, { signTaskId: remove.id, actorId: VOLUNTEER });

    expect(db.get("notification", remove.notificationId as number)).toMatchObject({
      type: NotificationType.BackAvailable,
      resolved: true,
      resolvedById: VOLUNTEER,
    });
  });

  test("rejects completing a task that isn't open", async () => {
    const cat = seedCat();
    const task = await changeAndPostSign(cat.id, CatStatus.PendingAdoption);

    await expect(
      completeSignTask(db.tx, { signTaskId: task.id, actorId: VOLUNTEER }),
    ).rejects.toThrow("is not open");
  });

  test("undoing a remove-sign task reopens it and its notification", async () => {
    const cat = seedCat();
    await changeAndPostSign(cat.id, CatStatus.Adopted);
    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.Available,
      actorId: ADMIN,
    });
    const remove = db.where("signTask", { action: SignAction.RemoveAdopted })[0]!;
    await completeSignTask(db.tx, { signTaskId: remove.id, actorId: VOLUNTEER });

    await uncompleteSignTask(db.tx, { signTaskId: remove.id, actorId: VOLUNTEER });

    expect(remove).toMatchObject({ state: TaskState.Open, completedById: null, completedAt: null });
    expect(db.get("notification", remove.notificationId as number)).toMatchObject({
      resolved: false,
      resolvedById: null,
    });
  });

  test("rejects undoing a task that isn't completed", async () => {
    const cat = seedCat();
    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.Adopted,
      actorId: ADMIN,
    });
    const task = signTasks(cat.id)[0]!;

    await expect(
      uncompleteSignTask(db.tx, { signTaskId: task.id, actorId: VOLUNTEER }),
    ).rejects.toThrow("is not completed");
  });

  test("blocks undo once the cat has had a further status change", async () => {
    const cat = seedCat();
    const posted = await changeAndPostSign(cat.id, CatStatus.PendingAdoption);
    await changeCatStatus(db.tx, {
      catId: cat.id,
      targetStatus: CatStatus.Adopted,
      actorId: ADMIN,
    });

    await expect(
      uncompleteSignTask(db.tx, { signTaskId: posted.id, actorId: VOLUNTEER }),
    ).rejects.toBeInstanceOf(SignTaskConflictError);
    expect(db.get("signTask", posted.id).state).toBe(TaskState.Done);
  });

  // Regression: Confirm Pickup of a solo cat creates no newer SignTask, so the newer-task guard alone missed it.
  test("blocks undo of the Adopted sign after the cat was picked up", async () => {
    const cat = seedCat();
    const posted = await changeAndPostSign(cat.id, CatStatus.Adopted);
    cat.pickupAt = new Date("2026-12-05T17:00:00Z");
    await confirmPickup(db.tx, { catId: cat.id, actorId: VOLUNTEER });

    await expect(
      uncompleteSignTask(db.tx, { signTaskId: posted.id, actorId: VOLUNTEER }),
    ).rejects.toBeInstanceOf(SignTaskConflictError);
  });
});
