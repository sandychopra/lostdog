export const AnnouncementType = {
  NewArrival: "NewArrival",
  PendingAdoption: "PendingAdoption",
  Adopted: "Adopted",
  BackAvailable: "BackAvailable",
  ReturnedToRcc: "ReturnedToRcc",
  KennelMoveRequested: "KennelMoveRequested",
  KennelNeedsReset: "KennelNeedsReset",
  Manual: "Manual",
} as const;

export type AnnouncementType = (typeof AnnouncementType)[keyof typeof AnnouncementType];
