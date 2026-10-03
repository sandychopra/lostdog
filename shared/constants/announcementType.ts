export const AnnouncementType = {
  NewArrival: "NewArrival",
  PendingAdoption: "PendingAdoption",
  Adopted: "Adopted",
  BackAvailable: "BackAvailable",
  ReturnedToRcc: "ReturnedToRcc",
  KennelMoveRequested: "KennelMoveRequested",
  KennelNeedsReset: "KennelNeedsReset",
  DewormerDue: "DewormerDue",
  ProbioticNeeded: "ProbioticNeeded",
  Manual: "Manual",
} as const;

export type AnnouncementType = (typeof AnnouncementType)[keyof typeof AnnouncementType];
