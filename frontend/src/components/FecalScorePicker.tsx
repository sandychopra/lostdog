import { FECAL_SCORES } from "shared/constants/fecalScore.ts";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";

export interface FecalScoreValue {
  scores: number[];
  empty: boolean;
}

interface FecalScorePickerProps {
  value: FecalScoreValue;
  onChange: (value: FecalScoreValue) => void;
}

const EMPTY = "empty";

const pillClassName =
  "h-9 rounded-full bg-white px-3 text-foreground data-[state=on]:border-navy data-[state=on]:bg-navy data-[state=on]:text-white data-[state=on]:hover:bg-navy data-[state=on]:hover:text-white";

// Several scores can be picked at once. "Empty" is mutually exclusive with
// them: picking it clears the scores, and picking a score clears it. Nothing
// selected means "not recorded".
export function nextFecalScoreValue(current: FecalScoreValue, next: string[]): FecalScoreValue {
  const pickedEmpty = !current.empty && next.includes(EMPTY);
  if (pickedEmpty) return { scores: [], empty: true };
  const scores = next
    .filter((v) => v !== EMPTY)
    .map(Number)
    .sort((a, b) => a - b);
  return { scores, empty: scores.length === 0 && next.includes(EMPTY) };
}

export default function FecalScorePicker({ value, onChange }: FecalScorePickerProps) {
  const selected = value.empty ? [EMPTY] : value.scores.map(String);
  return (
    <ToggleGroup
      type="multiple"
      variant="outline"
      aria-label="Fecal score"
      className="flex-wrap"
      value={selected}
      onValueChange={(next) => onChange(nextFecalScoreValue(value, next))}
    >
      <ToggleGroupItem value={EMPTY} className={pillClassName}>
        Empty
      </ToggleGroupItem>
      {FECAL_SCORES.map((score) => (
        <ToggleGroupItem key={score} value={String(score)} className={`${pillClassName} w-9`}>
          {score}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
