import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Users2, UserMinus } from "lucide-react";
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
  lastProbioticGivenAt: string | null;
  pickupAt: string | null;
  kennel: { id: number; number: number } | null;
  group: { id: number; bonded: boolean; kennel: { id: number; number: number } | null } | null;
  litter: { id: number; cats: { id: number; name: string }[] } | null;
}

interface CatsTableProps {
  onEdit: (cat: Cat) => void;
  onDelete: (cat: Cat) => void;
  onRemoveFromGroup: (cat: Cat) => void;
  onManageSiblings: (cat: Cat) => void;
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

// Same 24h-since-last-dose pattern as dewormer's isOverdue() above, but the
// "dose" here is derived server-side from CatEntry/GroupEntryCatDetail history
// rather than a stored due date.
function isProbioticOverdue(cat: Cat): boolean {
  if (!cat.needsProbiotic) return false;
  if (!cat.lastProbioticGivenAt) return true;
  return Date.now() - new Date(cat.lastProbioticGivenAt).getTime() > 24 * 60 * 60 * 1000;
}

function siblingsLabel(cat: Cat): string {
  const names = cat.litter?.cats.filter((c) => c.id !== cat.id).map((c) => c.name) ?? [];
  return names.length > 0 ? names.join(", ") : "—";
}

export default function CatsTable({
  onEdit,
  onDelete,
  onRemoveFromGroup,
  onManageSiblings,
}: CatsTableProps) {
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
          <TableHead>Pickup</TableHead>
          <TableHead>Siblings</TableHead>
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
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
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
                  {cat.needsProbiotic ? (
                    <div className="flex items-center gap-2">
                      <Badge variant={isProbioticOverdue(cat) ? "destructive" : "default"}>
                        {isProbioticOverdue(cat) ? "Overdue" : "Needs Probiotic"}
                      </Badge>
                      {cat.lastProbioticGivenAt && (
                        <span className="text-sm text-muted-foreground">
                          Last: {new Date(cat.lastProbioticGivenAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  {cat.pickupAt ? new Date(cat.pickupAt).toLocaleString() : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{siblingsLabel(cat)}</span>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onManageSiblings(cat)}
                        aria-label={`Manage siblings for ${cat.name}`}
                      >
                        <Users2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    {cat.groupId !== null ? (
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-muted-foreground">In Group</span>
                        {cat.group?.bonded && <Badge variant="secondary">Bonded</Badge>}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onRemoveFromGroup(cat)}
                          aria-label={`Remove ${cat.name} from group`}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </div>
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
