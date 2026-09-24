import { z } from "zod";
import { Role } from "../constants/role.ts";

export const createUserSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters"),
  email: z.email("Invalid email address"),
  password: z.string().trim().min(8, "Password must be at least 8 characters"),
  role: z.enum(Role),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters"),
  email: z.email("Invalid email address"),
  password: z.union([
    z.literal(""),
    z.string().trim().min(8, "Password must be at least 8 characters"),
  ]),
  role: z.enum(Role),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
