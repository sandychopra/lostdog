import { z } from "zod";
import { ChecklistActionType } from "../constants/checklistActionType.ts";

const checklistActionSchema = z
  .object({
    actionType: z.enum(ChecklistActionType),
    kennelId: z.coerce.number("Kennel is required").int().positive(),
    catId: z.coerce.number().int().positive().optional(),
    groupId: z.coerce.number().int().positive().optional(),
  })
  .refine(
    (action) =>
      action.actionType === ChecklistActionType.MoveCat
        ? (action.catId !== undefined) !== (action.groupId !== undefined)
        : action.catId === undefined && action.groupId === undefined,
    { error: "Move steps need exactly one of a cat or group; Reset steps need neither" },
  );

export const createChecklistSchema = z.object({
  actions: z.array(checklistActionSchema).min(1, "Add at least one step"),
});

export type CreateChecklistInput = z.infer<typeof createChecklistSchema>;
