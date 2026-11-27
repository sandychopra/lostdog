import { beforeEach, describe, expect, test } from "bun:test";
import { KennelState } from "shared/constants/kennelState.ts";
import { NotificationType } from "shared/constants/notificationType.ts";
import { TaskState } from "shared/constants/taskState.ts";
import { createFakeDb, type FakeDb, type Row } from "../test/fakeDb.ts";
import {
  cancelKennelMoveRequest,
  completeKennelMoveRequest,
  createKennelMoveRequest,
  InvalidKennelMoveError,
} from "./kennelMoveRequests.ts";

const ADMIN = "admin-1";
const VOLUNTEER = "volunteer-1";

let db: FakeDb;
let from: Row;
let to: Row;

beforeEach(() => {
  db = createFakeDb();
  from = db.insert("kennel", { number: 2, state: KennelState.Occupied });
  to = db.insert("kennel", { number: 6, state: KennelState.Ready });
});

async function requestCatMove(cat: Row) {
  return createKennelMoveRequest(db.tx, {
    catId: cat.id,
    fromKennelId: from.id,
    toKennelId: to.id,
    reason: "reuniting a bonded pair",
    requestedById: ADMIN,
  });
}

describe("createKennelMoveRequest", () => {
  test("creates an open request linked to a new Kennel Move Requested notification", async () => {
    const cat = db.insert("cat", { kennelId: from.id });

    const request = await requestCatMove(cat);

    const notification = db.get("notification", request.notificationId as number);
    expect(notification).toMatchObject({
      type: NotificationType.KennelMoveRequested,
      catId: cat.id,
      resolved: false,
    });
    expect(request).toMatchObject({
      catId: cat.id,
      groupId: null,
      fromKennelId: from.id,
      toKennelId: to.id,
      state: TaskState.Open,
      requestedById: ADMIN,
    });
  });

  test("a group move stores the group and no cat", async () => {
    const group = db.insert("group", { kennelId: from.id });

    const request = await createKennelMoveRequest(db.tx, {
      groupId: group.id,
      fromKennelId: from.id,
      toKennelId: to.id,
      requestedById: ADMIN,
    });

    expect(request).toMatchObject({ catId: null, groupId: group.id, reason: null });
  });
});

describe("completeKennelMoveRequest", () => {
  test("moves the cat, flags the source for reset, occupies the destination and resolves the notification", async () => {
    const cat = db.insert("cat", { kennelId: from.id });
    const request = await requestCatMove(cat);

    await completeKennelMoveRequest(db.tx, { kennelMoveRequestId: request.id, actorId: VOLUNTEER });

    expect(cat.kennelId).toBe(to.id);
    expect(from.state).toBe(KennelState.NeedsReset);
    expect(to.state).toBe(KennelState.Occupied);
    expect(
      db.where("notification", { type: NotificationType.KennelNeedsReset, kennelId: from.id }),
    ).toHaveLength(1);
    expect(db.get("kennelMoveRequest", request.id)).toMatchObject({
      state: TaskState.Done,
      completedById: VOLUNTEER,
    });
    expect(db.get("notification", request.notificationId as number)).toMatchObject({
      resolved: true,
      resolvedById: VOLUNTEER,
    });
  });

  test("moves a group and logs the move on every member cat", async () => {
    const group = db.insert("group", { kennelId: from.id });
    const a = db.insert("cat", { groupId: group.id });
    const b = db.insert("cat", { groupId: group.id });
    const request = await createKennelMoveRequest(db.tx, {
      groupId: group.id,
      fromKennelId: from.id,
      toKennelId: to.id,
      requestedById: ADMIN,
    });

    await completeKennelMoveRequest(db.tx, { kennelMoveRequestId: request.id, actorId: VOLUNTEER });

    expect(group.kennelId).toBe(to.id);
    for (const cat of [a, b]) {
      expect(db.where("activityLog", { entityType: "Cat", entityId: cat.id })).toEqual([
        expect.objectContaining({ description: "Moved from kennel 2 to kennel 6" }),
      ]);
    }
  });

  test("rejects a request whose occupant already left the source kennel", async () => {
    const cat = db.insert("cat", { kennelId: from.id });
    const request = await requestCatMove(cat);
    cat.kennelId = db.insert("kennel", { number: 9 }).id;

    await expect(
      completeKennelMoveRequest(db.tx, { kennelMoveRequestId: request.id, actorId: VOLUNTEER }),
    ).rejects.toBeInstanceOf(InvalidKennelMoveError);
    expect(from.state).toBe(KennelState.Occupied);
  });

  test("rejects a move into a kennel that became occupied after the request", async () => {
    const cat = db.insert("cat", { kennelId: from.id });
    const request = await requestCatMove(cat);
    db.insert("cat", { kennelId: to.id, active: true });

    await expect(
      completeKennelMoveRequest(db.tx, { kennelMoveRequestId: request.id, actorId: VOLUNTEER }),
    ).rejects.toThrow("Destination kennel is already occupied");
    expect(cat.kennelId).toBe(from.id);
  });

  test("rejects completing a request twice", async () => {
    const cat = db.insert("cat", { kennelId: from.id });
    const request = await requestCatMove(cat);
    await completeKennelMoveRequest(db.tx, { kennelMoveRequestId: request.id, actorId: VOLUNTEER });

    await expect(
      completeKennelMoveRequest(db.tx, { kennelMoveRequestId: request.id, actorId: VOLUNTEER }),
    ).rejects.toBeInstanceOf(InvalidKennelMoveError);
  });

  test("rejects completing a cancelled request", async () => {
    const cat = db.insert("cat", { kennelId: from.id });
    const request = await requestCatMove(cat);
    await cancelKennelMoveRequest(db.tx, { kennelMoveRequestId: request.id, actorId: ADMIN });

    await expect(
      completeKennelMoveRequest(db.tx, { kennelMoveRequestId: request.id, actorId: VOLUNTEER }),
    ).rejects.toBeInstanceOf(InvalidKennelMoveError);
    expect(cat.kennelId).toBe(from.id);
  });
});

describe("cancelKennelMoveRequest", () => {
  test("cancels the request and resolves its notification without moving anything", async () => {
    const cat = db.insert("cat", { kennelId: from.id });
    const request = await requestCatMove(cat);

    await cancelKennelMoveRequest(db.tx, { kennelMoveRequestId: request.id, actorId: ADMIN });

    expect(db.get("kennelMoveRequest", request.id).state).toBe(TaskState.Cancelled);
    expect(db.get("notification", request.notificationId as number)).toMatchObject({
      resolved: true,
      resolvedById: ADMIN,
    });
    expect(cat.kennelId).toBe(from.id);
    expect(from.state).toBe(KennelState.Occupied);
  });

  test("rejects cancelling a request that's already done", async () => {
    const cat = db.insert("cat", { kennelId: from.id });
    const request = await requestCatMove(cat);
    await completeKennelMoveRequest(db.tx, { kennelMoveRequestId: request.id, actorId: VOLUNTEER });

    await expect(
      cancelKennelMoveRequest(db.tx, { kennelMoveRequestId: request.id, actorId: ADMIN }),
    ).rejects.toBeInstanceOf(InvalidKennelMoveError);
    expect(db.get("kennelMoveRequest", request.id).state).toBe(TaskState.Done);
  });
});
