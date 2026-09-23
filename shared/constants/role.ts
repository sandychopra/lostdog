export const Role = {
  Volunteer: "Volunteer",
  Admin: "Admin",
} as const;

export type Role = (typeof Role)[keyof typeof Role];
