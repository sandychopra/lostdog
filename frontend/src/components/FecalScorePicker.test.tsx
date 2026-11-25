import { describe, expect, test } from "bun:test";
import { formatFecalScore } from "shared/constants/fecalScore.ts";
import { draftShiftReportSchema } from "shared/schemas/shiftReports.ts";
import { nextFecalScoreValue } from "./FecalScorePicker";

describe("nextFecalScoreValue", () => {
  test("allows several scores", () => {
    expect(nextFecalScoreValue({ scores: [3], empty: false }, ["3", "5"])).toEqual({
      scores: [3, 5],
      empty: false,
    });
  });

  test("picking Empty clears the scores", () => {
    expect(nextFecalScoreValue({ scores: [3, 5], empty: false }, ["3", "5", "empty"])).toEqual({
      scores: [],
      empty: true,
    });
  });

  test("picking a score clears Empty", () => {
    expect(nextFecalScoreValue({ scores: [], empty: true }, ["empty", "2"])).toEqual({
      scores: [2],
      empty: false,
    });
  });

  test("unpicking everything means not recorded", () => {
    expect(nextFecalScoreValue({ scores: [], empty: true }, [])).toEqual({
      scores: [],
      empty: false,
    });
  });
});

describe("formatFecalScore", () => {
  test("formats each case", () => {
    expect(formatFecalScore({ fecalScores: [], fecalEmpty: true })).toBe("Empty");
    expect(formatFecalScore({ fecalScores: [5, 3], fecalEmpty: false })).toBe("3, 5");
    expect(formatFecalScore({ fecalScores: [], fecalEmpty: false })).toBeNull();
  });
});

describe("fecal score schema", () => {
  const entry = (fecal: { fecalScores: number[]; fecalEmpty: boolean }) => ({
    date: "2026-11-25",
    catEntries: [{ entryType: "Individual", catId: 1, ...fecal }],
  });

  test("rejects Empty combined with scores", () => {
    expect(
      draftShiftReportSchema.safeParse(entry({ fecalScores: [3], fecalEmpty: true })).success,
    ).toBe(false);
  });

  test("accepts several distinct scores", () => {
    expect(
      draftShiftReportSchema.safeParse(entry({ fecalScores: [3, 4], fecalEmpty: false })).success,
    ).toBe(true);
  });
});
