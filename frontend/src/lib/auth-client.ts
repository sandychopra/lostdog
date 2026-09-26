import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { API_BASE } from "./config";
import type { auth } from "../../../backend/src/lib/auth.ts";

export const authClient = createAuthClient({
  baseURL: API_BASE,
  plugins: [inferAdditionalFields<typeof auth>()],
});
