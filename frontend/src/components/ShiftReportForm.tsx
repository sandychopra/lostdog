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
import { SignAction } from "shared/constants/signAction.ts";
import { CatStatus } from "shared/constants/catStatus.ts";
import { ChecklistActionType } from "shared/constants/checklistActionType.ts";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import ErrorAlert from "./ErrorAlert";
import ErrorMessage from "./ErrorMessage";
import CatEntryFields from "./CatEntryFields";
import GroupCatEntryFields from "./GroupCatEntryFields";
import CatNoteGroupList from "./CatNoteGroupList";
import OpenTaskList from "./OpenTaskList";
import PhotoUploadSection, { type QueuedPhoto } from "./PhotoUploadSection";
import type { Cat } from "./CatsTable";
import { occupantLabel, type Kennel } from "./KennelsTable";
import type { ShiftReport } from "./ShiftReportsTable";

interface SignTask {
  id: number;
  action: SignAction;
  cat: { id: number; name: string };
  kennel: { id: number; number: number };
}

interface KennelMoveRequest {
  id: number;
  cat: { id: number; name: string } | null;
  group: { id: number; cats: { id: number; name: string }[] } | null;
  fromKennel: { id: number; number: number };
  toKennel: { id: number; number: number };
}

interface ChecklistAction {
  id: number;
  order: number;
  actionType: ChecklistActionType;
  completed: boolean;
  kennel: { id: number; number: number };
  cat: { id: number; name: string } | null;
  group: { id: number; cats: { id: number; name: string }[] } | null;
}

interface KennelPrepChecklist {
  id: number;
  actions: ChecklistAction[];
}

