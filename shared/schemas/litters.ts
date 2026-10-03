import { z } from "zod";

export const createLitterSchema = z.object({
  catIds: z
    .array(z.coerce.number().int().positive())
    .min(2, "Select at least 2 cats")
    .refine((ids) => new Set(ids).size === ids.length, "Cats must be distinct"),
});

export type CreateLitterInput = z.infer<typeof createLitterSchema>;

export const addLitterCatSchema = z.object({
  catId: z.coerce.number("Cat is required").int().positive("Cat is required"),
});

export type AddLitterCatInput = z.infer<typeof addLitterCatSchema>;
