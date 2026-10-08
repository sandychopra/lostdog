import { useQuery } from "@tanstack/react-query";
import { Role } from "shared/constants/role.ts";
import type { ActivityEntityType } from "shared/constants/activityLog.ts";
import { api } from "../lib/api";
import { authClient } from "../lib/auth-client";
import ErrorAlert from "./ErrorAlert";
import { Skeleton } from "./ui/skeleton";

interface ActivityEntry {
  id: number;
  action: "Create" | "Update" | "Delete";
  description: string;
  createdAt: string;
  actor: { id: string; name: string } | null;
}

// Admin-only audit trail. Renders nothing for Volunteers (the endpoint also refuses them).
export default function ActivitySection({
  entityType,
  entityId,
}: {
  entityType: ActivityEntityType;
  entityId: number;
}) {
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === Role.Admin;

  const { data, isLoading, error } = useQuery({
    queryKey: ["activity", entityType, entityId],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await api.get<{ activity: ActivityEntry[] }>("/api/activity-log", {
        params: { entityType, entityId, limit: 200 },
      });
      return data.activity;
    },
  });

  if (!isAdmin) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">Activity history</h2>
      {error ? (
        <ErrorAlert message="Failed to fetch activity history" />
      ) : isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : data && data.length > 0 ? (
        <ul className="divide-y rounded-md border text-sm">
          {data.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-baseline gap-x-3 px-3 py-2">
              <span className="text-muted-foreground">
                {new Date(entry.createdAt).toLocaleString()}
              </span>
              <span className="font-medium">{entry.actor?.name ?? "System"}</span>
              <span>
                {entry.action}: {entry.description}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No recorded changes yet.</p>
      )}
    </section>
  );
}
