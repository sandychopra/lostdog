import { z } from "zod";
import { CatSex } from "../constants/catSex.ts";
import { DewormerStatus } from "../constants/dewormerStatus.ts";

const emptyToUndefined = (val: unknown) => (val === "" ? undefined : val);

const catFields = {
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
  kennelId: z.coerce
    .number("Kennel is required")
    .int("Must be a whole number")
    .positive("Kennel is required"),
  dewormerStatus: z.enum(DewormerStatus),
  dewormerDueDate: z.preprocess(emptyToUndefined, z.coerce.date("Invalid date").optional()),
  needsProbiotic: z.boolean(),
  pickupAt: z.preprocess(emptyToUndefined, z.coerce.date("Invalid date").optional()),
};

export const createCatSchema = z.object(catFields);
export type CreateCatInput = z.infer<typeof createCatSchema>;

export const updateCatSchema = z.object(catFields);
export type UpdateCatInput = z.infer<typeof updateCatSchema>;
