export const SplitShiftPosition = {
  First: "First",
  Second: "Second",
} as const;

export type SplitShiftPosition = (typeof SplitShiftPosition)[keyof typeof SplitShiftPosition];
