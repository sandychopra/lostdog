export const KennelState = {
  Ready: "Ready",
  Occupied: "Occupied",
  NeedsReset: "NeedsReset",
  Planned: "Planned",
} as const;

export type KennelState = (typeof KennelState)[keyof typeof KennelState];
