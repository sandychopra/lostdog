import { matchCollarColor } from "shared/constants/collarColor.ts";
import { COLLAR_COLOR_HEX, OTHER_COLLAR_HEX } from "../lib/collarColors";
import { cn } from "../lib/utils";

/** A ring in the cat's collar color, so volunteers can match a name to the cat in the kennel. */
export default function CollarDot({
  color,
  className,
}: {
  color: string | null | undefined;
  className?: string;
}) {
  if (!color?.trim()) return null;
  const match = matchCollarColor(color);
  const hex = match ? COLLAR_COLOR_HEX[match] : OTHER_COLLAR_HEX;
  const label = `${match ?? color.trim()} collar`;
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "inline-block size-3.5 shrink-0 rounded-full border-[3px] bg-white",
        // White and pale collars need an outline to show up on a white card.
        (match === "White" || match === "Yellow" || match === "Light blue") &&
          "ring-1 ring-[#9aa2b3]",
        className,
      )}
      style={{ borderColor: hex }}
    />
  );
}
