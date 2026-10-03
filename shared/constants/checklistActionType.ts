export const ChecklistActionType = {
  ResetKennel: "ResetKennel",
  MoveCat: "MoveCat",
  FreeText: "FreeText",
} as const;

export type ChecklistActionType = (typeof ChecklistActionType)[keyof typeof ChecklistActionType];
