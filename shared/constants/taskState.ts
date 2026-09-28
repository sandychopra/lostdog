export const TaskState = {
  Open: "Open",
  Done: "Done",
  Cancelled: "Cancelled",
} as const;

export type TaskState = (typeof TaskState)[keyof typeof TaskState];
