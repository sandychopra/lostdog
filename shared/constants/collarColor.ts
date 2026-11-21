// Not an enum — collarColor stays free text in the schema/validation (like
// colorPattern), so an "Other" value or an older free-typed one still passes
// through unchanged. This is only the picklist shown in the Cat form, and the
// set of names the roster can draw as a colored dot.
export const COLLAR_COLORS = [
  "Red",
  "Orange",
  "Yellow",
  "Green",
  "Blue",
  "Light blue",
  "Purple",
  "Pink",
  "Black",
  "White",
] as const;

export type CollarColor = (typeof COLLAR_COLORS)[number];

/** The picklist entry matching a stored value, ignoring case/spacing ("light Blue" → "Light blue"). */
export function matchCollarColor(value: string | null | undefined): CollarColor | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  return COLLAR_COLORS.find((c) => c.toLowerCase() === normalized);
}
