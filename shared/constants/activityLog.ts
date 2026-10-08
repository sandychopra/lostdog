export const ActivityEntityType = {
  Cat: "Cat",
  Kennel: "Kennel",
} as const;

export type ActivityEntityType = (typeof ActivityEntityType)[keyof typeof ActivityEntityType];

export const ActivityAction = {
  Create: "Create",
  Update: "Update",
  Delete: "Delete",
} as const;

export type ActivityAction = (typeof ActivityAction)[keyof typeof ActivityAction];
