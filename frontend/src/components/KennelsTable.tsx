import { useQuery } from "@tanstack/react-query";
import { Pencil, Trash2, Move, X } from "lucide-react";
import { Role } from "shared/constants/role.ts";
import { KennelState } from "shared/constants/kennelState.ts";
import { api } from "../lib/api";
import { authClient } from "../lib/auth-client";
import ErrorAlert from "./ErrorAlert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Skeleton } from "./ui/skeleton";

interface KennelCat {
  id: number;
  name: string;
}

interface KennelGroup {
  id: number;
  bonded: boolean;
  cats: KennelCat[];
}

export interface Kennel {
  id: number;
  number: number;
  state: KennelState;
  cats: KennelCat[];
  groups: KennelGroup[];
}

export interface KennelMoveRequest {
  id: number;
  cat: { id: number; name: string } | null;
  group: { id: number; cats: { id: number; name: string }[] } | null;
  fromKennel: { id: number; number: number };
  toKennel: { id: number; number: number };
}

interface KennelsTableProps {
  onEdit: (kennel: Kennel) => void;
  onDelete: (kennel: Kennel) => void;
  onRequestMove: (kennel: Kennel) => void;
  onCancelMoveRequest: (request: KennelMoveRequest) => void;
}

function kennelStateBadgeVariant(
  state: KennelState,
): "default" | "outline" | "warning" | "secondary" {
  switch (state) {
    case KennelState.Occupied:
      return "default";
    case KennelState.Ready:
      return "outline";
    case KennelState.NeedsReset:
      return "warning";
    case KennelState.Planned:
      return "secondary";
  }
}

export function occupantLabel(kennel: Kennel): string {
  const names = [
    ...kennel.cats.map((c) => c.name),
    ...kennel.groups.flatMap((g) => g.cats.map((c) => c.name)),
  ];
  return names.length > 0 ? names.join(", ") : "—";
}

export default function KennelsTable({
  onEdit,
  onDelete,
  onRequestMove,
  onCancelMoveRequest,
}: KennelsTableProps) {
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === Role.Admin;

  const {
    data: kennels,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["kennels"],
    queryFn: async () => {
      const { data } = await api.get<{ kennels: Kennel[] }>("/api/kennels");
      return data.kennels;
    },
  });

  const { data: openMoveRequests } = useQuery({
    queryKey: ["kennel-move-requests", "open"],
    queryFn: async () => {
      const { data } = await api.get<{ kennelMoveRequests: KennelMoveRequest[] }>(
        "/api/kennel-move-requests",
      );
      return data.kennelMoveRequests;
    },
  });

  const moveRequestByFromKennelId = new Map(
    (openMoveRequests ?? []).map((request) => [request.fromKennel.id, request]),
  );

  if (error) {
    return <ErrorAlert message="Failed to fetch kennels" />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Number</TableHead>
          <TableHead>State</TableHead>
          <TableHead>Occupant</TableHead>
          {isAdmin && <TableHead>Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading
          ? Array.from({ length: 7 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-8" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    <Skeleton className="h-8 w-8 rounded" />
                  </TableCell>
                )}
              </TableRow>
            ))
          : kennels?.map((kennel) => (
              <TableRow key={kennel.id}>
                <TableCell>{kennel.number}</TableCell>
                <TableCell>
                  <Badge variant={kennelStateBadgeVariant(kennel.state)}>{kennel.state}</Badge>
                </TableCell>
                <TableCell>{occupantLabel(kennel)}</TableCell>
                {isAdmin && (
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(kennel)}
                        aria-label={`Edit kennel ${kennel.number}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(kennel)}
                        aria-label={`Delete kennel ${kennel.number}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      {moveRequestByFromKennelId.has(kennel.id) ? (
                        <>
                          <span className="text-sm text-muted-foreground">
                            Move requested → Kennel{" "}
                            {moveRequestByFromKennelId.get(kennel.id)!.toKennel.number}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              onCancelMoveRequest(moveRequestByFromKennelId.get(kennel.id)!)
                            }
                            aria-label={`Cancel move request for kennel ${kennel.number}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        (kennel.cats.length > 0 || kennel.groups.length > 0) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onRequestMove(kennel)}
                            aria-label={`Request move for kennel ${kennel.number}`}
                          >
                            <Move className="h-4 w-4" />
                          </Button>
                        )
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
}
