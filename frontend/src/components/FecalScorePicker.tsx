import { cn } from "../lib/utils";

interface FecalScorePickerProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}

const SCORES = [1, 2, 3, 4, 5, 6, 7] as const;

const pillClassName =
  "flex h-9 items-center justify-center rounded-full border px-3 text-sm transition-colors";

export default function FecalScorePicker({ value, onChange }: FecalScorePickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className={cn(
          pillClassName,
          value === undefined
            ? "border-navy bg-navy text-white"
            : "border-input bg-white text-foreground",
        )}
        onClick={() => onChange(undefined)}
      >
        None
      </button>
      {SCORES.map((score) => (
        <button
          key={score}
          type="button"
          className={cn(
            pillClassName,
            "w-9",
            value === score
              ? "border-navy bg-navy text-white"
              : "border-input bg-white text-foreground",
          )}
          onClick={() => onChange(score)}
        >
          {score}
        </button>
      ))}
    </div>
  );
}
