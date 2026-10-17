import { Controller, useWatch } from "react-hook-form";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import FecalScorePicker from "./FecalScorePicker";
import FoodAmountPicker from "./FoodAmountPicker";
import CollapsibleEntryCard from "./CollapsibleEntryCard";
import type { Cat } from "./CatsTable";
import type { ShiftReportFormApi } from "../lib/shiftReportForm";

interface CatEntryFieldsProps {
  form: ShiftReportFormApi;
  index: number;
  cats: Cat[];
  onRemove: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export default function CatEntryFields({
  form,
  index,
  cats,
  onRemove,
  collapsed,
  onToggleCollapsed,
}: CatEntryFieldsProps) {
  const { control, register, setValue } = form;
  const base = `catEntries.${index}` as const;

  const catId = useWatch({ control, name: `${base}.catId` as const });
  const fecalScore = useWatch({ control, name: `${base}.fecalScore` as const });
  const dryFoodAmount = useWatch({ control, name: `${base}.dryFoodAmount` as const });
  const wetFoodAmount = useWatch({ control, name: `${base}.wetFoodAmount` as const });
  const pee = useWatch({ control, name: `${base}.pee` as const });

  // Native <select> values are always strings, even though the schema's
  // parsed/output type is number — coerce before comparing against numeric ids.
  const selectedCat = cats.find((c) => c.id === Number(catId));

  const summary = (
    <>
      {fecalScore !== undefined && <Badge variant="outline">Fecal Score: {fecalScore}</Badge>}
      {dryFoodAmount && <Badge variant="outline">Dry: {dryFoodAmount}</Badge>}
      {wetFoodAmount && <Badge variant="outline">Wet: {wetFoodAmount}</Badge>}
      {pee && <Badge variant="outline">Pee</Badge>}
    </>
  );

  async function handleSave() {
    const valid = await form.trigger(`catEntries.${index}` as const);
    if (valid) onToggleCollapsed();
  }

  return (
    <CollapsibleEntryCard
      title={selectedCat?.name ?? "Individual Entry"}
      summary={summary}
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
      onRemove={onRemove}
      onSave={handleSave}
    >
      <input type="hidden" {...register(`${base}.catId` as const)} />

      <div className="space-y-2">
        <Label>Fecal Score</Label>
        <FecalScorePicker
          value={fecalScore}
          onChange={(v) => setValue(`${base}.fecalScore` as const, v, { shouldValidate: true })}
        />
      </div>

      <div className="flex items-center gap-2">
        <Controller
          control={control}
          name={`${base}.pee` as const}
          render={({ field }) => (
            <Checkbox
              id={`${base}.pee`}
              ref={field.ref}
              checked={field.value === true}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              onBlur={field.onBlur}
            />
          )}
        />
        <Label htmlFor={`${base}.pee`}>Pee observed</Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${base}.peePoopNotes`}>Pee/Poop Notes</Label>
        <Textarea
          id={`${base}.peePoopNotes`}
          className="min-h-16"
          {...register(`${base}.peePoopNotes` as const)}
        />
      </div>

      <div className="space-y-2">
        <Label>Dry Food</Label>
        <FoodAmountPicker
          aria-label="Dry food amount"
          value={dryFoodAmount}
          onChange={(v) => setValue(`${base}.dryFoodAmount` as const, v, { shouldValidate: true })}
        />
      </div>

      <div className="space-y-2">
        <Label>Wet Food</Label>
        <FoodAmountPicker
          aria-label="Wet food amount"
          value={wetFoodAmount}
          onChange={(v) => setValue(`${base}.wetFoodAmount` as const, v, { shouldValidate: true })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${base}.foodNotes`}>Food Notes</Label>
        <Textarea
          id={`${base}.foodNotes`}
          className="min-h-16"
          {...register(`${base}.foodNotes` as const)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${base}.medicalNotes`}>Medical Notes</Label>
        <Textarea
          id={`${base}.medicalNotes`}
          className="min-h-16"
          {...register(`${base}.medicalNotes` as const)}
        />
      </div>
    </CollapsibleEntryCard>
  );
}
