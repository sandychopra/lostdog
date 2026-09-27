import { z } from "zod";

export const updatePhotoTagsSchema = z.object({
  catIds: z
    .array(z.coerce.number().int().positive())
    .refine((ids) => new Set(ids).size === ids.length, "Cats must be distinct")
    .default([]),
});

export type UpdatePhotoTagsInput = z.infer<typeof updatePhotoTagsSchema>;
