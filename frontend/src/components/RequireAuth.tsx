import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { authClient } from "../lib/auth-client";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <main className="mx-auto max-w-sm px-6 py-16 text-center">
        <p>Loading...</p>
      </main>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
