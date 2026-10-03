import { z } from "zod";

const distinctCatIds = z
  .array(z.coerce.number().int().positive())
  .min(2, "Select at least 2 cats")
  .refine((ids) => new Set(ids).size === ids.length, "Cats must be distinct");

export const createGroupSchema = z
  .object({
    catIds: distinctCatIds,
    kennelId: z.coerce.number("Kennel is required").int().positive("Kennel is required"),
    bonded: z.boolean().default(false),
  })
  .refine((data) => !data.bonded || data.catIds.length === 2, {
    error: "Bonded can only be set on a group of exactly two cats",
    path: ["bonded"],
  });

export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const updateGroupSchema = z.object({
  bonded: z.boolean(),
});

export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;

export const addGroupCatSchema = z.object({
  catId: z.coerce.number("Cat is required").int().positive("Cat is required"),
});

export type AddGroupCatInput = z.infer<typeof addGroupCatSchema>;
