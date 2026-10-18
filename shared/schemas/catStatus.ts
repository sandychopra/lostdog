import { z } from "zod";
import { CatStatus } from "../constants/catStatus.ts";
import { emptyToUndefined } from "./helpers.ts";

// PickedUp is deliberately excluded — it's reachable only via Confirm Pickup
// (a shift-report action), never a direct target of this Admin status-change endpoint.
export const changeCatStatusSchema = z.object({
  status: z.enum([CatStatus.Available, CatStatus.PendingAdoption, CatStatus.Adopted]),
  pickupAt: z.preprocess(emptyToUndefined, z.coerce.date("Invalid date").optional().nullable()),
});
export type ChangeCatStatusInput = z.infer<typeof changeCatStatusSchema>;

export const returnToRccSchema = z.object({
  reason: z.string().trim().optional().transform(emptyToUndefined),
});
export type ReturnToRccInput = z.infer<typeof returnToRccSchema>;
