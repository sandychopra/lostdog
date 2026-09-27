export const KennelState = {
  Ready: "Ready",
  Occupied: "Occupied",
  NeedsReset: "NeedsReset",
} as const;

export type KennelState = (typeof KennelState)[keyof typeof KennelState];
