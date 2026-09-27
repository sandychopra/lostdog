import { FoodAmount } from "shared/constants/foodAmount.ts";
import { cn } from "../lib/utils";

interface FoodAmountPickerProps {
  value: FoodAmount | undefined;
  onChange: (value: FoodAmount | undefined) => void;
}

const OPTIONS: { value: FoodAmount; label: string }[] = [
  { value: FoodAmount.None, label: "None" },
  { value: FoodAmount.Some, label: "Some" },
  { value: FoodAmount.Most, label: "Most" },
  { value: FoodAmount.All, label: "All" },
];

const pillClassName =
  "flex h-9 items-center justify-center rounded-full border px-3 text-sm transition-colors";

export default function FoodAmountPicker({ value, onChange }: FoodAmountPickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn(
            pillClassName,
            value === option.value
              ? "border-navy bg-navy text-white"
              : "border-input bg-white text-foreground",
          )}
          onClick={() => onChange(value === option.value ? undefined : option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
