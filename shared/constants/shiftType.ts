export const ShiftType = {
  Morning: "Morning",
  MidDay: "MidDay",
  Evening: "Evening",
} as const;

export type ShiftType = (typeof ShiftType)[keyof typeof ShiftType];

/** Display label; a draft can be saved before a shift type is picked. */
export function shiftTypeLabel(shiftType: ShiftType | string | null | undefined): string {
  if (!shiftType) return "Shift type not set";
  return shiftType === ShiftType.MidDay ? "Mid-day" : shiftType;
}
