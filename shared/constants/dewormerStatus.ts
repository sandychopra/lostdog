export const DewormerStatus = {
  NotNeeded: "NotNeeded",
  Due: "Due",
  Given: "Given",
} as const;

export type DewormerStatus = (typeof DewormerStatus)[keyof typeof DewormerStatus];

export const DEWORMER_STATUS_LABELS: Record<DewormerStatus, string> = {
  [DewormerStatus.NotNeeded]: "Not needed",
  [DewormerStatus.Due]: "Due",
  [DewormerStatus.Given]: "Given",
};
