import { describe, expect, test } from "bun:test";
import {
  createShiftReportSchema,
  draftShiftReportSchema,
  isCatEntryUntouched,
  UNTOUCHED_ENTRY_MESSAGE,
} from "./shiftReports.ts";

const base = { shiftType: "Morning", date: "2026-11-27" };

const individual = (overrides: Record<string, unknown> = {}) => ({
  entryType: "Individual",
  catId: 1,
  fecalScores: [4],
  ...overrides,
});

const group = (overrides: Record<string, unknown> = {}) => ({
  entryType: "Group",
  groupId: 1,
  pee: true,
  catDetails: [{ catId: 1 }, { catId: 2 }],
  ...overrides,
});

const messages = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((i) => i.message) ?? [];

describe("createShiftReportSchema (submit)", () => {
  test("accepts a minimal report and fills array defaults", () => {
    const result = createShiftReportSchema.safeParse(base);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      isSplitShift: false,
      catEntries: [],
      meetAndGreets: [],
      playGroups: [],
      medicalNotes: [],
      kennelsStatus: [],
    });
  });

  test("parses the date as UTC midnight", () => {
    expect(createShiftReportSchema.parse(base).date.toISOString()).toBe("2026-11-27T00:00:00.000Z");
  });

  test.each([undefined, ""])("requires a shift type (got %p)", (shiftType) => {
    const result = createShiftReportSchema.safeParse({ ...base, shiftType });

    expect(messages(result)).toContain("Select a shift type");
  });

  test("rejects a blank date", () => {
    expect(createShiftReportSchema.safeParse({ ...base, date: "" }).success).toBe(false);
  });

  test("split shift doesn't apply to Mid-day", () => {
    const result = createShiftReportSchema.safeParse({
      ...base,
      shiftType: "MidDay",
      isSplitShift: true,
      splitShiftPosition: "First",
    });

    expect(messages(result)).toContain("Split shift only applies to Morning or Evening");
  });

  test("a split shift needs First or Second", () => {
    const result = createShiftReportSchema.safeParse({
      ...base,
      isSplitShift: true,
      splitShiftPosition: "",
    });

    expect(messages(result)).toContain("Select First or Second shift");
  });

  test("an untouched cat card can't be submitted", () => {
    const result = createShiftReportSchema.safeParse({
      ...base,
      catEntries: [individual({ fecalScores: [] })],
    });

    expect(messages(result)).toContain(UNTOUCHED_ENTRY_MESSAGE);
  });

  test("Empty can't be combined with fecal scores", () => {
    const result = createShiftReportSchema.safeParse({
      ...base,
      catEntries: [individual({ fecalEmpty: true, fecalScores: [3] })],
    });

    expect(messages(result)).toContain("Empty can't be combined with fecal scores");
  });

  test("Empty on its own counts as recorded", () => {
    const result = createShiftReportSchema.safeParse({
      ...base,
      catEntries: [individual({ fecalEmpty: true, fecalScores: [] })],
    });

    expect(result.success).toBe(true);
  });

  test.each([[[0]], [[8]], [[2.5]], [[3, 3]]])("rejects fecal scores %p", (fecalScores) => {
    const result = createShiftReportSchema.safeParse({
      ...base,
      catEntries: [individual({ fecalScores })],
    });

    expect(result.success).toBe(false);
  });

  test("a blank food amount select is treated as not answered", () => {
    const result = createShiftReportSchema.parse({
      ...base,
      catEntries: [individual({ dryFoodAmount: "", wetFoodAmount: "All" })],
    });

    expect(result.catEntries[0]).toMatchObject({ dryFoodAmount: undefined, wetFoodAmount: "All" });
  });

  test("a group entry needs at least one cat when submitted", () => {
    const result = createShiftReportSchema.safeParse({
      ...base,
      catEntries: [group({ catDetails: [] })],
    });

    expect(messages(result)).toContain("Add at least one cat");
  });

  test("a group entry can't list the same cat twice", () => {
    const result = createShiftReportSchema.safeParse({
      ...base,
      catEntries: [group({ catDetails: [{ catId: 1 }, { catId: 1 }] })],
    });

    expect(messages(result)).toContain("Cats must be distinct within a group entry");
  });

  test("a meet-and-greet must tag a cat when submitted", () => {
    const result = createShiftReportSchema.safeParse({
      ...base,
      meetAndGreets: [{ note: "Family of four", catIds: [] }],
    });

    expect(messages(result)).toContain("Tag at least one cat");
  });

  test("allows only one medical note per cat", () => {
    const result = createShiftReportSchema.safeParse({
      ...base,
      medicalNotes: [
        { catId: 1, note: "Sneezing" },
        { catId: 1, note: "Still sneezing" },
      ],
    });

    expect(messages(result)).toContain("Only one medical note per cat");
  });

  test("a submitted medical note needs text", () => {
    const result = createShiftReportSchema.safeParse({
      ...base,
      medicalNotes: [{ catId: 1, note: "   " }],
    });

    expect(messages(result)).toContain("Write the note");
  });

  test("volunteers can't report a kennel as Planned", () => {
    const result = createShiftReportSchema.safeParse({
      ...base,
      kennelsStatus: [{ kennelId: 1, reportedState: "Planned" }],
    });

    expect(result.success).toBe(false);
  });

  test("each kennel is reported at most once", () => {
    const result = createShiftReportSchema.safeParse({
      ...base,
      kennelsStatus: [
        { kennelId: 1, reportedState: "Ready" },
        { kennelId: 1, reportedState: "Occupied" },
      ],
    });

    expect(messages(result)).toContain("Kennels must be distinct");
  });

  test("blank shift-level notes become undefined", () => {
    const result = createShiftReportSchema.parse({ ...base, cleaningNotes: "  ", otherNotes: "" });

    expect(result.cleaningNotes).toBeUndefined();
    expect(result.otherNotes).toBeUndefined();
  });
});

