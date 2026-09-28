export const CatStatus = {
  Available: "Available",
  PendingAdoption: "PendingAdoption",
  Adopted: "Adopted",
  PickedUp: "PickedUp",
} as const;

export type CatStatus = (typeof CatStatus)[keyof typeof CatStatus];
