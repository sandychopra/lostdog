import { useState } from "react";
import { useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";
import type { CreateShiftReportInput } from "shared/schemas/shiftReports.ts";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import FoodAmountPicker from "./FoodAmountPicker";
import FecalScorePicker from "./FecalScorePicker";
import CollapsibleEntryCard from "./CollapsibleEntryCard";
import type { Cat } from "./CatsTable";
import type { Kennel } from "./KennelsTable";

// Per-cat detail rows default collapsed when there are more than this many,
// matching the top-level entry threshold in ShiftReportForm.tsx.
const AUTO_COLLAPSE_THRESHOLD = 3;

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const textareaClassName =
  "flex min-h-16 w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface GroupCatEntryFieldsProps {
  form: UseFormReturn<CreateShiftReportInput>;
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
  form: UseFormReturn<CreateShiftReportInput>;
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
        <textarea
          id={`${base}.medicalNotes`}
          className={textareaClassName}
          {...register(`${base}.medicalNotes` as const)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${base}.otherNotes`}>Other Notes</Label>
        <textarea
          id={`${base}.otherNotes`}
          className={textareaClassName}
          {...register(`${base}.otherNotes` as const)}
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
      {fecalScore !== undefined && <Badge variant="outline">FS {fecalScore}</Badge>}
      {detailFields.length > 0 && (
        <Badge variant="outline">
          {detailFields.length} cat{detailFields.length === 1 ? "" : "s"}
        </Badge>
      )}
    </>
  );

  function handleGroupChange(newGroupId: number) {
    const group = groups.find((g) => g.id === newGroupId);
    setValue(
      `${base}.catDetails` as const,
      (group?.cats ?? []).map((c) => ({
        catId: c.id,
        nailTrim: false,
      })),
      { shouldValidate: true },
    );
    // A new group's members start expanded, same as a freshly-added entry.
    setCollapsedDetailIds(new Set());
  }

  return (
    <CollapsibleEntryCard
      title={selectedGroup ? selectedGroup.cats.map((c) => c.name).join(" / ") : "Group Entry"}
      summary={summary}
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
      onRemove={onRemove}
    >
      <div className="space-y-2">
        <Label htmlFor={`${base}.groupId`}>Group</Label>
        <select
          id={`${base}.groupId`}
          className={selectClassName}
          {...register(`${base}.groupId` as const, {
            onChange: (e) => handleGroupChange(Number(e.target.value)),
          })}
        >
          <option value="">Select a group</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.cats.map((c) => c.name).join(" / ")}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label>Fecal Score (shared)</Label>
        <FecalScorePicker
          value={fecalScore}
          onChange={(v) => setValue(`${base}.fecalScore` as const, v, { shouldValidate: true })}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id={`${base}.pee`}
          type="checkbox"
          className="h-4 w-4"
          {...register(`${base}.pee` as const)}
        />
        <Label htmlFor={`${base}.pee`}>Pee observed (shared)</Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${base}.peePooNotes`}>Pee/Poo Notes (shared)</Label>
        <textarea
          id={`${base}.peePooNotes`}
          className={textareaClassName}
          {...register(`${base}.peePooNotes` as const)}
        />
      </div>

      <div className="space-y-2">
        <Label>Dry Food (shared)</Label>
        <FoodAmountPicker
          value={dryFoodAmount}
          onChange={(v) => setValue(`${base}.dryFoodAmount` as const, v, { shouldValidate: true })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${base}.foodNotes`}>Food Notes (shared)</Label>
        <textarea
          id={`${base}.foodNotes`}
          className={textareaClassName}
          {...register(`${base}.foodNotes` as const)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${base}.otherNotes`}>Other Notes (shared)</Label>
        <textarea
          id={`${base}.otherNotes`}
          className={textareaClassName}
          {...register(`${base}.otherNotes` as const)}
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
