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
  // Better Auth's own rate limiter (on in production) and session IP tracking read
  // X-Forwarded-For by default; behind a proxy that sends the client IP in its own
  // header instead (CLIENT_IP_HEADER, see index.ts) read that, or every client
  // would share one rate-limit bucket.
  ...(process.env.CLIENT_IP_HEADER?.trim() && {
    advanced: { ipAddress: { ipAddressHeaders: [process.env.CLIENT_IP_HEADER.trim()] } },
  }),
  // TUNNEL_URL: optional public origin of a dev tunnel (e.g. ngrok) in front of the frontend.
  trustedOrigins: [
    process.env.FRONTEND_URL!,
    ...(process.env.TUNNEL_URL ? [process.env.TUNNEL_URL] : []),
  ],
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
