import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { authClient } from "../lib/auth-client";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
        <p>Loading...</p>
      </main>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
