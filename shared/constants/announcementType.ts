export const AnnouncementType = {
  NewArrival: "NewArrival",
  PendingAdoption: "PendingAdoption",
  Adopted: "Adopted",
  BackAvailable: "BackAvailable",
  ReturnedToRcc: "ReturnedToRcc",
  ChecklistAssigned: "ChecklistAssigned",
  KennelMoveRequested: "KennelMoveRequested",
} as const;

export type AnnouncementType = (typeof AnnouncementType)[keyof typeof AnnouncementType];
