import { useQuery } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
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

interface KennelsTableProps {
  onEdit: (kennel: Kennel) => void;
  onDelete: (kennel: Kennel) => void;
}

export function occupantLabel(kennel: Kennel): string {
  const names = [
    ...kennel.cats.map((c) => c.name),
    ...kennel.groups.flatMap((g) => g.cats.map((c) => c.name)),
  ];
  return names.length > 0 ? names.join(", ") : "—";
}

export default function KennelsTable({ onEdit, onDelete }: KennelsTableProps) {
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
                  <Badge variant={kennel.state === KennelState.Occupied ? "default" : "secondary"}>
                    {kennel.state}
                  </Badge>
                </TableCell>
                <TableCell>{occupantLabel(kennel)}</TableCell>
                {isAdmin && (
                  <TableCell>
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
                  </TableCell>
                )}
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
}
