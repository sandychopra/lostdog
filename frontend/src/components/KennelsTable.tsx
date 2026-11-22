import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Pencil, Trash2, Move, X } from "lucide-react";
import { Role } from "shared/constants/role.ts";
import { KennelState } from "shared/constants/kennelState.ts";
import { api } from "../lib/api";
import { authClient } from "../lib/auth-client";
import ErrorAlert from "./ErrorAlert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { Card } from "./ui/card";
import CollarDot from "./CollarDot";
import KennelTile from "./KennelTile";

interface KennelCat {
  id: number;
  name: string;
  collarColor?: string | null;
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
  /** Set when an Admin archived ("deleted") the kennel; only returned with ?includeArchived=true. */
  deletedAt: string | null;
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

export function kennelStateBadgeVariant(
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

export const KENNEL_STATE_LABELS: Record<KennelState, string> = {
  [KennelState.Ready]: "Ready",
  [KennelState.Occupied]: "Occupied",
  [KennelState.NeedsReset]: "Needs reset",
  [KennelState.Planned]: "Planned",
};

// Same order and colors as the tiles, so the legend reads as a key to the grid.
const LEGEND: KennelState[] = [
  KennelState.Occupied,
  KennelState.Ready,
  KennelState.NeedsReset,
  KennelState.Planned,
];

const LEGEND_SWATCH: Record<KennelState, string> = {
  [KennelState.Occupied]: "border-blue bg-blue",
  [KennelState.Ready]: "border-navy bg-white",
  [KennelState.NeedsReset]: "border-gold bg-gold",
  [KennelState.Planned]: "border-dashed border-navy/45 bg-mist",
};

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

  const counts = new Map<KennelState, number>();
  for (const kennel of kennels ?? []) counts.set(kennel.state, (counts.get(kennel.state) ?? 0) + 1);

  return (
    <div className="space-y-4">
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label="Kennel states">
        {LEGEND.map((state) => (
          <li key={state} className="flex items-center gap-2">
            <span className={`size-4 rounded border-2 ${LEGEND_SWATCH[state]}`} />
            {KENNEL_STATE_LABELS[state]}
            {kennels && (
              <span className="text-muted-foreground tabular-nums">{counts.get(state) ?? 0}</span>
            )}
          </li>
        ))}
      </ul>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : !kennels || kennels.length === 0 ? (
        <Card className="items-center px-4 py-10 text-center">
          <p className="font-display text-lg font-semibold text-navy">No kennels yet</p>
          {isAdmin && (
            <p className="text-sm text-muted-foreground">Add the kennels at your site to start.</p>
          )}
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {kennels.map((kennel) => {
            const occupants = [...kennel.cats, ...kennel.groups.flatMap((g) => g.cats)];
            const bonded = kennel.groups.some((g) => g.bonded);
            return (
              <li key={kennel.id}>
                <Card className="h-full flex-row items-start gap-3 px-3">
                  <KennelTile number={kennel.number} state={kennel.state} size="lg" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <Link
                        to={`/kennels/${kennel.id}`}
                        className="font-display text-lg font-semibold text-navy hover:underline"
                      >
                        Kennel {kennel.number}
                      </Link>
                      <span className="shrink-0 text-sm text-muted-foreground">
                        {KENNEL_STATE_LABELS[kennel.state]}
                      </span>
                    </div>
                    {occupants.length > 0 ? (
                      <ul className="space-y-1">
                        {occupants.map((cat) => (
                          <li key={cat.id} className="flex items-center gap-2 font-bold">
                            <CollarDot color={cat.collarColor} />
                            {cat.name}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">Empty</p>
                    )}
                    {bonded && <Badge variant="secondary">Bonded pair</Badge>}
                    {isAdmin && (
                      <div className="-ml-2">
                        <KennelActions
                          kennel={kennel}
                          moveRequest={moveRequestByFromKennelId.get(kennel.id)}
                          onEdit={onEdit}
                          onDelete={onDelete}
                          onRequestMove={onRequestMove}
                          onCancelMoveRequest={onCancelMoveRequest}
                        />
                      </div>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function KennelActions({
  kennel,
  moveRequest,
  onEdit,
  onDelete,
  onRequestMove,
  onCancelMoveRequest,
}: KennelsTableProps & { kennel: Kennel; moveRequest: KennelMoveRequest | undefined }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
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
      {moveRequest ? (
        <>
          <span className="text-sm text-muted-foreground">
            Move requested → Kennel {moveRequest.toKennel.number}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onCancelMoveRequest(moveRequest)}
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
  );
}
