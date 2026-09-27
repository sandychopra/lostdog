export const ShiftType = {
  Morning: "Morning",
  MidDay: "MidDay",
  Evening: "Evening",
} as const;

export type ShiftType = (typeof ShiftType)[keyof typeof ShiftType];
