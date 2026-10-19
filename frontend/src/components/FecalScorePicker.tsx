import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";

interface FecalScorePickerProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}

const SCORES = [1, 2, 3, 4, 5, 6, 7] as const;
const NONE = "none";

const pillClassName =
  "h-9 rounded-full bg-white px-3 text-foreground data-[state=on]:border-navy data-[state=on]:bg-navy data-[state=on]:text-white data-[state=on]:hover:bg-navy data-[state=on]:hover:text-white";

export default function FecalScorePicker({ value, onChange }: FecalScorePickerProps) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      aria-label="Fecal score"
      className="flex-wrap"
      value={value === undefined ? NONE : String(value)}
      onValueChange={(next) => {
        // Re-clicking the selected pill yields "" — keep the current selection.
        if (next === "") return;
        onChange(next === NONE ? undefined : Number(next));
      }}
    >
      <ToggleGroupItem value={NONE} className={pillClassName}>
        None
      </ToggleGroupItem>
      {SCORES.map((score) => (
        <ToggleGroupItem key={score} value={String(score)} className={`${pillClassName} w-9`}>
          {score}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
