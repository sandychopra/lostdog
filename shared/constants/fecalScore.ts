export const FECAL_SCORES = [1, 2, 3, 4, 5, 6, 7] as const;

/**
 * Summary text for a cat entry's fecal score: "Empty", "3, 4", or null when
 * nothing was recorded.
 */
export function formatFecalScore(entry: {
  fecalScores?: readonly number[] | null;
  fecalEmpty?: boolean | null;
}): string | null {
  if (entry.fecalEmpty) return "Empty";
  const scores = entry.fecalScores ?? [];
  if (scores.length === 0) return null;
  return [...scores].sort((a, b) => a - b).join(", ");
}
