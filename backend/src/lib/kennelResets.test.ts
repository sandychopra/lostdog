import { beforeEach, describe, expect, test } from "bun:test";
import { KennelState } from "shared/constants/kennelState.ts";
import { NotificationType } from "shared/constants/notificationType.ts";
import { createFakeDb, type FakeDb, type Row } from "../test/fakeDb.ts";
import {
  completeKennelReset,
  isKennelOccupied,
  KennelResetConflictError,
  KennelResetNotFoundError,
  markKennelNeedsReset,
  markKennelOccupied,
  markKennelReady,
  uncompleteKennelReset,
} from "./kennelResets.ts";

const ACTOR = "user-1";

let db: FakeDb;
let kennel: Row;

const resetNotifications = (kennelId: number) =>
  db.where("notification", { type: NotificationType.KennelNeedsReset, kennelId });
const kennelActivity = (kennelId: number) =>
  db.where("activityLog", { entityType: "Kennel", entityId: kennelId });

beforeEach(() => {
  db = createFakeDb();
  kennel = db.insert("kennel", { number: 5, state: KennelState.Occupied });
});

describe("isKennelOccupied", () => {
  test("an empty kennel is not occupied", async () => {
    expect(await isKennelOccupied(db.tx, kennel.id)).toBe(false);
  });

  test("an active cat occupies its kennel", async () => {
    db.insert("cat", { kennelId: kennel.id, active: true });
    expect(await isKennelOccupied(db.tx, kennel.id)).toBe(true);
  });

  test("an inactive cat that still points at the kennel doesn't occupy it", async () => {
    db.insert("cat", { kennelId: kennel.id, active: false });
    expect(await isKennelOccupied(db.tx, kennel.id)).toBe(false);
  });

  test("a group occupies its kennel", async () => {
    db.insert("group", { kennelId: kennel.id });
    expect(await isKennelOccupied(db.tx, kennel.id)).toBe(true);
  });
});

describe("markKennelNeedsReset", () => {
  test("flips the kennel, logs the change and opens a Kennel Needs Reset notification", async () => {
    await markKennelNeedsReset(db.tx, kennel.id, ACTOR);

    expect(kennel.state).toBe(KennelState.NeedsReset);
    expect(resetNotifications(kennel.id)).toEqual([expect.objectContaining({ resolved: false })]);
    expect(kennelActivity(kennel.id)).toEqual([
      expect.objectContaining({
        actorId: ACTOR,
        description: "State changed from Occupied to NeedsReset",
      }),
    ]);
  });

  test("never opens a second notification while one is still open", async () => {
    await markKennelNeedsReset(db.tx, kennel.id, ACTOR);
    await markKennelNeedsReset(db.tx, kennel.id, ACTOR);

    expect(resetNotifications(kennel.id)).toHaveLength(1);
  });

  test("opens a fresh notification once the previous one was resolved", async () => {
    await markKennelNeedsReset(db.tx, kennel.id, ACTOR);
    await completeKennelReset(db.tx, { kennelId: kennel.id, actorId: ACTOR });

    await markKennelNeedsReset(db.tx, kennel.id, ACTOR);

    expect(resetNotifications(kennel.id).map((n) => n.resolved)).toEqual([true, false]);
  });

  test("records a null actor for system-driven changes", async () => {
    await markKennelNeedsReset(db.tx, kennel.id);

    expect(kennelActivity(kennel.id)[0]?.actorId).toBeNull();
  });
});

describe("completeKennelReset", () => {
  test("marks the kennel Ready and resolves the open notification with who did it", async () => {
    await markKennelNeedsReset(db.tx, kennel.id, "admin");

    await completeKennelReset(db.tx, { kennelId: kennel.id, actorId: ACTOR });

    expect(kennel.state).toBe(KennelState.Ready);
    expect(resetNotifications(kennel.id)[0]).toMatchObject({ resolved: true, resolvedById: ACTOR });
    expect(kennelActivity(kennel.id).at(-1)?.description).toContain("(reset completed)");
  });

  test("rejects a kennel with no open reset notification", async () => {
    await expect(
      completeKennelReset(db.tx, { kennelId: kennel.id, actorId: ACTOR }),
    ).rejects.toBeInstanceOf(KennelResetNotFoundError);
    expect(kennel.state).toBe(KennelState.Occupied);
  });
});

describe("uncompleteKennelReset", () => {
  test("reverts a completed reset and reopens its notification", async () => {
    await markKennelNeedsReset(db.tx, kennel.id, ACTOR);
    await completeKennelReset(db.tx, { kennelId: kennel.id, actorId: ACTOR });

    await uncompleteKennelReset(db.tx, { kennelId: kennel.id, actorId: ACTOR });

    expect(kennel.state).toBe(KennelState.NeedsReset);
    expect(resetNotifications(kennel.id)[0]).toMatchObject({
      resolved: false,
      resolvedAt: null,
      resolvedById: null,
    });
  });

  test("reopens the most recently resolved notification, not an older one", async () => {
    db.insert("notification", {
      type: NotificationType.KennelNeedsReset,
      kennelId: kennel.id,
      resolved: true,
      resolvedAt: new Date("2026-01-01T00:00:00Z"),
    });
    await markKennelNeedsReset(db.tx, kennel.id, ACTOR);
    await completeKennelReset(db.tx, { kennelId: kennel.id, actorId: ACTOR });

    await uncompleteKennelReset(db.tx, { kennelId: kennel.id, actorId: ACTOR });

    expect(resetNotifications(kennel.id).map((n) => n.resolved)).toEqual([true, false]);
  });

  test("is blocked once the kennel is no longer Ready", async () => {
    await markKennelNeedsReset(db.tx, kennel.id, ACTOR);
    await completeKennelReset(db.tx, { kennelId: kennel.id, actorId: ACTOR });
    await markKennelOccupied(db.tx, kennel.id, ACTOR);

    await expect(
      uncompleteKennelReset(db.tx, { kennelId: kennel.id, actorId: ACTOR }),
    ).rejects.toBeInstanceOf(KennelResetConflictError);
  });

  test("fails when there's no resolved reset notification to reopen", async () => {
    kennel.state = KennelState.Ready;

    await expect(
      uncompleteKennelReset(db.tx, { kennelId: kennel.id, actorId: ACTOR }),
    ).rejects.toBeInstanceOf(KennelResetNotFoundError);
    expect(kennel.state).toBe(KennelState.Ready);
  });
});

describe("markKennelOccupied / markKennelReady", () => {
  test("marking an already-occupied kennel occupied logs nothing", async () => {
    await markKennelOccupied(db.tx, kennel.id, ACTOR);

    expect(kennelActivity(kennel.id)).toHaveLength(0);
  });

  test("marking a ready kennel occupied flips and logs it", async () => {
    kennel.state = KennelState.Ready;

    await markKennelOccupied(db.tx, kennel.id, ACTOR);

    expect(kennel.state).toBe(KennelState.Occupied);
    expect(kennelActivity(kennel.id)).toHaveLength(1);
  });

  test("marking a needs-reset kennel ready flips and logs it", async () => {
    kennel.state = KennelState.NeedsReset;

    await markKennelReady(db.tx, kennel.id, ACTOR);

    expect(kennel.state).toBe(KennelState.Ready);
    expect(kennelActivity(kennel.id)[0]?.description).toBe(
      "State changed from NeedsReset to Ready",
    );
  });

  test("marking an already-ready kennel ready logs nothing", async () => {
    kennel.state = KennelState.Ready;

    await markKennelReady(db.tx, kennel.id, ACTOR);

    expect(kennelActivity(kennel.id)).toHaveLength(0);
  });
});
