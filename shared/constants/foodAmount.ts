export const FoodAmount = {
  None: "None",
  Some: "Some",
  Most: "Most",
  All: "All",
} as const;

export type FoodAmount = (typeof FoodAmount)[keyof typeof FoodAmount];
