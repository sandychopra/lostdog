import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { Role } from "shared/constants/role.ts";
import { DewormerStatus } from "shared/constants/dewormerStatus.ts";
import { api } from "../lib/api";
import { authClient } from "../lib/auth-client";
import ErrorAlert from "./ErrorAlert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Skeleton } from "./ui/skeleton";

export interface Cat {
  id: number;
  name: string;
  ageYears: number | null;
  ageMonths: number | null;
  sex: string;
  colorPattern: string;
  collarColor: string | null;
  microchipNumber: string | null;
  kennelId: number | null;
  groupId: number | null;
  dewormerStatus: DewormerStatus;
  dewormerDueDate: string | null;
  needsProbiotic: boolean;
  kennel: { id: number; number: number } | null;
  group: { id: number; kennel: { id: number; number: number } | null } | null;
}

interface CatsTableProps {
  onEdit: (cat: Cat) => void;
  onDelete: (cat: Cat) => void;
}

function kennelLabel(cat: Cat): string {
  const number = cat.kennel?.number ?? cat.group?.kennel?.number;
  return number !== undefined ? String(number) : "—";
}

function ageLabel(cat: Cat): string {
  const parts = [];
  if (cat.ageYears) parts.push(`${cat.ageYears}y`);
  if (cat.ageMonths) parts.push(`${cat.ageMonths}m`);
  return parts.length > 0 ? parts.join(" ") : "—";
}

function isOverdue(cat: Cat): boolean {
  if (cat.dewormerStatus !== DewormerStatus.Due || !cat.dewormerDueDate) return false;
  return new Date(cat.dewormerDueDate) < new Date();
}

export default function CatsTable({ onEdit, onDelete }: CatsTableProps) {
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === Role.Admin;
  const queryClient = useQueryClient();

  const {
    data: cats,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["cats"],
    queryFn: async () => {
      const { data } = await api.get<{ cats: Cat[] }>("/api/cats");
      return data.cats;
    },
  });

  const dewormerMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/api/cats/${id}/dewormer`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cats"] });
    },
  });

  if (error) {
    return <ErrorAlert message="Failed to fetch cats" />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Age</TableHead>
          <TableHead>Sex</TableHead>
          <TableHead>Color/Pattern</TableHead>
          <TableHead>Kennel</TableHead>
          <TableHead>Dewormer</TableHead>
          <TableHead>Probiotic</TableHead>
          {isAdmin && <TableHead>Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-8" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-8" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    <Skeleton className="h-8 w-8 rounded" />
                  </TableCell>
                )}
              </TableRow>
            ))
          : cats?.map((cat) => (
              <TableRow key={cat.id}>
                <TableCell>{cat.name}</TableCell>
                <TableCell>{ageLabel(cat)}</TableCell>
                <TableCell>{cat.sex}</TableCell>
                <TableCell>{cat.colorPattern}</TableCell>
                <TableCell>{kennelLabel(cat)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        cat.dewormerStatus === DewormerStatus.Given
                          ? "secondary"
                          : isOverdue(cat)
                            ? "destructive"
                            : "default"
                      }
                    >
                      {isOverdue(cat) ? "Overdue" : cat.dewormerStatus}
                    </Badge>
                    {cat.dewormerStatus === DewormerStatus.Due && cat.dewormerDueDate && (
                      <span className="text-sm text-muted-foreground">
                        {new Date(cat.dewormerDueDate).toLocaleDateString()}
                      </span>
                    )}
                    {cat.dewormerStatus === DewormerStatus.Due && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={dewormerMutation.isPending}
                        onClick={() => dewormerMutation.mutate(cat.id)}
                      >
                        Mark Given
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {cat.needsProbiotic ? <Badge variant="default">Needs Probiotic</Badge> : "—"}
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    {cat.groupId !== null ? (
                      <span className="text-sm text-muted-foreground">In Group</span>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(cat)}
                          aria-label={`Edit ${cat.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(cat)}
                          aria-label={`Delete ${cat.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
}