describe("draftShiftReportSchema (save in progress)", () => {
  test("a draft can be saved before a shift type is picked", () => {
    expect(draftShiftReportSchema.safeParse({ date: "2026-11-27", shiftType: "" }).success).toBe(
      true,
    );
  });

  test("a draft keeps incomplete pieces: untouched cards, empty groups, untagged meet-and-greets, half-written notes", () => {
    const result = draftShiftReportSchema.safeParse({
      ...base,
      isSplitShift: true,
      catEntries: [individual({ fecalScores: [] }), group({ catDetails: [], pee: false })],
      meetAndGreets: [{ catIds: [] }],
      medicalNotes: [{ catId: 1 }],
    });

    expect(result.success).toBe(true);
    expect(result.data?.medicalNotes[0]?.note).toBe("");
  });

  test("a draft still rejects internally inconsistent data", () => {
    const result = draftShiftReportSchema.safeParse({
      ...base,
      catEntries: [individual({ fecalEmpty: true, fecalScores: [2] })],
      kennelsStatus: [
        { kennelId: 1, reportedState: "Ready" },
        { kennelId: 1, reportedState: "Ready" },
      ],
    });

    expect(messages(result)).toEqual(
      expect.arrayContaining([
        "Empty can't be combined with fecal scores",
        "Kennels must be distinct",
      ]),
    );
  });
});

describe("isCatEntryUntouched", () => {
  test("an empty entry is untouched", () => {
    expect(isCatEntryUntouched({ fecalScores: [], fecalEmpty: false, pee: false })).toBe(true);
  });

  test("whitespace-only notes don't count as recorded", () => {
    expect(isCatEntryUntouched({ foodNotes: "   ", peePoopNotes: "" })).toBe(true);
  });

  test.each([
    [{ pee: true }],
    [{ fecalEmpty: true }],
    [{ fecalScores: [5] }],
    [{ dryFoodAmount: "Some" }],
    [{ foodNotes: "Ate slowly" }],
    [{ catDetails: [{ wetFoodAmount: "All" }] }],
    [{ catDetails: [{ foodNotes: "Picky" }] }],
  ])("%p counts as recorded", (entry) => {
    expect(isCatEntryUntouched(entry)).toBe(false);
  });
});
