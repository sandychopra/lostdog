import { Controller, useWatch } from "react-hook-form";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import FecalScorePicker from "./FecalScorePicker";
import FoodAmountPicker from "./FoodAmountPicker";
import ErrorMessage from "./ErrorMessage";
import type { ShiftReportFormApi } from "../lib/shiftReportForm";

interface CatEntryFieldsProps {
  form: ShiftReportFormApi;
  index: number;
}

/** The editable fields of an individual cat entry, shown in CatEntryCard's Edit dialog. */
export default function CatEntryFields({ form, index }: CatEntryFieldsProps) {
  const { control, register, setValue, formState } = form;
  const base = `catEntries.${index}` as const;
  // Individual and group entries share an index space, so the union's error
  // type doesn't narrow; read it as a plain map of field → message.
  const errors = formState.errors.catEntries?.[index] as
    Record<string, { message?: string; root?: { message?: string } } | undefined> | undefined;

  const fecalScores = useWatch({ control, name: `${base}.fecalScores` as const }) ?? [];
  const fecalEmpty = useWatch({ control, name: `${base}.fecalEmpty` as const }) ?? false;
  const dryFoodAmount = useWatch({ control, name: `${base}.dryFoodAmount` as const });
  const wetFoodAmount = useWatch({ control, name: `${base}.wetFoodAmount` as const });

  return (
    <div className="space-y-4">
      <input type="hidden" {...register(`${base}.catId` as const)} />
      <ErrorMessage message={errors?.catId?.message} />

      <div className="space-y-2">
        <Label>Fecal Score</Label>
        <FecalScorePicker
          value={{ scores: fecalScores, empty: fecalEmpty }}
          onChange={(v) => {
            setValue(`${base}.fecalEmpty` as const, v.empty, { shouldDirty: true });
            setValue(`${base}.fecalScores` as const, v.scores, { shouldValidate: true });
          }}
        />
        <ErrorMessage message={errors?.fecalScores?.message} />
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
    </div>
  );
}
