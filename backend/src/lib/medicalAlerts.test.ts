import { beforeEach, describe, expect, test } from "bun:test";
import { DewormerStatus } from "shared/constants/dewormerStatus.ts";
import { NotificationType } from "shared/constants/notificationType.ts";
import { createFakeDb, type FakeDb, type Row } from "../test/fakeDb.ts";
import { syncDewormerNotification, syncProbioticNotification } from "./medicalAlerts.ts";

const ADMIN = "admin-1";
const DUE = new Date("2026-12-01T00:00:00Z");

let db: FakeDb;
let cat: Row;

beforeEach(() => {
  db = createFakeDb();
  cat = db.insert("cat", {
    name: "Nehi",
    dewormerStatus: DewormerStatus.NotNeeded,
    dewormerDueDate: null,
    needsProbiotic: false,
  });
});

const dewormer = () =>
  db.where("notification", { type: NotificationType.DewormerDue, catId: cat.id });
const probiotic = () =>
  db.where("notification", { type: NotificationType.ProbioticNeeded, catId: cat.id });

describe("syncDewormerNotification", () => {
  test("a new cat with a due dewormer gets one open Dewormer Due notification", async () => {
    Object.assign(cat, { dewormerStatus: DewormerStatus.Due, dewormerDueDate: DUE });

    await syncDewormerNotification(db.tx, { catId: cat.id, actorId: ADMIN });

    expect(dewormer()).toEqual([expect.objectContaining({ resolved: false })]);
  });

  test("Due without a due date opens nothing", async () => {
    cat.dewormerStatus = DewormerStatus.Due;

    await syncDewormerNotification(db.tx, { catId: cat.id });

    expect(dewormer()).toHaveLength(0);
  });

  test("marking it given resolves the open notification with the actor", async () => {
    Object.assign(cat, { dewormerStatus: DewormerStatus.Due, dewormerDueDate: DUE });
    await syncDewormerNotification(db.tx, { catId: cat.id });
    const previous = { dewormerStatus: DewormerStatus.Due, dewormerDueDate: DUE };
    cat.dewormerStatus = DewormerStatus.Given;

    await syncDewormerNotification(db.tx, { catId: cat.id, actorId: ADMIN, previous });

    expect(dewormer()).toEqual([expect.objectContaining({ resolved: true, resolvedById: ADMIN })]);
  });

  test("never opens a second notification while one is open", async () => {
    Object.assign(cat, { dewormerStatus: DewormerStatus.Due, dewormerDueDate: DUE });
    await syncDewormerNotification(db.tx, { catId: cat.id });
    const previous = { dewormerStatus: DewormerStatus.Due, dewormerDueDate: DUE };
    cat.dewormerDueDate = new Date("2026-12-08T00:00:00Z");

    await syncDewormerNotification(db.tx, { catId: cat.id, previous });

    expect(dewormer()).toHaveLength(1);
  });

  test("an unrelated edit doesn't reopen a notification someone dismissed", async () => {
    Object.assign(cat, { dewormerStatus: DewormerStatus.Due, dewormerDueDate: DUE });
    db.insert("notification", {
      type: NotificationType.DewormerDue,
      catId: cat.id,
      resolved: true,
      dismissed: true,
    });

    await syncDewormerNotification(db.tx, {
      catId: cat.id,
      previous: { dewormerStatus: DewormerStatus.Due, dewormerDueDate: new Date(DUE) },
    });

    expect(dewormer()).toHaveLength(1);
  });

  test("changing the due date after a dismissal opens a fresh notification", async () => {
    Object.assign(cat, { dewormerStatus: DewormerStatus.Due, dewormerDueDate: DUE });
    db.insert("notification", {
      type: NotificationType.DewormerDue,
      catId: cat.id,
      resolved: true,
    });

    await syncDewormerNotification(db.tx, {
      catId: cat.id,
      previous: {
        dewormerStatus: DewormerStatus.Due,
        dewormerDueDate: new Date("2026-11-20T00:00:00Z"),
      },
    });

    expect(dewormer().map((n) => n.resolved)).toEqual([true, false]);
  });

  test("going back to Due after being given re-creates the notification", async () => {
    db.insert("notification", {
      type: NotificationType.DewormerDue,
      catId: cat.id,
      resolved: true,
    });
    Object.assign(cat, { dewormerStatus: DewormerStatus.Due, dewormerDueDate: DUE });

    await syncDewormerNotification(db.tx, {
      catId: cat.id,
      previous: { dewormerStatus: DewormerStatus.Given, dewormerDueDate: DUE },
    });

    expect(dewormer().filter((n) => !n.resolved)).toHaveLength(1);
  });
});

describe("syncProbioticNotification", () => {
  test("flagging a cat opens one Probiotic Needed notification", async () => {
    cat.needsProbiotic = true;

    await syncProbioticNotification(db.tx, {
      catId: cat.id,
      previous: { needsProbiotic: false },
    });

    expect(probiotic()).toEqual([expect.objectContaining({ resolved: false })]);
  });

  test("clearing the flag resolves the open notification", async () => {
    cat.needsProbiotic = true;
    await syncProbioticNotification(db.tx, { catId: cat.id });
    cat.needsProbiotic = false;

    await syncProbioticNotification(db.tx, {
      catId: cat.id,
      actorId: ADMIN,
      previous: { needsProbiotic: true },
    });

    expect(probiotic()).toEqual([expect.objectContaining({ resolved: true, resolvedById: ADMIN })]);
  });

  test("an edit that leaves the flag on doesn't reopen a dismissed notification", async () => {
    cat.needsProbiotic = true;
    db.insert("notification", {
      type: NotificationType.ProbioticNeeded,
      catId: cat.id,
      resolved: true,
    });

    await syncProbioticNotification(db.tx, { catId: cat.id, previous: { needsProbiotic: true } });

    expect(probiotic()).toHaveLength(1);
  });

  test("never opens a second notification while one is open", async () => {
    cat.needsProbiotic = true;
    await syncProbioticNotification(db.tx, { catId: cat.id });

    await syncProbioticNotification(db.tx, { catId: cat.id });

    expect(probiotic()).toHaveLength(1);
  });

  test("leaves other cats' notifications alone", async () => {
    const other = db.insert("cat", { needsProbiotic: true });
    db.insert("notification", { type: NotificationType.ProbioticNeeded, catId: other.id });

    await syncProbioticNotification(db.tx, { catId: cat.id, actorId: ADMIN });

    expect(db.where("notification", { catId: other.id, resolved: false })).toHaveLength(1);
  });
});
