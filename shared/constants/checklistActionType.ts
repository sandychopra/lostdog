export const ChecklistActionType = {
  ResetKennel: "ResetKennel",
  MoveCat: "MoveCat",
} as const;

export type ChecklistActionType = (typeof ChecklistActionType)[keyof typeof ChecklistActionType];
