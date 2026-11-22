import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { ActivityEntityType } from "shared/constants/activityLog.ts";
import { api } from "../lib/api";
import ActivitySection from "./ActivitySection";
import ErrorAlert from "./ErrorAlert";
import AppLayout from "./AppLayout";
import { kennelStateBadgeVariant, occupantLabel, type Kennel } from "./KennelsTable";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";

export default function KennelDetailPage() {
  const id = Number(useParams().id);

  const { data: kennel, error } = useQuery({
    queryKey: ["kennels", "detail", id],
    queryFn: async () => {
      const { data } = await api.get<{ kennels: Kennel[] }>("/api/kennels?includeArchived=true");
      const found = data.kennels.find((k) => k.id === id);
      if (!found) throw new Error("Kennel not found");
      return found;
    },
  });

  return (
    <AppLayout width="4xl" className="space-y-8">
      {error ? (
        <ErrorAlert message="Kennel not found" />
      ) : !kennel ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <section className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold">Kennel {kennel.number}</h1>
            {kennel.deletedAt ? (
              <Badge variant="outline">Archived</Badge>
            ) : (
              <Badge variant={kennelStateBadgeVariant(kennel.state)}>{kennel.state}</Badge>
            )}
          </div>
          <p className="text-sm">
            <span className="text-muted-foreground">Occupant: </span>
            {kennel.cats.map((cat, i) => (
              <span key={cat.id}>
                {i > 0 && ", "}
                <Link to={`/cats/${cat.id}`} className="text-blue hover:underline">
                  {cat.name}
                </Link>
              </span>
            ))}
            {kennel.groups
              .flatMap((g) => g.cats)
              .map((cat, i) => (
                <span key={cat.id}>
                  {(i > 0 || kennel.cats.length > 0) && ", "}
                  <Link to={`/cats/${cat.id}`} className="text-blue hover:underline">
                    {cat.name}
                  </Link>
                </span>
              ))}
            {occupantLabel(kennel) === "—" && "—"}
          </p>
          <p className="text-sm">
            <Link to="/shift-reports" className="text-blue hover:underline">
              Search shift reports
            </Link>{" "}
            <span className="text-muted-foreground">
              (filter by Kennel {kennel.number} to see reports mentioning it)
            </span>
          </p>
        </section>
      )}

      <ActivitySection entityType={ActivityEntityType.Kennel} entityId={id} />
    </AppLayout>
  );
}
