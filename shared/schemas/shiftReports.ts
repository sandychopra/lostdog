import { z } from "zod";
import { ShiftType } from "../constants/shiftType.ts";
import { CatEntryType } from "../constants/catEntryType.ts";
import { FoodAmount } from "../constants/foodAmount.ts";
import { SnackTreat } from "../constants/snackTreat.ts";
import { SplitShiftPosition } from "../constants/splitShiftPosition.ts";

const emptyToUndefined = <T>(val: T): T | undefined => (val === "" ? undefined : val);

const distinctCatIds = (message: string) =>
  z
    .array(z.coerce.number().int().positive())
    .refine((ids) => new Set(ids).size === ids.length, message);

const fecalScoreField = z.preprocess(
  emptyToUndefined,
  z.coerce
    .number("Fecal score must be a number")
    .int("Fecal score must be a whole number")
    .min(1, "Fecal score must be 1–7")
    .max(7, "Fecal score must be 1–7")
    .optional(),
);

// Native <select> elements always submit a string, so an unselected/"None"
// option submits "" rather than omitting the field — z.enum(...).optional()
// only accepts undefined, not "", so this coerces "" to undefined first.
const foodAmountField = z.preprocess(emptyToUndefined, z.enum(FoodAmount).optional());
const snackTreatField = z.preprocess(emptyToUndefined, z.enum(SnackTreat).optional());
const splitShiftPositionField = z.preprocess(
  emptyToUndefined,
  z.enum(SplitShiftPosition).optional(),
);

const groupEntryCatDetailSchema = z.object({
  catId: z.coerce.number("Cat is required").int().positive("Cat is required"),
  wetFoodAmount: foodAmountField,
  wetFoodBrand: z.string().trim().optional().transform(emptyToUndefined),
  snackTreat: snackTreatField,
  snackTreatNote: z.string().trim().optional().transform(emptyToUndefined),
  foodNotes: z.string().trim().optional().transform(emptyToUndefined),
  medicalNotes: z.string().trim().optional().transform(emptyToUndefined),
  dewormerGiven: z.boolean().default(false),
  probioticGiven: z.boolean().default(false),
  behaviorNotes: z.string().trim().optional().transform(emptyToUndefined),
  otherNotes: z.string().trim().optional().transform(emptyToUndefined),
  nailTrim: z.boolean().default(false),
});

const individualCatEntrySchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  entryType: z.literal(CatEntryType.Individual),
  catId: z.coerce.number("Cat is required").int().positive("Cat is required"),
  fecalScore: fecalScoreField,
  pee: z.boolean().default(false),
  peePooNotes: z.string().trim().optional().transform(emptyToUndefined),
  dryFoodAmount: foodAmountField,
  wetFoodAmount: foodAmountField,
  wetFoodBrand: z.string().trim().optional().transform(emptyToUndefined),
  foodNotes: z.string().trim().optional().transform(emptyToUndefined),
  snackTreat: snackTreatField,
  snackTreatNote: z.string().trim().optional().transform(emptyToUndefined),
  medicalNotes: z.string().trim().optional().transform(emptyToUndefined),
  dewormerGiven: z.boolean().default(false),
  probioticGiven: z.boolean().default(false),
  behaviorNotes: z.string().trim().optional().transform(emptyToUndefined),
  otherNotes: z.string().trim().optional().transform(emptyToUndefined),
  nailTrim: z.boolean().default(false),
});

const groupCatEntrySchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  entryType: z.literal(CatEntryType.Group),
  groupId: z.coerce.number("Group is required").int().positive("Group is required"),
  fecalScore: fecalScoreField,
  pee: z.boolean().default(false),
  peePooNotes: z.string().trim().optional().transform(emptyToUndefined),
  dryFoodAmount: foodAmountField,
  foodNotes: z.string().trim().optional().transform(emptyToUndefined),
  otherNotes: z.string().trim().optional().transform(emptyToUndefined),
  catDetails: z.array(groupEntryCatDetailSchema).min(1, "Add at least one cat"),
});

