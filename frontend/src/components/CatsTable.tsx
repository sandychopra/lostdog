import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
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
import { cn } from "../lib/utils";
import { authClient } from "../lib/auth-client";
import ErrorAlert from "./ErrorAlert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { Card } from "./ui/card";
import CollarDot from "./CollarDot";
import KennelTile from "./KennelTile";
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
  litterId: number | null;
  status: CatStatus;
  active: boolean;
  // Still needed by CatForm (editing) even though this table no longer
  // renders them itself — dewormer/probiotic are managed entirely from the
  // Announcements page now, not the roster or the shift report.
  dewormerStatus: DewormerStatus;
  dewormerDueDate: string | null;
  needsProbiotic: boolean;
  pickupAt: string | null;
  kennel: { id: number; number: number } | null;
  group: { id: number; bonded: boolean; kennel: { id: number; number: number } | null } | null;
  litter: { id: number; cats: { id: number; name: string }[] } | null;
}

interface CatActionHandlers {
  onEdit: (cat: Cat) => void;
  onDelete: (cat: Cat) => void;
  onRemoveFromGroup: (cat: Cat) => void;
  onEditGroup: (cat: Cat) => void;
  onManageSiblings: (cat: Cat) => void;
  onChangeStatus: (cat: Cat) => void;
  onReturnToRcc: (cat: Cat) => void;
}

interface CatsTableProps extends CatActionHandlers {
  /** Also list cats that have left: picked up or returned to RCC. */
  showInactive?: boolean;
}

export const CAT_STATUS_LABELS: Record<CatStatus, string> = {
  [CatStatus.Available]: "Available",
  [CatStatus.PendingAdoption]: "Pending Adoption",
  [CatStatus.Adopted]: "Adopted",
  [CatStatus.PickedUp]: "Picked Up",
};

export function catStatusBadgeVariant(
  status: CatStatus,
): "default" | "outline" | "warning" | "secondary" {
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

function kennelNumberOf(cat: Cat): number | null {
  return cat.kennel?.number ?? cat.group?.kennel?.number ?? null;
}

function ageLabel(cat: Cat): string | null {
  const parts = [];
  if (cat.ageYears) parts.push(`${cat.ageYears} yr`);
  if (cat.ageMonths) parts.push(`${cat.ageMonths} mo`);
  return parts.length > 0 ? parts.join(" ") : null;
}

function detailsLabel(cat: Cat): string {
  return [
    ageLabel(cat),
    cat.sex,
    cat.colorPattern,
    cat.collarColor ? `${cat.collarColor.toLowerCase()} collar` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

function siblingsLabel(cat: Cat): string {
  const names = cat.litter?.cats.filter((c) => c.id !== cat.id).map((c) => c.name) ?? [];
  return names.length > 0 ? names.join(", ") : "—";
}

// A cat that has left shows why instead of its (now frozen) adoption status.
function statusBadge(cat: Cat): {
  label: string;
  variant: ReturnType<typeof catStatusBadgeVariant>;
} {
  if (!cat.active && cat.status !== CatStatus.PickedUp) {
    return { label: "Returned to RCC", variant: "secondary" };
  }
  return { label: CAT_STATUS_LABELS[cat.status], variant: catStatusBadgeVariant(cat.status) };
}

export default function CatsTable({ showInactive = false, ...handlers }: CatsTableProps) {
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === Role.Admin;

  const {
    data: cats,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["cats", { includeInactive: showInactive }],
    queryFn: async () => {
      const { data } = await api.get<{ cats: Cat[] }>("/api/cats", {
        params: showInactive ? { includeInactive: "true" } : {},
      });
      return data.cats;
    },
  });

  if (error) {
    return <ErrorAlert message="Failed to fetch cats" />;
  }

  if (isLoading) {
    return (
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!cats || cats.length === 0) {
    return (
      <Card className="items-center px-4 py-10 text-center">
        <p className="font-display text-lg font-semibold text-navy">No cats on the roster</p>
        {isAdmin && <p className="text-sm text-muted-foreground">Add a cat when one arrives.</p>}
      </Card>
    );
  }

  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {cats.map((cat) => (
        <li key={cat.id}>
          <Card
            className={cn(
              "h-full flex-row items-start gap-3 px-3 sm:px-4",
              !cat.active && "opacity-70",
            )}
          >
            <KennelTile number={kennelNumberOf(cat)} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <Link
                  to={`/cats/${cat.id}`}
                  className="flex min-w-0 items-center gap-2 font-display text-lg leading-snug font-semibold text-navy hover:underline"
                >
                  <CollarDot color={cat.collarColor} />
                  <span className="min-w-0 break-words">{cat.name}</span>
                </Link>
                <div className="-mt-1 -mr-2 flex shrink-0 items-center gap-1">
                  <Badge variant={statusBadge(cat).variant}>{statusBadge(cat).label}</Badge>
                  {isAdmin && cat.active && <CatActions cat={cat} {...handlers} />}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{detailsLabel(cat)}</p>
              {cat.groupId !== null && (
                <p className="flex items-center gap-2 text-sm">
                  {cat.group?.bonded ? (
                    <Badge variant="secondary">Bonded pair</Badge>
                  ) : (
                    "In a group"
                  )}
                </p>
              )}
              <CatFlags cat={cat} />
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function CatFlags({ cat }: { cat: Cat }) {
  return (
    <>
      {(cat.pickupAt || cat.litter) && (
        <div className="flex flex-col gap-1 text-sm">
          {cat.pickupAt && (
            <span className="text-muted-foreground">
              Pickup: {new Date(cat.pickupAt).toLocaleString()}
            </span>
          )}
          {cat.litter && (
            <span className="text-muted-foreground">Siblings: {siblingsLabel(cat)}</span>
          )}
        </div>
      )}
    </>
  );
}

function CatActions({
  cat,
  onEdit,
  onDelete,
  onRemoveFromGroup,
  onEditGroup,
  onManageSiblings,
  onChangeStatus,
  onReturnToRcc,
}: CatActionHandlers & { cat: Cat }) {
  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${cat.name}`}>
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
          {VALID_STATUS_TRANSITIONS[cat.status].length > 0 && (
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
            <DropdownMenuItem variant="destructive" onClick={() => onRemoveFromGroup(cat)}>
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
  );
}
