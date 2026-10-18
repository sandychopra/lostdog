import { useState } from "react";
import { Controller, useFieldArray, useWatch } from "react-hook-form";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import FoodAmountPicker from "./FoodAmountPicker";
import FecalScorePicker from "./FecalScorePicker";
import CollapsibleEntryCard from "./CollapsibleEntryCard";
import type { Cat } from "./CatsTable";
import type { Kennel } from "./KennelsTable";
import type { ShiftReportFormApi } from "../lib/shiftReportForm";

// Per-cat detail rows default collapsed when there are more than this many,
// matching the top-level entry threshold in ShiftReportForm.tsx.
const AUTO_COLLAPSE_THRESHOLD = 3;

interface GroupCatEntryFieldsProps {
  form: ShiftReportFormApi;
  index: number;
  cats: Cat[];
  kennels: Kennel[];
  onRemove: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

function GroupCatDetailFields({
  form,
  entryIndex,
  detailIndex,
  cat,
  collapsed,
  onToggleCollapsed,
}: {
  form: ShiftReportFormApi;
  entryIndex: number;
  detailIndex: number;
  cat: Cat;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const { control, register, setValue } = form;
  const base = `catEntries.${entryIndex}.catDetails.${detailIndex}` as const;
  const wetFoodAmount = useWatch({ control, name: `${base}.wetFoodAmount` as const });

  const summary = (
    <>{wetFoodAmount !== undefined && <Badge variant="outline">Wet: {wetFoodAmount}</Badge>}</>
  );

  async function handleSave() {
    const valid = await form.trigger(`catEntries.${entryIndex}.catDetails.${detailIndex}` as const);
    if (valid) onToggleCollapsed();
  }

  return (
    <CollapsibleEntryCard
      title={cat.name}
      summary={summary}
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
      onSave={handleSave}
      variant="nested"
    >
      <div className="space-y-1">
        <Label>Wet Food</Label>
        <FoodAmountPicker
          aria-label="Wet food amount"
          value={wetFoodAmount}
          onChange={(v) => setValue(`${base}.wetFoodAmount` as const, v, { shouldValidate: true })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${base}.foodNotes`}>Food Notes</Label>
        <Input id={`${base}.foodNotes`} {...register(`${base}.foodNotes` as const)} />
      </div>
      <div className="space-y-1">
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

export default function GroupCatEntryFields({
  form,
  index,
  cats,
  kennels,
  onRemove,
  collapsed,
  onToggleCollapsed,
}: GroupCatEntryFieldsProps) {
  const { control, register, setValue } = form;
  const base = `catEntries.${index}` as const;

  const groups = kennels.flatMap((k) => k.groups);
  const groupId = useWatch({ control, name: `${base}.groupId` as const });
  const fecalScore = useWatch({ control, name: `${base}.fecalScore` as const });
  const dryFoodAmount = useWatch({ control, name: `${base}.dryFoodAmount` as const });
  const pee = useWatch({ control, name: `${base}.pee` as const });
  const catDetails = useWatch({ control, name: `${base}.catDetails` as const });

  const { fields: detailFields } = useFieldArray({
    control,
    name: `${base}.catDetails` as const,
  });

  // Keyed by catId, local to this entry — nothing outside needs to know which
  // per-cat detail rows are collapsed. Defaults collapsed for a group this
  // large, same threshold as the top-level entries in ShiftReportForm.tsx.
  const [collapsedDetailIds, setCollapsedDetailIds] = useState<Set<number>>(() =>
    detailFields.length > AUTO_COLLAPSE_THRESHOLD
      ? new Set(detailFields.map((f) => f.catId))
      : new Set(),
  );

  function toggleDetailCollapsed(catId: number) {
    setCollapsedDetailIds((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }

  // Native <select> values are always strings — coerce before comparing.
  const selectedGroup = groups.find((g) => g.id === Number(groupId));
  const groupCats = selectedGroup?.cats ?? [];

  const summary = (
    <>
      {fecalScore !== undefined && <Badge variant="outline">Fecal Score: {fecalScore}</Badge>}
      {dryFoodAmount && <Badge variant="outline">Dry: {dryFoodAmount}</Badge>}
      {pee && <Badge variant="outline">Pee</Badge>}
      {(catDetails ?? []).map((detail, i) =>
        detail.wetFoodAmount && groupCats[i] ? (
          <Badge key={detail.catId} variant="outline">
            {groupCats[i].name} Wet: {detail.wetFoodAmount}
          </Badge>
        ) : null,
      )}
      {detailFields.length > 0 && (
        <Badge variant="outline">
          {detailFields.length} cat{detailFields.length === 1 ? "" : "s"}
        </Badge>
      )}
    </>
  );

  async function handleSave() {
    const valid = await form.trigger(base);
    if (valid) onToggleCollapsed();
  }

  return (
    <CollapsibleEntryCard
      title={selectedGroup ? selectedGroup.cats.map((c) => c.name).join(" / ") : "Group Entry"}
      summary={summary}
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
      onRemove={onRemove}
      onSave={handleSave}
    >
      <input type="hidden" {...register(`${base}.groupId` as const)} />

      <div className="space-y-2">
        <Label>Fecal Score (shared)</Label>
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
          <div className="space-y-2">
            {detailFields.map((field, detailIndex) => {
              const cat = cats.find((c) => c.id === groupCats[detailIndex]?.id);
              if (!cat) return null;
              return (
                <GroupCatDetailFields
                  key={field.id}
                  form={form}
                  entryIndex={index}
                  detailIndex={detailIndex}
                  cat={cat}
                  collapsed={collapsedDetailIds.has(field.catId)}
                  onToggleCollapsed={() => toggleDetailCollapsed(field.catId)}
                />
              );
            })}
          </div>
        </div>
      )}
    </CollapsibleEntryCard>
  );
}
