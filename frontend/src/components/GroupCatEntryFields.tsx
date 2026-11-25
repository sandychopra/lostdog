import { Controller, useFieldArray, useWatch } from "react-hook-form";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import FoodAmountPicker from "./FoodAmountPicker";
import FecalScorePicker from "./FecalScorePicker";
import CollarDot from "./CollarDot";
import ErrorMessage from "./ErrorMessage";
import type { Cat } from "./CatsTable";
import type { ShiftReportFormApi } from "../lib/shiftReportForm";

interface GroupCatEntryFieldsProps {
  form: ShiftReportFormApi;
  index: number;
  cats: Cat[];
}

function GroupCatDetailFields({
  form,
  entryIndex,
  detailIndex,
  cat,
}: {
  form: ShiftReportFormApi;
  entryIndex: number;
  detailIndex: number;
  cat: Cat;
}) {
  const { control, register, setValue } = form;
  const base = `catEntries.${entryIndex}.catDetails.${detailIndex}` as const;
  const wetFoodAmount = useWatch({ control, name: `${base}.wetFoodAmount` as const });

  return (
    <fieldset className="space-y-2 rounded-md border border-input/60 bg-muted/30 p-3">
      <legend className="flex items-center gap-1.5 px-1 text-sm font-medium">
        {cat.name}
        <CollarDot color={cat.collarColor} />
      </legend>
      <div className="space-y-1">
        <Label>Wet Food</Label>
        <FoodAmountPicker
          aria-label={`${cat.name} wet food amount`}
          value={wetFoodAmount}
          onChange={(v) => setValue(`${base}.wetFoodAmount` as const, v, { shouldValidate: true })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${base}.foodNotes`}>Food Notes</Label>
        <Textarea
          id={`${base}.foodNotes`}
          className="min-h-16"
          {...register(`${base}.foodNotes` as const)}
        />
      </div>
    </fieldset>
  );
}

/** The editable fields of a group cat entry, shown in CatEntryCard's Edit dialog. */
export default function GroupCatEntryFields({ form, index, cats }: GroupCatEntryFieldsProps) {
  const { control, register, setValue, formState } = form;
  const base = `catEntries.${index}` as const;
  // Individual and group entries share an index space, so the union's error
  // type doesn't narrow; read it as a plain map of field → message.
  const errors = formState.errors.catEntries?.[index] as
    Record<string, { message?: string; root?: { message?: string } } | undefined> | undefined;

  const fecalScores = useWatch({ control, name: `${base}.fecalScores` as const }) ?? [];
  const fecalEmpty = useWatch({ control, name: `${base}.fecalEmpty` as const }) ?? false;
  const dryFoodAmount = useWatch({ control, name: `${base}.dryFoodAmount` as const });

  const { fields: detailFields } = useFieldArray({
    control,
    name: `${base}.catDetails` as const,
  });

  return (
    <div className="space-y-4">
      <input type="hidden" {...register(`${base}.groupId` as const)} />
      <ErrorMessage
        message={
          errors?.groupId?.message ??
          errors?.catDetails?.message ??
          errors?.catDetails?.root?.message
        }
      />

      <div className="space-y-2">
        <Label>Fecal Score (shared)</Label>
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
        <Label htmlFor={`${base}.pee`}>Pee observed (shared)</Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${base}.peePoopNotes`}>Pee/Poop Notes (shared)</Label>
        <Textarea
          id={`${base}.peePoopNotes`}
          className="min-h-16"
          {...register(`${base}.peePoopNotes` as const)}
        />
      </div>

      <div className="space-y-2">
        <Label>Dry Food (shared)</Label>
        <FoodAmountPicker
          aria-label="Dry food amount"
          value={dryFoodAmount}
          onChange={(v) => setValue(`${base}.dryFoodAmount` as const, v, { shouldValidate: true })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${base}.foodNotes`}>Food Notes (shared)</Label>
        <Textarea
          id={`${base}.foodNotes`}
          className="min-h-16"
          {...register(`${base}.foodNotes` as const)}
        />
      </div>

      {detailFields.length > 0 && (
        <div className="space-y-2">
          <Label>Per-Cat Details</Label>
          <div className="space-y-3">
            {detailFields.map((field, detailIndex) => {
              const cat = cats.find((c) => c.id === Number(field.catId));
              if (!cat) return null;
              return (
                <GroupCatDetailFields
                  key={field.id}
                  form={form}
                  entryIndex={index}
                  detailIndex={detailIndex}
                  cat={cat}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