const SIGN_ACTION_LABELS: Record<SignAction, string> = {
  [SignAction.PostPending]: "Post Adoption Pending sign",
  [SignAction.PostAdopted]: "Post Adopted sign",
  [SignAction.RemovePending]: "Remove Adoption Pending sign",
  [SignAction.RemoveAdopted]: "Remove Adopted sign",
};

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
    kennelsResetIds: report.kennelsReset.map((k) => k.kennelId),
    kennelsFlaggedIds: report.kennelsFlagged.map((k) => k.kennelId),
    // Always empty on edit-load — these are one-way "mark done now" actions, not
    // persisted selections to redisplay (a previously-completed item is no
    // longer Open/eligible, so it won't reappear in either open-items list).
    signTasksCompletedIds: [],
    pickupsConfirmedIds: [],
    kennelMoveRequestsCompletedIds: [],
    checklistActionsCompletedIds: [],
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

  const { data: openSignTasks } = useQuery({
    queryKey: ["sign-tasks", "open"],
    queryFn: async () => {
      const { data } = await api.get<{ signTasks: SignTask[] }>("/api/sign-tasks");
      return data.signTasks;
    },
  });

  const { data: openMoveRequests } = useQuery({
    queryKey: ["kennel-move-requests", "open"],
    queryFn: async () => {
      const { data } = await api.get<{ kennelMoveRequests: KennelMoveRequest[] }>(
        "/api/kennel-move-requests",
      );
      return data.kennelMoveRequests;
    },
  });

  const { data: openChecklists } = useQuery({
    queryKey: ["kennel-prep-checklists", "open"],
    queryFn: async () => {
      const { data } = await api.get<{ checklists: KennelPrepChecklist[] }>(
        "/api/kennel-prep-checklists",
      );
      return data.checklists;
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
          kennelsResetIds: [],
          kennelsFlaggedIds: [],
          signTasksCompletedIds: [],
          pickupsConfirmedIds: [],
          kennelMoveRequestsCompletedIds: [],
          checklistActionsCompletedIds: [],
        },
  });

  const { control, register, formState, setValue } = form;

  const catEntries = useFieldArray({ control, name: "catEntries" });

  const shiftType = useWatch({ control, name: "shiftType" });
  const isSplitShift = useWatch({ control, name: "isSplitShift" });
  const signTasksCompletedIds = useWatch({ control, name: "signTasksCompletedIds" }) ?? [];
  const pickupsConfirmedIds = useWatch({ control, name: "pickupsConfirmedIds" }) ?? [];
  const kennelMoveRequestsCompletedIds =
    useWatch({ control, name: "kennelMoveRequestsCompletedIds" }) ?? [];
  const checklistActionsCompletedIds =
    useWatch({ control, name: "checklistActionsCompletedIds" }) ?? [];

  const nextChecklistActions = (openChecklists ?? []).flatMap((checklist) => {
    const incomplete = [...checklist.actions]
      .filter((a) => !a.completed)
      .sort((a, b) => a.order - b.order);
    const next = incomplete.find((a) => !checklistActionsCompletedIds.includes(a.id));
    return next ? [next] : [];
  });

  const catOptions = (cats ?? []).map((c) => ({ id: c.id, name: c.name }));

  const pickupCandidates = (cats ?? []).filter(
    (cat) => cat.status === CatStatus.Adopted && cat.pickupAt !== null,
  );

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
    queryClient.invalidateQueries({ queryKey: ["sign-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["kennel-move-requests"] });
    queryClient.invalidateQueries({ queryKey: ["kennel-prep-checklists"] });
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

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Kennel Status</h2>
        <div className="flex flex-wrap gap-2">
          {(kennels ?? []).map((kennel) => {
            const hasOccupant = kennel.cats.length > 0 || kennel.groups.length > 0;
            return (
              <span
                key={kennel.id}
                className="rounded-full border border-input px-2.5 py-0.5 text-xs"
              >
                #{kennel.number}: {kennel.state}
                {hasOccupant ? ` — ${occupantLabel(kennel)}` : ""}
              </span>
            );
          })}
        </div>
      </section>

      <div className="space-y-2">
        <Label htmlFor="kennelNotes">Kennel Notes</Label>
        <textarea id="kennelNotes" className={textareaClassName} {...register("kennelNotes")} />
      </div>

      <OpenTaskList
        title="Signs to post"
        items={openSignTasks ?? []}
        getId={(task) => task.id}
        getLabel={(task) =>
          `${SIGN_ACTION_LABELS[task.action]} — ${task.cat.name}, kennel ${task.kennel.number}`
        }
        checkedIds={signTasksCompletedIds}
        onToggle={(id) =>
          setValue(
            "signTasksCompletedIds",
            signTasksCompletedIds.includes(id)
              ? signTasksCompletedIds.filter((x) => x !== id)
              : [...signTasksCompletedIds, id],
            { shouldValidate: true },
          )
        }
      />

      <OpenTaskList
        title="Confirm pickup"
        items={pickupCandidates}
        getId={(cat) => cat.id}
        getLabel={(cat) =>
          `Confirm pickup — ${cat.name}, kennel ${cat.kennel?.number ?? "—"}, scheduled ${new Date(cat.pickupAt!).toLocaleString()}`
        }
        checkedIds={pickupsConfirmedIds}
        onToggle={(id) =>
          setValue(
            "pickupsConfirmedIds",
            pickupsConfirmedIds.includes(id)
              ? pickupsConfirmedIds.filter((x) => x !== id)
              : [...pickupsConfirmedIds, id],
            { shouldValidate: true },
          )
        }
      />

      <OpenTaskList
        title="Kennel moves"
        items={openMoveRequests ?? []}
        getId={(request) => request.id}
        getLabel={(request) =>
          `Move ${request.cat?.name ?? request.group!.cats.map((c) => c.name).join("/")} — kennel ${request.fromKennel.number} → kennel ${request.toKennel.number}`
        }
        checkedIds={kennelMoveRequestsCompletedIds}
        onToggle={(id) =>
          setValue(
            "kennelMoveRequestsCompletedIds",
            kennelMoveRequestsCompletedIds.includes(id)
              ? kennelMoveRequestsCompletedIds.filter((x) => x !== id)
              : [...kennelMoveRequestsCompletedIds, id],
            { shouldValidate: true },
          )
        }
      />

      <OpenTaskList
        title="Kennel prep"
        items={nextChecklistActions}
        getId={(action) => action.id}
        getLabel={(action) =>
          action.actionType === ChecklistActionType.ResetKennel
            ? `Reset kennel ${action.kennel.number}`
            : `Move ${action.cat?.name ?? action.group!.cats.map((c) => c.name).join("/")} → kennel ${action.kennel.number}`
        }
        checkedIds={checklistActionsCompletedIds}
        onToggle={(id) =>
          setValue(
            "checklistActionsCompletedIds",
            checklistActionsCompletedIds.includes(id)
              ? checklistActionsCompletedIds.filter((x) => x !== id)
              : [...checklistActionsCompletedIds, id],
            { shouldValidate: true },
          )
        }
      />

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
