export const KennelState = {
  Ready: "Ready",
  Occupied: "Occupied",
  NeedsReset: "NeedsReset",
  Planned: "Planned",
} as const;

export type KennelState = (typeof KennelState)[keyof typeof KennelState];

// The subset of KennelState a volunteer can report during a shift — Planned
// stays admin-only (set from the Kennel edit form for a future arrival).
export const ReportableKennelState = {
  Ready: KennelState.Ready,
  Occupied: KennelState.Occupied,
  NeedsReset: KennelState.NeedsReset,
} as const;

export type ReportableKennelState =
  (typeof ReportableKennelState)[keyof typeof ReportableKennelState];

// A kennel's actual current state maps 1:1 onto a reportable one, except
// Planned — which has no equivalent, since it's not something a volunteer can
// ever have observed. Ready is the closest fallback default (unoccupied).
export function toReportableKennelState(state: KennelState): ReportableKennelState {
  return state === KennelState.Planned ? KennelState.Ready : state;
}
