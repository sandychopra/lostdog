import { useQuery } from "@tanstack/react-query";
import {
  Pencil,
  Trash2,
  Users2,
  UserMinus,
  LogOut,
  ArrowRightLeft,
  MoreVertical,
} from "lucide-react";
import { Role } from "shared/constants/role.ts";
import { DewormerStatus } from "shared/constants/dewormerStatus.ts";
import { CatStatus } from "shared/constants/catStatus.ts";
import { VALID_STATUS_TRANSITIONS } from "shared/constants/catStatusTransitions.ts";
import { api } from "../lib/api";
import { authClient } from "../lib/auth-client";
import ErrorAlert from "./ErrorAlert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Skeleton } from "./ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

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
  status: CatStatus;
  // Still needed by CatForm/CatEntryFields/GroupCatEntryFields (editing and the
  // shift-report entry checkboxes) even though this table no longer renders
  // them itself — the Overdue-style badges moved to the Announcements page.
  dewormerStatus: DewormerStatus;
  dewormerDueDate: string | null;
  needsProbiotic: boolean;
  pickupAt: string | null;
  kennel: { id: number; number: number } | null;
  group: { id: number; bonded: boolean; kennel: { id: number; number: number } | null } | null;
  litter: { id: number; cats: { id: number; name: string }[] } | null;
}

interface CatsTableProps {
  onEdit: (cat: Cat) => void;
  onDelete: (cat: Cat) => void;
  onRemoveFromGroup: (cat: Cat) => void;
  onEditGroup: (cat: Cat) => void;
  onManageSiblings: (cat: Cat) => void;
  onChangeStatus: (cat: Cat) => void;
  onReturnToRcc: (cat: Cat) => void;
}

const CAT_STATUS_LABELS: Record<CatStatus, string> = {
  [CatStatus.Available]: "Available",
  [CatStatus.PendingAdoption]: "Pending Adoption",
  [CatStatus.Adopted]: "Adopted",
  [CatStatus.PickedUp]: "Picked Up",
};

function catStatusBadgeVariant(status: CatStatus): "default" | "outline" | "warning" | "secondary" {
  switch (status) {
    case CatStatus.Available:
      return "outline";
    case CatStatus.PendingAdoption:
      return "warning";
    case CatStatus.Adopted:
      return "default";
    case CatStatus.PickedUp:
      return "secondary";
  }
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

function siblingsLabel(cat: Cat): string {
  const names = cat.litter?.cats.filter((c) => c.id !== cat.id).map((c) => c.name) ?? [];
  return names.length > 0 ? names.join(", ") : "—";
}

export default function CatsTable({
  onEdit,
  onDelete,
  onRemoveFromGroup,
  onEditGroup,
  onManageSiblings,
  onChangeStatus,
  onReturnToRcc,
}: CatsTableProps) {
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === Role.Admin;

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

  if (error) {
    return <ErrorAlert message="Failed to fetch cats" />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Age</TableHead>
          <TableHead>Sex</TableHead>
          <TableHead>Color/Pattern</TableHead>
          <TableHead>Kennel</TableHead>
          <TableHead>Flags</TableHead>
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
                  <Skeleton className="h-5 w-20 rounded-full" />
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
                <TableCell>
                  <Badge variant={catStatusBadgeVariant(cat.status)}>
                    {CAT_STATUS_LABELS[cat.status]}
                  </Badge>
                </TableCell>
                <TableCell>{ageLabel(cat)}</TableCell>
                <TableCell>{cat.sex}</TableCell>
                <TableCell>{cat.colorPattern}</TableCell>
                <TableCell>{kennelLabel(cat)}</TableCell>
                <TableCell>
                  {cat.pickupAt || cat.litter ? (
                    <div className="flex flex-col gap-1 text-sm">
                      {cat.pickupAt && (
                        <span className="text-muted-foreground">
                          Pickup: {new Date(cat.pickupAt).toLocaleString()}
                        </span>
                      )}
                      {cat.litter && (
                        <span className="text-muted-foreground">
                          Siblings: {siblingsLabel(cat)}
                        </span>
                      )}
                    </div>
                  ) : (
                    "—"
                  )}
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {cat.groupId !== null && (
                        <>
                          <span className="text-sm text-muted-foreground">In Group</span>
                          {cat.group?.bonded && <Badge variant="secondary">Bonded</Badge>}
                        </>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Actions for ${cat.name}`}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => onEdit(cat)}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          {cat.groupId !== null && (
                            <DropdownMenuItem onClick={() => onEditGroup(cat)}>
                              <Users2 className="h-4 w-4" />
                              Edit Group
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => onManageSiblings(cat)}>
                            <Users2 className="h-4 w-4" />
                            Manage Siblings
                          </DropdownMenuItem>
                          {cat.groupId === null &&
                            VALID_STATUS_TRANSITIONS[cat.status].length > 0 && (
                              <DropdownMenuItem onClick={() => onChangeStatus(cat)}>
                                <ArrowRightLeft className="h-4 w-4" />
                                Change Status
                              </DropdownMenuItem>
                            )}
                          {cat.groupId === null && (
                            <DropdownMenuItem onClick={() => onReturnToRcc(cat)}>
                              <LogOut className="h-4 w-4" />
                              Return to RCC
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {cat.groupId !== null ? (
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => onRemoveFromGroup(cat)}
                            >
                              <UserMinus className="h-4 w-4" />
                              Remove from Group
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem variant="destructive" onClick={() => onDelete(cat)}>
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
}
