import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createShiftReportSchema,
  updateShiftReportSchema,
  type CreateShiftReportInput,
} from "shared/schemas/shiftReports.ts";
import { ShiftType } from "shared/constants/shiftType.ts";
import { CatEntryType } from "shared/constants/catEntryType.ts";
import { SplitShiftPosition } from "shared/constants/splitShiftPosition.ts";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import ErrorAlert from "./ErrorAlert";
import ErrorMessage from "./ErrorMessage";
import CatEntryFields from "./CatEntryFields";
import GroupCatEntryFields from "./GroupCatEntryFields";
import CatNoteGroupList from "./CatNoteGroupList";
import KennelStatusList from "./KennelStatusList";
import PhotoUploadSection, { type QueuedPhoto } from "./PhotoUploadSection";
import type { Cat } from "./CatsTable";
import type { Kennel } from "./KennelsTable";
import type { ShiftReport } from "./ShiftReportsTable";

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const textareaClassName =
  "flex min-h-16 w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function toDateInputValue(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "";
}

function queueKeyForEntry(fieldId: string, entryId: number | undefined): string {
  return entryId !== undefined ? `existing-${entryId}` : `new-${fieldId}`;
}

function mapReportToDefaultValues(report: ShiftReport): CreateShiftReportInput {
  return {
    shiftType: report.shiftType,
    date: toDateInputValue(report.date) as unknown as Date,
    isSplitShift: report.isSplitShift,
    splitShiftPosition: report.splitShiftPosition ?? undefined,
    cleaningNotes: report.cleaningNotes ?? "",
    suppliesNotes: report.suppliesNotes ?? "",
    kennelNotes: report.kennelNotes ?? "",
    otherNotes: report.otherNotes ?? "",
    catEntries: report.catEntries.map((entry) =>
      entry.entryType === CatEntryType.Individual
        ? {
            id: entry.id,
            entryType: CatEntryType.Individual,
            catId: entry.catId!,
            fecalScore: entry.fecalScore ?? undefined,
            pee: entry.pee,
            peePooNotes: entry.peePooNotes ?? "",
            dryFoodAmount: entry.dryFoodAmount ?? undefined,
            wetFoodAmount: entry.wetFoodAmount ?? undefined,
            wetFoodBrand: entry.wetFoodBrand ?? "",
            foodNotes: entry.foodNotes ?? "",
            snackTreat: entry.snackTreat ?? undefined,
            snackTreatNote: entry.snackTreatNote ?? "",
            medicalNotes: entry.medicalNotes ?? "",
            dewormerGiven: entry.dewormerGiven,
            probioticGiven: entry.probioticGiven,
            behaviorNotes: entry.behaviorNotes ?? "",
            otherNotes: entry.otherNotes ?? "",
            nailTrim: entry.nailTrim,
          }
        : {
            id: entry.id,
            entryType: CatEntryType.Group,
            groupId: entry.groupId!,
            fecalScore: entry.fecalScore ?? undefined,
            pee: entry.pee,
            peePooNotes: entry.peePooNotes ?? "",
            dryFoodAmount: entry.dryFoodAmount ?? undefined,
            foodNotes: entry.foodNotes ?? "",
            otherNotes: entry.otherNotes ?? "",
            catDetails: entry.groupDetails.map((detail) => ({
              catId: detail.catId,
              wetFoodAmount: detail.wetFoodAmount ?? undefined,
              wetFoodBrand: detail.wetFoodBrand ?? "",
              snackTreat: detail.snackTreat ?? undefined,
              snackTreatNote: detail.snackTreatNote ?? "",
              foodNotes: detail.foodNotes ?? "",
              medicalNotes: detail.medicalNotes ?? "",
              dewormerGiven: detail.dewormerGiven,
              probioticGiven: detail.probioticGiven,
              behaviorNotes: detail.behaviorNotes ?? "",
              otherNotes: detail.otherNotes ?? "",
              nailTrim: detail.nailTrim,
            })),
          },
    ),
    meetAndGreets: report.meetAndGreets.map((meetAndGreet) => ({
      id: meetAndGreet.id,
      note: meetAndGreet.note,
      catIds: meetAndGreet.cats.map((c) => c.catId),
    })),
    playGroups: report.playGroups.map((playGroup) => ({
      id: playGroup.id,
      note: playGroup.note,
      catIds: playGroup.cats.map((c) => c.catId),
    })),
    kennelsStatus: report.kennelsStatus.map((k) => ({
      kennelId: k.kennelId,
      reportedState: k.reportedState,
      note: k.note ?? "",
    })),
  };
}

async function uploadPhoto(args: {
  file: File;
  shiftReportId: number;
  catEntryId?: number;
  catIds: number[];
}) {
  const formData = new FormData();
  formData.append("photo", args.file);
  formData.append("shiftReportId", String(args.shiftReportId));
  if (args.catEntryId !== undefined) formData.append("catEntryId", String(args.catEntryId));
  if (args.catIds.length > 0) formData.append("catIds", JSON.stringify(args.catIds));
  return api.post("/api/photos", formData);
}

