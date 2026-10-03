import { z } from "zod";
import { ShiftType } from "../constants/shiftType.ts";
import { CatEntryType } from "../constants/catEntryType.ts";
import { FoodAmount } from "../constants/foodAmount.ts";
import { SnackTreat } from "../constants/snackTreat.ts";
import { SplitShiftPosition } from "../constants/splitShiftPosition.ts";
import { ReportableKennelState } from "../constants/kennelState.ts";

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
  foodNotes: z.string().trim().optional().transform(emptyToUndefined),
  medicalNotes: z.string().trim().optional().transform(emptyToUndefined),
  otherNotes: z.string().trim().optional().transform(emptyToUndefined),
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
  medicalNotes: z.string().trim().optional().transform(emptyToUndefined),
  otherNotes: z.string().trim().optional().transform(emptyToUndefined),
});

function buildGroupCatEntrySchema(strict: boolean) {
  return z.object({
    id: z.coerce.number().int().positive().optional(),
    entryType: z.literal(CatEntryType.Group),
    groupId: z.coerce.number("Group is required").int().positive("Group is required"),
    fecalScore: fecalScoreField,
    pee: z.boolean().default(false),
    peePooNotes: z.string().trim().optional().transform(emptyToUndefined),
    dryFoodAmount: foodAmountField,
    foodNotes: z.string().trim().optional().transform(emptyToUndefined),
    otherNotes: z.string().trim().optional().transform(emptyToUndefined),
    catDetails: z.array(groupEntryCatDetailSchema).min(strict ? 1 : 0, "Add at least one cat"),
  });
}

// z.discriminatedUnion requires plain ZodObject members, so the "distinct cats
// within a group entry" check is applied to the union as a whole afterward,
// not on groupCatEntrySchema directly.
function buildCatEntrySchema(strict: boolean) {
  return z
    .discriminatedUnion("entryType", [individualCatEntrySchema, buildGroupCatEntrySchema(strict)])
    .refine(
      (entry) =>
        entry.entryType !== CatEntryType.Group ||
        new Set(entry.catDetails.map((c) => c.catId)).size === entry.catDetails.length,
      { error: "Cats must be distinct within a group entry", path: ["catDetails"] },
    );
}

function buildMeetAndGreetSchema(strict: boolean) {
  return z.object({
    id: z.coerce.number().int().positive().optional(),
    note: z.string().trim().min(1, "Note is required"),
    catIds: distinctCatIds("Cats must be distinct").min(strict ? 1 : 0, "Tag at least one cat"),
  });
}

// reportedState excludes Planned on purpose — that value stays admin-only,
// set from the Kennel edit form, not something a volunteer reports during a
// shift. No note field: a reported state that conflicts with the kennel's
// current state is just logged as-is — anything worth explaining goes in the
// report's general Kennel Notes field instead.
const kennelStatusSchema = z.object({
  kennelId: z.coerce.number("Kennel is required").int().positive("Kennel is required"),
  reportedState: z.enum(ReportableKennelState),
});

// Same shape as meetAndGreetSchema — kept separate since they're different
// domain concepts (cats that played together + a note, vs. a meet-and-greet).
function buildPlayGroupSchema(strict: boolean) {
  return z.object({
    id: z.coerce.number().int().positive().optional(),
    note: z.string().trim().min(1, "Note is required"),
    catIds: distinctCatIds("Cats must be distinct").min(strict ? 1 : 0, "Tag at least one cat"),
  });
}

function buildShiftReportFields(strict: boolean) {
  return {
    shiftType: z.enum(ShiftType),
    date: z.coerce.date("Invalid date"),
    isSplitShift: z.boolean().default(false),
    splitShiftPosition: splitShiftPositionField,
    cleaningNotes: z.string().trim().optional().transform(emptyToUndefined),
    suppliesNotes: z.string().trim().optional().transform(emptyToUndefined),
    kennelNotes: z.string().trim().optional().transform(emptyToUndefined),
    otherNotes: z.string().trim().optional().transform(emptyToUndefined),
    catEntries: z.array(buildCatEntrySchema(strict)).default([]),
    meetAndGreets: z.array(buildMeetAndGreetSchema(strict)).default([]),
    playGroups: z.array(buildPlayGroupSchema(strict)).default([]),
    kennelsStatus: z
      .array(kennelStatusSchema)
      .refine(
        (items) => new Set(items.map((i) => i.kennelId)).size === items.length,
        "Kennels must be distinct",
      )
      .default([]),
  };
}

export type GroupEntryCatDetailInput = z.infer<typeof groupEntryCatDetailSchema>;
export type IndividualCatEntryInput = z.infer<typeof individualCatEntrySchema>;
export type GroupCatEntryInput = z.infer<ReturnType<typeof buildGroupCatEntrySchema>>;
export type CatEntryInput = z.infer<ReturnType<typeof buildCatEntrySchema>>;
export type MeetAndGreetInput = z.infer<ReturnType<typeof buildMeetAndGreetSchema>>;
export type PlayGroupInput = z.infer<ReturnType<typeof buildPlayGroupSchema>>;
export type KennelStatusInput = z.infer<typeof kennelStatusSchema>;

export const createShiftReportSchema = z
  .object(buildShiftReportFields(true))
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

// Lenient content schema for an in-progress report: drops the completeness
// checks above (empty group entries/meet-and-greets/play groups are fine to
// save mid-shift) and the split-shift refines (so saving a draft before
// finishing the Shift Type section doesn't bounce), but keeps every
// correctness check (distinct cats/kennels) unconditional — a draft can be
// incomplete, but never internally inconsistent.
export const draftShiftReportSchema = z.object(buildShiftReportFields(false));
export type DraftShiftReportInput = z.infer<typeof draftShiftReportSchema>;
