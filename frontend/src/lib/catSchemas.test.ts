import { describe, expect, test } from "bun:test";
import { createCatSchema } from "shared/schemas/cats.ts";

const base = {
  name: "Biscuit",
  sex: "Male",
  colorPattern: "Dilute Calico",
  needsProbiotic: false,
};

describe("createCatSchema dewormer rules", () => {
  test("Due without a date is rejected on the date field", () => {
    const result = createCatSchema.safeParse({ ...base, dewormerStatus: "Due" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["dewormerDueDate"]);
  });

  test("Due with a date is accepted", () => {
    const result = createCatSchema.safeParse({
      ...base,
      dewormerStatus: "Due",
      dewormerDueDate: "2026-12-01",
    });
    expect(result.success).toBe(true);
  });

  test("Not needed doesn't need a date", () => {
    const result = createCatSchema.safeParse({ ...base, dewormerStatus: "NotNeeded" });
    expect(result.success).toBe(true);
  });
});
