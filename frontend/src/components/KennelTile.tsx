import { KennelState } from "shared/constants/kennelState.ts";
import { cn } from "../lib/utils";

const STATE_CLASSES: Record<KennelState, string> = {
  [KennelState.Occupied]: "border-blue bg-blue text-white [&>small]:text-white/80",
  [KennelState.Ready]: "border-navy bg-white text-navy",
  [KennelState.NeedsReset]: "border-gold bg-gold text-navy [&>small]:text-navy/75",
  [KennelState.Planned]: "border-dashed border-navy/45 bg-mist text-navy/70",
};

interface KennelTileProps {
  number: number | null | undefined;
  /** Colors the tile by kennel state (Kennels page). */
  state?: KennelState;
  /** Gold "needs attention" tile, e.g. an overdue announcement. */
  attention?: boolean;
  size?: "md" | "lg";
  className?: string;
}

/** The kennel number as a stamped tile, like the card on the kennel door. */
export default function KennelTile({
  number,
  state,
  attention,
  size = "md",
  className,
}: KennelTileProps) {
  const hasNumber = number !== null && number !== undefined;
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-center justify-center rounded-lg border-2 leading-none",
        size === "md" ? "h-14 w-13" : "h-18 w-17",
        state
          ? STATE_CLASSES[state]
          : attention
            ? "border-gold bg-gold-wash text-navy"
            : hasNumber
              ? "border-navy bg-white text-navy"
              : "border-dashed border-input bg-white text-muted-foreground",
        className,
      )}
    >
      {hasNumber ? (
        <>
          <small className="text-[10px] text-muted-foreground">Kennel</small>
          <span
            className={cn(
              "mt-0.5 font-display font-extrabold tabular-nums",
              size === "md" ? "text-2xl" : "text-3xl",
            )}
          >
            {number}
          </span>
        </>
      ) : (
        <span className="px-1 text-center text-[11px] leading-tight">No kennel</span>
      )}
    </div>
  );
}
