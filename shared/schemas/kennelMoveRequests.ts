import { z } from "zod";
import { emptyToUndefined } from "./helpers.ts";

export const createKennelMoveRequestSchema = z
  .object({
    catId: z.coerce.number().int().positive().optional(),
    groupId: z.coerce.number().int().positive().optional(),
    fromKennelId: z.coerce.number("Source kennel is required").int().positive(),
    toKennelId: z.coerce.number("Destination kennel is required").int().positive(),
    reason: z.string().trim().optional().transform(emptyToUndefined),
  })
  .refine((data) => (data.catId !== undefined) !== (data.groupId !== undefined), {
    error: "Exactly one of catId or groupId is required",
    path: ["catId"],
  })
  .refine((data) => data.fromKennelId !== data.toKennelId, {
    error: "Destination kennel must be different from the source kennel",
    path: ["toKennelId"],
  });

export type CreateKennelMoveRequestInput = z.infer<typeof createKennelMoveRequestSchema>;