// z.discriminatedUnion requires plain ZodObject members, so the "distinct cats
// within a group entry" check is applied to the union as a whole afterward,
// not on groupCatEntrySchema directly.
const catEntrySchema = z
  .discriminatedUnion("entryType", [individualCatEntrySchema, groupCatEntrySchema])
  .refine(
    (entry) =>
      entry.entryType !== CatEntryType.Group ||
      new Set(entry.catDetails.map((c) => c.catId)).size === entry.catDetails.length,
    { error: "Cats must be distinct within a group entry", path: ["catDetails"] },
  );

const meetAndGreetSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  note: z.string().trim().min(1, "Note is required"),
  catIds: distinctCatIds("Cats must be distinct").min(1, "Tag at least one cat"),
});

// Same shape as meetAndGreetSchema — kept separate since they're different
// domain concepts (cats that played together + a note, vs. a meet-and-greet).
const playGroupSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  note: z.string().trim().min(1, "Note is required"),
  catIds: distinctCatIds("Cats must be distinct").min(1, "Tag at least one cat"),
});

const shiftReportFields = {
  shiftType: z.enum(ShiftType),
  date: z.coerce.date("Invalid date"),
  isSplitShift: z.boolean().default(false),
  splitShiftPosition: splitShiftPositionField,
  cleaningNotes: z.string().trim().optional().transform(emptyToUndefined),
  suppliesNotes: z.string().trim().optional().transform(emptyToUndefined),
  kennelNotes: z.string().trim().optional().transform(emptyToUndefined),
  otherNotes: z.string().trim().optional().transform(emptyToUndefined),
  catEntries: z.array(catEntrySchema).default([]),
  meetAndGreets: z.array(meetAndGreetSchema).default([]),
  playGroups: z.array(playGroupSchema).default([]),
  kennelsResetIds: distinctCatIds("Kennels must be distinct").default([]),
  kennelsFlaggedIds: distinctCatIds("Kennels must be distinct").default([]),
  signTasksCompletedIds: distinctCatIds("Sign tasks must be distinct").default([]),
  pickupsConfirmedIds: distinctCatIds("Cats must be distinct").default([]),
  kennelMoveRequestsCompletedIds: distinctCatIds("Kennel move requests must be distinct").default(
    [],
  ),
  checklistActionsCompletedIds: distinctCatIds("Checklist actions must be distinct").default([]),
};

export type GroupEntryCatDetailInput = z.infer<typeof groupEntryCatDetailSchema>;
export type IndividualCatEntryInput = z.infer<typeof individualCatEntrySchema>;
export type GroupCatEntryInput = z.infer<typeof groupCatEntrySchema>;
export type CatEntryInput = z.infer<typeof catEntrySchema>;
export type MeetAndGreetInput = z.infer<typeof meetAndGreetSchema>;
export type PlayGroupInput = z.infer<typeof playGroupSchema>;

export const createShiftReportSchema = z
  .object(shiftReportFields)
  .refine((data) => data.kennelsResetIds.every((id) => !data.kennelsFlaggedIds.includes(id)), {
    error: "A kennel can't be both reset and flagged in the same report",
    path: ["kennelsFlaggedIds"],
  })
  .refine((data) => !data.isSplitShift || data.shiftType !== ShiftType.MidDay, {
    error: "Split shift only applies to Morning or Evening",
    path: ["isSplitShift"],
  })
  .refine((data) => !data.isSplitShift || data.splitShiftPosition !== undefined, {
    error: "Select First or Second shift",
    path: ["splitShiftPosition"],
  });
export type CreateShiftReportInput = z.infer<typeof createShiftReportSchema>;

export const updateShiftReportSchema = createShiftReportSchema;
export type UpdateShiftReportInput = z.infer<typeof updateShiftReportSchema>;
