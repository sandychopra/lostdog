import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { Role } from "shared/constants/role.ts";
import { authClient } from "../lib/auth-client";

export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <main className="mx-auto max-w-sm px-6 py-16 text-center">
        <p>Loading...</p>
      </main>
    );
  }

  if (session?.user.role !== Role.Admin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
