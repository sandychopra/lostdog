export const DewormerStatus = {
  Due: "Due",
  Given: "Given",
} as const;

export type DewormerStatus = (typeof DewormerStatus)[keyof typeof DewormerStatus];
