export const SignAction = {
  PostPending: "PostPending",
  PostAdopted: "PostAdopted",
  RemovePending: "RemovePending",
  RemoveAdopted: "RemoveAdopted",
} as const;

export type SignAction = (typeof SignAction)[keyof typeof SignAction];
