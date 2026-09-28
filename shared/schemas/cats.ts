import { z } from "zod";
import { CatSex } from "../constants/catSex.ts";
import { DewormerStatus } from "../constants/dewormerStatus.ts";

const emptyToUndefined = (val: unknown) => (val === "" ? undefined : val);

const catFieldsBase = {
  name: z.string().trim().min(1, "Name is required"),
  ageYears: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number("Years must be a number")
      .int("Years must be a whole number")
      .nonnegative("Years must be zero or more")
      .optional(),
  ),
  ageMonths: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number("Months must be a number")
      .int("Months must be a whole number")
      .min(0, "Months must be 0–11")
      .max(11, "Months must be 0–11")
      .optional(),
  ),
  sex: z.enum(CatSex),
  colorPattern: z.string().trim().min(1, "Color/pattern is required"),
  collarColor: z.string().trim().optional().transform(emptyToUndefined),
  microchipNumber: z.string().trim().optional().transform(emptyToUndefined),
  dewormerStatus: z.enum(DewormerStatus),
  dewormerDueDate: z.preprocess(emptyToUndefined, z.coerce.date("Invalid date").optional()),
  needsProbiotic: z.boolean(),
  pickupAt: z.preprocess(emptyToUndefined, z.coerce.date("Invalid date").optional()),
};

const kennelIdField = {
  kennelId: z.coerce
    .number("Kennel is required")
    .int("Must be a whole number")
    .positive("Kennel is required"),
};

// Kennel is optional only at creation — a cat can be created "kennel TBD" (e.g.
// a second cat arriving alongside one that already took the shared kennel,
// pending a Group to reunite them). Editing an ungrouped cat still requires one.
const optionalKennelIdField = {
  kennelId: z.preprocess(
    emptyToUndefined,
    z.coerce.number("Must be a whole number").int().positive().optional(),
  ),
};

const catFields = { ...catFieldsBase, ...kennelIdField };

export const createCatSchema = z.object({ ...catFieldsBase, ...optionalKennelIdField });
export type CreateCatInput = z.infer<typeof createCatSchema>;

export const updateCatSchema = z.object(catFields);
export type UpdateCatInput = z.infer<typeof updateCatSchema>;

// For a cat that's part of a Group: its kennel comes from the Group, not the
// Cat, so kennelId doesn't apply here.
export const updateGroupedCatSchema = z.object(catFieldsBase);
export type UpdateGroupedCatInput = z.infer<typeof updateGroupedCatSchema>;
