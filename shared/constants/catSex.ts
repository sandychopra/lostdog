export const CatSex = {
  Male: "Male",
  Female: "Female",
  Unknown: "Unknown",
} as const;

export type CatSex = (typeof CatSex)[keyof typeof CatSex];
