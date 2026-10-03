export const CatEntryType = {
  Individual: "Individual",
  Group: "Group",
} as const;

export type CatEntryType = (typeof CatEntryType)[keyof typeof CatEntryType];
