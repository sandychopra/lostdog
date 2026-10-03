import { z } from "zod";
import { ChecklistActionType } from "../constants/checklistActionType.ts";

const freeTextTaskSchema = z.object({
  actionType: z.literal(ChecklistActionType.FreeText),
  description: z.string().trim().min(1, "Description is required"),
});

const resetKennelTaskSchema = z.object({
  actionType: z.literal(ChecklistActionType.ResetKennel),
  kennelId: z.coerce.number("Kennel is required").int().positive("Kennel is required"),
});

const moveCatTaskSchema = z
  .object({
    actionType: z.literal(ChecklistActionType.MoveCat),
    kennelId: z.coerce.number("Kennel is required").int().positive("Kennel is required"),
    catId: z.coerce.number().int().positive().optional(),
    groupId: z.coerce.number().int().positive().optional(),
  })
  .refine((task) => (task.catId !== undefined) !== (task.groupId !== undefined), {
    error: "Move steps need exactly one of a cat or group",
  });

const taskSchema = z.discriminatedUnion("actionType", [
  freeTextTaskSchema,
  resetKennelTaskSchema,
  moveCatTaskSchema,
]);
export type TaskInput = z.infer<typeof taskSchema>;

// message is required only when there are no tasks — a task list can stand on
// its own (title + steps), the same way a plain announcement stands on title +
// message with no tasks.
export const createManualAnnouncementSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
    message: z.string().trim().optional(),
    tasks: z.array(taskSchema).default([]),
  })
  .refine((data) => data.tasks.length > 0 || !!data.message, {
    error: "Message is required when there are no tasks",
    path: ["message"],
  });
export type CreateManualAnnouncementInput = z.infer<typeof createManualAnnouncementSchema>;

// Tasks are set once at creation and aren't editable afterward (only
// completable) — editing an announcement only ever touches title/message.
// message stays optional here too: an announcement created with tasks and no
// message must still be editable by title alone. The route enforces that a
// task-less announcement can't be edited down to an empty message.
export const updateManualAnnouncementSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
  message: z.string().trim().optional(),
});
export type UpdateManualAnnouncementInput = z.infer<typeof updateManualAnnouncementSchema>;

// Any Volunteer or Admin can leave one free-text note on any announcement type —
// not gated like the Manual-only create/edit/delete/resolve actions above. An
// empty string clears the comment.
export const announcementCommentSchema = z.object({
  comment: z.string().trim().max(2000, "Comment is too long"),
});
export type AnnouncementCommentInput = z.infer<typeof announcementCommentSchema>;
