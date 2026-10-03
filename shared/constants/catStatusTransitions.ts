import { CatStatus } from "./catStatus.ts";

// Valid targets for an Admin-driven status change (backend/src/lib/catStatus.ts is the
// enforcement authority; the frontend imports this same table to build its UI options).
// PickedUp is intentionally reachable only via Confirm Pickup, never a direct target here.
export const VALID_STATUS_TRANSITIONS: Record<CatStatus, CatStatus[]> = {
  [CatStatus.Available]: [CatStatus.PendingAdoption, CatStatus.Adopted],
  [CatStatus.PendingAdoption]: [CatStatus.Adopted, CatStatus.Available],
  [CatStatus.Adopted]: [CatStatus.Available],
  [CatStatus.PickedUp]: [],
};
