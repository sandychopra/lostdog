import { z } from "zod";
import { KennelState } from "../constants/kennelState.ts";

export const createKennelSchema = z.object({
  number: z.coerce
    .number("Number is required")
    .int("Must be a whole number")
    .positive("Must be positive"),
});

export type CreateKennelInput = z.infer<typeof createKennelSchema>;

export const updateKennelSchema = z.object({
  number: z.coerce
    .number("Number is required")
    .int("Must be a whole number")
    .positive("Must be positive"),
  state: z.enum(KennelState),
});

export type UpdateKennelInput = z.infer<typeof updateKennelSchema>;
