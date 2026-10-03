export const ShiftReportStatus = {
  Draft: "Draft",
  Submitted: "Submitted",
} as const;

export type ShiftReportStatus = (typeof ShiftReportStatus)[keyof typeof ShiftReportStatus];
