import { z } from "zod";
import { Role } from "../constants/role.ts";

// Stored exactly as typed (the login form doesn't trim), but surrounding spaces
// don't count toward the minimum, so an all-spaces password is still rejected.
const passwordSchema = z
  .string()
  .refine((value) => value.trim().length >= 8, "Password must be at least 8 characters");

export const createUserSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters"),
  email: z.email("Invalid email address"),
  password: passwordSchema,
  role: z.enum(Role),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters"),
  email: z.email("Invalid email address"),
  password: z.union([z.literal(""), passwordSchema]),
  role: z.enum(Role),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
