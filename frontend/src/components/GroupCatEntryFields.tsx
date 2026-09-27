import { useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";
import { Trash2 } from "lucide-react";
import { DewormerStatus } from "shared/constants/dewormerStatus.ts";
import { SnackTreat } from "shared/constants/snackTreat.ts";
import type { CreateShiftReportInput } from "shared/schemas/shiftReports.ts";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import FoodAmountPicker from "./FoodAmountPicker";
import FecalScorePicker from "./FecalScorePicker";
import PhotoUploadSection, {
  type QueuedPhoto,
  type UploadedPhotoSummary,
} from "./PhotoUploadSection";
import type { Cat } from "./CatsTable";
import type { Kennel } from "./KennelsTable";

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
  queuedPhotos: QueuedPhoto[];
  onQueuedPhotosChange: (next: QueuedPhoto[]) => void;
  uploadedPhotos: UploadedPhotoSummary[];
}

function GroupCatDetailFields({
  form,
  entryIndex,
  detailIndex,
  cat,
}: {
  form: UseFormReturn<CreateShiftReportInput>;
  entryIndex: number;
  detailIndex: number;
  cat: Cat;
}) {
  const { control, register, setValue } = form;
  const base = `catEntries.${entryIndex}.catDetails.${detailIndex}` as const;
  const wetFoodAmount = useWatch({ control, name: `${base}.wetFoodAmount` as const });

  return (
    <div className="space-y-2 rounded-md border border-input/60 bg-muted/30 p-3">
      <p className="text-sm font-medium">{cat.name}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Wet Food</Label>
          <FoodAmountPicker
            value={wetFoodAmount}
            onChange={(v) =>
              setValue(`${base}.wetFoodAmount` as const, v, { shouldValidate: true })
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${base}.wetFoodBrand`}>Wet Food Brand</Label>
          <Input
            id={`${base}.wetFoodBrand`}
            placeholder="Hill's"
            {...register(`${base}.wetFoodBrand` as const)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${base}.snackTreat`}>Snack/Treat</Label>
          <select
            id={`${base}.snackTreat`}
            className={selectClassName}
            {...register(`${base}.snackTreat` as const)}
          >
            <option value="">None</option>
            <option value={SnackTreat.Churu}>Churu</option>
            <option value={SnackTreat.Greenies}>Greenies</option>
            <option value={SnackTreat.Other}>Other</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${base}.snackTreatNote`}>Snack/Treat Note</Label>
          <Input id={`${base}.snackTreatNote`} {...register(`${base}.snackTreatNote` as const)} />
        </div>
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
      {cat.dewormerStatus === DewormerStatus.Due && (
        <div className="flex items-center gap-2">
          <input
            id={`${base}.dewormerGiven`}
            type="checkbox"
            className="h-4 w-4"
            {...register(`${base}.dewormerGiven` as const)}
          />
          <Label htmlFor={`${base}.dewormerGiven`}>Dewormer given</Label>
        </div>
      )}
      {cat.needsProbiotic && (
        <div className="flex items-center gap-2">
          <input
            id={`${base}.probioticGiven`}
            type="checkbox"
            className="h-4 w-4"
            {...register(`${base}.probioticGiven` as const)}
          />
          <Label htmlFor={`${base}.probioticGiven`}>Probiotic given</Label>
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor={`${base}.behaviorNotes`}>Behavior Notes</Label>
        <textarea
          id={`${base}.behaviorNotes`}
          className={textareaClassName}
          {...register(`${base}.behaviorNotes` as const)}
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
      <div className="flex items-center gap-2">
        <input
          id={`${base}.nailTrim`}
          type="checkbox"
          className="h-4 w-4"
          {...register(`${base}.nailTrim` as const)}
        />
        <Label htmlFor={`${base}.nailTrim`}>Nail trim</Label>
      </div>
    </div>
  );
}

export default function GroupCatEntryFields({
  form,
  index,
  cats,
  kennels,
  onRemove,
  queuedPhotos,
  onQueuedPhotosChange,
  uploadedPhotos,
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

  // Native <select> values are always strings — coerce before comparing.
  const selectedGroup = groups.find((g) => g.id === Number(groupId));
  const groupCats = selectedGroup?.cats ?? [];

  function handleGroupChange(newGroupId: number) {
    const group = groups.find((g) => g.id === newGroupId);
    setValue(
      `${base}.catDetails` as const,
      (group?.cats ?? []).map((c) => ({
        catId: c.id,
        dewormerGiven: false,
        probioticGiven: false,
        nailTrim: false,
      })),
      { shouldValidate: true },
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-input p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Group Entry</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label="Remove entry"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

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
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Photos</Label>
        <PhotoUploadSection
          queued={queuedPhotos}
          onQueuedChange={onQueuedPhotosChange}
          uploaded={uploadedPhotos}
          catOptions={groupCats}
          showTagPicker
        />
      </div>
    </div>
  );
}
