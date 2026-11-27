import { beforeEach, describe, expect, test } from "bun:test";
import { ChecklistActionType } from "shared/constants/checklistActionType.ts";
import { KennelState } from "shared/constants/kennelState.ts";
import { NotificationType } from "shared/constants/notificationType.ts";
import { createFakeDb, type FakeDb, type Row } from "../test/fakeDb.ts";
import {
  completeChecklistAction,
  createChecklistTasks,
  InvalidChecklistActionError,
} from "./kennelPrepChecklists.ts";
import { markKennelNeedsReset } from "./kennelResets.ts";

const ADMIN = "admin-1";
const VOLUNTEER = "volunteer-1";

let db: FakeDb;
let kennel5: Row;
let kennel6: Row;
let pepsi: Row;

beforeEach(() => {
  db = createFakeDb();
  kennel5 = db.insert("kennel", { number: 5, state: KennelState.NeedsReset });
  kennel6 = db.insert("kennel", { number: 6, state: KennelState.Occupied });
  pepsi = db.insert("cat", { name: "Pepsi", kennelId: kennel6.id, active: true });
});

// The scope's own example: "reset kennel 5 → move Pepsi to kennel 5 → reset kennel 6".
async function postScopeExample() {
  const checklist = await createChecklistTasks(db.tx, {
    createdById: ADMIN,
    actions: [
      { actionType: ChecklistActionType.ResetKennel, kennelId: kennel5.id },
      { actionType: ChecklistActionType.MoveCat, kennelId: kennel5.id, catId: pepsi.id },
      { actionType: ChecklistActionType.ResetKennel, kennelId: kennel6.id },
    ],
  });
  const notification = db.insert("notification", {
    type: NotificationType.Manual,
    title: "Prep for arrival",
    checklistId: checklist.id,
  });
  const actions = checklist.actions as Row[];
  return { checklist, notification, actions };
}

const complete = (action: Row) =>
  completeChecklistAction(db.tx, { checklistActionId: action.id, actorId: VOLUNTEER });

describe("createChecklistTasks", () => {
  test("stores the steps in the order given, starting at 0", async () => {
    const { actions } = await postScopeExample();

    expect(actions.map((a) => [a.order, a.actionType])).toEqual([
      [0, ChecklistActionType.ResetKennel],
      [1, ChecklistActionType.MoveCat],
      [2, ChecklistActionType.ResetKennel],
    ]);
  });

  test("fills unused targets with null", async () => {
    const checklist = await createChecklistTasks(db.tx, {
      createdById: ADMIN,
      actions: [{ actionType: ChecklistActionType.FreeText, description: "Sweep the floor" }],
    });

    expect((checklist.actions as Row[])[0]).toMatchObject({
      kennelId: null,
      catId: null,
      groupId: null,
      description: "Sweep the floor",
      completed: false,
    });
  });
});

describe("completeChecklistAction ordering", () => {
  test("rejects a step while an earlier step is still incomplete", async () => {
    const { actions } = await postScopeExample();

    await expect(complete(actions[1]!)).rejects.toBeInstanceOf(InvalidChecklistActionError);
    expect(pepsi.kennelId).toBe(kennel6.id);
    expect(db.get("checklistAction", actions[1]!.id).completed).toBe(false);
  });

  test("rejects completing the same step twice", async () => {
    const { actions } = await postScopeExample();
    await complete(actions[0]!);

    await expect(complete(actions[0]!)).rejects.toThrow("already completed");
  });

  test("records who completed each step and when", async () => {
    const { actions } = await postScopeExample();

    await complete(actions[0]!);

    const done = db.get("checklistAction", actions[0]!.id);
    expect(done).toMatchObject({ completed: true, completedById: VOLUNTEER });
    expect(done.completedAt).toBeInstanceOf(Date);
  });

  test("the notification stays open until the last step, then resolves", async () => {
    const { actions, notification } = await postScopeExample();

    await complete(actions[0]!);
    await complete(actions[1]!);
    expect(notification.resolved).toBe(false);

    await complete(actions[2]!);
    expect(notification).toMatchObject({ resolved: true, resolvedById: VOLUNTEER });
  });
});

