import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma.ts";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
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
