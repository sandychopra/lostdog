export const SnackTreat = {
  Churu: "Churu",
  Greenies: "Greenies",
  Other: "Other",
} as const;

export type SnackTreat = (typeof SnackTreat)[keyof typeof SnackTreat];
