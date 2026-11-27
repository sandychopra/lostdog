import { describe, expect, test } from "bun:test";
import { parseDateParam, parseIdParam, parsePaging, reportsInvolvingCat } from "./reportQueries.ts";

describe("parseIdParam", () => {
  test.each([undefined, ""])("treats %p as absent", (raw) => {
    expect(parseIdParam(raw)).toBeUndefined();
  });

  test("parses a positive integer string", () => {
    expect(parseIdParam("42")).toBe(42);
  });

  test.each(["0", "-3", "1.5", "abc", "NaN"])("rejects %p as invalid", (raw) => {
    expect(parseIdParam(raw)).toBeNull();
  });

  test("rejects a repeated query param (Express hands over an array)", () => {
    expect(parseIdParam(["1", "2"])).toBeNull();
  });
});

describe("parseDateParam", () => {
  test.each([undefined, ""])("treats %p as absent", (raw) => {
    expect(parseDateParam(raw)).toBeUndefined();
  });

  test("parses YYYY-MM-DD as UTC midnight so it lines up with the @db.Date column", () => {
    expect(parseDateParam("2026-11-27")?.toISOString()).toBe("2026-11-27T00:00:00.000Z");
  });

  test.each(["11/27/2026", "2026-11-27T10:00", "2026-1-5", "not-a-date"])(
    "rejects %p as invalid",
    (raw) => {
      expect(parseDateParam(raw)).toBeNull();
    },
  );

  test("rejects an out-of-range month", () => {
    expect(parseDateParam("2026-13-01")).toBeNull();
  });

  // Regression: JS Date rolls impossible days over (2026-02-31 → March 3).
  test("rejects a day that doesn't exist in the month", () => {
    expect(parseDateParam("2026-02-31")).toBeNull();
  });
});

describe("parsePaging", () => {
  test("defaults to 50 from the start", () => {
    expect(parsePaging({})).toEqual({ take: 50, skip: 0 });
  });

  test("caps the page size at 200", () => {
    expect(parsePaging({ limit: "1000" })).toEqual({ take: 200, skip: 0 });
  });

  test("honours a valid limit and offset", () => {
    expect(parsePaging({ limit: "20", offset: "40" })).toEqual({ take: 20, skip: 40 });
  });

  test.each([
    [{ limit: "0" }, { take: 50, skip: 0 }],
    [
      { limit: "-5", offset: "-5" },
      { take: 50, skip: 0 },
    ],
    [
      { limit: "abc", offset: "1.5" },
      { take: 50, skip: 0 },
    ],
  ])("falls back to defaults for %p", (query, expected) => {
    expect(parsePaging(query)).toEqual(expected);
  });
});

describe("reportsInvolvingCat", () => {
  test("matches every place a cat can appear on a report", () => {
    const where = reportsInvolvingCat(7);
    const json = JSON.stringify(where);

    expect(where.OR).toHaveLength(6);
    for (const relation of [
      "catEntries",
      "groupDetails",
      "group",
      "meetAndGreets",
      "playGroups",
      "medicalNotes",
    ]) {
      expect(json).toContain(`"${relation}"`);
    }
    expect(json.match(/7/g)?.length).toBe(6);
  });
});
