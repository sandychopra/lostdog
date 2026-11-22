import { hashPassword } from "better-auth/crypto";
import type { CreateUserInput } from "shared/schemas/users.ts";
import { prisma } from "./prisma.ts";

/**
 * Creates a User plus the Better Auth "credential" Account holding their
 * password hash — what sign-up would do, which is disabled (admins add users).
 * Callers validate input and check for a duplicate email first. Returns the id.
 */
export async function createUserWithPassword({
  name,
  email,
  password,
  role,
}: CreateUserInput): Promise<string> {
  const hashedPassword = await hashPassword(password);
  const userId = crypto.randomUUID();
  const now = new Date();

  await prisma.$transaction([
    prisma.user.create({
      data: {
        id: userId,
        name,
        email,
        emailVerified: false,
        role,
        createdAt: now,
        updatedAt: now,
      },
    }),
    prisma.account.create({
      data: {
        id: crypto.randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      },
    }),
  ]);

  return userId;
}
