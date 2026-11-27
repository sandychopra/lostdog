import { beforeEach, describe, expect, test } from "bun:test";
import { KennelState } from "shared/constants/kennelState.ts";
import { NotificationType } from "shared/constants/notificationType.ts";
import { TaskState } from "shared/constants/taskState.ts";
import { createFakeDb, type FakeDb, type Row } from "../test/fakeDb.ts";
import { removeCatFromGroup } from "./groups.ts";

const ADMIN = "admin-1";

let db: FakeDb;
let kennel: Row;

beforeEach(() => {
  db = createFakeDb();
  kennel = db.insert("kennel", { number: 4, state: KennelState.Occupied });
});

function seedGroup(size: number, overrides: Partial<Row> = {}) {
  const group = db.insert("group", { kennelId: kennel.id, bonded: false, ...overrides });
  const cats = Array.from({ length: size }, (_, i) =>
    db.insert("cat", { name: `Cat ${i}`, groupId: group.id, kennelId: null, active: true }),
  );
  return { group, cats };
}

const remove = (catId: number, groupId: number, reason?: string) =>
  removeCatFromGroup(db.tx, { catId, groupId, actorId: ADMIN, reason });

describe("removeCatFromGroup", () => {
  test("leaving a group of three keeps the other two grouped in the kennel", async () => {
    const { group, cats } = seedGroup(3);

    const result = await remove(cats[0]!.id, group.id);

    expect(result).toEqual({ groupKennelId: kennel.id, catsLeftInKennel: 2 });
    expect(cats[0]).toMatchObject({ groupId: null, kennelId: null });
    expect(cats[1]).toMatchObject({ groupId: group.id, kennelId: null });
    expect(db.get("group", group.id).kennelId).toBe(kennel.id);
  });

  test("leaving a pair dissolves the group and the remaining cat takes the kennel", async () => {
    const { group, cats } = seedGroup(2);

    const result = await remove(cats[0]!.id, group.id);

    expect(result.catsLeftInKennel).toBe(1);
    expect(cats[1]).toMatchObject({ groupId: null, kennelId: kennel.id });
    expect(db.where("activityLog", { entityId: cats[1]!.id })).toEqual([
      expect.objectContaining({ description: `Group ${group.id} dissolved` }),
    ]);
  });

  test("a dissolved group with no history is deleted", async () => {
    const { group, cats } = seedGroup(2);

    await remove(cats[0]!.id, group.id);

    expect(db.where("group", { id: group.id })).toHaveLength(0);
  });

  test("a dissolved group with shift-report history is retired, not deleted", async () => {
    const { group, cats } = seedGroup(2);
    db.insert("catEntry", { groupId: group.id });

    await remove(cats[0]!.id, group.id);

    expect(db.get("group", group.id).kennelId).toBeNull();
  });

  test("the last cat leaving empties the kennel", async () => {
    const { group, cats } = seedGroup(1);

    const result = await remove(cats[0]!.id, group.id, "picked up");

    expect(result.catsLeftInKennel).toBe(0);
    expect(db.where("activityLog", { entityId: cats[0]!.id })[0]?.description).toBe(
      `Removed from group ${group.id} (picked up)`,
    );
  });

  test("dissolving a group cancels its open move requests and resolves their notifications", async () => {
    const { group, cats } = seedGroup(2);
    const notification = db.insert("notification", { type: NotificationType.KennelMoveRequested });
    const move = db.insert("kennelMoveRequest", {
      groupId: group.id,
      state: TaskState.Open,
      notificationId: notification.id,
    });

    await remove(cats[0]!.id, group.id);

    expect(move.state).toBe(TaskState.Cancelled);
    expect(notification).toMatchObject({ resolved: true, resolvedById: ADMIN });
    // The cancelled request is history, so the group is retired rather than deleted.
    expect(db.get("group", group.id).kennelId).toBeNull();
  });

  test("a resized group keeps its open move requests", async () => {
    const { group, cats } = seedGroup(3);
    const move = db.insert("kennelMoveRequest", { groupId: group.id, state: TaskState.Open });

    await remove(cats[0]!.id, group.id);

    expect(move.state).toBe(TaskState.Open);
  });

  // Regression: retireGroup used to keep bonded=true on a retired pair.
  test("a bonded pair that dissolves loses the bonded flag", async () => {
    const { group, cats } = seedGroup(2, { bonded: true });
    db.insert("catEntry", { groupId: group.id });

    await remove(cats[0]!.id, group.id);

    expect(db.get("group", group.id).bonded).toBe(false);
  });
});
