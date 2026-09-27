import { useWatch, type UseFormReturn } from "react-hook-form";
import { Trash2 } from "lucide-react";
import { DewormerStatus } from "shared/constants/dewormerStatus.ts";
import { SnackTreat } from "shared/constants/snackTreat.ts";
import type { CreateShiftReportInput } from "shared/schemas/shiftReports.ts";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import ErrorMessage from "./ErrorMessage";
import FecalScorePicker from "./FecalScorePicker";
import FoodAmountPicker from "./FoodAmountPicker";
import PhotoUploadSection, {
  type QueuedPhoto,
  type UploadedPhotoSummary,
} from "./PhotoUploadSection";
import type { Cat } from "./CatsTable";

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const textareaClassName =
  "flex min-h-16 w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface CatEntryFieldsProps {
  form: UseFormReturn<CreateShiftReportInput>;
  index: number;
  cats: Cat[];
  onRemove: () => void;
  queuedPhotos: QueuedPhoto[];
  onQueuedPhotosChange: (next: QueuedPhoto[]) => void;
  uploadedPhotos: UploadedPhotoSummary[];
}

export default function CatEntryFields({
  form,
  index,
  cats,
  onRemove,
  queuedPhotos,
  onQueuedPhotosChange,
  uploadedPhotos,
}: CatEntryFieldsProps) {
  const { control, register, formState, setValue } = form;
  const base = `catEntries.${index}` as const;

  const catId = useWatch({ control, name: `${base}.catId` as const });
  const fecalScore = useWatch({ control, name: `${base}.fecalScore` as const });
  const dryFoodAmount = useWatch({ control, name: `${base}.dryFoodAmount` as const });
  const wetFoodAmount = useWatch({ control, name: `${base}.wetFoodAmount` as const });

  // Native <select> values are always strings, even though the schema's
  // parsed/output type is number — coerce before comparing against numeric ids.
  const selectedCat = cats.find((c) => c.id === Number(catId));
  // Entry errors are typed loosely — catEntries is a zod discriminated union,
  // and RHF's error shape for a union array item isn't worth fighting here.
  const errors = (formState.errors.catEntries?.[index] ?? {}) as Record<
    string,
    { message?: string } | undefined
  >;

  return (
    <div className="space-y-3 rounded-md border border-input p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Individual Entry</span>
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
        <Label htmlFor={`${base}.catId`}>Cat</Label>
        <select
          id={`${base}.catId`}
          className={selectClassName}
          {...register(`${base}.catId` as const)}
        >
          <option value="">Select a cat</option>
          {cats
            .filter((c) => c.groupId === null)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
        <ErrorMessage message={errors.catId?.message} />
      </div>

      <div className="space-y-2">
        <Label>Fecal Score</Label>
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
        <Label htmlFor={`${base}.pee`}>Pee observed</Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${base}.peePooNotes`}>Pee/Poo Notes</Label>
        <textarea
          id={`${base}.peePooNotes`}
          className={textareaClassName}
          {...register(`${base}.peePooNotes` as const)}
        />
      </div>

      <div className="space-y-2">
        <Label>Dry Food</Label>
        <FoodAmountPicker
          value={dryFoodAmount}
          onChange={(v) => setValue(`${base}.dryFoodAmount` as const, v, { shouldValidate: true })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Wet Food</Label>
          <FoodAmountPicker
            value={wetFoodAmount}
            onChange={(v) =>
              setValue(`${base}.wetFoodAmount` as const, v, { shouldValidate: true })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${base}.wetFoodBrand`}>Wet Food Brand</Label>
          <Input
            id={`${base}.wetFoodBrand`}
            placeholder="Hill's"
            {...register(`${base}.wetFoodBrand` as const)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${base}.foodNotes`}>Food Notes</Label>
        <textarea
          id={`${base}.foodNotes`}
          className={textareaClassName}
          {...register(`${base}.foodNotes` as const)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
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
        <div className="space-y-2">
          <Label htmlFor={`${base}.snackTreatNote`}>Snack/Treat Note</Label>
          <Input id={`${base}.snackTreatNote`} {...register(`${base}.snackTreatNote` as const)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${base}.medicalNotes`}>Medical Notes</Label>
        <textarea
          id={`${base}.medicalNotes`}
          className={textareaClassName}
          {...register(`${base}.medicalNotes` as const)}
        />
      </div>

      {selectedCat?.dewormerStatus === DewormerStatus.Due && (
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

      {selectedCat?.needsProbiotic && (
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

      <div className="space-y-2">
        <Label htmlFor={`${base}.behaviorNotes`}>Behavior Notes</Label>
        <textarea
          id={`${base}.behaviorNotes`}
          className={textareaClassName}
          {...register(`${base}.behaviorNotes` as const)}
        />
      </div>

      <div className="space-y-2">
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

      <div className="space-y-2">
        <Label>Photos</Label>
        <PhotoUploadSection
          queued={queuedPhotos}
          onQueuedChange={onQueuedPhotosChange}
          uploaded={uploadedPhotos}
          catOptions={selectedCat ? [{ id: selectedCat.id, name: selectedCat.name }] : []}
          showTagPicker={false}
        />
      </div>
    </div>
  );
}
