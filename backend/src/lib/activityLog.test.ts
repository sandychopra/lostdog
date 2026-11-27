import { describe, expect, test } from "bun:test";
import { createFakeDb } from "../test/fakeDb.ts";
import { describeChanges, logActivity, logOccupantMoved } from "./activityLog.ts";

describe("describeChanges", () => {
  test("lists only the fields that changed, in the given order", () => {
    const before = { name: "Pepsi", collarColor: "Red", microchipNumber: "123" };
    const after = { name: "Pepsi Cola", collarColor: "Blue", microchipNumber: "123" };

    expect(describeChanges(before, after, ["name", "collarColor", "microchipNumber"])).toBe(
      "name: Pepsi → Pepsi Cola, collarColor: Red → Blue",
    );
  });

  test("returns an empty string when nothing changed", () => {
    const row = { name: "Pepsi", ageYears: 2 };
    expect(describeChanges(row, { ...row }, ["name", "ageYears"])).toBe("");
  });

  test("treats null, undefined and empty string as the same 'none'", () => {
    const before = { collarColor: null as string | null | undefined };
    expect(describeChanges(before, { collarColor: "" }, ["collarColor"])).toBe("");
    expect(describeChanges(before, { collarColor: undefined }, ["collarColor"])).toBe("");
    expect(describeChanges(before, { collarColor: "Pink" }, ["collarColor"])).toBe(
      "collarColor: none → Pink",
    );
  });

  test("ignores fields that aren't listed", () => {
    expect(describeChanges({ a: 1, b: 1 }, { a: 1, b: 2 }, ["a"])).toBe("");
  });

  test("shows a zero as a real value, not 'none'", () => {
    expect(
      describeChanges({ ageYears: null as number | null }, { ageYears: 0 }, ["ageYears"]),
    ).toBe("ageYears: none → 0");
  });
});

describe("logActivity", () => {
  test("stores a null actor when none is given", async () => {
    const db = createFakeDb();

    await logActivity(db.tx, {
      entityType: "Kennel",
      entityId: 1,
      action: "Update",
      description: "State changed",
    });

    expect(db.rows("activityLog")).toEqual([expect.objectContaining({ actorId: null })]);
  });
});

describe("logOccupantMoved", () => {
  test("a cat with no previous kennel is described as moving from 'none'", async () => {
    const db = createFakeDb();
    const to = db.insert("kennel", { number: 8 });

    await logOccupantMoved(db.tx, {
      catId: 3,
      groupId: null,
      fromKennelId: null,
      toKennelId: to.id,
      actorId: "u",
    });

    expect(db.rows("activityLog").map((r) => [r.entityType, r.entityId, r.description])).toEqual([
      ["Cat", 3, "Moved from kennel none to kennel 8"],
      ["Kennel", to.id, "Occupant moved in from kennel none"],
    ]);
  });
});