describe("completeChecklistAction side effects", () => {
  test("a reset step marks the kennel Ready", async () => {
    const { actions } = await postScopeExample();

    await complete(actions[0]!);

    expect(kennel5.state).toBe(KennelState.Ready);
  });

  test("a move step moves the cat and occupies the destination but doesn't flag the old kennel", async () => {
    const { actions } = await postScopeExample();
    await complete(actions[0]!);

    await complete(actions[1]!);

    expect(pepsi.kennelId).toBe(kennel5.id);
    expect(kennel5.state).toBe(KennelState.Occupied);
    expect(kennel6.state).toBe(KennelState.Occupied);
    expect(db.where("notification", { type: NotificationType.KennelNeedsReset })).toHaveLength(0);
    expect(db.where("activityLog", { entityType: "Cat", entityId: pepsi.id })).toEqual([
      expect.objectContaining({ description: "Moved from kennel 6 to kennel 5" }),
    ]);
  });

  test("a move step into an occupied kennel is rejected", async () => {
    const checklist = await createChecklistTasks(db.tx, {
      createdById: ADMIN,
      actions: [{ actionType: ChecklistActionType.MoveCat, kennelId: kennel5.id, catId: pepsi.id }],
    });
    db.insert("cat", { kennelId: kennel5.id, active: true });

    await expect(complete((checklist.actions as Row[])[0]!)).rejects.toThrow(
      "Destination kennel is already occupied",
    );
    expect(pepsi.kennelId).toBe(kennel6.id);
  });

  test("a move step can move a group", async () => {
    const group = db.insert("group", { kennelId: kennel6.id });
    db.insert("cat", { groupId: group.id });
    pepsi.kennelId = null;
    const checklist = await createChecklistTasks(db.tx, {
      createdById: ADMIN,
      actions: [
        { actionType: ChecklistActionType.MoveCat, kennelId: kennel5.id, groupId: group.id },
      ],
    });

    await complete((checklist.actions as Row[])[0]!);

    expect(group.kennelId).toBe(kennel5.id);
  });

  test("a free-text step has no side effect beyond being checked off", async () => {
    const checklist = await createChecklistTasks(db.tx, {
      createdById: ADMIN,
      actions: [{ actionType: ChecklistActionType.FreeText, description: "Sweep" }],
    });

    await complete((checklist.actions as Row[])[0]!);

    expect(kennel5.state).toBe(KennelState.NeedsReset);
    expect(db.rows("activityLog")).toHaveLength(0);
  });

  test("a reset step on a kennel that's still occupied is rejected", async () => {
    const checklist = await createChecklistTasks(db.tx, {
      createdById: ADMIN,
      actions: [{ actionType: ChecklistActionType.ResetKennel, kennelId: kennel6.id }],
    });

    await expect(complete((checklist.actions as Row[])[0]!)).rejects.toBeInstanceOf(
      InvalidChecklistActionError,
    );
    expect(kennel6.state).toBe(KennelState.Occupied);
  });

  // Regression: a reset step used to leave the kennel's "needs reset" notification open.
  test("a reset step resolves the kennel's open Kennel Needs Reset notification", async () => {
    kennel5.state = KennelState.Occupied;
    await markKennelNeedsReset(db.tx, kennel5.id, ADMIN);
    const { actions } = await postScopeExample();

    await complete(actions[0]!);

    expect(
      db.where("notification", {
        type: NotificationType.KennelNeedsReset,
        kennelId: kennel5.id,
        resolved: false,
      }),
    ).toHaveLength(0);
  });

  // Regression: the move step used to put a cat that had left the roster back into a kennel.
  test("a move step for a cat that has since left the roster is rejected", async () => {
    const { actions } = await postScopeExample();
    await complete(actions[0]!);
    pepsi.active = false;
    pepsi.kennelId = null;

    await expect(complete(actions[1]!)).rejects.toBeInstanceOf(InvalidChecklistActionError);
    expect(pepsi.kennelId).toBeNull();
    expect(kennel5.state).toBe(KennelState.Ready);
  });
});
