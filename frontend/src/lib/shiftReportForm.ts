import type { Resolver, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { draftShiftReportSchema, type DraftShiftReportInput } from "shared/schemas/shiftReports.ts";

// The shift report form's react-hook-form instance, as passed to its section
// components.
//
// Its field values are typed as the *parsed* shape (DraftShiftReportInput)
// rather than the schema's raw input (z.input), because zod types every
// z.coerce/z.preprocess field's input as `unknown` — which would make each
// watched value (catId, fecalScore, food amounts, …) `unknown` in the section
// components. Raw values can still be strings until validated (e.g. a native
// <select>'s value), so components coerce with Number() before comparing ids.
export type ShiftReportFormApi = UseFormReturn<
  DraftShiftReportInput,
  unknown,
  DraftShiftReportInput
>;

export const shiftReportResolver = zodResolver(draftShiftReportSchema) as unknown as Resolver<
  DraftShiftReportInput,
  unknown,
  DraftShiftReportInput
>;
