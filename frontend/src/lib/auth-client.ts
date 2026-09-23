import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "../../../backend/src/lib/auth.ts";

export const authClient = createAuthClient({
  baseURL: "http://localhost:4000",
  plugins: [inferAdditionalFields<typeof auth>()],
});