interface ShiftReportFormProps {
  report?: ShiftReport;
  onSuccess: (id: number) => void;
}

export default function ShiftReportForm({ report, onSuccess }: ShiftReportFormProps) {
  const isEdit = !!report;
  const queryClient = useQueryClient();
  const [photoQueue, setPhotoQueue] = useState<Record<string, QueuedPhoto[]>>({});

  const { data: cats } = useQuery({
    queryKey: ["cats"],
    queryFn: async () => {
      const { data } = await api.get<{ cats: Cat[] }>("/api/cats");
      return data.cats;
    },
  });

  const { data: kennels } = useQuery({
    queryKey: ["kennels"],
    queryFn: async () => {
      const { data } = await api.get<{ kennels: Kennel[] }>("/api/kennels");
      return data.kennels;
    },
  });

  const form = useForm<CreateShiftReportInput>({
    resolver: zodResolver(isEdit ? updateShiftReportSchema : createShiftReportSchema),
    defaultValues: report
      ? mapReportToDefaultValues(report)
      : {
          shiftType: ShiftType.Morning,
          date: toDateInputValue(new Date().toISOString()) as unknown as Date,
          isSplitShift: false,
          catEntries: [],
          meetAndGreets: [],
          playGroups: [],
          kennelsStatus: [],
        },
  });

  const { control, register, formState, setError } = form;

  const catEntries = useFieldArray({ control, name: "catEntries" });

  const shiftType = useWatch({ control, name: "shiftType" });
  const isSplitShift = useWatch({ control, name: "isSplitShift" });

  const catOptions = (cats ?? []).map((c) => ({ id: c.id, name: c.name }));

  const uploadedByEntryId = new Map((report?.catEntries ?? []).map((e) => [e.id, e.photos]));

  const mutation = useMutation({
    mutationFn: async (payload: CreateShiftReportInput) => {
      if (isEdit) {
        const { data } = await api.put(`/api/shift-reports/${report.id}`, payload);
        return data.shiftReport as ShiftReport;
      }
      const { data } = await api.post("/api/shift-reports", payload);
      return data.shiftReport as ShiftReport;
    },
  });

  async function onSubmit(data: CreateShiftReportInput) {
    // A note is only required when the reported state disagrees with the
    // kennel's current state — checked here for immediate feedback, since
    // the schema can't see live kennel state; the backend re-checks this
    // authoritatively regardless.
    const kennelById = new Map((kennels ?? []).map((k) => [k.id, k]));
    for (const [index, status] of data.kennelsStatus.entries()) {
      const kennel = kennelById.get(status.kennelId);
      if (kennel && status.reportedState !== kennel.state && !status.note) {
        setError(`kennelsStatus.${index}.note`, {
          message: `Doesn't match the system's current state (${kennel.state}) — a note is required`,
        });
        return;
      }
    }

    const saved = await mutation.mutateAsync(data);

    const knownIds = new Set(
      data.catEntries.map((entry) => entry.id).filter((id): id is number => id !== undefined),
    );
    const submittedNewEntries = catEntries.fields
      .map((field, i) => ({ field, entry: data.catEntries[i]! }))
      .filter(({ entry }) => entry.id === undefined);
    const responseNewEntries = saved.catEntries.filter((entry) => !knownIds.has(entry.id));

    const resolvedIdByQueueKey = new Map<string, number>();
    submittedNewEntries.forEach(({ field }, i) => {
      const real = responseNewEntries[i];
      if (real) resolvedIdByQueueKey.set(`new-${field.id}`, real.id);
    });

    const uploads: Promise<unknown>[] = [];
    for (const photo of photoQueue.report ?? []) {
      uploads.push(
        uploadPhoto({ file: photo.file, shiftReportId: saved.id, catIds: photo.catIds }),
      );
    }
    for (const [key, photos] of Object.entries(photoQueue)) {
      if (key === "report" || photos.length === 0) continue;
      const catEntryId = key.startsWith("existing-")
        ? Number(key.replace("existing-", ""))
        : resolvedIdByQueueKey.get(key);
      if (catEntryId === undefined) continue;
      for (const photo of photos) {
        uploads.push(
          uploadPhoto({
            file: photo.file,
            shiftReportId: saved.id,
            catEntryId,
            catIds: photo.catIds,
          }),
        );
      }
    }
    await Promise.allSettled(uploads);

    queryClient.invalidateQueries({ queryKey: ["shiftReports"] });
    queryClient.invalidateQueries({ queryKey: ["cats"] });
    queryClient.invalidateQueries({ queryKey: ["kennels"] });
    queryClient.invalidateQueries({ queryKey: ["announcements"] });
    onSuccess(saved.id);
  }

  function addIndividualEntry() {
    catEntries.append({
      entryType: CatEntryType.Individual,
      catId: undefined as unknown as number,
      pee: false,
      dewormerGiven: false,
      probioticGiven: false,
      nailTrim: false,
    });
  }

  function addGroupEntry() {
    catEntries.append({
      entryType: CatEntryType.Group,
      groupId: undefined as unknown as number,
      pee: false,
      catDetails: [],
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="shiftType">Shift Type</Label>
          <select id="shiftType" className={selectClassName} {...register("shiftType")}>
            <option value={ShiftType.Morning}>Morning</option>
            <option value={ShiftType.MidDay}>Mid-day</option>
            <option value={ShiftType.Evening}>Evening</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" {...register("date")} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="isSplitShift"
          type="checkbox"
          className="h-4 w-4"
          disabled={shiftType === ShiftType.MidDay}
          {...register("isSplitShift")}
        />
        <Label htmlFor="isSplitShift">Split shift (Morning/Evening only)</Label>
      </div>

      {isSplitShift && (
        <div className="space-y-2">
          <Label htmlFor="splitShiftPosition">Which half of the shift?</Label>
          <select
            id="splitShiftPosition"
            className={selectClassName}
            {...register("splitShiftPosition")}
          >
            <option value="">Select</option>
            <option value={SplitShiftPosition.First}>First shift</option>
            <option value={SplitShiftPosition.Second}>Second shift</option>
          </select>
          <ErrorMessage message={formState.errors.splitShiftPosition?.message} />
        </div>
      )}

      <KennelStatusList form={form} kennelOptions={kennels ?? []} />

      <div className="space-y-2">
        <Label htmlFor="kennelNotes">Kennel Notes</Label>
        <textarea id="kennelNotes" className={textareaClassName} {...register("kennelNotes")} />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Cat Entries</h2>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={addIndividualEntry}>
              Add Individual Entry
            </Button>
            <Button type="button" variant="secondary" onClick={addGroupEntry}>
              Add Group Entry
            </Button>
          </div>
        </div>
        {catEntries.fields.map((field, index) => {
          const entryType = form.getValues(`catEntries.${index}.entryType`);
          const entryId = form.getValues(`catEntries.${index}.id`);
          const key = queueKeyForEntry(field.id, entryId);
          const uploaded = entryId !== undefined ? (uploadedByEntryId.get(entryId) ?? []) : [];
          return entryType === CatEntryType.Individual ? (
            <CatEntryFields
              key={field.id}
              form={form}
              index={index}
              cats={cats ?? []}
              onRemove={() => catEntries.remove(index)}
              queuedPhotos={photoQueue[key] ?? []}
              onQueuedPhotosChange={(next) => setPhotoQueue((prev) => ({ ...prev, [key]: next }))}
              uploadedPhotos={uploaded}
            />
          ) : (
            <GroupCatEntryFields
              key={field.id}
              form={form}
              index={index}
              cats={cats ?? []}
              kennels={kennels ?? []}
              onRemove={() => catEntries.remove(index)}
              queuedPhotos={photoQueue[key] ?? []}
              onQueuedPhotosChange={(next) => setPhotoQueue((prev) => ({ ...prev, [key]: next }))}
              uploadedPhotos={uploaded}
            />
          );
        })}
      </section>

      <CatNoteGroupList
        form={form}
        name="playGroups"
        title="Play Groups"
        addLabel="Add Play Group"
        catOptions={catOptions}
      />

      <CatNoteGroupList
        form={form}
        name="meetAndGreets"
        title="Meet & Greets"
        addLabel="Add Meet & Greet"
        catOptions={catOptions}
      />

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Photos</h2>
        <PhotoUploadSection
          queued={photoQueue.report ?? []}
          onQueuedChange={(next) => setPhotoQueue((prev) => ({ ...prev, report: next }))}
          uploaded={report?.photos ?? []}
          catOptions={catOptions}
          showTagPicker
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Overall Notes</h2>
        <div className="space-y-2">
          <Label htmlFor="cleaningNotes">Cleaning Notes</Label>
          <textarea
            id="cleaningNotes"
            className={textareaClassName}
            {...register("cleaningNotes")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="suppliesNotes">Supplies Notes</Label>
          <textarea
            id="suppliesNotes"
            className={textareaClassName}
            {...register("suppliesNotes")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="otherNotes">Other Notes</Label>
          <textarea id="otherNotes" className={textareaClassName} {...register("otherNotes")} />
        </div>
      </section>

      {mutation.error !== null && (
        <ErrorAlert error={mutation.error} fallback="Failed to save shift report" />
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending
            ? isEdit
              ? "Saving..."
              : "Creating..."
            : isEdit
              ? "Save Changes"
              : "Submit Report"}
        </Button>
      </div>
    </form>
  );
}
