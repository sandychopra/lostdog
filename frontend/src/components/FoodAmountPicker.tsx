import { FoodAmount } from "shared/constants/foodAmount.ts";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";

interface FoodAmountPickerProps {
  value: FoodAmount | undefined;
  onChange: (value: FoodAmount | undefined) => void;
  "aria-label"?: string;
}

const OPTIONS: { value: FoodAmount; label: string }[] = [
  { value: FoodAmount.None, label: "None" },
  { value: FoodAmount.Some, label: "Some" },
  { value: FoodAmount.Most, label: "Most" },
  { value: FoodAmount.All, label: "All" },
];

const pillClassName =
  "h-9 rounded-full bg-white px-3 text-foreground data-[state=on]:border-navy data-[state=on]:bg-navy data-[state=on]:text-white data-[state=on]:hover:bg-navy data-[state=on]:hover:text-white";

export default function FoodAmountPicker({
  value,
  onChange,
  "aria-label": ariaLabel = "Food amount",
}: FoodAmountPickerProps) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      aria-label={ariaLabel}
      className="flex-wrap"
      value={value ?? ""}
      // Re-clicking the selected pill yields "", which clears the selection.
      onValueChange={(next) => onChange(next === "" ? undefined : (next as FoodAmount))}
    >
      {OPTIONS.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value} className={pillClassName}>
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
