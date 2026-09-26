import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { prisma } from "./prisma.ts";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  databaseHooks: {
    session: {
      create: {
        // Soft-deleted users keep their credentials, so block them at session creation.
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { deletedAt: true },
          });
          if (user?.deletedAt) {
            throw new APIError("FORBIDDEN", { message: "This account has been deactivated." });
          }
        },
      },
    },
  },
  emailAndPassword: { enabled: true, disableSignUp: true },
  trustedOrigins: [process.env.FRONTEND_URL!],
  user: {
    additionalFields: {
      role: {
        type: ["Volunteer", "Admin"],
        required: false,
        defaultValue: "Volunteer",
        input: false,
      },
      deletedAt: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },
});
